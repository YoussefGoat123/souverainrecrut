jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import bcrypt from "bcrypt";
import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import type { PrismaMock } from "./helpers/prisma-mock";
import { ADMIN } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

const newUser = {
  firstName: "Bob",
  lastName: "Durand",
  email: "bob@souverainrecrut.fr",
  password: "MotDePasse123!",
  role: "RECRUITER",
};

const storedUser = { id: "u-2", ...newUser, password: "hash" };

describe("Utilisateurs – /v1/users (ADMIN uniquement)", () => {
  it("POST / crée un utilisateur et hache son mot de passe avec bcrypt", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockImplementation(async ({ data }) => ({ id: "u-2", ...data }));

    const res = await request(app)
      .post("/v1/users")
      .set("Authorization", ADMIN())
      .send(newUser);

    expect(res.status).toBe(201);

    const saved = db.user.create.mock.calls[0][0].data;
    expect(saved.password).not.toBe(newUser.password);
    expect(await bcrypt.compare(newUser.password, saved.password)).toBe(true);
  });

  it("POST / refuse un email déjà utilisé (409)", async () => {
    db.user.findUnique.mockResolvedValue(storedUser);

    const res = await request(app)
      .post("/v1/users")
      .set("Authorization", ADMIN())
      .send(newUser);

    expect(res.status).toBe(409);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("POST / refuse un mot de passe trop court (400)", async () => {
    const res = await request(app)
      .post("/v1/users")
      .set("Authorization", ADMIN())
      .send({ ...newUser, password: "court" });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("password");
  });

  it("GET /:id renvoie un utilisateur existant", async () => {
    db.user.findUnique.mockResolvedValue(storedUser);

    const res = await request(app)
      .get("/v1/users/u-2")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(newUser.email);
  });

  it("GET /:id renvoie 404 pour un utilisateur inexistant", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/users/inconnu")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(404);
  });

  it("PUT /:id met à jour un utilisateur", async () => {
    db.user.findUnique.mockResolvedValue(storedUser);
    db.user.update.mockResolvedValue({ ...storedUser, firstName: "Robert" });

    const res = await request(app)
      .put("/v1/users/u-2")
      .set("Authorization", ADMIN())
      .send({ firstName: "Robert" });

    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe("Robert");
  });

  it("DELETE /:id supprime un utilisateur", async () => {
    db.user.findUnique.mockResolvedValue(storedUser);
    db.user.delete.mockResolvedValue(storedUser);

    const res = await request(app)
      .delete("/v1/users/u-2")
      .set("Authorization", ADMIN());

    expect(res.status).toBe(200);
  });
});
