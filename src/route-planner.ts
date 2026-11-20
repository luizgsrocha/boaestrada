import type { VirtualBarrier } from "./barrier-routing.js";
import { buildBypassCandidates, routeCrossesBarriers } from "./barrier-routing.js";

export type RouteCandidate = { coordinates: Array<[number, number]>; distanceMeters?: number; durationSeconds?: number; waypoints?: Array<[number, number]> };

export type RouteProvider = (waypoints: Array<[number, number]>) => Promise<RouteCandidate | null>;

export async function planRoute(
  origin: [number, number],
  destination: [number, number],
  barriers: VirtualBarrier[],
  provider: RouteProvider,
): Promise<{ status: "ok" | "not_verified" | "no_verified_route"; route: RouteCandidate | null; reason?: string }> {
  const direct = await provider([origin, destination]);
  if (!direct) return { status: "no_verified_route", route: null, reason: "ROUTING_PROVIDER_UNAVAILABLE" };
  const crossed = routeCrossesBarriers(direct.coordinates, barriers);
  if (!crossed.length) return { status: "ok", route: direct };
  const candidates = buildBypassCandidates(crossed);
  const alternatives = await Promise.all(candidates.map((candidate) => provider([origin, ...candidate.waypoints, destination])));
  const valid = alternatives.filter((r): r is RouteCandidate => r !== null && !routeCrossesBarriers(r.coordinates, barriers));
  if (!valid.length) return { status: "no_verified_route", route: null, reason: "NO_VERIFIED_BYPASS" };
  valid.sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER));
  return { status: "not_verified", route: valid[0], reason: "BYPASS_SELECTED_BUT_DATA_REQUIRES_OPERATIONAL_VERIFICATION" };
}
