import { render as renderRTL, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import MovieDetail from "./MovieDetail";
import { server } from "../test/server";
import { http, HttpResponse } from "msw";
import App from "../App";
import userEvent from "@testing-library/user-event";
import LocationDisplay from "../test/LocationDisplay";
import { AuthProvider } from "../context/AuthProvider";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function render(ui: ReactNode) {
  return renderRTL(<AuthProvider>{ui}</AuthProvider>);
}

describe("MovieDetail", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // Test 1: loading state
  it("shows a loading message while fetching", () => {
    render(
      <MemoryRouter initialEntries={["/movie/123"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Loading movie details/i)).toBeInTheDocument();
  });

  // Test 2: poster shown
  it("shows the movie poster", async () => {
    render(
      <MemoryRouter initialEntries={["/movie/574475"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    const poster = await screen.findByAltText(/Final Destination Bloodlines/i);
    expect(poster).toHaveAttribute(
      "src",
      expect.stringContaining("final-destination-bloodlines"),
    );
  });

  // Test 3: movie details are shown
  it("displays the movie title, rating, release, runtime, and genres", async () => {
    render(
      <MemoryRouter initialEntries={["/movie/574475"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Final Destination Bloodlines"),
    ).toBeInTheDocument();
    expect(screen.getByText(/7.0 \/ 10/i)).toBeInTheDocument();
    expect(screen.getByText(/2025-05-14/i)).toBeInTheDocument();
    expect(screen.getByText(/110 min/i)).toBeInTheDocument();
    expect(screen.getByText(/Horror, Mystery/i)).toBeInTheDocument();
  });

  //Test 4: Shows the overview
  it("shows the movie overview", async () => {
    render(
      <MemoryRouter initialEntries={["/movie/574475"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Plagued by a violent recurring nightmare/i),
    ).toBeInTheDocument();
  });

  //Test 5: Shows the cast members
  it("shows all cast members with their names and characters", async () => {
    render(
      <MemoryRouter initialEntries={["/movie/574475"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Final Destination Bloodlines");

    expect(screen.getByText("Kaitlyn Santa Juana")).toBeInTheDocument();
    expect(screen.getByText("Stefani Reyes")).toBeInTheDocument();

    expect(screen.getByText("Teo Briones")).toBeInTheDocument();
    expect(screen.getByText("Charlie Reyes")).toBeInTheDocument();

    expect(screen.getByText("Rya Kihlstedt")).toBeInTheDocument();
    expect(screen.getByText("Darlene Campbell")).toBeInTheDocument();

    expect(screen.getByText("Richard Harmon")).toBeInTheDocument();
    expect(screen.getByText("Erik")).toBeInTheDocument();

    expect(screen.getByText("Owen Patrick Joyner")).toBeInTheDocument();
    expect(screen.getByText("Bobby")).toBeInTheDocument();
  });

  it("records a successfully loaded movie for a logged-in user", async () => {
    let recordedMovie: unknown;
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json({ user: { id: "user-1", username: "film_fan", email: "film@example.com" } }),
      ),
      http.post(`${BASE_URL}/history/viewed`, async ({ request }) => {
        recordedMovie = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/movie/574475"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Final Destination Bloodlines" });
    await waitFor(() => {
      expect(recordedMovie).toEqual({
        movieId: 574475,
        title: "Final Destination Bloodlines",
        posterPath: "/final-destination-bloodlines.jpg",
        releaseDate: "2025-05-14",
      });
    });
  });

  // Test 6: Movie not found error
  it("shows an error when API returns 404", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/movie/:id", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/movie/999"]}>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Movie not found/i)).toBeInTheDocument();
  });

  // Test 7: back button goes back
  it('navigates back to the home page when "Back to Search" is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/", "/movie/574475"]} initialIndex={1}>
          <LocationDisplay/>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
          </Routes>
        </MemoryRouter>,
    );

    await screen.findByText("Final Destination Bloodlines");
    const backButton = screen.getByText(/← Back to Search/i);
    await user.click(backButton);

    // confirms page is exactly on root
    expect(screen.getByTestId("location-display").textContent).toBe("/");
  });

  // Test 8: a slow response for the previous movie doesn't replace the current one
  it("ignores a late response for a movie the user has navigated away from", async () => {
    const user = userEvent.setup();
    let releaseSlowMovie: () => void = () => {};
    const slowMovieGate = new Promise<void>((resolve) => {
      releaseSlowMovie = resolve;
    });
    let slowMovieRequested = false;

    const details = (id: number, title: string) => ({
      id,
      title,
      overview: "",
      poster_path: null,
      release_date: "2000-01-01",
      runtime: 100,
      vote_average: 7,
      genres: [],
      credits: { cast: [] },
    });

    server.use(
      http.get("https://api.themoviedb.org/3/movie/:id", async ({ params }) => {
        if (params.id === "1") {
          slowMovieRequested = true;
          await slowMovieGate;
          return HttpResponse.json(details(1, "Slow Movie"));
        }
        return HttpResponse.json(details(2, "Fast Movie"));
      }),
    );

    render(
      <MemoryRouter initialEntries={["/movie/1"]}>
        <Link to="/movie/2">Open movie 2</Link>
        <Routes>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(slowMovieRequested).toBe(true));
    await user.click(screen.getByText("Open movie 2"));
    expect(await screen.findByRole("heading", { name: "Fast Movie" })).toBeInTheDocument();

    // Let movie 1's response arrive late, then give React a chance to apply it.
    releaseSlowMovie();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByRole("heading", { name: "Fast Movie" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Slow Movie" })).not.toBeInTheDocument();
  });
});
