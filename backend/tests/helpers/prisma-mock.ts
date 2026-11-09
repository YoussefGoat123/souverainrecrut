/**
 * Faux client Prisma utilisé à la place de src/config/prisma.ts.
 *
 * Chaque méthode est une fonction Jest (jest.fn) : un test peut définir
 * ce qu'elle renvoie (mockResolvedValue) et vérifier comment elle a été appelée.
 * Les tests s'exécutent ainsi sans PostgreSQL (en local comme dans Jenkins).
 *
 * Utilisation dans un fichier de test :
 *   jest.mock("../src/config/prisma", () => require("./helpers/prisma-mock"));
 */
const model = () => ({
  findMany: jest.fn(),
  findUnique: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const prisma = {
  user: model(),
  candidate: model(),
  job: model(),
  application: model(),
  $queryRaw: jest.fn(),
};

export type PrismaMock = typeof prisma;
