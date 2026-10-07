# Trailhead API

Vercel serverless API backed by Turso/libSQL. Deploy this folder as its own Vercel project, separate from the Expo app.

## Routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/register` | No | Create account and return JWT |
| POST | `/api/login` | No | Verify password and return JWT |
| GET | `/api/trails` | No | List trails |
| GET | `/api/trails/:id` | No | Trail and waypoints |
| POST | `/api/hikes` | Bearer JWT | Save a completed hike |
| GET | `/api/hikes` | Bearer JWT | Current user's hike history |

## Create and seed Turso

1. Install the Turso CLI and sign in: `turso auth login`.
2. Create a database in your desired region: `turso db create trailhead`.
3. Get the database URL: `turso db show trailhead --url`.
4. Create an application token: `turso db tokens create trailhead`.
5. Run this folder's `schema.sql` in the Turso SQL shell:

   ```sh
   turso db shell trailhead < schema.sql
   ```

   In PowerShell, use `Get-Content .\schema.sql -Raw | turso db shell trailhead`, or open `turso db shell trailhead` and paste the contents of `schema.sql`. The script creates the schema and inserts the three current sample trails and their waypoints. It is safe to run more than once.

## Run the API locally

```sh
cd trailhead-api
npm install
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env add TURSO_DATABASE_URL development
npx vercel@latest env add TURSO_AUTH_TOKEN development
npx vercel@latest env add JWT_SECRET development
npx vercel@latest dev
```

Set each prompted value. `JWT_SECRET` must be a random secret at least 32 characters long. For a local `.env` instead, copy `.env.example` to `.env` and fill its values. Never commit the real `.env`.

## Deploy to Vercel

1. In the Vercel project settings, set **Root Directory** to `trailhead-api` (not the repository root). For an existing project, save the changed root directory before redeploying.
2. Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `JWT_SECRET` under **Project Settings → Environment Variables** for Preview and Production.
3. Redeploy. The files under `api/` are discovered as Vercel functions only when `trailhead-api` is the project root.
4. In the Expo project root, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the deployed origin, for example `https://trailhead-api-your-team.vercel.app` (no trailing slash). Restart Expo so the public variable is embedded. This URL is public; never place the Turso token or JWT signing secret in the Expo app.
5. Verify `https://<deployment>/api/trails` returns JSON with a `trails` array. A Vercel/Express HTML 404 such as “Cannot GET /api/trails” means the deployment is not using this folder as its root. A POST to `/api/login` with an empty JSON body should return a JSON validation error, not an HTML page.

## App packages

From the Expo project root:

```sh
npx expo install expo-secure-store
```

The app uses the built-in `fetch`; no separate HTTP client is required. If the dependency is already installed, no install is needed.

## Security notes

Passwords are stored as bcrypt hashes (12 rounds), never as plain text. Hike endpoints verify a signed JWT and always scope reads to the token's user ID. Keep the Turso token and JWT secret only in Vercel environment variables; do not put either in Expo.
