import { describe, expect, it } from "vitest";
import pilot from "../data/free-flow-xprj-hf.json" with { type: "json" };
import { isUsableBarrier, routeCrossesBarriers } from "../src/barrier-routing.js";

describe("piloto XPRJ+HF", () => {
  it("não habilita automaticamente uma barreira sem verificação e sem dois pontos de contorno", () => {
    expect(pilot.verificationStatus).toBe("pilot");
    expect(isUsableBarrier(pilot as never)).toBe(false);
    const route = [[-43.3501129, -21.7609533], [-43.2688125, -22.0085625], [-43.2096, -22.1167]] as Array<[number, number]>;
    expect(routeCrossesBarriers(route, [pilot as never])).toHaveLength(0);
  });

  it("não considera o ponto piloto como waypoint seguro", () => {
    expect(pilot.bypassPoints).toHaveLength(1);
    expect(isUsableBarrier(pilot as never)).toBe(false);
  });
});
