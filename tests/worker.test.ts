import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker.js";

const validRoute = {
  code: "Ok", routes: [{ distance: 48123, duration: 3400,
    geometry: { type: "LineString", coordinates: [[-43.3496, -21.7642], [-43.2096, -22.1167]] },
  }],
};
const post = (body: unknown) => worker.fetch(new Request("https://boaestrada.example/api/routes", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));
const origin = { lat: -21.7642, lon: -43.3496 };
const destination = { lat: -22.1167, lon: -43.2096 };

afterEach(() => vi.unstubAllGlobals());

describe("Worker - rota principal", () => {
  it("retorna rota original com GeoJSON e sem alegar desvio Free Flow", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(validRoute)));
    vi.stubGlobal("fetch", fetcher);
    const response = await post({ origin, destination, avoid: ["free_flow"] });
    const result = await response.json() as any;
    expect(response.status).toBe(200);
    expect(result.route.metrics.distanceKm).toBeCloseTo(48.12, 2);
    expect(result.route.geometry.coordinates).toHaveLength(2);
    expect(result.route.waypoints).toEqual([]);
    expect(result.status).toBe("not_verified");
    expect(result.validation.freeFlowAvoidance).toBe(false);
    expect(result.links.googleMaps).not.toContain("-22.0085625");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("consulta Nominatim com nomes e depois OSRM", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("nominatim")) {
        const isOrigin = url.includes("Juiz");
        return new Response(JSON.stringify([{
          lat: isOrigin ? "-21.7642" : "-22.1167",
          lon: isOrigin ? "-43.3496" : "-43.2096",
          display_name: isOrigin ? "Juiz de Fora" : "Três Rios",
        }]));
      }
      return new Response(JSON.stringify(validRoute));
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await (await post({ origin: "Juiz de Fora, MG", destination: "Três Rios, RJ", avoid: ["free_flow"] })).json() as any;
    expect(result.status).toBe("not_verified");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("retorna erro discriminado quando OSRM falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));
    const response = await post({ origin, destination, avoid: ["free_flow"] });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "PROVIDER_HTTP_ERROR", provider: "osrm" });
  });

  it("não expõe exceções internas de DNS ao cliente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("secret hostname connection failed"); }));
    const response = await post({ origin, destination });
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret hostname");
  });

  it("rejeita JSON e coordenadas inválidos", async () => {
    const malformed = await worker.fetch(new Request("https://boaestrada.example/api/routes", {
      method: "POST", body: "not json",
    }));
    expect(malformed.status).toBe(400);
    expect((await post({ origin: { lat: NaN, lon: -43 }, destination })).status).toBe(400);
    expect((await post({ origin, destination, avoid: ["all_tolls"] })).status).toBe(400);
  });

  it("mantém engrenagem na página inicial e laboratório isolado", async () => {
    const main = await (await worker.fetch(new Request("https://boaestrada.example/"))).text();
    const lab = await (await worker.fetch(new Request("https://boaestrada.example/manutencao"))).text();
    expect(main).toContain('href="/manutencao"');
    expect(main).toContain("Calcular rota");
    expect(lab).toContain("auto-waypoint");
  });

  it("mostra saúde do Worker sem confundir com provedores", async () => {
    const response = await worker.fetch(new Request("https://boaestrada.example/health"));
    expect(response.status).toBe(200);
    expect((await response.json() as any).note).toContain("Worker");
  });
});
