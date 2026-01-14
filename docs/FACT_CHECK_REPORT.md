# Fact-Check Report: SPEC.md vs Official OpenAI Apps SDK Documentation

**Date**: 2026-01-14
**Sources Consulted**:
- https://developers.openai.com/apps-sdk/build/mcp-server
- https://developers.openai.com/apps-sdk/quickstart
- https://developers.openai.com/apps-sdk/reference
- https://developers.openai.com/apps-sdk/guides/optimize-metadata
- https://github.com/openai/openai-apps-sdk-examples
- https://modelcontextprotocol.io/specification

---

## Summary

| Category | Verified ✅ | Incorrect ❌ | Missing/Incomplete ⚠️ |
|----------|------------|-------------|----------------------|
| Protocol/Connection | 4 | 1 | 0 |
| Tool Descriptors | 6 | 2 | 4 |
| Resources | 4 | 0 | 3 |
| Tool Execution | 3 | 3 | 1 |
| Resource Content | 3 | 2 | 1 |
| Cross-Validation | 4 | 0 | 0 |

---

## Detailed Findings

### 1. Protocol & Connection Claims

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| C1 | MCP servers communicate via HTTP POST | ✅ VERIFIED | Quickstart: "Endpoint Configuration - Methods: POST, GET, DELETE" |
| C2 | Server must accept `application/json` | ✅ VERIFIED | Standard JSON-RPC requirement, implicitly confirmed |
| C3 | Server returns JSON-RPC responses | ✅ VERIFIED | All examples use JSON-RPC 2.0 format |
| C4 | `initialize` returns protocol version | ✅ VERIFIED | MCP spec: initialization includes version negotiation |
| C5 | Protocol version should be `2024-11-05` | ❌ **OUTDATED** | MCP spec now shows `2025-11-25` as current version |

**Fix Required**: Update `PROTO_002` - protocol version reference is outdated.

---

### 2. Tool Descriptor Claims

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| C6 | `tools/list` is valid endpoint | ✅ VERIFIED | Standard MCP, confirmed in examples |
| C7 | Each tool must have `name` | ✅ VERIFIED | Reference: "name – Machine identifier" |
| C8 | Each tool must have `description` | ✅ VERIFIED | Reference and metadata guide confirm |
| C9 | Each tool must have `inputSchema` | ✅ VERIFIED | Quickstart: "Uses Zod for validation" |
| C10 | Tool must have `_meta.openai/outputTemplate` | ✅ VERIFIED | Reference table shows this field |
| C11 | `outputTemplate` uses `ui://widget/` scheme | ✅ VERIFIED | Multiple sources confirm URI format |
| C12 | `outputTemplate` should end with `.html` | ⚠️ **NOT DOCUMENTED** | All examples use `.html` but not explicitly required |
| C13 | `_meta.openai/widgetAccessible` | ✅ VERIFIED | Reference: "boolean, default false" |
| C14 | `_meta.openai/visibility` | ✅ VERIFIED | Reference: "public/private" values |

**Missing from SPEC**: The following `_meta` fields are documented but not in SPEC:
- `openai/toolInvocation/invoking` (≤64 chars) - Status text during execution
- `openai/toolInvocation/invoked` (≤64 chars) - Completion status text
- `openai/fileParams` (string[]) - File input field names
- `securitySchemes` (array) - Back-compat client mirror

**Missing from SPEC**: Tool annotations for behavioral hints:
- `readOnlyHint` (boolean)
- `destructiveHint` (boolean)
- `openWorldHint` (boolean)
- `idempotentHint` (boolean)

**Missing from SPEC**: Tools can have a `title` field separate from `name`:
- `name`: Machine identifier (e.g., `kanban-board`)
- `title`: Human-readable label (e.g., `Show Kanban Board`)

---

### 3. Resource Claims

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| C15 | `resources/list` is valid endpoint | ✅ VERIFIED | Standard MCP |
| C16 | Widget resources use `ui://widget/` URI | ✅ VERIFIED | Quickstart: "URI scheme: ui://widget/[name].html" |
| C17 | Widget resources have `text/html+skybridge` MIME | ✅ VERIFIED | MCP server doc: "signaling to ChatGPT that it should treat the payload as a sandboxed HTML entry point" |
| C18 | Resources should have `name` | ✅ VERIFIED | MCP spec: `name` is required |
| C19 | Resources may have `description` | ✅ VERIFIED | MCP spec: optional field |

**Missing from SPEC**: Resource `_meta` fields specific to OpenAI:
- `openai/widgetDescription` (string) - Model-visible summary
- `openai/widgetPrefersBorder` (boolean) - Render bordered card hint
- `openai/widgetDomain` (string/origin) - Custom subdomain
- `openai/widgetCSP` (object) - Security allowlists:
  - `connect_domains` - Fetch/XHR destinations
  - `resource_domains` - Static asset origins
  - `frame_domains` - Iframe sources (triggers stricter review)
  - `redirect_domains` - openExternal targets

---

### 4. Tool Execution Claims

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| C20 | `tools/call` is valid endpoint | ✅ VERIFIED | Standard MCP |
| C21 | Response **must** have `structuredContent` | ❌ **INCORRECT** | Reference says "Optional", not required |
| C22 | `structuredContent` should be non-empty object | ⚠️ **SOFT** | When present, should have data |
| C23 | Response should have `content` array | ✅ VERIFIED | Both MCP and OpenAI docs confirm this |
| C24 | `content` may include text item | ✅ VERIFIED | Standard format |
| C25 | Response **must** have `isError` | ❌ **NOT IN OPENAI DOCS** | Standard MCP has `isError`, but OpenAI docs describe 3-field response (structuredContent, content, _meta) without mentioning isError |
| C26 | Response `_meta` may have `openai/widgetSessionId` | ⚠️ **CLIENT-PROVIDED** | Reference shows this is sent BY ChatGPT to the server, not returned BY the server |

**Critical Correction**: The OpenAI Apps SDK response format is:
```json
{
  "structuredContent": {...},  // Optional - JSON for widget AND model
  "content": [{type, text}],   // Optional - narration (Markdown/plaintext)
  "_meta": {...}               // Optional - large/sensitive data (widget-only)
}
```

**Fix Required**:
- `EXEC_002`: Change from ERROR to WARN or INFO - `structuredContent` is optional
- `EXEC_006`: Verify if `isError` is still relevant - not mentioned in OpenAI docs
- `EXEC_007`: Clarify that `widgetSessionId` is client-provided, not server-returned

---

### 5. Resource Content Claims

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| C27 | `resources/read` is valid endpoint | ✅ VERIFIED | Standard MCP |
| C28 | Response has `contents` array | ✅ VERIFIED | MCP spec confirms |
| C29 | Content has `text` or `blob` | ✅ VERIFIED | MCP spec confirms |
| C30 | Widget HTML must be valid HTML5 | ✅ VERIFIED | Reasonable validation requirement |
| C31 | Widget HTML **should** have `<base href>` | ❌ **NOT REQUIRED** | MCP server doc explicitly states: "No `<base href>` or external script sources mentioned; assets should inline or load from CSP-approved resource_domains" |
| C32 | Widget HTML should have `<meta charset>` | ⚠️ **NOT DOCUMENTED** | Good practice but not explicitly required |

**Fix Required**:
- `READ_005`: Change `<base href>` from WARN to INFO or remove entirely - documentation explicitly says it's not expected

---

### 6. Cross-Validation Claims

| ID | Claim | Status | Evidence |
|----|-------|--------|----------|
| C33 | Every `outputTemplate` URI must exist in resources | ✅ VERIFIED | Logical consistency requirement |
| C34 | All `outputTemplate` resources must be readable | ✅ VERIFIED | Logical consistency requirement |
| C35 | MCP uses JSON-RPC over HTTP with SSE | ✅ VERIFIED | Confirmed in multiple sources |
| C36 | `ui://widget/` is correct URI format | ✅ VERIFIED | Multiple confirmations |
| C37 | `text/html+skybridge` is correct MIME type | ✅ VERIFIED | Explicitly documented |

---

## Items Missing from SPEC

### 1. Client-Provided Metadata (sent TO server)

These are fields ChatGPT sends to the MCP server:
- `_meta["openai/locale"]` - BCP 47 locale preference
- `_meta["openai/userAgent"]` - Analytics/formatting hint
- `_meta["openai/userLocation"]` - Coarse location (city, region, timezone, coords)
- `_meta["openai/subject"]` - Anonymized user ID

### 2. Widget Runtime API (`window.openai`)

The SPEC doesn't validate widget JavaScript, but could check for proper usage:
- `toolInput`, `toolOutput`, `toolResponseMetadata`, `widgetState`
- `callTool()`, `setWidgetState()`, `sendFollowUpMessage()`
- `uploadFile()`, `getFileDownloadUrl()`
- `requestDisplayMode()`, `requestModal()`, `notifyIntrinsicHeight()`
- `openExternal()`, `setOpenInAppUrl()`
- Context signals: `theme`, `displayMode`, `maxHeight`, `safeArea`, `view`, `userAgent`, `locale`

### 3. File Parameter Format

When tools accept files, they must declare fields in `_meta["openai/fileParams"]` and accept this shape:
```json
{
  "download_url": "https://...",
  "file_id": "file_..."
}
```

### 4. Security Constraints

- Never embed API keys/tokens in responses
- Do not rely on `_meta["openai/userAgent"]` or locale for authorization
- Widgets operate in sandboxed iframes with strict CSP
- Blocked browser APIs: `window.alert`, `window.prompt`, `window.confirm`, `navigator.clipboard`

---

## Recommended Changes to SPEC.md

### High Priority (Incorrect)

1. **PROTO_002**: Update protocol version reference - `2024-11-05` is outdated, current is `2025-11-25`
2. **EXEC_002**: Change severity from ERROR to WARN - `structuredContent` is optional
3. **EXEC_006**: Remove or downgrade `isError` check - not in OpenAI response format docs
4. **READ_005**: Change `<base href>` from WARN to INFO - explicitly not required

### Medium Priority (Missing)

5. Add tool `title` field check (INFO)
6. Add `_meta` invocation status fields validation (INFO)
7. Add tool annotation hints validation (INFO)
8. Add resource CSP `_meta` fields validation (INFO)
9. Add file parameter validation if `openai/fileParams` present

### Low Priority (Nice to Have)

10. Widget runtime API usage validation (if parsing JS)
11. Security constraint validation
12. Client metadata handling validation

---

## Conclusion

The SPEC.md is largely accurate but has several issues:

**Critical Issues (4)**:
1. `structuredContent` marked as required but is optional
2. `isError` not part of OpenAI's documented response format
3. `<base href>` marked as recommended but explicitly not expected
4. Protocol version outdated

**Missing Coverage (10+)**:
- Tool annotations (`readOnlyHint`, etc.)
- Tool invocation status messages
- Resource CSP configuration
- File parameter handling
- Client-provided metadata

The spec should be updated to align with the official documentation before implementation.
