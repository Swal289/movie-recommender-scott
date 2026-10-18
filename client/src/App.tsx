import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./App.css";
import SearchBar from "./components/SearchBar.tsx";
import SearchResultsList from "./components/SearchResultsList.tsx";
import FilterPanel from "./components/FilterPanel.tsx";
import { useMovieResults } from "./hooks/useMovieResults.ts";
import type { Movie } from "./types/movie.ts";
import type { DiscoverFilters } from "./api/discoverMovies";
import RandomButton from "./components/RandomButton.tsx";
import { CURRENT_YEAR, MIN_YEAR } from "./constants/filters";
import { writeStoredFilters, writeStoredQuery } from "./utils/searchStorage";
import { useAuth } from "./hooks/useAuth.ts";

function App() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Unable to log out. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  const [query, setQuery] = useState<string>(() => {
    const savedQuery = sessionStorage.getItem("movieSearchQuery");
    if (!savedQuery) {
      return "";
    }

    try {
      const parsed = JSON.parse(savedQuery) as unknown;

      if (typeof parsed === "string" && /^[^<>]*$/.test(parsed)) {
        return parsed;
      }
      return "";
    } catch {
      return "";
    }
  });

  const [filters, setFilters] = useState<DiscoverFilters>(() => {
    const savedFilters = sessionStorage.getItem("movieSearchFilters");
    if (!savedFilters) {
      return {};
    }

    try {
      const parsed = JSON.parse(savedFilters) as Record<string, unknown>;
      const safeFilters: DiscoverFilters = {};

      if (typeof parsed.genre === "number") {
        safeFilters.genre = parsed.genre;
      }
      if (typeof parsed.yearFrom === "number") {
        safeFilters.yearFrom = parsed.yearFrom;
      }
      if (typeof parsed.yearTo === "number") {
        safeFilters.yearTo = parsed.yearTo;
      }
      if (typeof parsed.language === "string") {
        safeFilters.language = parsed.language;
      }
      if (typeof parsed.ratingMin === "number") {
        safeFilters.ratingMin = parsed.ratingMin;
      }
      if (typeof parsed.castId === "number") {
        safeFilters.castId = parsed.castId;
      }

      if (typeof parsed.sort === "string" && ["popularity", "rating", "release_date"].includes(parsed.sort)) {
        safeFilters.sort = parsed.sort as DiscoverFilters["sort"];
      }

      return safeFilters;
    } catch {
      return {};
    }
  });

  const { movies, isLoading, hasSearched, hasMore, loadMore } = useMovieResults(
    query,
    filters,
  );

  useEffect(() => {
    writeStoredQuery(query);
  }, [query]);

  useEffect(() => {
    writeStoredFilters(filters);
  }, [filters]);

  const handleMovieClick = (movie: Movie) => {
    void navigate(`/movie/${movie.id}`);
  };

  const hasActiveFilters =
    filters.genre !== undefined ||
    filters.ratingMin !== undefined ||
    filters.castId !== undefined ||
    (filters.yearFrom !== undefined && filters.yearFrom !== MIN_YEAR) ||
    (filters.yearTo !== undefined && filters.yearTo !== CURRENT_YEAR);
  let accountActions;

  if (isAuthLoading) {
    accountActions = <output>Checking your session…</output>;
  } else if (user) {
    accountActions = (
      <>
        <span>Hello, {user.username}</span>
        <Link to="/profile" className="account-link">
          Profile
        </Link>
        <button
          type="button"
          className="account-link"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </>
    );
  } else {
    accountActions = (
      <>
        <Link to="/login" className="account-link">
          Log in
        </Link>

        <Link to="/signup" className="account-link">
          Register
        </Link>
      </>
    );
  }

  return (
    <section id="search-page">
      <div className="account-actions">{accountActions}</div>
      {logoutError && (
        <p className="account-error" role="alert">
          {logoutError}
        </p>
      )}
      <SearchBar
        onQueryChange={setQuery}
        isLoading={isLoading}
        initialValue={query}
      />
      <RandomButton />
      <button
        type="button"
        className="filter-toggle"
        onClick={() => setShowFilters((v) => !v)}
        aria-expanded={showFilters}
      >
        <svg
          className="filter-toggle__icon"
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
          />
        </svg>
        Filters
        {hasActiveFilters && (
          <span className="filter-toggle__dot" aria-label="Filters active" />
        )}
        <svg
          className="filter-toggle__chevron"
          width="14"
          height="14"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <div
        className={`filter-panel-wrap ${showFilters ? "filter-panel-wrap--open" : ""}`}
      >
        <FilterPanel
          onFiltersChange={setFilters}
          searchActive={query.length > 0}
          initialFilters={filters}
        />
      </div>

      <SearchResultsList
        movies={movies}
        isLoading={isLoading}
        hasSearched={hasSearched}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onMovieClick={handleMovieClick}
      />
    </section>
  );
}

export default App;
