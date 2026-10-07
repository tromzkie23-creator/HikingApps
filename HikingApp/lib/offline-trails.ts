import type { Trail } from './theme';

const OFFLINE_TRAILS: Trail[] = [
  {
    id: '1',
    name: 'Osmeña Peak',
    area: 'Dalaguete, Cebu',
    latitude: 9.8212,
    longitude: 123.4264,
    path: [
      { latitude: 9.8212, longitude: 123.4264 },
      { latitude: 9.8235, longitude: 123.4278 },
      { latitude: 9.8257, longitude: 123.4285 },
      { latitude: 9.8274, longitude: 123.4298 },
      { latitude: 9.8292, longitude: 123.4311 },
    ],
    km: 3.2,
    gain: 420,
    hrs: '2h',
    level: 'Easy',
    desc: 'Short climb to the highest point in Cebu with sweeping ridge views.',
    elev: [20, 35, 50, 60, 75, 90, 100, 95],
    wps: [
      { name: 'Trailhead', type: 'Start', km: 0, coordinate: { latitude: 9.8212, longitude: 123.4264 } },
      { name: 'Water station', type: 'Water', km: 1.1, coordinate: { latitude: 9.8241, longitude: 123.4281 } },
      { name: 'Summit view', type: 'Scenic', km: 3.2, coordinate: { latitude: 9.8292, longitude: 123.4311 } },
    ],
  },
  {
    id: '2',
    name: 'Tabunan Forest Trail',
    area: 'Cebu City',
    latitude: 10.3951,
    longitude: 123.7538,
    path: [
      { latitude: 10.3951, longitude: 123.7538 },
      { latitude: 10.3962, longitude: 123.7552 },
      { latitude: 10.3971, longitude: 123.7567 },
      { latitude: 10.3982, longitude: 123.7576 },
      { latitude: 10.3995, longitude: 123.7562 },
    ],
    km: 7.5,
    gain: 780,
    hrs: '5h',
    level: 'Moderate',
    desc: 'Forest loop with river crossings and a rest camp midway.',
    elev: [30, 45, 40, 65, 80, 70, 90, 60],
    wps: [
      { name: 'Trailhead', type: 'Start', km: 0, coordinate: { latitude: 10.3951, longitude: 123.7538 } },
      { name: 'River crossing', type: 'Water', km: 2.4, coordinate: { latitude: 10.3971, longitude: 123.7567 } },
      { name: 'Camp site', type: 'Camp', km: 4.8, coordinate: { latitude: 10.3995, longitude: 123.7562 } },
      { name: 'Lookout', type: 'Scenic', km: 6.9, coordinate: { latitude: 10.3982, longitude: 123.7576 } },
    ],
  },
  {
    id: '3',
    name: 'Casino Peak Ridge',
    area: 'Badian, Cebu',
    latitude: 9.8178,
    longitude: 123.4148,
    path: [
      { latitude: 9.8178, longitude: 123.4148 },
      { latitude: 9.8195, longitude: 123.4162 },
      { latitude: 9.8212, longitude: 123.4179 },
      { latitude: 9.8228, longitude: 123.4193 },
      { latitude: 9.8245, longitude: 123.4211 },
    ],
    km: 11.8,
    gain: 1240,
    hrs: '7h',
    level: 'Hard',
    desc: 'Long exposed ridge walk. Start early and carry extra water.',
    elev: [25, 55, 85, 70, 100, 95, 110, 100],
    wps: [
      { name: 'Trailhead', type: 'Start', km: 0, coordinate: { latitude: 9.8178, longitude: 123.4148 } },
      { name: 'Rest hut', type: 'Camp', km: 3.5, coordinate: { latitude: 9.8212, longitude: 123.4179 } },
      { name: 'Ridge viewpoint', type: 'Scenic', km: 8.2, coordinate: { latitude: 9.8228, longitude: 123.4193 } },
    ],
  },
];

export function getOfflineTrails() {
  return OFFLINE_TRAILS;
}

export function getOfflineTrail(id: string) {
  return OFFLINE_TRAILS.find((trail) => trail.id === id) ?? null;
}
