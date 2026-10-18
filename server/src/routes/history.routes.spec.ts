import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { fakeDeps, testConfig } from "../../test/fixtures.js";

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  passwordCompare: vi.fn(),
  historyUpdateOne: vi.fn(),
  historyFind: vi.fn(),
  historyCountDocuments: vi.fn(),
}));

vi.mock("../models/User.js", () => ({
  User: {
    findOne: mocks.userFindOne,
  },
}));

vi.mock("../models/ViewingHistory.js", () => ({
  ViewingHistory: {
    updateOne: mocks.historyUpdateOne,
    find: mocks.historyFind,
    countDocuments: mocks.historyCountDocuments,
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.passwordCompare,
  },
}));

let databaseReady = true;
const app = createApp(testConfig, fakeDeps({ isDatabaseReady: () => databaseReady }));

const account = {
  _id: "507f1f77bcf86cd799439011",
  username: "film_fan",
  email: "film@example.com",
  passwordHash: "stored-hash",
};

const historyEntry = {
  movieId: 123,
  title: "Example Movie",
  posterPath: "/poster.jpg",
  releaseDate: "2024-01-02",
  lastViewedAt: new Date("2025-03-04T12:00:00.000Z"),
};

async function authenticatedAgent() {
  mocks.userFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue(account) });
  mocks.passwordCompare.mockResolvedValue(true);
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({
    identifier: "film_fan",
    password: "long-password",
  });
  expect(response.status).toBe(200);
  return agent;
}

describe("viewing history routes", () => {
  beforeEach(() => {
    databaseReady = true;
    vi.clearAllMocks();
  });

  it("requires authentication to record or read history", async () => {
    const record = await request(app).post("/api/history/viewed").send({
      movieId: 123,
      title: "Example Movie",
    });
    const history = await request(app).get("/api/history/viewed");

    expect(record.status).toBe(401);
    expect(history.status).toBe(401);
    expect(mocks.historyUpdateOne).not.toHaveBeenCalled();
    expect(mocks.historyFind).not.toHaveBeenCalled();
  });

  it("returns unavailable while MongoDB is disconnected", async () => {
    databaseReady = false;

    const record = await request(app).post("/api/history/viewed").send({ movieId: 123 });
    const history = await request(app).get("/api/history/viewed");

    expect(record.status).toBe(503);
    expect(history.status).toBe(503);
  });

  it("records and refreshes a movie using the logged-in user ID", async () => {
    mocks.historyUpdateOne.mockResolvedValue({ acknowledged: true });
    const agent = await authenticatedAgent();
    const payload = {
      movieId: 123,
      title: " Example Movie ",
      posterPath: "/poster.jpg",
      releaseDate: "2024-01-02",
      userId: "507f1f77bcf86cd799439099",
    };

    const first = await agent.post("/api/history/viewed").send(payload);
    const second = await agent.post("/api/history/viewed").send(payload);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(mocks.historyUpdateOne).toHaveBeenCalledTimes(2);
    expect(mocks.historyUpdateOne).toHaveBeenCalledWith(
      { userId: account._id, movieId: 123 },
      {
        $set: {
          title: "Example Movie",
          posterPath: "/poster.jpg",
          releaseDate: "2024-01-02",
          lastViewedAt: expect.any(Date),
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  });

  it("retries a concurrent upsert after a duplicate-key race", async () => {
    mocks.historyUpdateOne
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce({ acknowledged: true });
    const agent = await authenticatedAgent();

    const response = await agent.post("/api/history/viewed").send({
      movieId: 123,
      title: "Example Movie",
    });

    expect(response.status).toBe(204);
    expect(mocks.historyUpdateOne).toHaveBeenCalledTimes(2);
    expect(mocks.historyUpdateOne.mock.calls[1]?.[2]).toEqual({ runValidators: true });
  });

  it.each([
    { movieId: 0, title: "Example Movie" },
    { movieId: 1.5, title: "Example Movie" },
    { movieId: 123, title: " " },
    { movieId: 123, title: "Example Movie", posterPath: "https://example.com/poster.jpg" },
    { movieId: 123, title: "Example Movie", releaseDate: "not-a-date" },
  ])("rejects invalid view payloads %#", async (payload) => {
    const agent = await authenticatedAgent();
    const response = await agent.post("/api/history/viewed").send(payload);

    expect(response.status).toBe(400);
    expect(mocks.historyUpdateOne).not.toHaveBeenCalled();
  });

  it("returns the authenticated user's history newest-first with pagination", async () => {
    const sort = vi.fn().mockReturnThis();
    const skip = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const lean = vi.fn().mockResolvedValue([historyEntry]);
    mocks.historyFind.mockReturnValue({ sort, skip, limit, lean });
    mocks.historyCountDocuments.mockResolvedValue(21);
    const agent = await authenticatedAgent();

    const response = await agent.get("/api/history/viewed?page=2&limit=10");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{ ...historyEntry, lastViewedAt: historyEntry.lastViewedAt.toISOString() }],
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    expect(mocks.historyFind).toHaveBeenCalledWith({ userId: account._id });
    expect(mocks.historyCountDocuments).toHaveBeenCalledWith({ userId: account._id });
    expect(sort).toHaveBeenCalledWith({ lastViewedAt: -1, _id: -1 });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("rejects invalid page and limit values", async () => {
    const agent = await authenticatedAgent();
    const response = await agent.get("/api/history/viewed?page=0&limit=1000");

    expect(response.status).toBe(400);
    expect(mocks.historyFind).not.toHaveBeenCalled();
  });
});