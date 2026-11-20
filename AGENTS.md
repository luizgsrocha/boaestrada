# AGENTS.md — BoaEstrada

## Mission
BoaEstrada is a Brazilian road-route planning project. Its primary feature is finding routes from A to B that avoid **active Free Flow toll gantries** while still allowing conventional toll plazas. Do not confuse “avoid Free Flow” with “avoid all tolls”.

## Project status
The project is at an early stage. Treat architectural choices below as proposals until code and tests establish them. The initial pilot corridor is **Juiz de Fora, MG → Três Rios, RJ**, with the BR-040 Free Flow gantry near km 831, Simão Pereira, MG, as a candidate to validate against authoritative sources. Never assume a coordinate, direction, tariff, operational status, or viable detour without verification.

## Engineering principles
- Prefer small, testable, reversible changes and simple solutions.
- Inspect the existing repository, configuration and tests before editing.
- Use TypeScript for new application code unless the repository establishes another convention.
- Suggested architecture: Cloudflare Worker for HTTP API, Cloudflare D1 for toll metadata, and a dedicated routing engine (e.g. Valhalla or GraphHopper) for road-network calculations. The routing engine may require hosting outside Workers.
- Keep routing-provider adapters independent of business logic. Keep data ingestion independent of route calculation.
- Store credentials in environment secrets, never in commits, logs or client-side bundles.
- Do not deploy, create paid infrastructure, or change production settings without explicit approval.

## Critical routing rules
1. Accept origin, destination, vehicle profile and toll-avoidance preference.
2. The default special mode is `avoid_free_flow`, **not** `avoid_all_tolls`.
3. Model a gantry with verified latitude/longitude, road, kilometer, concessionaire, source, observed date, operating status, applicable direction(s), carriageway(s) and the affected directed road edges.
4. Exclude only the **directed, chargeable road segments** affected by active Free Flow gantries. A point-radius exclusion can wrongly block parallel roads, overpasses, opposite directions and legal detours.
5. Calculate a baseline route and a constrained route. Validate the constrained route against **all** active gantries on its actual path, not just those detected on the baseline route.
6. If the routing provider cannot enforce an exact restriction, or data coverage is incomplete, report that the result is **not verified**; never label it “Free Flow-free” without evidence.
7. Respect one-way roads, turn restrictions, access restrictions, vehicle limitations and legal maneuvers. Never propose illegal U-turns or unsafe shortcuts.
8. If no verified route exists, return a structured `NO_VERIFIED_ROUTE` outcome with a clear reason; do not silently fall back to a route through a gantry.
9. Compare distance, estimated duration and conventional tolls when reliable data is available. Do not invent prices or travel times.

## Data provenance
- Prefer official ANTT, state regulator and concessionaire datasets for operating status and road-km information; use OpenStreetMap for network geometry with attribution and license compliance.
- Store source URL, retrieval time, verification status and confidence per record.
- Distinguish `planned`, `installed`, `active`, `suspended`, `retired` and `unknown`. Do not treat unverified status as active or safely avoidable.
- Deduplicate records by road, kilometer, direction and geometry; preserve conflicting source evidence for review.
- Recheck data periodically and make updates auditable.

## Suggested API contract
- `POST /api/routes` with `origin`, `destination`, `vehicle` and `avoid: ["free_flow"]`.
- `GET /api/gantries?uf=MG` to list gantries with provenance and verification status.
- `GET /health` for readiness.
- Return a GeoJSON route geometry, route metrics, encountered/avoided gantries, data timestamp and an explicit validation status.
- Validate inputs, set timeouts and rate limits, and return predictable error codes. Do not expose upstream provider keys.

## Tests and acceptance criteria
- Unit tests for active/inactive status, direction, carriageway, gantry matching and route-validation logic.
- Integration tests with a mocked routing provider and representative road segments.
- Regression tests for parallel roads, opposite-direction travel, off-ramps, conventional toll plazas and no-alternative cases.
- Pilot acceptance: verify the BR-040 gantry geometry, calculate baseline and alternative routes, confirm the alternative crosses no active Free Flow charging edge, and document any added distance/time using actual engine output.
- Run lint, typecheck and tests before proposing a merge; report what was and was not executed.

## Repository workflow
- Use descriptive branches and focused pull requests; do not force-push or modify `main` destructively.
- Document assumptions, dataset licenses, setup steps, environment variable names and architecture decisions in the README/docs.
- Add migrations for D1 schema changes; do not rewrite applied migrations.
- Keep the user-facing product in Brazilian Portuguese (pt-BR), with clear terminology: “pedágio Free Flow”, “pedágio convencional” and “rota não verificada”.
- In PR descriptions, include purpose, files changed, tests, operational impact, risks and rollback plan.

## Agent response format
When working on BoaEstrada, report: (1) what was inspected, (2) what changed, (3) tests and results, (4) unresolved risks or missing data, and (5) the next concrete step. Distinguish implemented, proposed and verified behavior.
