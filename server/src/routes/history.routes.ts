import { Router, type RequestHandler } from "express";
import type { ErrorResponse } from "../errors.js";
import { createHistoryController } from "../controllers/history.controller.js";

export interface HistoryDeps {
  isDatabaseReady: () => boolean;
}

export function createHistoryRouter(deps: HistoryDeps): Router {
  const router = Router();
  const { recordViewedMovie, getViewingHistory } = createHistoryController();

  const requireDatabase: RequestHandler<{}, ErrorResponse> = (_req, res, next) => {
    if (!deps.isDatabaseReady()) {
      res.status(503).json({ message: "Viewing history is unavailable" });
      return;
    }
    next();
  };

  const requireAuthentication: RequestHandler<{}, ErrorResponse> = (req, res, next) => {
    if (!req.session.userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    next();
  };

  router.post("/viewed", requireDatabase, requireAuthentication, recordViewedMovie);
  router.get("/viewed", requireDatabase, requireAuthentication, getViewingHistory);

  return router;
}