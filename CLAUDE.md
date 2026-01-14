# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A CLI conformance checker that validates MCP servers against the OpenAI Apps SDK requirements for ChatGPT Apps.

**Goal**: Automated validation with zero human involvement - point at an MCP URL, get a detailed conformance report.

## Commands

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run the checker locally
pnpm dev http://localhost:8000/mcp

# Type check
pnpm typecheck
```

## Architecture

```
src/
├── cli.ts           # Entry point, argument parsing
├── client.ts        # MCP JSON-RPC client (HTTP + SSE)
├── validators/
│   ├── protocol.ts  # CONN_*, PROTO_* checks
│   ├── tools.ts     # TOOL_* checks
│   ├── resources.ts # RES_* checks
│   ├── execution.ts # EXEC_* checks (tools/call)
│   ├── content.ts   # READ_* checks (HTML validation)
│   └── cross.ts     # XVAL_* cross-validation
├── reporters/
│   ├── text.ts      # Terminal output with colors
│   ├── json.ts      # JSON export
│   ├── markdown.ts  # Markdown report
│   └── junit.ts     # JUnit XML for CI
├── types.ts         # CheckResult, ConformanceReport
└── index.ts         # Main orchestration
```

## Key Design Decisions

1. **Severity Levels**: ERROR (must fix), WARN (should fix), INFO (nice to know)
2. **Check IDs**: Stable identifiers like `TOOL_007` for filtering and CI integration
3. **Zero Config**: Works with just a URL, no setup required
4. **Exit Codes**: 0=pass, 1=warnings, 2=errors, 3=connection failed

## Testing

Use the Pomodoro timer MCP server for integration tests:
```bash
cd ~/repos/3p/pomodoro-timer-test/mcp-server && node server.mjs
```

## Specification

See [SPEC.md](./SPEC.md) for the complete specification including all check IDs and validation rules.
