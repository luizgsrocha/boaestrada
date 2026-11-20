type Point = { lat: number; lon: number; label: string };
type Route = { distance: number; duration: number; geometry?: { type: "LineString"; coordinates: number[][] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" } });

const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BoaEstrada</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui;background:linear-gradient(135deg,#083344,#0f766e 55%,#f59e0b);color:white;min-height:100vh;padding:28px}.wrap{max-width:980px;margin:auto}.brand{font-weight:800;font-size:1.3rem;margin-bottom:70px}.grid{display:grid;grid-template-columns:1fr 410px;gap:45px;align-items:center}.eyebrow{color:#fcd34d;text-transform:uppercase;letter-spacing:.15em;font-size:.75rem;font-weight:800}.title{font-size:clamp(3rem,8vw,6rem);line-height:.9;letter-spacing:-.07em;margin:18px 0}.lead{font-size:1.1rem;line-height:1.6;color:#d9f4ef}.card{background:white;color:#102a43;border-radius:22px;padding:26px;box-shadow:0 24px 70px #052e2b66}label{display:block;font-size:.8rem;font-weight:700;margin:16px 0 6px}input{width:100%;padding:13px;border:1px solid #d9e2ec;border-radius:10px;font:inherit}.check{display:flex;gap:9px;align-items:center;font-weight:400;color:#334e68}.check input{width:auto}.btn{width:100%;padding:14px;border:0;border-radius:10px;background:#f59e0b;font-weight:800;font-size:1rem;margin-top:14px;cursor:pointer}.result{display:none;margin-top:16px;padding:15px;border-radius:10px;background:#eef7f5;color:#334e68;font-size:.9rem;line-height:1.5}.result.show{display:block}.warn{background:#fff7e6}.links{display:flex;gap:8px;margin-top:12px}.links a{flex:1;text-align:center;text-decoration:none;padding:10px;border-radius:8px;color:white;background:#0f766e;font-weight:700;font-size:.8rem}.links a:last-child{background:#2563eb}@media(max-width:760px){body{padding:22px}.brand{margin-bottom:45px}.grid{grid-template-columns:1fr;gap:30px}.title{font-size:3.8rem}}
</style></head><body><div class="wrap"><div class="brand">boaestrada</div><div class="grid"><section><div class="eyebrow">Rotas mais inteligentes</div><h1 class="title">Evite só o Free Flow.</h1><p class="lead">O BoaEstrada calcula a rota e permite continuar usando pedágios convencionais. A navegação final pode ser aberta no Waze ou no Google Maps.</p></section><form class="card" id="f"><h2>Encontrar uma rota</h2><label for="o">Origem</label><input id="o" required placeholder="Juiz de Fora, MG"><label for="d">Destino</label><input id="d" required placeholder="Três Rios, RJ"><label class="check"><input id="a" type="checkbox" checked> Evitar pedágio Free Flow</label><button class="btn">Calcular rota</button><div class="result" id="r"></div></form></div></div><script>
const f=document.querySelector("#f"),r=document.querySelector("#r"),o=document.querySelector("#o"),d=document.querySelector("#d"),a=document.querySelector("#a");
f.onsubmit=async e=>{e.preventDefault();r.className="result show";r.textContent="Calculando rota…";try{const x=await fetch("/api/routes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({origin:o.value,destination:d.value,avoid:a.checked?["free_flow"]:[]})}),j=await x.json();if(j.error)throw Error(j.message||j.error);const km=j.route?.metrics?.distanceKm;const min=j.route?.metrics?.durationMinutes;r.innerHTML="<b>"+(j.status==="not_verified"?"Rota não verificada":"Rota encontrada")+"</b><br>"+(km?km+" km · "+min+" min<br>":"")+j.message+(j.links?"<div class='links'><a href='"+j.links.waze+"'>Abrir no Waze</a><a href='"+j.links.googleMaps+"'>Google Maps</a></div>":"")}catch(err){r.textContent="Não foi possível calcular: "+err.message}};
</script></body></html>`;

async function geocode(query: string): Promise<Point | null> {
  const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query), { headers: { "user-agent": "BoaEstrada/0.1 (route prototype)" } });
  if (!response.ok) return null;
  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
  return results[0] ? { lat: Number(results[0].lat), lon: Number(results[0].lon), label: results[0].display_name } : null;
}

async function route(origin: Point, destination: Point): Promise<Route | null> {
  const url = "https://router.project-osrm.org/route/v1/driving/" + origin.lon + "," + origin.lat + ";" + destination.lon + "," + destination.lat + "?overview=full&geometries=geojson";
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json() as { routes?: Array<{ distance: number; duration: number; geometry: { type: "LineString"; coordinates: number[][] } }> };
  const item = data.routes?.[0];
  return item ? { distance: item.distance, duration: item.duration, geometry: item.geometry } : null;
}

export default { async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/") return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok", service: "boaestrada" });
  if (request.method === "GET" && url.pathname === "/api/gantries") return json({ data: [], verificationStatus: "unverified", message: "Base oficial de pórticos ainda não configurada." });
  if (request.method === "POST" && url.pathname === "/api/routes") {
    let body: { origin?: string; destination?: string; avoid?: string[] };
    try { body = await request.json() as typeof body; } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (!body.origin || !body.destination) return json({ error: "INVALID_REQUEST", message: "origin e destination são obrigatórios." }, 400);
    const [origin, destination] = await Promise.all([geocode(body.origin), geocode(body.destination)]);
    if (!origin || !destination) return json({ error: "GEOCODING_FAILED", message: "Não foi possível localizar origem ou destino." }, 422);
    const calculated = await route(origin, destination);
    if (!calculated) return json({ status: "not_verified", message: "Não foi possível obter distância e tempo agora, mas os links de navegação estão prontos.", links: { waze: "https://waze.com/ul?ll=" + destination.lat + "," + destination.lon + "&navigate=yes", googleMaps: "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destination.label) } });
    const destinationParam = encodeURIComponent(destination.label);
    return json({ status: "not_verified", message: body.avoid?.includes("free_flow") ? "Rota calculada, mas ainda não validada contra pórticos Free Flow oficiais." : "Rota calculada sem filtro Free Flow.", route: { metrics: { distanceKm: Math.round(calculated.distance / 10) / 100, durationMinutes: Math.round(calculated.duration / 60), geometry: calculated.geometry } }, links: { waze: "https://waze.com/ul?ll=" + destination.lat + "," + destination.lon + "&navigate=yes", googleMaps: "https://www.google.com/maps/dir/?api=1&destination=" + destinationParam } });
  }
  return json({ error: "NOT_FOUND" }, 404);
} };
