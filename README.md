# DK Bible Trivia (Expo / React Native)

One app for kids and families to play, with a protected Admin tab for quiz management.

## Run it

From this folder, run `npx expo start` and scan the QR code with Expo Go. The project targets Expo SDK 57.

The local `.env` contains this app's Supabase URL and publishable key and is excluded from git. For another environment, copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` before starting Expo.

## Structure

```text
App.js                      Expo Router layout export
src/app/                    file-based stack and tabs
src/config/                 environment, category, levels, messages, Bible URL
src/theme/                  colors and visual constants
src/services/                Supabase auth, game, progress and admin operations
src/context/AuthContext.js  session, admin status and profile
src/hooks/useGame.js        server-scored game state machine and timer
src/components/             shared controls, cards, host and parent gate
src/screens/                auth, play, family, progress and admin screens
src/utils/csv.js            CSV parsing and row validation
```

## Rules

- The client sends the selected answer and remaining time. Scores, streaks, stars and badges come from Supabase.
- Correct-answer keys are only shown after the server grades an answer.
- Admin routes and tabs require a verified admin session; Supabase row-level security remains the write boundary.
- Bible passages open in an external browser only after the grown-up check.

## Adding a category

Add rows to `trivia_categories`, add questions for that category, then pass its key into `startGame` (currently `CATEGORY`). Game flow does not need to change.
