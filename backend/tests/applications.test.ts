jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import { ApplicationService } from "../src/services/application.service";
import type { PrismaMock } from "./helpers/prisma-mock";
import { ADMIN, RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

const application = {
  id: "a-1",
  candidateId: "c-1",
  jobId: "j-1",
  status: "PENDING",
};

describe("Candidatures – /v1/applications", () => {
  it("GET / liste les candidatures avec le candidat et l'offre associés", async () => {
    db.application.findMany.mockResolvedValue([application]);
    db.application.count.mockResolvedValue(1);

    const res = await request(app)
      .get("/v1/applications")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(db.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { candidate: true, job: true } })
    );
  });

  it("GET /:id renvoie une candidature existante", async () => {
    db.application.findUnique.mockResolvedValue(application);

    const res = await request(app)
      .get("/v1/applications/a-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
  });

  it("GET /:id renvoie 404 pour une candidature inexistante", async () => {
    db.application.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/applications/inconnue")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Candidature introuvable.");
  });

  it("POST / crée une candidature (201)", async () => {
    db.application.create.mockResolvedValue(application);

    const res = await request(app)
      .post("/v1/applications")
      .set("Authorization", RECRUITER())
      .send({ candidateId: "c-1", jobId: "j-1" });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe("a-1");
  });

  it("POST / refuse une candidature sans candidat ni offre (400)", async () => {
    const res = await request(app)
      .post("/v1/applications")
      .set("Authorization", RECRUITER())
      .send({});

    expect(res.status).toBe(400);
    expect(db.application.create).not.toHaveBeenCalled();
  });

  it("PUT /:id change le statut d'une candidature", async () => {
    db.application.findUnique.mockResolvedValue(application);
    db.application.update.mockResolvedValue({ ...application, status: "ACCEPTED" });

    const res = await request(app)
      .put("/v1/applications/a-1")
      .set("Authorization", RECRUITER())
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACCEPTED");
  });

  it("PUT /:id refuse un statut qui n'existe pas (400)", async () => {
    const res = await request(app)
      .put("/v1/applications/a-1")
      .set("Authorization", RECRUITER())
      .send({ status: "VALIDE" });

    expect(res.status).toBe(400);
    expect(db.application.update).not.toHaveBeenCalled();
  });

  it("DELETE /:id supprime une candidature (ADMIN)", async () => {
    db.application.findUnique.mockResolvedValue(application);
    db.application.delete.mockResolvedValue(application);

    const res = await request(app)
      .delete("/v1/applications/a-1")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(200);
  });

  it("ApplicationService.updateStatus met à jour uniquement le statut", async () => {
    db.application.findUnique.mockResolvedValue(application);
    db.application.update.mockResolvedValue({ ...application, status: "REJECTED" });

    const result = await new ApplicationService().updateStatus("a-1", "REJECTED");

    expect(result.status).toBe("REJECTED");
    expect(db.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a-1" }, data: { status: "REJECTED" } })
    );
  });
});
