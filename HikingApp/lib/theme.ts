export const C = {
  bg: '#F2F4EF',
  ink: '#17201A',
  spruce: '#1F3D2B',
  moss: '#6B8F4E',
  ember: '#E0603A',
  line: '#D5DBCF',
  mute: '#667267',
  white: '#fff',
};

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type TrailWaypoint = {
  name: string;
  type: 'Start' | 'Water' | 'Camp' | 'Scenic';
  km: number;
  coordinate: Coordinate;
};

export type Trail = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  path: Coordinate[];
  km: number;
  gain: number;
  hrs: string;
  level: string;
  desc: string;
  elev: number[];
  wps: TrailWaypoint[];
};
