# Board Game Browser

Browse and filter board game collections imported from [BoardGameGeek](https://boardgamegeek.com).

## Features

- Browse the shared BGG collection and add private, browser-local accounts
- Filter by player count, rating, playtime, and ownership status
- Sort by rating, name, year, plays, or BGG rank
- Combined view across shared and local accounts
- Click any game to open its BGG page

## Development

```bash
npm install
npm run dev
```

## Supabase Data Migration

For a fresh Supabase project, run `supabase-schema.sql`. For an existing project, run `supabase-update.sql`; it creates `game_collection` and `game_library`, migrates legacy event data, and removes duplicated columns from `event_games`.

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the app. Configure `ADMIN_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` as server-only environment variables for protected admin account changes, both locally and in Vercel. Do not prefix either server-only variable with `VITE_`.

After deploying the tables and environment variables, open **Admin → Game Library → Import bundled JSON into database** once. This imports the bundled `default-collection.json` and `bgg-game-details.json` into the new tables. The app then loads shared collections and detailed game data from Supabase; the bundled files are only used by this one-time admin import.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Vercel will auto-detect Vite — just click Deploy

## Tech

- React 18 + Vite
- BGG XML API v2 via the Vercel serverless proxy
- Supabase for shared collections, the game library, and event data
