# Configuration

All configuration lives in environment variables. The FastAPI backend
reads `apps/api/.env` (and the repo-root `.env` if present); the Next.js
app picks up `NEXT_PUBLIC_*` vars at build/dev time.

A working template is committed at [`.env.example`](../.env.example) —
copy it to `apps/api/.env` and edit.

## Variable reference

### Shared

| Variable          | Default                  | Purpose                                                                  |
| ----------------- | ------------------------ | ------------------------------------------------------------------------ |
| `APP_WEB_ORIGIN`  | `http://localhost:3000`  | The single origin the FastAPI service will accept CORS requests from.    |

### Web (`apps/web`)

| Variable                   | Default                   | Purpose                                                  |
| -------------------------- | ------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000`   | Where the browser calls the API. Must match what the API binds to. |

### API (`apps/api`)

| Variable           | Default              | Purpose                                                                                  |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`     | `gemini`             | Default provider. `gemini`, `openai`, or `ollama`.                                        |
| `GOOGLE_API_KEY`   | —                    | Required when `LLM_PROVIDER=gemini` (or whenever a user picks a Gemini model in the UI).  |
| `GEMINI_MODEL`     | `gemini-2.5-flash`   | Default Gemini model (used as fallback when the client doesn't send one).                 |
| `OPENAI_API_KEY`   | —                    | Required when `LLM_PROVIDER=openai` (or whenever a user picks an OpenAI model).           |
| `OPENAI_MODEL`     | —                    | Default OpenAI model. No default — must be one of the registered IDs (see below).         |
| `OLLAMA_BASE_URL`  | `http://localhost:11434` | Base URL for the local Ollama daemon. Only used when `LLM_PROVIDER=ollama`.           |
| `OLLAMA_MODEL`     | —                    | Default Ollama model (e.g. `llama3.2`). Required when `LLM_PROVIDER=ollama`.             |
| `OPENER_APPS_DIR`  | `~/opener-apps`      | Optional override for where generated projects are stored. Useful for tests or sandboxes. |
| `LOG_LEVEL`        | `INFO`               | Standard Python log level for the API process.                                            |

API keys never leave the server. The browser only learns *whether* a
provider is available (so the model picker can grey out unconfigured
ones); it never sees the keys themselves.

## Choosing a provider and model

You don't have to pick at install time. Each chat turn the UI sends the
selected `(provider, model)` pair from the **model picker** in the chat
composer. The selection is remembered in your browser's localStorage,
per-browser (not per-project).

The environment values (`LLM_PROVIDER`, `GEMINI_MODEL`, `OPENAI_MODEL`)
are only used as the default when the client hasn't picked yet — for
example, the very first turn after a fresh browser, or older clients
that don't send a selection.

### Supported model IDs

The model picker is driven by a registry on the server. The server
fetches available models **dynamically** from OpenAI and Gemini APIs
when API keys are configured; otherwise it falls back to a static
catalog.

**Google Gemini** (dynamic fetch or fallback)

Dynamic: fetches from `https://generativelanguage.googleapis.com/v1/models`
Fallback:
- `gemini-3.1-pro` (latest)
- `gemini-3.5-flash`
- `gemini-3-flash`
- `gemini-3.1-flash-lite`
- `gemini-2.5-pro` (legacy)
- `gemini-2.5-flash` (legacy)
- `gemini-2.5-flash-lite` (legacy)
- `nanobanana-2` (images)
- `nanobanana-pro` (images)

**OpenAI** (dynamic fetch or fallback)

Dynamic: fetches from `https://api.openai.com/v1/models`
Fallback:
- `gpt-5.5` (latest)
- `gpt-4.1`
- `gpt-4o`
- `gpt-4o-mini`
- `o3` (reasoning)
- `o3-mini` (reasoning)
- `o1` (reasoning)
- `o1-mini` (reasoning)

**Ollama (local)**

Ollama models are **always fetched dynamically** from your local Ollama daemon
(`GET /api/tags`) each time `GET /v1/models` is called. Any model you have
pulled with `ollama pull <model>` will appear in the UI picker automatically.
If the daemon is not reachable or has no models installed, the Ollama
section is omitted from the picker entirely.

To see the live list (including which providers are currently
"available" — meaning a key is configured), hit:

```bash
curl http://127.0.0.1:8000/v1/models
```

To check what defaults the running server has resolved:

```bash
curl http://127.0.0.1:8000/v1/health
```

### Adding a new model ID

If you want a model that isn't in the registry, append it to
[`apps/api/src/micracode_api/agents/model_catalog.py`](../apps/api/src/micracode_api/agents/model_catalog.py)
and restart the API. The UI picks it up automatically from
`GET /v1/models` on next load.

## Changing ports

The defaults assume:

- Web on `:3000`
- API on `127.0.0.1:8000`

If you need different ports, change them in **two** places so they
match:

1. The startup commands. The web port is `bun --filter web dev -- -p
   <port>`; the API port is set via the `--port` flag in
   `dev:api` in `package.json`.
2. The env vars: set `APP_WEB_ORIGIN` to the new web URL and
   `NEXT_PUBLIC_API_BASE_URL` to the new API URL.

If they don't match, the browser will hit CORS errors when calling the
API.

## Changing the storage location

By default, projects are written under `~/opener-apps/`. To put them
elsewhere — for testing, on an external drive, or in a sandbox — set:

```ini
OPENER_APPS_DIR=/absolute/path/to/your/folder
```

The path must be absolute. The API will create the directory if it
doesn't exist. See [Projects on Disk](./projects-on-disk.md) for what
gets written.
