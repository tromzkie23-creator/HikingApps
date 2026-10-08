PRAGMA foreign_keys = ON;

-- Before running, inspect PRAGMA table_info(posts) and skip any ALTER TABLE
-- statement below for a column that already exists.
ALTER TABLE posts ADD COLUMN hike_id TEXT REFERENCES hike_logs(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN hike_distance_km REAL;
ALTER TABLE posts ADD COLUMN hike_duration_secs INTEGER;
ALTER TABLE posts ADD COLUMN hike_elevation_gain_m INTEGER;
ALTER TABLE posts ADD COLUMN hike_path_json TEXT CHECK (hike_path_json IS NULL OR json_valid(hike_path_json));
ALTER TABLE posts ADD COLUMN hide_endpoints INTEGER NOT NULL DEFAULT 1 CHECK (hide_endpoints IN (0, 1));

CREATE TABLE IF NOT EXISTS post_photos (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 5),
  UNIQUE (post_id, position)
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

CREATE TABLE IF NOT EXISTS post_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_post_photos_post_position
  ON post_photos(post_id, position);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
  ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id
  ON post_reports(post_id, created_at);

-- Keep existing one-photo posts visible through the new carousel table.
INSERT OR IGNORE INTO post_photos (id, post_id, photo_url, position)
SELECT 'legacy-' || id, id, photo_url, 0
FROM posts
WHERE photo_url IS NOT NULL AND photo_url <> '';
