# Bluff & Steal

A mobile-friendly multiplayer party game for 4–6 players. Create a room, share its four-letter code or invite URL, and play five 15-second rounds. No account or app install is needed.

## Requirements

- Node.js 20+ and npm
- A Supabase project

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the project **SQL Editor**, run the migration files in `supabase/migrations/` in numeric order: `001_game_schema.sql`, `002_round_resolution.sql`, then `003_direct_client_access.sql`.
3. In **Project Settings → API**, copy the Project URL and the `anon` / publishable key.

The browser creates rooms, joins players, and submits moves with ordinary Supabase table queries. Realtime subscriptions refresh connected screens. Round resolution runs in a transaction-safe Postgres RPC invoked through `supabase.rpc`; there is no Edge Function to deploy.

## Run locally

From this project directory:

```sh
npm install
```

Copy `.env.example` to `.env.local` and set your project credentials:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Start the app:

```sh
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). For cross-device play, deploy the Vite `dist` output to any public HTTPS static host and set the same two environment variables there.

## Gameplay

- One person creates the room; 3–5 others join. The host can start once at least four players are present.
- Each of the five rounds lasts 15 seconds. Choose **Collect** (+10) or target another player with **Steal** (+15 for you, −10 for them).
- If two players target each other, each loses 10 and neither receives steal points.
- A timeout leaves the player's score unchanged. Scores update when the round resolves; the podium appears after round five.

## Privacy and deployment note

Choices stay in a table that anonymous browser clients cannot read; clients can see only which players have submitted. The database function resolves scores atomically. Because the game intentionally has no login, room codes and player IDs are lightweight game identifiers rather than strong identity verification; use it for casual game nights, not sensitive or competitive play.
