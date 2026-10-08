# Trailhead API

Vercel serverless API backed by Turso/libSQL. The repository-root Vercel project builds this backend from `trailhead-api/` while leaving the Vercel Root Directory empty.

## Routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/register` | No | Create account and return JWT |
| POST | `/api/login` | No | Verify password and return JWT |
| GET | `/api/trails` | No | List trails |
| POST | `/api/password` | Yes | Change the signed-in user's password |
| GET, PATCH | `/api/profile` | Yes | Read or update the signed-in user's profile |
| GET, POST | `/api/posts` | Yes | List the social feed or create a post |
| GET | `/api/posts/:id` | Yes | Read post details, photos, and its full attached hike route |
| DELETE | `/api/posts/:id` | Yes | Delete a post owned by the signed-in user |
| POST, DELETE | `/api/posts/:id/like` | Yes | Like or unlike a post |
| POST | `/api/posts/:id/report` | Yes | Report a post |
| GET, POST | `/api/posts/:id/comments` | Yes | Read or add comments |
| GET | `/api/profile?user_id=:id` | Yes | Read public profile information and hiking totals |
| POST | `/api/upload` | Yes | Upload a JPEG photo to public Vercel Blob storage |
| GET | `/api/trails/:id` | No | Trail and waypoints |
| GET, POST | `/api/trails/:id/reviews` | POST requires login | Read trail reviews and rating; submit a review |
| GET, POST, DELETE | `/api/favorites` | Yes | Read, save, or remove the current user's saved trails |
| GET | `/api/stats` | Yes | Current user's hiking totals and personal bests |
| POST | `/api/hikes` | Bearer JWT | Save a completed hike |
| GET | `/api/hikes` | Bearer JWT | Current user's hike history |

`DELETE /api/hikes` accepts `{ "hike_id": "<id>" }` and removes only a hike owned by the authenticated user.
`POST /api/password` accepts `{ "current_password": "...", "new_password": "..." }`, verifies the current password, and stores the new password as a bcrypt hash.
`GET /api/posts` returns up to 10 newest posts and a `next_cursor`; pass that cursor as `?cursor=...` to load the next page. Feed rows include author profile details, photos, like/comment counts, and `liked_by_me`. Pass `author_id` to list one user's posts. `POST /api/posts` accepts up to six `photo_urls`, a caption up to 500 characters, an optional owned `hike_id`, optional place and coordinates, and `hide_endpoints` (true by default). Attached hikes are snapshotted with their stats and route; with endpoint hiding enabled, the first and last 200 metres are trimmed before storage and responses. List results simplify attached routes to at most 150 points, while a post detail returns the full saved route. `POST /api/posts/:id/report` accepts a reason up to 500 characters.
`POST /api/upload` accepts a raw JPEG request body (`Content-Type: image/jpeg`), requires a valid JPEG file no larger than 3 MiB, and returns `{ "url": "..." }`.
`PATCH /api/profile` accepts one or more of `name` (1–100 characters), `bio` (up to 300 characters or `null`), and `avatar_url` (HTTPS URL or `null`). Comments must contain 1–1000 characters.

The root Vercel configuration keeps these public API URLs while consolidating the post collection, detail, likes, and comments endpoints into the single `api/posts.ts` serverless function. Keep Vercel's Root Directory set to the repository root so its `vercel.json` and `trailhead-api/api/` build entries are used. The API folder currently contains 12 function files, within the Hobby plan limit.

### Add the social feed schema to an existing database

Back up the existing Turso database first. Run the following statements once against the same database used by the API. They do not drop or rewrite existing user, trail, or hike data. SQLite does not support `ADD COLUMN IF NOT EXISTS` consistently across Turso versions, so skip either `ALTER TABLE` statement if that column already exists.

```sql
PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  place_name TEXT NOT NULL,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  suggest_hike INTEGER NOT NULL DEFAULT 0 CHECK (suggest_hike IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
  ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON post_comments(post_id, created_at);
```

For the multi-photo hiking feed migration specifically, back up first and inspect `PRAGMA table_info(posts);`. Apply the statements in [`migrations/social-hiking-feed.sql`](./migrations/social-hiking-feed.sql), skipping only `ALTER TABLE` statements for columns already present. This migration adds the nullable hike link and snapshots, creates photo/report tables and missing likes/comments tables, adds indexes, and copies legacy `photo_url` values into the carousel table. From the repository root:

```powershell
Get-Content .\trailhead-api\migrations\social-hiking-feed.sql -Raw | turso db shell hikingdatabase
```

Use the actual database name configured for the deployed API. Verify with `PRAGMA table_info(posts);`, `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('post_photos', 'post_likes', 'post_comments', 'post_reports');`, and `PRAGMA foreign_key_check;`.

Run the statements with `turso db shell <your-database-name>` after selecting the correct database, or save them in a SQL file and pipe it to the shell. If a `users` column already exists, omit only that column's `ALTER TABLE` statement. Verify the tables and columns afterward with `PRAGMA table_info(users);`, `PRAGMA foreign_key_check;`, and `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'post%';`.

### Configure Vercel Blob

In Vercel, open the Trailhead project **Storage** tab → **Create Storage** → **Blob** → choose **Public** access and create the store. Under the store's **Projects** tab, connect it to Trailhead and enable Production, Preview, and Development as needed. Vercel adds `BLOB_READ_WRITE_TOKEN` to the selected project environments automatically. If setting it manually, run the relevant command from the repository root and paste the store's read-write token when prompted:

```sh
npx vercel@latest env add BLOB_READ_WRITE_TOKEN production
npx vercel@latest env add BLOB_READ_WRITE_TOKEN preview
npx vercel@latest env add BLOB_READ_WRITE_TOKEN development
```

Do not put this token in the Expo app or commit it. Redeploy after changing environment variables. For local API development, pull development values with `npx vercel@latest env pull .env.local`; do not print or share that file.

## Apply schema changes to an existing Turso database

From the repository root, back up the existing database, confirm the Turso CLI is connected to it, then apply the schema and Philippines seed:

```powershell
turso db show hikingdatabase
Get-Content .\trailhead-api\schema.sql -Raw | turso db shell hikingdatabase
```

The schema uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `INSERT OR IGNORE`. It replaces the three legacy sample trails with nine Philippine trail entries. A legacy trail is retained only if an existing hike log references it, so hike history is not deleted; unreferenced legacy trails (and their dependent waypoints, reviews, and server-side favorites) are removed. The nine new trail IDs are stable, so rerunning the schema does not duplicate them. This does not require changing any Vercel environment variables.

### Upgrade the existing database for the current API

The current API needs `reviews`, `favorites`, and the free-hike columns on `hike_logs`. Run this migration once against the same Turso database configured in Vercel. It handles the original hike-log schema (`id`, `user_id`, `trail_id`, `distance_km`, `duration_secs`, `started_at`, and `synced_at`), preserves every hike row, and uses the linked trail name for existing hikes. Old hikes have no recorded GPS path, so their path and waypoint data start as empty JSON arrays. Back up the database before running a production migration.

Run this SQL once in the Turso shell:

```sql
BEGIN IMMEDIATE;

CREATE TABLE hike_logs_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT REFERENCES trails(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  distance_km REAL NOT NULL CHECK (distance_km > 0),
  duration_secs INTEGER NOT NULL CHECK (duration_secs >= 0),
  path_json TEXT CHECK (path_json IS NULL OR json_valid(path_json)),
  waypoints_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(waypoints_json)),
  started_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO hike_logs_new
  (id, user_id, trail_id, name, distance_km, duration_secs, path_json, waypoints_json, started_at, synced_at)
SELECT h.id, h.user_id, h.trail_id, COALESCE(t.name, ''), h.distance_km, h.duration_secs,
       '[]', '[]', h.started_at, h.synced_at
FROM hike_logs h
LEFT JOIN trails t ON t.id = h.trail_id;

DROP TABLE hike_logs;
ALTER TABLE hike_logs_new RENAME TO hike_logs;
CREATE INDEX IF NOT EXISTS idx_hike_logs_user_started
  ON hike_logs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, trail_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, trail_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_trail_created
  ON reviews(trail_id, created_at DESC);

COMMIT;
PRAGMA foreign_key_check;
```

Afterward, `PRAGMA foreign_key_check` should return no rows. `GET /api/trails` can calculate ratings, and the hike endpoints can read and write named free hikes. New databases get these tables and fields from `schema.sql`. Unsynced hikes remain on-device and retry when History loads while signed in.

## Create and seed Turso

1. Install the Turso CLI and sign in: `turso auth login`.
2. Create a database in your desired region: `turso db create trailhead`.
3. Get the database URL: `turso db show trailhead --url`.
4. Create an application token: `turso db tokens create trailhead`.
5. Run this folder's `schema.sql` in the Turso SQL shell:

   ```sh
   turso db shell trailhead < schema.sql
   ```

   In PowerShell, use `Get-Content .\schema.sql -Raw | turso db shell trailhead`, or open `turso db shell trailhead` and paste the contents of `schema.sql`. The script creates the schema and inserts nine optional Philippine trail entries and their waypoints. It is safe to run more than once.

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

1. Keep the Vercel project's **Root Directory** empty so it uses the repository root. The root `vercel.json` builds the TypeScript handlers under `trailhead-api/api/` and routes the public `/api/*` endpoints to them.
2. Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `JWT_SECRET` under **Project Settings → Environment Variables** for Preview and Production. `JWT_SECRET` must be a random secret at least 32 characters long. Never put backend secrets in the Expo app or commit them.
3. Redeploy the project. Vercel installs the backend's production dependencies from `trailhead-api/package-lock.json`.
4. In the Expo project root, set `EXPO_PUBLIC_API_BASE_URL` to the deployed origin, for example `https://trailhead-api-your-team.vercel.app` (no trailing slash), and restart Expo. This URL is public; never place the Turso token or JWT signing secret in the Expo app.
5. To enable optional worldwide foot-hiking routes, set `EXPO_PUBLIC_OPENROUTESERVICE_API_KEY` in the Expo environment and restart Expo. GPS tracking and place search work without this key.
6. Verify `https://<deployment>/api/trails` returns JSON with a `trails` array. A POST to `/api/login` with an empty JSON body should return a JSON validation error, not an HTML page.

## App packages

From the Expo project root:

```sh
npx expo install expo-secure-store
npx expo install @react-native-async-storage/async-storage
npx expo install expo-image-picker
npx expo install expo-image-manipulator
```

Favorites and profile pictures are stored locally with AsyncStorage; profile pictures do not upload to the API. Credentials continue to use SecureStore. The app uses the built-in `fetch`; no separate HTTP client is required. If a dependency is already installed, no install is needed.

## Security notes

Passwords are stored as bcrypt hashes (12 rounds), never as plain text. Hike endpoints verify a signed JWT and always scope reads to the token's user ID. Keep the Turso token and JWT secret only in Vercel environment variables; do not put either in Expo.
