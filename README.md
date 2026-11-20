# BoaEstrada

Planejador de rotas brasileiras, ainda em desenvolvimento, com pesquisa de desvio de pedágios **Free Flow** sem excluir pedágios convencionais.

## Estado confirmado

- `POST /api/routes` consulta o Nominatim para resolver locais e o OSRM público para calcular a **rota original**.
- A API retorna `status: "not_verified"` e `validation.freeFlowAvoidance: false`. **Não demonstra desvio Free Flow** e não acrescenta waypoint piloto.
- `/manutencao` mantém o experimento separado. Seu pórtico em Simão Pereira (-22.0085625, -43.2688125) tem coordenadas e cobrança não verificadas oficialmente; a heurística de candidatos próxima à coordenada NÃO inspeciona arestas dirigidas, permissões de acesso nem cobrança.
- O Google Maps pode recalcular trajetos, incluindo caminhos que passam pelo pórtico.
- `GET /health` verifica apenas a execução do Worker; `GET /api/providers/health` faz consultas limitadas de diagnóstico a Nominatim e OSRM, retornando disponibilidade e códigos públicos de erro.
- O HTML `public/index.html` é uma página alternativa legada; a homepage servida pelo Worker está embutida em `src/worker.ts`. Não considerar HTML estático como fonte da interface em produção.

## Desenvolvimento e testes

```bash
npm install
npm run typecheck
npm test
npm run dev
```

O CI de PR executa TypeScript e Vitest com provedores simulados. A validação do ambiente real exige testar a partir da rede do Cloudflare Worker, na revisão pré-deploy, após aprovação. Sem acesso HTTP a serviços externos, não declarar sucesso de integração externa.

## API

`POST /api/routes` com origem/destino em texto ou coordenadas `{lat,lon}` e `avoid: ["free_flow"]` (ou `[]`); `avoid: ["all_tolls"]` não é suportado.

Exemplo:

```json
{"origin":"Juiz de Fora, MG","destination":"Três Rios, RJ","avoid":["free_flow"]}
```

A resposta bem-sucedida contém `route.geometry` (GeoJSON LineString), `route.metrics`, `origin`, `destination`, `links.googleMaps` e `status: "not_verified"`. Uma resposta de erro inclui `error`, `message` e, para erros externos, `provider`.

Erros do provedor são discriminados: `PROVIDER_TIMEOUT`, `PROVIDER_NETWORK_ERROR`, `PROVIDER_HTTP_ERROR`, `PROVIDER_RATE_LIMITED`, `PROVIDER_INVALID_JSON`, `PROVIDER_INVALID_RESPONSE`, `ROUTING_PROVIDER_ERROR`, `ROUTE_NOT_FOUND`, `LOCATION_NOT_FOUND`. Mensagens públicas não carregam URL, corpo do provedor nem dados internos. Os logs emitidos no Worker registram somente provedor e código.

Timeouts atuais: Nominatim 8 segundos, OSRM 12 segundos, por consulta (incluindo leitura do corpo da resposta). A solicitação pode envolver duas chamadas de geocodificação. Um diagnóstico `/api/providers/health` não garante que determinada origem/destino será roteável.

## Riscos e pendências

- Nominatim e o servidor OSRM do projeto público não possuem SLA para este produto; consultar políticas de uso, respeitar limites e substituir somente após análise e aprovação.
- O laboratório antigo efetua até 13 chamadas OSRM, diretamente do navegador; sujeito a CORS, limites e uso excessivo. A heurística de anéis NÃO assegura vias legalmente acessíveis e permanece somente experimental.
- Não há limitação global de requisições, cache compartilhado de geocodificação, dados oficiais completos dos pórticos, grafo com exclusão de segmentos tarifados, nem verificação em campo.
- As versões em Cloudflare Workers são implantadas separadamente dos merges no GitHub. PR mesclado não equivale a versão publicada.
- Rollback proposto após eventual aprovação: publicar novamente a versão anterior do Worker (ou reverter o commit de merge e realizar novo deploy), sem alterações de D1.

## Operação segura

Antes de aprovar merge ou deploy: verificar o CI do PR, exercitar `/api/providers/health`, consultar `POST /api/routes` para Juiz de Fora → Três Rios, inspecionar resposta e logs de erro no Workers Observability, conferir a engrenagem e o laboratório. Não liberar alegações de ausência de Free Flow até validar arestas de cobrança, sentido, acessos e dados oficiais.
