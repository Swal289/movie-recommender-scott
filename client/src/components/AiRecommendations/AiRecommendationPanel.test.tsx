import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server";
import LocationDisplay from "../../test/LocationDisplay";
import AiRecommendationPanel from "./AiRecommendationPanel";

const AI_URL = "http://localhost:5000/api/llm-recommender";

const SUMMARY = "You enjoy slow-burn sci-fi with big ideas.";

// Mirrors the shape returned by server/src/controllers/llmRecommendation.controller.ts
const aiResponse = {
  success: true,
  selectedMovie: { title: "Interstellar", releaseYear: 2014 },
  data: {
    userInterestSummary: SUMMARY,
    recommendations: [
      { title: "Arrival", releaseYear: 2016, justification: "Cerebral first contact.", imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", movieId: "101" },
      { title: "Annihilation", releaseYear: 2018, justification: "Eerie and philosophical.", imageUrl: "https://via.placeholder.com/300x450?text=No+Poster", movieId: "102" },
      { title: "Moon", releaseYear: 2009, justification: "Isolated and introspective.", imageUrl: "https://image.tmdb.org/t/p/w500/m.jpg", movieId: "103" },
    ],
  },
};

/** Registers the AI endpoint and counts how many times it is hit. */
function mockAi(
  resolver: () => Response | Promise<Response> = () => HttpResponse.json(aiResponse),
) {
  const calls: { movie: string | null; releaseYear: string | null }[] = [];
  server.use(
    http.get(AI_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push({ movie: params.get("movie"), releaseYear: params.get("releaseYear") });
      return resolver();
    }),
  );
  return calls;
}

function renderPanel(movieId = 1, title = "Interstellar", year: number | null = 2014) {
  return render(
    <MemoryRouter initialEntries={["/movie/1"]}>
      <Routes>
        <Route path="*" element={<AiRecommendationPanel movieId={movieId} title={title} year={year} />} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  );
}

const openButton = () => screen.getByRole("button", { name: /ai recommendations/i });

describe("AiRecommendationPanel", () => {
  // Always exercise the real backend path, even if a developer's .env has VITE_AI_MOCK=true.
  beforeEach(() => {
    vi.stubEnv("VITE_AI_MOCK", "false");
  });

  it("shows the generate button and no card initially", () => {
    mockAi();
    renderPanel();

    expect(openButton()).toHaveTextContent("Generate AI recommendations");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a loading state, then the summary and three movies", async () => {
    mockAi(async () => {
      await delay(50);
      return HttpResponse.json(aiResponse);
    });
    renderPanel();

    await userEvent.click(openButton());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/thinking/i);

    expect(await screen.findByTestId("ai-summary")).toHaveTextContent(SUMMARY);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/movie/101",
      "/movie/102",
      "/movie/103",
    ]);
  });

  it("sends the current movie's title and release year to the backend", async () => {
    const calls = mockAi();
    renderPanel(42, "Dune", 2021);

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");

    expect(calls).toEqual([{ movie: "Dune", releaseYear: "2021" }]);
  });

  it("shows a movie TMDB couldn't match without a link", async () => {
    const unmatched = structuredClone(aiResponse);
    unmatched.data.recommendations = unmatched.data.recommendations.map((rec) =>
      rec.title === "Annihilation" ? { ...rec, movieId: "" } : rec,
    );
    mockAi(() => HttpResponse.json(unmatched));
    renderPanel();

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");

    expect(screen.getByText("Annihilation")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /annihilation/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows only real posters, not the backend's placeholder image", async () => {
    mockAi();
    const { container } = renderPanel();

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");

    const posters = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(posters).toEqual([
      "https://image.tmdb.org/t/p/w500/a.jpg",
      "https://image.tmdb.org/t/p/w500/m.jpg",
    ]);
  });

  it("shows an error without calling the backend when the release year is unknown", async () => {
    const calls = mockAi();
    renderPanel(1, "Unknown Film", null);

    await userEvent.click(openButton());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("navigates to the movie page when a result is clicked", async () => {
    mockAi();
    renderPanel();

    await userEvent.click(openButton());
    await userEvent.click(await screen.findByRole("link", { name: /arrival/i }));

    expect(screen.getByTestId("location-display")).toHaveTextContent("/movie/101");
  });

  it("shows an error with a working retry", async () => {
    let fail = true;
    mockAi(() => (fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(aiResponse)));
    renderPanel();

    await userEvent.click(openButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't generate/i);

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByTestId("ai-summary")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes with the close button and with Escape", async () => {
    mockAi();
    renderPanel();

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(openButton());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the existing response when reopened, without refetching", async () => {
    const calls = mockAi();
    renderPanel();

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");
    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(openButton()).toHaveTextContent("Show AI recommendations");
    await userEvent.click(openButton());

    expect(screen.getByTestId("ai-summary")).toHaveTextContent(SUMMARY);
    expect(calls).toHaveLength(1);
  });

  it("clears the response when a different movie is selected", async () => {
    const calls = mockAi();
    const { rerender } = renderPanel(1, "Interstellar");

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");

    rerender(
      <MemoryRouter>
        <AiRecommendationPanel movieId={2} title="Dune" year={2021} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openButton()).toHaveTextContent("Generate AI recommendations");

    await userEvent.click(openButton());
    await screen.findByTestId("ai-summary");
    await waitFor(() =>
      expect(calls.map((c) => c.movie)).toEqual(["Interstellar", "Dune"]),
    );
  });

  it("moves focus to the close button when opened and back to the trigger when closed", async () => {
    mockAi();
    renderPanel();

    await userEvent.click(openButton());
    expect(screen.getByRole("button", { name: /close ai recommendations/i })).toHaveFocus();

    await screen.findByTestId("ai-summary");
    await userEvent.keyboard("{Escape}");

    expect(openButton()).toHaveFocus();
  });

  it("announces the loading state politely to screen readers", async () => {
    mockAi(async () => {
      await delay(50);
      return HttpResponse.json(aiResponse);
    });
    renderPanel();

    await userEvent.click(openButton());

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("focuses the retry button after an error so it can be used from the keyboard", async () => {
    mockAi(() => new HttpResponse(null, { status: 500 }));
    renderPanel();

    await userEvent.click(openButton());
    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: /try again/i })).toHaveFocus();
  });

  it("ignores a slow response for the previous movie", async () => {
    mockAi(async () => {
      await delay(100);
      return HttpResponse.json(aiResponse);
    });
    const { rerender } = renderPanel(1, "Interstellar");

    await userEvent.click(openButton());
    rerender(
      <MemoryRouter>
        <AiRecommendationPanel movieId={2} title="Dune" year={2021} />
      </MemoryRouter>,
    );

    await delay(150);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-summary")).not.toBeInTheDocument();
  });
});
