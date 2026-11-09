jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import { buildPaginationMeta, getPagination } from "../src/utils/pagination";
import type { PrismaMock } from "./helpers/prisma-mock";
import { RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

describe("Gestion des erreurs (error.middleware)", () => {
  it("une erreur inattendue renvoie 500 sans exposer le détail technique", async () => {
    // On masque le console.error volontaire du middleware pour garder une sortie lisible.
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    db.candidate.findUnique.mockRejectedValue(
      new Error("FATAL: password authentication failed for user postgres")
    );

    const res = await request(app)
      .get("/v1/candidates/c-1")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe("Erreur interne du serveur.");
    expect(JSON.stringify(res.body)).not.toContain("password authentication");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("Pagination (utils/pagination)", () => {
  it("utilise page=1 et limit=10 par défaut", () => {
    expect(getPagination()).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it("calcule le décalage (skip) à partir de la page", () => {
    expect(getPagination("3", "20")).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it("borne les valeurs : page ≥ 1, limit entre 1 et 100", () => {
    expect(getPagination("-5", "0")).toEqual({ page: 1, limit: 1, skip: 0 });
    expect(getPagination("1", "5000").limit).toBe(100);
  });

  it("calcule le nombre total de pages", () => {
    expect(buildPaginationMeta(1, 10, 25).totalPages).toBe(3);
    expect(buildPaginationMeta(1, 10, 0).totalPages).toBe(0);
  });
});
