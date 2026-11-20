# Ensaio: exclusão de pórticos Free Flow pelo Valhalla

## Objetivo

Substituir, em experimento isolado, o desvio por **waypoint fixo** por uma restrição na malha viária. No modo `avoid_free_flow`, não usar `exclude_tolls`: praças de pedágio convencionais permanecem permitidas.

## O que foi implementado

- `src/valhalla.ts` prepara dois pedidos com os mesmos pontos de origem e destino:
  - `baseline`: sem restrições;
  - `avoidingFreeFlow`: com `exclude_locations` para os pórticos **ativos e verificados**.
- Registra IDs incluídos e pórticos ativos sem dados verificados.
- Marca sempre `validationStatus: "not_verified"` no experimento.
- `tests/valhalla.test.ts`: cobre pedidos pareados, status, pedágios convencionais e validade das coordenadas.
- **Não** conecta o experimento ao `src/worker.ts`. Não altera produção, OSRM ou URLs do Google Maps.

## Teste real do corredor

O ponto `XPRJ+HF` em Simão Pereira (MG) é **piloto, ainda não verificado**. As coordenadas em `data/free-flow-xprj-hf.json` não são prova da localização exata da pista de cobrança. Nunca marcar rota segura apenas por evitá-las.

1. Confirmar localização, funcionamento, sentido, pista e trecho tarifado junto à ANTT/concessionária.
2. Disponibilizar um Valhalla com mapa da região, fora do Cloudflare Worker.
3. Requisitar **as duas rotas** (`POST /route`) com `costing: "auto"`.
4. Comparar distância e duração retornadas pelo motor.
5. Fazer map matching das duas geometrias e verificar **todas** as arestas dirigidas dos pórticos ativos. O ponto de exclusão no Valhalla pode se ajustar à via errada quando há pistas paralelas.
6. Somente se todas as validações passarem, gerar a alternativa a abrir no Google Maps; o Google pode recalcular a rota, portanto o link sozinho não certifica que ela evita o pórtico.
7. Se nenhuma alternativa validada existir, retornar `NO_VERIFIED_ROUTE`.

Exemplo **ilustrativo, não validado em campo** de payload enviado ao Valhalla:

```json
{
  "locations": [
    {"lat": -21.7609533, "lon": -43.3501129},
    {"lat": -22.1167, "lon": -43.2096}
  ],
  "costing": "auto",
  "units": "kilometers",
  "exclude_locations": [
    {"lat": -22.0085625, "lon": -43.2688125}
  ]
}
```

Este JSON é adequado apenas para avaliar o comportamento do motor após confirmar o pórtico e escolher o trecho dirigido correto.

## Desempenho e limites

Para um piloto Juiz de Fora–Três Rios, preparar somente um extrato OpenStreetMap cobrindo o corredor e desvios plausíveis, com margem para alternativas, **não baixar o planeta**. Se uma rota sair da área coberta, expandir o extrato regional; não considerar ausência de rota dentro do recorte prova de inexistência.

## Referências

- Valhalla: https://valhalla.github.io/valhalla/api/route/api-reference/
- GraphHopper custom models: https://github.com/graphhopper/graphhopper/blob/master/docs/core/custom-models.md
- Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started?hl=pt-br
