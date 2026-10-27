import { supabase } from './supabase.js';
function ensureConfigured() { if (!supabase) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart the app.'); }

export async function createRoom(nickname) {
  ensureConfigured();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = [...crypto.getRandomValues(new Uint8Array(4))].map((n) => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[n % 24]).join('');
    const { data: room, error } = await supabase.from('rooms').insert({ code }).select().single();
    if (error?.code === '23505') continue;
    if (error) throw error;
    const { data: player, error: playerError } = await supabase.from('players').insert({ room_code: code, nickname }).select('id').single();
    if (playerError) throw playerError;
    const { error: hostError } = await supabase.from('rooms').update({ host_player_id: player.id }).eq('code', code);
    if (hostError) throw hostError;
    return loadRoom(code, player.id);
  }
  throw new Error('Could not create a room. Please try again.');
}
export async function joinRoom(code, nickname) {
  ensureConfigured();
  const normalized = code.toUpperCase();
  const { data: room, error } = await supabase.from('rooms').select('*').eq('code', normalized).maybeSingle();
  if (error) throw error;
  if (!room) throw new Error('Room not found. Check the four-letter code.');
  if (room.status !== 'lobby') throw new Error('This game has already started.');
  const { count, error: countError } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('room_code', normalized);
  if (countError) throw countError;
  if (count >= 6) throw new Error('This room is full.');
  const { data: player, error: joinError } = await supabase.from('players').insert({ room_code: normalized, nickname }).select('id').single();
  if (joinError) throw new Error(joinError.code === '23505' ? 'That nickname is already in use in this room.' : joinError.message);
  return loadRoom(normalized, player.id);
}
export async function loadRoom(code, playerId) {
  ensureConfigured();
  const { data: room, error: roomError } = await supabase.from('rooms').select('*').eq('code', code).single();
  if (roomError) throw roomError;
  const [playersResult, submissionsResult] = await Promise.all([
    supabase.from('players').select('id,nickname,score,joined_at').eq('room_code', code).order('joined_at'),
    supabase.from('round_submissions').select('player_id').eq('room_code', code).eq('round', room.round),
  ]);
  if (playersResult.error) throw playersResult.error;
  if (submissionsResult.error) throw submissionsResult.error;
  return { room, players: playersResult.data.map((p) => ({ ...p, submitted: submissionsResult.data.some((s) => s.player_id === p.id) })), player_id: playerId };
}
export async function startGame(code, playerId) {
  const current = await loadRoom(code, playerId);
  if (current.room.host_player_id !== playerId) throw new Error('Only the host can start the game.');
  if (current.players.length < 4) throw new Error('At least 4 players are needed to start.');
  if (current.room.status !== 'lobby') throw new Error('This game has already started.');
  const { error } = await supabase.from('rooms').update({ status: 'playing', round: 1, round_ends_at: new Date(Date.now() + 15000).toISOString() }).eq('code', code).eq('status', 'lobby');
  if (error) throw error;
  return loadRoom(code, playerId);
}
export async function submitChoice(code, playerId, choice, targetId) {
  const current = await loadRoom(code, playerId);
  if (current.room.status !== 'playing' || Date.now() >= Date.parse(current.room.round_ends_at)) throw new Error('This round is closed.');
  if (!['collect', 'steal'].includes(choice)) throw new Error('Choose collect or steal.');
  if (choice === 'steal' && (!targetId || targetId === playerId || !current.players.some((p) => p.id === targetId))) throw new Error('Choose another player in this room.');
  const { error } = await supabase.from('choices').insert({ room_code: code, round: current.room.round, player_id: playerId, choice, target_id: choice === 'steal' ? targetId : null });
  if (error) throw new Error(error.code === '23505' ? 'Your move is already locked.' : error.message);
  const { error: submissionError } = await supabase.from('round_submissions').insert({ room_code: code, round: current.room.round, player_id: playerId });
  if (submissionError && submissionError.code !== '23505') throw submissionError;
  await resolveRound(code);
  return loadRoom(code, playerId);
}
export async function resolveRound(code) {
  const { error } = await supabase.rpc('resolve_game_round', { p_code: code });
  if (error) throw error;
}


