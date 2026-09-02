/**
 * Loads .env before any test module is imported, so the database-backed tests
 * find DATABASE_URL the same way `next dev` does. In CI the workflow exports it
 * directly and this simply finds nothing to add.
 */
import "dotenv/config";
