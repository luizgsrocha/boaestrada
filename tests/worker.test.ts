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

  it("lista registros do Sem Parar por UF/rodovia sem inventar coordenadas", async () => {
    const response = await worker.fetch(new Request("https://boaestrada.example/api/gantries?uf=MG&road=BR-040"));
    const result = await response.json() as any;
    expect(response.status).toBe(200);
    expect(result.catalog.totalRecords).toBe(84);
    expect(result.catalog.returnedRecords).toBe(1);
    expect(result.catalog.records[0]).toMatchObject({road:"BR-040",state:"MG",municipality:"Simão Pereira",reportedStatus:"ativo",latitude:null,longitude:null});
    expect(result.catalog.geolocatedRecords).toBe(0);
    expect(result.verificationStatus).toBe("pilot");
  });

  it("preserva distinção entre dados nacionais e pórticos cruzados na rota", async () => {
    vi.stubGlobal("fetch", vi.fn(async()=>new Response(JSON.stringify(validRoute))));
    const result = await (await post({origin,destination})).json() as any;
    expect(result.gantries.catalogCoverage.totalRecords).toBe(84);
    expect(result.gantries.catalogCoverage.geolocatedRecords).toBe(0);
    expect(result.gantries.catalogCoverage.spatialMatchAvailable).toBe(false);
    expect(result.gantries.count).toBeNull();
  });

  it("lista posições publicadas separadamente do catálogo sem coordenadas do Sem Parar", async () => {
    const response=await worker.fetch(new Request("https://boaestrada.example/api/gantries?uf=MG"));
    const data=await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.catalog.totalRecords).toBe(84);
    expect(data.catalog.geolocatedRecords).toBe(0);
    expect(data.geographicCatalog.totalPositions).toBe(53);
    expect(data.geographicCatalog.returnedPositions).toBe(7);
    expect(data.geographicCatalog.coordinateStatus).toBe("reported_unverified");
    expect(data.geographicCatalog.records.every((r:any)=>r.state==="MG")).toBe(true);
  });
  it("não associa automaticamente BR-040 do Sem Parar a coordenadas sem rodovia identificada", async () => {
    const result=await (await worker.fetch(new Request("https://boaestrada.example/api/gantries?uf=MG&road=BR-040"))).json() as any;
    expect(result.catalog.returnedRecords).toBe(1);
    expect(result.geographicCatalog.returnedPositions).toBe(0);
  });
  it("detecta posição geográfica relatada pela ANTT sem alegar travessia nem cobrança", async () => {
    const route={code:"Ok",routes:[{distance:5000,duration:500,geometry:{
      type:"LineString",coordinates:[[-43.14,-19.853947],[-43.12,-19.853947]]
    }}]};
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify(route))));
    const data=await(await post({origin,destination})).json() as any;
    expect(data.gantries.candidates.some((c:any)=>c.label.includes("João Monlevade"))).toBe(true);
    expect(data.gantries.candidates.find((c:any)=>c.label.includes("João Monlevade")).verificationStatus).toBe("reported");
    expect(data.gantries.count).toBeNull();
    expect(data.status).toBe("not_verified");
  });

  it("retorna candidatos no trajeto sem alegar contagem confirmada", async () => {
    const mockRoute={code:"Ok",routes:[{distance:3000,duration:180,geometry:{
      type:"LineString",coordinates:[[-43.28,-22.0085625],[-43.26,-22.0085625]]
    }}]};
    vi.stubGlobal("fetch", vi.fn(async()=>new Response(JSON.stringify(mockRoute))));
    const result=await (await post({origin,destination,avoid:["free_flow"]})).json() as any;
    expect(result.gantries.candidatesCount).toBe(1);
    expect(result.gantries.candidates[0].id).toBe("xprj-hf-simao-pereira");
    expect(result.gantries.count).toBeNull();
    expect(result.gantries.coverage).toBe("incomplete");
    expect(result.validation.freeFlowAvoidance).toBe(false);
    expect(result.route.waypoints).toEqual([]);
  });

  it("responde com zero candidatos conhecidos mas sem afirmar zero pórticos reais", async () => {
    vi.stubGlobal("fetch", vi.fn(async()=>new Response(JSON.stringify(validRoute))));
    const result=await (await post({origin,destination})).json() as any;
    expect(result.gantries.candidatesCount).toBe(0);
    expect(result.gantries.count).toBeNull();
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

  it("mostra painel de resultados acessível com métricas e sem alegações sem prova", async () => {
    const html = await (await worker.fetch(new Request("https://boaestrada.example/"))).text();
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Pórticos Free Flow evitados");
    expect(html).toContain("Economia em Free Flow");
    expect(html).toContain("Rota original — Free Flow não verificado");
    expect(html).toContain("renderRoutePanel(r,j)");
    expect(html).not.toContain('r.innerHTML="<b>"');
  });

  it("mostra saúde do Worker sem confundir com provedores", async () => {
    const response = await worker.fetch(new Request("https://boaestrada.example/health"));
    expect(response.status).toBe(200);
    expect((await response.json() as any).note).toContain("Worker");
  });
  it("oferece alternativa sem afirmar desvio do Free Flow quando o provedor falha", async () => {
    const html = await (await worker.fetch(new Request("https://boaestrada.example/"))).text();
    expect(html).toContain("Abrir rota comum no Google Maps");
    expect(html).toContain("NÃO garante evitar pedágios Free Flow");
    expect(html).toContain("encodeURIComponent(o.value.trim())");
    expect(html).toContain('link.rel="noopener noreferrer"');
  });

});
