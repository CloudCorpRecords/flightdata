# flightdata

flightdata is a small local bridge to the hosted
HasData Google Flights MCP server, which returns
Google Flights search results as JSON. Give it a
departure, a destination and an outbound date, and
it fetches matching itineraries: each option's
price, total duration and stops, its flight legs
with airline, flight number, aircraft, airports
and times, and its CO2 emissions, plus the booking
and departure tokens the upstream issues for
following up on a chosen itinerary.

Searches cover one-way, round-trip and multi-city
trips. They can be shaped by passenger mix (adults,
children, infants in a seat or on a lap), travel
class, carry-on bags, a maximum price, sort order
(price, duration, emissions, departure or arrival
time), stop limits, included or excluded airlines
and connections, departure and return time windows,
layover duration bounds, a maximum total duration,
an emissions preference and a deep-search mode.

The bridge stores no fares of its own. It serves
the upstream server's tool list locally, exactly as
captured from the live endpoint, and forwards each
tool call upstream, returning the result untouched.
The captured surface is a single read-only fare
search: there is no booking, reservation, ticketing
or payment tool in it.

## Tools

- `hasdata_google_travel_flights_getGoogleFlights`
  — search Google Flights. Required: `departureId`
  (IATA code or location kgmid; comma-separated
  multiples allowed), `arrivalId` (same formats),
  and `outboundDate` (`yyyy-MM-dd`). Optional:
  `returnDate`, `type` (`roundTrip` / `oneWay` /
  `multiCity`), `multiCityJson`, `gl`, `hl`,
  `currency`, `travelClass` (`economy` /
  `premiumEconomy` / `business` / `first`),
  `showHidden`, `adults`, `children`,
  `infantsInSeat`, `infantsOnLap`, `sortBy`
  (`topFlights` / `price` / `departureTime` /
  `arrivalTime` / `duration` / `emissions`),
  `stops` (`nonStop` / `oneStopOrFewer` /
  `twoStopsOrFewer`), `excludeAirlines`,
  `includeAirlines`, `bags`, `maxPrice`,
  `outboundTimes`, `returnTimes`, `lessEmissions`,
  `layoverDuration`, `includeConnections`,
  `excludeConnections`, `maxDuration`, `deepSearch`,
  `departureToken` and `bookingToken`. Returns
  per-itinerary price, duration, stops and legs,
  emissions, and booking/departure tokens.

## Configuration

- `HASDATA_GOOGLE_FLIGHTS_MCP_URL` (optional) —
  override the upstream endpoint. Defaults to
  `https://mcp.hasdata.com/mcp?apis=google_travel_flights`.
  (The override hook is this rebuild's own labelled
  reconstruction.)
- `HASDATA_API_KEY` (optional) — when set, every
  upstream request carries an `x-api-key: <key>`
  header, for the caller's own HasData API key. When
  it is not set, no key header is sent. (The header
  name and the env name are pinned by the original's
  registry record; forwarding the key from this env
  var is a labelled reconstruction — the original
  surface was captured keyless.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session with the upstream: a JSON-RPC
`initialize` request (protocolVersion `2025-03-26`,
clientInfo name `flightdata`), then a
`notifications/initialized` notification, then the
`tools/call` request carrying the caller's arguments
unchanged. When the upstream answers `initialize`
with an `Mcp-Session-Id` header, that value rides on
every later request of the session, which is reused
for the life of the process. Replies may arrive as
plain JSON or as server-sent events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `flightdata error:` (this rendering
is this rebuild's own labelled reconstruction).

## CLI

The tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/flightdata hasdata_google_travel_flights_getGoogleFlights '{"departureId":"SFO","arrivalId":"LHR","outboundDate":"2026-12-01","type":"oneWay","travelClass":"economy","stops":"nonStop"}'
npx @reneturcios/flightdata --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/flightdata mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "flightdata": {
      "command": "npx",
      "args": ["-y", "@reneturcios/flightdata", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/flightdata
docker run --rm ghcr.io/cloudcorprecords/flightdata --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.
