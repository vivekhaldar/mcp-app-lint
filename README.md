# chatgpt-app-conformance

CLI tool to validate MCP servers against the [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/build/mcp-server) requirements.

## Status

**Planning phase** - See [SPEC.md](./SPEC.md) for the detailed specification.

## Goal

Point at an MCP server URL, get a detailed conformance report with zero human involvement:

```bash
chatgpt-app-check http://localhost:8000/mcp
```

## What It Will Check

- **Protocol**: Valid JSON-RPC, MCP protocol version
- **Tools**: `_meta.openai/outputTemplate`, valid schemas
- **Resources**: `ui://widget/` URIs, `text/html+skybridge` MIME types
- **Execution**: `structuredContent` in tool responses
- **Content**: Valid HTML, `<base href>` tags, asset references
- **Cross-validation**: Template URIs match available resources

## License

MIT
