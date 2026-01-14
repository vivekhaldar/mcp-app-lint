# ChatGPT Apps SDK Conformance Checker - Specification

## Overview

A CLI tool that validates whether an MCP server conforms to the [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/build/mcp-server) requirements for ChatGPT Apps.

**Problem**: Building ChatGPT Apps requires precise adherence to underdocumented protocol requirements. Developers often discover issues only after deployment, leading to widgets that don't render, broken tool calls, or missing data.

**Solution**: An automated conformance checker that validates MCP servers against Apps SDK requirements and produces actionable reports.

## Usage

```bash
# Basic usage
chatgpt-app-check http://localhost:8000/mcp

# With options
chatgpt-app-check http://localhost:8000/mcp \
  --format json \
  --output report.json \
  --verbose

# Check specific tools only
chatgpt-app-check http://localhost:8000/mcp --tools "tool1,tool2"
```

## Output Example

```
ChatGPT Apps SDK Conformance Report
═══════════════════════════════════════════════════════════════════

Server: http://localhost:8000/mcp
Protocol Version: 2025-11-25
Server Name: pomodoro-timer
Tools: 1
Resources: 2

═══════════════════════════════════════════════════════════════════
TOOL CHECKS
═══════════════════════════════════════════════════════════════════

✅ pomodoro_timer
   ├─ ✅ Has _meta.openai/outputTemplate
   │     └─ Value: ui://widget/pomodoro-timer.html
   ├─ ✅ outputTemplate uses ui://widget/ scheme
   ├─ ✅ Has valid inputSchema
   ├─ ℹ️  Has structuredContent in response
   │     └─ Keys: state, mode, remaining_seconds, message
   ├─ ℹ️  Has content array in response
   └─ ℹ️  Missing title field (optional)

═══════════════════════════════════════════════════════════════════
RESOURCE CHECKS
═══════════════════════════════════════════════════════════════════

✅ ui://widget/pomodoro-timer.html
   ├─ ✅ Uses ui://widget/ scheme
   ├─ ✅ MIME type is text/html+skybridge
   ├─ ✅ Resource readable
   ├─ ✅ Content is valid HTML
   └─ ℹ️  Missing _meta.openai/widgetCSP (optional)

✅ file:///src/css/style.css
   ├─ ✅ Resource readable
   └─ ✅ MIME type is text/css

═══════════════════════════════════════════════════════════════════
CROSS-VALIDATION
═══════════════════════════════════════════════════════════════════

✅ All outputTemplate URIs have matching resources
✅ Widget HTML references resolve to available resources

═══════════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════════

Total Checks: 16
✅ Passed: 12
ℹ️  Info: 4
⚠️  Warnings: 0
❌ Failed: 0

VERDICT: CONFORMANT
```

## Validation Checks

### Phase 1: Connection & Protocol

| Check | Severity | Description |
|-------|----------|-------------|
| `CONN_001` | ERROR | Server responds to HTTP POST |
| `CONN_002` | ERROR | Server accepts `application/json` content type |
| `CONN_003` | ERROR | Server returns valid JSON-RPC responses |
| `PROTO_001` | ERROR | `initialize` returns valid protocol version |
| `PROTO_002` | WARN | Protocol version is `2024-11-05` or later (current: `2025-11-25`) |
| `PROTO_003` | INFO | Server reports capabilities |

### Phase 2: Tool Descriptor Validation (`tools/list`)

| Check | Severity | Description |
|-------|----------|-------------|
| `TOOL_001` | ERROR | `tools/list` returns valid response |
| `TOOL_002` | ERROR | Each tool has `name` field |
| `TOOL_003` | ERROR | Each tool has `description` field |
| `TOOL_004` | WARN | Description is meaningful (>10 chars) |
| `TOOL_005` | ERROR | Each tool has `inputSchema` |
| `TOOL_006` | WARN | `inputSchema` is valid JSON Schema |
| `TOOL_007` | **ERROR** | Tool has `_meta.openai/outputTemplate` |
| `TOOL_008` | **ERROR** | `outputTemplate` uses `ui://widget/` scheme |
| `TOOL_009` | WARN | `outputTemplate` ends with `.html` |
| `TOOL_010` | INFO | Tool has `_meta.openai/widgetAccessible` |
| `TOOL_011` | INFO | Tool has `_meta.openai/visibility` (`public`/`private`) |
| `TOOL_012` | INFO | Tool has `title` field (human-readable label) |
| `TOOL_013` | INFO | Tool has `_meta.openai/toolInvocation/invoking` (≤64 chars) |
| `TOOL_014` | INFO | Tool has `_meta.openai/toolInvocation/invoked` (≤64 chars) |
| `TOOL_015` | INFO | Tool has behavioral annotations (`readOnlyHint`, `destructiveHint`, etc.) |
| `TOOL_016` | INFO | Tool has `_meta.openai/fileParams` if accepting files |

### Phase 3: Resource Validation (`resources/list`)

| Check | Severity | Description |
|-------|----------|-------------|
| `RES_001` | ERROR | `resources/list` returns valid response |
| `RES_002` | **ERROR** | Widget resource uses `ui://widget/` URI scheme |
| `RES_003` | **ERROR** | Widget resource has `text/html+skybridge` MIME type |
| `RES_004` | ERROR | Resource has human-readable `name` (required by MCP spec) |
| `RES_005` | INFO | Resource has `description` |
| `RES_006` | INFO | Widget has `_meta.openai/widgetDescription` |
| `RES_007` | INFO | Widget has `_meta.openai/widgetPrefersBorder` |
| `RES_008` | INFO | Widget has `_meta.openai/widgetCSP` with security allowlists |
| `RES_009` | WARN | If `_meta.openai/widgetCSP.frame_domains` is set, warn about stricter review |

### Phase 4: Tool Execution Validation (`tools/call`)

The OpenAI Apps SDK tool response format uses three optional sibling fields:
- `structuredContent`: JSON visible to both model and widget
- `content`: Array of content items (text/image) for model narration
- `_meta`: Large/sensitive data visible only to widget

| Check | Severity | Description |
|-------|----------|-------------|
| `EXEC_001` | ERROR | Tool call succeeds without error |
| `EXEC_002` | INFO | Response has `structuredContent` field (optional but recommended) |
| `EXEC_003` | WARN | If `structuredContent` present, is non-empty object |
| `EXEC_004` | INFO | Response has `content` array (optional) |
| `EXEC_005` | INFO | If `content` present, includes text item |
| `EXEC_006` | INFO | Response has `_meta` field for widget-only data (optional) |
| `EXEC_007` | WARN | Response has at least one of `structuredContent`, `content`, or `_meta` |

### Phase 5: Resource Content Validation (`resources/read`)

Note: Widget HTML should inline assets or load from CSP-approved `resource_domains`.
The `<base href>` tag is NOT required per official docs.

| Check | Severity | Description |
|-------|----------|-------------|
| `READ_001` | ERROR | Resource is readable |
| `READ_002` | ERROR | Response has `contents` array |
| `READ_003` | ERROR | Content item has `text` or `blob` field |
| `READ_004` | **ERROR** | Widget HTML is valid HTML5 |
| `READ_005` | INFO | Widget HTML has `<meta charset>` (recommended) |
| `READ_006` | INFO | Widget HTML has `<title>` (recommended) |
| `READ_007` | WARN | Widget does not use blocked APIs (`window.alert`, `window.prompt`, etc.) |

### Phase 6: Cross-Validation

| Check | Severity | Description |
|-------|----------|-------------|
| `XVAL_001` | **ERROR** | Every `outputTemplate` URI exists in resources |
| `XVAL_002` | WARN | All `outputTemplate` resources are readable |
| `XVAL_003` | WARN | Static assets referenced in HTML are available |
| `XVAL_004` | INFO | No orphan resources (resources not referenced by tools) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    chatgpt-app-check CLI                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ MCP Client   │  │ Validators   │  │ Reporter             │  │
│  │              │  │              │  │                      │  │
│  │ - initialize │  │ - Protocol   │  │ - Text (terminal)    │  │
│  │ - tools/list │  │ - Tools      │  │ - JSON               │  │
│  │ - tools/call │  │ - Resources  │  │ - Markdown           │  │
│  │ - resources  │  │ - Execution  │  │ - HTML               │  │
│  │   /list      │  │ - Content    │  │ - JUnit XML          │  │
│  │   /read      │  │ - Cross-val  │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                  │                    │               │
│         ▼                  ▼                    ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     CheckResult[]                         │  │
│  │  { id, severity, passed, message, details, suggestion }   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Structures

### CheckResult

```typescript
interface CheckResult {
  id: string;           // e.g., "TOOL_007"
  category: Category;   // "protocol" | "tools" | "resources" | "execution" | "content" | "cross"
  severity: Severity;   // "error" | "warn" | "info"
  passed: boolean;
  target?: string;      // Tool name or resource URI being checked
  message: string;      // Human-readable description
  details?: unknown;    // Additional context (values found, etc.)
  suggestion?: string;  // How to fix if failed
  spec_ref?: string;    // Link to relevant documentation
}

type Severity = "error" | "warn" | "info";
type Category = "protocol" | "tools" | "resources" | "execution" | "content" | "cross";
```

### ConformanceReport

```typescript
interface ConformanceReport {
  server_url: string;
  timestamp: string;
  duration_ms: number;

  server_info: {
    name?: string;
    version?: string;
    protocol_version?: string;
  };

  summary: {
    total_checks: number;
    passed: number;
    warnings: number;
    errors: number;
    tool_count: number;
    resource_count: number;
  };

  verdict: "conformant" | "conformant_with_warnings" | "non_conformant";

  checks: CheckResult[];

  tools: ToolInfo[];
  resources: ResourceInfo[];
}
```

## CLI Options

```
chatgpt-app-check <mcp-url>

Arguments:
  mcp-url                    URL of the MCP server endpoint

Options:
  -f, --format <format>      Output format: text, json, markdown, html, junit
                             (default: "text")
  -o, --output <file>        Write report to file instead of stdout
  -v, --verbose              Show all checks including passed ones
  -q, --quiet                Only show errors (no warnings or info)
  --tools <names>            Only check specific tools (comma-separated)
  --execute                  Enable tool execution (DISABLED by default for safety)
  --execute-safe             Execute only tools marked readOnlyHint=true
  --skip-content             Skip content validation (HTML parsing)
  --timeout <ms>             Request timeout in milliseconds (default: 10000)
  --auth <token>             Authorization header value (e.g., "Bearer <token>")
  -H, --header <header>      Custom header as key:value (repeatable)
  --no-color                 Disable colored output
  -h, --help                 Show help
  --version                  Show version
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Conformant (all checks passed) |
| 1 | Conformant with warnings |
| 2 | Non-conformant (errors found) |
| 3 | Connection/protocol error |
| 4 | Invalid arguments |

## Implementation Plan

### Phase 1: Core Infrastructure
1. Project setup (TypeScript, pnpm)
2. MCP client implementation (JSON-RPC over HTTP with SSE parsing)
3. Check result data structures
4. Basic text reporter

### Phase 2: Validators
1. Protocol validator (CONN_*, PROTO_*)
2. Tool validator (TOOL_*)
3. Resource validator (RES_*)
4. Execution validator (EXEC_*)
5. Content validator (READ_*)
6. Cross-validator (XVAL_*)

### Phase 3: Reporters
1. JSON reporter
2. Markdown reporter
3. HTML reporter (for CI artifacts)
4. JUnit XML reporter (for CI integration)

### Phase 4: Polish
1. CLI argument parsing
2. Progress indicators
3. Colored output
4. Error handling and retries
5. Documentation

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **Package Manager**: pnpm
- **HTTP Client**: Native fetch or undici
- **HTML Parser**: htmlparser2 (for content validation)
- **CLI Framework**: commander or yargs
- **Testing**: Vitest
- **Output Formatting**: chalk (colors), cli-table3 (tables)

## Future Enhancements

1. **Watch mode**: Re-run checks when server changes
2. **Baseline comparison**: Compare against previous run
3. **Custom rules**: User-defined validation rules via config
4. **Performance metrics**: Response time thresholds
5. **Security checks**: CSP validation, XSS detection in widget HTML
6. **Interactive mode**: Step through checks with explanations
7. **Fix suggestions**: Generate code patches for common issues
8. **MCP server templates**: Generate compliant server scaffolding

## OpenAI Apps SDK Field Reference

### Tool `_meta` Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `openai/outputTemplate` | string (URI) | **Yes** | Widget template URI (e.g., `ui://widget/name.html`) |
| `openai/widgetAccessible` | boolean | No | Enable `window.openai.callTool` from widget (default: false) |
| `openai/visibility` | string | No | `public` (default) or `private` (hide from model) |
| `openai/toolInvocation/invoking` | string | No | Status text during execution (≤64 chars) |
| `openai/toolInvocation/invoked` | string | No | Completion status text (≤64 chars) |
| `openai/fileParams` | string[] | No | Top-level input fields treated as files |

### Tool Annotations (Behavioral Hints)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `readOnlyHint` | boolean | false | Tool never modifies state |
| `destructiveHint` | boolean | false | Tool may cause irreversible changes |
| `openWorldHint` | boolean | false | Tool confined to user accounts only |
| `idempotentHint` | boolean | false | Repeated calls are safe |

### Resource `_meta` Fields

| Field | Type | Description |
|-------|------|-------------|
| `openai/widgetDescription` | string | Model-visible summary of widget |
| `openai/widgetPrefersBorder` | boolean | Render with bordered card hint |
| `openai/widgetDomain` | string (origin) | Custom subdomain for widget |
| `openai/widgetCSP` | object | Content Security Policy configuration |

### CSP Configuration (`openai/widgetCSP`)

| Field | Type | Description |
|-------|------|-------------|
| `connect_domains` | string[] | Allowed fetch/XHR destinations |
| `resource_domains` | string[] | Allowed static asset origins |
| `frame_domains` | string[] | Allowed iframe sources (triggers stricter review) |
| `redirect_domains` | string[] | Allowed `openExternal` targets |

### Tool Response Format

```json
{
  "structuredContent": { ... },  // Optional: JSON for model AND widget
  "content": [                   // Optional: Narration for model
    { "type": "text", "text": "..." }
  ],
  "_meta": { ... }               // Optional: Widget-only data (never reaches model)
}
```

### Client-Provided Metadata (sent TO server)

| Field | Description |
|-------|-------------|
| `openai/locale` | BCP 47 locale preference |
| `openai/userAgent` | Analytics/formatting hint |
| `openai/userLocation` | Coarse location (city, region, timezone) |
| `openai/subject` | Anonymized user ID |

### Blocked Browser APIs in Widgets

Widgets operate in sandboxed iframes with these APIs blocked:
- `window.alert`
- `window.prompt`
- `window.confirm`
- `navigator.clipboard`

## References

- [OpenAI Apps SDK - MCP Server](https://developers.openai.com/apps-sdk/build/mcp-server)
- [OpenAI Apps SDK - Reference](https://developers.openai.com/apps-sdk/reference)
- [OpenAI Apps SDK - Examples](https://github.com/openai/openai-apps-sdk-examples)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [chatgpt-app-adapter docs](https://github.com/vivekhaldar/chatgpt-app-adapter/blob/master/docs/mcp-server-requirements.md)
