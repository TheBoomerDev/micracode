# Getting Started

This guide walks you from a clean machine to a running Micracode
instance with your first project open in the workspace.

## 1. Install prerequisites

| Tool   | Version     | Install                                                                                |
| ------ | ----------- | -------------------------------------------------------------------------------------- |
| Node   | `v22.18.0`  | [`nvm`](https://github.com/nvm-sh/nvm): `nvm install 22.18.0 && nvm use`               |
| Bun    | `>= 1.1.0`  | [`bun`](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`                   |
| Python | `>= 3.12`   | System Python or managed by `uv`                                                        |
| uv     | `>= 0.4`    | [`uv`](https://docs.astral.sh/uv/): `curl -LsSf https://astral.sh/uv/install.sh | sh`   |

> **Alternative for uv:** If you have trouble with `uv` in your PATH, you can install the
> Python backend manually:
>
> ```bash
> cd apps/api
> python3 -m venv .venv
> source .venv/bin/activate
> pip install -e .
> ```

The repo's `.nvmrc` pins the Node version, so `nvm use` from the project
root picks the right one.

## 2. Get the code

```bash
git clone <your fork or the upstream repo> micracode
cd micracode
nvm use
```

## 3. Install dependencies

```bash
# JavaScript workspaces (web + shared)
bun install

# Python deps for the API (creates a uv-managed venv)
bun run api:install
```

## 4. Add an API key

Micracode ships with `.env.example` at the repo root. Copy it into
`apps/api/.env` and fill in **one** provider's key:

```bash
cp .env.example apps/api/.env
$EDITOR apps/api/.env
```

Minimum to get going with the default provider (Gemini):

```ini
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-gemini-key
```

Prefer OpenAI? Set `LLM_PROVIDER=openai` and provide `OPENAI_API_KEY` +
`OPENAI_MODEL`. See [Configuration](./configuration.md) for the full
reference and the list of accepted model IDs.

## 5. Run both apps

```bash
bun run dev
```

This starts the Next.js web app and the FastAPI backend in parallel:

- Web: <http://localhost:3000>
- API: <http://127.0.0.1:8000>

You should see logs from both processes in the same terminal. Leave it
running.

## 6. Create your first project

1. Open <http://localhost:3000>.
2. On the home page, type a one-line description of what you want to
   build into the prompt box and submit.
3. You'll be taken to the workspace, where the chat panel, file tree,
   editor, and preview are visible. Generated files appear in the tree
   as the model streams them in.
4. Use the chat panel to iterate — ask for changes, fixes, or new
   features. Edits you make in the Monaco editor are saved to disk.

That's it. Your project's source files now live under `~/opener-apps/`
— see [Projects on Disk](./projects-on-disk.md) for the layout.

## What's next

- [Using the Workspace](./usage.md) — tour the UI and the three panels.
- [Configuration](./configuration.md) — change models, providers, ports,
  or storage location.
- [Troubleshooting](./troubleshooting.md) — if something didn't start.
