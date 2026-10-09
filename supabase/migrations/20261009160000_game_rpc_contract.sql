alter table public.trivia_game_sessions
  alter column user_id drop not null,
  add column if not exists current_streak integer not null default 0;

create table if not exists public.trivia_game_session_questions (
  session_id uuid not null references public.trivia_game_sessions(id) on delete cascade,
  question_id uuid not null references public.trivia_questions(id) on delete cascade,
  question_order integer not null,
  primary key (session_id, question_id),
  unique (session_id, question_order)
);

create table if not exists public.trivia_game_answers (
  session_id uuid not null,
  question_id uuid not null,
  chosen_option text check (chosen_option is null or chosen_option in ('a', 'b', 'c', 'd')),
  is_correct boolean not null,
  points integer not null default 0,
  time_left numeric,
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id),
  foreign key (session_id, question_id)
    references public.trivia_game_session_questions(session_id, question_id)
    on delete cascade
);

alter table public.trivia_game_sessions enable row level security;
alter table public.trivia_game_session_questions enable row level security;
alter table public.trivia_game_answers enable row level security;

drop policy if exists trivia_game_sessions_self on public.trivia_game_sessions;
create policy trivia_game_sessions_self on public.trivia_game_sessions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.start_game(
  p_category text,
  p_difficulty text,
  p_timer boolean,
  p_mode text
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

create or replace function public.submit_answer(
  p_session uuid,
  p_question uuid,
  p_chosen text,
  p_time_left numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.trivia_game_sessions;
  v_question public.trivia_questions;
  v_correct boolean;
  v_points integer;
  v_current_streak integer;
  v_best_streak integer;
begin
  select * into v_session
  from public.trivia_game_sessions s
  where s.id = p_session
    and s.status = 'active'
    and (s.user_id is null or s.user_id = auth.uid())
  for update;

  if not found then
    raise exception 'Game session not found or no longer active';
  end if;

  if exists (
    select 1 from public.trivia_game_answers a
    where a.session_id = p_session and a.question_id = p_question
  ) then
    raise exception 'This question has already been answered';
  end if;

  select q.* into v_question
  from public.trivia_game_session_questions selected
  join public.trivia_questions q on q.id = selected.question_id
  where selected.session_id = p_session and selected.question_id = p_question;

  if not found then
    raise exception 'Question does not belong to this game';
  end if;

  v_correct := lower(coalesce(p_chosen, '')) = v_question.correct_option;
  v_points := case when v_correct then 10 else 0 end;

  insert into public.trivia_game_answers (
    session_id, question_id, chosen_option, is_correct, points, time_left
  )
  values (p_session, p_question, lower(p_chosen), v_correct, v_points, p_time_left);

  update public.trivia_game_sessions
  set score = score + v_points,
      questions_answered = questions_answered + 1,
      correct_answers = correct_answers + case when v_correct then 1 else 0 end,
      current_streak = case when v_correct then current_streak + 1 else 0 end,
      best_streak = case when v_correct then greatest(best_streak, current_streak + 1) else best_streak end,
      updated_at = now()
  where id = p_session
  returning current_streak, best_streak into v_current_streak, v_best_streak;

  if v_session.user_id is not null then
    insert into public.trivia_user_stats (
      user_id, questions_answered, correct_answers, best_streak
    )
    values (
      v_session.user_id,
      1,
      case when v_correct then 1 else 0 end,
      v_best_streak
    )
    on conflict (user_id) do update
    set questions_answered = public.trivia_user_stats.questions_answered + 1,
        correct_answers = public.trivia_user_stats.correct_answers + case when v_correct then 1 else 0 end,
        best_streak = greatest(public.trivia_user_stats.best_streak, excluded.best_streak),
        updated_at = now();

    insert into public.trivia_character_progress (user_id, character, attempted, correct, last_played_at)
    values (
      v_session.user_id,
      v_question.character,
      1,
      case when v_correct then 1 else 0 end,
      now()
    )
    on conflict (user_id, character) do update
    set attempted = public.trivia_character_progress.attempted + 1,
        correct = public.trivia_character_progress.correct + case when v_correct then 1 else 0 end,
        last_played_at = now();
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'points', v_points,
    'streak', v_current_streak,
    'correct_option', v_question.correct_option,
    'explanation', v_question.explanation,
    'bible_reference', v_question.bible_reference,
    'time_left', p_time_left
  );
end;
$$;

create or replace function public.finish_game(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.trivia_game_sessions;
  v_total integer;
  v_correct integer;
  v_stars integer;
  v_previous_best integer := 0;
  v_new_personal_best boolean := false;
begin
  select * into v_session
  from public.trivia_game_sessions s
  where s.id = p_session
    and (s.user_id is null or s.user_id = auth.uid())
  for update;

  if not found then
    raise exception 'Game session not found';
  end if;

  select count(*)::integer into v_total
  from public.trivia_game_session_questions q
  where q.session_id = p_session;

  select count(*)::integer into v_correct
  from public.trivia_game_answers a
  where a.session_id = p_session and a.is_correct;

  v_stars := case
    when v_total = 0 then 0
    when v_correct * 100 >= v_total * 85 then 3
    when v_correct * 100 >= v_total * 70 then 2
    when v_correct * 100 >= v_total * 50 then 1
    else 0
  end;

  if v_session.status = 'active' then
    if v_session.user_id is not null then
      select best_score into v_previous_best
      from public.trivia_user_stats
      where user_id = v_session.user_id;
      v_new_personal_best := v_session.score > coalesce(v_previous_best, 0);
    end if;

    update public.trivia_game_sessions
    set status = 'finished', completed_at = now(), stars = v_stars, updated_at = now()
    where id = p_session
    returning * into v_session;

    if v_session.user_id is not null then
      insert into public.trivia_user_stats (
        user_id, games_completed, best_score, best_streak, stars_earned
      )
      values (
        v_session.user_id, 1, v_session.score, v_session.best_streak, v_stars
      )
      on conflict (user_id) do update
      set games_completed = public.trivia_user_stats.games_completed + 1,
          best_score = greatest(public.trivia_user_stats.best_score, excluded.best_score),
          best_streak = greatest(public.trivia_user_stats.best_streak, excluded.best_streak),
          stars_earned = public.trivia_user_stats.stars_earned + excluded.stars_earned,
          updated_at = now();
    end if;
  end if;

  return jsonb_build_object(
    'score', v_session.score,
    'correct', v_correct,
    'total', v_total,
    'best_streak', v_session.best_streak,
    'stars', v_session.stars,
    'saved', v_session.user_id is not null,
    'new_personal_best', v_new_personal_best,
    'new_badges', '[]'::jsonb
  );
end;
$$;

create or replace function public.claim_game(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.trivia_game_sessions;
begin
  if auth.uid() is null then
    raise exception 'Log in before saving this game';
  end if;

  select * into v_session
  from public.trivia_game_sessions s
  where s.id = p_session
    and s.status in ('finished', 'claimed')
    and (s.user_id is null or s.user_id = auth.uid())
  for update;

  if not found then
    raise exception 'Finished game not found';
  end if;

  if v_session.user_id is null then
    update public.trivia_game_sessions
    set user_id = auth.uid(), status = 'claimed', claimed_at = now(), updated_at = now()
    where id = p_session
    returning * into v_session;

    insert into public.trivia_user_stats (
      user_id, games_started, games_completed, questions_answered,
      correct_answers, best_score, best_streak, stars_earned
    )
    values (
      auth.uid(), 1, 1, v_session.questions_answered,
      v_session.correct_answers, v_session.score, v_session.best_streak, v_session.stars
    )
    on conflict (user_id) do update
    set games_started = public.trivia_user_stats.games_started + 1,
        games_completed = public.trivia_user_stats.games_completed + 1,
        questions_answered = public.trivia_user_stats.questions_answered + excluded.questions_answered,
        correct_answers = public.trivia_user_stats.correct_answers + excluded.correct_answers,
        best_score = greatest(public.trivia_user_stats.best_score, excluded.best_score),
        best_streak = greatest(public.trivia_user_stats.best_streak, excluded.best_streak),
        stars_earned = public.trivia_user_stats.stars_earned + excluded.stars_earned,
        updated_at = now();
  elsif v_session.status = 'finished' then
    update public.trivia_game_sessions
    set status = 'claimed', claimed_at = now(), updated_at = now()
    where id = p_session
    returning * into v_session;
  end if;

  return jsonb_build_object('score', v_session.score, 'new_badges', '[]'::jsonb);
end;
$$;

create or replace function public.game_lessons(p_session uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      concat_ws(' ', nullif(q.explanation, ''), nullif(q.bible_reference, ''))
      order by selected.question_order
    ),
    '[]'::jsonb
  )
  from public.trivia_game_sessions s
  join public.trivia_game_session_questions selected on selected.session_id = s.id
  join public.trivia_questions q on q.id = selected.question_id
  where s.id = p_session
    and (s.user_id is null or s.user_id = auth.uid());
$$;

revoke all on function public.start_game(text, text, boolean, text) from public;
revoke all on function public.submit_answer(uuid, uuid, text, numeric) from public;
revoke all on function public.finish_game(uuid) from public;
revoke all on function public.claim_game(uuid) from public;
revoke all on function public.game_lessons(uuid) from public;

grant execute on function public.start_game(text, text, boolean, text) to anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, text, numeric) to anon, authenticated;
grant execute on function public.finish_game(uuid) to anon, authenticated;
grant execute on function public.claim_game(uuid) to authenticated;
grant execute on function public.game_lessons(uuid) to anon, authenticated;

notify pgrst, 'reload schema';