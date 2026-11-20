import { describe, expect, it } from "vitest";
import type { Gantry } from "../src/domain.js";
import { buildValhallaExperiment } from "../src/valhalla.js";

const gantry: Gantry = {
  id: "ff-synthetic", road: "BR-040", latitude: -22.0085625,
  longitude: -43.2688125, sourceUrl: "https://example.org/pilot",
  observedAt: "2026-11-20", status: "active", directions: ["both"],
  verificationStatus: "verified",
};
const origin = [-43.3501129, -21.7609533] as const;
const destination = [-43.2096, -22.1167] as const;

describe("Valhalla - ensaio de exclusão de trecho", () => {
  it("compara rota normal e rota que exclui o ponto Free Flow sem criar waypoints", () => {
    const plan = buildValhallaExperiment(origin, destination, [gantry]);
    expect(plan.baseline.exclude_locations).toBeUndefined();
    expect(plan.avoidingFreeFlow.exclude_locations).toEqual([
      { lat: -22.0085625, lon: -43.2688125 },
    ]);
    expect(plan.avoidingFreeFlow.locations).toEqual(plan.baseline.locations);
    expect(plan.excludedGantryIds).toEqual(["ff-synthetic"]);
    expect(plan.validationStatus).toBe("not_verified");
  });

  it("não exclui pórticos suspensos nem ativa exclusão para pórticos sem verificação", () => {
    const plan = buildValhallaExperiment(origin, destination, [
      { ...gantry, id: "suspended", status: "suspended" },
      { ...gantry, id: "pilot", verificationStatus: "unverified" },
    ]);
    expect(plan.avoidingFreeFlow.exclude_locations).toBeUndefined();
    expect(plan.skippedUnverifiedGantryIds).toEqual(["pilot"]);
  });

  it("não ativa o bloqueio de pedágios convencionais", () => {
    const plan = buildValhallaExperiment(origin, destination, [gantry]);
    expect("exclude_tolls" in plan.avoidingFreeFlow).toBe(false);
    expect(plan.avoidingFreeFlow.costing).toBe("auto");
  });

  it("rejeita coordenadas inválidas", () => {
    expect(() => buildValhallaExperiment([200, -22], destination, [gantry]))
      .toThrow("INVALID_COORDINATES");
  });
});
