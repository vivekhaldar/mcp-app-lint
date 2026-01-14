# Implementation Plan: ChatGPT Apps SDK Conformance Checker

**Status**: ✅ Complete
**Last Updated**: 2025-01-14

---

## Language Choice: TypeScript

**Rationale:**
- Official MCP SDK (`@modelcontextprotocol/sdk`) is TypeScript - handles SSE, JSON-RPC, protocol negotiation
- Target ecosystem (ChatGPT Apps, MCP) is JS/TS-heavy
- Strong typing for complex validation logic
- Mature CLI ecosystem (commander, chalk, htmlparser2)
- Node.js 18+ has native fetch, good ESM support

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Scaffolding | ✅ Complete | package.json, tsconfig, directories |
| 2. Types & Client | ✅ Complete | check.ts, report.ts, mcp.ts |
| 3. Validators | ✅ Complete | All 6 validators implemented |
| 4. Reporters | ✅ Complete | text, json, junit, markdown, html |
| 5. CLI | ✅ Complete | args.ts, index.ts with all options |
| 6. Testing | ✅ Complete | Tested against 4 example apps |

---

## Test Results (2025-01-14)

| App | Source | Verdict | Checks |
|-----|--------|---------|--------|
| pizzaz-server | openai/openai-apps-sdk-examples | ✅ CONFORMANT | 131 |
| solar-system-server | openai/openai-apps-sdk-examples | ✅ CONFORMANT | 34 |
| shopping-cart-server | openai/openai-apps-sdk-examples | ✅ CONFORMANT | 34 |
| time-left | ~/repos/gh/time-left-chatgpt-app | ✅ CONFORMANT | 36 |

Reports saved in `/reports/` directory.

---

## Phase 1: Project Scaffolding

### Task 1.1: Initialize Project Structure ⬜
```
src/
├── index.ts
├── cli/
├── client/
├── validators/
├── reporters/
└── types/
tests/
├── unit/
├── integration/
└── fixtures/
```

### Task 1.2: Install Dependencies ⬜
```bash
pnpm add @modelcontextprotocol/sdk commander chalk cli-table3 htmlparser2 domutils
pnpm add -D typescript vitest @types/node eslint
```

### Task 1.3: TypeScript Configuration ⬜

---

## Phase 2: Core Types & MCP Client

### Task 2.1: Define Core Types ⬜
- `src/types/check.ts` - CheckResult, Severity, Category
- `src/types/report.ts` - ConformanceReport, Verdict, ServerInfo

### Task 2.2: MCP Client Wrapper ⬜
- `src/client/mcp.ts` - Wraps SDK
- Auth headers, timeout via AbortController

### Task 2.3: Mock MCP Client ⬜
- `tests/fixtures/mock-server/server.ts`

---

## Phase 3: Validators

### Task 3.1: Pipeline Orchestrator ⬜
- `src/validators/index.ts` - ValidationContext, runValidationPipeline()

### Task 3.2: Base Validator ⬜
- `src/validators/base.ts` - Abstract class with pass()/fail()

### Task 3.3: Protocol Validator ⬜
- CONN_001-003, PROTO_001-003

### Task 3.4: Tool Validator ⬜
- TOOL_001-016 (critical: 007, 008)

### Task 3.5: Resource Validator ⬜
- RES_001-009

### Task 3.6: Execution Validator ⬜
- EXEC_001-007 (opt-in, respects readOnlyHint)

### Task 3.7: Content Validator ⬜
- READ_001-007 (HTML parsing, blocked API detection)

### Task 3.8: Cross Validator ⬜
- XVAL_001-004

---

## Phase 4: Reporters

### Task 4.1: Reporter Factory ⬜
### Task 4.2: Text Reporter ⬜
### Task 4.3: JSON Reporter ⬜
### Task 4.4: JUnit Reporter ⬜
### Task 4.5: Markdown Reporter ⬜
### Task 4.6: HTML Reporter ⬜

---

## Phase 5: CLI Entry Point

### Task 5.1: Argument Parser ⬜
- --format, --output, --verbose, --tools, --execute, --auth, -H

### Task 5.2: Main Entry Point ⬜
- Exit codes: 0 (conformant), 1 (warnings), 2 (errors), 3 (connection)

---

## Phase 6: Testing & Validation

### Task 6.1: Unit Tests ⬜
### Task 6.2: Integration Tests ⬜

### Test Targets:
- [ ] time-left app
- [ ] OpenAI example apps (pomodoro, weather, etc.)
- [ ] At least 3-4 real MCP servers

---

## Verification Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] CLI runs against test servers
- [ ] Exit codes correct
- [ ] All output formats work
- [ ] Reports saved for example apps

---

## Files Created

_(Updated as implementation progresses)_

```
src/
├── index.ts                 ⬜
├── cli/args.ts              ⬜
├── client/mcp.ts            ⬜
├── validators/
│   ├── index.ts             ⬜
│   ├── base.ts              ⬜
│   ├── protocol.ts          ⬜
│   ├── tools.ts             ⬜
│   ├── resources.ts         ⬜
│   ├── execution.ts         ⬜
│   ├── content.ts           ⬜
│   └── cross.ts             ⬜
├── reporters/
│   ├── index.ts             ⬜
│   ├── text.ts              ⬜
│   ├── json.ts              ⬜
│   ├── markdown.ts          ⬜
│   ├── html.ts              ⬜
│   └── junit.ts             ⬜
└── types/
    ├── check.ts             ⬜
    └── report.ts            ⬜
```
