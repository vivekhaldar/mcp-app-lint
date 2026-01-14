# Engineering Design Critique (Principal Engineer)

This critique focuses on the design in `docs/DESIGN.md` and how well it meets the requirements in `docs/SPEC.md`. Severity levels reflect user impact, safety risk, and correctness.

## Critical
- Tool execution runs by default with empty args and no guardrails; this can trigger destructive side effects or irreversible writes on real servers, so execution should be opt-in (default skip), gated by allowlist or `readOnlyHint`, and require explicit intent from the user.

## High
- Connection/protocol failures do not map to the specified exit code 3 because the protocol validator swallows connection errors and the CLI always returns 0-2 based on verdict; this breaks CI semantics and should surface a distinct fatal path that sets the correct exit code.
- Timeout is defined but never enforced by `MCPClient`; a hung server or stalled SSE can block indefinitely, so use AbortController or SDK timeout support and propagate it through every request.
- The design promises streaming and size limits for large widget HTML, but the current plan reads full resource content into memory and decodes base64 eagerly; this is a correctness/perf gap that can lead to OOM or slowdowns on large widgets.
- Authentication/headers are not part of the design despite most MCP servers requiring auth; without a way to inject headers or bearer tokens, the CLI will fail in real environments and provide a false impression of readiness.

## Medium
- Resource validation defines RES_002 by first checking `uri.startsWith('ui://widget/')`, which makes the check tautological and fails to catch resources that are widget HTML with the wrong URI scheme; widget-ness should be inferred from tool `outputTemplate` and validated against the resource list.
- Tool execution uses empty arguments for all tools, which causes false negatives for required parameters and encourages unsafe calls; the design should generate minimal arguments from JSON Schema or allow user-provided fixtures.
- Report summary fields (`toolCount`, `resourceCount`) are hardcoded to 0 and server info is inferred indirectly from a protocol check; the report should be built from validation context to avoid misleading output.
- XVAL_003 is listed in the spec but not truly implemented (placeholder pass on any content); asset reference parsing should be added or the check should be removed until it is real.
- `atob` is used to decode blobs but is not guaranteed in Node runtimes; use `Buffer.from(blob, 'base64')` to avoid runtime failures.
- RES_004 treats missing `name` as warning, but the MCP spec marks `name` as required; the severity should be revisited to prevent false "conformant" results.

## Low
- Protocol version comparison uses string ordering; it works for YYYY-MM-DD today but is fragile if formats change, so prefer explicit date parsing.
- JUnit output emits a nonstandard `<warning>` element; most CI parsers only understand `<failure>` and `<error>`, so warnings should be represented using standard elements or `system-out`.
