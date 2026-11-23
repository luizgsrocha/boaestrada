# BoaEstrada

Planejador de rotas brasileiras, ainda em desenvolvimento, com pesquisa de desvio de pedágios **Free Flow** sem excluir pedágios convencionais.

## Estado confirmado

- `POST /api/routes` consulta o Nominatim para resolver locais e o OSRM público para calcular a **rota original**.
- A API retorna `status: "not_verified"` e `validation.freeFlowAvoidance: false`. **Não demonstra desvio Free Flow** e não acrescenta waypoint piloto.
- `/manutencao` mantém o experimento separado. Seu pórtico em Simão Pereira (-22.0085625, -43.2688125) tem coordenadas e cobrança não verificadas oficialmente; a heurística de candidatos próxima à coordenada NÃO inspeciona arestas dirigidas, permissões de acesso nem cobrança.
- O Google Maps pode recalcular trajetos, incluindo caminhos que passam pelo pórtico.
- `GET /health` verifica apenas a execução do Worker; `GET /api/providers/health` faz consultas limitadas de diagnóstico a Nominatim e OSRM, retornando disponibilidade e códigos públicos de erro.
- O HTML `public/index.html` é uma página alternativa legada; a homepage servida pelo Worker está embutida em `src/worker.ts`. Não considerar HTML estático como fonte da interface em produção.

## Identificação preliminar de pórticos na rota original

O `POST /api/routes` calcula a rota original e verifica a proximidade da sua geometria com o catálogo **piloto** disponível em `data/free-flow-xprj-hf.json` (atualmente um registro sem validação oficial). A detecção usa distância entre o ponto e **cada segmento** da polyline, em vez de apenas os vértices, e elimina duplicações por ID. Não é uma prova de passagem pela aresta tarifada: pistas paralelas, viadutos e erros de localização podem gerar falsos positivos.

A resposta inclui `gantries: { count: null, candidatesCount: N, candidates: [...], coverage: "incomplete", matchingMethod: "segment_proximity" }`. `candidatesCount` é somente o número de **candidatos próximos encontrados no cadastro disponível**. `count: null` significa que o número real de pórticos atravessados **não é conhecido**, inclusive quando `candidatesCount === 0`. A página inicial mostra a contagem preliminar e nomes de candidatos sem afirmar cobrança, desvio ou economia.

A integração do inventário ANTT/Sem Parar e do D1 isolado, em preparação na PR #24, permanece pendente. Não habilitar esse cadastro como evidência de pórticos ativos até revisar coordenadas, deduplicação, status, sentidos, pistas e arestas efetivamente tarifadas. Nem a heurística de raio nem a hipótese de cobrança bidirecional substituem essa validação.

## Painel de resultados

A página inicial do Worker mostra distância e duração **da rota original** quando o provedor responde. Exibe também campos para número de pórticos Free Flow evitados e economia estimada, que permanecem **não verificados / não calculados** enquanto não houver desvio e tarifas comprovadamente validados. Não se apresenta o valor zero como substituto de ausência de dados.

Se um futuro motor de rotas retornar `status: "verified"` e `validation.freeFlowAvoidance: true`, o painel só poderá apresentar quantidades informadas em `comparison.avoidedGantries` com `comparison.gantriesVerified: true`. Para valores financeiros exige também `comparison.tariffsVerified: true` e `comparison.savingsBRL` não negativo. Campos opcionais `comparison.extraDistanceKm` e `comparison.extraMinutes` serão mostrados apenas com rota verificada. **O backend atual não fornece esses campos de comparação.** A falha do OSRM mantém a mensagem de erro e o link para uma rota comum no Google Maps, sem garantia de evitar Free Flow.

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
