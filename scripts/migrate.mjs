import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required to run database migrations.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Database migration complete.");
} finally {
  await pool.end();
}
