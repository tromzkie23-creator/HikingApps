PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS trails (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  km REAL NOT NULL CHECK (km > 0),
  gain INTEGER NOT NULL CHECK (gain >= 0),
  level TEXT NOT NULL,
  description TEXT NOT NULL,
  path_json TEXT NOT NULL CHECK (json_valid(path_json)),
  elevation_json TEXT NOT NULL CHECK (json_valid(elevation_json))
);

CREATE TABLE IF NOT EXISTS waypoints (
  id TEXT PRIMARY KEY,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Start', 'Water', 'Camp', 'Scenic')),
  km REAL NOT NULL CHECK (km >= 0),
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS hike_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL REFERENCES trails(id),
  distance_km REAL NOT NULL CHECK (distance_km > 0),
  duration_secs INTEGER NOT NULL CHECK (duration_secs >= 0),
  started_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hike_logs_user_started
  ON hike_logs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_waypoints_trail_km
  ON waypoints(trail_id, km);

INSERT OR IGNORE INTO trails
  (id, name, area, km, gain, level, description, path_json, elevation_json)
VALUES
  (
    '1', 'Osmeña Peak', 'Dalaguete, Cebu', 3.2, 420, 'Easy',
    'Short climb to the highest point in Cebu with sweeping ridge views.',
    '[{"latitude":9.8212,"longitude":123.4264},{"latitude":9.8235,"longitude":123.4278},{"latitude":9.8257,"longitude":123.4285},{"latitude":9.8274,"longitude":123.4298},{"latitude":9.8292,"longitude":123.4311}]',
    '[20,35,50,60,75,90,100,95]'
  ),
  (
    '2', 'Tabunan Forest Trail', 'Cebu City', 7.5, 780, 'Moderate',
    'Forest loop with river crossings and a rest camp midway.',
    '[{"latitude":10.3951,"longitude":123.7538},{"latitude":10.3962,"longitude":123.7552},{"latitude":10.3971,"longitude":123.7567},{"latitude":10.3982,"longitude":123.7576},{"latitude":10.3995,"longitude":123.7562}]',
    '[30,45,40,65,80,70,90,60]'
  ),
  (
    '3', 'Casino Peak Ridge', 'Badian, Cebu', 11.8, 1240, 'Hard',
    'Long exposed ridge walk. Start early and carry extra water.',
    '[{"latitude":9.8178,"longitude":123.4148},{"latitude":9.8195,"longitude":123.4162},{"latitude":9.8212,"longitude":123.4179},{"latitude":9.8228,"longitude":123.4193},{"latitude":9.8245,"longitude":123.4211}]',
    '[25,55,85,70,100,95,110,100]'
  );

INSERT OR IGNORE INTO waypoints (id, trail_id, name, type, km, lat, lng) VALUES
  ('1-start', '1', 'Trailhead', 'Start', 0, 9.8212, 123.4264),
  ('1-water', '1', 'Water station', 'Water', 1.1, 9.8241, 123.4281),
  ('1-summit', '1', 'Summit view', 'Scenic', 3.2, 9.8292, 123.4311),
  ('2-start', '2', 'Trailhead', 'Start', 0, 10.3951, 123.7538),
  ('2-water', '2', 'River crossing', 'Water', 2.4, 10.3971, 123.7567),
  ('2-camp', '2', 'Camp site', 'Camp', 4.8, 10.3995, 123.7562),
  ('2-lookout', '2', 'Lookout', 'Scenic', 6.9, 10.3982, 123.7576),
  ('3-start', '3', 'Trailhead', 'Start', 0, 9.8178, 123.4148),
  ('3-camp', '3', 'Rest hut', 'Camp', 3.5, 9.8212, 123.4179),
  ('3-viewpoint', '3', 'Ridge viewpoint', 'Scenic', 8.2, 9.8228, 123.4193),
  ('3-summit', '3', 'Summit', 'Scenic', 11.8, 9.8245, 123.4211);
