"use strict";

const request = require("supertest");
const express = require("express");

describe("health endpoint", () => {
  test("GET /health returns ok", async () => {
    const app = express();
    app.get("/health", (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
