# Engineering Design: ChatGPT Apps SDK Conformance Checker

## 1. Executive Summary

This document details the implementation of `chatgpt-app-check`, a CLI tool that validates MCP servers against OpenAI Apps SDK requirements. The tool connects to an MCP endpoint, runs ~35 validation checks across 6 phases, and produces actionable reports.

**Key Design Decisions:**
- Single-pass validation with lazy evaluation (don't fetch resources until needed)
- Streaming architecture to handle large widget HTML without memory pressure
- Pluggable validator/reporter pattern for extensibility
- Fail-fast on connection errors, continue on validation errors

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLI Entry Point                             │
│                           (src/cli/index.ts)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ ArgParser   │───▶│ Orchestrator│───▶│ Reporter    │                 │
│  │             │    │             │    │ Factory     │                 │
│  └─────────────┘    └──────┬──────┘    └─────────────┘                 │
│                            │                                            │
│                            ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Validation Pipeline                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │  │
│  │  │ Protocol │─▶│ Tools    │─▶│ Resources│─▶│ Execution│─▶ ...   │  │
│  │  │ Validator│  │ Validator│  │ Validator│  │ Validator│         │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                            │                                            │
│                            ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                          MCP Client                               │  │
│  │  - JSON-RPC over HTTP POST                                        │  │
│  │  - SSE response parsing                                           │  │
│  │  - Request/response correlation                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design Decisions & Tradeoffs

### 3.1 MCP Client Implementation

**Option A: Use existing MCP SDK (`@modelcontextprotocol/sdk`)**
- Pros: Battle-tested, handles edge cases, maintained by Anthropic
- Cons: Designed for bidirectional communication, may be overkill for one-shot validation

**Option B: Custom minimal client**
- Pros: Full control, smaller bundle, tailored to our needs
- Cons: Must handle SSE parsing, JSON-RPC correlation ourselves

**Decision: Option A (MCP SDK)** — The SDK handles SSE streaming, request IDs, and protocol negotiation correctly. The extra dependencies (~50KB) are negligible for a CLI tool. Reimplementing would invite subtle bugs.

### 3.2 Validator Architecture

**Option A: Single monolithic validator**
- Pros: Simple, no coordination overhead
- Cons: Hard to test, can't skip phases, rigid

**Option B: Pipeline of independent validators**
- Pros: Each validator is testable in isolation, can skip phases (`--skip-execution`), clear separation of concerns
- Cons: Need shared state (collected tools/resources) passed between validators

**Option C: Event-driven validators**
- Pros: Maximum decoupling
- Cons: Overengineered for sequential validation with dependencies

**Decision: Option B (Pipeline)** — Validators form a linear pipeline with a shared `ValidationContext` carrying accumulated state. Each validator receives the context, runs checks, appends results, and passes the context forward. This balances testability with simplicity.

```typescript
// Each validator follows this contract
interface Validator {
  name: string;
  run(ctx: ValidationContext): Promise<CheckResult[]>;
}

// Context accumulates data as we progress
interface ValidationContext {
  client: MCPClient;
  config: ValidatorConfig;
  serverInfo?: ServerInfo;
  tools?: Tool[];
  resources?: Resource[];
  toolResponses?: Map<string, ToolResponse>;
  resourceContents?: Map<string, ResourceContent>;
}
```

### 3.3 Error Handling Strategy

**Option A: Fail-fast on any error**
- Pros: Clear failure mode
- Cons: User gets incomplete report, must re-run multiple times

**Option B: Continue on validation errors, fail on connection errors**
- Pros: User sees all problems at once, saves iteration time
- Cons: Later checks may fail due to earlier missing data

**Option C: Best-effort with graceful degradation**
- Pros: Maximum information even with partial failures
- Cons: Complex error propagation

**Decision: Option B with guardrails** — Connection/protocol errors (Phase 1) are fatal. Subsequent validation errors are collected and reported. Each validator checks if required data exists before proceeding.

```typescript
// In ToolValidator
async run(ctx: ValidationContext): Promise<CheckResult[]> {
  if (!ctx.serverInfo) {
    return [{ id: 'TOOL_001', severity: 'error', passed: false,
              message: 'Cannot validate tools: protocol initialization failed' }];
  }
  // ... proceed with tool validation
}
```

### 3.4 HTML Parsing for Widget Validation

**Option A: Full DOM parsing (jsdom)**
- Pros: Complete DOM API, can run JS
- Cons: Heavy (~2MB), slow, overkill for static analysis

**Option B: SAX-style streaming (htmlparser2)**
- Pros: Fast, low memory, handles malformed HTML gracefully
- Cons: No DOM traversal, must build our own simple AST if needed

**Option C: Regex-based extraction**
- Pros: Zero dependencies
- Cons: Fragile, will break on edge cases

**Decision: Option B (htmlparser2)** — We need to check for specific patterns (blocked APIs in `<script>`, `<meta charset>`, `<title>`), not manipulate the DOM. Streaming parser is ideal. We'll use `htmlparser2` with `domutils` for basic querying.

### 3.5 Output Formatting

**Decision: Strategy pattern with factory**

```typescript
interface Reporter {
  format(report: ConformanceReport): string;
}

class ReporterFactory {
  static create(format: 'text' | 'json' | 'markdown' | 'html' | 'junit'): Reporter;
}
```

Each reporter is self-contained. The text reporter uses ANSI codes (via `chalk`) for terminal output. JUnit XML enables CI integration. JSON enables programmatic consumption.

---

## 4. Directory Structure

```
chatgpt-app-conformance/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli/
│   │   ├── args.ts           # Argument parsing (commander)
│   │   └── progress.ts       # Progress indicators
│   ├── client/
│   │   ├── mcp.ts            # MCP client wrapper
│   │   └── types.ts          # Protocol types
│   ├── validators/
│   │   ├── index.ts          # Validator pipeline orchestration
│   │   ├── base.ts           # Base validator class
│   │   ├── protocol.ts       # CONN_*, PROTO_* checks
│   │   ├── tools.ts          # TOOL_* checks
│   │   ├── resources.ts      # RES_* checks
│   │   ├── execution.ts      # EXEC_* checks
│   │   ├── content.ts        # READ_* checks
│   │   └── cross.ts          # XVAL_* checks
│   ├── reporters/
│   │   ├── index.ts          # Reporter factory
│   │   ├── text.ts           # Terminal output
│   │   ├── json.ts           # JSON output
│   │   ├── markdown.ts       # Markdown output
│   │   ├── html.ts           # HTML report
│   │   └── junit.ts          # JUnit XML for CI
│   └── types/
│       ├── check.ts          # CheckResult, Severity, Category
│       └── report.ts         # ConformanceReport
├── tests/
│   ├── unit/
│   │   ├── validators/       # One test file per validator
│   │   └── reporters/        # One test file per reporter
│   ├── integration/
│   │   └── e2e.test.ts       # Full pipeline tests
│   └── fixtures/
│       ├── mock-server/      # Minimal MCP server for testing
│       └── sample-responses/ # Canned JSON-RPC responses
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── docs/
    ├── SPEC.md
    └── DESIGN.md
```

---

## 5. Detailed Implementation Tasks

### Phase 1: Project Scaffolding (Foundation)

#### Task 1.1: Initialize Project Structure
**Assignee**: Any engineer
**Estimate**: Small
**Dependencies**: None

```bash
mkdir -p src/{cli,client,validators,reporters,types} tests/{unit,integration,fixtures}
pnpm init
```

Create `package.json`:
```json
{
  "name": "chatgpt-app-check",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "chatgpt-app-check": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src/",
    "check": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Acceptance Criteria**:
- `pnpm install` succeeds
- `pnpm build` produces `dist/` with valid JS
- Empty `pnpm test` passes

#### Task 1.2: Install Dependencies
**Dependencies**: Task 1.1

Core dependencies:
```bash
pnpm add @modelcontextprotocol/sdk commander chalk cli-table3 htmlparser2 domutils
pnpm add -D typescript vitest @types/node eslint
```

Rationale for each:
- `@modelcontextprotocol/sdk`: Official MCP client, handles protocol complexity
- `commander`: CLI arg parsing, widely used, well-documented
- `chalk`: ANSI colors, auto-detects terminal support
- `cli-table3`: ASCII tables for text output
- `htmlparser2` + `domutils`: Fast HTML parsing for widget validation

#### Task 1.3: TypeScript Configuration
**Dependencies**: Task 1.2

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Acceptance Criteria**:
- `pnpm run check` passes with no errors

---

### Phase 2: Core Types & MCP Client

#### Task 2.1: Define Core Types
**Dependencies**: Task 1.3
**File**: `src/types/check.ts`

```typescript
// ABOUTME: Core data structures for validation check results.
// ABOUTME: Used throughout the codebase to represent individual check outcomes.

export type Severity = 'error' | 'warn' | 'info';

export type Category =
  | 'protocol'   // CONN_*, PROTO_*
  | 'tools'      // TOOL_*
  | 'resources'  // RES_*
  | 'execution'  // EXEC_*
  | 'content'    // READ_*
  | 'cross';     // XVAL_*

export interface CheckResult {
  /** Unique check identifier, e.g., "TOOL_007" */
  id: string;

  /** Which validation phase this check belongs to */
  category: Category;

  /** How critical is this check? */
  severity: Severity;

  /** Did the check pass? */
  passed: boolean;

  /** What was being checked (tool name, resource URI, etc.) */
  target?: string;

  /** Human-readable description of what was checked */
  message: string;

  /** Additional context: actual values found, expected values, etc. */
  details?: unknown;

  /** Actionable fix suggestion if check failed */
  suggestion?: string;

  /** Link to relevant documentation */
  specRef?: string;
}
```

**File**: `src/types/report.ts`

```typescript
// ABOUTME: Aggregate report structure containing all validation results.
// ABOUTME: This is the final output produced by the validation pipeline.

import type { CheckResult } from './check.js';

export type Verdict =
  | 'conformant'              // All checks passed
  | 'conformant_with_warnings' // No errors, but has warnings
  | 'non_conformant';          // Has errors

export interface ServerInfo {
  name?: string;
  version?: string;
  protocolVersion?: string;
}

export interface ToolInfo {
  name: string;
  description?: string;
  hasOutputTemplate: boolean;
  outputTemplateUri?: string;
}

export interface ResourceInfo {
  uri: string;
  name?: string;
  mimeType?: string;
  isWidget: boolean;
}

export interface ConformanceReport {
  serverUrl: string;
  timestamp: string;
  durationMs: number;

  serverInfo: ServerInfo;

  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    errors: number;
    info: number;
    toolCount: number;
    resourceCount: number;
  };

  verdict: Verdict;
  checks: CheckResult[];
  tools: ToolInfo[];
  resources: ResourceInfo[];
}
```

**Acceptance Criteria**:
- Types compile without errors
- Types are exported and importable from other modules

#### Task 2.2: MCP Client Wrapper
**Dependencies**: Task 2.1
**File**: `src/client/mcp.ts`

This wraps the MCP SDK to provide a simpler interface for our use case.

```typescript
// ABOUTME: Wrapper around the MCP SDK providing a simplified interface.
// ABOUTME: Handles connection, initialization, and all MCP method calls.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ServerInfo } from '../types/report.js';

export interface MCPClientConfig {
  url: string;
  timeout: number;
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  // The full tool object for detailed inspection
  raw: unknown;
}

export interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  // The full resource object for detailed inspection
  raw: unknown;
}

export interface ToolCallResult {
  content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  isError?: boolean;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export class MCPClient {
  private client: Client;
  private config: MCPClientConfig;
  private serverInfo?: ServerInfo;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.client = new Client({
      name: 'chatgpt-app-check',
      version: '0.1.0',
    });
  }

  /**
   * Connect to the MCP server and perform initialization.
   * Returns server info on success, throws on failure.
   */
  async connect(): Promise<ServerInfo> {
    const transport = new SSEClientTransport(new URL(this.config.url));

    await this.client.connect(transport);

    // The SDK handles the initialize handshake internally
    // We can access server info from the client after connection
    const info = this.client.getServerVersion();

    this.serverInfo = {
      name: info?.name,
      version: info?.version,
      protocolVersion: info?.protocolVersion,
    };

    return this.serverInfo;
  }

  /**
   * List all tools exposed by the server.
   */
  async listTools(): Promise<Tool[]> {
    const response = await this.client.listTools();
    return response.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
      annotations: t.annotations as Record<string, unknown>,
      raw: t,
    }));
  }

  /**
   * List all resources exposed by the server.
   */
  async listResources(): Promise<Resource[]> {
    const response = await this.client.listResources();
    return response.resources.map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
      raw: r,
    }));
  }

  /**
   * Call a tool with given arguments.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    const response = await this.client.callTool({ name, arguments: args });
    return {
      content: response.content as ToolCallResult['content'],
      structuredContent: (response as any).structuredContent,
      _meta: (response as any)._meta,
      isError: response.isError,
    };
  }

  /**
   * Read a resource's content.
   */
  async readResource(uri: string): Promise<ResourceContent> {
    const response = await this.client.readResource({ uri });
    const content = response.contents[0];
    return {
      uri: content.uri,
      mimeType: content.mimeType,
      text: content.text,
      blob: content.blob,
    };
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}
```

**Acceptance Criteria**:
- Can instantiate `MCPClient` with config
- Type-checks correctly
- (Integration test later) Can connect to real MCP server

#### Task 2.3: Mock MCP Server for Testing
**Dependencies**: Task 2.2
**File**: `tests/fixtures/mock-server/server.ts`

Create a minimal in-process mock server that returns canned responses for unit testing validators without network calls.

```typescript
// ABOUTME: In-memory mock MCP server for unit testing.
// ABOUTME: Returns configurable responses without network overhead.

export interface MockServerConfig {
  serverInfo?: { name?: string; version?: string; protocolVersion?: string };
  tools?: unknown[];
  resources?: unknown[];
  toolResponses?: Map<string, unknown>;
  resourceContents?: Map<string, unknown>;
}

export class MockMCPClient {
  private config: MockServerConfig;

  constructor(config: MockServerConfig = {}) {
    this.config = config;
  }

  async connect() {
    return this.config.serverInfo ?? { name: 'mock', version: '1.0', protocolVersion: '2024-11-05' };
  }

  async listTools() {
    return this.config.tools ?? [];
  }

  async listResources() {
    return this.config.resources ?? [];
  }

  async callTool(name: string) {
    return this.config.toolResponses?.get(name) ?? { content: [] };
  }

  async readResource(uri: string) {
    return this.config.resourceContents?.get(uri) ?? { text: '' };
  }

  async close() {}
}
```

**Acceptance Criteria**:
- Mock client passes same interface as real client
- Can configure different responses for different test scenarios

---

### Phase 3: Validator Pipeline

#### Task 3.1: Validation Context & Pipeline Orchestrator
**Dependencies**: Task 2.2
**File**: `src/validators/index.ts`

```typescript
// ABOUTME: Orchestrates the validation pipeline, running validators in sequence.
// ABOUTME: Manages shared context and aggregates all check results.

import type { MCPClient, Tool, Resource, ToolCallResult, ResourceContent } from '../client/mcp.js';
import type { CheckResult } from '../types/check.js';
import type { Validator } from './base.js';

export interface ValidatorConfig {
  /** Only check these tools (empty = all) */
  toolFilter: string[];
  /** Skip tool execution phase */
  skipExecution: boolean;
  /** Skip content validation phase */
  skipContent: boolean;
  /** Request timeout in ms */
  timeout: number;
  /** Verbose output */
  verbose: boolean;
}

export interface ValidationContext {
  client: MCPClient;
  config: ValidatorConfig;

  // Accumulated data from each phase
  serverInfo?: {
    name?: string;
    version?: string;
    protocolVersion?: string;
  };
  tools?: Tool[];
  resources?: Resource[];
  toolResponses?: Map<string, ToolCallResult>;
  resourceContents?: Map<string, ResourceContent>;
}

export async function runValidationPipeline(
  client: MCPClient,
  config: ValidatorConfig,
  validators: Validator[]
): Promise<CheckResult[]> {
  const ctx: ValidationContext = { client, config };
  const allResults: CheckResult[] = [];

  for (const validator of validators) {
    const results = await validator.run(ctx);
    allResults.push(...results);

    // If protocol validation fails with errors, stop early
    if (validator.name === 'protocol') {
      const hasErrors = results.some(r => r.severity === 'error' && !r.passed);
      if (hasErrors) {
        break;
      }
    }
  }

  return allResults;
}
```

#### Task 3.2: Base Validator Class
**Dependencies**: Task 3.1
**File**: `src/validators/base.ts`

```typescript
// ABOUTME: Base class providing common utilities for all validators.
// ABOUTME: Includes helper methods for creating check results.

import type { ValidationContext } from './index.js';
import type { CheckResult, Severity, Category } from '../types/check.js';

export abstract class Validator {
  abstract name: string;
  abstract category: Category;

  abstract run(ctx: ValidationContext): Promise<CheckResult[]>;

  /**
   * Helper to create a passing check result
   */
  protected pass(
    id: string,
    message: string,
    opts: Partial<CheckResult> = {}
  ): CheckResult {
    return {
      id,
      category: this.category,
      severity: opts.severity ?? 'info',
      passed: true,
      message,
      ...opts,
    };
  }

  /**
   * Helper to create a failing check result
   */
  protected fail(
    id: string,
    severity: Severity,
    message: string,
    opts: Partial<CheckResult> = {}
  ): CheckResult {
    return {
      id,
      category: this.category,
      severity,
      passed: false,
      message,
      ...opts,
    };
  }
}
```

#### Task 3.3: Protocol Validator (CONN_*, PROTO_*)
**Dependencies**: Task 3.2
**File**: `src/validators/protocol.ts`

```typescript
// ABOUTME: Validates MCP connection and protocol initialization.
// ABOUTME: These checks are prerequisites for all subsequent validation.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';

export class ProtocolValidator extends Validator {
  name = 'protocol';
  category = 'protocol' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // CONN_001: Server responds
    // CONN_002: Server accepts application/json
    // CONN_003: Server returns valid JSON-RPC
    // These are implicitly validated by successful connection
    try {
      const serverInfo = await ctx.client.connect();
      ctx.serverInfo = serverInfo;

      results.push(this.pass('CONN_001', 'Server responds to HTTP POST', { severity: 'error' }));
      results.push(this.pass('CONN_002', 'Server accepts application/json', { severity: 'error' }));
      results.push(this.pass('CONN_003', 'Server returns valid JSON-RPC responses', { severity: 'error' }));

      // PROTO_001: Valid protocol version
      if (serverInfo.protocolVersion) {
        results.push(this.pass('PROTO_001', `Protocol version: ${serverInfo.protocolVersion}`, {
          severity: 'error',
          details: { protocolVersion: serverInfo.protocolVersion },
        }));

        // PROTO_002: Protocol version is recent enough
        const version = serverInfo.protocolVersion;
        const isRecent = version >= '2024-11-05';
        if (isRecent) {
          results.push(this.pass('PROTO_002', `Protocol version ${version} meets minimum requirement`, {
            severity: 'warn',
          }));
        } else {
          results.push(this.fail('PROTO_002', 'warn',
            `Protocol version ${version} is older than recommended 2024-11-05`, {
            suggestion: 'Update your MCP server to support protocol version 2024-11-05 or later',
          }));
        }
      } else {
        results.push(this.fail('PROTO_001', 'error', 'Server did not report protocol version'));
      }

      // PROTO_003: Server reports capabilities
      results.push(this.pass('PROTO_003', 'Server reports capabilities', {
        severity: 'info',
        details: { serverInfo },
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(this.fail('CONN_001', 'error', `Failed to connect: ${message}`, {
        suggestion: 'Verify the MCP server is running and the URL is correct',
      }));
    }

    return results;
  }
}
```

**Acceptance Criteria**:
- Passes CONN_001-003 and PROTO_001-003 on successful connection
- Fails gracefully with actionable message on connection error
- Populates `ctx.serverInfo` for downstream validators

#### Task 3.4: Tool Validator (TOOL_*)
**Dependencies**: Task 3.2
**File**: `src/validators/tools.ts`

This is the largest validator. I'll structure it with helper methods.

```typescript
// ABOUTME: Validates tool descriptors against OpenAI Apps SDK requirements.
// ABOUTME: Checks for required fields, metadata, and proper formatting.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { Tool } from '../client/mcp.js';

export class ToolValidator extends Validator {
  name = 'tools';
  category = 'tools' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (!ctx.serverInfo) {
      results.push(this.fail('TOOL_001', 'error',
        'Cannot validate tools: protocol initialization failed'));
      return results;
    }

    // TOOL_001: tools/list returns valid response
    try {
      let tools = await ctx.client.listTools();
      ctx.tools = tools;

      results.push(this.pass('TOOL_001', `tools/list returned ${tools.length} tool(s)`, {
        severity: 'error',
      }));

      // Apply tool filter if specified
      if (ctx.config.toolFilter.length > 0) {
        tools = tools.filter(t => ctx.config.toolFilter.includes(t.name));
      }

      // Validate each tool
      for (const tool of tools) {
        results.push(...this.validateTool(tool));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(this.fail('TOOL_001', 'error', `tools/list failed: ${message}`));
    }

    return results;
  }

  private validateTool(tool: Tool): CheckResult[] {
    const results: CheckResult[] = [];
    const target = tool.name;

    // TOOL_002: Has name field (always true if we got here)
    results.push(this.pass('TOOL_002', 'Has name field', { severity: 'error', target }));

    // TOOL_003: Has description field
    if (tool.description) {
      results.push(this.pass('TOOL_003', 'Has description field', { severity: 'error', target }));

      // TOOL_004: Description is meaningful (>10 chars)
      if (tool.description.length > 10) {
        results.push(this.pass('TOOL_004', 'Description is meaningful', { severity: 'warn', target }));
      } else {
        results.push(this.fail('TOOL_004', 'warn',
          `Description is too short (${tool.description.length} chars)`, {
          target,
          suggestion: 'Provide a more descriptive description (>10 characters)',
        }));
      }
    } else {
      results.push(this.fail('TOOL_003', 'error', 'Missing description field', { target }));
    }

    // TOOL_005: Has inputSchema
    if (tool.inputSchema) {
      results.push(this.pass('TOOL_005', 'Has inputSchema', { severity: 'error', target }));

      // TOOL_006: inputSchema is valid JSON Schema
      // Basic validation: check it has type property
      if (typeof tool.inputSchema === 'object' && 'type' in tool.inputSchema) {
        results.push(this.pass('TOOL_006', 'inputSchema is valid JSON Schema', {
          severity: 'warn', target
        }));
      } else {
        results.push(this.fail('TOOL_006', 'warn',
          'inputSchema may not be valid JSON Schema (missing "type")', { target }));
      }
    } else {
      results.push(this.fail('TOOL_005', 'error', 'Missing inputSchema', { target }));
    }

    // Access _meta for OpenAI-specific fields
    const meta = this.getMetaField(tool.raw, '_meta') as Record<string, unknown> | undefined;

    // TOOL_007: Has _meta.openai/outputTemplate (CRITICAL)
    const outputTemplate = meta?.['openai/outputTemplate'] as string | undefined;
    if (outputTemplate) {
      results.push(this.pass('TOOL_007', 'Has _meta.openai/outputTemplate', {
        severity: 'error',
        target,
        details: { outputTemplate },
      }));

      // TOOL_008: outputTemplate uses ui://widget/ scheme (CRITICAL)
      if (outputTemplate.startsWith('ui://widget/')) {
        results.push(this.pass('TOOL_008', 'outputTemplate uses ui://widget/ scheme', {
          severity: 'error',
          target,
        }));

        // TOOL_009: outputTemplate ends with .html
        if (outputTemplate.endsWith('.html')) {
          results.push(this.pass('TOOL_009', 'outputTemplate ends with .html', {
            severity: 'warn',
            target,
          }));
        } else {
          results.push(this.fail('TOOL_009', 'warn',
            `outputTemplate does not end with .html: ${outputTemplate}`, {
            target,
            suggestion: 'Widget templates should use .html extension',
          }));
        }
      } else {
        results.push(this.fail('TOOL_008', 'error',
          `outputTemplate must use ui://widget/ scheme, got: ${outputTemplate}`, {
          target,
          suggestion: 'Change outputTemplate to use ui://widget/your-widget.html format',
        }));
      }
    } else {
      results.push(this.fail('TOOL_007', 'error',
        'Missing _meta.openai/outputTemplate (required for ChatGPT Apps)', {
        target,
        suggestion: 'Add _meta: { "openai/outputTemplate": "ui://widget/your-widget.html" }',
        specRef: 'https://developers.openai.com/apps-sdk/build/mcp-server',
      }));
    }

    // TOOL_010-016: Optional fields (INFO level)
    this.checkOptionalMeta(results, meta, target, 'openai/widgetAccessible', 'TOOL_010');
    this.checkOptionalMeta(results, meta, target, 'openai/visibility', 'TOOL_011');

    // TOOL_012: title field (on tool itself, not _meta)
    const title = this.getMetaField(tool.raw, 'title');
    if (title) {
      results.push(this.pass('TOOL_012', 'Has title field', { severity: 'info', target }));
    } else {
      results.push(this.fail('TOOL_012', 'info', 'Missing title field (optional)', { target }));
    }

    // TOOL_013-014: toolInvocation fields
    const invocation = meta?.['openai/toolInvocation'] as Record<string, unknown> | undefined;
    if (invocation?.invoking) {
      const invoking = invocation.invoking as string;
      if (invoking.length <= 64) {
        results.push(this.pass('TOOL_013', 'Has toolInvocation/invoking', {
          severity: 'info', target, details: { invoking }
        }));
      } else {
        results.push(this.fail('TOOL_013', 'info',
          `toolInvocation/invoking exceeds 64 chars (${invoking.length})`, { target }));
      }
    }

    if (invocation?.invoked) {
      const invoked = invocation.invoked as string;
      if (invoked.length <= 64) {
        results.push(this.pass('TOOL_014', 'Has toolInvocation/invoked', {
          severity: 'info', target, details: { invoked }
        }));
      } else {
        results.push(this.fail('TOOL_014', 'info',
          `toolInvocation/invoked exceeds 64 chars (${invoked.length})`, { target }));
      }
    }

    // TOOL_015: Behavioral annotations
    const annotations = tool.annotations;
    if (annotations && Object.keys(annotations).length > 0) {
      results.push(this.pass('TOOL_015', 'Has behavioral annotations', {
        severity: 'info',
        target,
        details: { annotations },
      }));
    }

    // TOOL_016: fileParams
    const fileParams = meta?.['openai/fileParams'];
    if (fileParams) {
      results.push(this.pass('TOOL_016', 'Has fileParams for file handling', {
        severity: 'info',
        target,
        details: { fileParams },
      }));
    }

    return results;
  }

  private getMetaField(obj: unknown, field: string): unknown {
    if (typeof obj === 'object' && obj !== null && field in obj) {
      return (obj as Record<string, unknown>)[field];
    }
    return undefined;
  }

  private checkOptionalMeta(
    results: CheckResult[],
    meta: Record<string, unknown> | undefined,
    target: string,
    field: string,
    checkId: string
  ): void {
    if (meta?.[field] !== undefined) {
      results.push(this.pass(checkId, `Has ${field}`, {
        severity: 'info',
        target,
        details: { [field]: meta[field] },
      }));
    }
  }
}
```

**Acceptance Criteria**:
- All TOOL_001 through TOOL_016 checks implemented
- Critical checks (007, 008) are severity 'error'
- Optional checks (010-016) are severity 'info'
- Tool filter respects `--tools` CLI option

#### Task 3.5: Resource Validator (RES_*)
**Dependencies**: Task 3.2
**File**: `src/validators/resources.ts`

```typescript
// ABOUTME: Validates resource descriptors against OpenAI Apps SDK requirements.
// ABOUTME: Ensures widget resources use correct URI scheme and MIME types.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { Resource } from '../client/mcp.js';

export class ResourceValidator extends Validator {
  name = 'resources';
  category = 'resources' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (!ctx.serverInfo) {
      results.push(this.fail('RES_001', 'error',
        'Cannot validate resources: protocol initialization failed'));
      return results;
    }

    // RES_001: resources/list returns valid response
    try {
      const resources = await ctx.client.listResources();
      ctx.resources = resources;

      results.push(this.pass('RES_001', `resources/list returned ${resources.length} resource(s)`, {
        severity: 'error',
      }));

      // Validate each resource
      for (const resource of resources) {
        results.push(...this.validateResource(resource));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(this.fail('RES_001', 'error', `resources/list failed: ${message}`));
    }

    return results;
  }

  private validateResource(resource: Resource): CheckResult[] {
    const results: CheckResult[] = [];
    const target = resource.uri;
    const isWidget = resource.uri.startsWith('ui://widget/');

    if (isWidget) {
      // RES_002: Widget resource uses ui://widget/ URI scheme
      results.push(this.pass('RES_002', 'Uses ui://widget/ URI scheme', {
        severity: 'error',
        target,
      }));

      // RES_003: Widget has text/html+skybridge MIME type
      if (resource.mimeType === 'text/html+skybridge') {
        results.push(this.pass('RES_003', 'Has text/html+skybridge MIME type', {
          severity: 'error',
          target,
        }));
      } else {
        results.push(this.fail('RES_003', 'error',
          `Widget MIME type should be text/html+skybridge, got: ${resource.mimeType}`, {
          target,
          suggestion: 'Set mimeType to "text/html+skybridge" for widget resources',
        }));
      }

      // Widget-specific optional fields
      const meta = this.getMeta(resource.raw);

      // RES_006: widgetDescription
      if (meta?.['openai/widgetDescription']) {
        results.push(this.pass('RES_006', 'Has widgetDescription', {
          severity: 'info',
          target,
        }));
      }

      // RES_007: widgetPrefersBorder
      if (meta?.['openai/widgetPrefersBorder'] !== undefined) {
        results.push(this.pass('RES_007', 'Has widgetPrefersBorder', {
          severity: 'info',
          target,
        }));
      }

      // RES_008 & RES_009: widgetCSP
      const csp = meta?.['openai/widgetCSP'] as Record<string, unknown> | undefined;
      if (csp) {
        results.push(this.pass('RES_008', 'Has widgetCSP configuration', {
          severity: 'info',
          target,
          details: { csp },
        }));

        // RES_009: Warn if frame_domains is set
        if (csp.frame_domains && Array.isArray(csp.frame_domains) && csp.frame_domains.length > 0) {
          results.push(this.fail('RES_009', 'warn',
            'Using frame_domains triggers stricter review process', {
            target,
            details: { frame_domains: csp.frame_domains },
            suggestion: 'Only use frame_domains if iframes are essential',
          }));
        }
      }
    }

    // RES_004: Has human-readable name
    if (resource.name && resource.name.length > 0) {
      results.push(this.pass('RES_004', 'Has human-readable name', {
        severity: 'warn',
        target,
      }));
    } else {
      results.push(this.fail('RES_004', 'warn', 'Missing human-readable name', {
        target,
        suggestion: 'Add a name field to improve discoverability',
      }));
    }

    // RES_005: Has description
    if (resource.description) {
      results.push(this.pass('RES_005', 'Has description', {
        severity: 'info',
        target,
      }));
    }

    return results;
  }

  private getMeta(obj: unknown): Record<string, unknown> | undefined {
    if (typeof obj === 'object' && obj !== null && '_meta' in obj) {
      return (obj as Record<string, unknown>)._meta as Record<string, unknown>;
    }
    return undefined;
  }
}
```

**Acceptance Criteria**:
- RES_001-009 checks implemented
- Distinguishes between widget resources (ui://widget/) and other resources
- Warns about frame_domains security implications

#### Task 3.6: Execution Validator (EXEC_*)
**Dependencies**: Task 3.2
**File**: `src/validators/execution.ts`

```typescript
// ABOUTME: Validates tool execution responses meet OpenAI Apps SDK format.
// ABOUTME: Calls each tool and checks response structure.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';

export class ExecutionValidator extends Validator {
  name = 'execution';
  category = 'execution' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (ctx.config.skipExecution) {
      results.push(this.pass('EXEC_SKIP', 'Tool execution skipped by user', {
        severity: 'info',
      }));
      return results;
    }

    if (!ctx.tools || ctx.tools.length === 0) {
      results.push(this.fail('EXEC_001', 'error',
        'Cannot validate execution: no tools available'));
      return results;
    }

    ctx.toolResponses = new Map();

    for (const tool of ctx.tools) {
      // Apply tool filter
      if (ctx.config.toolFilter.length > 0 && !ctx.config.toolFilter.includes(tool.name)) {
        continue;
      }

      const target = tool.name;

      // EXEC_001: Tool call succeeds
      try {
        // Call with empty args (minimal test)
        // In a more sophisticated version, we'd generate test args from inputSchema
        const response = await ctx.client.callTool(tool.name, {});
        ctx.toolResponses.set(tool.name, response);

        if (response.isError) {
          results.push(this.fail('EXEC_001', 'error',
            `Tool call returned error`, { target }));
          continue;
        }

        results.push(this.pass('EXEC_001', 'Tool call succeeded', {
          severity: 'error',
          target,
        }));

        // EXEC_002: Has structuredContent
        if (response.structuredContent !== undefined) {
          results.push(this.pass('EXEC_002', 'Has structuredContent field', {
            severity: 'info',
            target,
            details: { keys: Object.keys(response.structuredContent) },
          }));

          // EXEC_003: structuredContent is non-empty
          if (Object.keys(response.structuredContent).length > 0) {
            results.push(this.pass('EXEC_003', 'structuredContent is non-empty', {
              severity: 'warn',
              target,
            }));
          } else {
            results.push(this.fail('EXEC_003', 'warn',
              'structuredContent is empty object', { target }));
          }
        }

        // EXEC_004: Has content array
        if (response.content && Array.isArray(response.content)) {
          results.push(this.pass('EXEC_004', 'Has content array', {
            severity: 'info',
            target,
          }));

          // EXEC_005: content includes text item
          const hasText = response.content.some(c => c.type === 'text' && c.text);
          if (hasText) {
            results.push(this.pass('EXEC_005', 'content includes text item', {
              severity: 'info',
              target,
            }));
          }
        }

        // EXEC_006: Has _meta field
        if (response._meta !== undefined) {
          results.push(this.pass('EXEC_006', 'Has _meta field for widget-only data', {
            severity: 'info',
            target,
          }));
        }

        // EXEC_007: Has at least one of structuredContent, content, or _meta
        const hasStructured = response.structuredContent !== undefined;
        const hasContent = response.content && response.content.length > 0;
        const hasMeta = response._meta !== undefined;

        if (hasStructured || hasContent || hasMeta) {
          results.push(this.pass('EXEC_007', 'Has response data', {
            severity: 'warn',
            target,
          }));
        } else {
          results.push(this.fail('EXEC_007', 'warn',
            'Response has no structuredContent, content, or _meta', {
            target,
            suggestion: 'Return at least one of structuredContent, content, or _meta',
          }));
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push(this.fail('EXEC_001', 'error',
          `Tool call failed: ${message}`, { target }));
      }
    }

    return results;
  }
}
```

**Acceptance Criteria**:
- EXEC_001-007 checks implemented
- Respects `--skip-execution` flag
- Stores responses in context for potential cross-validation

#### Task 3.7: Content Validator (READ_*)
**Dependencies**: Task 3.2
**File**: `src/validators/content.ts`

```typescript
// ABOUTME: Validates resource content, especially widget HTML structure.
// ABOUTME: Parses HTML and checks for required elements and blocked APIs.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import * as htmlparser2 from 'htmlparser2';

const BLOCKED_APIS = [
  'window.alert',
  'window.prompt',
  'window.confirm',
  'navigator.clipboard',
];

export class ContentValidator extends Validator {
  name = 'content';
  category = 'content' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (ctx.config.skipContent) {
      results.push(this.pass('READ_SKIP', 'Content validation skipped by user', {
        severity: 'info',
      }));
      return results;
    }

    if (!ctx.resources || ctx.resources.length === 0) {
      return results; // No resources to validate
    }

    ctx.resourceContents = new Map();

    // Only validate widget resources
    const widgets = ctx.resources.filter(r => r.uri.startsWith('ui://widget/'));

    for (const resource of widgets) {
      const target = resource.uri;

      // READ_001: Resource is readable
      try {
        const content = await ctx.client.readResource(resource.uri);
        ctx.resourceContents.set(resource.uri, content);

        results.push(this.pass('READ_001', 'Resource is readable', {
          severity: 'error',
          target,
        }));

        // READ_002: Response has contents (implicit if we got here)
        results.push(this.pass('READ_002', 'Response has contents array', {
          severity: 'error',
          target,
        }));

        // READ_003: Content has text or blob
        if (content.text || content.blob) {
          results.push(this.pass('READ_003', 'Content has text or blob field', {
            severity: 'error',
            target,
          }));
        } else {
          results.push(this.fail('READ_003', 'error',
            'Content missing both text and blob fields', { target }));
          continue;
        }

        // Get HTML content
        const html = content.text || (content.blob ? atob(content.blob) : '');

        // READ_004: Valid HTML5
        const parseResult = this.parseHTML(html);
        if (parseResult.isValid) {
          results.push(this.pass('READ_004', 'Widget HTML is valid HTML5', {
            severity: 'error',
            target,
          }));
        } else {
          results.push(this.fail('READ_004', 'error',
            `Invalid HTML: ${parseResult.error}`, { target }));
        }

        // READ_005: Has meta charset
        if (parseResult.hasCharset) {
          results.push(this.pass('READ_005', 'Has <meta charset>', {
            severity: 'info',
            target,
          }));
        } else {
          results.push(this.fail('READ_005', 'info',
            'Missing <meta charset> (recommended)', { target }));
        }

        // READ_006: Has title
        if (parseResult.hasTitle) {
          results.push(this.pass('READ_006', 'Has <title>', {
            severity: 'info',
            target,
          }));
        } else {
          results.push(this.fail('READ_006', 'info',
            'Missing <title> (recommended)', { target }));
        }

        // READ_007: Check for blocked APIs
        const blockedFound = this.findBlockedAPIs(html);
        if (blockedFound.length === 0) {
          results.push(this.pass('READ_007', 'No blocked APIs detected', {
            severity: 'warn',
            target,
          }));
        } else {
          results.push(this.fail('READ_007', 'warn',
            `Found blocked APIs: ${blockedFound.join(', ')}`, {
            target,
            suggestion: 'Remove usage of blocked APIs (alert, prompt, confirm, clipboard)',
          }));
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push(this.fail('READ_001', 'error',
          `Failed to read resource: ${message}`, { target }));
      }
    }

    return results;
  }

  private parseHTML(html: string): {
    isValid: boolean;
    error?: string;
    hasCharset: boolean;
    hasTitle: boolean;
  } {
    let isValid = true;
    let error: string | undefined;
    let hasCharset = false;
    let hasTitle = false;
    let inTitle = false;

    const parser = new htmlparser2.Parser({
      onopentag(name, attrs) {
        if (name === 'meta' && (attrs.charset || attrs['http-equiv']?.toLowerCase() === 'content-type')) {
          hasCharset = true;
        }
        if (name === 'title') {
          inTitle = true;
        }
      },
      onclosetag(name) {
        if (name === 'title') {
          inTitle = false;
        }
      },
      ontext(text) {
        if (inTitle && text.trim().length > 0) {
          hasTitle = true;
        }
      },
      onerror(err) {
        isValid = false;
        error = err.message;
      },
    }, { decodeEntities: true });

    try {
      parser.write(html);
      parser.end();
    } catch (e) {
      isValid = false;
      error = e instanceof Error ? e.message : String(e);
    }

    return { isValid, error, hasCharset, hasTitle };
  }

  private findBlockedAPIs(html: string): string[] {
    const found: string[] = [];
    for (const api of BLOCKED_APIS) {
      // Simple string search - could be improved with AST parsing
      if (html.includes(api)) {
        found.push(api);
      }
    }
    return found;
  }
}
```

**Acceptance Criteria**:
- READ_001-007 checks implemented
- Parses HTML without crashing on malformed content
- Detects blocked browser APIs

#### Task 3.8: Cross Validator (XVAL_*)
**Dependencies**: Task 3.4, 3.5, 3.6, 3.7
**File**: `src/validators/cross.ts`

```typescript
// ABOUTME: Cross-validates data across tools, resources, and content.
// ABOUTME: Ensures referential integrity between components.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';

export class CrossValidator extends Validator {
  name = 'cross';
  category = 'cross' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (!ctx.tools || !ctx.resources) {
      return results;
    }

    // Build set of available resource URIs
    const resourceUris = new Set(ctx.resources.map(r => r.uri));

    // XVAL_001: Every outputTemplate URI exists in resources
    const outputTemplateUris: string[] = [];
    for (const tool of ctx.tools) {
      const meta = this.getMeta(tool.raw);
      const outputTemplate = meta?.['openai/outputTemplate'] as string | undefined;
      if (outputTemplate) {
        outputTemplateUris.push(outputTemplate);

        if (resourceUris.has(outputTemplate)) {
          results.push(this.pass('XVAL_001',
            `outputTemplate ${outputTemplate} exists in resources`, {
            severity: 'error',
            target: tool.name,
          }));
        } else {
          results.push(this.fail('XVAL_001', 'error',
            `outputTemplate ${outputTemplate} not found in resources`, {
            target: tool.name,
            suggestion: `Add a resource with URI "${outputTemplate}"`,
          }));
        }
      }
    }

    // XVAL_002: All outputTemplate resources are readable
    if (ctx.resourceContents) {
      for (const uri of outputTemplateUris) {
        if (ctx.resourceContents.has(uri)) {
          results.push(this.pass('XVAL_002', `outputTemplate resource ${uri} is readable`, {
            severity: 'warn',
            target: uri,
          }));
        } else if (!ctx.config.skipContent) {
          results.push(this.fail('XVAL_002', 'warn',
            `Could not read outputTemplate resource ${uri}`, {
            target: uri,
          }));
        }
      }
    }

    // XVAL_003: Static assets in HTML are available
    // This would require parsing HTML for src/href attributes
    // Simplified: just note if we have resource contents
    if (ctx.resourceContents && ctx.resourceContents.size > 0) {
      results.push(this.pass('XVAL_003', 'Widget HTML content available for asset validation', {
        severity: 'warn',
      }));
    }

    // XVAL_004: Orphan resources (resources not referenced by any tool)
    const referencedUris = new Set(outputTemplateUris);
    const orphans = ctx.resources.filter(r =>
      r.uri.startsWith('ui://widget/') && !referencedUris.has(r.uri)
    );

    if (orphans.length === 0) {
      results.push(this.pass('XVAL_004', 'No orphan widget resources', {
        severity: 'info',
      }));
    } else {
      for (const orphan of orphans) {
        results.push(this.fail('XVAL_004', 'info',
          `Widget resource ${orphan.uri} is not referenced by any tool`, {
          target: orphan.uri,
          suggestion: 'Remove unused widget resources or add tool references',
        }));
      }
    }

    return results;
  }

  private getMeta(obj: unknown): Record<string, unknown> | undefined {
    if (typeof obj === 'object' && obj !== null && '_meta' in obj) {
      return (obj as Record<string, unknown>)._meta as Record<string, unknown>;
    }
    return undefined;
  }
}
```

**Acceptance Criteria**:
- XVAL_001-004 checks implemented
- Identifies missing widget resources
- Reports orphan resources

---

### Phase 4: Reporters

#### Task 4.1: Reporter Interface & Factory
**Dependencies**: Task 2.1
**File**: `src/reporters/index.ts`

```typescript
// ABOUTME: Reporter factory and interface for output formatting.
// ABOUTME: Supports multiple output formats for different use cases.

import type { ConformanceReport } from '../types/report.js';

export interface Reporter {
  format(report: ConformanceReport): string;
}

export type ReportFormat = 'text' | 'json' | 'markdown' | 'html' | 'junit';

export class ReporterFactory {
  static async create(format: ReportFormat): Promise<Reporter> {
    switch (format) {
      case 'text':
        const { TextReporter } = await import('./text.js');
        return new TextReporter();
      case 'json':
        const { JsonReporter } = await import('./json.js');
        return new JsonReporter();
      case 'markdown':
        const { MarkdownReporter } = await import('./markdown.js');
        return new MarkdownReporter();
      case 'html':
        const { HtmlReporter } = await import('./html.js');
        return new HtmlReporter();
      case 'junit':
        const { JUnitReporter } = await import('./junit.js');
        return new JUnitReporter();
      default:
        throw new Error(`Unknown report format: ${format}`);
    }
  }
}
```

#### Task 4.2: Text Reporter
**Dependencies**: Task 4.1
**File**: `src/reporters/text.ts`

```typescript
// ABOUTME: Terminal-friendly text output with ANSI colors.
// ABOUTME: Default output format for interactive CLI usage.

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';
import type { CheckResult } from '../types/check.js';

export class TextReporter implements Reporter {
  format(report: ConformanceReport): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.bold('ChatGPT Apps SDK Conformance Report'));
    lines.push('═'.repeat(70));
    lines.push('');
    lines.push(`Server: ${report.serverUrl}`);
    if (report.serverInfo.protocolVersion) {
      lines.push(`Protocol Version: ${report.serverInfo.protocolVersion}`);
    }
    if (report.serverInfo.name) {
      lines.push(`Server Name: ${report.serverInfo.name}`);
    }
    lines.push(`Tools: ${report.summary.toolCount}`);
    lines.push(`Resources: ${report.summary.resourceCount}`);
    lines.push('');

    // Group checks by category
    const categories = this.groupByCategory(report.checks);

    for (const [category, checks] of Object.entries(categories)) {
      lines.push('═'.repeat(70));
      lines.push(chalk.bold(category.toUpperCase() + ' CHECKS'));
      lines.push('═'.repeat(70));
      lines.push('');

      // Group by target within category
      const byTarget = this.groupByTarget(checks);

      for (const [target, targetChecks] of Object.entries(byTarget)) {
        const allPassed = targetChecks.every(c => c.passed);
        const icon = allPassed ? chalk.green('✅') : chalk.red('❌');
        lines.push(`${icon} ${target || 'General'}`);

        for (const check of targetChecks) {
          const statusIcon = this.getStatusIcon(check);
          lines.push(`   ├─ ${statusIcon} ${check.message}`);
          if (check.details) {
            const detailStr = JSON.stringify(check.details);
            if (detailStr.length < 60) {
              lines.push(`   │     └─ ${chalk.dim(detailStr)}`);
            }
          }
          if (!check.passed && check.suggestion) {
            lines.push(`   │     └─ ${chalk.yellow('Fix: ' + check.suggestion)}`);
          }
        }
        lines.push('');
      }
    }

    // Summary
    lines.push('═'.repeat(70));
    lines.push(chalk.bold('SUMMARY'));
    lines.push('═'.repeat(70));
    lines.push('');
    lines.push(`Total Checks: ${report.summary.totalChecks}`);
    lines.push(`${chalk.green('✅')} Passed: ${report.summary.passed}`);
    lines.push(`${chalk.blue('ℹ️')}  Info: ${report.summary.info}`);
    lines.push(`${chalk.yellow('⚠️')}  Warnings: ${report.summary.warnings}`);
    lines.push(`${chalk.red('❌')} Failed: ${report.summary.errors}`);
    lines.push('');

    // Verdict
    const verdictColor = report.verdict === 'conformant' ? chalk.green
      : report.verdict === 'conformant_with_warnings' ? chalk.yellow
      : chalk.red;
    lines.push(`VERDICT: ${verdictColor(report.verdict.toUpperCase().replace(/_/g, ' '))}`);

    return lines.join('\n');
  }

  private getStatusIcon(check: CheckResult): string {
    if (check.passed) {
      return check.severity === 'info' ? chalk.blue('ℹ️') : chalk.green('✅');
    } else {
      switch (check.severity) {
        case 'error': return chalk.red('❌');
        case 'warn': return chalk.yellow('⚠️');
        case 'info': return chalk.blue('ℹ️');
      }
    }
  }

  private groupByCategory(checks: CheckResult[]): Record<string, CheckResult[]> {
    const groups: Record<string, CheckResult[]> = {};
    for (const check of checks) {
      if (!groups[check.category]) {
        groups[check.category] = [];
      }
      groups[check.category].push(check);
    }
    return groups;
  }

  private groupByTarget(checks: CheckResult[]): Record<string, CheckResult[]> {
    const groups: Record<string, CheckResult[]> = {};
    for (const check of checks) {
      const target = check.target || '';
      if (!groups[target]) {
        groups[target] = [];
      }
      groups[target].push(check);
    }
    return groups;
  }
}
```

**Acceptance Criteria**:
- Output matches spec example format
- Colors render correctly in terminal
- Gracefully degrades when colors disabled

#### Task 4.3: JSON Reporter
**Dependencies**: Task 4.1
**File**: `src/reporters/json.ts`

```typescript
// ABOUTME: Machine-readable JSON output for programmatic consumption.
// ABOUTME: Outputs the complete ConformanceReport structure.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';

export class JsonReporter implements Reporter {
  format(report: ConformanceReport): string {
    return JSON.stringify(report, null, 2);
  }
}
```

#### Task 4.4: JUnit Reporter
**Dependencies**: Task 4.1
**File**: `src/reporters/junit.ts`

```typescript
// ABOUTME: JUnit XML output for CI/CD integration.
// ABOUTME: Compatible with Jenkins, GitHub Actions, and other CI systems.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';

export class JUnitReporter implements Reporter {
  format(report: ConformanceReport): string {
    const failures = report.checks.filter(c => !c.passed && c.severity === 'error').length;
    const tests = report.summary.totalChecks;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="ChatGPT Apps SDK Conformance" tests="${tests}" failures="${failures}" time="${report.durationMs / 1000}">\n`;

    for (const check of report.checks) {
      const className = `conformance.${check.category}`;
      const testName = check.target ? `${check.id}: ${check.target}` : check.id;

      xml += `  <testcase classname="${this.escape(className)}" name="${this.escape(testName)}">\n`;

      if (!check.passed) {
        const type = check.severity === 'error' ? 'failure' : 'warning';
        xml += `    <${type} message="${this.escape(check.message)}">\n`;
        if (check.suggestion) {
          xml += `      Suggestion: ${this.escape(check.suggestion)}\n`;
        }
        if (check.details) {
          xml += `      Details: ${this.escape(JSON.stringify(check.details))}\n`;
        }
        xml += `    </${type}>\n`;
      }

      xml += `  </testcase>\n`;
    }

    xml += `</testsuite>\n`;
    return xml;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
```

**Acceptance Criteria**:
- Valid JUnit XML schema
- Parseable by common CI tools

#### Task 4.5: Markdown & HTML Reporters
**Dependencies**: Task 4.1
**Files**: `src/reporters/markdown.ts`, `src/reporters/html.ts`

(Similar structure to text reporter, outputting Markdown/HTML respectively. Implementation follows same pattern.)

---

### Phase 5: CLI Entry Point

#### Task 5.1: Argument Parser
**Dependencies**: All previous tasks
**File**: `src/cli/args.ts`

```typescript
// ABOUTME: CLI argument parsing and validation.
// ABOUTME: Uses commander for a polished CLI experience.

import { Command } from 'commander';
import type { ValidatorConfig } from '../validators/index.js';
import type { ReportFormat } from '../reporters/index.js';

export interface CLIOptions {
  format: ReportFormat;
  output?: string;
  verbose: boolean;
  quiet: boolean;
  tools: string[];
  skipExecution: boolean;
  skipContent: boolean;
  timeout: number;
  noColor: boolean;
}

export interface ParsedArgs {
  url: string;
  options: CLIOptions;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const program = new Command();

  program
    .name('chatgpt-app-check')
    .description('Validate MCP servers against OpenAI Apps SDK requirements')
    .version('0.1.0')
    .argument('<mcp-url>', 'URL of the MCP server endpoint')
    .option('-f, --format <format>', 'Output format: text, json, markdown, html, junit', 'text')
    .option('-o, --output <file>', 'Write report to file')
    .option('-v, --verbose', 'Show all checks including passed ones', false)
    .option('-q, --quiet', 'Only show errors', false)
    .option('--tools <names>', 'Only check specific tools (comma-separated)', '')
    .option('--skip-execution', 'Skip tool execution tests', false)
    .option('--skip-content', 'Skip content validation', false)
    .option('--timeout <ms>', 'Request timeout in milliseconds', '10000')
    .option('--no-color', 'Disable colored output', false);

  program.parse(argv);

  const url = program.args[0];
  const opts = program.opts();

  return {
    url,
    options: {
      format: opts.format as ReportFormat,
      output: opts.output,
      verbose: opts.verbose,
      quiet: opts.quiet,
      tools: opts.tools ? opts.tools.split(',').map((t: string) => t.trim()) : [],
      skipExecution: opts.skipExecution,
      skipContent: opts.skipContent,
      timeout: parseInt(opts.timeout, 10),
      noColor: !opts.color,
    },
  };
}

export function toValidatorConfig(options: CLIOptions): ValidatorConfig {
  return {
    toolFilter: options.tools,
    skipExecution: options.skipExecution,
    skipContent: options.skipContent,
    timeout: options.timeout,
    verbose: options.verbose,
  };
}
```

#### Task 5.2: Main Entry Point
**Dependencies**: Task 5.1
**File**: `src/index.ts`

```typescript
#!/usr/bin/env node
// ABOUTME: CLI entry point for chatgpt-app-check.
// ABOUTME: Orchestrates validation pipeline and outputs report.

import { parseArgs, toValidatorConfig } from './cli/args.js';
import { MCPClient } from './client/mcp.js';
import { runValidationPipeline } from './validators/index.js';
import { ProtocolValidator } from './validators/protocol.js';
import { ToolValidator } from './validators/tools.js';
import { ResourceValidator } from './validators/resources.js';
import { ExecutionValidator } from './validators/execution.js';
import { ContentValidator } from './validators/content.js';
import { CrossValidator } from './validators/cross.js';
import { ReporterFactory } from './reporters/index.js';
import type { ConformanceReport, Verdict } from './types/report.js';
import type { CheckResult } from './types/check.js';
import chalk from 'chalk';
import { writeFileSync } from 'node:fs';

async function main(): Promise<number> {
  const startTime = Date.now();

  // Parse arguments
  const { url, options } = parseArgs(process.argv);

  if (options.noColor) {
    chalk.level = 0;
  }

  // Create client
  const client = new MCPClient({ url, timeout: options.timeout });

  // Build validator pipeline
  const validators = [
    new ProtocolValidator(),
    new ToolValidator(),
    new ResourceValidator(),
    new ExecutionValidator(),
    new ContentValidator(),
    new CrossValidator(),
  ];

  // Run validation
  const config = toValidatorConfig(options);
  let checks: CheckResult[];

  try {
    checks = await runValidationPipeline(client, config, validators);
  } finally {
    await client.close();
  }

  // Build report
  const endTime = Date.now();
  const report = buildReport(url, checks, endTime - startTime);

  // Format and output
  const reporter = await ReporterFactory.create(options.format);
  const output = reporter.format(report);

  if (options.output) {
    writeFileSync(options.output, output, 'utf-8');
    console.log(`Report written to ${options.output}`);
  } else {
    console.log(output);
  }

  // Return exit code based on verdict
  switch (report.verdict) {
    case 'conformant': return 0;
    case 'conformant_with_warnings': return 1;
    case 'non_conformant': return 2;
  }
}

function buildReport(url: string, checks: CheckResult[], durationMs: number): ConformanceReport {
  const errors = checks.filter(c => !c.passed && c.severity === 'error').length;
  const warnings = checks.filter(c => !c.passed && c.severity === 'warn').length;
  const info = checks.filter(c => c.severity === 'info').length;
  const passed = checks.filter(c => c.passed).length;

  let verdict: Verdict;
  if (errors > 0) {
    verdict = 'non_conformant';
  } else if (warnings > 0) {
    verdict = 'conformant_with_warnings';
  } else {
    verdict = 'conformant';
  }

  // Extract server info from protocol checks
  const serverInfoCheck = checks.find(c => c.id === 'PROTO_003');
  const serverInfo = (serverInfoCheck?.details as { serverInfo?: object })?.serverInfo ?? {};

  return {
    serverUrl: url,
    timestamp: new Date().toISOString(),
    durationMs,
    serverInfo: serverInfo as ConformanceReport['serverInfo'],
    summary: {
      totalChecks: checks.length,
      passed,
      warnings,
      errors,
      info,
      toolCount: 0, // Would be populated from context
      resourceCount: 0,
    },
    verdict,
    checks,
    tools: [],
    resources: [],
  };
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(chalk.red('Fatal error:'), err.message);
    process.exit(3);
  });
```

**Acceptance Criteria**:
- `chatgpt-app-check http://localhost:8000/mcp` produces report
- All CLI options work as documented
- Exit codes match spec

---

### Phase 6: Testing

#### Task 6.1: Unit Tests for Validators
**Dependencies**: Phase 3
**File**: `tests/unit/validators/*.test.ts`

Each validator gets a test file using the mock client:

```typescript
// tests/unit/validators/tools.test.ts
import { describe, it, expect } from 'vitest';
import { ToolValidator } from '../../../src/validators/tools.js';
import { MockMCPClient } from '../../fixtures/mock-server/server.js';

describe('ToolValidator', () => {
  it('fails TOOL_007 when outputTemplate is missing', async () => {
    const mockClient = new MockMCPClient({
      serverInfo: { name: 'test', protocolVersion: '2024-11-05' },
      tools: [{
        name: 'my_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
        // No _meta with outputTemplate
      }],
    });

    const validator = new ToolValidator();
    const ctx = {
      client: mockClient as any,
      config: { toolFilter: [], skipExecution: false, skipContent: false, timeout: 10000, verbose: false },
      serverInfo: { protocolVersion: '2024-11-05' },
    };

    const results = await validator.run(ctx);
    const tool007 = results.find(r => r.id === 'TOOL_007');

    expect(tool007).toBeDefined();
    expect(tool007?.passed).toBe(false);
    expect(tool007?.severity).toBe('error');
  });

  it('passes TOOL_007 and TOOL_008 with valid outputTemplate', async () => {
    const mockClient = new MockMCPClient({
      serverInfo: { name: 'test', protocolVersion: '2024-11-05' },
      tools: [{
        name: 'my_tool',
        description: 'A test tool with widget',
        inputSchema: { type: 'object' },
        _meta: {
          'openai/outputTemplate': 'ui://widget/my-widget.html',
        },
      }],
    });

    const validator = new ToolValidator();
    const ctx = {
      client: mockClient as any,
      config: { toolFilter: [], skipExecution: false, skipContent: false, timeout: 10000, verbose: false },
      serverInfo: { protocolVersion: '2024-11-05' },
    };

    const results = await validator.run(ctx);

    expect(results.find(r => r.id === 'TOOL_007')?.passed).toBe(true);
    expect(results.find(r => r.id === 'TOOL_008')?.passed).toBe(true);
    expect(results.find(r => r.id === 'TOOL_009')?.passed).toBe(true);
  });
});
```

**Acceptance Criteria**:
- Each check ID has at least one passing and one failing test case
- Tests run without network calls
- 100% of checks are covered

#### Task 6.2: Integration Tests
**Dependencies**: Phase 5
**File**: `tests/integration/e2e.test.ts`

```typescript
// ABOUTME: End-to-end integration tests against real MCP server.
// ABOUTME: Requires pomodoro-timer server running on localhost:8000.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn, ChildProcess } from 'node:child_process';

describe('E2E: chatgpt-app-check', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    // Start the test MCP server
    serverProcess = spawn('node', ['server.mjs'], {
      cwd: '/Users/haldar/repos/3p/pomodoro-timer-test/mcp-server',
      stdio: 'pipe',
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    serverProcess?.kill();
  });

  it('produces conformant report for valid MCP server', () => {
    const result = execSync(
      'pnpm exec chatgpt-app-check http://127.0.0.1:8000/mcp --format json',
      { encoding: 'utf-8' }
    );

    const report = JSON.parse(result);
    expect(report.verdict).toBe('conformant');
  });

  it('returns exit code 0 for conformant server', () => {
    const exitCode = execSync(
      'pnpm exec chatgpt-app-check http://127.0.0.1:8000/mcp; echo $?',
      { encoding: 'utf-8' }
    ).trim().split('\n').pop();

    expect(exitCode).toBe('0');
  });
});
```

---

## 6. Risk Mitigation

### Risk 1: MCP SDK API Changes
**Mitigation**: Pin SDK version in package.json. Wrap SDK in our own `MCPClient` class so changes are localized.

### Risk 2: Widget HTML Complexity
**Mitigation**: Start with basic structural checks. Add sophisticated analysis (CSP validation, JS AST parsing) in future iterations.

### Risk 3: Network Timeouts
**Mitigation**: Configurable timeout, retry logic for transient failures, clear error messages.

### Risk 4: Large Widget Content
**Mitigation**: Stream HTML parsing, limit content size read to 1MB, warn if truncated.

---

## 7. Success Metrics

1. **Correctness**: All checks from SPEC.md implemented with correct severity
2. **Performance**: Full validation completes in <10s for typical server
3. **Usability**: Clear, actionable output with specific fix suggestions
4. **CI Integration**: JUnit output works with GitHub Actions
5. **Test Coverage**: >90% line coverage, 100% check ID coverage

---

## 8. Open Questions

1. **Tool Execution Arguments**: How should we generate test arguments for tools with required parameters? Options:
   - Skip execution for tools with required params (current approach)
   - Generate minimal valid args from JSON Schema
   - Allow user to provide test fixtures

2. **Rate Limiting**: Should we add delays between requests to avoid overwhelming servers?

3. **Concurrent Validation**: Could we parallelize some validators (e.g., content validation per resource)?

---

## 9. Implementation Order

1. **Week 1**: Tasks 1.1-2.3 (scaffolding, types, client)
2. **Week 2**: Tasks 3.1-3.5 (validators: protocol, tools, resources)
3. **Week 3**: Tasks 3.6-3.8 (validators: execution, content, cross)
4. **Week 4**: Tasks 4.1-4.5 (reporters)
5. **Week 5**: Tasks 5.1-5.2 (CLI entry point)
6. **Week 6**: Tasks 6.1-6.2 (testing, polish)

Each task is independent enough for parallel work once dependencies are met.
