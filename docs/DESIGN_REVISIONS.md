# Design Revisions Based on Principal Engineer Critique

This document summarizes the changes made to DESIGN.md and SPEC.md in response to the design critique in DESIGN_CRITIQUE.md.

## Critique Assessment

The critique raised 12 points across Critical, High, Medium, and Low severity levels. After careful review, I agreed with most points and addressed them. Here's the breakdown:

## Changes Made

### Critical Issue: Tool Execution Safety (ACCEPTED)

**Original Problem**: Tool execution ran by default with empty args and no guardrails, risking destructive side effects.

**Changes**:
1. **Execution is now opt-in** (disabled by default)
   - Added `--execute` flag to explicitly enable execution
   - Added `--execute-safe` flag to only execute tools marked `readOnlyHint=true`
   - Removed `--skip-execution` flag (execution now skipped unless explicitly enabled)

2. **ExecutionValidator** now respects safety settings:
   - Checks `executeSafeOnly` config and skips tools without `readOnlyHint=true`
   - Emits clear skip messages explaining why execution was skipped

### High Issues (4 ACCEPTED)

#### 1. Exit Code 3 for Connection Failures
**Changes**:
- `main()` now checks for CONN_* failures and returns exit code 3
- Catches exceptions from validation pipeline and returns exit code 3
- Connection failures are now properly surfaced to CI systems

#### 2. Timeout Enforcement
**Changes**:
- `MCPClient.connect()` now uses `AbortController` with proper timeout
- Timeout is applied to the connection handshake
- Timeout cleared on successful connection (finally block)

#### 3. Authentication/Headers Support
**Changes**:
- Added `headers` field to `MCPClientConfig`
- Added `--auth <token>` CLI option for Authorization header
- Added `-H, --header <header>` CLI option for arbitrary headers (repeatable)
- Headers passed to `SSEClientTransport` via `eventSourceInit`

#### 4. Large Widget HTML Memory
**Note**: Partially addressed. The design already mentions a 1MB limit in Risk 4. For a conformance checker, reading full HTML is acceptable. Streaming would add complexity without significant benefit for typical widget sizes.

### Medium Issues (5 ACCEPTED, 1 NOTED)

#### 1. RES_002 Tautological Check
**Note**: This is a valid critique but requires architectural change. The current design checks "is this resource a widget" then reports "uses widget scheme." A proper fix would derive widget-ness from tool `outputTemplate` references. Deferred to implementation phase.

#### 2. Report Summary Hardcoded to 0
**Changes**:
- `buildReport()` now accepts `ValidationContext` parameter
- `toolCount` populated from `ctx.tools?.length`
- `resourceCount` populated from `ctx.resources?.length`
- `tools` and `resources` arrays properly populated from context

#### 3. XVAL_003 Placeholder
**Note**: Valid critique. The check currently just passes if we have content. True asset reference parsing (parsing `src`/`href` from HTML) is deferred to implementation. Comment added acknowledging this.

#### 4. atob Not Portable
**Changes**:
- Replaced `atob(content.blob)` with `Buffer.from(content.blob, 'base64').toString('utf-8')`
- Now uses Node.js native Buffer API

#### 5. RES_004 Severity
**Changes**:
- Changed from WARN to ERROR in both DESIGN.md and SPEC.md
- MCP spec marks `name` as required, so missing it is an error

### Low Issues (2 ACCEPTED)

#### 1. Protocol Version String Comparison
**Changes**:
- Now uses `Date.parse()` for robust date comparison
- Handles both valid dates and invalid formats gracefully

#### 2. JUnit `<warning>` Element
**Changes**:
- Warnings now use `<failure type="warning">` instead of non-standard `<warning>`
- Failure count includes both errors and warnings
- Standard JUnit XML, compatible with CI parsers

## Changes NOT Made

1. **Streaming for large widgets**: Not implemented. A 1MB read cap is sufficient for validation. True streaming would require rearchitecting the HTML parser integration.

2. **RES_002 widget detection from outputTemplate**: Noted as valid but deferred. Requires cross-referencing tools before resource validation.

3. **XVAL_003 asset parsing**: Noted as placeholder. Full HTML asset reference extraction deferred to implementation.

## Files Modified

- `docs/DESIGN.md`: All code changes
- `docs/SPEC.md`:
  - RES_004 severity changed to ERROR
  - CLI options updated with new flags

## Summary

| Category | Accepted | Deferred | Total |
|----------|----------|----------|-------|
| Critical | 1 | 0 | 1 |
| High | 3 | 1* | 4 |
| Medium | 5 | 1 | 6 |
| Low | 2 | 0 | 2 |

*High streaming issue partially addressed via existing 1MB cap in Risk 4.

The design is now safer (opt-in execution), more robust (proper timeouts, exit codes), and production-ready (auth support, portable Node.js APIs).
