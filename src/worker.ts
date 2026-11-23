import { detectGantryCandidates, pilotGantry, routeGantryCandidateCatalog } from "./gantry-detection.js";
import { geographicCandidates, GEO_SOURCE, GEO_LICENSE, GEO_SOURCE_REPORTED_PRIMARY } from "./geo-candidates.js";
import { semPararCatalog, SEM_PARAR_SOURCE, SEM_PARAR_LICENSE, SEM_PARAR_SOURCE_SHA } from "./semparar-catalog.js";
import { resultPanelStyles, resultPanelScript } from "./result-panel.js";
import { autocompleteStyles, autocompleteScript } from "./autocomplete.js";
import { maintenancePage } from "./maintenance-page.js";
import { geocode, providerDiagnostics, ProviderError, routeOsrm, validPoint } from "./providers.js";
import type { Point } from "./providers.js";


const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" },
});
const point = (p: Point) => `${p.lat},${p.lon}`;
const google = (o: Point, d: Point) =>
  "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(point(o)) +
  "&destination=" + encodeURIComponent(point(d)) + "&travelmode=driving";
const page=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BoaEstrada</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui;background:linear-gradient(135deg,#083344,#0f766e 55%,#f59e0b);color:white;min-height:100vh;padding:28px}.wrap{max-width:980px;margin:auto}.brand{font-weight:800;font-size:1.3rem;margin-bottom:70px}.grid{display:grid;grid-template-columns:1fr 410px;gap:45px;align-items:center}.eyebrow{color:#fcd34d;text-transform:uppercase;letter-spacing:.15em;font-size:.75rem;font-weight:800}.title{font-size:clamp(3rem,8vw,6rem);line-height:.9;letter-spacing:-.07em;margin:18px 0}.lead{font-size:1.1rem;line-height:1.6;color:#d9f4ef}.card{background:white;color:#102a43;border-radius:22px;padding:26px;box-shadow:0 24px 70px #052e2b66}label{display:block;font-size:.8rem;font-weight:700;margin:16px 0 6px}input{width:100%;padding:13px;border:1px solid #d9e2ec;border-radius:10px;font:inherit}.check{display:flex;gap:9px;align-items:center;font-weight:400;color:#334e68}.check input{width:auto}.btn{width:100%;padding:14px;border:0;border-radius:10px;background:#f59e0b;font-weight:800;font-size:1rem;margin-top:14px;cursor:pointer}.result{display:none;margin-top:16px;padding:15px;border-radius:10px;background:#eef7f5;color:#334e68;font-size:.9rem;line-height:1.5}.result.show{display:block}.links a{display:block;text-align:center;text-decoration:none;padding:10px;border-radius:8px;color:white;background:#2563eb;font-weight:700;font-size:.8rem;margin-top:12px}@media(max-width:760px){body{padding:22px}.brand{margin-bottom:45px}.grid{grid-template-columns:1fr;gap:30px}.title{font-size:3.8rem}}.maintenance-gear{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid #ffffff88;border-radius:50%;color:#fff;text-decoration:none;background:#ffffff20;transition:background .2s}.maintenance-gear:hover,.maintenance-gear:focus-visible{background:#ffffff55;outline:2px solid #fcd34d;outline-offset:2px}.maintenance-gear svg{width:23px;height:23px}${autocompleteStyles}${resultPanelStyles}</style></head><body><div class="wrap"><div style="display:flex;align-items:flex-start;justify-content:space-between"><div class="brand">boaestrada</div><a class="maintenance-gear" href="/manutencao" aria-label="Abrir página de manutenção" title="Manutenção da API"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 2-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V21h-2.84v-.9a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2-2 .06-.06A1.7 1.7 0 0 0 7.4 15a1.7 1.7 0 0 0-1.56-1.04H5v-2.84h.84A1.7 1.7 0 0 0 7.4 10.08a1.7 1.7 0 0 0-.34-1.88L7 8.14l2-2 .06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.98 5V4h2.84v1a1.7 1.7 0 0 0 1.04 1.54 1.7 1.7 0 0 0 1.88-.34l.06-.06 2 2-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04H22v2.84h-1.04A1.7 1.7 0 0 0 19.4 15Z" transform="translate(-.4 -.5)"/></svg></a></div><div class="grid"><section><div class="eyebrow">Rotas mais inteligentes</div><h1 class="title">Evite só o Free Flow.</h1><p class="lead">O BoaEstrada consulta uma rota dirigível. Desvios de Free Flow continuam experimentais e são analisados no laboratório.</p><p style="font-size:.85rem;color:#d9f4ef;margin-top:24px">Versão do site: <a href="https://github.com/luizgsrocha/boaestrada/pull/20" style="color:inherit;text-decoration:underline" title="PR desta versão do Worker">PR #20</a></p></section><form class="card" id="f"><h2>Encontrar uma rota</h2><div class="field"><label for="o">Origem</label><input id="o" required autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="o-suggestions" placeholder="Juiz de Fora, MG"><div class="suggestions" id="o-suggestions" role="listbox" hidden></div></div><div class="field"><label for="d">Destino</label><input id="d" required autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="d-suggestions" placeholder="Três Rios, RJ"><div class="suggestions" id="d-suggestions" role="listbox" hidden></div></div><label class="check"><input id="a" type="checkbox" checked> Evitar pedágio Free Flow</label><button class="btn">Calcular rota</button><div class="result" id="r" aria-live="polite" aria-atomic="true"></div></form></div></div><script>const f=document.querySelector("#f"),r=document.querySelector("#r"),o=document.querySelector("#o"),d=document.querySelector("#d"),a=document.querySelector("#a");${autocompleteScript}${resultPanelScript}f.onsubmit=async e=>{e.preventDefault();r.className="result show";r.textContent="Calculando rota…";try{const x=await fetch("/api/routes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({origin:o.value,destination:d.value,avoid:a.checked?["free_flow"]:[]})}),j=await x.json();if(j.error)throw Error((j.message||j.error)+(j.provider?" (serviço: "+j.provider+")":"")+(j.upstreamStatus?" (HTTP "+j.upstreamStatus+")":""));renderRoutePanel(r,j)}catch(err){
  r.textContent="Não foi possível calcular: "+err.message;
  const note=document.createElement("p");
  note.textContent="Alternativa: consulte a rota comum no Google Maps. Atenção: essa opção NÃO garante evitar pedágios Free Flow.";
  r.appendChild(note);
  const link=document.createElement("a");
  link.href="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(o.value.trim())+"&destination="+encodeURIComponent(d.value.trim())+"&travelmode=driving";
  link.target="_blank";link.rel="noopener noreferrer";link.textContent="Abrir rota comum no Google Maps";
  const block=document.createElement("div");block.className="links";block.appendChild(link);r.appendChild(block);
}};</script></body></html>`;
function validLocation(value: unknown): value is Point | string {
  return (typeof value === "string" && value.trim().length > 0 && value.length <= 200) ||
    validPoint(value) ||
    (typeof value === "object" && value !== null && "lat" in value && "lon" in value &&
      typeof value.lat === "number" && typeof value.lon === "number" &&
      validPoint({ lat: value.lat, lon: value.lon, label: "" }));
}
async function resolveLocation(value: Point | string | { lat: number; lon: number; label?: string }): Promise<Point> {
  if (typeof value === "string") return geocode(value.trim());
  return { lat: value.lat, lon: value.lon, label: value.label ?? `${value.lat},${value.lon}` };
}
function safeError(error: unknown): Response {
  if (error instanceof ProviderError) {
    console.warn(JSON.stringify({ event: "provider_failure", provider: error.provider, code: error.code, upstreamStatus: error.upstreamStatus ?? null }));
    return json({ error: error.code, provider: error.provider, upstreamStatus: error.upstreamStatus ?? null, message: error.publicMessage, retryable: error.code === "PROVIDER_TIMEOUT" || error.code === "PROVIDER_NETWORK_ERROR" || error.upstreamStatus === 429 || (error.upstreamStatus !== undefined && error.upstreamStatus >= 500) }, error.httpStatus);
  }
  console.error(JSON.stringify({ event: "routing_unexpected_error" }));
  return json({ error: "INTERNAL_ERROR", message: "Erro inesperado ao calcular rota." }, 500);
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/")
      return new Response(page, { headers: { "content-type": "text/html;charset=utf-8" } });
    if (req.method === "GET" && url.pathname === "/manutencao")
      return new Response(maintenancePage, { headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store" } });
    if (req.method === "GET" && url.pathname === "/health")
      return json({ status: "ok", service: "boaestrada", note: "Verifica apenas o Worker, não os provedores." });
    if (req.method === "GET" && url.pathname === "/api/providers/health")
      return json(await providerDiagnostics());
    if (req.method === "GET" && url.pathname === "/api/gantries") {
      const uf = url.searchParams.get("uf")?.trim().toUpperCase();
      const road = url.searchParams.get("road")?.trim().toUpperCase();
      if ((uf && !/^[A-Z]{2}$/.test(uf)) || (road && !/^[A-Z]{2,3}-[0-9]{2,4}$/.test(road)))
        return json({ error: "INVALID_FILTER", message: "Filtros uf ou road inválidos." }, 400);
      const records = semPararCatalog.filter(item =>
        (!uf || item.state === uf) && (!road || item.road.toUpperCase() === road));
      const geo = geographicCandidates.filter(item => !uf || item.state === uf);
      return json({
        geographicCatalog: {source:GEO_SOURCE,reportedPrimarySource:GEO_SOURCE_REPORTED_PRIMARY,license:GEO_LICENSE,totalPositions:geographicCandidates.length,returnedPositions:road ? 0 : geo.length,coordinateStatus:"reported_unverified",records:road ? [] : geo,note:"Posições geográficas derivadas de fonte intermediária, sem rodovia/quilômetro associado e sem validação independente. Filtro road não pode ser aplicado sem dados de rodovia."},
        data: [{ id: pilotGantry.id, lat: pilotGantry.latitude, lon: pilotGantry.longitude, radius: pilotGantry.radiusMeters, road: pilotGantry.road, label: pilotGantry.label, verificationStatus: pilotGantry.verificationStatus }],
        verificationStatus: "pilot",
        catalog: {
          source: SEM_PARAR_SOURCE, license: SEM_PARAR_LICENSE, sourceSha: SEM_PARAR_SOURCE_SHA,
          totalRecords: semPararCatalog.length, returnedRecords: records.length,
          geolocatedRecords: 0, records,
          note: "Cadastro informativo. Sem coordenadas de pórticos no CSV, não é possível identificar sua passagem na rota. Registros agregados não são pórticos físicos individualizados.",
        },
        message: "Ponto piloto aguardando validação oficial. Outros registros oriundos da base Sem Parar não têm coordenadas geográficas."
      });
    }
    if (req.method === "POST" && url.pathname === "/api/routes") {
      let body: unknown;
      try { body = await req.json(); }
      catch { return json({ error: "INVALID_JSON", message: "JSON inválido." }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "INVALID_REQUEST", message: "Envie origem e destino válidos." }, 400);
      const input = body as Record<string, unknown>;
      if (!validLocation(input.origin) || !validLocation(input.destination))
        return json({ error: "INVALID_REQUEST", message: "Origem ou destino inválidos." }, 400);
      const avoid = input.avoid;
      if (avoid !== undefined && (!Array.isArray(avoid) || avoid.some(v => v !== "free_flow")))
        return json({ error: "UNSUPPORTED_AVOID_MODE", message: "Somente a opção free_flow está disponível para análise não verificada." }, 400);
      try {
        // Nominatim permite baixo volume de consultas. Não disparar duas consultas paralelas por requisição.
        const origin = await resolveLocation(input.origin as Point | string);
        const destination = await resolveLocation(input.destination as Point | string);
        const direct = await routeOsrm(origin, destination);
        const gantries = { ...detectGantryCandidates(direct.geometry.coordinates), catalogCoverage: { source: "Sem Parar", totalRecords: semPararCatalog.length, geolocatedRecords: 0, spatialMatchAvailable: false, geographicCandidatePositions: geographicCandidates.length, totalCandidatePositions: routeGantryCandidateCatalog.length, geographicCandidateSource: GEO_SOURCE, geographicLicense: GEO_LICENSE } };
        // O OSRM público não implementa exclusão de arestas Free Flow: nunca aplicar waypoint piloto em produção.
        return json({
          status: "not_verified",
          reason: "FREE_FLOW_EXCLUSION_NOT_VERIFIED",
          message: "Rota original calculada; o desvio de pedágio Free Flow ainda não foi validado. Não há garantia de ausência de cobrança.",
          origin: { lat: origin.lat, lon: origin.lon },
          destination: { lat: destination.lat, lon: destination.lon },
          route: {
            waypoints: [],
            barrier: pilotGantry.label,
            geometry: direct.geometry,
            metrics: { distanceKm: Math.round(direct.distance / 10) / 100,
              durationMinutes: Math.round(direct.duration / 60) },
          },
          gantries,
          links: { googleMaps: google(origin, destination) },
          validation: { freeFlowAvoidance: false, gantryCoordinateVerified: false, conventionalTollsExcluded: false },
        });
      } catch (error) {
        return safeError(error);
      }
    }
    return json({ error: "NOT_FOUND" }, 404);
  },
};
