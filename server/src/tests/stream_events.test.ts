import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { obsInstancesTable, schedulesTable, streamEventsTable } from '../db/schema';
import { type CreateStreamEventInput } from '../schema';
import { 
  createStreamEvent, 
  getStreamEvents, 
  getStreamEventsByDateRange, 
  getStreamStatistics 
} from '../handlers/stream_events';
import { eq } from 'drizzle-orm';

// Test OBS instance data
const testObsInstance = {
  name: 'Test OBS Instance',
  websocket_url: 'ws://localhost:4455',
  profile_name: 'Test Profile',
  stream_key: 'test_stream_key_123'
};

// Test schedule data
const testSchedule = {
  name: 'Test Schedule',
  obs_instance_id: 1, // Will be set after OBS instance creation
  start_time: '10:00',
  end_time: '12:00',
  days_of_week: [1, 2, 3, 4, 5] // Monday to Friday
};

// Test stream event input
const testStreamEventInput: CreateStreamEventInput = {
  obs_instance_id: 1, // Will be set after OBS instance creation
  schedule_id: 1, // Will be set after schedule creation
  event_type: 'stream_start',
  notes: 'Test stream start event'
};

describe('createStreamEvent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a stream event with schedule', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    // Create prerequisite schedule
    const scheduleResult = await db.insert(schedulesTable)
      .values({
        ...testSchedule,
        obs_instance_id: obsInstanceId,
        days_of_week: [1, 2, 3, 4, 5]
      })
      .returning()
      .execute();
    const scheduleId = scheduleResult[0].id;

    // Create stream event
    const input: CreateStreamEventInput = {
      obs_instance_id: obsInstanceId,
      schedule_id: scheduleId,
      event_type: 'stream_start',
      notes: 'Scheduled stream start'
    };

    const result = await createStreamEvent(input);

    // Validate result
    expect(result.id).toBeDefined();
    expect(result.obs_instance_id).toEqual(obsInstanceId);
    expect(result.schedule_id).toEqual(scheduleId);
    expect(result.event_type).toEqual('stream_start');
    expect(result.notes).toEqual('Scheduled stream start');
    expect(result.occurred_at).toBeInstanceOf(Date);
  });

  it('should create a manual stream event without schedule', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    // Create manual stream event
    const input: CreateStreamEventInput = {
      obs_instance_id: obsInstanceId,
      event_type: 'manual_start',
      notes: 'Manual stream start'
    };

    const result = await createStreamEvent(input);

    // Validate result
    expect(result.id).toBeDefined();
    expect(result.obs_instance_id).toEqual(obsInstanceId);
    expect(result.schedule_id).toBeNull();
    expect(result.event_type).toEqual('manual_start');
    expect(result.notes).toEqual('Manual stream start');
    expect(result.occurred_at).toBeInstanceOf(Date);
  });

  it('should save stream event to database', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    const input: CreateStreamEventInput = {
      obs_instance_id: obsInstanceId,
      event_type: 'stream_stop'
    };

    const result = await createStreamEvent(input);

    // Verify in database
    const events = await db.select()
      .from(streamEventsTable)
      .where(eq(streamEventsTable.id, result.id))
      .execute();

    expect(events).toHaveLength(1);
    expect(events[0].obs_instance_id).toEqual(obsInstanceId);
    expect(events[0].event_type).toEqual('stream_stop');
    expect(events[0].schedule_id).toBeNull();
    expect(events[0].occurred_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent OBS instance', async () => {
    const input: CreateStreamEventInput = {
      obs_instance_id: 999,
      event_type: 'stream_start'
    };

    expect(createStreamEvent(input)).rejects.toThrow(/OBS instance with id 999 not found/i);
  });

  it('should throw error for non-existent schedule', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    const input: CreateStreamEventInput = {
      obs_instance_id: obsInstanceId,
      schedule_id: 999,
      event_type: 'stream_start'
    };

    expect(createStreamEvent(input)).rejects.toThrow(/Schedule with id 999 not found/i);
  });
});

describe('getStreamEvents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get all stream events without filters', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    // Create multiple stream events
    const events = [
      { obs_instance_id: obsInstanceId, event_type: 'stream_start' as const },
      { obs_instance_id: obsInstanceId, event_type: 'stream_stop' as const },
      { obs_instance_id: obsInstanceId, event_type: 'manual_start' as const }
    ];

    for (const event of events) {
      await createStreamEvent(event);
    }

    const result = await getStreamEvents();

    expect(result).toHaveLength(3);
    // Should be ordered by most recent first
    expect(result[0].event_type).toEqual('manual_start');
    expect(result[1].event_type).toEqual('stream_stop');
    expect(result[2].event_type).toEqual('stream_start');
  });

  it('should filter by OBS instance', async () => {
    // Create two OBS instances
    const obsResult1 = await db.insert(obsInstancesTable)
      .values({ ...testObsInstance, name: 'OBS Instance 1' })
      .returning()
      .execute();
    const obsResult2 = await db.insert(obsInstancesTable)
      .values({ ...testObsInstance, name: 'OBS Instance 2' })
      .returning()
      .execute();

    const obsId1 = obsResult1[0].id;
    const obsId2 = obsResult2[0].id;

    // Create events for both instances
    await createStreamEvent({ obs_instance_id: obsId1, event_type: 'stream_start' });
    await createStreamEvent({ obs_instance_id: obsId2, event_type: 'stream_start' });
    await createStreamEvent({ obs_instance_id: obsId1, event_type: 'stream_stop' });

    const result = await getStreamEvents(obsId1);

    expect(result).toHaveLength(2);
    result.forEach(event => {
      expect(event.obs_instance_id).toEqual(obsId1);
    });
  });

  it('should limit results when limit is specified', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    // Create multiple events
    for (let i = 0; i < 5; i++) {
      await createStreamEvent({
        obs_instance_id: obsInstanceId,
        event_type: i % 2 === 0 ? 'stream_start' : 'stream_stop'
      });
    }

    const result = await getStreamEvents(undefined, 3);

    expect(result).toHaveLength(3);
  });
});

describe('getStreamEventsByDateRange', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should filter events by date range', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    // Create events with different dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create an event for today
    await createStreamEvent({
      obs_instance_id: obsInstanceId,
      event_type: 'stream_start'
    });

    // Query for today's events
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await getStreamEventsByDateRange(startOfDay, endOfDay);

    expect(result).toHaveLength(1);
    expect(result[0].event_type).toEqual('stream_start');
    expect(result[0].occurred_at >= startOfDay).toBe(true);
    expect(result[0].occurred_at <= endOfDay).toBe(true);
  });

  it('should filter by date range and OBS instance', async () => {
    // Create two OBS instances
    const obsResult1 = await db.insert(obsInstancesTable)
      .values({ ...testObsInstance, name: 'OBS Instance 1' })
      .returning()
      .execute();
    const obsResult2 = await db.insert(obsInstancesTable)
      .values({ ...testObsInstance, name: 'OBS Instance 2' })
      .returning()
      .execute();

    const obsId1 = obsResult1[0].id;
    const obsId2 = obsResult2[0].id;

    // Create events for both instances
    await createStreamEvent({ obs_instance_id: obsId1, event_type: 'stream_start' });
    await createStreamEvent({ obs_instance_id: obsId2, event_type: 'stream_start' });

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await getStreamEventsByDateRange(startOfDay, endOfDay, obsId1);

    expect(result).toHaveLength(1);
    expect(result[0].obs_instance_id).toEqual(obsId1);
  });
});

describe('getStreamStatistics', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should calculate basic statistics', async () => {
    // Create prerequisite OBS instance
    const obsResult = await db.insert(obsInstancesTable)
      .values(testObsInstance)
      .returning()
      .execute();
    const obsInstanceId = obsResult[0].id;

    // Create schedule
    const scheduleResult = await db.insert(schedulesTable)
      .values({
        ...testSchedule,
        obs_instance_id: obsInstanceId,
        days_of_week: [1, 2, 3, 4, 5]
      })
      .returning()
      .execute();
    const scheduleId = scheduleResult[0].id;

    // Create stream start event
    const startTime = new Date();
    await db.insert(streamEventsTable)
      .values({
        obs_instance_id: obsInstanceId,
        schedule_id: scheduleId,
        event_type: 'stream_start',
        occurred_at: startTime
      })
      .execute();

    // Create stream stop event 1 hour later
    const stopTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    await db.insert(streamEventsTable)
      .values({
        obs_instance_id: obsInstanceId,
        schedule_id: scheduleId,
        event_type: 'stream_stop',
        occurred_at: stopTime
      })
      .execute();

    // Create manual stream events
    await db.insert(streamEventsTable)
      .values({
        obs_instance_id: obsInstanceId,
        schedule_id: null,
        event_type: 'manual_start',
        occurred_at: new Date()
      })
      .execute();

    const result = await getStreamStatistics();

    expect(result.total_streams).toEqual(2); // 1 scheduled + 1 manual
    expect(result.total_duration).toEqual(3600); // 1 hour in seconds
    expect(result.average_duration).toEqual(3600);
    expect(result.scheduled_vs_manual.scheduled).toEqual(1);
    expect(result.scheduled_vs_manual.manual).toEqual(1);
  });

  it('should filter statistics by OBS instance', async () => {
    // Create two OBS instances
    const obsResult1 = await db.insert(obsInstancesTable)
      .values({ ...testObsInstance, name: 'OBS Instance 1' })
      .returning()
      .execute();
    const obsResult2 = await db.insert(obsInstancesTable)
      .values({ ...testObsInstance, name: 'OBS Instance 2' })
      .returning()
      .execute();

    const obsId1 = obsResult1[0].id;
    const obsId2 = obsResult2[0].id;

    // Create events for both instances
    await createStreamEvent({ obs_instance_id: obsId1, event_type: 'stream_start' });
    await createStreamEvent({ obs_instance_id: obsId2, event_type: 'stream_start' });
    await createStreamEvent({ obs_instance_id: obsId1, event_type: 'manual_start' });

    const result = await getStreamStatistics(obsId1);

    expect(result.total_streams).toEqual(2);
    expect(result.scheduled_vs_manual.manual).toEqual(2); // Both events for obsId1 are manual
  });

  it('should handle no events gracefully', async () => {
    const result = await getStreamStatistics();

    expect(result.total_streams).toEqual(0);
    expect(result.total_duration).toEqual(0);
    expect(result.average_duration).toEqual(0);
    expect(result.scheduled_vs_manual.scheduled).toEqual(0);
    expect(result.scheduled_vs_manual.manual).toEqual(0);
  });
});