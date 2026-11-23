# Sem Parar — atribuição de dados externos

Este diretório contém uma cópia sem modificações estruturais do arquivo `dados/porticos-free-flow.csv`, obtido em 22/11/2026 do repositório [Sem-Parar/SEM-PARAR-FREE-FLOW](https://github.com/Sem-Parar/SEM-PARAR-FREE-FLOW), blob SHA `ba49f188aa2b6aefe02920bd36667974ad9cbf45`.

Crédito: **Sem Parar Instituição de Pagamento Ltda.** Base aberta Free Flow e Tag de Pedágio, 2026. Licença **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt-br)**. A cópia e a versão transformada no código são disponibilizadas com a atribuição de origem; não representam endosso do Sem Parar.

Transformações na aplicação: nomes de campos adaptados para TypeScript, IDs locais gerados por posição no snapshot, campos de coordenadas definidos como `null`, sem preenchimento por aproximação. Os 84 registros do CSV não equivalem necessariamente a 84 estruturas físicas: existem entradas agregadas (por exemplo, pontos de cobrança na Dutra). Não se deve inferir cobrança ativa sem confirmar `status` e fonte oficial atualizada. A base **não fornece latitude/longitude**, portanto os registros não são associados automaticamente à geometria de uma rota.

Original CSV: [porticos-free-flow.csv](https://github.com/Sem-Parar/SEM-PARAR-FREE-FLOW/blob/main/dados/porticos-free-flow.csv).
