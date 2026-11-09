jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import type { PrismaMock } from "./helpers/prisma-mock";

const db = prisma as unknown as PrismaMock;

describe("Routes publiques et supervision", () => {
  it("GET / renvoie le message d'accueil de l'API", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.api).toBe("/v1");
  });

  it("GET /v1/info renvoie les informations de l'API", async () => {
    const res = await request(app).get("/v1/info");

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("SouverainRecrut API");
    expect(res.body.data.health).toBe("/v1/health");
  });

  it("GET /v1/health renvoie 200 et le statut UP", async () => {
    const res = await request(app).get("/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("UP");
  });

  it("GET /v1/ready renvoie 200 quand la base répond", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/v1/ready");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("READY");
    expect(res.body.data.database).toBe("CONNECTED");
  });

  it("GET /v1/ready renvoie 503 quand la base est indisponible", async () => {
    db.$queryRaw.mockRejectedValue(new Error("connexion refusée"));

    const res = await request(app).get("/v1/ready");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.database).toBe("DISCONNECTED");
  });

  it("une route inconnue renvoie 404", async () => {
    const res = await request(app).get("/v1/route-inexistante");

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain("/v1/route-inexistante");
  });
});
