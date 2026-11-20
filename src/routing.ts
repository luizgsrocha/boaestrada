import type { Direction, Gantry, RouteResponse } from "./domain.js";

export function isActiveFreeFlow(gantry: Gantry): boolean {
  return gantry.status === "active" && gantry.verificationStatus === "verified";
}
export function appliesToDirection(gantry: Gantry, direction: Direction): boolean {
  return gantry.directions.includes("both") || gantry.directions.includes("unknown") || gantry.directions.includes(direction);
}
export function validateRouteEdges(edgeIds: string[], gantries: Gantry[]): string[] {
  const edgeSet = new Set(edgeIds);
  return gantries.filter((g) => isActiveFreeFlow(g) && (g.affectedEdgeIds ?? []).some((edge) => edgeSet.has(edge))).map((g) => g.id);
}
export function unverifiedRoute(reason: string, dataTimestamp = new Date().toISOString()): RouteResponse {
  return { status: "not_verified", reason, encounteredGantryIds: [], avoidedGantryIds: [], dataTimestamp };
}
