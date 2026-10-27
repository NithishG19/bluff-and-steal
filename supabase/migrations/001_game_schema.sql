create table public.rooms (code text primary key check(code ~ '^[A-Z]{4}$'),status text not null default 'lobby' check(status in('lobby','playing','finished')),round integer not null default 0 check(round between 0 and 5),host_player_id uuid,round_ends_at timestamptz,created_at timestamptz not null default now());
create table public.players (id uuid primary key default gen_random_uuid(),room_code text not null references public.rooms(code) on delete cascade,nickname text not null check(char_length(nickname) between 1 and 18),score integer not null default 0,joined_at timestamptz not null default now(),unique(room_code,nickname));
create table public.choices (room_code text not null references public.rooms(code) on delete cascade,round integer not null,player_id uuid not null references public.players(id) on delete cascade,choice text not null check(choice in('collect','steal')),target_id uuid references public.players(id),created_at timestamptz not null default now(),primary key(room_code,round,player_id),check((choice='collect' and target_id is null)or(choice='steal' and target_id is not null)));
alter table public.rooms enable row level security;alter table public.players enable row level security;alter table public.choices enable row level security;
create policy "rooms readable" on public.rooms for select to anon,authenticated using(true);create policy "players readable" on public.players for select to anon,authenticated using(true);grant select on public.rooms,public.players to anon,authenticated;
create index players_room_score on public.players(room_code,score desc);
alter publication supabase_realtime add table public.rooms;alter publication supabase_realtime add table public.players;
create or replace function public.resolve_game_round(p_code text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.rooms%rowtype; total_players integer; total_choices integer;
begin
 select * into r from rooms where code=p_code for update;
 if not found or r.status<>'playing' then return; end if;
 select count(*) into total_players from players where room_code=p_code;
 select count(*) into total_choices from choices where room_code=p_code and round=r.round;
 if now()<r.round_ends_at and total_choices<total_players then return; end if;
 update players p set score=p.score +
   case when own.choice='collect' then 10
        when own.choice='steal' and reverse.player_id is not null then -10
        when own.choice='steal' then 15 else 0 end
   - case when incoming.player_id is not null and incoming.choice='steal'
              and not (own.choice='steal' and own.target_id=incoming.player_id and incoming.target_id=own.player_id) then 10 else 0 end
 from (select id from players where room_code=p_code) roster
 left join choices own on own.room_code=p_code and own.round=r.round and own.player_id=roster.id
 left join choices reverse on reverse.room_code=p_code and reverse.round=r.round and reverse.player_id=own.target_id and reverse.target_id=own.player_id and reverse.choice='steal'
 left join choices incoming on incoming.room_code=p_code and incoming.round=r.round and incoming.target_id=roster.id
 where p.id=roster.id;
 if r.round>=5 then update rooms set status='finished',round=5,round_ends_at=null where code=p_code;
 else update rooms set round=r.round+1,round_ends_at=now()+interval '15 seconds' where code=p_code; end if;
end $$;
revoke all on function public.resolve_game_round(text) from public,anon,authenticated;
grant execute on function public.resolve_game_round(text) to service_role;
