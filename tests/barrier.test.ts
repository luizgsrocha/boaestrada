import { describe, expect, it } from "vitest";
import { isUsableBarrier, routeCrossesBarrier, selectBypassPoints } from "../src/barrier.js";

const barrier = {
  id: "br-040-free-flow-pilot",
  latitude: -22,
  longitude: -43,
  radiusMeters: 150,
  status: "active" as const,
  verificationStatus: "verified" as const,
  bypassPoints: [{ latitude: -22.001, longitude: -43.001, label: "Contorno oeste" }],
};

describe("barreira virtual Free Flow", () => {
  it("só usa barreiras ativas e verificadas", () => {
    expect(isUsableBarrier(barrier)).toBe(true);
    expect(isUsableBarrier({ ...barrier, verificationStatus: "unverified" })).toBe(false);
  });
  it("rejeita rota que atravessa o raio do bloqueio", () => {
    expect(routeCrossesBarrier([[-43, -22]], barrier)).toBe(true);
    expect(routeCrossesBarrier([[-43.01, -22.01]], barrier)).toBe(false);
  });
  it("expõe pontos de contorno apenas de barreiras válidas", () => {
    expect(selectBypassPoints([barrier])).toHaveLength(1);
  });
});
