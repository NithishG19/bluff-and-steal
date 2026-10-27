create or replace function public.resolve_game_round(p_code text)
returns void language plpgsql security definer set search_path=public as $$
declare
  r public.rooms%rowtype;
  p record;
  own_choice public.choices%rowtype;
  reverse_exists boolean;
  own_delta integer;
  incoming_count integer;
  total_players integer;
  total_choices integer;
begin
  select * into r from rooms where code=p_code for update;
  if not found or r.status<>'playing' then return; end if;
  select count(*) into total_players from players where room_code=p_code;
  select count(*) into total_choices from choices where room_code=p_code and round=r.round;
  if now()<r.round_ends_at and total_choices<total_players then return; end if;
  for p in select id from players where room_code=p_code loop
    select * into own_choice from choices where room_code=p_code and round=r.round and player_id=p.id;
    own_delta:=0;
    if found and own_choice.choice='collect' then own_delta:=10;
    elsif found and own_choice.choice='steal' then
      select exists(select 1 from choices where room_code=p_code and round=r.round and player_id=own_choice.target_id and choice='steal' and target_id=p.id) into reverse_exists;
      own_delta:=case when reverse_exists then -10 else 15 end;
    end if;
    select count(*) into incoming_count from choices incoming
      where incoming.room_code=p_code and incoming.round=r.round and incoming.choice='steal' and incoming.target_id=p.id
      and not exists(select 1 from choices reciprocal where reciprocal.room_code=p_code and reciprocal.round=r.round and reciprocal.player_id=p.id and reciprocal.choice='steal' and reciprocal.target_id=incoming.player_id);
    update players set score=score+own_delta-(incoming_count*10) where id=p.id;
  end loop;
  if r.round>=5 then update rooms set status='finished',round=5,round_ends_at=null where code=p_code;
  else update rooms set round=r.round+1,round_ends_at=now()+interval '15 seconds' where code=p_code; end if;
end $$;
revoke all on function public.resolve_game_round(text) from public,anon,authenticated;
grant execute on function public.resolve_game_round(text) to service_role;

