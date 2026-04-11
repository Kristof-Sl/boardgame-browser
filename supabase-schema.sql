-- Run this SQL in your Supabase project: Dashboard → SQL Editor → New query

-- Events table
create table if not exists events (
  id text primary key default lower(substring(md5(random()::text), 1, 6)),
  name text not null,
  location text,
  start_date date not null,
  end_date date not null,
  status text not null default 'voting',  -- voting | preferences | scheduled | closed
  collection jsonb default '[]',          -- base game collection attached by organizer
  schedule jsonb default '[]',            -- generated schedule
  schedule_params jsonb default '{}',     -- parameters used for scheduling
  created_at timestamptz default now()
);

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
  id uuid primary key default gen_random_uuid(),
  event_id text references events(id) on delete cascade,
  game_id text not null,
  game_name text not null,
  game_data jsonb default '{}',
  unique(event_id, game_id)
);

-- Enable real-time for all tables
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table game_votes;
alter publication supabase_realtime add table game_preferences;
alter publication supabase_realtime add table event_games;

-- Allow public access (no auth required — event code acts as the key)
alter table events enable row level security;
alter table participants enable row level security;
alter table game_votes enable row level security;
alter table game_preferences enable row level security;
alter table event_games enable row level security;

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
