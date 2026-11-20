# BoaEstrada

Roteador de estradas brasileiras com suporte planejado a rotas que evitam pedágios Free Flow ativos, sem bloquear automaticamente pedágios convencionais.

## Estado atual

API inicial em Cloudflare Worker e regras de validação de pórticos. O resultado permanece explicitamente `not_verified` enquanto não houver provedor de roteamento e base oficial configurados.

## API

- `GET /health`
- `GET /api/gantries?uf=MG`
- `POST /api/routes` com `origin`, `destination`, `vehicle` e `avoid`

## Desenvolvimento

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Não há deploy automático nem credenciais no repositório. Antes de produção, definir provedor de mapas, esquema D1, fontes oficiais e limites de uso.
