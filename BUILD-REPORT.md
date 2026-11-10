# BUILD REPORT — flightdata

Rebuild of `com.hasdata/google-flights` v1.0.7 (remote-only, keyless capture)
as `@reneturcios/flightdata` 0.1.0 / `io.github.CloudCorpRecords/flightdata`.

## Fixture conflicts

**None.** The brief, the spec prose, and the fixture agree on the tool
name and its required fields. Required fields as served, taken from
the fixture (`harness/fixtures/hasdata-google-flights-tools-original.json`):

- `hasdata_google_travel_flights_getGoogleFlights` — required: `departureId`, `arrivalId`, `outboundDate`

The fixture's tool literal (name, title, description, inputSchema —
including the `title` key, every property description and enum,
`additionalProperties: false`, and the `$schema` key) is served
verbatim from `src/forward.ts`; the literal was generated
programmatically from the fixture JSON (parsed and re-serialised, not
retyped) and verified by the registration-integrity test (served
tools/list deep-equals the fixture's 1 tool object) and again by the
parity harness.

## What was built

All 19 factory files under `builds/flightdata/`:

- `package.json` (`@reneturcios/flightdata` 0.1.0, bin
  `flightdata` → `dist/cli.js`, deps exactly `@modelcontextprotocol/sdk ^1`
  + `zod ^3`; devDeps `@types/node ^20`, `tsx ^4`, `typescript ^5`)
- `server.json` (description exactly the prescribed 87-char string
  "Google Flights search as JSON: itineraries, prices, times, stops and emissions filters.";
  npm entry carries `"version": "0.1.0"`; OCI entry
  `ghcr.io/cloudcorprecords/flightdata:0.1.0` carries **no** version field)
- `Dockerfile` (node:20-alpine both stages; server-name label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/flightdata"`
  matches `server.json`)
- `tsconfig.json` (fleet-identical, 318 bytes), `.gitignore`,
  `package-lock.json`, `README.md` (fresh prose), `LICENSE` (MIT,
  Copyright (c) 2026 Rene Turcios), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-28)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core; exports `VERSION = "0.1.0"`)
- `test/forward.test.ts`
- `.github/workflows/{ci.yml, publish.yml, publish-container.yml,
  registry-publish.yml}` (container workflow: IMAGE
  `ghcr.io/cloudcorprecords/flightdata`, smoke assertion on server name
  `flightdata`)

Plus `BUILD-REPORT.md` (this file) and the `parity-out/` harness output.

## Design

- Forwarding client to `https://mcp.hasdata.com/mcp?apis=google_travel_flights`
  (pinned; the query string is part of the pinned URL), overridable via
  `HASDATA_GOOGLE_FLIGHTS_MCP_URL` (labelled reconstruction). tools/call is
  forwarded as a streamable-HTTP JSON-RPC client: initialize
  (protocolVersion `2025-03-26`, clientInfo `flightdata`) →
  notifications/initialized → tools/call, honouring `Mcp-Session-Id`
  when issued; session established lazily and reused per client.
  Plain-JSON and SSE replies both parsed; the matching-id message
  wins; upstream results pass through verbatim (including `isError`
  and extra fields such as `structuredContent`).
- When `HASDATA_API_KEY` is set, an `x-api-key` header is
  sent on every upstream request (header name pinned by the registry
  record's remote declaration; forwarding it from this env var is a
  labelled reconstruction — the capture was keyless). When unset, no
  key header is sent. No `Authorization` header is sent in either
  case. Both branches are covered by tests.
- Upstream failures (JSON-RPC error, non-2xx status, malformed body,
  throwing/timing-out fetch) surface as `flightdata error:` text
  results (labelled reconstruction).
- Registration via the MCP SDK **low-level** `Server` API
  (`ListToolsRequestSchema` / `CallToolRequestSchema` handlers) serving
  the fixture literal exactly; no `McpServer` + zod registration
  (per the task brief, overriding TEMPLATE.md §2 item 12).
  `src/mcp.ts` also exports `createServer` / `startMcpServer` /
  `handleCallTool` so the MCP layer is testable without a transport;
  the CLI's `mcp` subcommand starts it over stdio.
- Core takes an injectable fetch (`ForwardDeps.fetchFn`), so all tests
  run against a stubbed JSON-RPC upstream. No live network calls in
  tests; no live call claimed anywhere. The captured surface is one
  read-only fare search; no booking, reservation, ticketing or
  payment tool exists in the surface — none was added. The
  `bookingToken` / `departureToken` arguments are upstream-issued
  search continuation values passed through as strings, not purchases.

## Lockfile (Route 3, clean from birth)

Generated in a temp dir (`/tmp/flightdata-lock`) containing only the
new `package.json`, with no `node_modules` present:
`npm install --package-lock-only --ignore-scripts --offline`.
Verified: parses, `name == @reneturcios/flightdata`,
**128 package entries**; placed into the build dir with matching
sha256 (`c0f3330e…7003` on both sides: full value
`c0f3330ec472fcd6d8bb34ce34bdd546d418c621242493732dec71a5d9cd7003`).
Then `npm install --offline --ignore-scripts` in the build dir for
`node_modules`. No write-guard failure occurred; `dist/` was built
in-tree normally.

## Verification (all in the build dir unless noted)

- `npx tsc --noEmit` → exit 0
- `npm run build` → real `dist/` (cli.js 2299 B, forward.js 19533 B,
  mcp.js 2684 B, all non-empty, with `.d.ts` + source maps)
- `node dist/cli.js --version` → `0.1.0`; unknown subcommand → usage on
  stderr, exit 2
- `npm test` → **51 tests, 51 pass, 0 fail** (8 suites: registration
  integrity — served tools deep-equal the fixture's full 1 tool
  object, name in order, exactly the fixture's keys, title key,
  required fields, every property key in order (31 properties),
  type/travelClass/sortBy/stops enums, additionalProperties/$schema,
  isKnownTool; session establishment/reuse/session-id handling,
  clientInfo/protocol version; env URL override, explicit url
  override, explicit-over-env precedence, blank-env fallback;
  x-api-key header present on every request when the key is set /
  absent when unset / no Authorization header in either case;
  verbatim argument forwarding incl. a full option set (passenger
  mix, stops, tokens) and a booking-token follow-up; verbatim result
  pass-through incl. upstream isError and SSE; JSON-RPC/init/
  malformed/no-result/HTTP/throw/timeout failures →
  `flightdata error:`; parseRpcBody JSON + SSE + matching-id +
  [DONE] cases; MCP-layer MethodNotFound / InvalidParams validation;
  CLI --version / -v / unknown exit 2 / bad-JSON exit 2 /
  `mcp extra` exit 2)
- Parity: `python3 harness/parity.py --original
  harness/fixtures/hasdata-google-flights-tools-original.json --rebuild
  "stdio:node builds/flightdata/dist/cli.js mcp" --out
  builds/flightdata/parity-out` (run from `~/workspace/mcp-rebuild-100`)
  → **PASS, parity 100.0, 1/1 identical, no missing/extra/schema
  diffs** (see `parity-out/parity.json`)
- Consistency sweep: package.json version = server.json top-level =
  npm-entry version = OCI tag = core `VERSION` = CHANGELOG heading
  (0.1.0); package.json `mcpName` = server.json `name` = Dockerfile
  label; server.json description measured at 87 chars; OCI entry
  confirmed to have no `version` field.

Clean-room: all prose and code written fresh for flightdata; only the
mechanics were patterned on the sibling bingdata build, and only the
fixture's tool literal is served verbatim.
