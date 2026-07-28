import { Pool } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  railwayPool?: Pool;
};

export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL이 없습니다. Railway 웹 서비스에 Postgres 참조 변수를 추가해 주세요.",
    );
  }

  if (!globalForDatabase.railwayPool) {
    globalForDatabase.railwayPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalForDatabase.railwayPool;
}
