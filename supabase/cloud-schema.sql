-- Cloud Supabase schema for DK Bible Trivia
-- Run this in the Supabase SQL editor for the remote project configured in .env.
-- This skips the local Supabase stack and uses the cloud project directly.

create extension if not exists pgcrypto;

create table if not exists public.trivia_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.trivia_categories (key, label, icon, sort_order)
values
  ('bible_characters', 'Bible Characters', '✨', 1),
  ('bible_stories', 'Bible Stories', '📖', 2),
  ('jesus', 'Jesus', '✝️', 3),
  ('miracles', 'Miracles', '✨', 4),
  ('memory_verses', 'Memory Verses', '🕊️', 5),
  ('bible_animals', 'Bible Animals', '🐑', 6),
  ('ten_commandments', 'Ten Commandments', '📜', 7),
  ('fruits_of_the_spirit', 'Fruits of the Spirit', '🌿', 8),
  ('prophecy', 'Prophecy', '🔮', 9),
  ('old_testament', 'Old Testament', '🗺️', 10),
  ('new_testament', 'New Testament', '📜', 11)
on conflict (key) do nothing;

create table if not exists public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'bible_characters',
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  character text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  explanation text,
  bible_reference text,
  hint text,
  image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trivia_questions_category_idx on public.trivia_questions (category);
create index if not exists trivia_questions_difficulty_idx on public.trivia_questions (difficulty);
create index if not exists trivia_questions_published_idx on public.trivia_questions (is_published);
create index if not exists trivia_questions_updated_idx on public.trivia_questions (updated_at desc);

create table if not exists public.trivia_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.trivia_user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar text,
  games_started integer not null default 0,
  games_completed integer not null default 0,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  best_score integer not null default 0,
  best_streak integer not null default 0,
  stars_earned integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.trivia_badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.trivia_user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.trivia_badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.trivia_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'bible_characters',
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  mode text not null default 'solo' check (mode in ('solo','family')),
  timer_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active','finished','claimed')),
  score integer not null default 0,
  stars integer not null default 0,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  best_streak integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  claimed_at timestamptz
);

create table if not exists public.trivia_character_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  character text not null,
  attempted integer not null default 0,
  correct integer not null default 0,
  last_played_at timestamptz,
  primary key (user_id, character)
);

create table if not exists public.trivia_family_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  child_user_id uuid references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trivia_questions_updated_at
before update on public.trivia_questions
for each row execute procedure public.handle_updated_at();

create trigger trivia_user_stats_updated_at
before update on public.trivia_user_stats
for each row execute procedure public.handle_updated_at();

create trigger trivia_game_sessions_updated_at
before update on public.trivia_game_sessions
for each row execute procedure public.handle_updated_at();

create or replace function public.admin_pool_counts()
returns table (difficulty text, published bigint)
language sql
security definer
set search_path = public
as $$
  select q.difficulty, count(*)::bigint as published
  from public.trivia_questions q
  where q.is_published = true
  group by q.difficulty
  union all
  select x.difficulty, 0::bigint
  from (values ('easy'),('medium'),('hard')) as x(difficulty)
  where not exists (
    select 1 from public.trivia_questions q2 where q2.difficulty = x.difficulty and q2.is_published = true
  );
$$;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players bigint;
  v_completed bigint;
  v_started bigint;
  v_avg_score numeric;
  v_hardest jsonb;
begin
  select count(distinct user_id), coalesce(sum(games_completed),0), coalesce(sum(games_started),0), coalesce(avg(best_score),0)
  into v_players, v_completed, v_started, v_avg_score
  from public.trivia_user_stats;

  select jsonb_agg(jsonb_build_object('character', character, 'pct', pct))
  into v_hardest
  from (
    select p.character, round((p.correct::numeric / nullif(p.attempted,0)) * 100, 1) as pct
    from public.trivia_character_progress p
    where p.attempted > 0
    order by pct asc, p.character
    limit 3
  ) s;

  return jsonb_build_object(
    'players', coalesce(v_players,0),
    'games_started', coalesce(v_started,0),
    'games_completed', coalesce(v_completed,0),
    'avg_score', coalesce(v_avg_score,0),
    'hardest', coalesce(v_hardest, '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_profile(p_nickname text, p_avatar text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trivia_user_stats (user_id, nickname, avatar)
  values (auth.uid(), p_nickname, p_avatar)
  on conflict (user_id)
  do update set nickname = excluded.nickname, avatar = excluded.avatar, updated_at = now();

  return jsonb_build_object('nickname', p_nickname, 'avatar', p_avatar);
end;
$$;

create or replace function public.list_children()
returns table (id uuid, user_id uuid, nickname text, avatar text)
language sql
security definer
set search_path = public
as $$
  select s.user_id as id, s.user_id, s.nickname, s.avatar
  from public.trivia_user_stats s
  where s.user_id = auth.uid()
  union all
  select u.id, u.id, u.email as nickname, null::text as avatar
  from auth.users u
  where false;
$$;

create or replace function public.create_link_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := upper(substr(md5(random()::text), 1, 8));
  insert into public.trivia_family_links (parent_user_id, code)
  values (auth.uid(), v_code);
  return v_code;
end;
$$;

create or replace function public.redeem_link_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trivia_family_links
  set child_user_id = auth.uid(), used_at = now()
  where code = p_code and child_user_id is null;

  return found;
end;
$$;

create or replace function public.reset_child_progress(p_child uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.trivia_character_progress where user_id = p_child;
  delete from public.trivia_user_badges where user_id = p_child;
  update public.trivia_user_stats
  set games_started = 0,
      games_completed = 0,
      questions_answered = 0,
      correct_answers = 0,
      best_score = 0,
      best_streak = 0,
      stars_earned = 0,
      updated_at = now()
  where user_id = p_child;
end;
$$;

create or replace function public.start_game(
  p_category text,
  p_difficulty text,
  p_timer boolean,
  p_mode text
)
returns public.trivia_game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trivia_game_sessions;
begin
  insert into public.trivia_game_sessions (
    user_id, category, difficulty, timer_enabled, mode, status, score, stars, questions_answered, correct_answers, best_streak
  )
  values (
    auth.uid(), coalesce(p_category, 'bible_characters'), coalesce(p_difficulty, 'easy'), coalesce(p_timer, true), coalesce(p_mode, 'solo'), 'active', 0, 0, 0, 0, 0
  )
  returning * into v_row;

  update public.trivia_user_stats
  set games_started = games_started + 1,
      updated_at = now()
  where user_id = auth.uid();

  return v_row;
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
set search_path = public
as $$
declare
  v_question record;
  v_session public.trivia_game_sessions;
  v_points integer;
  v_correct boolean;
begin
  select * into v_session
  from public.trivia_game_sessions
  where id = p_session and user_id = auth.uid();

  if v_session.id is null then
    raise exception 'Session not found';
  end if;

  select * into v_question
  from public.trivia_questions
  where id = p_question and is_published = true;

  if v_question.id is null then
    raise exception 'Question not found';
  end if;

  v_correct := lower(coalesce(p_chosen, '')) = lower(v_question.correct_option);
  v_points := case when v_correct then 10 else 0 end;

  update public.trivia_game_sessions
  set score = score + v_points,
      questions_answered = questions_answered + 1,
      correct_answers = correct_answers + case when v_correct then 1 else 0 end,
      best_streak = case when v_correct then best_streak + 1 else 0 end,
      updated_at = now()
  where id = p_session;

  update public.trivia_user_stats
  set questions_answered = questions_answered + 1,
      correct_answers = correct_answers + case when v_correct then 1 else 0 end,
      best_score = greatest(best_score, (score + v_points)),
      updated_at = now()
  where user_id = auth.uid();

  return jsonb_build_object(
    'correct', v_correct,
    'points', v_points,
    'explanation', v_question.explanation,
    'bible_reference', v_question.bible_reference,
    'time_left', p_time_left
  );
end;
$$;

create or replace function public.finish_game(p_session uuid)
returns public.trivia_game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trivia_game_sessions;
begin
  update public.trivia_game_sessions
  set status = 'finished',
      completed_at = now(),
      updated_at = now()
  where id = p_session and user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Session not found';
  end if;

  update public.trivia_user_stats
  set games_completed = games_completed + 1,
      stars_earned = stars_earned + v_row.stars,
      updated_at = now()
  where user_id = auth.uid();

  return v_row;
end;
$$;

create or replace function public.claim_game(p_session uuid)
returns public.trivia_game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trivia_game_sessions;
begin
  update public.trivia_game_sessions
  set status = 'claimed',
      claimed_at = now(),
      updated_at = now()
  where id = p_session and user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Session not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.game_lessons(p_session uuid)
returns table (
  category text,
  difficulty text,
  question text,
  explanation text,
  bible_reference text,
  hint text
)
language sql
security definer
set search_path = public
as $$
  select q.category,
         q.difficulty,
         q.question,
         q.explanation,
         q.bible_reference,
         q.hint
  from public.trivia_game_sessions s
  join public.trivia_questions q
    on q.category = s.category
   and q.is_published = true
  where s.id = p_session and s.user_id = auth.uid()
  order by q.updated_at desc
  limit 5;
$$;

-- RLS setup for app and admin usage
alter table public.trivia_categories enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.trivia_admins enable row level security;
alter table public.trivia_user_stats enable row level security;
alter table public.trivia_badges enable row level security;
alter table public.trivia_user_badges enable row level security;
alter table public.trivia_game_sessions enable row level security;
alter table public.trivia_character_progress enable row level security;
alter table public.trivia_family_links enable row level security;

create policy if not exists trivia_categories_select_all on public.trivia_categories
for select using (true);

create policy if not exists trivia_questions_select_published on public.trivia_questions
for select using (is_published = true or exists (select 1 from public.trivia_admins where user_id = auth.uid()));

create policy if not exists trivia_questions_manage_admin on public.trivia_questions
for all using (exists (select 1 from public.trivia_admins where user_id = auth.uid())) with check (exists (select 1 from public.trivia_admins where user_id = auth.uid()));

create policy if not exists trivia_admins_read_own on public.trivia_admins
for select using (user_id = auth.uid());

create policy if not exists trivia_user_stats_self on public.trivia_user_stats
for select using (user_id = auth.uid());
create policy if not exists trivia_user_stats_self_upsert on public.trivia_user_stats
for insert with check (user_id = auth.uid());
create policy if not exists trivia_user_stats_self_update on public.trivia_user_stats
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists trivia_user_badges_self on public.trivia_user_badges
for select using (user_id = auth.uid());
create policy if not exists trivia_user_badges_insert_self on public.trivia_user_badges
for insert with check (user_id = auth.uid());

create policy if not exists trivia_game_sessions_self on public.trivia_game_sessions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists trivia_character_progress_self on public.trivia_character_progress
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists trivia_family_links_self on public.trivia_family_links
for select using (parent_user_id = auth.uid() or child_user_id = auth.uid());
create policy if not exists trivia_family_links_manage_self on public.trivia_family_links
for insert with check (parent_user_id = auth.uid());

create or replace function public.seed_default_badges()
returns void
language sql
security definer
as $$
  insert into public.trivia_badges (code, label, description, icon)
  values
    ('starter', 'Starter Badge', 'Completed the first lesson', '🏁'),
    ('brave', 'Brave Learner', 'Kept learning with courage', '🦁'),
    ('faithful', 'Faithful Friend', 'Finished a full set of questions', '✨')
  on conflict (code) do nothing;
$$;

select public.seed_default_badges();
