alter table public.trivia_duels
  add column if not exists host_display_name text not null default 'Player',
  add column if not exists guest_display_name text not null default 'Player';

create or replace function public.set_trivia_duel_player_name(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_display_name text := left(trim(coalesce(p_display_name, '')), 24);
  v_duel public.trivia_duels;
begin
  if v_user_id is null then raise exception 'Sign in to set your match name'; end if;
  if v_display_name = '' then raise exception 'Enter a match name'; end if;

  select * into v_duel
  from public.trivia_duels
  where code = v_code
  for update;

  if not found then raise exception 'Match not found'; end if;

  if v_duel.host_user_id = v_user_id then
    update public.trivia_duels
    set host_display_name = v_display_name
    where id = v_duel.id;
  elsif v_duel.guest_user_id = v_user_id then
    update public.trivia_duels
    set guest_display_name = v_display_name
    where id = v_duel.id;
  else
    raise exception 'You are not a player in this match';
  end if;

  return public.get_trivia_duel(v_code);
end;
$$;

create or replace function public.get_trivia_duel(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_duel public.trivia_duels;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to view this head-to-head game'; end if;

  select * into v_duel
  from public.trivia_duels
  where code = upper(trim(coalesce(p_code, '')));

  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_user_id is distinct from v_duel.host_user_id and v_user_id is distinct from v_duel.guest_user_id then
    raise exception 'You are not a player in this game';
  end if;

  return jsonb_build_object(
    'code', v_duel.code,
    'category', v_duel.category,
    'difficulty', v_duel.difficulty,
    'timer_enabled', v_duel.timer_enabled,
    'time_limit', v_duel.time_limit,
    'status', v_duel.status,
    'starts_at', v_duel.starts_at,
    'winner_user_id', v_duel.winner_user_id,
    'host_display_name', v_duel.host_display_name,
    'guest_display_name', v_duel.guest_display_name,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', player.user_id,
        'display_name', case
          when player.user_id = v_duel.host_user_id then v_duel.host_display_name
          else v_duel.guest_display_name
        end,
        'score', player.score,
        'elapsed_ms', player.elapsed_ms,
        'finished', player.completed_at is not null
      ) order by player.user_id)
      from public.trivia_duel_players player
      where player.duel_id = v_duel.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.set_trivia_duel_player_name(text, text) from public;
grant execute on function public.set_trivia_duel_player_name(text, text) to authenticated;

notify pgrst, 'reload schema';
