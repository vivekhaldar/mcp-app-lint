# chatgpt-app-conformance

CLI tool to validate MCP servers against the [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/build/mcp-server) requirements.

## Quick Start

```bash
# Install
npm install -g chatgpt-app-conformance

# Check an MCP server
chatgpt-app-check http://localhost:8000/mcp
```

## What It Checks

- **Protocol**: Valid JSON-RPC, MCP protocol version
- **Tools**: `_meta.openai/outputTemplate`, valid schemas
- **Resources**: `ui://widget/` URIs, `text/html+skybridge` MIME types
- **Execution**: `structuredContent` in tool responses
- **Content**: Valid HTML, `<base href>` tags, asset references
- **Cross-validation**: Template URIs match available resources

## Output

```
ChatGPT Apps SDK Conformance Report
═══════════════════════════════════════════════════════════════════

✅ pomodoro_timer
   ├─ ✅ Has _meta.openai/outputTemplate
   ├─ ✅ outputTemplate uses ui:// scheme
   └─ ✅ Tool call returns structuredContent

VERDICT: CONFORMANT
```

## Documentation

See [SPEC.md](./SPEC.md) for the full specification.

## License

MIT
