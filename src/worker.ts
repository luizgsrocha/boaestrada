import { unverifiedRoute } from "./routing.js";
import type { RouteRequest } from "./domain.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const page = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BoaEstrada</title><style>body{font-family:system-ui;margin:0;padding:8vw;background:linear-gradient(135deg,#083344,#0f766e);color:white}main{max-width:820px;margin:auto}h1{font-size:clamp(3rem,8vw,6rem);line-height:.9}form{background:white;color:#123;padding:24px;border-radius:20px;max-width:430px}label{display:block;margin:14px 0 5px;font-weight:700}input{width:100%;padding:12px;box-sizing:border-box}button{margin-top:18px;width:100%;padding:13px;background:#f59e0b;border:0;border-radius:8px;font-weight:700}.result{margin-top:14px;color:#123}
</style><main><p>boaestrada</p><h1>Uma boa estrada começa antes de sair.</h1><p>Evite pedágios Free Flow sem bloquear automaticamente os pedágios convencionais.</p><form id="f"><h2>Encontrar uma rota</h2><label>Origem</label><input id="o" required placeholder="Juiz de Fora, MG"><label>Destino</label><input id="d" required placeholder="Três Rios, RJ"><label><input id="a" type="checkbox" checked> Evitar pedágio Free Flow</label><button>Calcular rota</button><div class="result" id="r"></div></form><script>f.onsubmit=async e=>{e.preventDefault();r.textContent='Consultando…';let x=await fetch('/api/routes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({origin:o.value,destination:d.value,avoid:a.checked?['free_flow']:[]})});let j=await x.json();r.textContent='Rota não verificada: '+(j.reason||'resultado disponível')}</script></main></html>`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok", service: "boaestrada" });
    if (request.method === "GET" && url.pathname === "/api/gantries") return json({ data: [], verificationStatus: "unverified", message: "Base oficial de pórticos ainda não configurada." });
    if (request.method === "POST" && url.pathname === "/api/routes") {
      let body: RouteRequest;
      try { body = await request.json() as RouteRequest; } catch { return json({ error: "INVALID_JSON" }, 400); }
      if (!body.origin || !body.destination) return json({ error: "INVALID_REQUEST", message: "origin e destination são obrigatórios." }, 400);
      return json(unverifiedRoute("ROUTING_PROVIDER_NOT_CONFIGURED"));
    }
    return json({ error: "NOT_FOUND" }, 404);
  }
};
