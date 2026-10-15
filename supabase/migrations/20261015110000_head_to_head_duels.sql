create table if not exists public.trivia_duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  category text not null references public.trivia_categories(key),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  timer_enabled boolean not null default true,
  time_limit integer not null default 20 check (time_limit in (10, 15, 20, 30, 45)),
  question_ids uuid[] not null,
  status text not null default 'waiting' check (status in ('waiting', 'started', 'completed')),
  starts_at timestamptz,
  completed_at timestamptz,
  winner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trivia_duel_players (
  duel_id uuid not null references public.trivia_duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique references public.trivia_game_sessions(id) on delete cascade,
  score integer,
  elapsed_ms bigint,
  completed_at timestamptz,
  primary key (duel_id, user_id)
);

alter table public.trivia_duels enable row level security;
alter table public.trivia_duel_players enable row level security;

create or replace function public.create_trivia_duel(
  p_category text,
  p_difficulty text,
  p_timer boolean,
  p_time_limit integer default 20,
  p_excluded_questions uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_category text := coalesce(nullif(p_category, ''), 'bible_characters');
  v_question_ids uuid[];
  v_duel public.trivia_duels;
  v_code text;
begin
  if v_user_id is null then raise exception 'Sign in to create a head-to-head game'; end if;
  if p_difficulty not in ('easy', 'medium', 'hard') then raise exception 'Invalid difficulty'; end if;
  if p_time_limit not in (10, 15, 20, 30, 45) then raise exception 'Invalid question time limit'; end if;
  if not exists (select 1 from public.trivia_categories where key = v_category and is_active) then
    raise exception 'Choose an active quiz category';
  end if;

  select array_agg(picked.id)
  into v_question_ids
  from (
    select q.id
    from public.trivia_questions q
    where q.is_published = true
      and q.category = v_category
      and q.difficulty = p_difficulty
      and not (q.id = any(coalesce(p_excluded_questions, '{}'::uuid[])))
    order by random()
    limit 10
  ) picked;

  if coalesce(cardinality(v_question_ids), 0) < 10 then
    raise exception 'There are not enough unused questions for this category and module';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_user_id::text), 1, 6));
    insert into public.trivia_duels (code, host_user_id, category, difficulty, timer_enabled, time_limit, question_ids)
    values (v_code, v_user_id, v_category, p_difficulty, coalesce(p_timer, true), p_time_limit, v_question_ids)
    on conflict (code) do nothing
    returning * into v_duel;
    exit when found;
  end loop;

  return jsonb_build_object(
    'code', v_duel.code,
    'category', v_duel.category,
    'difficulty', v_duel.difficulty,
    'timer_enabled', v_duel.timer_enabled,
    'time_limit', v_duel.time_limit,
    'question_ids', to_jsonb(v_duel.question_ids),
    'status', v_duel.status
  );
end;
$$;

create or replace function public.join_trivia_duel(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel public.trivia_duels;
begin
  if v_user_id is null then raise exception 'Sign in to join a head-to-head game'; end if;

  select * into v_duel
  from public.trivia_duels
  where code = upper(trim(coalesce(p_code, '')))
  for update;

  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_duel.host_user_id = v_user_id then return jsonb_build_object('error', 'own_code'); end if;

  if v_duel.status = 'waiting' then
    update public.trivia_duels
    set guest_user_id = v_user_id,
        status = 'started',
        starts_at = clock_timestamp() + interval '5 seconds'
    where id = v_duel.id
    returning * into v_duel;
  elsif v_duel.guest_user_id is distinct from v_user_id then
    return jsonb_build_object('error', 'unavailable');
  end if;

  return jsonb_build_object(
    'code', v_duel.code,
    'category', v_duel.category,
    'difficulty', v_duel.difficulty,
    'timer_enabled', v_duel.timer_enabled,
    'time_limit', v_duel.time_limit,
    'question_ids', to_jsonb(v_duel.question_ids),
    'status', v_duel.status,
    'starts_at', v_duel.starts_at
  );
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
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', player.user_id,
        'nickname', coalesce(nullif(stats.nickname, ''), 'Player'),
        'score', player.score,
        'elapsed_ms', player.elapsed_ms,
        'finished', player.completed_at is not null
      ) order by player.user_id)
      from public.trivia_duel_players player
      left join public.trivia_user_stats stats on stats.user_id = player.user_id
      where player.duel_id = v_duel.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.start_trivia_duel_game(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel public.trivia_duels;
  v_session_id uuid;
  v_questions jsonb;
begin
  if v_user_id is null then raise exception 'Sign in to play a head-to-head game'; end if;

  select * into v_duel
  from public.trivia_duels
  where code = upper(trim(coalesce(p_code, '')))
    and status = 'started'
    and v_user_id in (host_user_id, guest_user_id);

  if not found then raise exception 'This head-to-head game is not ready'; end if;

  select session_id into v_session_id
  from public.trivia_duel_players
  where duel_id = v_duel.id and user_id = v_user_id;

  if v_session_id is null then
    insert into public.trivia_game_sessions (
      user_id, category, difficulty, timer_enabled, mode, status, started_at
    )
    values (
      v_user_id, v_duel.category, v_duel.difficulty, v_duel.timer_enabled, 'family', 'active', v_duel.starts_at
    )
    returning id into v_session_id;

    insert into public.trivia_game_session_questions (session_id, question_id, question_order)
    select v_session_id, question_id, question_order::integer
    from unnest(v_duel.question_ids) with ordinality as selected(question_id, question_order);

    insert into public.trivia_duel_players (duel_id, user_id, session_id)
    values (v_duel.id, v_user_id, v_session_id);

    insert into public.trivia_user_stats (user_id, games_started)
    values (v_user_id, 1)
    on conflict (user_id) do update
    set games_started = public.trivia_user_stats.games_started + 1,
        updated_at = now();
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'character', q.character,
      'question', q.question,
      'options', jsonb_build_array(
        jsonb_build_object('key', 'a', 'text', q.option_a),
        jsonb_build_object('key', 'b', 'text', q.option_b),
        jsonb_build_object('key', 'c', 'text', q.option_c),
        jsonb_build_object('key', 'd', 'text', q.option_d)
      ),
      'image_url', q.image_url
    ) order by selected.question_order
  )
  into v_questions
  from public.trivia_game_session_questions selected
  join public.trivia_questions q on q.id = selected.question_id
  where selected.session_id = v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'questions', v_questions,
    'starts_at', v_duel.starts_at,
    'category', v_duel.category,
    'difficulty', v_duel.difficulty,
    'timer_enabled', v_duel.timer_enabled,
    'time_limit', v_duel.time_limit
  );
end;
$$;

create or replace function public.finish_trivia_duel_game(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_duel_id uuid;
  v_code text;
  v_finished_count integer;
  v_first_user uuid;
  v_first_score integer;
  v_first_elapsed bigint;
  v_second_score integer;
  v_second_elapsed bigint;
  v_winner uuid;
begin
  if v_user_id is null then raise exception 'Sign in to finish a head-to-head game'; end if;

  update public.trivia_duel_players player
  set score = game.score,
      elapsed_ms = greatest(0, floor(extract(epoch from (game.completed_at - duel.starts_at)) * 1000)::bigint),
      completed_at = game.completed_at
  from public.trivia_game_sessions game
  join public.trivia_duels duel on duel.id = (
    select linked.duel_id from public.trivia_duel_players linked where linked.session_id = game.id
  )
  where player.session_id = p_session
    and player.user_id = v_user_id
    and game.id = player.session_id
    and game.status in ('finished', 'claimed')
  returning player.duel_id into v_duel_id;

  if v_duel_id is null then raise exception 'Finished head-to-head game not found'; end if;

  select code into v_code from public.trivia_duels where id = v_duel_id;
  select count(*) into v_finished_count
  from public.trivia_duel_players
  where duel_id = v_duel_id and completed_at is not null;

  if v_finished_count = 2 then
    select user_id, score, elapsed_ms into v_first_user, v_first_score, v_first_elapsed
    from public.trivia_duel_players
    where duel_id = v_duel_id and completed_at is not null
    order by score desc, elapsed_ms asc
    limit 1;

    select score, elapsed_ms into v_second_score, v_second_elapsed
    from public.trivia_duel_players
    where duel_id = v_duel_id and completed_at is not null
    order by score desc, elapsed_ms asc
    limit 1 offset 1;

    if v_first_score is distinct from v_second_score or v_first_elapsed is distinct from v_second_elapsed then
      v_winner := v_first_user;
    end if;

    update public.trivia_duels
    set status = 'completed', winner_user_id = v_winner, completed_at = now()
    where id = v_duel_id;
  end if;

  return public.get_trivia_duel(v_code);
end;
$$;

revoke all on function public.create_trivia_duel(text, text, boolean, integer, uuid[]) from public;
revoke all on function public.join_trivia_duel(text) from public;
revoke all on function public.get_trivia_duel(text) from public;
revoke all on function public.start_trivia_duel_game(text) from public;
revoke all on function public.finish_trivia_duel_game(uuid) from public;

grant execute on function public.create_trivia_duel(text, text, boolean, integer, uuid[]) to authenticated;
grant execute on function public.join_trivia_duel(text) to authenticated;
grant execute on function public.get_trivia_duel(text) to authenticated;
grant execute on function public.start_trivia_duel_game(text) to authenticated;
grant execute on function public.finish_trivia_duel_game(uuid) to authenticated;

notify pgrst, 'reload schema';