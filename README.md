# Board Game Browser

Browse and filter board game collections imported from [BoardGameGeek](https://boardgamegeek.com).

## Features

- Import collections from one or more BGG usernames
- Filter by player count, rating, playtime, and ownership status
- Sort by rating, name, year, plays, or BGG rank
- Combined view when multiple accounts are added
- Click any game to open its BGG page

## Development

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Vercel will auto-detect Vite — just click Deploy

## Tech

- React 18 + Vite
- BGG XML API v2 (via allorigins.win CORS proxy)
- No backend required — fully static
