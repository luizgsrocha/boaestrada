import { describe, expect, it } from "vitest";
import { isActiveFreeFlow, validateRouteEdges } from "../src/routing.js";
import type { Gantry } from "../src/domain.js";

const gantry: Gantry = { id: "g1", road: "BR-040", latitude: -22, longitude: -43, sourceUrl: "https://example.com", observedAt: "2026-11-20", status: "active", directions: ["both"], affectedEdgeIds: ["edge-1"], verificationStatus: "verified" };

describe("validação de pórticos", () => {
  it("considera ativo somente o pórtico ativo e verificado", () => {
    expect(isActiveFreeFlow(gantry)).toBe(true);
    expect(isActiveFreeFlow({ ...gantry, verificationStatus: "unverified" })).toBe(false);
  });
  it("bloqueia somente a aresta dirigida cadastrada", () => {
    expect(validateRouteEdges(["edge-1"], [gantry])).toEqual(["g1"]);
    expect(validateRouteEdges(["parallel-edge"], [gantry])).toEqual([]);
  });
});
