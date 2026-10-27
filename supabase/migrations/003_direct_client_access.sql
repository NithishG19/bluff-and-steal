-- Browser clients use the anon key directly. Secret choices remain unreadable; the resolver applies scores atomically.
create table if not exists public.round_submissions (
  room_code text not null references public.rooms(code) on delete cascade,
  round integer not null check (round between 1 and 5),
  player_id uuid not null references public.players(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key(room_code,round,player_id)
);
alter table public.round_submissions enable row level security;
create policy "rooms can be read by players" on public.rooms for select to anon,authenticated using (true);
create policy "rooms can be created by guests" on public.rooms for insert to anon,authenticated with check (status='lobby' and round=0);
create policy "rooms can be updated by guests" on public.rooms for update to anon,authenticated using (true) with check (true);
create policy "players can join lobby" on public.players for insert to anon,authenticated with check (exists(select 1 from public.rooms r where r.code=players.room_code and r.status='lobby'));
create policy "choices can be submitted during a round" on public.choices for insert to anon,authenticated with check (
  exists(select 1 from public.rooms r where r.code=choices.room_code and r.status='playing' and r.round=choices.round and r.round_ends_at>now())
  and exists(select 1 from public.players p where p.id=choices.player_id and p.room_code=choices.room_code)
  and (target_id is null or exists(select 1 from public.players t where t.id=choices.target_id and t.room_code=choices.room_code))
);
create policy "submissions are visible" on public.round_submissions for select to anon,authenticated using (true);
create policy "players can mark submissions" on public.round_submissions for insert to anon,authenticated with check (
  exists(select 1 from public.players p where p.id=round_submissions.player_id and p.room_code=round_submissions.room_code)
);
grant select,insert,update on public.rooms to anon,authenticated;
grant select,insert on public.players to anon,authenticated;
grant insert on public.choices to anon,authenticated;
grant select,insert on public.round_submissions to anon,authenticated;
grant execute on function public.resolve_game_round(text) to anon,authenticated;
alter publication supabase_realtime add table public.round_submissions;





