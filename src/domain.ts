export type GantryStatus = "planned" | "installed" | "active" | "suspended" | "retired" | "unknown";
export type Direction = "northbound" | "southbound" | "eastbound" | "westbound" | "both" | "unknown";

export interface Gantry {
  id: string; road: string; kilometer?: number; latitude: number; longitude: number;
  concessionaire?: string; sourceUrl: string; observedAt: string; status: GantryStatus;
  directions: Direction[]; carriageways?: string[]; affectedEdgeIds?: string[];
  verificationStatus: "verified" | "unverified";
}
export interface RouteRequest {
  origin: string; destination: string; vehicle?: "car" | "motorcycle" | "truck" | "bus";
  avoid?: Array<"free_flow" | "all_tolls">;
}
export interface RouteResponse {
  status: "not_verified" | "no_verified_route" | "ok"; reason?: string;
  route?: { type: "Feature"; geometry: { type: "LineString"; coordinates: number[][] }; properties: Record<string, unknown> };
  metrics?: { distanceMeters?: number; durationSeconds?: number; conventionalTollEstimate?: number };
  encounteredGantryIds: string[]; avoidedGantryIds: string[]; dataTimestamp: string;
}
