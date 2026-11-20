import { describe, expect, it, vi } from "vitest";
import { geocode, parseOsrm, ProviderError, providerDiagnostics, routeOsrm } from "../src/providers.js";

const o = { lat: -21.7642, lon: -43.3496, label: "Juiz de Fora" };
const d = { lat: -22.1167, lon: -43.2096, label: "Três Rios" };
const validRoute = { code: "Ok", routes: [{
  distance: 48000, duration: 3200,
  geometry: { type: "LineString", coordinates: [[-43.3496, -21.7642], [-43.2096, -22.1167]] },
}] };
const mock = (result: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(result), { status })) as unknown as typeof fetch;

describe("provedores de geocodificação e roteamento", () => {
  it("interpreta uma rota OSRM válida com métricas e GeoJSON", async () => {
    const route = await routeOsrm(o, d, mock(validRoute));
    expect(route.distance).toBe(48000);
    expect(route.geometry.coordinates).toHaveLength(2);
  });

  it("distingue NoRoute de falha de rede", () => {
    expect(() => parseOsrm({ code: "NoRoute" })).toThrowError(ProviderError);
    try { parseOsrm({ code: "NoRoute" }); } catch (error) {
      expect((error as ProviderError).code).toBe("ROUTE_NOT_FOUND");
    }
  });

  it.each([
    { code: "Ok", routes: [] },
    { code: "Ok", routes: [{ distance: 4, duration: 2, geometry: { type: "LineString", coordinates: [[2, 2]] } }] },
    { code: "Ok", routes: [{ distance: -4, duration: 2, geometry: { type: "LineString", coordinates: [[2, 2], [3, 3]] } }] },
    { code: "Ok", routes: [{ distance: 4, duration: 2, geometry: { type: "LineString", coordinates: [[200, 2], [3, 3]] } }] },
    { code: "InvalidQuery" },
  ])("rejeita resposta sem rota ou geometria válida", data => {
    expect(() => parseOsrm(data)).toThrowError(ProviderError);
  });

  it("identifica erro HTTP e limitação de consultas", async () => {
    await expect(routeOsrm(o, d, mock({}, 503))).rejects.toMatchObject({ code: "PROVIDER_HTTP_ERROR" });
    await expect(routeOsrm(o, d, mock({}, 429))).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED" });
  });

  it("identifica JSON inválido", async () => {
    const fetcher = vi.fn(async () => new Response("<html>erro</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(routeOsrm(o, d, fetcher)).rejects.toMatchObject({ code: "PROVIDER_INVALID_JSON" });
  });

  it("distingue erro de rede de timeout", async () => {
    const network = vi.fn(async () => { throw new TypeError("DNS error with internal details"); }) as unknown as typeof fetch;
    await expect(routeOsrm(o, d, network)).rejects.toMatchObject({ code: "PROVIDER_NETWORK_ERROR" });
    const stalled = vi.fn((_: unknown, options: RequestInit) => new Promise<Response>((_, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as unknown as typeof fetch;
    await expect(routeOsrm(o, d, stalled, 5)).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("interpreta e valida coordenadas do Nominatim", async () => {
    expect(await geocode("Juiz de Fora", mock([{lat:"-21.7642",lon:"-43.3496",display_name:"Juiz de Fora"}]))).toEqual(o);
    await expect(geocode("Não existe", mock([]))).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
    await expect(geocode("Inválida", mock([{lat:"100",lon:"-43"}]))).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("diagnostica os dois provedores sem divulgar URL ou dados internos", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("nominatim")
      ? new Response(JSON.stringify([{lat:"-21.7642",lon:"-43.3496"}]))
      : new Response(JSON.stringify(validRoute))) as unknown as typeof fetch;
    const output = await providerDiagnostics(fetcher);
    expect(output.nominatim.available).toBe(true);
    expect(output.osrm.available).toBe(true);
    expect(output.verifiedFreeFlowAvoidance).toBe(false);
  });
});
