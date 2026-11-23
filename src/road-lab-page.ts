export const roadLabPage = String.raw`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BoaEstrada — Busca circular de vias</title>
<style>
*{box-sizing:border-box}body{font:15px system-ui, sans-serif;background:#eef5f5;color:#153447;padding:22px;margin:0}
main{max-width:820px;margin:auto}section{background:#fff;border:1px solid #d4e2e4;border-radius:12px;padding:20px;margin:16px 0}
label{display:block;font-weight:650;margin:14px 0 5px}input,select,textarea,button{font:inherit;padding:10px;border-radius:8px;width:100%;border:1px solid #9fb8bc}
textarea{height:110px}button{margin-top:18px;background:#0e8175;color:#fff;border:0;cursor:pointer;font-weight:700}
small,.warning{color:#695225}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#e9f0f2;padding:12px;border-radius:10px}
a{color:#08786e}.disabled{opacity:.7}
</style></head><body><main>
<p><a href="/manutencao">← Laboratório</a></p>
<h1>Busca circular de vias alternativas</h1>
<p>Experimento: desenha uma perpendicular à rota na região do pórtico, pesquisa estradas do OpenStreetMap em círculos de 500 m, 1 km e 2 km e verifica conexões entre nós viários.</p>
<section>
<label for="gantry">Pórtico candidato</label><select id="gantry"><option>Carregando...</option></select>
<label for="origin">Origem</label><input id="origin" value="Juiz de Fora, MG">
<label for="destination">Destino</label><input id="destination" value="Três Rios, RJ">
<label for="geometry">Geometria alternativa (opcional)</label>
<textarea id="geometry" placeholder='Cole coordenadas [[lon,lat],...] ou um GeoJSON LineString. Sem preenchimento, usa /api/routes.'></textarea>
<small>O serviço OSRM pode falhar. Nesse caso, cole uma geometria real de outro motor de rotas. Uma linha reta entre cidades não representa a estrada percorrida.</small>
<button id="go">Pesquisar vias e waypoints</button>
<p class="warning">Importante: os pórticos são candidatos não verificados. Conexão entre nós OSM não comprova acesso legal, conversões permitidas, segurança da estrada nem ausência de cobrança. A consulta ao Overpass é manual, uma por clique, e pode ser limitada pelo provedor.</p>
</section><section aria-live="polite"><h2>Resultado</h2><p id="status">Aguardando pesquisa.</p><pre id="output">Nenhuma consulta executada.</pre><p id="link"></p><small>Dados viários © colaboradores do <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (ODbL). A rota do Google Maps pode ser recalculada.</small></section>
</main><script>
const el=id=>document.getElementById(id);
const byId=new Map();
function say(status,obj){el("status").textContent=status;el("output").textContent=JSON.stringify(obj,null,2);}
async function fetchJson(url,options){
 const response=await fetch(url,options);
 const raw=await response.text();
 if(raw.length>4500000)throw Error("Resposta do provedor acima do limite do laboratório");
 let data;try{data=JSON.parse(raw)}catch{throw Error("Provedor não retornou JSON válido");}
 if(!response.ok)throw Error("HTTP "+response.status+" — "+(data.message||data.remark||"Consulta indisponível"));
 return data;
}
async function init(){
 try{
  const data=await fetchJson("/api/gantries");
  const select=el("gantry");select.replaceChildren();
  const all=[
    ...data.data.map(p=>({id:p.id,latitude:p.lat,longitude:p.lon,label:p.label+" (piloto)"})),
    ...data.geographicCatalog.records.map(p=>({id:p.id,latitude:p.latitude,longitude:p.longitude,label:(p.labels[0]||p.id)+" ("+p.state+", relatado)"}))
  ];
  for(const p of all){byId.set(p.id,p);const o=document.createElement("option");o.value=p.id;o.textContent=p.label;select.appendChild(o);}
 }catch(error){say("Erro ao carregar pórticos",{erro:String(error.message||error)})}
}
function coordinatesFrom(data){
 const route=Array.isArray(data)?data:(data.route?.geometry?.coordinates||data.geometry?.coordinates||data.coordinates);
 if(!Array.isArray(route)||route.length<2||route.length>2000||!route.every(x=>Array.isArray(x)&&x.length===2&&x.every(Number.isFinite)))throw Error("Geometria inválida. Use array de [longitude,latitude] da rota real.");
 return route;
}
async function getBaseline(){
 const pasted=el("geometry").value.trim();
 if(pasted)return coordinatesFrom(JSON.parse(pasted));
 const route=await fetchJson("/api/routes",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({origin:el("origin").value,destination:el("destination").value,avoid:["free_flow"]})
 });
 return coordinatesFrom(route);
}
async function fetchOsm(gantry){
 const q='[out:json][timeout:12][maxsize:12582912];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)(_link)?$"](around:2000,'+
    gantry.latitude+','+gantry.longitude+');(._;>;);out body;';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
 try{
  const data=await fetchJson("https://overpass-api.de/api/interpreter",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body:new URLSearchParams({data:q}).toString(),signal:ctrl.signal
  });
  if(!Array.isArray(data.elements)||data.remark)throw Error(data.remark||"Rede OSM indisponível");
  return data.elements;
 }finally{clearTimeout(timer)}
}
el("go").onclick=async()=>{
 const button=el("go"),outlink=el("link");outlink.replaceChildren();
 const gantry=byId.get(el("gantry").value);if(!gantry){say("Pórtico inválido",{});return}
 button.disabled=true;button.classList.add("disabled");
 try{
  say("Obtendo a geometria original...",{portico:gantry.label});
  const coords=await getBaseline();
  say("Consultando malha viária OSM (raio 2 km)...",{portico:gantry.label,verticesDaRota:coords.length});
  const osm=await fetchOsm(gantry);
  say("Analisando conectividade e raios...",{elementosOSM:osm.length});
  const result=await fetchJson("/api/lab/road-candidates",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({gantryId:gantry.id,routeCoordinates:coords,osmElements:osm})
  });
  say(result.status==="candidate_found"?"Desvio geométrico CANDIDATO (não verificado)":"Nenhum caminho alternativo conectado identificado",result);
  const option=result.alternatives?.[0];
  if(option){
    const first=coords[0],last=coords[coords.length-1];
    const convert=p=>p[1]+","+p[0];
    const params=new URLSearchParams({
      api:"1",origin:convert(first),destination:convert(last),
      waypoints:option.waypoints.map(convert).join("|"),travelmode:"driving"
    });
    const a=document.createElement("a");a.href="https://www.google.com/maps/dir/?"+params;
    a.target="_blank";a.rel="noopener noreferrer";
    a.textContent="Inspecionar waypoints candidatos no Google Maps — NÃO verificados";
    outlink.appendChild(a);
  }
 }catch(error){say("Falha na análise experimental",{erro:String(error.message||error),orientacao:"OSRM pode retornar 403 ou Overpass pode limitar consultas. Use geometria real colada no campo, ou repita mais tarde sem automação de requisições."})}
 finally{button.disabled=false;button.classList.remove("disabled")}
};
init();
</script></body></html>`;
