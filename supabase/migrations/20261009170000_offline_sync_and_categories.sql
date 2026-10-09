alter table public.trivia_categories enable row level security;
alter table public.trivia_questions enable row level security;

drop policy if exists trivia_categories_select_all on public.trivia_categories;
create policy trivia_categories_select_all on public.trivia_categories
for select using (is_active = true);

drop policy if exists trivia_questions_select_published on public.trivia_questions;
create policy trivia_questions_select_published on public.trivia_questions
for select using (
  is_published = true
  or exists (select 1 from public.trivia_admins where user_id = auth.uid())
);

drop policy if exists trivia_questions_manage_admin on public.trivia_questions;
create policy trivia_questions_manage_admin on public.trivia_questions
for all using (exists (select 1 from public.trivia_admins where user_id = auth.uid()))
with check (exists (select 1 from public.trivia_admins where user_id = auth.uid()));

create table if not exists public.trivia_offline_game_syncs (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_game_id text not null,
  session_id uuid not null references public.trivia_game_sessions(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_game_id)
);

alter table public.trivia_offline_game_syncs enable row level security;

create or replace function public.create_trivia_category(p_label text, p_icon text default '✦')
returns public.trivia_categories
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text := trim(coalesce(p_label, ''));
  v_key text;
  v_category public.trivia_categories;
begin
  if auth.uid() is null or not exists (
    select 1 from public.trivia_admins where user_id = auth.uid()
  ) then
    raise exception 'Administrator access required';
  end if;

  if v_label = '' then
    raise exception 'Category name is required';
  end if;

  v_key := trim(both '_' from regexp_replace(lower(v_label), '[^a-z0-9]+', '_', 'g'));
  if v_key = '' then
    raise exception 'Category name must contain letters or numbers';
  end if;

  insert into public.trivia_categories (key, label, icon, sort_order)
  values (
    v_key,
    v_label,
    coalesce(nullif(trim(p_icon), ''), '✦'),
    coalesce((select max(sort_order) + 1 from public.trivia_categories), 1)
  )
  returning * into v_category;

  return v_category;
end;
$$;

create or replace function public.sync_offline_game(
  p_client_game_id text,
  p_category text,
  p_difficulty text,
  p_timer boolean,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing jsonb;
  v_session_id uuid;
  v_answer jsonb;
  v_question public.trivia_questions;
  v_question_id uuid;
  v_chosen text;
  v_is_correct boolean;
  v_total integer := 0;
  v_correct integer := 0;
  v_score integer := 0;
  v_current_streak integer := 0;
  v_best_streak integer := 0;
  v_position integer := 0;
  v_time_left numeric;
  v_stars integer;
  v_previous_best integer := 0;
  v_new_personal_best boolean := false;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Sign in to sync offline games';
  end if;
  if p_client_game_id is null or length(p_client_game_id) > 120 then
    raise exception 'Invalid offline game identifier';
  end if;
  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'Invalid difficulty';
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 10 then
    raise exception 'An offline game must contain exactly 10 answers';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_client_game_id, 0));
  select result into v_existing
  from public.trivia_offline_game_syncs
  where user_id = v_user_id and client_game_id = p_client_game_id;
  if found then
    return v_existing;
  end if;

  if (
    select count(distinct value->>'question_id')
    from jsonb_array_elements(p_answers)
  ) <> 10 then
    raise exception 'Offline game contains duplicate questions';
  end if;

  for v_answer in select value from jsonb_array_elements(p_answers) with ordinality as answers(value, ordinal) order by ordinal
  loop
    v_question_id := (v_answer->>'question_id')::uuid;
    v_chosen := lower(coalesce(v_answer->>'chosen_option', ''));
    v_time_left := coalesce((v_answer->>'time_left')::numeric, 0);
    if (v_chosen <> '' and v_chosen not in ('a', 'b', 'c', 'd')) or v_time_left < 0 or v_time_left > 60 then
      raise exception 'Invalid offline answer';
    end if;

    select * into v_question
    from public.trivia_questions q
    where q.id = v_question_id
      and q.category = p_category
      and q.difficulty = p_difficulty;
    if not found then
      raise exception 'A question in this offline game is no longer available';
    end if;

    v_is_correct := v_chosen = v_question.correct_option;
    v_total := v_total + 1;
    if v_is_correct then
      v_correct := v_correct + 1;
      v_score := v_score + 10;
      v_current_streak := v_current_streak + 1;
      v_best_streak := greatest(v_best_streak, v_current_streak);
    else
      v_current_streak := 0;
    end if;
  end loop;

  v_stars := case
    when v_correct * 100 >= v_total * 85 then 3
    when v_correct * 100 >= v_total * 70 then 2
    when v_correct * 100 >= v_total * 50 then 1
    else 0
  end;

  insert into public.trivia_game_sessions (
    user_id, category, difficulty, timer_enabled, mode, status, score, stars,
    questions_answered, correct_answers, current_streak, best_streak, completed_at, claimed_at
  )
  values (
    v_user_id, p_category, p_difficulty, coalesce(p_timer, true), 'solo', 'claimed',
    v_score, v_stars, v_total, v_correct, v_current_streak, v_best_streak, now(), now()
  )
  returning id into v_session_id;

  for v_answer in select value from jsonb_array_elements(p_answers) with ordinality as answers(value, ordinal) order by ordinal
  loop
    v_position := v_position + 1;
    v_question_id := (v_answer->>'question_id')::uuid;
    v_chosen := lower(coalesce(v_answer->>'chosen_option', ''));
    v_time_left := coalesce((v_answer->>'time_left')::numeric, 0);
    select * into v_question from public.trivia_questions where id = v_question_id;
    v_is_correct := v_chosen = v_question.correct_option;

    insert into public.trivia_game_session_questions (session_id, question_id, question_order)
    values (v_session_id, v_question_id, v_position);
    insert into public.trivia_game_answers (session_id, question_id, chosen_option, is_correct, points, time_left)
    values (v_session_id, v_question_id, nullif(v_chosen, ''), v_is_correct, case when v_is_correct then 10 else 0 end, v_time_left);

    insert into public.trivia_character_progress (user_id, character, attempted, correct, last_played_at)
    values (v_user_id, v_question.character, 1, case when v_is_correct then 1 else 0 end, now())
    on conflict (user_id, character) do update
    set attempted = public.trivia_character_progress.attempted + 1,
        correct = public.trivia_character_progress.correct + excluded.correct,
        last_played_at = now();
  end loop;

  select best_score into v_previous_best
  from public.trivia_user_stats
  where user_id = v_user_id;
  v_new_personal_best := v_score > coalesce(v_previous_best, 0);

  insert into public.trivia_user_stats (
    user_id, games_started, games_completed, questions_answered,
    correct_answers, best_score, best_streak, stars_earned
  )
  values (v_user_id, 1, 1, v_total, v_correct, v_score, v_best_streak, v_stars)
  on conflict (user_id) do update
  set games_started = public.trivia_user_stats.games_started + 1,
      games_completed = public.trivia_user_stats.games_completed + 1,
      questions_answered = public.trivia_user_stats.questions_answered + excluded.questions_answered,
      correct_answers = public.trivia_user_stats.correct_answers + excluded.correct_answers,
      best_score = greatest(public.trivia_user_stats.best_score, excluded.best_score),
      best_streak = greatest(public.trivia_user_stats.best_streak, excluded.best_streak),
      stars_earned = public.trivia_user_stats.stars_earned + excluded.stars_earned,
      updated_at = now();

  v_result := jsonb_build_object(
    'score', v_score,
    'correct', v_correct,
    'total', v_total,
    'best_streak', v_best_streak,
    'stars', v_stars,
    'saved', true,
    'new_personal_best', v_new_personal_best,
    'new_badges', '[]'::jsonb,
    'session_id', v_session_id
  );
  insert into public.trivia_offline_game_syncs (user_id, client_game_id, session_id, result)
  values (v_user_id, p_client_game_id, v_session_id, v_result);
  return v_result;
end;
$$;

revoke all on function public.create_trivia_category(text, text) from public;
revoke all on function public.sync_offline_game(text, text, text, boolean, jsonb) from public;
grant execute on function public.create_trivia_category(text, text) to authenticated;
grant execute on function public.sync_offline_game(text, text, text, boolean, jsonb) to authenticated;

notify pgrst, 'reload schema';