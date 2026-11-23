import { geographicCandidates, GEO_SOURCE, GEO_LICENSE } from "./geo-candidates.js";

// Espelho do registro piloto em data/free-flow-xprj-hf.json.
// Wrangler v3 não aceita importação JSON com atributos; o teste garante sincronia.

export interface GantryCandidate {
  id: string;
  label: string;
  road: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  verificationStatus: "pilot" | "reported" | "verified";
  operatingStatus: "unknown" | "active" | "inactive";
  source?: string;
  sourceLicense?: string;
}

// Cadastro disponível na produção: um único ponto piloto, sem comprovação de
// coordenada, trecho de cobrança, operação nem pertencimento à pista.
export const pilotGantry: GantryCandidate = {
  id: "xprj-hf-simao-pereira",
  label: "Ponto Free Flow XPRJ+HF",
  road: "BR-040",
  latitude: -22.0085625,
  longitude: -43.2688125,
  radiusMeters: 150,
  verificationStatus: "pilot",
  operatingStatus: "unknown",
};

// As posições da ANTT são relatadas por um repositório intermediário; só
// podem gerar candidatos, jamais declarar rota tarifada ou sem cobrança.
export const geographicGantryCandidates: readonly GantryCandidate[] = geographicCandidates.map(item=>({
  id: item.id,
  label: item.labels[0] ?? "Ponto Free Flow",
  road: "Rodovia não verificada",
  latitude: item.latitude,
  longitude: item.longitude,
  radiusMeters: 150,
  verificationStatus: "reported",
  operatingStatus: "unknown",
  source: GEO_SOURCE,
  sourceLicense: GEO_LICENSE,
}));
export const routeGantryCandidateCatalog: readonly GantryCandidate[] = [pilotGantry, ...geographicGantryCandidates];

type Coordinate = [number, number]; // [longitude, latitude]
export interface CandidateMatch {
  id: string;
  label: string;
  road: string;
  location: { lat: number; lon: number };
  distanceFromRouteMeters: number;
  verificationStatus: "pilot" | "verified";
  detection: "segment_proximity";
  source?: string;
  sourceLicense?: string;
}
export interface GantryDetection {
  count: null; // Sem arestas tarifadas e inventário completo, o número real é desconhecido.
  candidatesCount: number;
  candidates: CandidateMatch[];
  coverage: "incomplete";
  matchingMethod: "segment_proximity";
  note: string;
}

const RAD = Math.PI / 180;
const EARTH_RADIUS_METERS = 6371000;

function validCoordinate(coordinate: Coordinate): boolean {
  return coordinate.length === 2 &&
    Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]) &&
    coordinate[0] >= -180 && coordinate[0] <= 180 &&
    coordinate[1] >= -90 && coordinate[1] <= 90;
}

// Distância ponto-segmento num plano local em metros. Ao contrário de verificar
// apenas vértices da polyline, detecta um pórtico próximo ao meio de um segmento.
// Proximidade NÃO equivale a cruzamento da aresta de cobrança (vias paralelas etc.).
function distanceToSegmentMeters(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const latRad = p[1] * RAD;
  const cosLat = Math.cos(latRad);
  const toX = (lon: number) => (lon - p[0]) * RAD * EARTH_RADIUS_METERS * cosLat;
  const toY = (lat: number) => (lat - p[1]) * RAD * EARTH_RADIUS_METERS;
  const ax = toX(a[0]), ay = toY(a[1]);
  const bx = toX(b[0]), by = toY(b[1]);
  const dx = bx - ax, dy = by - ay;
  const t = dx * dx + dy * dy > 0
    ? Math.max(0, Math.min(1, (-ax * dx - ay * dy) / (dx * dx + dy * dy)))
    : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function detectGantryCandidates(
  coordinates: Coordinate[],
  catalog: readonly GantryCandidate[] = routeGantryCandidateCatalog,
): GantryDetection {
  const candidates: CandidateMatch[] = [];
  const seen = new Set<string>();
  const validRoute = Array.isArray(coordinates) && coordinates.length >= 2 &&
    coordinates.every(validCoordinate);
  if (validRoute) {
    for (const gantry of catalog) {
      if (seen.has(gantry.id) || gantry.operatingStatus === "inactive" ||
          !Number.isFinite(gantry.latitude) || !Number.isFinite(gantry.longitude) ||
          !Number.isFinite(gantry.radiusMeters) || gantry.radiusMeters <= 0 ||
          Math.abs(gantry.latitude) > 90 || Math.abs(gantry.longitude) > 180) continue;
      const p: Coordinate = [gantry.longitude, gantry.latitude];
      let closest = Infinity;
      for (let i = 1; i < coordinates.length; i++) {
        closest = Math.min(closest, distanceToSegmentMeters(p, coordinates[i - 1], coordinates[i]));
      }
      if (closest > gantry.radiusMeters) continue;
      seen.add(gantry.id);
      candidates.push({
        id: gantry.id,
        label: gantry.label,
        road: gantry.road,
        location: { lat: gantry.latitude, lon: gantry.longitude },
        distanceFromRouteMeters: Math.round(closest),
        verificationStatus: gantry.verificationStatus,
        detection: "segment_proximity",
        source: gantry.source,
        sourceLicense: gantry.sourceLicense,
      });
    }
  }
  return {
    count: null,
    candidatesCount: candidates.length,
    candidates,
    coverage: "incomplete",
    matchingMethod: "segment_proximity",
    note: "Busca em posições piloto e coordenadas publicadas por fonte intermediária. A cobertura é incompleta; proximidade não comprova passagem pela pista tarifada nem cobrança. A quantidade real permanece desconhecida.",
  };
}
