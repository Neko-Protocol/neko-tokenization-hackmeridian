# Hosting the MCP server

Origin: adapted from the cr-tax-kb engine (github.com/Villarley/cr-tax-kb).

The stdio server (`mcp_server.py`) only works for MCP clients on the same machine. To use the knowledge base from Claude on the web or phone (custom connectors), run the HTTP server (`http_server.py`) at a public HTTPS URL. It serves the same tools, has no dependencies, and needs no database: the search index is built in memory at start (well under a second).

## How access works

The server reads a secret from the `NEKO_LEGAL_KB_TOKEN` environment variable. The endpoint is `https://<host>/mcp/<token>`; any other path answers 404. Anyone with the full URL can query the knowledge base, so share it only with the people who should use it, and rotate the token if it leaks (change the secret, redeploy, send the new URL). OAuth login is a later step.

Generate a token:

```
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Run it locally

```
NEKO_LEGAL_KB_TOKEN=dev PORT=8080 PYTHONPATH=src python3 -m neko_legal_kb.http_server
curl -s -X POST localhost:8080/mcp/dev -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Or with Docker (from `services/legal-kb`: `docker build -t neko-legal-kb .`; from the repo root: `docker build -f services/legal-kb/Dockerfile -t neko-legal-kb .`) then `docker run -p 8080:8080 -e NEKO_LEGAL_KB_TOKEN=dev neko-legal-kb`.

## Deploy on Google Cloud Run

One time, in the Google Cloud console:

1. Create a project and link a billing account. With a few users the service should stay inside the free tier; set a budget alert anyway (Billing > Budgets & alerts).
2. Secret Manager: create a secret `neko-legal-kb-token` with the generated token.
3. Cloud Run > Deploy container > **Continuously deploy from a repository**. Connect GitHub, pick `Neko-Protocol/neko-tokenization-hackmeridian`, branch `^main$`, build type **Dockerfile** (path `services/legal-kb/Dockerfile`, build context `services/legal-kb`). Every merge to `main` then rebuilds and redeploys.
4. Service settings:
   - Region: `us-central1` (or the closest one with free tier)
   - Authentication: **Allow unauthenticated invocations** (the token in the path is the access control)
   - Container port 8080, memory 512 MiB, CPU 1, minimum instances 0, maximum instances 2
   - Variables & secrets: expose secret `neko-legal-kb-token` as env var `NEKO_LEGAL_KB_TOKEN` (required: without it the container exits at start and the deploy fails with "failed to start and listen on the port")
5. Deploy. The service URL looks like `https://neko-legal-kb-xxxxx-uc.a.run.app`. Check `https://<service-url>/health` answers `ok` (not `/healthz`: Cloud Run reserves URL paths ending in `z` and answers them with its own 404).

The connector URL is `https://<service-url>/mcp/<token>`.

With minimum instances 0 the first request after a quiet period waits a few seconds while the container starts. Set minimum instances to 1 to avoid that, at a monthly cost.

## Add it to Claude

Each person: Claude > Settings > Connectors > **Add custom connector**, name `Neko Legal KB`, paste the connector URL, leave OAuth fields empty. Then enable it in a chat from the tools menu. Custom connectors may require a paid Claude plan.

Claude Code: `claude mcp add --transport http neko-legal-kb https://<service-url>/mcp/<token>`.

## Protocol notes

Streamable HTTP transport, JSON responses only: `POST` carries one JSON-RPC message or a batch; notifications get `202`. There is no server-initiated stream, so `GET` and `DELETE` on the endpoint answer `405`. No session ids: every request is independent, which lets Cloud Run route requests to any instance.
