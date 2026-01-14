// ABOUTME: In-memory mock MCP server for unit testing.
// ABOUTME: Returns configurable responses without network overhead.

import type { ServerInfo } from '../../../src/types/report.js';
import type { Tool, Resource, ToolCallResult, ResourceContent } from '../../../src/client/mcp.js';

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

  async connect(): Promise<ServerInfo> {
    return this.config.serverInfo ?? { name: 'mock', version: '1.0', protocolVersion: '2024-11-05' };
  }

  async listTools(): Promise<Tool[]> {
    const tools = this.config.tools ?? [];
    return tools.map(t => {
      const tool = t as Record<string, unknown>;
      return {
        name: tool.name as string,
        description: tool.description as string | undefined,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
        annotations: tool.annotations as Record<string, unknown> | undefined,
        raw: t,
      };
    });
  }

  async listResources(): Promise<Resource[]> {
    const resources = this.config.resources ?? [];
    return resources.map(r => {
      const resource = r as Record<string, unknown>;
      return {
        uri: resource.uri as string,
        name: resource.name as string | undefined,
        description: resource.description as string | undefined,
        mimeType: resource.mimeType as string | undefined,
        raw: r,
      };
    });
  }

  async callTool(name: string): Promise<ToolCallResult> {
    const response = this.config.toolResponses?.get(name);
    if (response) {
      return response as ToolCallResult;
    }
    return { content: [] };
  }

  async readResource(uri: string): Promise<ResourceContent> {
    const content = this.config.resourceContents?.get(uri);
    if (content) {
      return content as ResourceContent;
    }
    return { uri, text: '' };
  }

  async close(): Promise<void> {
    // No-op for mock
  }
}
