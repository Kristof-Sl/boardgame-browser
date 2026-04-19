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