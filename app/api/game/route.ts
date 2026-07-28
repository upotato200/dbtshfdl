import { env } from "cloudflare:workers";

type Player = { id:string; name:string; ready:boolean; color:string; pieces:number[] };
type Game = { code:string; phase:"waiting"|"playing"|"finished"; players:Player[]; turn:number; pending:number|null; rollName:string|null; extraRoll:boolean; winner:string|null; log:string[]; revision:number };
const COLORS=["#ff7456","#35b8a0","#7557d8","#e0a82e"];

function db(){ if(!env.DB) throw new Error("게임 저장소를 연결하지 못했어요."); return env.DB; }
async function ensure(){ await db().prepare("CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)").run(); }
async function load(code:string):Promise<Game|null>{ await ensure(); const row=await db().prepare("SELECT state, revision FROM rooms WHERE code=?").bind(code).first<{state:string;revision:number}>(); if(!row)return null; return {...JSON.parse(row.state),revision:row.revision}; }
async function save(g:Game){ g.revision++; await db().prepare("UPDATE rooms SET state=?,revision=?,updated_at=? WHERE code=?").bind(JSON.stringify({...g,revision:undefined}),g.revision,new Date().toISOString(),g.code).run(); }
function cleanName(v:unknown){return String(v||"").trim().slice(0,10)}
function randomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("")}
function view(g:Game){return g}

export async function GET(req:Request){
  const u=new URL(req.url), code=(u.searchParams.get("code")||"").toUpperCase();
  const g=await load(code); return g?Response.json({game:view(g)}):Response.json({error:"방을 찾을 수 없어요."},{status:404});
}

export async function POST(req:Request){
  try{
    const b=await req.json() as Record<string,unknown>; const action=String(b.action||""); const id=String(b.playerId||""); const name=cleanName(b.name); const code=String(b.code||"").toUpperCase();
    if(!id) return Response.json({error:"플레이어 정보가 없어요."},{status:400});
    if(action==="create"){
      if(!name)return Response.json({error:"별명을 입력해 주세요."},{status:400});
      await ensure(); let roomCode=randomCode(); while(await load(roomCode))roomCode=randomCode();
      const g:Game={code:roomCode,phase:"waiting",players:[{id,name,ready:false,color:COLORS[0],pieces:[-1,-1,-1,-1]}],turn:0,pending:null,rollName:null,extraRoll:false,winner:null,log:[`${name}님이 마당을 열었어요.`],revision:0};
      await db().prepare("INSERT INTO rooms(code,state,revision,updated_at) VALUES(?,?,0,?)").bind(roomCode,JSON.stringify(g),new Date().toISOString()).run();
      return Response.json({game:g});
    }
    const g=await load(code); if(!g)return Response.json({error:"초대 코드를 다시 확인해 주세요."},{status:404});
    let p=g.players.find(x=>x.id===id);
    if(action==="join"){
      if(p)return Response.json({game:g}); if(g.phase!=="waiting")return Response.json({error:"이미 시작한 경기예요."},{status:409}); if(g.players.length>=4)return Response.json({error:"마당이 가득 찼어요."},{status:409}); if(!name)return Response.json({error:"별명을 입력해 주세요."},{status:400});
      p={id,name,ready:false,color:COLORS[g.players.length],pieces:[-1,-1,-1,-1]}; g.players.push(p); g.log.push(`${name}님이 들어왔어요.`);
    } else {
      if(!p)return Response.json({error:"먼저 방에 입장해 주세요."},{status:403});
      if(action==="ready"){
        if(g.phase!=="waiting")return Response.json({error:"이미 시작했어요."},{status:409}); p.ready=!p.ready; g.log.push(`${p.name}님이 ${p.ready?"준비했어요.":"준비를 취소했어요."}`);
        if(g.players.length>=2&&g.players.every(x=>x.ready)){g.phase="playing";g.turn=0;g.log.push("경기를 시작합니다!");}
      } else if(action==="throw"){
        if(g.phase!=="playing"||g.players[g.turn].id!==id||g.pending)return Response.json({error:"지금은 던질 차례가 아니에요."},{status:409});
        const r=Math.random(), step=r<.22?1:r<.50?2:r<.74?3:r<.89?4:5; const names=["","도","개","걸","윷","모"]; g.pending=step;g.rollName=names[step];g.extraRoll=step>=4;g.log.push(`${p.name}님이 ${names[step]}를 던졌어요.`);
      } else if(action==="move"){
        if(g.phase!=="playing"||g.players[g.turn].id!==id||!g.pending)return Response.json({error:"움직일 수 없어요."},{status:409});
        const idx=Number(b.pieceIndex); if(!Number.isInteger(idx)||idx<0||idx>3||p.pieces[idx]>=20)return Response.json({error:"움직일 말을 골라 주세요."},{status:400});
        const from=p.pieces[idx], same=p.pieces.map((x,i)=>x===from?i:-1).filter(i=>i>=0); const target=Math.min(20,(from<0?0:from)+g.pending);
        same.forEach(i=>p!.pieces[i]=target);
        let captured=false;
        if(target<20)g.players.filter(x=>x.id!==id).forEach(op=>op.pieces=op.pieces.map(pos=>{if(pos===target){captured=true;return -1}return pos}));
        if(captured){g.extraRoll=true;g.log.push(`${p.name}님이 상대 말을 잡았어요!`);}
        g.pending=null;
        if(p.pieces.every(x=>x>=20)){g.phase="finished";g.winner=p.name;g.log.push(`${p.name}님이 모든 말을 완주했어요!`);}
        else if(!g.extraRoll)g.turn=(g.turn+1)%g.players.length; else {g.extraRoll=false;g.log.push(`${p.name}님, 한 번 더 던지세요.`);}
      } else return Response.json({error:"알 수 없는 요청이에요."},{status:400});
    }
    await save(g); return Response.json({game:view(g)});
  }catch(e){return Response.json({error:e instanceof Error?e.message:"잠시 후 다시 시도해 주세요."},{status:500})}
}
