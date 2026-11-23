import { describe, expect, it } from "vitest";
import worker from "../src/worker.js";
import { autocompleteScript } from "../src/autocomplete.js";

describe("Página inicial - sugestões de cidades", () => {
  it("publica campos acessíveis de origem e destino e fonte oficial de municípios", async () => {
    const response = await worker.fetch(new Request("https://boaestrada.example/"));
    const html = await response.text();
    expect(html).toContain('id="o-suggestions"');
    expect(html).toContain('id="d-suggestions"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain("servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado");
    expect(html).toContain("Pirassununga, SP");
    expect(html).toContain("Cruz Alta, RS");
    expect(html).toContain("Calcular rota");
  });
  it("injeta JavaScript sintaticamente válido na página", () => {
    expect(() => new Function(autocompleteScript)).not.toThrow();
  });
});
