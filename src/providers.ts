export type Point = { lat: number; lon: number; label: string };
export type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export type ProviderName = "nominatim" | "osrm";
export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly publicMessage: string,
  ) {
    super(code);
    this.name = "ProviderError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validCoordinate = (lon: number, lat: number): boolean =>
  Number.isFinite(lon) && Number.isFinite(lat) &&
  lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;

export function validPoint(value: unknown): value is Point {
  return isRecord(value) && typeof value.label === "string" &&
    typeof value.lat === "number" && typeof value.lon === "number" &&
    validCoordinate(value.lon, value.lat);
}

async function providerJson(
  provider: ProviderName,
  url: string,
  timeoutMs: number,
  fetcher: typeof fetch,
  headers?: HeadersInit,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers });
    if (!response.ok) {
      const code = response.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_HTTP_ERROR";
      throw new ProviderError(provider, code, 502,
        response.status === 429 ? "O provedor limitou as consultas. Tente novamente mais tarde." : "O provedor respondeu com erro HTTP.");
    }
    try {
      return await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw new ProviderError(provider, "PROVIDER_TIMEOUT", 502, "O provedor demorou mais que o limite permitido.");
      }
      throw new ProviderError(provider, "PROVIDER_INVALID_JSON", 502, "O provedor retornou JSON inválido.");
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted) {
      throw new ProviderError(provider, "PROVIDER_TIMEOUT", 502, "O provedor demorou mais que o limite permitido.");
    }
    throw new ProviderError(provider, "PROVIDER_NETWORK_ERROR", 502,
      "Não foi possível estabelecer comunicação com o provedor.");
  } finally {
    clearTimeout(timer);
  }
}

export async function geocode(query: string, fetcher: typeof fetch = fetch, timeoutMs = 8000): Promise<Point> {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&dedupe=1&addressdetails=1&countrycodes=br&accept-language=pt-BR&q=" +
    encodeURIComponent(query);
  const data = await providerJson("nominatim", url, timeoutMs, fetcher, {
    Accept: "application/json", "User-Agent": "BoaEstrada/0.4 (https://boaestrada.lgsr96.workers.dev/)",
  });
  if (!Array.isArray(data)) {
    throw new ProviderError("nominatim", "PROVIDER_INVALID_RESPONSE", 502, "Geocodificador retornou dados inesperados.");
  }
  if (data.length === 0) {
    throw new ProviderError("nominatim", "LOCATION_NOT_FOUND", 422, "Não foi possível localizar o endereço informado.");
  }
  const results = data.filter(isRecord).sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0) || Number(a.place_rank ?? 99) - Number(b.place_rank ?? 99));
  const first: unknown = results[0];
  if (!isRecord(first)) {
    throw new ProviderError("nominatim", "PROVIDER_INVALID_RESPONSE", 502, "Geocodificador retornou dados inesperados.");
  }
  const lat = Number(first.lat), lon = Number(first.lon);
  if (typeof first.lat !== "string" || typeof first.lon !== "string" || !first.lat.trim() || !first.lon.trim() || !validCoordinate(lon, lat)) {
    throw new ProviderError("nominatim", "PROVIDER_INVALID_RESPONSE", 502, "Geocodificador retornou coordenadas inválidas.");
  }
  return { lat, lon, label: typeof first.display_name === "string" ? first.display_name : query };
}

export function parseOsrm(data: unknown): OsrmRoute {
  const invalid = () => new ProviderError("osrm", "PROVIDER_INVALID_RESPONSE", 502, "Motor de rotas retornou dados incompletos ou inválidos.");
  if (!isRecord(data) || typeof data.code !== "string") throw invalid();
  if (data.code === "NoRoute") {
    throw new ProviderError("osrm", "ROUTE_NOT_FOUND", 422, "Não foi encontrada uma via dirigível entre os pontos.");
  }
  if (data.code !== "Ok") {
    throw new ProviderError("osrm", "ROUTING_PROVIDER_ERROR", 502, "O motor de rotas recusou a consulta.");
  }
  if (!Array.isArray(data.routes) || !isRecord(data.routes[0])) throw invalid();
  const route = data.routes[0];
  if (typeof route.distance !== "number" || !Number.isFinite(route.distance) || route.distance < 0 ||
      typeof route.duration !== "number" || !Number.isFinite(route.duration) || route.duration < 0 ||
      !isRecord(route.geometry) || route.geometry.type !== "LineString" ||
      !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2) throw invalid();
  const coordinates: [number, number][] = [];
  for (const value of route.geometry.coordinates) {
    if (!Array.isArray(value) || value.length !== 2 ||
        typeof value[0] !== "number" || typeof value[1] !== "number" ||
        !validCoordinate(value[0], value[1])) throw invalid();
    coordinates.push([value[0], value[1]]);
  }
  return { distance: route.distance, duration: route.duration, geometry: { type: "LineString", coordinates } };
}

export async function routeOsrm(
  origin: Point,
  destination: Point,
  fetcher: typeof fetch = fetch,
  timeoutMs = 20000,
): Promise<OsrmRoute> {
  const url = "https://router.project-osrm.org/route/v1/driving/" +
    origin.lon + "," + origin.lat + ";" + destination.lon + "," + destination.lat +
    "?overview=full&geometries=geojson";
  return parseOsrm(await providerJson("osrm", url, timeoutMs, fetcher));
}

export async function providerDiagnostics(fetcher: typeof fetch = fetch) {
  const origin: Point = { lon: -43.3496, lat: -21.7642, label: "Juiz de Fora, MG" };
  const destination: Point = { lon: -43.35, lat: -21.76, label: "Juiz de Fora, MG" };
  const run = async (provider: ProviderName, action: () => Promise<unknown>) => {
    const started = Date.now();
    try {
      await action();
      return { provider, available: true, elapsedMs: Date.now() - started };
    } catch (error) {
      return { provider, available: false, elapsedMs: Date.now() - started,
        errorCode: error instanceof ProviderError ? error.code : "PROVIDER_UNEXPECTED_ERROR" };
    }
  };
  const [nominatim, osrm] = await Promise.all([
    run("nominatim", () => geocode("Juiz de Fora, MG", fetcher)),
    run("osrm", () => routeOsrm(origin, destination, fetcher)),
  ]);
  return { nominatim, osrm, verifiedFreeFlowAvoidance: false };
}
