import { describe, expect, it } from "vitest";
import { planRoute } from "../src/route-planner.js";

const barrier = {
  id: "g1", road: "BR-040", latitude: -22, longitude: -43,
  radiusMeters: 150, status: "active" as const,
  verificationStatus: "verified" as const,
  bypassPoints: [
    { latitude: -22.001, longitude: -43.001, label: "antes" },
    { latitude: -22.002, longitude: -43.002, label: "depois" },
  ],
};
describe("planejador com barreira", () => {
  it("troca a rota direta por uma alternativa válida e mantém status não verificado", async () => {
    let calls = 0;
    const result = await planRoute([-43.1, -22.1], [-43.2, -22.2], [barrier], async () => {
      calls++;
      return {
        coordinates: calls === 1 ? [[-43, -22]] : [[-43.1, -22.1], [-43.2, -22.2]],
        distanceMeters: calls === 1 ? 100 : 200,
      };
    });
    expect(calls).toBe(2); // 1 rota base + 1 candidato para o único pórtico
    expect(result.status).toBe("not_verified");
    expect(result.route).not.toBeNull();
  });
});
