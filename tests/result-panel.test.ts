import { describe, expect, it } from "vitest";
import { resultPanelScript } from "../src/result-panel.js";

type StubNode = { tag: string; className: string; textContent: string; href?: string; target?: string; rel?: string; children: StubNode[]; appendChild(n: StubNode): void; replaceChildren(...nodes: StubNode[]): void };
const node=(tag: string): StubNode=>({
  tag,className:"",textContent:"",children:[],
  appendChild(n){this.children.push(n)},
  replaceChildren(...nodes){this.children=nodes},
});
const collect=(root: StubNode): string=>[root.textContent,...root.children.map(collect)].join(" ");
const render=(data: unknown) => {
  const document={createElement:node};
  const renderPanel = new Function("document",resultPanelScript+"; return renderRoutePanel;")(document);
  const root=node("div");
  renderPanel(root,data);
  return { root, content: collect(root) };
};

describe("Painel de resultados", () => {
  it("gera código JavaScript válido", () => {
    expect(() => new Function(resultPanelScript)).not.toThrow();
  });
  it("apresenta apenas métricas reais e não inventa pórticos ou tarifas", () => {
    const {content}=render({
      status:"not_verified",
      validation:{freeFlowAvoidance:false},
      message:"Rota original calculada; desvio não validado",
      route:{metrics:{distanceKm:48.12,durationMinutes:57}},
      links:{googleMaps:"https://www.google.com/maps/dir/?api=1&origin=a&destination=b"},
    });
    expect(content).toContain("48,12 km");
    expect(content).toContain("57 min");
    expect(content).toContain("Não verificado");
    expect(content).toContain("Não calculada");
    expect(content).not.toContain("R$");
    expect(content).toContain("Não há comprovação");
  });
  it("ignora alegações de economia ou pórticos não verificados", () => {
    const {content}=render({
      status:"verified",
      validation:{freeFlowAvoidance:true},
      comparison:{avoidedGantries:8,savingsBRL:99,gantriesVerified:false,tariffsVerified:false},
      route:{metrics:{distanceKm:10,durationMinutes:12}},
    });
    expect(content).not.toContain("R$");
    expect(content).toContain("Não verificado");
    expect(content).toContain("Não calculada");
  });
  it("exibe valores de impacto apenas quando os dados estão marcados como verificados", () => {
    const {content}=render({
      status:"verified",
      validation:{freeFlowAvoidance:true},
      comparison:{avoidedGantries:2,savingsBRL:18.4,gantriesVerified:true,tariffsVerified:true,extraDistanceKm:4.2,extraMinutes:8},
      route:{metrics:{distanceKm:72.7,durationMinutes:75}},
    });
    expect(content).toContain("R$");
    expect(content).toContain("18,40");
    expect(content).toContain("+4,2 km");
    expect(content).toContain("+8 min");
    expect(content).not.toContain("Não há comprovação");
  });
  it("não gera links externos para domínios não autorizados", () => {
    const {root}=render({status:"not_verified",route:{metrics:{}},links:{googleMaps:"https://example.com/maps/dir/" }});
    expect(root.children.flatMap(n=>n.children).some(n=>n.tag==="a")).toBe(false);
  });
});
