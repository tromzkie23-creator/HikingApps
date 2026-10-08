import type { Trail, TrailWaypoint } from './theme';

type OfflineTrailInput = Omit<Trail, 'latitude' | 'longitude' | 'path' | 'wps'> & {
  points: {
    name: string;
    type: TrailWaypoint['type'];
    km: number;
    latitude: number;
    longitude: number;
  }[];
};

function makeOfflineTrail(input: OfflineTrailInput): Trail {
  const path = input.points.map(({ latitude, longitude }) => ({ latitude, longitude }));
  return {
    ...input,
    latitude: path[0].latitude,
    longitude: path[0].longitude,
    path,
    wps: input.points.map(({ name, type, km, latitude, longitude }) => ({
      name,
      type,
      km,
      coordinate: { latitude, longitude },
    })),
  };
}

const OFFLINE_TRAILS: Trail[] = [
  makeOfflineTrail({
    id: 'ph-mt-pulag',
    name: 'Mt. Pulag (Ambangeg Trail)',
    area: 'Kabayan, Benguet Province, Luzon, Philippines',
    km: 8,
    gain: 850,
    hrs: '5h',
    level: 'Moderate',
    desc: 'A high-altitude grassland climb to Luzon\'s highest summit. Route distance, elevation gain, and waypoint coordinates are approximate; register and check current park, weather, and permit requirements.',
    elev: [0, 300, 620, 850],
    points: [
      { name: 'Ambangeg trailhead', type: 'Start', km: 0, latitude: 16.589, longitude: 120.9 },
      { name: 'Camp 1', type: 'Camp', km: 2.5, latitude: 16.576, longitude: 120.904 },
      { name: 'Mossy forest edge', type: 'Scenic', km: 5, latitude: 16.5635, longitude: 120.901 },
      { name: 'Pulag summit', type: 'Scenic', km: 8, latitude: 16.5535, longitude: 120.898 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-mt-batulao',
    name: 'Mt. Batulao',
    area: 'Nasugbu, Batangas Province, Luzon, Philippines',
    km: 8,
    gain: 600,
    hrs: '4h',
    level: 'Moderate',
    desc: 'A rolling grassland ridge hike with open views of the Batangas countryside. Route distance, elevation gain, and waypoint coordinates are approximate; check land access, registration, and weather before hiking.',
    elev: [0, 180, 420, 600],
    points: [
      { name: 'Trailhead', type: 'Start', km: 0, latitude: 14.095, longitude: 120.779 },
      { name: 'First ridge', type: 'Scenic', km: 2, latitude: 14.091, longitude: 120.78 },
      { name: 'Rest area', type: 'Water', km: 4.5, latitude: 14.088, longitude: 120.776 },
      { name: 'Batulao summit', type: 'Scenic', km: 8, latitude: 14.093, longitude: 120.774 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-pico-de-loro',
    name: 'Mt. Pico de Loro',
    area: 'Maragondon, Cavite Province, Luzon, Philippines',
    km: 7.5,
    gain: 650,
    hrs: '5h',
    level: 'Hard',
    desc: 'A forested ascent in the Mounts Palay-Palay-Mataas-na-Gulod Protected Landscape, ending at the distinctive summit. Route distance, elevation gain, and waypoint coordinates are approximate; follow current protected-area rules.',
    elev: [0, 180, 430, 650],
    points: [
      { name: 'DENR trailhead', type: 'Start', km: 0, latitude: 14.2025, longitude: 120.6345 },
      { name: 'Forest rest stop', type: 'Camp', km: 2.2, latitude: 14.204, longitude: 120.637 },
      { name: 'Summit junction', type: 'Scenic', km: 5.5, latitude: 14.206, longitude: 120.639 },
      { name: 'Pico de Loro summit', type: 'Scenic', km: 7.5, latitude: 14.206, longitude: 120.64 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-mt-ulap',
    name: 'Mt. Ulap Eco-Trail',
    area: 'Itogon, Benguet Province, Luzon, Philippines',
    km: 8,
    gain: 650,
    hrs: '5h',
    level: 'Moderate',
    desc: 'A scenic Cordillera ridge walk passing grassland viewpoints and pine-covered slopes. Route distance, elevation gain, and waypoint coordinates are approximate; use the local registration and guide system.',
    elev: [0, 220, 450, 650],
    points: [
      { name: 'Ampucao trailhead', type: 'Start', km: 0, latitude: 16.348, longitude: 120.592 },
      { name: 'Gungal Rock viewpoint', type: 'Scenic', km: 2.4, latitude: 16.342, longitude: 120.59 },
      { name: 'Camp site', type: 'Camp', km: 5, latitude: 16.338, longitude: 120.586 },
      { name: 'Mt. Ulap summit', type: 'Scenic', km: 8, latitude: 16.332, longitude: 120.582 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-osmena-peak',
    name: 'Osmeña Peak',
    area: 'Dalaguete, Cebu Province, Visayas, Philippines',
    km: 3.2,
    gain: 420,
    hrs: '2h',
    level: 'Easy',
    desc: 'A short climb to Cebu\'s highest peak, known for its jagged green hills and sea views. Route distance, elevation gain, and waypoint coordinates are approximate; confirm local access and weather.',
    elev: [0, 120, 280, 420],
    points: [
      { name: 'Mantalungon trailhead', type: 'Start', km: 0, latitude: 9.8212, longitude: 123.4264 },
      { name: 'Rest stop', type: 'Water', km: 1.1, latitude: 9.8241, longitude: 123.4281 },
      { name: 'Ridge viewpoint', type: 'Scenic', km: 2.2, latitude: 9.8274, longitude: 123.4298 },
      { name: 'Osmeña Peak', type: 'Scenic', km: 3.2, latitude: 9.8292, longitude: 123.4311 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-kawasan-canyon',
    name: 'Kawasan Falls Canyon Trail',
    area: 'Badian, Cebu Province, Visayas, Philippines',
    km: 5,
    gain: 300,
    hrs: '4h',
    level: 'Hard',
    desc: 'A river-and-waterfall canyoning route near Kawasan Falls, not a self-guided hike. Route distance, elevation gain, and waypoint coordinates are approximate; go only with an accredited guide and required safety gear and permits.',
    elev: [0, 100, 220, 300],
    points: [
      { name: 'Canyoning check-in', type: 'Start', km: 0, latitude: 9.8063, longitude: 123.378 },
      { name: 'First river section', type: 'Water', km: 1.3, latitude: 9.804, longitude: 123.377 },
      { name: 'Waterfall rest area', type: 'Scenic', km: 3.2, latitude: 9.801, longitude: 123.375 },
      { name: 'Kawasan Falls exit', type: 'Scenic', km: 5, latitude: 9.798, longitude: 123.374 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-mt-manunggal',
    name: 'Mt. Manunggal',
    area: 'Balamban, Cebu Province, Visayas, Philippines',
    km: 7,
    gain: 650,
    hrs: '4h',
    level: 'Moderate',
    desc: 'A forested upland hike to a Cebu mountain campsite and historic memorial area. Route distance, elevation gain, and waypoint coordinates are approximate; check local access and conditions.',
    elev: [0, 180, 430, 650],
    points: [
      { name: 'Trailhead', type: 'Start', km: 0, latitude: 10.4735, longitude: 123.716 },
      { name: 'Forest rest stop', type: 'Camp', km: 2, latitude: 10.477, longitude: 123.717 },
      { name: 'Memorial area', type: 'Scenic', km: 4.5, latitude: 10.48, longitude: 123.717 },
      { name: 'Manunggal campsite', type: 'Camp', km: 7, latitude: 10.483, longitude: 123.718 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-mt-apo',
    name: 'Mt. Apo',
    area: 'Davao del Sur / Cotabato Provinces, Mindanao, Philippines',
    km: 22,
    gain: 2100,
    hrs: '14h',
    level: 'Hard',
    desc: 'A demanding multi-day ascent of the Philippines\' highest mountain through forest and volcanic terrain. Route distance, elevation gain, and waypoint coordinates are approximate; use an authorized route and secure current permits and a local guide.',
    elev: [0, 650, 1400, 2100],
    points: [
      { name: 'Main trailhead', type: 'Start', km: 0, latitude: 6.987, longitude: 125.271 },
      { name: 'Forest camp', type: 'Camp', km: 6, latitude: 6.992, longitude: 125.275 },
      { name: 'Boulder section', type: 'Scenic', km: 14, latitude: 6.996, longitude: 125.279 },
      { name: 'Apo summit area', type: 'Scenic', km: 22, latitude: 7.001, longitude: 125.282 },
    ],
  }),
  makeOfflineTrail({
    id: 'ph-mt-hamiguitan',
    name: 'Mt. Hamiguitan',
    area: 'San Isidro, Davao Oriental Province, Mindanao, Philippines',
    km: 13,
    gain: 1100,
    hrs: '9h',
    level: 'Hard',
    desc: 'A steep climb through the mountain sanctuary\'s distinctive mossy and pygmy forest. Route distance, elevation gain, and waypoint coordinates are approximate; hike only on an authorized route with sanctuary permits and local guidance.',
    elev: [0, 350, 760, 1100],
    points: [
      { name: 'Authorized trailhead', type: 'Start', km: 0, latitude: 6.724, longitude: 126.17 },
      { name: 'Forest rest stop', type: 'Camp', km: 3.5, latitude: 6.729, longitude: 126.175 },
      { name: 'Mossy forest', type: 'Scenic', km: 8, latitude: 6.733, longitude: 126.181 },
      { name: 'Summit zone', type: 'Scenic', km: 13, latitude: 6.737, longitude: 126.186 },
    ],
  }),
];

export function getOfflineTrails() {
  return OFFLINE_TRAILS;
}

export function getOfflineTrail(id: string) {
  return OFFLINE_TRAILS.find((trail) => trail.id === id) ?? null;
}
