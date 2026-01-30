import { describe, it, expect } from 'vitest';
import { ProtocolValidator } from '../../src/validators/protocol.js';
import type { ValidationContext, ValidatorConfig } from '../../src/validators/index.js';
import { OPENAI_STANDARD } from '../../src/standards/openai.js';

const defaultConfig: ValidatorConfig = {
  toolFilter: [],
  skipExecution: true,
  executeSafeOnly: false,
  skipContent: true,
  timeout: 5000,
  verbose: false,
};

function makeCtx(client: any): ValidationContext {
  return { client, config: defaultConfig };
}

describe('ProtocolValidator', () => {
  const validator = new ProtocolValidator(OPENAI_STANDARD);

  it('produces passing CONN and PROTO checks on successful connection', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const ids = results.map(r => r.id);
    expect(ids).toContain('CONN_001');
    expect(ids).toContain('CONN_002');
    expect(ids).toContain('CONN_003');
    expect(ids).toContain('PROTO_001');
    expect(ids).toContain('PROTO_002');
    expect(ids).toContain('PROTO_003');

    // All should pass
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('sets serverInfo on context after successful connection', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
      }),
    };
    const ctx = makeCtx(client);
    await validator.run(ctx);
    expect(ctx.serverInfo).toEqual({
      name: 'test-server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
    });
  });

  it('fails CONN_001 on connection error', async () => {
    const client = {
      connect: async () => { throw new Error('Connection refused'); },
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('CONN_001');
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('Connection refused');
    expect(results[0].suggestion).toBeDefined();
  });

  it('handles non-Error throws in connection', async () => {
    const client = {
      connect: async () => { throw 'string error'; },
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('string error');
  });

  it('fails PROTO_001 when protocolVersion is missing', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        // no protocolVersion
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const proto001 = results.find(r => r.id === 'PROTO_001');
    expect(proto001).toBeDefined();
    expect(proto001!.passed).toBe(false);
    expect(proto001!.severity).toBe('error');
  });

  it('warns PROTO_002 when protocol version is too old', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: '2024-01-01',
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const proto002 = results.find(r => r.id === 'PROTO_002');
    expect(proto002).toBeDefined();
    expect(proto002!.passed).toBe(false);
    expect(proto002!.severity).toBe('warn');
  });

  it('passes PROTO_002 for recent protocol version', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: '2025-01-01',
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const proto002 = results.find(r => r.id === 'PROTO_002');
    expect(proto002).toBeDefined();
    expect(proto002!.passed).toBe(true);
  });

  it('fails PROTO_002 when protocol version is not a parseable date', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: 'not-a-date',
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const proto002 = results.find(r => r.id === 'PROTO_002');
    expect(proto002).toBeDefined();
    expect(proto002!.passed).toBe(false);
  });

  it('passes PROTO_002 at exact minimum version boundary', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const proto002 = results.find(r => r.id === 'PROTO_002');
    expect(proto002!.passed).toBe(true);
  });

  it('always produces PROTO_003 for capabilities info', async () => {
    const client = {
      connect: async () => ({
        name: 'test-server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
      }),
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);

    const proto003 = results.find(r => r.id === 'PROTO_003');
    expect(proto003).toBeDefined();
    expect(proto003!.passed).toBe(true);
    expect(proto003!.severity).toBe('info');
  });
});
