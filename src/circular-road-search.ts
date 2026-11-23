/** Busca experimental em malha OSM. Proximidade NÃO prova ausência de cobrança.
 * O grafo inclui apenas nós compartilhados e sentidos básicos. Não verifica
 * turn restrictions (relações OSM), rampas legais ou arestas tarifadas.
 */
export type LonLat = [number, number];
export type OsmElement =
  | { type: "node"; id: number; lat: number; lon: number }
  | { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };
export interface SearchInput {
  gantry: { id: string; latitude: number; longitude: number };
  routeCoordinates: LonLat[];
  osmElements: OsmElement[];
}
export interface RoadOption {
  ringMeters: number;
  waypoints: LonLat[];
  roadNames: string[];
  detourGraphMeters: number;
  side: "left" | "right";
  connectivity: "osm_nodes_only";
}
export interface SearchResult {
  status: "candidate_found" | "no_connected_candidate" | "gantry_not_near_route";
  gantryId: string;
  ringsTested: number[];
  selectedRingMeters: number | null;
  roadsInspected: number;
  perpendicular: { left: LonLat; right: LonLat; probeMeters: number };
  alternatives: RoadOption[];
  validation: {
    legalTurnRestrictionsChecked: false;
    chargedEdgesChecked: false;
    freeFlowAvoidanceVerified: false;
    roadAccessPartiallyChecked: true;
  };
  note: string;
}
const EARTH = 6371000, RAD = Math.PI / 180;
const RINGS = [500, 1000, 2000];
const ACCESS_RESTRICTED = new Set(["no", "private", "agricultural", "forestry", "delivery", "destination"]);
const ROAD_KINDS = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "residential", "living_street", "service", "road",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
]);
const valid = (p: LonLat) => Array.isArray(p) && p.length === 2 &&
  p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
function drivable(tags: Record<string, string>): boolean {
  if (!ROAD_KINDS.has(tags.highway) || tags.area === "yes" ||
    tags.highway === "construction" || tags.foot === "designated") return false;
  for (const key of ["access", "vehicle", "motor_vehicle", "motorcar"]) {
    if (ACCESS_RESTRICTED.has(tags[key])) return false;
  }
  return tags.service !== "driveway" && tags.service !== "parking_aisle" &&
    tags.service !== "emergency_access";
}
function distanceToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const den = dx * dx + dy * dy;
  const t = den > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}
class Heap {
  items: Array<{ id: number; cost: number }> = [];
  push(x: { id: number; cost: number }) {
    const a = this.items; a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >>> 1; if (a[p].cost <= x.cost) break;
      a[i] = a[p]; i = p;
    }
    a[i] = x;
  }
  pop() {
    const a = this.items, root = a[0], last = a.pop();
    if (!a.length || !last) return root;
    let i = 0;
    for (;;) {
      let c = i * 2 + 1; if (c >= a.length) break;
      if (c + 1 < a.length && a[c + 1].cost < a[c].cost) c++;
      if (a[c].cost >= last.cost) break;
      a[i] = a[c]; i = c;
    }
    a[i] = last; return root;
  }
}
function connectedShortestPath(
  start: number, end: number,
  adj: Map<number, Array<{ to: number; meters: number; name: string; banned: boolean }>>,
  inside: Set<number>,
): { ids: number[]; meters: number; roadNames: string[] } | null {
  const q = new Heap(), scores = new Map<number, number>([[start, 0]]),
    parents = new Map<number, { prev: number; name: string }>();
  q.push({ id: start, cost: 0 });
  let steps = 0;
  while (q.items.length && steps++ < 12000) {
    const cur = q.pop()!;
    if (cur.cost !== scores.get(cur.id)) continue;
    if (cur.id === end) {
      const ids = [end], roads = new Set<string>();
      let at = end;
      while (at !== start) {
        const parent = parents.get(at); if (!parent) return null;
        if (parent.name) roads.add(parent.name);
        at = parent.prev; ids.push(at);
      }
      ids.reverse();
      return { ids, meters: cur.cost, roadNames: [...roads].slice(0, 12) };
    }
    for (const edge of adj.get(cur.id) ?? []) {
      if (edge.banned || !inside.has(edge.to)) continue;
      const next = cur.cost + edge.meters;
      if (next >= (scores.get(edge.to) ?? Infinity)) continue;
      scores.set(edge.to, next);
      parents.set(edge.to, { prev: cur.id, name: edge.name });
      q.push({ id: edge.to, cost: next });
    }
  }
  return null;
}

export function findCircularRoadCandidates(input: SearchInput): SearchResult {
  const { gantry, routeCoordinates, osmElements } = input;
  if (!gantry || !Number.isFinite(gantry.latitude) || !Number.isFinite(gantry.longitude) ||
      Math.abs(gantry.latitude) > 90 || Math.abs(gantry.longitude) > 180 ||
      !Array.isArray(routeCoordinates) || routeCoordinates.length < 2 ||
      routeCoordinates.length > 2000 || !routeCoordinates.every(valid) ||
      !Array.isArray(osmElements) || osmElements.length > 12000)
    throw new Error("INVALID_LAB_INPUT");
  const center: LonLat = [gantry.longitude, gantry.latitude];
  const kx = EARTH * RAD * Math.cos(gantry.latitude * RAD), ky = EARTH * RAD;
  const xy = (p: LonLat): [number, number] =>
    [(p[0] - center[0]) * kx, (p[1] - center[1]) * ky];
  const unproject = (p: [number, number]): LonLat =>
    [center[0] + p[0] / kx, center[1] + p[1] / ky];
  let closest = Infinity, tangent: [number, number] = [1, 0];
  for (let i = 1; i < routeCoordinates.length; i++) {
    const a = xy(routeCoordinates[i - 1]), b = xy(routeCoordinates[i]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1) continue;
    const distance = distanceToSegment([0, 0], a, b);
    if (distance < closest) {
      closest = distance;
      tangent = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    }
  }
  const normal: [number, number] = [-tangent[1], tangent[0]];
  const probe = 500;
  const perpendicular = {
    left: unproject([normal[0] * probe, normal[1] * probe]),
    right: unproject([-normal[0] * probe, -normal[1] * probe]),
    probeMeters: probe,
  };
  const empty = (status: SearchResult["status"], roadsInspected = 0, alternatives: RoadOption[] = []): SearchResult => ({
    status, gantryId: gantry.id, ringsTested: [...RINGS],
    selectedRingMeters: alternatives[0]?.ringMeters ?? null,
    roadsInspected, perpendicular, alternatives,
    validation: {
      legalTurnRestrictionsChecked: false,
      chargedEdgesChecked: false,
      freeFlowAvoidanceVerified: false,
      roadAccessPartiallyChecked: true,
    },
    note: "Candidatos geométricos em nós OSM: não há verificação de conversões, pistas tarifadas, condições da via ou ausência de cobrança.",
  });
  if (closest > 300) return empty("gantry_not_near_route");
  const nodes = new Map<number, { pos: [number, number]; longitude: number; latitude: number; axial: number; lateral: number }>();
  for (const el of osmElements) {
    if (el?.type !== "node" || !Number.isSafeInteger(el.id) ||
        !Number.isFinite(el.lat) || !Number.isFinite(el.lon) ||
        Math.abs(el.lat) > 90 || Math.abs(el.lon) > 180) continue;
    const [x, y] = xy([el.lon, el.lat]);
    if (Math.hypot(x, y) > 2250) continue;
    nodes.set(el.id, { pos: [x, y], longitude: el.lon, latitude: el.lat,
      axial: x * tangent[0] + y * tangent[1], lateral: x * normal[0] + y * normal[1] });
  }
  const adjacency = new Map<number, Array<{ to: number; meters: number; name: string; banned: boolean }>>();
  const add = (from: number, e: { to: number; meters: number; name: string; banned: boolean }) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(e);
  };
  let inspected = 0;
  for (const el of osmElements) {
    if (el?.type !== "way" || !Array.isArray(el.nodes) || el.nodes.length < 2 ||
        el.nodes.length > 2000 || !drivable(el.tags ?? {})) continue;
    inspected++;
    const tags = el.tags ?? {}, name = (tags.name ?? tags.ref ?? "").slice(0, 90);
    const reverse = tags.oneway === "-1", forward = reverse || ["yes", "1", "true"].includes(tags.oneway) ||
      tags.junction === "roundabout";
    for (let i = 1; i < el.nodes.length; i++) {
      const from = nodes.get(el.nodes[i - 1]), to = nodes.get(el.nodes[i]);
      if (!from || !to) continue;
      const meters = Math.hypot(from.pos[0] - to.pos[0], from.pos[1] - to.pos[1]);
      if (meters < 0.5 || meters > 2500) continue;
      const middle: [number, number] = [(from.pos[0] + to.pos[0]) / 2, (from.pos[1] + to.pos[1]) / 2];
      // Apenas heurística: evita o centro do traçado original perto do pórtico;
      // não exclui automaticamente todas as vias que passam no círculo.
      const nearGantry = distanceToSegment([0, 0], from.pos, to.pos) < 140;
      const onBaseline = routeCoordinates.some((v, j) => j > 0 &&
        distanceToSegment(middle, xy(routeCoordinates[j - 1]), xy(v)) < 45);
      const banned = nearGantry && onBaseline;
      const f = { to: el.nodes[i], meters, name, banned }, b = { to: el.nodes[i - 1], meters, name, banned };
      if (!reverse) add(el.nodes[i - 1], f);
      if (!forward || reverse) add(el.nodes[i], b);
    }
  }
  const alternatives: RoadOption[] = [];
  for (const radius of RINGS) {
    const inside = new Set<number>();
    for (const [id, n] of nodes) if (Math.hypot(...n.pos) <= radius * 1.05) inside.add(id);
    const offset = Math.max(260, radius * .5);
    const anchors = (side: -1 | 1) => [...inside]
      .filter(id => {
        const n = nodes.get(id)!;
        return n.axial * side >= offset * .65 && n.axial * side <= radius &&
          Math.abs(n.lateral) < 85 && (adjacency.get(id)?.length ?? 0) > 0;
      })
      .sort((a, b) => {
        const x = nodes.get(a)!, y = nodes.get(b)!;
        return Math.abs(x.axial * side - offset) + Math.abs(x.lateral) * 2 -
          Math.abs(y.axial * side - offset) - Math.abs(y.lateral) * 2;
      }).slice(0, 3);
    const starts = anchors(-1), ends = anchors(1);
    let best: RoadOption | null = null;
    for (const start of starts) for (const end of ends) {
      const path = connectedShortestPath(start, end, adjacency, inside);
      if (!path || path.ids.length < 3) continue;
      const ranked = path.ids.map((id, i) => ({ id, i, n: nodes.get(id)! }));
      const before = ranked.filter(p => p.n.axial < -60 && Math.abs(p.n.lateral) >= 65);
      const after = ranked.filter(p => p.n.axial > 60 && Math.abs(p.n.lateral) >= 65);
      if (!before.length || !after.length) continue;
      before.sort((a, b) => Math.abs(b.n.lateral) - Math.abs(a.n.lateral));
      after.sort((a, b) => Math.abs(b.n.lateral) - Math.abs(a.n.lateral));
      const first = before[0], second = after.find(x => x.i > first.i + 1 &&
        x.n.lateral * first.n.lateral > 0 && Math.hypot(x.n.pos[0] - first.n.pos[0], x.n.pos[1] - first.n.pos[1]) >= 75);
      if (!second) continue;
      const option: RoadOption = {
        ringMeters: radius,
        waypoints: [[first.n.longitude, first.n.latitude], [second.n.longitude, second.n.latitude]],
        roadNames: path.roadNames,
        detourGraphMeters: Math.round(path.meters),
        side: first.n.lateral > 0 ? "left" : "right",
        connectivity: "osm_nodes_only",
      };
      if (!best || option.detourGraphMeters < best.detourGraphMeters) best = option;
    }
    if (best) { alternatives.push(best); break; }
  }
  return empty(alternatives.length ? "candidate_found" : "no_connected_candidate", inspected, alternatives);
}
