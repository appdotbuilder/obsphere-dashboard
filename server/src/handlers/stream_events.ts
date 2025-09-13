import { db } from '../db';
import { streamEventsTable, obsInstancesTable, schedulesTable } from '../db/schema';
import { type CreateStreamEventInput, type StreamEvent } from '../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function createStreamEvent(input: CreateStreamEventInput): Promise<StreamEvent> {
  try {
    // Verify that the OBS instance exists
    const obsInstance = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, input.obs_instance_id))
      .execute();

    if (obsInstance.length === 0) {
      throw new Error(`OBS instance with id ${input.obs_instance_id} not found`);
    }

    // If schedule_id is provided, verify it exists
    if (input.schedule_id !== null && input.schedule_id !== undefined) {
      const schedule = await db.select()
        .from(schedulesTable)
        .where(eq(schedulesTable.id, input.schedule_id))
        .execute();

      if (schedule.length === 0) {
        throw new Error(`Schedule with id ${input.schedule_id} not found`);
      }
    }

    // Insert the stream event
    const result = await db.insert(streamEventsTable)
      .values({
        obs_instance_id: input.obs_instance_id,
        schedule_id: input.schedule_id || null,
        event_type: input.event_type,
        notes: input.notes || null
      })
      .returning()
      .execute();

    return result[0] as StreamEvent;
  } catch (error) {
    console.error('Stream event creation failed:', error);
    throw error;
  }
}

export async function getStreamEvents(obsInstanceId?: number, limit?: number): Promise<StreamEvent[]> {
  try {
    // Build query based on filters
    if (obsInstanceId !== undefined && limit !== undefined) {
      const results = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.obs_instance_id, obsInstanceId))
        .orderBy(desc(streamEventsTable.occurred_at))
        .limit(limit)
        .execute();
      return results as StreamEvent[];
    }

    if (obsInstanceId !== undefined) {
      const results = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.obs_instance_id, obsInstanceId))
        .orderBy(desc(streamEventsTable.occurred_at))
        .execute();
      return results as StreamEvent[];
    }

    if (limit !== undefined) {
      const results = await db.select()
        .from(streamEventsTable)
        .orderBy(desc(streamEventsTable.occurred_at))
        .limit(limit)
        .execute();
      return results as StreamEvent[];
    }

    // No filters
    const results = await db.select()
      .from(streamEventsTable)
      .orderBy(desc(streamEventsTable.occurred_at))
      .execute();
    
    return results as StreamEvent[];
  } catch (error) {
    console.error('Stream events retrieval failed:', error);
    throw error;
  }
}

export async function getStreamEventsByDateRange(startDate: Date, endDate: Date, obsInstanceId?: number): Promise<StreamEvent[]> {
  try {
    if (obsInstanceId !== undefined) {
      const results = await db.select()
        .from(streamEventsTable)
        .where(and(
          gte(streamEventsTable.occurred_at, startDate),
          lte(streamEventsTable.occurred_at, endDate),
          eq(streamEventsTable.obs_instance_id, obsInstanceId)
        ))
        .orderBy(desc(streamEventsTable.occurred_at))
        .execute();
      return results as StreamEvent[];
    }

    const results = await db.select()
      .from(streamEventsTable)
      .where(and(
        gte(streamEventsTable.occurred_at, startDate),
        lte(streamEventsTable.occurred_at, endDate)
      ))
      .orderBy(desc(streamEventsTable.occurred_at))
      .execute();

    return results as StreamEvent[];
  } catch (error) {
    console.error('Stream events by date range retrieval failed:', error);
    throw error;
  }
}

export async function getStreamStatistics(obsInstanceId?: number): Promise<{
  total_streams: number;
  total_duration: number;
  average_duration: number;
  scheduled_vs_manual: { scheduled: number; manual: number };
}> {
  try {
    // Get all events for calculation
    const allEvents = obsInstanceId !== undefined
      ? await db.select()
          .from(streamEventsTable)
          .where(eq(streamEventsTable.obs_instance_id, obsInstanceId))
          .orderBy(streamEventsTable.obs_instance_id, streamEventsTable.occurred_at)
          .execute()
      : await db.select()
          .from(streamEventsTable)
          .orderBy(streamEventsTable.obs_instance_id, streamEventsTable.occurred_at)
          .execute();

    // Count start events
    const startEvents = allEvents.filter(e => e.event_type === 'stream_start' || e.event_type === 'manual_start');
    const scheduledEvents = startEvents.filter(e => e.schedule_id !== null);
    const manualEvents = startEvents.filter(e => e.schedule_id === null);

    // Group events by OBS instance and calculate durations
    const instanceEvents = new Map<number, typeof allEvents>();
    for (const event of allEvents) {
      if (!instanceEvents.has(event.obs_instance_id)) {
        instanceEvents.set(event.obs_instance_id, []);
      }
      instanceEvents.get(event.obs_instance_id)!.push(event);
    }

    let totalDuration = 0;
    let completedStreams = 0;

    for (const [, events] of instanceEvents) {
      // Find pairs of start/stop events
      for (let i = 0; i < events.length - 1; i++) {
        const currentEvent = events[i];
        const nextEvent = events[i + 1];

        // Check if we have a start followed by a stop
        const isStartEvent = currentEvent.event_type === 'stream_start' || currentEvent.event_type === 'manual_start';
        const isStopEvent = nextEvent.event_type === 'stream_stop' || nextEvent.event_type === 'manual_stop';

        if (isStartEvent && isStopEvent) {
          const duration = nextEvent.occurred_at.getTime() - currentEvent.occurred_at.getTime();
          totalDuration += duration;
          completedStreams++;
        }
      }
    }

    // Convert from milliseconds to seconds
    const totalDurationSeconds = Math.round(totalDuration / 1000);
    const averageDuration = completedStreams > 0 ? Math.round(totalDurationSeconds / completedStreams) : 0;

    return {
      total_streams: startEvents.length,
      total_duration: totalDurationSeconds,
      average_duration: averageDuration,
      scheduled_vs_manual: {
        scheduled: scheduledEvents.length,
        manual: manualEvents.length
      }
    };
  } catch (error) {
    console.error('Stream statistics calculation failed:', error);
    throw error;
  }
}