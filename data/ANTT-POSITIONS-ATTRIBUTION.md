# Posições geográficas candidatas — camada ODbL isolada

Esta camada corresponde a **53 posições distintas** consolidadas a partir de **97 linhas** do arquivo `pedagios.csv` em oito UFs do projeto [Pardal](https://github.com/Murkiriel/pardal), conforme os blobs de origem registrados em `src/geo-candidates.ts`. O projeto Pardal identifica essas linhas como **FREE_FLOW** e **ANTT**; a fonte primária por ele declarada é [Dados das Praças de Pedágio da ANTT](https://dados.antt.gov.br/dataset/praca-de-pedagio). Não fizemos o download nem a revalidação da fonte primária da ANTT nesta etapa.

**Licença da camada geográfica:** [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/), de acordo com o repositório Pardal, com atribuição ao projeto Pardal e às fontes por ele indicadas, incluindo a ANTT. Esta camada derivada em `data/antt-position-candidates.json` e a cópia operacional em `src/geo-candidates.ts` são disponibilizadas separadamente do catálogo **Sem Parar CC BY 4.0**, sem converter, licenciar ou cruzar automaticamente os seus registros.

### Transformações auditáveis

- Foram mantidas apenas as linhas com `kind=FREE_FLOW` e `source=ANTT` nos arquivos por UF; registros com `source=OSM` ficaram fora desta primeira etapa (sem mistura de origens).
- Linhas com mesma UF, latitude e longitude **idênticas** foram agrupadas em uma posição, preservando todos os nomes originais (`labels`) e o número de linhas de origem (`sourceRecords`). Isso não comprova se há um único pórtico físico nem a equivalência de unidades de cobrança.
- A estrada, o quilômetro, a direção, a pista e o status operacional não foram inferidos. Os nomes e coordenadas foram atribuídos à fonte intermediária; `coordinateStatus=reported_unverified` para todos.
- As coordenadas podem ser aproximadas, inclusive com número limitado de casas decimais; **não se deve aplicar exclusão de trecho tarifado com base em raio**.
- A detecção por distância ponto-segmento mostra **candidatos próximos**, não pórticos atravessados ou tarifas devidas. O número real na rota continua `null`.

### Fontes consultadas (blobs versionados)

- MG: [estados/MG/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/MG/pedagios.csv) — SHA `5ad56ef0603fdf04e50b2a72a5ef46e30c11ac3a`
- RJ: [estados/RJ/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/RJ/pedagios.csv) — SHA `82d5b603da466268493ee5ca9c14095b04dd3805`
- SP: [estados/SP/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/SP/pedagios.csv) — SHA `2ef7620a1eff7a05dce8e71b5f2c3aaa6fdf8fad`
- PR: [estados/PR/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/PR/pedagios.csv) — SHA `53a43931589bf1e98c63c019344a169f572dc1bc`
- GO: [estados/GO/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/GO/pedagios.csv) — SHA `3c7f5b1f4d1837914e2674074eeec8a529406b53`
- RO: [estados/RO/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/RO/pedagios.csv) — SHA `4fd2fbedf35d6e0c5b9d4d3578085fcdf3526b3d`
- RS: [estados/RS/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/RS/pedagios.csv) — SHA `86f46532a0d22f385b8a07001b28cc6ff839a614`
- MT: [estados/MT/pedagios.csv](https://github.com/Murkiriel/pardal/blob/main/estados/MT/pedagios.csv) — SHA `383e7915b7d4d6e8ba1d95635d0024b766a87a92`

### Dados pendentes

O pórtico P3A, BR-040 km 831 em Simão Pereira, é confirmado na [Deliberação ANTT 310/2026](https://anttlegis.antt.gov.br/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=9230&cod_modulo=623&numeroAto=00000310&orgao=DG%2FANTT%2FMT&seqAto=000&tipo=DLB&valorAno=2026) quanto à **localização quilométrica e autorização de cobrança**, mas não há latitude/longitude confirmadas independentemente neste levantamento. O ponto piloto anterior permanece `pilot`, sem fazer parte das 53 posições derivadas.

Antes de alegar rota livre de Free Flow, será necessário cruzar registros individualmente com dados oficiais atuais, confirmar coordenadas e segmentos viários de cobrança e validar todas as pistas/sentidos.
