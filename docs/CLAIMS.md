# Claims Extracted from SPEC.md

This document lists all claims and concepts from SPEC.md that need verification against the official OpenAI Apps SDK documentation.

## Protocol & Connection Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C1 | MCP servers for ChatGPT Apps communicate via HTTP POST | Phase 1: Connection |
| C2 | Server must accept `application/json` content type | CONN_002 |
| C3 | Server returns JSON-RPC responses | CONN_003 |
| C4 | `initialize` returns a protocol version | PROTO_001 |
| C5 | Protocol version should be `2024-11-05` or later | PROTO_002 |

## Tool Descriptor Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C6 | `tools/list` is a valid MCP endpoint | TOOL_001 |
| C7 | Each tool must have a `name` field | TOOL_002 |
| C8 | Each tool must have a `description` field | TOOL_003 |
| C9 | Each tool must have an `inputSchema` | TOOL_005 |
| C10 | **Tools must have `_meta.openai/outputTemplate`** | TOOL_007 |
| C11 | **`outputTemplate` must use `ui://widget/` scheme** | TOOL_008 |
| C12 | `outputTemplate` should end with `.html` | TOOL_009 |
| C13 | Tools may have `_meta.openai/widgetAccessible` | TOOL_010 |
| C14 | Tools may have `_meta.openai/visibility` | TOOL_011 |

## Resource Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C15 | `resources/list` is a valid MCP endpoint | RES_001 |
| C16 | **Widget resources must use `ui://widget/` URI scheme** | RES_002 |
| C17 | **Widget resources must have `text/html+skybridge` MIME type** | RES_003 |
| C18 | Resources should have a human-readable `name` | RES_004 |
| C19 | Resources may have a `description` | RES_005 |

## Tool Execution Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C20 | `tools/call` is a valid MCP endpoint | EXEC_001 |
| C21 | **Tool response must have `structuredContent` field** | EXEC_002 |
| C22 | `structuredContent` should be a non-empty object | EXEC_003 |
| C23 | Response should have a `content` array | EXEC_004 |
| C24 | `content` may include a text item | EXEC_005 |
| C25 | Response must have `isError` field | EXEC_006 |
| C26 | Response `_meta` may have `openai/widgetSessionId` | EXEC_007 |

## Resource Content Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C27 | `resources/read` is a valid MCP endpoint | READ_001 |
| C28 | Response must have `contents` array | READ_002 |
| C29 | Content item must have `text` or `blob` field | READ_003 |
| C30 | **Widget HTML must be valid HTML5** | READ_004 |
| C31 | **Widget HTML should have `<base href>` tag** | READ_005 |
| C32 | Widget HTML should have `<meta charset>` | READ_006 |

## Cross-Validation Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C33 | Every `outputTemplate` URI must exist in resources | XVAL_001 |
| C34 | All `outputTemplate` resources must be readable | XVAL_002 |

## Architecture/Technology Claims

| ID | Claim | Source Section |
|----|-------|----------------|
| C35 | MCP uses JSON-RPC over HTTP with SSE parsing | Architecture |
| C36 | The `ui://widget/` scheme is the correct URI format | Multiple |
| C37 | `text/html+skybridge` is the correct MIME type for widgets | Multiple |

## Key Claims Requiring Verification (High Priority)

These are the OpenAI Apps SDK-specific claims that are NOT standard MCP:

1. **C10**: `_meta.openai/outputTemplate` field requirement
2. **C11**: `ui://widget/` scheme for outputTemplate
3. **C16**: `ui://widget/` URI scheme for widget resources
4. **C17**: `text/html+skybridge` MIME type
5. **C21**: `structuredContent` field in tool responses
6. **C26**: `openai/widgetSessionId` in response meta
7. **C13**: `_meta.openai/widgetAccessible` field
8. **C14**: `_meta.openai/visibility` field
9. **C31**: `<base href>` requirement for widget HTML
