import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { obsInstancesTable, streamEventsTable, scenesTable } from '../db/schema';
import { type ControlCommandInput } from '../schema';
import { 
  startStream, 
  stopStream, 
  executeControlCommand, 
  getStreamingStatus, 
  getAllStreamingStatus 
} from '../handlers/streaming_control';
import { eq, and } from 'drizzle-orm';

// Test data
const testObsInstance = {
  name: 'Test OBS',
  websocket_url: 'ws://localhost:4455',
  profile_name: 'Test Profile',
  stream_key: 'test-key',
  status: 'connected' as const,
  current_scene: 'Main Scene',
  is_streaming: false
};

const testScene = {
  name: 'Test Scene',
  is_active: false
};

describe('streaming control handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('startStream', () => {
    it('should start streaming for valid OBS instance', async () => {
      // Create test OBS instance
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const result = await startStream(obsInstance.id, true);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Stream started successfully');

      // Verify database update
      const updatedInstance = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstance.id))
        .execute();

      expect(updatedInstance[0].is_streaming).toBe(true);
      expect(updatedInstance[0].status).toBe('connected');

      // Verify stream event creation
      const streamEvents = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.obs_instance_id, obsInstance.id))
        .execute();

      expect(streamEvents).toHaveLength(1);
      expect(streamEvents[0].event_type).toBe('manual_start');
      expect(streamEvents[0].notes).toBe('Manual stream start');
    });

    it('should handle non-existent OBS instance', async () => {
      const result = await startStream(999, true);

      expect(result.success).toBe(false);
      expect(result.message).toBe('OBS instance not found');
    });

    it('should prevent starting already active stream', async () => {
      // Create streaming OBS instance
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values({ ...testObsInstance, is_streaming: true })
        .returning()
        .execute();

      const result = await startStream(obsInstance.id, true);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Stream is already active');
    });

    it('should handle scheduled stream start', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const result = await startStream(obsInstance.id, false);

      expect(result.success).toBe(true);

      // Verify correct event type for scheduled start
      const streamEvents = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.obs_instance_id, obsInstance.id))
        .execute();

      expect(streamEvents[0].event_type).toBe('stream_start');
      expect(streamEvents[0].notes).toBe('Scheduled stream start');
    });
  });

  describe('stopStream', () => {
    it('should stop streaming for active OBS instance', async () => {
      // Create streaming OBS instance
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values({ ...testObsInstance, is_streaming: true })
        .returning()
        .execute();

      const result = await stopStream(obsInstance.id, true);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Stream stopped successfully');

      // Verify database update
      const updatedInstance = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstance.id))
        .execute();

      expect(updatedInstance[0].is_streaming).toBe(false);

      // Verify stream event creation
      const streamEvents = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.obs_instance_id, obsInstance.id))
        .execute();

      expect(streamEvents).toHaveLength(1);
      expect(streamEvents[0].event_type).toBe('manual_stop');
      expect(streamEvents[0].notes).toBe('Manual stream stop');
    });

    it('should handle non-existent OBS instance', async () => {
      const result = await stopStream(999, true);

      expect(result.success).toBe(false);
      expect(result.message).toBe('OBS instance not found');
    });

    it('should prevent stopping inactive stream', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const result = await stopStream(obsInstance.id, true);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Stream is not active');
    });
  });

  describe('executeControlCommand', () => {
    it('should execute start_stream command', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'start_stream'
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Stream started successfully');
    });

    it('should execute stop_stream command', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values({ ...testObsInstance, is_streaming: true })
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'stop_stream'
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Stream stopped successfully');
    });

    it('should execute switch_scene command', async () => {
      // Create OBS instance and scene
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const [scene] = await db.insert(scenesTable)
        .values({
          ...testScene,
          obs_instance_id: obsInstance.id
        })
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'switch_scene',
        parameters: { scene_name: scene.name }
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Scene switched to ${scene.name}`);

      // Verify scene activation
      const updatedScene = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.id, scene.id))
        .execute();

      expect(updatedScene[0].is_active).toBe(true);

      // Verify OBS instance current scene update
      const updatedInstance = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstance.id))
        .execute();

      expect(updatedInstance[0].current_scene).toBe(scene.name);
    });

    it('should handle switch_scene without scene_name parameter', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'switch_scene'
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Scene name parameter is required');
    });

    it('should handle switch_scene with non-existent scene', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'switch_scene',
        parameters: { scene_name: 'Non-existent Scene' }
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Scene not found for this OBS instance');
    });

    it('should execute toggle_source command', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'toggle_source',
        parameters: { source_id: 'test-source-1' }
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Source test-source-1 toggled');
    });

    it('should handle toggle_source without source_id parameter', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const command: ControlCommandInput = {
        obs_instance_id: obsInstance.id,
        command: 'toggle_source'
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Source ID parameter is required');
    });

    it('should handle unknown commands', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const command = {
        obs_instance_id: obsInstance.id,
        command: 'unknown_command' as any
      };

      const result = await executeControlCommand(command);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown command');
    });
  });

  describe('getStreamingStatus', () => {
    it('should get status for non-streaming instance', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values(testObsInstance)
        .returning()
        .execute();

      const status = await getStreamingStatus(obsInstance.id);

      expect(status.is_streaming).toBe(false);
      expect(status.current_scene).toBe('Main Scene');
      expect(status.stream_duration).toBeNull();
      expect(status.viewer_count).toBeUndefined();
    });

    it('should get status for streaming instance with duration calculation', async () => {
      const [obsInstance] = await db.insert(obsInstancesTable)
        .values({ ...testObsInstance, is_streaming: true })
        .returning()
        .execute();

      // Create a stream start event from 60 seconds ago
      const startTime = new Date(Date.now() - 60000); // 60 seconds ago
      await db.insert(streamEventsTable)
        .values({
          obs_instance_id: obsInstance.id,
          event_type: 'stream_start',
          schedule_id: null,
          occurred_at: startTime,
          notes: 'Test stream start'
        })
        .execute();

      const status = await getStreamingStatus(obsInstance.id);

      expect(status.is_streaming).toBe(true);
      expect(status.current_scene).toBe('Main Scene');
      expect(status.stream_duration).toBeGreaterThanOrEqual(60);
      expect(status.stream_duration).toBeLessThan(65); // Allow some tolerance
    });

    it('should handle non-existent OBS instance', async () => {
      await expect(getStreamingStatus(999)).rejects.toThrow(/OBS instance not found/i);
    });
  });

  describe('getAllStreamingStatus', () => {
    it('should return empty array when no OBS instances exist', async () => {
      const statuses = await getAllStreamingStatus();
      expect(statuses).toEqual([]);
    });

    it('should return status for all OBS instances', async () => {
      // Create multiple OBS instances
      const [obsInstance1] = await db.insert(obsInstancesTable)
        .values({ ...testObsInstance, name: 'OBS 1' })
        .returning()
        .execute();

      const [obsInstance2] = await db.insert(obsInstancesTable)
        .values({ 
          ...testObsInstance, 
          name: 'OBS 2', 
          is_streaming: true,
          websocket_url: 'ws://localhost:4456'
        })
        .returning()
        .execute();

      const statuses = await getAllStreamingStatus();

      expect(statuses).toHaveLength(2);
      
      const status1 = statuses.find(s => s.obs_instance_id === obsInstance1.id);
      const status2 = statuses.find(s => s.obs_instance_id === obsInstance2.id);

      expect(status1).toBeDefined();
      expect(status1!.obs_instance_name).toBe('OBS 1');
      expect(status1!.is_streaming).toBe(false);

      expect(status2).toBeDefined();
      expect(status2!.obs_instance_name).toBe('OBS 2');
      expect(status2!.is_streaming).toBe(true);
    });

    it('should handle multiple streaming instances with different durations', async () => {
      // Create streaming instances
      const [obsInstance1] = await db.insert(obsInstancesTable)
        .values({ 
          ...testObsInstance, 
          name: 'OBS 1', 
          is_streaming: true,
          websocket_url: 'ws://localhost:4455'
        })
        .returning()
        .execute();

      const [obsInstance2] = await db.insert(obsInstancesTable)
        .values({ 
          ...testObsInstance, 
          name: 'OBS 2', 
          is_streaming: true,
          websocket_url: 'ws://localhost:4456'
        })
        .returning()
        .execute();

      // Create stream events with different start times
      const now = new Date();
      await db.insert(streamEventsTable)
        .values([
          {
            obs_instance_id: obsInstance1.id,
            event_type: 'stream_start',
            schedule_id: null,
            occurred_at: new Date(now.getTime() - 120000), // 2 minutes ago
            notes: 'Test stream 1'
          },
          {
            obs_instance_id: obsInstance2.id,
            event_type: 'stream_start',
            schedule_id: null,
            occurred_at: new Date(now.getTime() - 30000), // 30 seconds ago
            notes: 'Test stream 2'
          }
        ])
        .execute();

      const statuses = await getAllStreamingStatus();

      expect(statuses).toHaveLength(2);
      
      const status1 = statuses.find(s => s.obs_instance_id === obsInstance1.id);
      const status2 = statuses.find(s => s.obs_instance_id === obsInstance2.id);

      expect(status1!.stream_duration).toBeGreaterThan(status2!.stream_duration!);
      expect(status1!.stream_duration).toBeGreaterThanOrEqual(120);
      expect(status2!.stream_duration).toBeGreaterThanOrEqual(30);
    });
  });
});