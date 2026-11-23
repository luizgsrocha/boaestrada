import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { semPararCatalog, SEM_PARAR_SOURCE, SEM_PARAR_LICENSE, SEM_PARAR_SOURCE_SHA } from "../src/semparar-catalog.js";

describe("snapshot Sem Parar (somente dados sem coordenadas)", () => {
  it("mantém as 84 linhas e respectivos statuses sem fingir pontos físicos geolocalizados", () => {
    expect(semPararCatalog).toHaveLength(84);
    const lines=readFileSync(new URL("../data/sem-parar-porticos-free-flow.csv",import.meta.url),"utf8").trim().split(/\r?\n/);
    expect(lines).toHaveLength(85); // Cabeçalho + 84 registros (sem quebras internas no snapshot)
    expect(lines[0]).toContain("porticos_no_registro");
    expect(semPararCatalog.filter(item=>item.reportedStatus==="ativo")).toHaveLength(76);
    expect(semPararCatalog.every(item=>item.latitude===null&&item.longitude===null)).toBe(true);
    expect(semPararCatalog.every(item=>item.coordinateQuality==="missing")).toBe(true);
  });
  it("mantém dados de proveniência e não soma registros agregados como pórticos físicos", () => {
    expect(SEM_PARAR_SOURCE).toContain("Sem-Parar/SEM-PARAR-FREE-FLOW");
    expect(SEM_PARAR_LICENSE).toContain("creativecommons.org/licenses/by/4.0");
    expect(SEM_PARAR_SOURCE_SHA).toHaveLength(40);
    expect(semPararCatalog.find(item=>item.road==="BR-116"&&item.kilometer==="204 a 231")?.unitsInRecord).toBe(21);
    expect(semPararCatalog.find(item=>item.road==="BR-040"&&item.state==="MG")?.municipality).toBe("Simão Pereira");
  });
});
