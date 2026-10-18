import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getViewingHistory, type ViewingHistoryItem } from "../api/viewingHistory";
import "./Profile.css";

const HISTORY_PAGE_SIZE = 20;
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w154";
const FALLBACK_POSTER = "https://via.placeholder.com/80x120?text=No+Poster";

export default function Profile() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [history, setHistory] = useState<ViewingHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRetry, setHistoryRetry] = useState(0);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    setHistory([]);
    setHistoryPage(0);
    setHistoryTotalPages(0);
    setHistoryLoading(true);
    setHistoryError(null);

    getViewingHistory(1, HISTORY_PAGE_SIZE, controller.signal)
      .then((result) => {
        setHistory(result.items);
        setHistoryPage(result.page);
        setHistoryTotalPages(result.totalPages);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHistoryError(
            error instanceof Error ? error.message : "Unable to load viewing history",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [user?.id, historyRetry]);

  async function loadMoreHistory() {
    if (historyLoading || historyLoadingMore || historyPage >= historyTotalPages) return;

    setHistoryLoadingMore(true);
    setHistoryError(null);
    try {
      const result = await getViewingHistory(historyPage + 1, HISTORY_PAGE_SIZE);
      setHistory((previous) => [...previous, ...result.items]);
      setHistoryPage(result.page);
      setHistoryTotalPages(result.totalPages);
    } catch (error: unknown) {
      setHistoryError(
        error instanceof Error ? error.message : "Unable to load more viewing history",
      );
    } finally {
      setHistoryLoadingMore(false);
    }
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await logout();
      void navigate("/", { replace: true });
    } catch (error: unknown) {
      console.error("Failed to log out of profile:", error);
      setLogoutError("Unable to log out. Please try again.");
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return (
      <main className="profile-page">
        <output>Loading your profile…</output>
      </main>
    );
  }

  if (!user) {
    // logout() clears the user before handleLogout navigates.
    // Keeps logout navigation on the homepage instead of redirecting to login.
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  return (
    <main className="profile-page">
      <Link to="/">← Back to movies</Link>

      <h1>Your profile</h1>

      <section
        className="profile-card"
        aria-labelledby="account-details-heading"
      >
        <h2 id="account-details-heading">Account details</h2>

        <dl className="profile-details">
          <div>
            <dt>Username</dt>
            <dd>{user.username}</dd>
          </div>

          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>

      <section
        className="profile-card"
        aria-labelledby="viewing-history-heading"
      >
        <h2 id="viewing-history-heading">Viewing history</h2>
        {historyLoading && history.length === 0 && (
          <p role="status">Loading viewing history…</p>
        )}
        {historyError && (
          <div>
            <p className="profile-error" role="alert">{historyError}</p>
            <button
              type="button"
              onClick={() => setHistoryRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {!historyLoading && !historyError && history.length === 0 && (
          <p>You haven’t viewed any movies yet.</p>
        )}
        {history.length > 0 && (
          <ul className="viewing-history-list">
            {history.map((entry) => {
              const posterUrl = entry.posterPath
                ? `${POSTER_BASE_URL}${entry.posterPath}`
                : FALLBACK_POSTER;
              const releaseYear = entry.releaseDate?.slice(0, 4);

              return (
                <li key={entry.movieId}>
                  <Link
                    className="viewing-history-item"
                    to={`/movie/${entry.movieId}`}
                  >
                    <img src={posterUrl} alt="" loading="lazy" />
                    <span className="viewing-history-item__details">
                      <strong>{entry.title}</strong>
                      {releaseYear && <span>{releaseYear}</span>}
                      <time dateTime={entry.lastViewedAt}>
                        Viewed {new Date(entry.lastViewedAt).toLocaleDateString()}
                      </time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {historyLoadingMore && <p role="status">Loading more history…</p>}
        {historyPage < historyTotalPages && !historyError && (
          <button
            type="button"
            className="viewing-history-more"
            onClick={() => void loadMoreHistory()}
            disabled={historyLoadingMore}
          >
            {historyLoadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
      {logoutError && (
        <p className="profile-error" role="alert">
          {logoutError}
        </p>
      )}

      <button
        type="button"
        className="profile-logout"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out…" : "Log out"}
      </button>
    </main>
  );
}
