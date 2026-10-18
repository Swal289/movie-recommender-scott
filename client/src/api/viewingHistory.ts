import { apiFetch } from "./index";

export interface ViewingHistoryItem {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  lastViewedAt: string;
}

export interface ViewingHistoryPage {
  items: ViewingHistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RecordViewedMovieInput {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
}

export async function recordViewedMovie(movie: RecordViewedMovieInput): Promise<void> {
  await apiFetch<void>("/history/viewed", {
    method: "POST",
    body: JSON.stringify(movie),
  });
}

export function getViewingHistory(
  page = 1,
  limit = 20,
  signal?: AbortSignal,
): Promise<ViewingHistoryPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<ViewingHistoryPage>(`/history/viewed?${params}`, { signal });
}