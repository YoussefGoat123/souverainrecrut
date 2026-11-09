jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";
import type { PrismaMock } from "./helpers/prisma-mock";
import { RECRUITER } from "./helpers/auth";

const db = prisma as unknown as PrismaMock;

const PASSWORD = "MotDePasse123!";

// Coût bcrypt réduit (4) pour que les tests restent rapides.
const user = {
  id: "user-1",
  firstName: "Alice",
  lastName: "Martin",
  email: "alice@souverainrecrut.fr",
  password: bcrypt.hashSync(PASSWORD, 4),
  role: "RECRUITER",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("POST /v1/auth/login", () => {
  it("connecte un utilisateur avec des identifiants valides et renvoie un JWT", async () => {
    db.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const payload = jwt.verify(
      res.body.data.token,
      process.env.JWT_SECRET as string
    ) as { id: string; role: string };
    expect(payload.id).toBe("user-1");
    expect(payload.role).toBe("RECRUITER");
  });

  it("ne renvoie jamais le mot de passe dans la réponse", async () => {
    db.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });

    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("refuse un email inconnu (401)", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "inconnu@test.fr", password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Email ou mot de passe invalide.");
  });

  it("refuse un mauvais mot de passe (401) avec le même message", async () => {
    db.user.findUnique.mockResolvedValue(user);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: "mauvais" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Email ou mot de passe invalide.");
  });
});

describe("GET /v1/auth/me", () => {
  it("renvoie le profil de l'utilisateur connecté", async () => {
    const { password, ...profile } = user;
    db.user.findUnique.mockResolvedValue(profile);

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "recruiter-1" } })
    );
  });

  it("renvoie 404 si l'utilisateur du token n'existe plus", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", RECRUITER());

    expect(res.status).toBe(404);
  });

  it("renvoie 401 sans token", async () => {
    const res = await request(app).get("/v1/auth/me");

    expect(res.status).toBe(401);
  });
});
