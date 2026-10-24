-- Supabase Update: Add game_files table
-- Run this in your existing Supabase project to add the game files feature

-- Game files (global, not per event)
create table if not exists game_files (
  id uuid primary key default gen_random_uuid(),
  game_id text not null unique,
  files jsonb default '[]',  -- array of {name: string, url: string}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable real-time for the new table
alter publication supabase_realtime add table game_files;

-- Allow public access (no auth required — global game data)
alter table game_files enable row level security;

create policy "public read game_files" on game_files for select using (true);
create policy "public insert game_files" on game_files for insert with check (true);
create policy "public update game_files" on game_files for update using (true);
create policy "public delete game_files" on game_files for delete using (true);

-- Shared BGG collections and detailed game library
create table if not exists game_library (
  game_id text primary key,
  game_data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table if not exists game_collection (
  username text primary key,
  games jsonb not null default '[]',
  updated_at timestamptz default now()
);

alter table game_library enable row level security;
alter table game_collection enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_library' and policyname = 'public read game_library') then
    execute 'create policy "public read game_library" on game_library for select using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_library' and policyname = 'public insert game_library') then
    execute 'create policy "public insert game_library" on game_library for insert with check (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_library' and policyname = 'public update game_library') then
    execute 'create policy "public update game_library" on game_library for update using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_library' and policyname = 'public delete game_library') then
    execute 'create policy "public delete game_library" on game_library for delete using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_collection' and policyname = 'public read game_collection') then
    execute 'create policy "public read game_collection" on game_collection for select using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_collection' and policyname = 'public update game_collection') then
    execute 'create policy "public update game_collection" on game_collection for update using (true)';
  end if;
end $$;

drop policy if exists "public delete game_collection" on game_collection;
drop policy if exists "public insert game_collection" on game_collection;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_library') then
    execute 'alter publication supabase_realtime add table game_library';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_collection') then
    execute 'alter publication supabase_realtime add table game_collection';
  end if;
end $$;

-- Keep old event game payloads available in the shared library before dropping duplicates.
insert into game_library (game_id, game_data)
select distinct on (game_id) game_id, coalesce(game_data, '{}'::jsonb) || jsonb_build_object('id', game_id, 'name', game_name)
from event_games
where game_id is not null
order by game_id
on conflict (game_id) do nothing;

insert into game_library (game_id, game_data)
select distinct on (game_id) game_id, coalesce(game_data, '{}'::jsonb) || jsonb_build_object('id', game_id, 'name', game_name)
from game_votes
where game_id is not null
order by game_id
on conflict (game_id) do nothing;

-- Convert legacy object collections and verbose schedule slots to their ID-based forms.
update events as event
set collection = coalesce((
  select jsonb_agg(case when jsonb_typeof(game) = 'object' then game -> 'id' else game end)
  from jsonb_array_elements(coalesce(event.collection, '[]'::jsonb)) as items(game)
), '[]'::jsonb)
where jsonb_typeof(event.collection) = 'array';

update events as event
set schedule = coalesce((
  select jsonb_agg(jsonb_build_object(
    'date', slot -> 'date',
    'part', slot -> 'part',
    'gameId', slot -> 'gameId',
    'gameDuration', slot -> 'gameDuration',
    'players', coalesce((
      select jsonb_agg(case when jsonb_typeof(player) = 'object' then player -> 'id' else player end)
      from jsonb_array_elements(coalesce(slot -> 'players', '[]'::jsonb)) as players(player)
    ), '[]'::jsonb)
  ))
  from jsonb_array_elements(coalesce(event.schedule, '[]'::jsonb)) as slots(slot)
), '[]'::jsonb)
where jsonb_typeof(event.schedule) = 'array';

alter table event_games drop constraint if exists event_games_pkey;
alter table event_games drop constraint if exists event_games_event_id_game_id_key;
alter table event_games drop column if exists id;
alter table event_games drop column if exists game_name;
alter table event_games drop column if exists game_data;
alter table event_games alter column event_id set not null;
alter table event_games alter column game_id set not null;
alter table event_games add primary key (event_id, game_id);