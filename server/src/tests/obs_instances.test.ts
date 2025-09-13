import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { obsInstancesTable } from '../db/schema';
import { type CreateObsInstanceInput } from '../schema';
import { createObsInstance } from '../handlers/obs_instances';
import { eq } from 'drizzle-orm';

// Test inputs with all variations
const basicInput: CreateObsInstanceInput = {
  name: 'Test OBS Instance',
  websocket_url: 'ws://localhost:4455'
};

const fullInput: CreateObsInstanceInput = {
  name: 'Full OBS Instance',
  websocket_url: 'ws://localhost:4456',
  profile_name: 'Main Profile',
  stream_key: 'live_stream_key_123'
};

const nullFieldsInput: CreateObsInstanceInput = {
  name: 'Null Fields Instance',
  websocket_url: 'ws://localhost:4457',
  profile_name: null,
  stream_key: null
};

describe('createObsInstance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an OBS instance with basic fields', async () => {
    const result = await createObsInstance(basicInput);

    // Validate returned object
    expect(result.name).toEqual('Test OBS Instance');
    expect(result.websocket_url).toEqual('ws://localhost:4455');
    expect(result.profile_name).toBeNull();
    expect(result.stream_key).toBeNull();
    expect(result.status).toEqual('disconnected');
    expect(result.current_scene).toBeNull();
    expect(result.is_streaming).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create an OBS instance with all optional fields', async () => {
    const result = await createObsInstance(fullInput);

    // Validate all fields are set correctly
    expect(result.name).toEqual('Full OBS Instance');
    expect(result.websocket_url).toEqual('ws://localhost:4456');
    expect(result.profile_name).toEqual('Main Profile');
    expect(result.stream_key).toEqual('live_stream_key_123');
    expect(result.status).toEqual('disconnected');
    expect(result.current_scene).toBeNull();
    expect(result.is_streaming).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle explicit null values for optional fields', async () => {
    const result = await createObsInstance(nullFieldsInput);

    expect(result.name).toEqual('Null Fields Instance');
    expect(result.websocket_url).toEqual('ws://localhost:4457');
    expect(result.profile_name).toBeNull();
    expect(result.stream_key).toBeNull();
    expect(result.status).toEqual('disconnected');
  });

  it('should save OBS instance to database correctly', async () => {
    const result = await createObsInstance(fullInput);

    // Query database to verify insertion
    const obsInstances = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, result.id))
      .execute();

    expect(obsInstances).toHaveLength(1);
    const saved = obsInstances[0];

    expect(saved.name).toEqual('Full OBS Instance');
    expect(saved.websocket_url).toEqual('ws://localhost:4456');
    expect(saved.profile_name).toEqual('Main Profile');
    expect(saved.stream_key).toEqual('live_stream_key_123');
    expect(saved.status).toEqual('disconnected');
    expect(saved.current_scene).toBeNull();
    expect(saved.is_streaming).toBe(false);
    expect(saved.created_at).toBeInstanceOf(Date);
    expect(saved.updated_at).toBeInstanceOf(Date);
  });

  it('should create multiple OBS instances with unique IDs', async () => {
    const result1 = await createObsInstance(basicInput);
    const result2 = await createObsInstance({
      name: 'Second Instance',
      websocket_url: 'ws://localhost:4458'
    });

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Test OBS Instance');
    expect(result2.name).toEqual('Second Instance');

    // Verify both are in database
    const allInstances = await db.select()
      .from(obsInstancesTable)
      .execute();

    expect(allInstances).toHaveLength(2);
  });

  it('should set default values correctly', async () => {
    const result = await createObsInstance(basicInput);

    // Check default values are applied
    expect(result.status).toEqual('disconnected');
    expect(result.current_scene).toBeNull();
    expect(result.is_streaming).toBe(false);
    expect(result.profile_name).toBeNull();
    expect(result.stream_key).toBeNull();
  });

  it('should handle websocket URLs with different protocols', async () => {
    const wsInput: CreateObsInstanceInput = {
      name: 'WS Instance',
      websocket_url: 'ws://192.168.1.100:4455'
    };

    const wssInput: CreateObsInstanceInput = {
      name: 'WSS Instance',
      websocket_url: 'wss://secure.obs.example.com:443'
    };

    const wsResult = await createObsInstance(wsInput);
    const wssResult = await createObsInstance(wssInput);

    expect(wsResult.websocket_url).toEqual('ws://192.168.1.100:4455');
    expect(wssResult.websocket_url).toEqual('wss://secure.obs.example.com:443');
  });
});