PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
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
  trail_id TEXT REFERENCES trails(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  distance_km REAL NOT NULL CHECK (distance_km > 0),
  duration_secs INTEGER NOT NULL CHECK (duration_secs >= 0),
  path_json TEXT CHECK (path_json IS NULL OR json_valid(path_json)),
  waypoints_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(waypoints_json)),
  started_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

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

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  place_name TEXT NOT NULL,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  suggest_hike INTEGER NOT NULL DEFAULT 0 CHECK (suggest_hike IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  hike_id TEXT REFERENCES hike_logs(id) ON DELETE SET NULL,
  hike_distance_km REAL,
  hike_duration_secs INTEGER,
  hike_elevation_gain_m INTEGER,
  hike_path_json TEXT CHECK (hike_path_json IS NULL OR json_valid(hike_path_json)),
  hide_endpoints INTEGER NOT NULL DEFAULT 1 CHECK (hide_endpoints IN (0, 1))
);

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

CREATE INDEX IF NOT EXISTS idx_hike_logs_user_started
  ON hike_logs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_waypoints_trail_km
  ON waypoints(trail_id, km);
CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_trail_created
  ON reviews(trail_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
  ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_photos_post_position
  ON post_photos(post_id, position);
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id
  ON post_reports(post_id, created_at);

DELETE FROM trails
WHERE id IN ('1', '2', '3')
  AND NOT EXISTS (
    SELECT 1 FROM hike_logs WHERE hike_logs.trail_id = trails.id
  );

-- Route distances, elevation gains, and trail/waypoint coordinates are approximate.
INSERT OR IGNORE INTO trails
  (id, name, area, km, gain, level, description, path_json, elevation_json)
VALUES
  (
    'ph-mt-pulag', 'Mt. Pulag (Ambangeg Trail)', 'Kabayan, Benguet Province, Luzon, Philippines', 8, 850, 'Moderate',
    'A high-altitude grassland climb to Luzon''s highest summit. Route distance, elevation gain, and waypoint coordinates are approximate; register and check current park, weather, and permit requirements.',
    '[{"latitude":16.589,"longitude":120.9},{"latitude":16.576,"longitude":120.904},{"latitude":16.5635,"longitude":120.901},{"latitude":16.5535,"longitude":120.898}]',
    '[0,300,620,850]'
  ),
  (
    'ph-mt-batulao', 'Mt. Batulao', 'Nasugbu, Batangas Province, Luzon, Philippines', 8, 600, 'Moderate',
    'A rolling grassland ridge hike with open views of the Batangas countryside. Route distance, elevation gain, and waypoint coordinates are approximate; check land access, registration, and weather before hiking.',
    '[{"latitude":14.095,"longitude":120.779},{"latitude":14.091,"longitude":120.78},{"latitude":14.088,"longitude":120.776},{"latitude":14.093,"longitude":120.774}]',
    '[0,180,420,600]'
  ),
  (
    'ph-pico-de-loro', 'Mt. Pico de Loro', 'Maragondon, Cavite Province, Luzon, Philippines', 7.5, 650, 'Hard',
    'A forested ascent in the Mounts Palay-Palay-Mataas-na-Gulod Protected Landscape, ending at the distinctive summit. Route distance, elevation gain, and waypoint coordinates are approximate; follow current protected-area rules.',
    '[{"latitude":14.2025,"longitude":120.6345},{"latitude":14.204,"longitude":120.637},{"latitude":14.206,"longitude":120.639},{"latitude":14.206,"longitude":120.64}]',
    '[0,180,430,650]'
  ),
  (
    'ph-mt-ulap', 'Mt. Ulap Eco-Trail', 'Itogon, Benguet Province, Luzon, Philippines', 8, 650, 'Moderate',
    'A scenic Cordillera ridge walk passing grassland viewpoints and pine-covered slopes. Route distance, elevation gain, and waypoint coordinates are approximate; use the local registration and guide system.',
    '[{"latitude":16.348,"longitude":120.592},{"latitude":16.342,"longitude":120.59},{"latitude":16.338,"longitude":120.586},{"latitude":16.332,"longitude":120.582}]',
    '[0,220,450,650]'
  ),
  (
    'ph-osmena-peak', 'Osmeña Peak', 'Dalaguete, Cebu Province, Visayas, Philippines', 3.2, 420, 'Easy',
    'A short climb to Cebu''s highest peak, known for its jagged green hills and sea views. Route distance, elevation gain, and waypoint coordinates are approximate; confirm local access and weather.',
    '[{"latitude":9.8212,"longitude":123.4264},{"latitude":9.8241,"longitude":123.4281},{"latitude":9.8274,"longitude":123.4298},{"latitude":9.8292,"longitude":123.4311}]',
    '[0,120,280,420]'
  ),
  (
    'ph-kawasan-canyon', 'Kawasan Falls Canyon Trail', 'Badian, Cebu Province, Visayas, Philippines', 5, 300, 'Hard',
    'A river-and-waterfall canyoning route near Kawasan Falls, not a self-guided hike. Route distance, elevation gain, and waypoint coordinates are approximate; go only with an accredited guide and required safety gear and permits.',
    '[{"latitude":9.8063,"longitude":123.378},{"latitude":9.804,"longitude":123.377},{"latitude":9.801,"longitude":123.375},{"latitude":9.798,"longitude":123.374}]',
    '[0,100,220,300]'
  ),
  (
    'ph-mt-manunggal', 'Mt. Manunggal', 'Balamban, Cebu Province, Visayas, Philippines', 7, 650, 'Moderate',
    'A forested upland hike to a Cebu mountain campsite and historic memorial area. Route distance, elevation gain, and waypoint coordinates are approximate; check local access and conditions.',
    '[{"latitude":10.4735,"longitude":123.716},{"latitude":10.477,"longitude":123.717},{"latitude":10.48,"longitude":123.717},{"latitude":10.483,"longitude":123.718}]',
    '[0,180,430,650]'
  ),
  (
    'ph-mt-apo', 'Mt. Apo', 'Davao del Sur / Cotabato Provinces, Mindanao, Philippines', 22, 2100, 'Hard',
    'A demanding multi-day ascent of the Philippines'' highest mountain through forest and volcanic terrain. Route distance, elevation gain, and waypoint coordinates are approximate; use an authorized route and secure current permits and a local guide.',
    '[{"latitude":6.987,"longitude":125.271},{"latitude":6.992,"longitude":125.275},{"latitude":6.996,"longitude":125.279},{"latitude":7.001,"longitude":125.282}]',
    '[0,650,1400,2100]'
  ),
  (
    'ph-mt-hamiguitan', 'Mt. Hamiguitan', 'San Isidro, Davao Oriental Province, Mindanao, Philippines', 13, 1100, 'Hard',
    'A steep climb through the mountain sanctuary''s distinctive mossy and pygmy forest. Route distance, elevation gain, and waypoint coordinates are approximate; hike only on an authorized route with sanctuary permits and local guidance.',
    '[{"latitude":6.724,"longitude":126.17},{"latitude":6.729,"longitude":126.175},{"latitude":6.733,"longitude":126.181},{"latitude":6.737,"longitude":126.186}]',
    '[0,350,760,1100]'
  );

INSERT OR IGNORE INTO waypoints (id, trail_id, name, type, km, lat, lng) VALUES
  ('ph-mt-pulag-start', 'ph-mt-pulag', 'Ambangeg trailhead', 'Start', 0, 16.589, 120.9),
  ('ph-mt-pulag-camp', 'ph-mt-pulag', 'Camp 1', 'Camp', 2.5, 16.576, 120.904),
  ('ph-mt-pulag-forest', 'ph-mt-pulag', 'Mossy forest edge', 'Scenic', 5, 16.5635, 120.901),
  ('ph-mt-pulag-summit', 'ph-mt-pulag', 'Pulag summit', 'Scenic', 8, 16.5535, 120.898),
  ('ph-mt-batulao-start', 'ph-mt-batulao', 'Trailhead', 'Start', 0, 14.095, 120.779),
  ('ph-mt-batulao-ridge', 'ph-mt-batulao', 'First ridge', 'Scenic', 2, 14.091, 120.78),
  ('ph-mt-batulao-rest', 'ph-mt-batulao', 'Rest area', 'Water', 4.5, 14.088, 120.776),
  ('ph-mt-batulao-summit', 'ph-mt-batulao', 'Batulao summit', 'Scenic', 8, 14.093, 120.774),
  ('ph-pico-de-loro-start', 'ph-pico-de-loro', 'DENR trailhead', 'Start', 0, 14.2025, 120.6345),
  ('ph-pico-de-loro-rest', 'ph-pico-de-loro', 'Forest rest stop', 'Camp', 2.2, 14.204, 120.637),
  ('ph-pico-de-loro-junction', 'ph-pico-de-loro', 'Summit junction', 'Scenic', 5.5, 14.206, 120.639),
  ('ph-pico-de-loro-summit', 'ph-pico-de-loro', 'Pico de Loro summit', 'Scenic', 7.5, 14.206, 120.64),
  ('ph-mt-ulap-start', 'ph-mt-ulap', 'Ampucao trailhead', 'Start', 0, 16.348, 120.592),
  ('ph-mt-ulap-viewpoint', 'ph-mt-ulap', 'Gungal Rock viewpoint', 'Scenic', 2.4, 16.342, 120.59),
  ('ph-mt-ulap-camp', 'ph-mt-ulap', 'Camp site', 'Camp', 5, 16.338, 120.586),
  ('ph-mt-ulap-summit', 'ph-mt-ulap', 'Mt. Ulap summit', 'Scenic', 8, 16.332, 120.582),
  ('ph-osmena-peak-start', 'ph-osmena-peak', 'Mantalungon trailhead', 'Start', 0, 9.8212, 123.4264),
  ('ph-osmena-peak-rest', 'ph-osmena-peak', 'Rest stop', 'Water', 1.1, 9.8241, 123.4281),
  ('ph-osmena-peak-ridge', 'ph-osmena-peak', 'Ridge viewpoint', 'Scenic', 2.2, 9.8274, 123.4298),
  ('ph-osmena-peak-summit', 'ph-osmena-peak', 'Osmeña Peak', 'Scenic', 3.2, 9.8292, 123.4311),
  ('ph-kawasan-canyon-start', 'ph-kawasan-canyon', 'Canyoning check-in', 'Start', 0, 9.8063, 123.378),
  ('ph-kawasan-canyon-river', 'ph-kawasan-canyon', 'First river section', 'Water', 1.3, 9.804, 123.377),
  ('ph-kawasan-canyon-falls', 'ph-kawasan-canyon', 'Waterfall rest area', 'Scenic', 3.2, 9.801, 123.375),
  ('ph-kawasan-canyon-exit', 'ph-kawasan-canyon', 'Kawasan Falls exit', 'Scenic', 5, 9.798, 123.374),
  ('ph-mt-manunggal-start', 'ph-mt-manunggal', 'Trailhead', 'Start', 0, 10.4735, 123.716),
  ('ph-mt-manunggal-rest', 'ph-mt-manunggal', 'Forest rest stop', 'Camp', 2, 10.477, 123.717),
  ('ph-mt-manunggal-memorial', 'ph-mt-manunggal', 'Memorial area', 'Scenic', 4.5, 10.48, 123.717),
  ('ph-mt-manunggal-camp', 'ph-mt-manunggal', 'Manunggal campsite', 'Camp', 7, 10.483, 123.718),
  ('ph-mt-apo-start', 'ph-mt-apo', 'Main trailhead', 'Start', 0, 6.987, 125.271),
  ('ph-mt-apo-camp', 'ph-mt-apo', 'Forest camp', 'Camp', 6, 6.992, 125.275),
  ('ph-mt-apo-boulder', 'ph-mt-apo', 'Boulder section', 'Scenic', 14, 6.996, 125.279),
  ('ph-mt-apo-summit', 'ph-mt-apo', 'Apo summit area', 'Scenic', 22, 7.001, 125.282),
  ('ph-mt-hamiguitan-start', 'ph-mt-hamiguitan', 'Authorized trailhead', 'Start', 0, 6.724, 126.17),
  ('ph-mt-hamiguitan-rest', 'ph-mt-hamiguitan', 'Forest rest stop', 'Camp', 3.5, 6.729, 126.175),
  ('ph-mt-hamiguitan-forest', 'ph-mt-hamiguitan', 'Mossy forest', 'Scenic', 8, 6.733, 126.181),
  ('ph-mt-hamiguitan-summit', 'ph-mt-hamiguitan', 'Summit zone', 'Scenic', 13, 6.737, 126.186);
