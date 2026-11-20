import { describe, expect, it } from "vitest";
import pilot from "../data/free-flow-xprj-hf.json";
import { routeCrossesBarriers } from "../src/barrier-routing.js";

describe("piloto XPRJ+HF", () => {
  it("marca a rota direta como atravessando a barreira", () => {
    const route = [[-43.3501129, -21.7609533], [-43.2688125, -22.0085625], [-43.2096, -22.1167]] as Array<[number, number]>;
    expect(routeCrossesBarriers(route, [pilot as never])).toHaveLength(1);
  });

  it("mantém o ponto de contorno fora do raio do piloto", () => {
    const route = [[-43.2788125, -22.0125625]] as Array<[number, number]>;
    expect(routeCrossesBarriers(route, [pilot as never])).toHaveLength(0);
  });
});
