jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import type { PrismaMock } from "./helpers/prisma-mock";
import { ADMIN, RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

const candidate = {
  id: "c-1",
  fullName: "Jean Dupont",
  email: "jean.dupont@mail.fr",
  phone: "0601020304",
};

describe("Candidats – /v1/candidates", () => {
  it("GET / liste les candidats avec la pagination", async () => {
    db.candidate.findMany.mockResolvedValue([candidate]);
    db.candidate.count.mockResolvedValue(25);

    const res = await request(app)
      .get("/v1/candidates?page=2&limit=10")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    expect(db.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it("GET /:id renvoie un candidat existant", async () => {
    db.candidate.findUnique.mockResolvedValue(candidate);

    const res = await request(app)
      .get("/v1/candidates/c-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe("Jean Dupont");
  });

  it("GET /:id renvoie 404 pour un candidat inexistant", async () => {
    db.candidate.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/candidates/inconnu")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Candidat introuvable.");
  });

  it("POST / crée un candidat (201) et met l'email en minuscules", async () => {
    db.candidate.findUnique.mockResolvedValue(null);
    db.candidate.create.mockResolvedValue(candidate);

    const res = await request(app)
      .post("/v1/candidates")
      .set("Authorization", RECRUITER())
      .send({ fullName: "Jean Dupont", email: "Jean.Dupont@Mail.FR" });

    expect(res.status).toBe(201);
    expect(db.candidate.create).toHaveBeenCalledWith({
      data: { fullName: "Jean Dupont", email: "jean.dupont@mail.fr" },
    });
  });

  it("POST / refuse un email déjà utilisé (409)", async () => {
    db.candidate.findUnique.mockResolvedValue(candidate);

    const res = await request(app)
      .post("/v1/candidates")
      .set("Authorization", RECRUITER())
      .send({ fullName: "Jean Dupont", email: candidate.email });

    expect(res.status).toBe(409);
    expect(db.candidate.create).not.toHaveBeenCalled();
  });

  it("POST / refuse des données invalides (400) avec le détail des champs", async () => {
    const res = await request(app)
      .post("/v1/candidates")
      .set("Authorization", RECRUITER())
      .send({ fullName: "Jo", email: "pas-un-email" });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["fullName", "email"]));
    expect(db.candidate.create).not.toHaveBeenCalled();
  });

  it("PUT /:id met à jour un candidat existant", async () => {
    db.candidate.findUnique.mockResolvedValue(candidate);
    db.candidate.update.mockResolvedValue({ ...candidate, phone: "0699999999" });

    const res = await request(app)
      .put("/v1/candidates/c-1")
      .set("Authorization", RECRUITER())
      .send({ phone: "0699999999" });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe("0699999999");
  });

  it("PUT /:id renvoie 404 pour un candidat inexistant", async () => {
    db.candidate.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/v1/candidates/inconnu")
      .set("Authorization", RECRUITER())
      .send({ phone: "0699999999" });

    expect(res.status).toBe(404);
    expect(db.candidate.update).not.toHaveBeenCalled();
  });

  it("DELETE /:id supprime un candidat (ADMIN)", async () => {
    db.candidate.findUnique.mockResolvedValue(candidate);
    db.candidate.delete.mockResolvedValue(candidate);

    const res = await request(app)
      .delete("/v1/candidates/c-1")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(200);
    expect(db.candidate.delete).toHaveBeenCalledWith({ where: { id: "c-1" } });
  });
});
