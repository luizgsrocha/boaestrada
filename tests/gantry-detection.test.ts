import { describe, expect, it } from "vitest";
import { detectGantryCandidates, pilotGantry } from "../src/gantry-detection.js";
import pilot from "../data/free-flow-xprj-hf.json" with { type: "json" };

const segment = [[-43.28, -22.0085625], [-43.26, -22.0085625]] as [number, number][];
describe("detector de candidatos Free Flow sobre a rota original", () => {
  it("mantém o catálogo embutido sincronizado com o arquivo piloto", () => {
    expect(pilotGantry.id).toBe(pilot.id);
    expect(pilotGantry.label).toBe(pilot.name);
    expect(pilotGantry.road).toBe(pilot.road);
    expect(pilotGantry.latitude).toBe(pilot.latitude);
    expect(pilotGantry.longitude).toBe(pilot.longitude);
    expect(pilotGantry.radiusMeters).toBe(pilot.radiusMeters);
  });
  it("encontra um candidato no MEIO do segmento, sem vértice junto ao pórtico", () => {
    const found = detectGantryCandidates(segment);
    expect(found.candidatesCount).toBe(1);
    expect(found.candidates[0].id).toBe(pilotGantry.id);
    expect(found.candidates[0].distanceFromRouteMeters).toBe(0);
    expect(found.count).toBeNull();
    expect(found.coverage).toBe("incomplete");
  });
  it("não considera um candidato distante da rota", () => {
    const found = detectGantryCandidates([[-43.5, -22.4], [-43.45, -22.4]]);
    expect(found.candidatesCount).toBe(0);
    expect(found.count).toBeNull(); // 0 candidatos conhecidos NÃO é 0 pórticos na rota.
  });
  it("não conta duas vezes o mesmo cadastro, mesmo com vários segmentos", () => {
    const found = detectGantryCandidates([...segment, ...segment], [pilotGantry, pilotGantry]);
    expect(found.candidatesCount).toBe(1);
  });
  it("encontra mais de um candidato em uma rota, sem confundir com passagem tarifada", () => {
    const second = { ...pilotGantry, id: "outro-piloto", longitude: -43.264, latitude: -22.0085625 };
    const found = detectGantryCandidates(segment, [pilotGantry, second]);
    expect(found.candidatesCount).toBe(2);
    expect(found.count).toBeNull();
    expect(found.candidates.map(item=>item.id)).toEqual([pilotGantry.id,"outro-piloto"]);
  });
  it("ignora registros inativos e coordenadas inválidas", () => {
    const result = detectGantryCandidates(segment, [
      { ...pilotGantry, id:"inativo", operatingStatus:"inactive" },
      { ...pilotGantry, id:"invalido", longitude: Infinity },
    ]);
    expect(result.candidatesCount).toBe(0);
  });
  it("não trata via paralela dentro do raio como passagem confirmada", () => {
    const parallel = [[-43.28, -22.009],[-43.26, -22.009]] as [number,number][];
    const found = detectGantryCandidates(parallel);
    expect(found.candidatesCount).toBe(1);
    expect(found.candidates[0].detection).toBe("segment_proximity");
    expect(found.count).toBeNull();
  });
  it("sem geometria válida, não alega ausência de pórticos", () => {
    const invalid = detectGantryCandidates([[-43.2688,-22.0085]]);
    expect(invalid.candidatesCount).toBe(0);
    expect(invalid.count).toBeNull();
  });
});
