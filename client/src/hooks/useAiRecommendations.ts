import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAiRecommendations,
  type AiRecommendationResult,
} from "../api/aiRecommendations";
import { isAbortError } from "../api/tmdb";

export type AiStatus = "idle" | "loading" | "success" | "error";

interface AiState {
  movieId: number;
  status: AiStatus;
  result: AiRecommendationResult | null;
  error: string | null;
  isOpen: boolean;
}

const initialState = (movieId: number): AiState => ({
  movieId,
  status: "idle",
  result: null,
  error: null,
  isOpen: false,
});

/**
 * State for the AI recommendation card on one movie's graph.
 * - Closing and reopening keeps the existing response (no refetch).
 * - Moving to a different movie clears everything and cancels any request in flight.
 */
export function useAiRecommendations(movieId: number, title: string, year: number | null) {
  const [state, setState] = useState<AiState>(() => initialState(movieId));
  const controllerRef = useRef<AbortController | null>(null);

  // Reset during render (not in an effect) so the old movie's result never flashes.
  let current = state;
  if (state.movieId !== movieId) {
    current = initialState(movieId);
    setState(current);
  }

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, [movieId]);

  const generate = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((s) => ({ ...s, status: "loading", error: null, isOpen: true }));

    fetchAiRecommendations({ movieId, title, year }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState((s) =>
          s.movieId === movieId ? { ...s, status: "success", result, error: null } : s,
        );
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setState((s) =>
          s.movieId === movieId
            ? { ...s, status: "error", error: "Couldn't generate recommendations. Please try again." }
            : s,
        );
      });
  }, [movieId, title, year]);

  /** Opens the card, only fetching if there is nothing to show yet. */
  const open = useCallback(() => {
    if (current.status === "success" || current.status === "loading") {
      setState((s) => ({ ...s, isOpen: true }));
    } else {
      generate();
    }
  }, [current.status, generate]);

  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);

  return {
    status: current.status,
    result: current.result,
    error: current.error,
    isOpen: current.isOpen,
    open,
    close,
    retry: generate,
  };
}
