import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schedulesTable, obsInstancesTable, streamEventsTable, notificationsTable } from '../db/schema';
import { type Schedule, type CreateScheduleInput } from '../schema';
import { 
  initializeScheduler, 
  scheduleStream, 
  unscheduleStream, 
  executeScheduledStart, 
  executeScheduledStop, 
  getNextScheduledEvent, 
  validateScheduleConflicts, 
  calculateNextExecution 
} from '../handlers/scheduler';
import { eq } from 'drizzle-orm';

// Helper to create test OBS instance
async function createTestObsInstance() {
  const result = await db.insert(obsInstancesTable)
    .values({
      name: 'Test OBS',
      websocket_url: 'ws://localhost:4455',
      status: 'connected',
      is_streaming: false
    })
    .returning()
    .execute();
  return result[0];
}

// Helper to create test schedule
async function createTestSchedule(obsInstanceId: number, overrides: Partial<any> = {}): Promise<Schedule> {
  const defaultSchedule = {
    name: 'Test Schedule',
    obs_instance_id: obsInstanceId,
    start_time: '10:00',
    end_time: '11:00',
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
    is_active: true,
    is_one_time: false,
    execution_date: null,
    video_start_timestamp: null,
    ...overrides
  };

  const result = await db.insert(schedulesTable)
    .values({
      ...defaultSchedule,
      days_of_week: JSON.stringify(defaultSchedule.days_of_week)
    })
    .returning()
    .execute();

  return {
    ...result[0],
    days_of_week: defaultSchedule.days_of_week,
    created_at: result[0].created_at!,
    updated_at: result[0].updated_at!
  } as Schedule;
}

describe('scheduler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('calculateNextExecution', () => {
    it('should calculate next execution for recurring schedule', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id, {
        start_time: '23:59', // Close to midnight to test edge cases
        days_of_week: [0, 1, 2, 3, 4, 5, 6] // All days
      });

      const nextExecution = await calculateNextExecution(schedule);
      
      expect(nextExecution).toBeDefined();
      expect(nextExecution).toBeInstanceOf(Date);
      expect(nextExecution!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should calculate execution for one-time schedule', async () => {
      const obsInstance = await createTestObsInstance();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const schedule = await createTestSchedule(obsInstance.id, {
        is_one_time: true,
        execution_date: tomorrow,
        start_time: '15:00'
      });

      const nextExecution = await calculateNextExecution(schedule);
      
      expect(nextExecution).toBeDefined();
      expect(nextExecution).toBeInstanceOf(Date);
      expect(nextExecution!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for past one-time schedule', async () => {
      const obsInstance = await createTestObsInstance();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const schedule = await createTestSchedule(obsInstance.id, {
        is_one_time: true,
        execution_date: yesterday,
        start_time: '15:00'
      });

      const nextExecution = await calculateNextExecution(schedule);
      
      expect(nextExecution).toBeNull();
    });

    it('should return null for schedule with empty days_of_week', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id, {
        days_of_week: []
      });

      const nextExecution = await calculateNextExecution(schedule);
      
      expect(nextExecution).toBeNull();
    });
  });

  describe('scheduleStream', () => {
    it('should successfully schedule a valid stream', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id, {
        start_time: '23:59', // Schedule for later to ensure it's in future
        days_of_week: [0, 1, 2, 3, 4, 5, 6] // All days
      });

      const result = await scheduleStream(schedule);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail to schedule stream with no valid execution time', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id, {
        days_of_week: [] // No valid days
      });

      const result = await scheduleStream(schedule);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid next execution time');
    });
  });

  describe('unscheduleStream', () => {
    it('should successfully unschedule a stream', async () => {
      const result = await unscheduleStream(999);
      
      expect(result.success).toBe(true);
    });
  });

  describe('executeScheduledStart', () => {
    it('should execute scheduled start and update database', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id);

      await executeScheduledStart(schedule.id);

      // Check OBS instance was updated
      const updatedObs = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstance.id))
        .execute();

      expect(updatedObs[0].is_streaming).toBe(true);
      expect(updatedObs[0].status).toBe('connected');

      // Check stream event was logged
      const streamEvents = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.schedule_id, schedule.id))
        .execute();

      expect(streamEvents).toHaveLength(1);
      expect(streamEvents[0].event_type).toBe('stream_start');

      // Check notification was created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.schedule_id, schedule.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].notification_type).toBe('stream_start');
      expect(notifications[0].sent_at).toBeDefined();
    });

    it('should handle non-existent schedule gracefully', async () => {
      // Should not throw error for non-existent schedule
      await expect(executeScheduledStart(999)).resolves.toBeUndefined();
    });
  });

  describe('executeScheduledStop', () => {
    it('should execute scheduled stop and update database', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id);

      // First start the stream
      await db.update(obsInstancesTable)
        .set({ is_streaming: true })
        .where(eq(obsInstancesTable.id, obsInstance.id))
        .execute();

      await executeScheduledStop(schedule.id);

      // Check OBS instance was updated
      const updatedObs = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstance.id))
        .execute();

      expect(updatedObs[0].is_streaming).toBe(false);
      expect(updatedObs[0].status).toBe('connected');

      // Check stream event was logged
      const streamEvents = await db.select()
        .from(streamEventsTable)
        .where(eq(streamEventsTable.schedule_id, schedule.id))
        .execute();

      expect(streamEvents).toHaveLength(1);
      expect(streamEvents[0].event_type).toBe('stream_stop');

      // Check notification was created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.schedule_id, schedule.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].notification_type).toBe('stream_stop');
      expect(notifications[0].sent_at).toBeDefined();
    });

    it('should handle non-existent schedule gracefully', async () => {
      // Should not throw error for non-existent schedule
      await expect(executeScheduledStop(999)).resolves.toBeUndefined();
    });
  });

  describe('getNextScheduledEvent', () => {
    it('should return next scheduled event', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule = await createTestSchedule(obsInstance.id, {
        start_time: '23:59', // Schedule for later
        days_of_week: [0, 1, 2, 3, 4, 5, 6] // All days
      });

      const nextEvent = await getNextScheduledEvent();
      
      expect(nextEvent).toBeDefined();
      expect(nextEvent!.schedule_id).toBe(schedule.id);
      expect(nextEvent!.event_type).toBe('start');
      expect(nextEvent!.scheduled_time).toBeInstanceOf(Date);
      expect(nextEvent!.obs_instance_name).toBe('Test OBS');
    });

    it('should return null when no active schedules exist', async () => {
      const nextEvent = await getNextScheduledEvent();
      
      expect(nextEvent).toBeNull();
    });

    it('should ignore inactive schedules', async () => {
      const obsInstance = await createTestObsInstance();
      await createTestSchedule(obsInstance.id, {
        is_active: false,
        start_time: '23:59',
        days_of_week: [0, 1, 2, 3, 4, 5, 6]
      });

      const nextEvent = await getNextScheduledEvent();
      
      expect(nextEvent).toBeNull();
    });
  });

  describe('validateScheduleConflicts', () => {
    it('should detect overlapping schedules on same OBS instance', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule1 = await createTestSchedule(obsInstance.id, {
        name: 'Morning Show',
        start_time: '09:00',
        end_time: '11:00',
        days_of_week: [1, 2, 3] // Mon, Tue, Wed
      });

      const schedule2 = await createTestSchedule(obsInstance.id, {
        name: 'Overlapping Show',
        start_time: '10:30',
        end_time: '12:00',
        days_of_week: [1, 3, 5] // Mon, Wed, Fri - overlaps on Mon, Wed
      });

      const conflicts = await validateScheduleConflicts([schedule1, schedule2]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toContain('overlapping times');
      expect(conflicts[0]).toContain('Morning Show');
      expect(conflicts[0]).toContain('Overlapping Show');
    });

    it('should detect invalid time ranges', async () => {
      const obsInstance = await createTestObsInstance();
      const invalidSchedule = await createTestSchedule(obsInstance.id, {
        name: 'Invalid Schedule',
        start_time: '15:00',
        end_time: '14:00' // End before start
      });

      const conflicts = await validateScheduleConflicts([invalidSchedule]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toContain('invalid time range');
      expect(conflicts[0]).toContain('Invalid Schedule');
    });

    it('should detect insufficient break time', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule1 = await createTestSchedule(obsInstance.id, {
        name: 'First Show',
        start_time: '09:00',
        end_time: '10:00',
        days_of_week: [1] // Monday
      });

      const schedule2 = await createTestSchedule(obsInstance.id, {
        name: 'Second Show',
        start_time: '10:02', // Only 2 minutes break
        end_time: '11:00',
        days_of_week: [1] // Monday
      });

      const conflicts = await validateScheduleConflicts([schedule1, schedule2]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toContain('Insufficient break time');
      expect(conflicts[0]).toContain('minimum 5 minutes');
    });

    it('should not detect conflicts for different OBS instances', async () => {
      const obsInstance1 = await createTestObsInstance();
      const obsInstance2 = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS 2',
          websocket_url: 'ws://localhost:4456',
          status: 'connected',
          is_streaming: false
        })
        .returning()
        .execute();

      const schedule1 = await createTestSchedule(obsInstance1.id, {
        start_time: '09:00',
        end_time: '11:00',
        days_of_week: [1]
      });

      const schedule2 = await createTestSchedule(obsInstance2[0].id, {
        start_time: '10:00',
        end_time: '12:00',
        days_of_week: [1]
      });

      const conflicts = await validateScheduleConflicts([schedule1, schedule2]);
      
      expect(conflicts).toHaveLength(0);
    });

    it('should not detect conflicts for non-overlapping days', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule1 = await createTestSchedule(obsInstance.id, {
        start_time: '09:00',
        end_time: '11:00',
        days_of_week: [1, 3] // Mon, Wed
      });

      const schedule2 = await createTestSchedule(obsInstance.id, {
        start_time: '10:00',
        end_time: '12:00',
        days_of_week: [2, 4] // Tue, Thu
      });

      const conflicts = await validateScheduleConflicts([schedule1, schedule2]);
      
      expect(conflicts).toHaveLength(0);
    });

    it('should return empty array for valid schedules', async () => {
      const obsInstance = await createTestObsInstance();
      const schedule1 = await createTestSchedule(obsInstance.id, {
        start_time: '09:00',
        end_time: '10:00',
        days_of_week: [1]
      });

      const schedule2 = await createTestSchedule(obsInstance.id, {
        start_time: '10:06', // 6 minute break (more than 5 minutes required)
        end_time: '11:00',
        days_of_week: [1]
      });

      const conflicts = await validateScheduleConflicts([schedule1, schedule2]);
      
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('initializeScheduler', () => {
    it('should initialize scheduler without errors', async () => {
      // Should not throw any errors
      await expect(initializeScheduler()).resolves.toBeUndefined();
    });

    it('should load and schedule active schedules', async () => {
      const obsInstance = await createTestObsInstance();
      await createTestSchedule(obsInstance.id, {
        is_active: true,
        start_time: '23:59',
        days_of_week: [0, 1, 2, 3, 4, 5, 6]
      });

      // Should not throw any errors when loading active schedules
      await expect(initializeScheduler()).resolves.toBeUndefined();
    });
  });
});