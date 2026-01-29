# chatgpt-app-conformance

CLI tool to validate MCP servers against [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/build/mcp-server) or [MCP Apps (SEP-1865)](https://github.com/anthropics/mcp-specification/blob/main/docs/specification/extensions/apps/sep-1865.md) requirements.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

```bash
# Validate against OpenAI Apps SDK (default)
./bin/chatgpt-app-check http://localhost:8000/mcp

# Validate against MCP Apps (SEP-1865)
./bin/chatgpt-app-check http://localhost:8000/mcp --standard mcp-apps

# Output formats: text (default), json, html, markdown, junit
./bin/chatgpt-app-check http://localhost:8000/mcp --format html -o report.html

# Enable tool execution testing
./bin/chatgpt-app-check http://localhost:8000/mcp --execute-safe
```

## Standards Supported

| Standard | Flag | MIME Type | Tool Link Field | URI Scheme |
|----------|------|-----------|-----------------|------------|
| OpenAI Apps SDK | `--standard openai` | `text/html+skybridge` | `_meta.openai/outputTemplate` | `ui://widget/` |
| MCP Apps (SEP-1865) | `--standard mcp-apps` | `text/html;profile=mcp-app` | `_meta.ui.resourceUri` | `ui://` |

## What It Checks

- **Protocol**: Valid JSON-RPC, MCP protocol version
- **Tools**: Output template metadata, valid schemas, descriptions
- **Resources**: Widget URIs, MIME types, CSP configuration
- **Execution**: `structuredContent` in tool responses (opt-in)
- **Content**: Valid HTML, blocked APIs, asset references
- **Cross-validation**: Template URIs match available resources

## Exit Codes

- `0` - Conformant
- `1` - Conformant with warnings
- `2` - Non-conformant (errors)
- `3` - Connection/protocol failure

## CLI Options

```
Options:
  -V, --version          output the version number
  -f, --format <format>  Output format: text, json, markdown, html, junit (default: "text")
  -o, --output <file>    Write report to file
  -v, --verbose          Show all checks including passed ones
  -q, --quiet            Only show errors
  -s, --standard <name>  Standard to validate against: openai, mcp-apps (default: "openai")
  --tools <names>        Only check specific tools (comma-separated)
  --skip-content         Skip content validation
  --execute              Enable tool execution (disabled by default for safety)
  --execute-safe         Execute only tools marked readOnlyHint=true
  --timeout <ms>         Request timeout in milliseconds (default: "10000")
  --no-color             Disable colored output
  --auth <token>         Authorization header value (e.g., Bearer token)
  -H, --header <header>  Custom header as key:value (repeatable)
  -h, --help             display help for command
```

## License

Apache 2.0
