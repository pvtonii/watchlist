-- ============================================================
-- WatchList — schema v1.0.0
-- Rodar UMA vez no Supabase: Dashboard → SQL Editor → colar → Run
-- ============================================================

-- Filmes e séries na biblioteca do usuário (watchlist / watching / completed / dropped)
create table if not exists public.library_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  status      text not null default 'watchlist'
              check (status in ('watchlist', 'watching', 'completed', 'dropped')),
  -- cache p/ listar sem bater no TMDB
  title       text not null,
  poster_path text,
  release_date text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

-- Episódios marcados como assistidos
create table if not exists public.watched_episodes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  tmdb_show_id   integer not null,
  season_number  integer not null,
  episode_number integer not null,
  watched_at     timestamptz not null default now(),
  unique (user_id, tmdb_show_id, season_number, episode_number)
);

create index if not exists watched_episodes_user_show_idx
  on public.watched_episodes (user_id, tmdb_show_id);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists library_items_updated_at on public.library_items;
create trigger library_items_updated_at
  before update on public.library_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS: cada usuário só vê/edita as PRÓPRIAS linhas (multiusuário)
-- ============================================================
alter table public.library_items enable row level security;
alter table public.watched_episodes enable row level security;

drop policy if exists "own library items" on public.library_items;
create policy "own library items" on public.library_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own watched episodes" on public.watched_episodes;
create policy "own watched episodes" on public.watched_episodes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
