# Free Flow — D1 de evidências (staging isolado)

## Estado em 20/11/2026

- Banco remoto Cloudflare **boaestrada-freeflow** criado e schema de `migrations/0001_freeflow_sources.sql` aplicado.
- **84** registros do inventário [Sem Parar](https://github.com/Sem-Parar/SEM-PARAR-FREE-FLOW) importados; fonte **CC BY 4.0**, manter atribuição.
- **48** posições quilométricas da [página Free Flow da ANTT](https://www.gov.br/antt/pt-br/free-flow) importadas a partir do snapshot `data/antt_freeflow_km_2026-11-20.csv`. O site apresenta **52 pórticos**, porque alguns têm sentidos ou unidades distintas.
- **38** correspondências candidatas registradas por rodovia+UF+quilômetro, com margem de **0,015 km**, via `scripts/freeflow_reconcile.sql`.
- **191** pendências de revisão (132 coordenadas, 48 status da página oficial, 10 unidades agregadas, 1 posição quilométrica não individualizada).
- A API oficial [Dados Abertos ANTT — Praça de Pedágio](https://dados.antt.gov.br/dataset/praca-de-pedagio) **não foi importada**; download expirou. O dataset mistura praças convencionais e potencialmente pórticos, exigindo classificação.
- Não há binding D1 no Worker em produção, nem rotina agendada; produção preservada.

## Regras de segurança dos dados

- O D1 é um **banco de observações de fontes**, não uma lista final verificada de pórticos ativos.
- `ff_observations` preserva linha bruta em `raw_json`, procedência, data de referência, status reportado, tipo e número de unidades.
- `ff_matches` é apenas comparação **candidata**. Posição idêntica não comprova latitude/longitude, sentido, cobrança ou equivalência de unidade.
- `unit_count` não deve ser somado diretamente a pórticos físicos. Na Via Dutra, 10 pórticos ANTT correspondem a um único registro agregado de 21 *pontos de cobrança* Sem Parar.
- Coordenadas ausentes permanecem `NULL`; não preencher com aproximações do pórtico piloto Simão Pereira sem confirmar fonte oficial.
- O aplicativo **não pode anunciar rotas sem Free Flow** enquanto não houver geometria, sentidos, arestas tarifadas e verificação do desvio.

## Consultas para conferência no D1

```sql
SELECT source_id, COUNT(*) registros,
       SUM(CASE WHEN status_normalized='active' THEN unit_count ELSE 0 END) unidades_ativas_declaradas
FROM ff_observations GROUP BY source_id;

SELECT COUNT(*) AS cruzamentos_candidatos FROM ff_matches
WHERE review_status='candidate';

SELECT reason,COUNT(*) quantidade
FROM ff_review_queue GROUP BY reason ORDER BY reason;

SELECT COUNT(*) AS coordenadas_presentes
FROM ff_observations WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

## Implantação futura (não executada)

1. Fazer download, inspecionar esquema, validar licença e importar JSON oficial ANTT, sem misturar praça convencional com Free Flow.
2. Gerar revisão da correspondência por UF, rodovia, km, sentido, concessionária e localização.
3. Criar importador reexecutável com atualização e histórico por fonte.
4. Adicionar binding **apenas em preview**, testar o endpoint `GET /api/gantries` e validar os dados.
5. Configurar atualização agendada apenas após determinar limites e condições das fontes.
6. Reavaliar integração em produção com plano de rollback; manter a rota como **não verificada** até validar exclusão de arestas tarifadas.

## Reversão

Como o Worker de produção não foi modificado, não é necessário rollback de código. Para abandonar a migração, primeiro desligar quaisquer futuros bindings/ciclos de ingestão; preservar/exportar evidências antes de excluir o banco D1.


## Segunda fase — 20/11/2026 (cadastro convencional e importador ANTT)

- Migração adicional: `migrations/0002_toll_registry_evidence.sql`, com `toll_registry_observations` isolado de `ff_observations`.
- Base complementar [Sem Parar — praças de pedágio](https://github.com/Sem-Parar/SEM-PARAR-PEDAGIOS/blob/main/dados/pracas-de-pedagio.csv), licença CC BY 4.0, com 318 registros (162 federais e 156 estaduais), carregada no D1 sob `sem_parar_tolls`. Essas coordenadas são **declaradas**, não verificadas uma a uma; classificação `conventional_claimed` vem do publicador.
- O cruzamento exato conservador (UF, rodovia, km ± 0,015) entre o cadastro auxiliar de praças e o Free Flow não retornou sobreposição; esse resultado **não prova completude ou ausência de conflitos**.
- `scripts/antt_registry_import.py` recebe CSV delimitado por ponto e vírgula (inclusive CP1252) ou JSON oficial da ANTT, exige campos reais `praca_de_pedagio`, `km_m`, `municipal`, `situacao`, `sentido` e normaliza latitude/longitude; gera SQL auditável sem executar gravação remota. Todos os registros oficiais são inseridos como `unclassified`; **não se convertem automaticamente em pórticos Free Flow**.
- `tests/test_antt_registry_import.py`: quatro testes `unittest` passaram em 20/11/2026 com fixtures; sem teste de descarga real do arquivo ANTT, que continua inacessível (timeout de rede e firewall).
- A ANTT informa que o cadastro é atualizado mensalmente; a descrição de metodologia de fontes derivadas aponta 289 registros na fotografia de 03/11/2026, **mas isso não foi confirmado por uma importação oficial própria**.
- A etapa de importação direta do recurso `antt_open_data` permanece aberta até haver acesso ao arquivo com validação de origem e hash.

### Como gerar SQL de staging da ANTT, após obter arquivo oficial

```bash
python scripts/antt_registry_import.py --input /caminho/dados-antt.json \
  --output /tmp/antt_staging.sql --audit /tmp/antt_audit.json \
  --updated-at 2026-11-03
# inspecionar SQL e auditoria; aplicar SOMENTE ao D1 de staging depois de revisão
```

**Não use registros de praça convencional para provar travessia de um pórtico Free Flow nem para excluir arestas dirigidas.**
