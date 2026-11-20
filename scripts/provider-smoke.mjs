// Consultas reais mínimas aos provedores em CI. Nunca imprime tokens, URLs de requisição ou corpos de erro.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function getJson(url, provider, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "BoaEstrada/0.4 (https://boaestrada.lgsr96.workers.dev/)" },
    });
    console.log(provider + " HTTP " + response.status);
    if (!response.ok) throw Error(provider + " HTTP " + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
try {
  const queries = ["Juiz de Fora, MG", "Três Rios, RJ"];
  const points = [];
  for (const [index, query] of queries.entries()) {
    if (index > 0) await sleep(1200); // reduzir impacto no Nominatim público
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=" + encodeURIComponent(query);
    const places = await getJson(url, "Nominatim " + (index + 1), 8000);
    if (!Array.isArray(places) || !places[0] || !Number.isFinite(+places[0].lat) || !Number.isFinite(+places[0].lon)) {
      throw Error("Nominatim returned no usable coordinates");
    }
    points.push([+places[0].lon, +places[0].lat]);
  }
  const url = "https://router.project-osrm.org/route/v1/driving/" +
    points.map(p => p.join(",")).join(";") + "?overview=full&geometries=geojson";
  const data = await getJson(url, "OSRM", 12000);
  if (data.code !== "Ok" || !Array.isArray(data.routes) || !data.routes.length ||
      !Number.isFinite(data.routes[0].distance) || !Number.isFinite(data.routes[0].duration) ||
      !Array.isArray(data.routes[0].geometry?.coordinates) || data.routes[0].geometry.coordinates.length < 2) {
    throw Error("OSRM returned an unusable route");
  }
  console.log("Provider smoke: Juiz de Fora → Três Rios route available; " +
    Math.round(data.routes[0].distance / 1000) + " km; " +
    Math.round(data.routes[0].duration / 60) + " min (unverified Free Flow status)");
} catch (error) {
  console.error("Provider smoke failed: " + (error instanceof Error ? error.message : "unexpected error"));
  process.exitCode = 1;
}
