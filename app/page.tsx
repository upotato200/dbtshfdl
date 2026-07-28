"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Player = { id: string; name: string; ready: boolean; color: string; pieces: number[] };
type Game = {
  code: string; phase: "waiting" | "playing" | "finished"; players: Player[];
  turn: number; pending: number | null; rollName: string | null; extraRoll: boolean;
  winner: string | null; log: string[]; revision: number;
};

const TRACK = [
  {x:92,y:92},
  {x:92,y:75},{x:92,y:58},{x:92,y:42},{x:92,y:25},
  {x:92,y:8},
  {x:75,y:8},{x:58,y:8},{x:42,y:8},{x:25,y:8},
  {x:8,y:8},
  {x:8,y:25},{x:8,y:42},{x:8,y:58},{x:8,y:75},
  {x:8,y:92},
  {x:25,y:92},{x:42,y:92},{x:58,y:92},{x:75,y:92}
];
const DIAGONAL_SPOTS = [
  {x:22,y:78},{x:36,y:64},
  {x:64,y:36},{x:78,y:22},
  {x:78,y:78},{x:64,y:64},
  {x:36,y:36},{x:22,y:22}
];
const BOARD_SPOTS = [...TRACK, ...DIAGONAL_SPOTS];
const COLORS = ["#ff7456", "#35b8a0", "#7557d8", "#e0a82e"];

function makeId() {
  const saved = localStorage.getItem("yut-player-id");
  if (saved) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem("yut-player-id", id);
  return id;
}

export default function Home() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [me, setMe] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { setMe(makeId()); }, []);

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!me) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/game", {
        method: "POST", headers: {"content-type":"application/json"},
        body: JSON.stringify({ action, playerId: me, name: name.trim(), code: code.trim().toUpperCase(), ...extra })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "요청을 처리하지 못했어요.");
      setGame(body.game); setCode(body.game.code);
    } catch (e) { setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }, [me, name, code]);

  useEffect(() => {
    if (!game) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/game?code=${game.code}&playerId=${me}`);
      if (res.ok) setGame((await res.json()).game);
    }, 900);
    return () => clearInterval(timer);
  }, [game?.code, me]);

  const mine = game?.players.find(p => p.id === me);
  const current = game?.players[game.turn];
  const myTurn = game?.phase === "playing" && current?.id === me;
  const everyoneReady = !!game && game.players.length >= 2 && game.players.every(p => p.ready);
  const stacked = useMemo(() => {
    const map = new Map<string, {player: Player; piece: number; count: number}>();
    game?.players.forEach(player => player.pieces.forEach(pos => {
      if (pos < 0 || pos >= 20) return;
      const key = `${player.id}-${pos}`;
      const old = map.get(key);
      map.set(key, {player, piece: pos, count: (old?.count || 0) + 1});
    }));
    return [...map.values()];
  }, [game]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">윷</span><span>달빛 윷마당<small>친구와 실시간 한 판</small></span></a>
        <button className="ghost" onClick={() => setShowRules(true)}>게임 방법</button>
      </header>

      {!game ? (
        <section className="landing">
          <div className="hero-copy">
            <div className="eyebrow">AI 없이, 사람끼리만</div>
            <h1>둘이 모이면<br/><em>윷판이 열린다</em></h1>
            <p>방을 만들고 코드를 보내세요. 2명 이상이 준비하면 달빛 아래 승부가 시작됩니다.</p>
            <div className="rule-pills"><span>2–4명</span><span>실시간 대전</span><span>설치 없음</span></div>
          </div>
          <div className="join-card">
            <div className="mini-yut"><i/><i/><i/><i/></div>
            <h2>마당에 들어가기</h2>
            <label>별명<input value={name} onChange={e=>setName(e.target.value)} maxLength={10} placeholder="예: 달토끼" /></label>
            <button className="primary" disabled={busy || !name.trim()} onClick={()=>call("create")}>새 방 만들기 <b>→</b></button>
            <div className="divider"><span>또는 초대 코드로</span></div>
            <div className="code-row">
              <input aria-label="초대 코드" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="6자리 코드" />
              <button disabled={busy || !name.trim() || code.length < 4} onClick={()=>call("join")}>입장</button>
            </div>
            {error && <p className="error">{error}</p>}
            <small className="privacy">회원가입 없이 바로 즐길 수 있어요</small>
          </div>
        </section>
      ) : (
        <section className="game-shell">
          <aside className="room-panel">
            <div className="room-code"><small>초대 코드</small><strong>{game.code}</strong><button onClick={()=>navigator.clipboard.writeText(game.code)}>복사</button></div>
            <h3>마당 식구 <span>{game.players.length}/4</span></h3>
            <div className="players">
              {game.players.map((p, i) => <div className={`player ${current?.id===p.id && game.phase==="playing" ? "active":""}`} key={p.id}>
                <i style={{background: COLORS[i]}}>{p.name[0]}</i><span>{p.name}{p.id===me && <small> 나</small>}</span>
                <b>{game.phase==="waiting" ? (p.ready ? "준비 완료":"기다리는 중") : `${p.pieces.filter(x=>x>=20).length}/4`}</b>
              </div>)}
              {game.players.length < 2 && <div className="empty-player"><span>+</span> 친구를 기다리고 있어요</div>}
            </div>
            {game.phase==="waiting" && <>
              <button className={`ready ${mine?.ready ? "on":""}`} disabled={busy} onClick={()=>call("ready")}>{mine?.ready ? "준비 취소" : "준비하기"}</button>
              <p className="start-hint">{game.players.length < 2 ? "최소 2명이 모여야 시작할 수 있어요" : everyoneReady ? "곧 경기가 시작됩니다!" : "모두 준비하면 자동으로 시작해요"}</p>
            </>}
            <button className="leave" onClick={()=>{setGame(null); setCode("");}}>← 마당 나가기</button>
          </aside>

          <div className="board-area">
            <div className="turn-banner">
              <span className="turn-dot" style={{background: COLORS[game.turn]}}/>
              {game.phase==="finished" ? `${game.winner} 승리!` : game.phase==="playing" ? (myTurn ? "내 차례예요!" : `${current?.name}님의 차례`) : "친구를 기다리는 중"}
            </div>
            <div className="board">
              <div className="moon">달빛<br/><b>윷마당</b></div>
              <div className="route diagonal a"/><div className="route diagonal b"/>
              {BOARD_SPOTS.map((p,i)=><div key={i} className={`spot ${[0,5,10,15].includes(i)?"big":""}`} style={{left:`${p.x}%`,top:`${p.y}%`}}><span>{i===0?"출발 · 완주":""}</span></div>)}
              {stacked.map(({player,piece,count}) => <button key={`${player.id}-${piece}`} className="piece" style={{left:`${TRACK[piece].x}%`,top:`${TRACK[piece].y}%`,background:player.color}} onClick={()=>myTurn && game.pending && player.id===me && call("move",{pieceIndex:player.pieces.findIndex(x=>x===piece)})}>{count>1 ? count : player.name[0]}</button>)}
            </div>
            <div className="tray">
              <div><small>최근 결과</small><strong>{game.rollName || "—"}</strong></div>
              <div className="actions">
                {myTurn && game.pending ? <>
                  <span><b>{game.rollName}</b> · 움직일 말을 고르세요</span>
                  {mine?.pieces.map((pos,i)=><button key={i} disabled={pos>=20 || busy} onClick={()=>call("move",{pieceIndex:i})}>말 {i+1} {pos<0?"(새 말)":pos>=20?"(완주)":""}</button>)}
                </> : <button className="throw" disabled={!myTurn || busy || !!game.pending} onClick={()=>call("throw")}>{busy ? "윷을 모으는 중…" : "윷 던지기"}</button>}
              </div>
            </div>
          </div>

          <aside className="log-panel"><h3>경기 이야기</h3>{game.log.slice(-8).reverse().map((l,i)=><p key={i}>{l}</p>)}</aside>
        </section>
      )}

      {showRules && <div className="modal" onClick={()=>setShowRules(false)}><article onClick={e=>e.stopPropagation()}><button className="x" onClick={()=>setShowRules(false)}>×</button><div className="eyebrow">아주 쉬운 규칙</div><h2>먼저 네 말을 모두<br/>완주시키세요</h2><ol><li><b>윷을 던져요</b><span>도 1칸 · 개 2칸 · 걸 3칸 · 윷 4칸 · 모 5칸</span></li><li><b>움직일 말을 골라요</b><span>같은 자리의 내 말은 함께 업혀 갑니다.</span></li><li><b>잡으면 한 번 더</b><span>상대 말을 잡거나 윷·모가 나오면 다시 던져요.</span></li></ol><button className="primary" onClick={()=>setShowRules(false)}>알겠어요</button></article></div>}
    </main>
  );
}
