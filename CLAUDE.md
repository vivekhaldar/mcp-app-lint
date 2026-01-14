# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A CLI conformance checker that validates MCP servers against the OpenAI Apps SDK requirements for ChatGPT Apps.

**Goal**: Automated validation with zero human involvement - point at an MCP URL, get a detailed conformance report.

## Current State

**Planning phase** - only the specification exists. See [docs/SPEC.md](./docs/SPEC.md) for:
- All validation checks (30+) with IDs like `TOOL_007`, `RES_003`
- Severity levels (ERROR, WARN, INFO)
- Output format examples
- Proposed architecture
- Implementation plan

## Testing Target

Use the Pomodoro timer MCP server for integration testing once implementation begins:
```bash
cd ~/repos/3p/pomodoro-timer-test/mcp-server && node server.mjs
# Server runs at http://127.0.0.1:8000/mcp
```
