import type { Trail } from './theme';

export type TrailPresentation = {
  rating: string;
  tags: string[];
  park: string;
};

const PRESENTATION: Record<string, TrailPresentation> = {
  '1': { rating: '4.9', tags: ['Views', 'Wildflowers'], park: 'Osmeña Peak Natural Park' },
  '2': { rating: '4.7', tags: ['Waterfall', 'Camping', 'Forest'], park: 'Tabunan Forest Reserve' },
  '3': { rating: '4.8', tags: ['Views', 'Camping', 'Ridge'], park: 'Casino Peak Nature Area' },
};

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
