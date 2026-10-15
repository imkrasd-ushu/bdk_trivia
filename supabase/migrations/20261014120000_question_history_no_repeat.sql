drop function if exists public.start_game(text, text, boolean, text);

create function public.start_game(
  p_category text,
  p_difficulty text,
  p_timer boolean,
  p_mode text,
  p_excluded_questions uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question_ids uuid[];
  v_session_id uuid;
  v_questions jsonb;
  v_mode text := coalesce(p_mode, 'solo');
  v_excluded_questions uuid[] := coalesce(p_excluded_questions, '{}'::uuid[]);
begin
  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'Invalid difficulty';
  end if;

  if v_mode not in ('solo', 'family') then
    raise exception 'Invalid game mode';
  end if;

  select array_agg(picked.id)
  into v_question_ids
  from (
    select q.id
    from public.trivia_questions q
    where q.is_published = true
      and q.category = coalesce(nullif(p_category, ''), 'bible_characters')
      and q.difficulty = p_difficulty
      and not (q.id = any(v_excluded_questions))
    order by random()
    limit 10
  ) picked;

  if coalesce(cardinality(v_question_ids), 0) < 10 then
    return jsonb_build_object('error', true);
  end if;

  insert into public.trivia_game_sessions (
    user_id, category, difficulty, timer_enabled, mode, status
  )
  values (
    auth.uid(),
    coalesce(nullif(p_category, ''), 'bible_characters'),
    p_difficulty,
    coalesce(p_timer, true),
    v_mode,
    'active'
  )
  returning id into v_session_id;

  insert into public.trivia_game_session_questions (session_id, question_id, question_order)
  select v_session_id, question_id, question_order::integer
  from unnest(v_question_ids) with ordinality as selected(question_id, question_order);

  if auth.uid() is not null then
    insert into public.trivia_user_stats (user_id, games_started)
    values (auth.uid(), 1)
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

  return jsonb_build_object('session_id', v_session_id, 'questions', v_questions);
end;
$$;

revoke all on function public.start_game(text, text, boolean, text, uuid[]) from public;
grant execute on function public.start_game(text, text, boolean, text, uuid[]) to anon, authenticated;