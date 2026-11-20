import { unverifiedRoute } from "./routing.js";
import type { RouteRequest } from "./domain.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
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
