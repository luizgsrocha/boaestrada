import { describe, it, expect } from "vitest";
import dataset from "../data/antt-position-candidates.json" with { type: "json" };
import { geographicCandidates, GEO_SOURCE, GEO_LICENSE } from "../src/geo-candidates.js";
import { detectGantryCandidates, routeGantryCandidateCatalog } from "../src/gantry-detection.js";

describe("posições geográficas ANTT relatadas via Pardal", () => {
  it("preserva contagens, proveniência e arquivo ODbL auditável", () => {
    expect(dataset.rawRecords).toBe(97);
    expect(dataset.distinctPositions).toBe(53);
    expect(geographicCandidates).toEqual(dataset.positions);
    expect(geographicCandidates).toHaveLength(53);
    expect(new Set(geographicCandidates.map(p=>[p.state,p.latitude,p.longitude].join("|"))).size).toBe(53);
    expect(GEO_SOURCE).toContain("Murkiriel/pardal");
    expect(GEO_LICENSE).toContain("/odbl/1-0/");
  });
  it("conserva as linhas distintas de cobrança no mesmo local como uma só posição", () => {
    const sp=geographicCandidates.filter(x=>x.state==="SP");
    expect(sp).toHaveLength(10);
    expect(sp.some(x=>x.sourceRecords>1)).toBe(true);
    expect(sp.reduce((total,x)=>total+x.sourceRecords,0)).toBe(51);
  });
  it("identifica candidatos próximos ao segmento sem confirmar passagem", () => {
    const path=[[-43.14,-19.853947],[-43.12,-19.853947]] as [number,number][];
    const result=detectGantryCandidates(path);
    expect(result.candidates.some(x=>x.label.includes("João Monlevade"))).toBe(true);
    expect(result.candidates.find(x=>x.label.includes("João Monlevade"))?.verificationStatus).toBe("reported");
    expect(result.count).toBeNull();
    expect(result.coverage).toBe("incomplete");
    expect(routeGantryCandidateCatalog).toHaveLength(54);
  });
});
