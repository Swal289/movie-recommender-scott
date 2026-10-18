import { fetchRecommendedMovies } from "./recommendedMovies";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/** A recommended movie as the UI needs it. `id` is null when TMDB had no match, so it can't be linked. */
export interface AiRecommendedMovie {
  id: number | null;
  title: string;
  year: number | null;
  posterUrl: string | null;
  reason: string;
}

export interface AiRecommendationResult {
  summary: string;
  movies: AiRecommendedMovie[];
}

export const AI_RECOMMENDATION_COUNT = 3;

/*
 * Raw response from the LLM backend: GET /api/llm-recommender?movie=&releaseYear=
 * (server/src/controllers/llmRecommendation.controller.ts). Kept separate from the
 * UI types so a backend change only needs `normalizeResponse` updating.
 */
interface RawLlmMovie {
  title: string;
  releaseYear: number | string;
  justification: string;
  imageUrl?: string | null;
  movieId?: string;
}

interface RawLlmResponse {
  data?: {
    userInterestSummary?: string;
    recommendations?: RawLlmMovie[];
  };
}

// The backend substitutes this placeholder when TMDB has no poster; the UI draws its own empty poster instead.
const PLACEHOLDER_POSTER_HOST = "via.placeholder.com";

function toNumberOrNull(value: number | string | undefined): number | null {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : null;
}

function normalizeResponse(raw: RawLlmResponse): AiRecommendationResult {
  const recommendations = raw.data?.recommendations ?? [];
  return {
    summary: raw.data?.userInterestSummary ?? "",
    movies: recommendations.slice(0, AI_RECOMMENDATION_COUNT).map((movie) => ({
      id: toNumberOrNull(movie.movieId),
      title: movie.title,
      year: toNumberOrNull(movie.releaseYear),
      posterUrl:
        movie.imageUrl && !movie.imageUrl.includes(PLACEHOLDER_POSTER_HOST) ? movie.imageUrl : null,
      reason: movie.justification ?? "",
    })),
  };
}

/**
 * Stand-in for the LLM backend, for working without an OpenAI key. Uses TMDB's own
 * recommendations so the three results are real movies with working links.
 * Enable with VITE_AI_MOCK=true in the root .env.
 */
async function fetchMockRecommendations(
  movieId: number,
  title: string,
  signal?: AbortSignal,
): Promise<AiRecommendationResult> {
  const related = await fetchRecommendedMovies(movieId, signal);
  return {
    summary: `Because you enjoyed ${title}, you seem drawn to its tone, themes and genre. Here are three picks in a similar vein.`,
    movies: related.slice(0, AI_RECOMMENDATION_COUNT).map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      posterUrl: movie.posterUrl,
      reason: movie.overview ? `${movie.overview.slice(0, 110).trimEnd()}…` : "",
    })),
  };
}

export interface AiRecommendationRequest {
  movieId: number;
  title: string;
  year: number | null;
}

/** Fetches an interest summary and three AI-picked movies for the given movie. */
export async function fetchAiRecommendations(
  { movieId, title, year }: AiRecommendationRequest,
  signal?: AbortSignal,
): Promise<AiRecommendationResult> {
  if (import.meta.env.VITE_AI_MOCK === "true") {
    return fetchMockRecommendations(movieId, title, signal);
  }

  // The backend requires a release year to disambiguate titles.
  if (year === null) {
    throw new Error("AI recommendations need the movie's release year.");
  }

  const url = new URL(`${BASE_URL}/llm-recommender`);
  url.searchParams.set("movie", title);
  url.searchParams.set("releaseYear", String(year));

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    throw new Error(`AI recommendations failed with status ${response.status}`);
  }

  return normalizeResponse((await response.json()) as RawLlmResponse);
}
