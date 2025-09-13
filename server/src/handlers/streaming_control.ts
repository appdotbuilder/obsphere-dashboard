import { db } from '../db';
import { obsInstancesTable, streamEventsTable, scenesTable } from '../db/schema';
import { type ControlCommandInput, type SuccessResponse } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function startStream(obsInstanceId: number, manual: boolean = true): Promise<SuccessResponse> {
  try {
    // Check if OBS instance exists and is not already streaming
    const obsInstance = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    if (obsInstance.length === 0) {
      return { success: false, message: 'OBS instance not found' };
    }

    if (obsInstance[0].is_streaming) {
      return { success: false, message: 'Stream is already active' };
    }

    // Update OBS instance status to streaming
    await db.update(obsInstancesTable)
      .set({
        is_streaming: true,
        status: 'connected',
        updated_at: new Date()
      })
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    // Log the stream event
    await db.insert(streamEventsTable)
      .values({
        obs_instance_id: obsInstanceId,
        event_type: manual ? 'manual_start' : 'stream_start',
        schedule_id: null, // For manual streams, no schedule
        notes: manual ? 'Manual stream start' : 'Scheduled stream start'
      })
      .execute();

    return { success: true, message: 'Stream started successfully' };
  } catch (error) {
    console.error('Stream start failed:', error);
    throw error;
  }
}

export async function stopStream(obsInstanceId: number, manual: boolean = true): Promise<SuccessResponse> {
  try {
    // Check if OBS instance exists and is streaming
    const obsInstance = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    if (obsInstance.length === 0) {
      return { success: false, message: 'OBS instance not found' };
    }

    if (!obsInstance[0].is_streaming) {
      return { success: false, message: 'Stream is not active' };
    }

    // Update OBS instance status to not streaming
    await db.update(obsInstancesTable)
      .set({
        is_streaming: false,
        updated_at: new Date()
      })
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    // Log the stream event
    await db.insert(streamEventsTable)
      .values({
        obs_instance_id: obsInstanceId,
        event_type: manual ? 'manual_stop' : 'stream_stop',
        schedule_id: null, // For manual streams, no schedule
        notes: manual ? 'Manual stream stop' : 'Scheduled stream stop'
      })
      .execute();

    return { success: true, message: 'Stream stopped successfully' };
  } catch (error) {
    console.error('Stream stop failed:', error);
    throw error;
  }
}

export async function executeControlCommand(input: ControlCommandInput): Promise<SuccessResponse> {
  try {
    switch (input.command) {
      case 'start_stream':
        return await startStream(input.obs_instance_id);
      
      case 'stop_stream':
        return await stopStream(input.obs_instance_id);
      
      case 'switch_scene':
        if (!input.parameters?.['scene_name']) {
          return { success: false, message: 'Scene name parameter is required' };
        }
        
        // Check if OBS instance exists
        const obsInstance = await db.select()
          .from(obsInstancesTable)
          .where(eq(obsInstancesTable.id, input.obs_instance_id))
          .execute();

        if (obsInstance.length === 0) {
          return { success: false, message: 'OBS instance not found' };
        }

        // Check if scene exists for this OBS instance
        const scene = await db.select()
          .from(scenesTable)
          .where(and(
            eq(scenesTable.obs_instance_id, input.obs_instance_id),
            eq(scenesTable.name, input.parameters['scene_name'])
          ))
          .execute();

        if (scene.length === 0) {
          return { success: false, message: 'Scene not found for this OBS instance' };
        }

        // Update current scene and deactivate all other scenes
        await db.update(scenesTable)
          .set({ is_active: false })
          .where(eq(scenesTable.obs_instance_id, input.obs_instance_id))
          .execute();

        await db.update(scenesTable)
          .set({ is_active: true })
          .where(and(
            eq(scenesTable.obs_instance_id, input.obs_instance_id),
            eq(scenesTable.name, input.parameters['scene_name'])
          ))
          .execute();

        // Update OBS instance current scene
        await db.update(obsInstancesTable)
          .set({
            current_scene: input.parameters['scene_name'],
            updated_at: new Date()
          })
          .where(eq(obsInstancesTable.id, input.obs_instance_id))
          .execute();

        return { success: true, message: `Scene switched to ${input.parameters['scene_name']}` };
      
      case 'toggle_source':
        if (!input.parameters?.['source_id']) {
          return { success: false, message: 'Source ID parameter is required' };
        }
        
        // This would typically interact with OBS WebSocket to toggle source
        // For now, we'll return a success response
        return { success: true, message: `Source ${input.parameters['source_id']} toggled` };
      
      default:
        return { success: false, message: 'Unknown command' };
    }
  } catch (error) {
    console.error('Control command execution failed:', error);
    throw error;
  }
}

export async function getStreamingStatus(obsInstanceId: number): Promise<{
    is_streaming: boolean;
    current_scene: string | null;
    stream_duration: number | null;
    viewer_count?: number;
}> {
  try {
    const obsInstance = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    if (obsInstance.length === 0) {
      throw new Error('OBS instance not found');
    }

    const instance = obsInstance[0];
    let stream_duration: number | null = null;

    // Calculate stream duration if streaming
    if (instance.is_streaming) {
      // Get the most recent stream start event
      const recentStreamStart = await db.select()
        .from(streamEventsTable)
        .where(and(
          eq(streamEventsTable.obs_instance_id, obsInstanceId),
          eq(streamEventsTable.event_type, 'stream_start')
        ))
        .orderBy(streamEventsTable.occurred_at)
        .limit(1)
        .execute();

      if (recentStreamStart.length > 0) {
        const startTime = new Date(recentStreamStart[0].occurred_at);
        const now = new Date();
        stream_duration = Math.floor((now.getTime() - startTime.getTime()) / 1000); // Duration in seconds
      }
    }

    return {
      is_streaming: instance.is_streaming,
      current_scene: instance.current_scene,
      stream_duration,
      viewer_count: undefined // Would be populated from OBS WebSocket in real implementation
    };
  } catch (error) {
    console.error('Get streaming status failed:', error);
    throw error;
  }
}

export async function getAllStreamingStatus(): Promise<Array<{
    obs_instance_id: number;
    obs_instance_name: string;
    is_streaming: boolean;
    current_scene: string | null;
    stream_duration: number | null;
}>> {
  try {
    const obsInstances = await db.select()
      .from(obsInstancesTable)
      .execute();

    const statusPromises = obsInstances.map(async (instance) => {
      const status = await getStreamingStatus(instance.id);
      return {
        obs_instance_id: instance.id,
        obs_instance_name: instance.name,
        is_streaming: status.is_streaming,
        current_scene: status.current_scene,
        stream_duration: status.stream_duration
      };
    });

    return await Promise.all(statusPromises);
  } catch (error) {
    console.error('Get all streaming status failed:', error);
    throw error;
  }
}