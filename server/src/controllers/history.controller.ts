import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { ViewingHistory } from "../models/ViewingHistory.js";
import { HttpError, type ErrorResponse } from "../errors.js";
import { asyncHandler } from "../middleware/error.middleware.js";

interface RecordViewBody {
  movieId?: unknown;
  title?: unknown;
  posterPath?: unknown;
  releaseDate?: unknown;
}

interface HistoryEntryResponse {
  movieId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  lastViewedAt: Date;
}

interface HistoryPageResponse {
  items: HistoryEntryResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function parsePageValue(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new HttpError(400, "page and limit must be positive integers");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new HttpError(400, `Value must not exceed ${max}`);
  }
  return parsed;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export function createHistoryController() {
  const recordViewedMovie: RequestHandler<{}, ErrorResponse, RecordViewBody> = asyncHandler(
    async (req, res) => {
      const { movieId, title, posterPath, releaseDate } = req.body ?? {};

      if (!Number.isSafeInteger(movieId) || Number(movieId) < 1) {
        throw new HttpError(400, "movieId must be a positive integer");
      }
      if (typeof title !== "string" || !title.trim() || title.trim().length > 200) {
        throw new HttpError(400, "title must contain between 1 and 200 characters");
      }
      if (
        posterPath !== undefined &&
        posterPath !== null &&
        (typeof posterPath !== "string" || !/^\/[A-Za-z0-9_./-]{1,299}$/.test(posterPath))
      ) {
        throw new HttpError(400, "posterPath must be a valid TMDB poster path or null");
      }
      if (
        releaseDate !== undefined &&
        releaseDate !== null &&
        (typeof releaseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate))
      ) {
        throw new HttpError(400, "releaseDate must use YYYY-MM-DD format or be null");
      }

      const userId = req.session.userId;
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new HttpError(401, "Not authenticated");
      }

      const filter = { userId, movieId };
      const update = {
        $set: {
          title: title.trim(),
          posterPath: posterPath ?? null,
          releaseDate: releaseDate ?? null,
          lastViewedAt: new Date(),
        },
      };

      try {
        await ViewingHistory.updateOne(filter, update, {
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        await ViewingHistory.updateOne(filter, update, { runValidators: true });
      }

      res.status(204).end();
    },
  );

  const getViewingHistory: RequestHandler<{}, HistoryPageResponse | ErrorResponse> = asyncHandler(
    async (req, res) => {
      const userId = req.session.userId;
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new HttpError(401, "Not authenticated");
      }

      const page = parsePageValue(req.query.page, 1, Number.MAX_SAFE_INTEGER);
      const limit = parsePageValue(req.query.limit, 20, 50);
      const filter = { userId };
      const [records, total] = await Promise.all([
        ViewingHistory.find(filter)
          .sort({ lastViewedAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ViewingHistory.countDocuments(filter),
      ]);

      res.json({
        items: records.map(({ movieId, title, posterPath, releaseDate, lastViewedAt }) => ({
          movieId,
          title,
          posterPath,
          releaseDate,
          lastViewedAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    },
  );

  return { recordViewedMovie, getViewingHistory };
}