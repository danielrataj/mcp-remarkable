# mcp-remarkable

Node.js MCP server for creating PDF documents from text and uploading them to reMarkable.

## What it does

The server exposes three MCP tools:

- `pair_remarkable` saves access for your reMarkable account.
- `check_connection` checks that the saved access still works.
- `upload_text_as_pdf` turns pasted text, for example an LLM answer, into a PDF and uploads it to your reMarkable cloud.

reMarkable does not provide a stable public upload API for this use case. This project keeps the cloud-specific code behind an adapter so it can be replaced if the service changes.

## Pairing

1. Open `https://my.remarkable.com/device/browser/connect`.
2. Copy the eight-character code.
3. Call the MCP tool `pair_remarkable` with that code.

Access is stored outside the repository. Set `REMARKABLE_AUTH_PATH` to choose the file location. If it is not set, the server uses:

- `/data/remarkable-auth.json` when `/data` exists
- `~/.config/mcp-remarkable/remarkable-auth.json` otherwise

## Connect from your MCP client

This server uses the MCP `stdio` transport. Add it to your MCP client by pointing the client at a command that starts the server. Build the Docker image first:

```bash
npm run docker:build
```

Recommended Docker configuration:

```json
{
  "mcpServers": {
    "remarkable": {
      "command": "docker",
      "args": [
        "compose",
        "--project-directory",
        "/absolute/path/to/mcp-remarkable",
        "run",
        "--rm",
        "mcp-remarkable"
      ]
    }
  }
}
```

Replace `/absolute/path/to/mcp-remarkable` with the absolute path to this repository, for example `$HOME/workspace/mcp-remarkable`.

For local development without Docker, build the TypeScript output and point your MCP client at the compiled entry point:

```bash
npm run build
```

```json
{
  "mcpServers": {
    "remarkable": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-remarkable/dist/index.js"],
      "env": {
        "REMARKABLE_AUTH_PATH": "/absolute/path/to/remarkable-auth.json"
      }
    }
  }
}
```

Keep `REMARKABLE_AUTH_PATH` outside the repository and do not commit the saved pairing file. After the client loads the server, run `pair_remarkable` once with the code from reMarkable, then use `check_connection` to confirm the saved access works.

## Recommended workflow

Use Docker as the primary path. The production image build compiles TypeScript and runs the test suite inside the container:

```bash
npm run docker:build
```

Run the MCP server from the production image:

```bash
npm run docker:run
```

Use the host Node.js scripts only for quick editor feedback. Before relying on a change, run the Docker build because that is the same path used by the container.

## Docker development with hot reload

For day-to-day development, run the dev container:

```bash
npm run docker:dev
```

This starts `tsx watch src/index.ts` inside Docker. Source files are mounted read-only into the container, and the reMarkable pairing data stays in the Docker volume `remarkable-data`.

When you change dependencies or `package-lock.json`, rebuild the dev image:

```bash
docker compose --profile dev build mcp-remarkable-dev
```

For fast local checks while editing:

```bash
npm test
npm run check
```

For the final check before running or shipping:

```bash
npm run docker:test
```

## Preview a generated PDF

Use the diagnostic CLI to create the same PDF that `upload_text_as_pdf` would upload:

```bash
npm run generate:pdf -- --out ./tmp/llm-output.pdf --title "LLM výstup" --text "Text pro PDF"
```

Or pass longer text through stdin:

```bash
printf 'Text pro PDF\nDruhý řádek\nČeština: ěščřžýáíé' | npm run generate:pdf -- --out ./tmp/llm-output.pdf --title "LLM výstup"
```

The command prints the output path and the TTF fonts embedded into the PDF. You can override them with `REMARKABLE_PDF_FONT_REGULAR` and `REMARKABLE_PDF_FONT_BOLD`.

## Docker

```bash
npm run docker:build
npm run docker:run
```

`upload_text_as_pdf` does not need a mounted input file because the PDF is created directly from the provided text.
