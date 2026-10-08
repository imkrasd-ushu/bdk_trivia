-- Initial schema for DK Bible Trivia
-- This is the canonical migration used by the GitHub Supabase workflow.

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
