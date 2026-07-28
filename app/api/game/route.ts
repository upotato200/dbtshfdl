import type { Pool, PoolClient } from "pg";
import { getPool } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = {
  id: string;
  name: string;
  ready: boolean;
  color: string;
  pieces: number[];
};

type Game = {
  code: string;
  phase: "waiting" | "playing" | "finished";
  players: Player[];
  turn: number;
  pending: number | null;
  rollName: string | null;
  extraRoll: boolean;
  winner: string | null;
  log: string[];
  revision: number;
};

const COLORS = ["#ff7456", "#35b8a0", "#7557d8", "#e0a82e"];

class GameError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function cleanName(value: unknown) {
  return String(value ?? "").trim().slice(0, 10);
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

async function loadGame(
  code: string,
  client: Pool | PoolClient = getPool(),
  lock = false,
): Promise<Game | null> {
  const query = `SELECT state, revision FROM rooms WHERE code = $1${lock ? " FOR UPDATE" : ""}`;
  const result = await client.query<{ state: Omit<Game, "revision">; revision: number }>(
    query,
    [code],
  );
  const row = result.rows[0];
  return row ? { ...row.state, revision: row.revision } : null;
}

async function saveGame(client: PoolClient, game: Game) {
  game.revision += 1;
  const { revision, ...state } = game;
  await client.query(
    `UPDATE rooms
       SET state = $1::jsonb, revision = $2, updated_at = NOW()
     WHERE code = $3`,
    [JSON.stringify(state), revision, game.code],
  );
}

function applyAction(
  game: Game,
  action: string,
  playerId: string,
  name: string,
  pieceIndex: unknown,
) {
  let player = game.players.find((candidate) => candidate.id === playerId);

  if (action === "join") {
    if (player) return;
    if (game.phase !== "waiting") throw new GameError("이미 시작한 경기예요.", 409);
    if (game.players.length >= 4) throw new GameError("마당이 가득 찼어요.", 409);
    if (!name) throw new GameError("별명을 입력해 주세요.");

    player = {
      id: playerId,
      name,
      ready: false,
      color: COLORS[game.players.length],
      pieces: [-1, -1, -1, -1],
    };
    game.players.push(player);
    game.log.push(`${name}님이 들어왔어요.`);
    return;
  }

  if (!player) throw new GameError("먼저 방에 입장해 주세요.", 403);

  if (action === "ready") {
    if (game.phase !== "waiting") throw new GameError("이미 시작했어요.", 409);
    player.ready = !player.ready;
    game.log.push(
      `${player.name}님이 ${player.ready ? "준비했어요." : "준비를 취소했어요."}`,
    );
    if (game.players.length >= 2 && game.players.every((item) => item.ready)) {
      game.phase = "playing";
      game.turn = 0;
      game.log.push("경기를 시작합니다!");
    }
    return;
  }

  if (action === "throw") {
    if (
      game.phase !== "playing" ||
      game.players[game.turn].id !== playerId ||
      game.pending
    ) {
      throw new GameError("지금은 던질 차례가 아니에요.", 409);
    }

    const random = Math.random();
    const step =
      random < 0.22 ? 1 : random < 0.5 ? 2 : random < 0.74 ? 3 : random < 0.89 ? 4 : 5;
    const names = ["", "도", "개", "걸", "윷", "모"];
    game.pending = step;
    game.rollName = names[step];
    game.extraRoll = step >= 4;
    game.log.push(`${player.name}님이 ${names[step]}를 던졌어요.`);
    return;
  }

  if (action === "move") {
    if (
      game.phase !== "playing" ||
      game.players[game.turn].id !== playerId ||
      !game.pending
    ) {
      throw new GameError("움직일 수 없어요.", 409);
    }

    const index = Number(pieceIndex);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > 3 ||
      player.pieces[index] >= 20
    ) {
      throw new GameError("움직일 말을 골라 주세요.");
    }

    const from = player.pieces[index];
    const group = player.pieces
      .map((position, itemIndex) => (position === from ? itemIndex : -1))
      .filter((itemIndex) => itemIndex >= 0);
    const target = Math.min(20, (from < 0 ? 0 : from) + game.pending);
    group.forEach((itemIndex) => {
      player.pieces[itemIndex] = target;
    });

    let captured = false;
    if (target < 20) {
      game.players
        .filter((opponent) => opponent.id !== playerId)
        .forEach((opponent) => {
          opponent.pieces = opponent.pieces.map((position) => {
            if (position === target) {
              captured = true;
              return -1;
            }
            return position;
          });
        });
    }

    if (captured) {
      game.extraRoll = true;
      game.log.push(`${player.name}님이 상대 말을 잡았어요!`);
    }

    game.pending = null;
    if (player.pieces.every((position) => position >= 20)) {
      game.phase = "finished";
      game.winner = player.name;
      game.log.push(`${player.name}님이 모든 말을 완주했어요!`);
    } else if (!game.extraRoll) {
      game.turn = (game.turn + 1) % game.players.length;
    } else {
      game.extraRoll = false;
      game.log.push(`${player.name}님, 한 번 더 던지세요.`);
    }
    return;
  }

  throw new GameError("알 수 없는 요청이에요.");
}

export async function GET(request: Request) {
  try {
    const code = (new URL(request.url).searchParams.get("code") ?? "").toUpperCase();
    const game = await loadGame(code);
    return game
      ? Response.json({ game })
      : Response.json({ error: "방을 찾을 수 없어요." }, { status: 404 });
  } catch (error) {
    console.error("GET /api/game failed", error);
    return Response.json(
      { error: "게임 저장소에 연결하지 못했어요." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  let client: PoolClient | undefined;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const playerId = String(body.playerId ?? "");
    const name = cleanName(body.name);
    const code = String(body.code ?? "").toUpperCase();

    if (!playerId) throw new GameError("플레이어 정보가 없어요.");

    if (action === "create") {
      if (!name) throw new GameError("별명을 입력해 주세요.");

      const game: Game = {
        code: randomCode(),
        phase: "waiting",
        players: [
          {
            id: playerId,
            name,
            ready: false,
            color: COLORS[0],
            pieces: [-1, -1, -1, -1],
          },
        ],
        turn: 0,
        pending: null,
        rollName: null,
        extraRoll: false,
        winner: null,
        log: [`${name}님이 마당을 열었어요.`],
        revision: 0,
      };

      const { revision, ...state } = game;
      for (let attempts = 0; attempts < 5; attempts += 1) {
        try {
          await getPool().query(
            `INSERT INTO rooms (code, state, revision, updated_at)
             VALUES ($1, $2::jsonb, $3, NOW())`,
            [game.code, JSON.stringify(state), revision],
          );
          return Response.json({ game }, { status: 201 });
        } catch (error) {
          if ((error as { code?: string }).code !== "23505") throw error;
          game.code = randomCode();
          state.code = game.code;
        }
      }
      throw new GameError("방 코드를 만들지 못했어요. 다시 시도해 주세요.", 503);
    }

    client = await getPool().connect();
    await client.query("BEGIN");
    const game = await loadGame(code, client, true);
    if (!game) throw new GameError("초대 코드를 다시 확인해 주세요.", 404);

    applyAction(game, action, playerId, name, body.pieceIndex);
    await saveGame(client, game);
    await client.query("COMMIT");
    return Response.json({ game });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if (!(error instanceof GameError)) console.error("POST /api/game failed", error);
    return Response.json(
      {
        error:
          error instanceof GameError
            ? error.message
            : "잠시 후 다시 시도해 주세요.",
      },
      { status: error instanceof GameError ? error.status : 500 },
    );
  } finally {
    client?.release();
  }
}
