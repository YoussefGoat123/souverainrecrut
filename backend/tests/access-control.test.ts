jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import jwt from "jsonwebtoken";
import request from "supertest";
import { Request, Response } from "express";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import { authorize } from "../src/middlewares/authorize.middleware";
import { AppError } from "../src/errors/app.error";
import type { PrismaMock } from "./helpers/prisma-mock";
import { ADMIN, RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

describe("Authentification (auth.middleware)", () => {
  it("refuse une requête sans en-tête Authorization (401)", async () => {
    const res = await request(app).get("/v1/candidates");

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentification requise.");
  });

  it("refuse un en-tête qui n'est pas de type Bearer (401)", async () => {
    const res = await request(app)
      .get("/v1/candidates")
      .set("Authorization", "Basic abc123");

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Token invalide.");
  });

  it("refuse un token signé avec un autre secret (401)", async () => {
    const forged = jwt.sign({ id: "pirate", role: "ADMIN" }, "autre-secret");

    const res = await request(app)
      .get("/v1/candidates")
      .set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Token invalide ou expiré.");
  });

  it("refuse un token expiré (401)", async () => {
    const expired = jwt.sign(
      { id: "admin-1", role: "ADMIN", exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET as string
    );

    const res = await request(app)
      .get("/v1/candidates")
      .set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });
});

describe("Autorisation par rôle (authorize.middleware)", () => {
  it("un RECRUITER peut lister les candidats", async () => {
    db.candidate.findMany.mockResolvedValue([]);
    db.candidate.count.mockResolvedValue(0);

    const res = await request(app)
      .get("/v1/candidates")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
  });

  it("un RECRUITER ne peut pas supprimer un candidat (403)", async () => {
    const res = await request(app)
      .delete("/v1/candidates/c-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe(
      "Accès refusé. Permissions insuffisantes."
    );
    expect(db.candidate.delete).not.toHaveBeenCalled();
  });

  it("un RECRUITER ne peut pas supprimer une offre (403)", async () => {
    const res = await request(app)
      .delete("/v1/jobs/j-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(403);
  });

  it("un RECRUITER ne peut pas supprimer une candidature (403)", async () => {
    const res = await request(app)
      .delete("/v1/applications/a-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(403);
  });

  it("un RECRUITER n'a pas accès à la gestion des utilisateurs (403)", async () => {
    const res = await request(app)
      .get("/v1/users")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(403);
  });

  it("un ADMIN a accès à la gestion des utilisateurs", async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(0);

    const res = await request(app)
      .get("/v1/users")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(200);
  });

  it("authorize() renvoie 401 si aucun utilisateur n'est attaché à la requête", () => {
    const next = jest.fn();

    authorize("ADMIN")({} as Request, {} as Response, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });
});
