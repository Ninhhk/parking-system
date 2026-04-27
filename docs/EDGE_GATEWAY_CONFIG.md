# Edge Gateway Lane Configuration

This project uses a static JSON configuration file at `be/config/edge_gateways.json` to define which trigger modules are enabled per gateway lane.

## File location

- `be/config/edge_gateways.json`

## Schema

Top-level structure:

```json
{
  "gateways": [
    {
      "gateway_id": "string",
      "name": "string",
      "lanes": [
        {
          "lane_id": "string",
          "allowed_trigger_modules": ["CARD", "UHF", "LPD"],
          "correlation_window_seconds": 5
        }
      ]
    }
  ]
}
```

## Field meanings

- `gateway_id`: unique identifier sent by edge payload (`gateway_id`).
- `name`: display label for human readability.
- `lanes`: list of lane policies under a gateway.
- `lane_id`: lane identifier sent by edge payload (`lane_id`).
- `allowed_trigger_modules`: list of accepted `trigger_type` values for that lane.
  - Matching is case-insensitive in service logic.
  - If payload trigger is not in this list, request is rejected with `422` and message `Lane module disabled`.
- `correlation_window_seconds`: optional lane-specific window used for LPD enrichment lookup.
  - If omitted or invalid, service default `5` seconds is used.

## Runtime behavior

- Service loads this file at process startup via `require(...)`.
- Lane policy is resolved by the pair `(gateway_id, lane_id)`.
- If no lane configuration exists for a payload, the request is rejected with `422` and message `Lane configuration not found`.

## Restart behavior

- Because Node.js caches required JSON modules, config changes are not hot-reloaded.
- After editing `be/config/edge_gateways.json`, restart backend process to apply updates.
  - Local dev: restart `npm run dev` process.
  - Docker: restart backend container/service.
