import jwt from "jsonwebtoken";

/**
 * Génère un en-tête Authorization valide pour un rôle donné,
 * signé avec le JWT_SECRET de test (voir tests/setup-env.ts).
 */
export const bearer = (
  role: "ADMIN" | "RECRUITER",
  id = role === "ADMIN" ? "admin-1" : "recruiter-1"
): string => {
  const token = jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });

  return `Bearer ${token}`;
};

export const ADMIN = () => bearer("ADMIN");
export const RECRUITER = () => bearer("RECRUITER");
