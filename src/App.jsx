import { useCallback, useEffect, useRef, useState } from 'react';
import JoinScreen from './components/JoinScreen.jsx';
import Lobby from './components/Lobby.jsx';
import RoundScreen from './components/RoundScreen.jsx';
import Scoreboard from './components/Scoreboard.jsx';
import Podium from './components/Podium.jsx';
import { isConfigured, supabase } from './lib/supabase.js';
import { createRoom, joinRoom, loadRoom, resolveRound, startGame, submitChoice } from './lib/game.js';
const KEY='bluff-steal-session';
export default function App(){
 const [game,setGame]=useState(null),[selfId,setSelfId]=useState(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[now,setNow]=useState(Date.now());const lock=useRef(false);
 const room=game?.room,players=game?.players||[],self=players.find(p=>p.id===selfId),secondsLeft=room?.round_ends_at?Math.max(0,Math.ceil((Date.parse(room.round_ends_at)-now)/1000)):15;
 const refresh=useCallback(async(code,id)=>{const r=await loadRoom(code,id);setGame(r);return r},[]);
 useEffect(()=>{const saved=sessionStorage.getItem(KEY),invite=new URLSearchParams(location.search).get('room')?.toUpperCase();if(saved){try{const s=JSON.parse(saved);setSelfId(s.player_id);if(isConfigured)refresh(invite||s.code,s.player_id).catch(e=>{sessionStorage.removeItem(KEY);setError(e.message)})}catch{sessionStorage.removeItem(KEY)} }},[refresh]);
 useEffect(() => {
  if (!room?.code || !supabase) return;
  const channel = supabase
    .channel(`room:${room.code}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `code=eq.${room.code}`,
      },
      () => refresh(room.code, selfId)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [room?.code, selfId]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!room||room.status!=='playing'||secondsLeft>0||lock.current)return;lock.current=true;resolveRound(room.code).then(()=>refresh(room.code,selfId)).catch(()=>{}).finally(()=>lock.current=false)},[room,secondsLeft]);
 async function enter(mode,name,code){setLoading(true);setError('');try{const r=mode==='create'?await createRoom(name):await joinRoom(code,name);setGame(r);setSelfId(r.player_id);sessionStorage.setItem(KEY,JSON.stringify({code:r.room.code,player_id:r.player_id}));history.replaceState({},'',`?room=${r.room.code}`)}catch(e){setError(e.message)}finally{setLoading(false)}}
 async function action(a,p={}){setBusy(true);setError('');try{const r=a==='start'?await startGame(room.code,selfId):await submitChoice(room.code,selfId,p.choice,p.target_id);setGame(r)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function copy(){try{const u=new URL(location.href);u.searchParams.set('room',room.code);await navigator.clipboard.writeText(u.href);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setError('Could not copy. Share the room code shown above.')}}
 return <div className="app-shell"><header className="topbar"><a className="wordmark" href="/">B<span>&</span>S <small>BLUFF & STEAL</small></a>{room&&<div className="top-room">ROOM <b>{room.code}</b></div>}<div className="top-tag">A GAME OF GUTS</div></header>{!isConfigured&&<div className="setup-banner">Connect Supabase to play online. Follow the local setup steps in README.md.</div>}{error&&<div className="error-banner" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}{!room?<JoinScreen onCreate={n=>enter('create',n)} onJoin={(n,c)=>enter('join',n,c)} loading={loading}/>:<main className="game-layout"><div className="main-column">{room.status==='lobby'&&<Lobby room={room} players={players} self={self} onStart={()=>action('start')} copied={copied} onCopy={copy} busy={busy}/>}{room.status==='playing'&&<RoundScreen room={room} players={players} self={self} secondsLeft={secondsLeft} busy={busy} onChoice={(choice,target_id)=>action('choose',{choice,target_id})}/>}{room.status==='finished'&&<Podium players={players} roomCode={room.code}/>}</div>{room.status!=='finished'&&<Scoreboard players={players} round={room.round} secondsLeft={secondsLeft} resolving={room.status==='playing'&&secondsLeft===0}/>}</main>}<footer className="footer">NO LOGIN. JUST LIES. <span>·</span> MADE FOR GAME NIGHT</footer></div>
}




