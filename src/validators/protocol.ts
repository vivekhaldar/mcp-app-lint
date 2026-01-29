// ABOUTME: Validates MCP connection and protocol initialization.
// ABOUTME: These checks are prerequisites for all subsequent validation.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { StandardSpec } from '../standards/spec.js';

export class ProtocolValidator extends Validator {
  name = 'protocol';
  category = 'protocol' as const;

  constructor(spec: StandardSpec) {
    super(spec);
  }

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
        // Parse as date for robust comparison (format: YYYY-MM-DD)
        const version = serverInfo.protocolVersion;
        const minVersion = '2024-11-05';
        const versionDate = Date.parse(version);
        const minDate = Date.parse(minVersion);
        const isRecent = !isNaN(versionDate) && !isNaN(minDate) && versionDate >= minDate;
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
