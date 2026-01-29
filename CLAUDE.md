# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A CLI conformance checker that validates MCP servers against OpenAI Apps SDK or MCP Apps (SEP-1865) requirements.

**Goal**: Automated validation with zero human involvement - point at an MCP URL, get a detailed conformance report.

## Architecture

The codebase uses a **configuration object pattern** for multi-standard support:

- `src/standards/` - Standard specifications (OpenAI vs MCP Apps field mappings)
- `src/validators/` - Validators that use spec paths instead of hardcoded values
- `src/reporters/` - Output formatters (text, HTML, JSON, markdown, JUnit)
- `src/cli/` - Argument parsing with `--standard` flag
- `src/client/` - MCP SDK client wrapper

Key abstraction: `StandardSpec` interface encapsulates all differences between standards (URI schemes, MIME types, metadata paths).

## Standards Supported

| Feature | OpenAI Apps SDK | MCP Apps (SEP-1865) |
|---------|-----------------|---------------------|
| URI Scheme | `ui://widget/` | `ui://` |
| MIME Type | `text/html+skybridge` | `text/html;profile=mcp-app` |
| Tool Link | `_meta["openai/outputTemplate"]` | `_meta.ui.resourceUri` |
| Visibility | `_meta["openai/visibility"]` | `_meta.ui.visibility` |
| CSP | `_meta["openai/widgetCSP"]` | `_meta.ui.csp` |
| CSP fields | `connect_domains` (snake_case) | `connectDomains` (camelCase) |

## Testing

### OpenAI Apps SDK Server (Pomodoro Timer)
```bash
cd ~/repos/3p/pomodoro-timer-test/mcp-server && node server.mjs
# Server runs at http://127.0.0.1:8000/mcp

# Test (should pass)
./bin/chatgpt-app-check http://127.0.0.1:8000/mcp --standard openai
```

### MCP Apps Server (Quickstart)
```bash
cd ~/repos/3p/ext-apps/examples/quickstart && pnpm start
# Server runs at http://localhost:3001/mcp

# Test (should pass)
./bin/chatgpt-app-check http://localhost:3001/mcp --standard mcp-apps
```

## Development

```bash
pnpm install
pnpm build
pnpm test  # if tests exist
```

## Check IDs

Checks use stable IDs documented in [docs/SPEC.md](./docs/SPEC.md):
- `CONN_*` - Connection checks
- `PROTO_*` - Protocol checks
- `TOOL_*` - Tool validation
- `RES_*` - Resource validation
- `EXEC_*` - Execution checks
- `READ_*` - Content checks
- `XVAL_*` - Cross-validation
