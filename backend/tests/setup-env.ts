/**
 * Variables d'environnement utilisées pendant les tests.
 * Ce fichier est exécuté par Jest avant chaque fichier de test
 * (option "setupFiles" de jest.config.js), donc avant l'import de src/config/env.ts.
 *
 * Aucune vraie base de données ni aucun vrai secret ne sont utilisés.
 */
process.env.NODE_ENV = "test";
process.env.API_VERSION = "v1";
process.env.JWT_SECRET = "jwt-secret-de-test-uniquement";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
