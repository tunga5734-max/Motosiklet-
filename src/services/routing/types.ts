import type { CarRoute, LatLng } from '../../types';

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  alternatives: boolean;
  avoidHighways: boolean;
  avoidTolls: boolean;
  departure?: Date;
}

export interface RoutingProvider {
  name: string;
  getRoutes(req: RouteRequest, signal?: AbortSignal): Promise<CarRoute[]>;
}
