jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import type { PrismaMock } from "./helpers/prisma-mock";
import { RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

describe("Tableau de bord – /v1/dashboard/stats", () => {
  it("renvoie les compteurs globaux et les candidatures en attente", async () => {
    db.user.count.mockResolvedValue(3);
    db.candidate.count.mockResolvedValue(10);
    db.job.count.mockResolvedValue(4);
    // 1er appel : toutes les candidatures, 2e appel : statut PENDING
    db.application.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2);

    const res = await request(app)
      .get("/v1/dashboard/stats")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      users: 3,
      candidates: 10,
      jobs: 4,
      applications: 7,
      pendingApplications: 2,
    });
    expect(db.application.count).toHaveBeenCalledWith({
      where: { status: "PENDING" },
    });
  });
});
