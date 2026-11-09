jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import type { PrismaMock } from "./helpers/prisma-mock";
import { ADMIN, RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

const job = {
  id: "j-1",
  title: "Développeur Backend",
  description: "API Node.js / TypeScript / Prisma",
  location: "Rennes",
  company: "SouverainRecrut",
  recruiterId: "recruiter-1",
};

const { id, ...newJob } = job;

describe("Offres – /v1/jobs", () => {
  it("GET / liste les offres avec la pagination par défaut", async () => {
    db.job.findMany.mockResolvedValue([job]);
    db.job.count.mockResolvedValue(1);

    const res = await request(app)
      .get("/v1/jobs")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("GET /:id renvoie une offre existante", async () => {
    db.job.findUnique.mockResolvedValue(job);

    const res = await request(app)
      .get("/v1/jobs/j-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Développeur Backend");
  });

  it("GET /:id renvoie 404 pour une offre inexistante", async () => {
    db.job.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/jobs/inconnue")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Offre introuvable.");
  });

  it("POST / crée une offre (201)", async () => {
    db.job.create.mockResolvedValue(job);

    const res = await request(app)
      .post("/v1/jobs")
      .set("Authorization", RECRUITER())
      .send(newJob);

    expect(res.status).toBe(201);
    expect(db.job.create).toHaveBeenCalledWith({ data: newJob });
  });

  it("POST / refuse une offre incomplète (400)", async () => {
    const res = await request(app)
      .post("/v1/jobs")
      .set("Authorization", RECRUITER())
      .send({ title: "Dev" });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(["description", "location", "company", "recruiterId"])
    );
  });

  it("PUT /:id met à jour une offre existante", async () => {
    db.job.findUnique.mockResolvedValue(job);
    db.job.update.mockResolvedValue({ ...job, location: "Paris" });

    const res = await request(app)
      .put("/v1/jobs/j-1")
      .set("Authorization", RECRUITER())
      .send({ location: "Paris" });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe("Paris");
  });

  it("PUT /:id renvoie 404 pour une offre inexistante", async () => {
    db.job.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/v1/jobs/inconnue")
      .set("Authorization", RECRUITER())
      .send({ location: "Paris" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id supprime une offre (ADMIN)", async () => {
    db.job.findUnique.mockResolvedValue(job);
    db.job.delete.mockResolvedValue(job);

    const res = await request(app)
      .delete("/v1/jobs/j-1")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(200);
  });

  it("DELETE /:id renvoie 404 pour une offre inexistante", async () => {
    db.job.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/v1/jobs/inconnue")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(404);
    expect(db.job.delete).not.toHaveBeenCalled();
  });
});
