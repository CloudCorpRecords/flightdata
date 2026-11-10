/**
 * flightdata core: a forwarding client for the hosted
 * HasData Google Flights MCP server.
 *
 * No flight search is run locally. tools/list is answered from
 * the literal tool definition below, taken verbatim from
 * a live capture of the upstream server (name, title,
 * description and inputSchema exactly as captured,
 * including the title key the tool carries). A tools/call
 * is forwarded over a streamable-HTTP JSON-RPC session:
 * an initialize POST, a notifications/initialized POST,
 * then the tools/call POST, honouring the Mcp-Session-Id
 * response header when the upstream issues one. The
 * session is established lazily on the first forwarded
 * call and reused for the lifetime of the client.
 *
 * The upstream endpoint is pinned to
 * https://mcp.hasdata.com/mcp?apis=google_travel_flights — the query
 * string is part of the pinned URL — and can be
 * overridden with the HASDATA_GOOGLE_FLIGHTS_MCP_URL environment
 * variable (that override is a labelled reconstruction).
 * When HASDATA_API_KEY is set in the environment, every
 * upstream request carries an `x-api-key: <key>` header
 * (the header name is pinned by the registry record's
 * remote declaration; forwarding the key from this env
 * var is a labelled reconstruction — the capture itself
 * was taken keyless). When the variable is unset, no key
 * header is sent, and no Authorization header is sent in
 * either case.
 *
 * Upstream results pass through verbatim, including any
 * isError flag and any extra result fields. Failures — a
 * JSON-RPC error from the upstream, a non-2xx status, an
 * unparseable response, or a fetch that throws or times
 * out — surface as an isError result whose text starts
 * with `flightdata error:` (that rendering is a labelled
 * reconstruction). Responses may be plain JSON or SSE
 * (data: lines); the JSON-RPC message with the matching
 * id wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://mcp.hasdata.com/mcp?apis=google_travel_flights";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/hasdata-google-flights-tools-original.json)       */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "hasdata_google_travel_flights_getGoogleFlights",
    "title": "google_travel_flights: GET /",
    "description": "Get Google Flights Results\n\nSearches Google Flights for one-way, round-trip, or multi-city itineraries with passenger mix (adults, children, infants in-seat/on-lap), travel class, bags, max price, sort order (price, duration, emissions, departure/arrival time), stops, include/exclude airlines and connections, time windows, layover duration, and deep-search mode. Returns per-itinerary price, total duration, stops, flight legs with airline, flight number, aircraft, departure/arrival airports and times, CO2 emissions, plus booking and departure tokens for round-trip returns or booking options. Use for travel-planning agents, fare monitoring, corporate travel dashboards, emission-aware trip optimization, and comparing routes and airlines across markets.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "departureId": {
          "type": "string",
          "description": "Specifies the departure airport code (IATA) or location kgmid.\n\n  - **IATA Code**: A 3-letter uppercase code (e.g., SFO for San Francisco, LHR for London Heathrow). Search on [IATA](https://www.iata.org/en/publications/directories/code-search).\n  - **Location kgmid**: A string starting with `/m/`, found in Wikidata under \"Freebase ID\" (e.g., `/m/02_286` for New York, NY).\n\nMultiple values can be separated by commas (e.g., `JFK,LGA,/m/0hptm`).\n"
        },
        "arrivalId": {
          "type": "string",
          "description": "Specifies the arrival airport code (IATA) or location kgmid.\n\n  - **IATA Code**: A 3-letter uppercase code (e.g., `SFO` for San Francisco, `LHR` for London Heathrow). Search on [IATA](https://www.iata.org/en/publications/directories/code-search).\n  - **Location kgmid**: A string starting with `/m/`, found in Wikidata under \"Freebase ID\" (e.g., `/m/02_286` for New York, NY).\n\nMultiple values can be separated by commas (e.g., `JFK,LGA,/m/0hptm`).\n"
        },
        "outboundDate": {
          "type": "string",
          "description": "The outbound travel date in 'yyyy-MM-dd' format.\n"
        },
        "returnDate": {
          "type": "string",
          "description": "The return travel date in 'yyyy-MM-dd' format. Required when **type** is `roundTrip`.\n"
        },
        "type": {
          "type": "string",
          "enum": [
            "roundTrip",
            "oneWay",
            "multiCity"
          ],
          "description": "Specifies the type of flight. Options:\n\n  - `roundTrip` (default)\n  - `oneWay`\n  - `multiCity` (requires `multiCityJson` for flight details)\n\nFor round trips, retrieve return flight details with a separate request using `departureToken`.\n"
        },
        "multiCityJson": {
          "type": "string",
          "description": "This parameter specifies flight details for multi-city trips. It is a JSON string containing multiple flight objects. Each object must include the following fields:\n\n- **departureId** – The departure airport code or location KGMID. Uses the same format as the main `departureId` parameter.\n- **arrivalId** – The arrival airport code or location KGMID. Uses the same format as the main `arrivalId` parameter.\n- **date** – The flight date. Uses the same format as the `outboundDate` parameter.\n- **times** *(optional)* – The time range for the flight. Uses the same format as the `outboundTimes` parameter.\n"
        },
        "gl": {
          "type": "string",
          "description": "The two-letter country code for the country you want to limit the search to. Provide one exact documented value (245 allowed), e.g. `ac`, `af`."
        },
        "hl": {
          "type": "string",
          "description": "The two-letter language code for the language you want to use for the search. Provide one exact documented value (159 allowed), e.g. `af`, `ak`."
        },
        "currency": {
          "type": "string",
          "description": "Parameter defines the currency of the returned prices Provide one exact documented value (71 allowed), e.g. `ALL`, `DZD`."
        },
        "travelClass": {
          "type": "string",
          "enum": [
            "economy",
            "premiumEconomy",
            "business",
            "first"
          ],
          "description": "The travel class for the flight (Economy, Premium Economy, Business, or First).\n"
        },
        "showHidden": {
          "type": "boolean",
          "description": "Indicates whether to include hidden options in the results.\n"
        },
        "adults": {
          "type": "number",
          "description": "Number of adult passengers (>= 1 if specified).\n"
        },
        "children": {
          "type": "number",
          "description": "Number of child passengers.\n"
        },
        "infantsInSeat": {
          "type": "number",
          "description": "Number of infants occupying seats.\n"
        },
        "infantsOnLap": {
          "type": "number",
          "description": "Number of infants sitting on an adult's lap.\n"
        },
        "sortBy": {
          "type": "string",
          "enum": [
            "topFlights",
            "price",
            "departureTime",
            "arrivalTime",
            "duration",
            "emissions"
          ],
          "description": "Sort the flight results based on price, departure time, arrival time, etc.\n"
        },
        "stops": {
          "type": "string",
          "enum": [
            "nonStop",
            "oneStopOrFewer",
            "twoStopsOrFewer"
          ],
          "description": "Restrict the number of stops (layovers) in the flight itinerary.\n"
        },
        "excludeAirlines": {
          "type": "string",
          "description": "A comma separated list of airline codes to exclude from results. You can search for airline codes on [IATA](https://www.iata.org/en/publications/directories/code-search). For example, `UA` is United Airlines.\n"
        },
        "includeAirlines": {
          "type": "string",
          "description": "A comma separated list of airline codes to exclusively include in results. You can search for airline codes on [IATA](https://www.iata.org/en/publications/directories/code-search). For example, `UA` is United Airlines.\n\n`excludeAirlines` and `includeAirlines` parameters can't be used together.\n"
        },
        "bags": {
          "type": "number",
          "description": "Number of carry-on bags per passenger.\n"
        },
        "maxPrice": {
          "type": "number",
          "description": "Maximum price limit for the flight search, in the selected currency.\n"
        },
        "outboundTimes": {
          "type": "string",
          "description": "Set up to 4 time boundaries (2 for departure, 2 for arrival) to filter flights. Each number represents the start of an hour.\n\nExamples:\n  - `6,20` → 6:00 AM - 9:00 PM departure\n  - `1,15` → 1:00 AM - 4:00 PM departure\n  - `7,18,2,21` → 7:00 AM - 9:00 PM departure, 2:00 AM - 10:00 PM arrival\n"
        },
        "returnTimes": {
          "type": "string",
          "description": "Set up to 4 time boundaries (2 for departure, 2 for arrival) to filter return flights. Each number represents the start of an hour.\n\nExamples:\n  - `6,20` → 6:00 AM - 9:00 PM departure\n  - `1,15` → 1:00 AM - 4:00 PM departure\n  - `7,18,2,21` → 7:00 AM - 9:00 PM departure, 2:00 AM - 10:00 PM arrival\n"
        },
        "lessEmissions": {
          "type": "boolean",
          "description": "Prefer flight options with lower carbon emissions.\n"
        },
        "layoverDuration": {
          "type": "string",
          "description": "Set the maximum layover duration in minutes to filter flights. For example, `120, 360` filters layovers between 2 hours and 6 hours, while `45, 180` allows layovers from 45 minutes to 3 hours.\n"
        },
        "includeConnections": {
          "type": "string",
          "description": "A comma separated list of specific airports to allow as connections.\n"
        },
        "excludeConnections": {
          "type": "string",
          "description": "A comma separated list of specific airports to exclude as connections.\n"
        },
        "maxDuration": {
          "type": "number",
          "description": "The maximum total flight duration in minutes.\n"
        },
        "deepSearch": {
          "type": "boolean",
          "description": "Enable deep search. Returns the same results as Google Flights in a browser, but takes longer to respond. Default is `false`.\n"
        },
        "departureToken": {
          "type": "string",
          "description": "Used to select a flight and retrieve return flights for a round trip or the next leg of the itinerary for a multi-city trip.\n"
        },
        "bookingToken": {
          "type": "string",
          "description": "Used to request booking options for selected flights. This token is found in the flight results and cannot be used with `departureToken`.\n"
        }
      },
      "required": [
        "departureId",
        "arrivalId",
        "outboundDate"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` is one of the captured tools. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `flightdata error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Parse a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * one is present, else the last parseable message, else
 * null when nothing parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not JSON; ignore this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client holding one upstream session. The
 * session is established lazily on the first forwarded
 * call and reused for the lifetime of the client (the
 * process lifetime when the client is the MCP server's
 * or a one-shot client for the CLI).
 */
export class FlightdataClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).HASDATA_GOOGLE_FLIGHTS_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private apiKey(): string | null {
    const raw = (this.deps.env ?? process.env).HASDATA_API_KEY;
    if (raw && raw.trim() !== "") return raw.trim();
    return null;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const key = this.apiKey();
    if (key !== null) headers["x-api-key"] = key;
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "flightdata", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // The notification response body carries nothing we need.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Pass the upstream result through verbatim.
    return result;
  }
}

/** Create a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): FlightdataClient {
  return new FlightdataClient(deps);
}

/** One-shot helper: a fresh client per call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new FlightdataClient(deps).callTool(name, args);
}
