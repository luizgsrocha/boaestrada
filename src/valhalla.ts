/**
 * Ensaio de exclusão de localizações no Valhalla (não conectado ao Worker).
 * A exclusão por coordenada pode atingir pistas paralelas. Não afirmar que
 * a rota evita Free Flow antes de verificar as arestas efetivamente usadas.
 */
import type { Gantry } from "./domain.js";

export type LonLat = readonly [longitude: number, latitude: number];
export type ValhallaLocation = { lat: number; lon: number };
export type ValhallaRouteRequest = {
  locations: [ValhallaLocation, ValhallaLocation];
  costing: "auto";
  units: "kilometers";
  language: "pt-BR";
  exclude_locations?: ValhallaLocation[];
};

export type ValhallaExperiment = {
  baseline: ValhallaRouteRequest;
  avoidingFreeFlow: ValhallaRouteRequest;
  excludedGantryIds: string[];
  skippedUnverifiedGantryIds: string[];
  validationStatus: "not_verified";
};

function isValidPoint(coordinate: LonLat): boolean {
  const [lon, lat] = coordinate;
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/** 
 * Compara a rota normal à rota com pórticos ativos/verificados excluídos.
 * Não cria waypoints fictícios nem desabilita pedágios convencionais.
 */
export function buildValhallaExperiment(
  origin: LonLat,
  destination: LonLat,
  gantries: ReadonlyArray<Gantry>,
): ValhallaExperiment {
  if (!isValidPoint(origin) || !isValidPoint(destination)) {
    throw new RangeError("INVALID_COORDINATES");
  }
  const baseline: ValhallaRouteRequest = {
    locations: [
      { lat: origin[1], lon: origin[0] },
      { lat: destination[1], lon: destination[0] },
    ],
    costing: "auto",
    units: "kilometers",
    language: "pt-BR",
  };
  const active = gantries.filter((g) => g.status === "active");
  const verified = active.filter((g) =>
    g.verificationStatus === "verified"
    && isValidPoint([g.longitude, g.latitude]));
  const notVerified = active.filter((g) => !verified.includes(g));

  return {
    baseline,
    avoidingFreeFlow: verified.length ? {
      ...baseline,
      exclude_locations: verified.map((g) => ({ lat: g.latitude, lon: g.longitude })),
    } : { ...baseline },
    excludedGantryIds: verified.map((g) => g.id),
    skippedUnverifiedGantryIds: notVerified.map((g) => g.id),
    validationStatus: "not_verified",
  };
}
