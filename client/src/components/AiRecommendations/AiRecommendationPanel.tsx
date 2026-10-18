import { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { useAiRecommendations } from "../../hooks/useAiRecommendations";
import "./AiRecommendationPanel.css";

interface Props {
  movieId: number;
  title: string;
  year: number | null;
}

/**
 * AI control overlaid on the movie graph: a "Generate" button that opens a card
 * with an interest summary and three recommended movies.
 */
export default function AiRecommendationPanel({ movieId, title, year }: Readonly<Props>) {
  const { status, result, error, isOpen, open, close, retry } = useAiRecommendations(
    movieId,
    title,
    year,
  );
  const headingId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Focus management for keyboard and screen-reader users: move focus into the card
  // when it opens, and hand it back to the trigger button when it closes.
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // After an error, put focus on "Try again" so the user can retry straight away.
  useEffect(() => {
    if (isOpen && status === "error") {
      retryButtonRef.current?.focus();
    }
  }, [isOpen, status]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const buttonLabel =
    status === "success" ? "Show AI recommendations" : "Generate AI recommendations";

  return (
    <div className="ai-panel">
      {!isOpen && (
        <button ref={triggerRef} type="button" className="ai-panel__trigger" onClick={open}>
          <span aria-hidden="true">✦</span> {buttonLabel}
        </button>
      )}

      {isOpen && (
        <section className="ai-panel__card" role="dialog" aria-labelledby={headingId}>
          <header className="ai-panel__header">
            <h3 id={headingId} className="ai-panel__title">
              <span aria-hidden="true">✦</span> AI picks for you
            </h3>
            <button
              ref={closeButtonRef}
              type="button"
              className="ai-panel__close"
              onClick={close}
              aria-label="Close AI recommendations"
            >
              ×
            </button>
          </header>

          {status === "loading" && (
            <div className="ai-panel__loading" role="status" aria-live="polite">
              <span className="ai-panel__spinner" aria-hidden="true" />
              Thinking about what you might like…
            </div>
          )}

          {status === "error" && (
            <div className="ai-panel__error" role="alert">
              <p>{error}</p>
              <button
                ref={retryButtonRef}
                type="button"
                className="ai-panel__retry"
                onClick={retry}
              >
                Try again
              </button>
            </div>
          )}

          {status === "success" && result && (
            <>
              {result.summary && (
                <p className="ai-panel__summary" data-testid="ai-summary">
                  {result.summary}
                </p>
              )}
              {result.movies.length === 0 ? (
                <p className="ai-panel__empty">No recommendations found for this movie.</p>
              ) : (
                <ul className="ai-panel__list">
                  {result.movies.map((movie) => {
                    const content = (
                      <>
                        {movie.posterUrl ? (
                          <img src={movie.posterUrl} alt="" className="ai-panel__poster" />
                        ) : (
                          <div className="ai-panel__poster ai-panel__poster--empty" />
                        )}
                        <div className="ai-panel__movie-text">
                          <span className="ai-panel__movie-title">
                            {movie.title}
                            {movie.year && <span className="ai-panel__year"> ({movie.year})</span>}
                          </span>
                          {movie.reason && (
                            <span className="ai-panel__reason">{movie.reason}</span>
                          )}
                        </div>
                      </>
                    );
                    // The AI can suggest a movie TMDB doesn't match; show it, just without a link.
                    return (
                      <li key={`${movie.id ?? "unmatched"}-${movie.title}`}>
                        {movie.id === null ? (
                          <div className="ai-panel__movie">{content}</div>
                        ) : (
                          <Link to={`/movie/${movie.id}`} className="ai-panel__movie">
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
