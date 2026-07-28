import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("is configured for Railway and PostgreSQL", async () => {
  const [railway, packageJson, database, migrator, migration, api] = await Promise.all([
    readFile(new URL("railway.json", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("scripts/migrate.mjs", root), "utf8"),
    readFile(new URL("drizzle/0000_massive_romulus.sql", root), "utf8"),
    readFile(new URL("app/api/game/route.ts", root), "utf8"),
  ]);

  assert.match(railway, /"builder": "RAILPACK"/);
  assert.match(railway, /"healthcheckPath": "\/api\/health"/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /"db:migrate": "node scripts\/migrate\.mjs"/);
  assert.match(database, /process\.env\.DATABASE_URL/);
  assert.match(database, /new Pool/);
  assert.match(migrator, /migrate\(drizzle\(pool\)/);
  assert.match(migration, /CREATE TABLE "rooms"/);
  assert.match(api, /FOR UPDATE/);
  assert.doesNotMatch(api, /cloudflare:workers|D1Database/);
});

test("keeps the multiplayer start rule on the server", async () => {
  const api = await readFile(new URL("app/api/game/route.ts", root), "utf8");

  assert.match(
    api,
    /game\.players\.length >= 2 && game\.players\.every\(\(item\) => item\.ready\)/,
  );
  assert.match(api, /game\.phase = "playing"/);
});

test("renders all eight spaces on the two diagonals", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const diagonalBlock = page.match(
    /const DIAGONAL_SPOTS = \[([\s\S]*?)\];/,
  )?.[1];

  assert.ok(diagonalBlock);
  assert.equal(diagonalBlock.match(/\{x:/g)?.length, 8);
  assert.match(page, /const BOARD_SPOTS = \[\.\.\.TRACK, \.\.\.DIAGONAL_SPOTS\]/);
});

test("starts and finishes at the bottom-right corner", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /const TRACK = \[\s*\{x:92,y:92\}/);
  assert.match(page, /i===0\?"출발 · 완주"/);
  assert.match(page, /\[0,5,10,15\]\.includes\(i\)/);
});
