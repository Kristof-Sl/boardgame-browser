-- Run this SQL in your Supabase project: Dashboard → SQL Editor → New query

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

-- Events table
create table if not exists events (
  id text primary key default lower(substring(md5(random()::text), 1, 6)),
  name text not null,
  location text,
  start_date date not null,
  end_date date not null,
  status text not null default 'voting',  -- voting | preferences | scheduled | closed
  collection jsonb default '[]',          -- game IDs attached by organizer
  created_at timestamptz default now()
);

-- Versioned schedules for each event; creating a version marks it as the default.
create table if not exists event_schedules (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  version integer not null,
  label text not null,
  schedule jsonb not null default '[]',
  schedule_params jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz default now(),
  unique(event_id, version)
);

create unique index if not exists one_default_schedule_per_event
  on event_schedules(event_id) where is_default;

create or replace function create_event_schedule(
  p_event_id text,
  p_schedule jsonb,
  p_schedule_params jsonb,
  p_label text default null,
  p_is_default boolean default true
)
returns setof event_schedules
language plpgsql
as $$
declare
  next_version integer;
begin
  perform 1 from events where id = p_event_id for update;
  if not found then
    raise exception 'Event % was not found', p_event_id;
  end if;

  if p_is_default then
    update event_schedules set is_default = false
    where event_id = p_event_id and is_default;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from event_schedules where event_id = p_event_id;

  return query
  insert into event_schedules (event_id, version, label, schedule, schedule_params, is_default)
  values (
    p_event_id,
    next_version,
    coalesce(nullif(p_label, ''), 'Schedule ' || next_version),
    coalesce(p_schedule, '[]'::jsonb),
    coalesce(p_schedule_params, '{}'::jsonb),
    p_is_default
  )
  returning *;
end;
$$;

grant execute on function create_event_schedule(text, jsonb, jsonb, text, boolean) to anon, authenticated;

-- Participants
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  name text not null,
  arrive_date date,
  arrive_part text default 'morning',     -- morning | afternoon | evening
  depart_date date,
  depart_part text default 'evening',
  created_at timestamptz default now(),
  unique(event_id, name)
);

-- Game votes (voting phase: want / neutral / dont_want)
create table if not exists game_votes (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  game_id text not null,
  game_name text not null,
  game_data jsonb default '{}',           -- full game object (thumbnail, rating, etc.)
  vote text not null,                     -- want | neutral | dont_want
  created_at timestamptz default now(),
  unique(event_id, participant_id, game_id)
);

-- Game preferences (preferences phase: really_want | want | neutral | dont_want)
create table if not exists game_preferences (
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  game_id text not null,
  preference text not null,              -- really_want | want | neutral | dont_want
  created_at timestamptz default now(),
  unique(event_id, participant_id, game_id)
);

-- Selected games for the event (chosen by organizer after voting)
create table if not exists event_games (
  event_id text references events(id) on delete cascade,
  game_id text not null,
  primary key(event_id, game_id)
);

-- Game files (global, not per event)
create table if not exists game_files (
  id uuid primary key default gen_random_uuid(),
  game_id text not null unique,
  files jsonb default '[]',  -- array of {name: string, url: string}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Play logs (logged plays linked to the collection and optional events)
create table if not exists play_logs (
  id text primary key,
  game_id text not null,
  game_name text not null,
  game_data jsonb default '{}',
  played_at date not null,
  duration_minutes int not null,
  event_id text,
  players jsonb default '[]', -- array of {name: text, score: int, winner: boolean}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable real-time for all tables
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table game_votes;
alter publication supabase_realtime add table game_preferences;
alter publication supabase_realtime add table event_games;
alter publication supabase_realtime add table game_files;
alter publication supabase_realtime add table play_logs;
alter publication supabase_realtime add table game_library;
alter publication supabase_realtime add table game_collection;
alter publication supabase_realtime add table event_schedules;

-- Allow public access (no auth required — event code acts as the key)
alter table events enable row level security;
alter table participants enable row level security;
alter table game_votes enable row level security;
alter table game_preferences enable row level security;
alter table event_games enable row level security;
alter table game_library enable row level security;
alter table game_collection enable row level security;
alter table event_schedules enable row level security;

create policy "public read events" on events for select using (true);
create policy "public insert events" on events for insert with check (true);
create policy "public update events" on events for update using (true);
create policy "public delete events" on events for delete using (true);

create policy "public read participants" on participants for select using (true);
create policy "public insert participants" on participants for insert with check (true);
create policy "public update participants" on participants for update using (true);
create policy "public delete participants" on participants for delete using (true);

create policy "public read votes" on game_votes for select using (true);
create policy "public insert votes" on game_votes for insert with check (true);
create policy "public update votes" on game_votes for update using (true);
create policy "public delete votes" on game_votes for delete using (true);

create policy "public read prefs" on game_preferences for select using (true);
create policy "public insert prefs" on game_preferences for insert with check (true);
create policy "public update prefs" on game_preferences for update using (true);
create policy "public delete prefs" on game_preferences for delete using (true);

create policy "public read event_games" on event_games for select using (true);
create policy "public insert event_games" on event_games for insert with check (true);
create policy "public delete event_games" on event_games for delete using (true);

create policy "public read game_library" on game_library for select using (true);
create policy "public insert game_library" on game_library for insert with check (true);
create policy "public update game_library" on game_library for update using (true);
create policy "public delete game_library" on game_library for delete using (true);

create policy "public read game_collection" on game_collection for select using (true);
create policy "public update game_collection" on game_collection for update using (true);

create policy "public read event_schedules" on event_schedules for select using (true);
create policy "public insert event_schedules" on event_schedules for insert with check (true);
create policy "public update event_schedules" on event_schedules for update using (true);

create policy "public read game_files" on game_files for select using (true);
create policy "public insert game_files" on game_files for insert with check (true);
create policy "public update game_files" on game_files for update using (true);
create policy "public delete game_files" on game_files for delete using (true);

create policy "public read play_logs" on play_logs for select using (true);
create policy "public insert play_logs" on play_logs for insert with check (true);
create policy "public update play_logs" on play_logs for update using (true);
create policy "public delete play_logs" on play_logs for delete using (true);
