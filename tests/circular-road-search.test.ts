import { describe, expect, it } from "vitest";
import { findCircularRoadCandidates, type OsmElement } from "../src/circular-road-search.js";

const lon=-43, lat=-22;
const nodes: OsmElement[]=[
  {type:"node",id:1,lon:lon-.01,lat},
  {type:"node",id:2,lon:lon-.005,lat},
  {type:"node",id:3,lon,lat},
  {type:"node",id:4,lon:lon+.005,lat},
  {type:"node",id:5,lon:lon+.01,lat},
  {type:"node",id:6,lon:lon-.005,lat:lat+.001},
  {type:"node",id:7,lon,lat:lat+.001},
  {type:"node",id:8,lon:lon+.005,lat:lat+.001},
];
const main: OsmElement={type:"way",id:100,nodes:[1,2,3,4,5],tags:{highway:"primary",name:"BR original"}};
const alternative: OsmElement={type:"way",id:101,nodes:[2,6,7,8,4],tags:{highway:"residential",name:"Estrada alternativa"}};
const input=(osmElements:OsmElement[])=>({
  gantry:{id:"piloto",longitude:lon,latitude:lat},
  routeCoordinates:[[lon-.01,lat],[lon+.01,lat]] as [number,number][],
  osmElements,
});

describe("busca circular de vias alternativas",()=>{
  it("encontra via conectada nos dois lados, com dois waypoints na rua real",()=>{
    const result=findCircularRoadCandidates(input([...nodes,main,alternative]));
    expect(result.status).toBe("candidate_found");
    expect(result.selectedRingMeters).toBe(1000);
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives[0].waypoints).toEqual([[lon-.005,lat+.001],[lon+.005,lat+.001]]);
    expect(result.alternatives[0].roadNames).toContain("Estrada alternativa");
    expect(result.alternatives[0].connectivity).toBe("osm_nodes_only");
    expect(result.validation.freeFlowAvoidanceVerified).toBe(false);
    expect(result.validation.legalTurnRestrictionsChecked).toBe(false);
  });
  it("não inventa acesso a estrada paralela desconectada",()=>{
    const separate: OsmElement={type:"way",id:101,nodes:[6,7,8],tags:{highway:"residential"}};
    const result=findCircularRoadCandidates(input([...nodes,main,separate]));
    expect(result.status).toBe("no_connected_candidate");
    expect(result.alternatives).toEqual([]);
  });
  it("respeita acesso privado",()=>{
    const privateWay: OsmElement={...alternative,tags:{highway:"service",access:"private"}};
    expect(findCircularRoadCandidates(input([...nodes,main,privateWay])).status).toBe("no_connected_candidate");
  });
  it("respeita sentido único contrário à viagem",()=>{
    const backwards: OsmElement={...alternative,tags:{highway:"residential",oneway:"-1"}};
    expect(findCircularRoadCandidates(input([...nodes,main,backwards])).status).toBe("no_connected_candidate");
  });
  it("não seleciona a mesma rodovia principal como desvio",()=>{
    expect(findCircularRoadCandidates(input([...nodes,main])).status).toBe("no_connected_candidate");
  });
  it("não confunde pórtico longe da rota com trajeto atravessado",()=>{
    const result=findCircularRoadCandidates({...input([...nodes,main,alternative]),gantry:{id:"longe",longitude:-44,latitude:lat}});
    expect(result.status).toBe("gantry_not_near_route");
  });
  it("rejeita geometria e grafo inválidos",()=>{
    expect(()=>findCircularRoadCandidates({...input([...nodes,main]),routeCoordinates:[[0,0]]})).toThrow("INVALID_LAB_INPUT");
    expect(()=>findCircularRoadCandidates({...input([...nodes,main]),osmElements:new Array(12001).fill(nodes[0])})).toThrow("INVALID_LAB_INPUT");
  });
});
