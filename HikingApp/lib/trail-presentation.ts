import type { Trail } from './theme';

export type TrailPresentation = {
  rating: string;
  tags: string[];
  park: string;
};

const PRESENTATION: Record<string, TrailPresentation> = {
  'ph-mt-pulag': { rating: '4.9', tags: ['Summit', 'Alpine'], park: 'Mount Pulag National Park' },
  'ph-mt-batulao': { rating: '4.8', tags: ['Ridge', 'Views'], park: 'Mount Batulao' },
  'ph-pico-de-loro': { rating: '4.8', tags: ['Summit', 'Forest'], park: 'Mounts Palay-Palay–Mataas-na-Gulod Protected Landscape' },
  'ph-mt-ulap': { rating: '4.8', tags: ['Ridge', 'Views'], park: 'Mount Ulap' },
  'ph-osmena-peak': { rating: '4.9', tags: ['Ridge', 'Views'], park: 'Osmeña Peak' },
  'ph-kawasan-canyon': { rating: '4.8', tags: ['Waterfall', 'Canyoning'], park: 'Kawasan Falls' },
  'ph-mt-manunggal': { rating: '4.7', tags: ['Forest', 'History'], park: 'Mount Manunggal' },
  'ph-mt-apo': { rating: '4.9', tags: ['Summit', 'Forest'], park: 'Mount Apo Natural Park' },
  'ph-mt-hamiguitan': { rating: '4.8', tags: ['Forest', 'Wildlife'], park: 'Mount Hamiguitan Range Wildlife Sanctuary' },
};

export type TrailRegion = 'Luzon' | 'Visayas' | 'Mindanao';

export function getTrailRegion(trail: Trail): TrailRegion | null {
  const area = trail.area.toLowerCase();
  if (area.includes('luzon')) return 'Luzon';
  if (area.includes('visayas')) return 'Visayas';
  if (area.includes('mindanao')) return 'Mindanao';
  return null;
}

export function getTrailPresentation(trail: Trail): TrailPresentation {
  return PRESENTATION[trail.id] ?? { rating: '4.8', tags: ['Views'], park: trail.area };
}

export function getTrailEstimatedMinutes(trail: Trail) {
  const hours = Number.parseInt(trail.hrs, 10);
  return Number.isFinite(hours) && hours > 0 ? hours * 60 : Math.max(30, Math.round(trail.km * 35));
}

export function formatDuration(minutes: number) {
  const wholeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}
