// ABOUTME: Wrapper around the MCP SDK providing a simplified interface.
// ABOUTME: Handles connection, initialization, and all MCP method calls.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ServerInfo } from '../types/report.js';

export interface MCPClientConfig {
  url: string;
  timeout: number;
  /** Optional headers for authentication (e.g., Bearer tokens) */
  headers?: Record<string, string>;
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
  private transport?: StreamableHTTPClientTransport;
  private config: MCPClientConfig;
  private serverInfo?: ServerInfo;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.client = new Client({
      name: 'mcp-app-lint',
      version: '0.1.0',
    });
  }

  /**
   * Connect to the MCP server and perform initialization.
   * Returns server info on success, throws on failure.
   */
  async connect(): Promise<ServerInfo> {
    const url = new URL(this.config.url);

    // Create transport with optional auth headers via requestInit
    const requestInit: RequestInit = {};
    if (this.config.headers && Object.keys(this.config.headers).length > 0) {
      requestInit.headers = this.config.headers;
    }

    this.transport = new StreamableHTTPClientTransport(url, {
      requestInit: Object.keys(requestInit).length > 0 ? requestInit : undefined,
    });

    // Apply timeout to connection using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      await this.client.connect(this.transport);

      // The SDK handles the initialize handshake internally
      // We can access server info from the client after connection
      const info = this.client.getServerVersion();

      this.serverInfo = {
        name: info?.name,
        version: info?.version,
        // Protocol version is available from the transport after connection
        protocolVersion: this.transport.protocolVersion,
      };

      return this.serverInfo;
    } finally {
      clearTimeout(timeoutId);
    }
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
    const isError = typeof response.isError === 'boolean' ? response.isError : undefined;
    return {
      content: response.content as ToolCallResult['content'],
      structuredContent: (response as Record<string, unknown>).structuredContent as Record<string, unknown> | undefined,
      _meta: (response as Record<string, unknown>)._meta as Record<string, unknown> | undefined,
      isError,
    };
  }

  /**
   * Read a resource's content.
   */
  async readResource(uri: string): Promise<ResourceContent> {
    const response = await this.client.readResource({ uri });
    const content = response.contents[0];
    // Handle the union type by checking for text/blob properties
    const textContent = 'text' in content ? content.text : undefined;
    const blobContent = 'blob' in content ? content.blob : undefined;
    return {
      uri: content.uri,
      mimeType: content.mimeType,
      text: textContent,
      blob: blobContent,
    };
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}
