import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schedulesTable, obsInstancesTable } from '../db/schema';
import { type CreateScheduleInput } from '../schema';
import { createSchedule } from '../handlers/schedules';
import { eq } from 'drizzle-orm';

describe('createSchedule', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test OBS instance first
  const createTestObsInstance = async () => {
    const result = await db.insert(obsInstancesTable)
      .values({
        name: 'Test OBS Instance',
        websocket_url: 'ws://localhost:4455'
      })
      .returning()
      .execute();
    return result[0].id;
  };

  // Basic test input
  const createTestInput = (obsInstanceId: number): CreateScheduleInput => ({
    name: 'Weekly Stream Schedule',
    obs_instance_id: obsInstanceId,
    start_time: '20:00',
    end_time: '22:00',
    days_of_week: [1, 3, 5], // Monday, Wednesday, Friday
    is_one_time: false,
    execution_date: null,
    video_start_timestamp: null
  });

  it('should create a schedule with all fields', async () => {
    const obsInstanceId = await createTestObsInstance();
    const testInput = createTestInput(obsInstanceId);

    const result = await createSchedule(testInput);

    // Verify all fields are correctly set
    expect(result.name).toEqual('Weekly Stream Schedule');
    expect(result.obs_instance_id).toEqual(obsInstanceId);
    expect(result.start_time).toEqual('20:00');
    expect(result.end_time).toEqual('22:00');
    expect(result.days_of_week).toEqual([1, 3, 5]);
    expect(result.is_active).toBe(true);
    expect(result.is_one_time).toBe(false);
    expect(result.execution_date).toBeNull();
    expect(result.video_start_timestamp).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save schedule to database', async () => {
    const obsInstanceId = await createTestObsInstance();
    const testInput = createTestInput(obsInstanceId);

    const result = await createSchedule(testInput);

    // Query database to verify schedule was saved
    const schedules = await db.select()
      .from(schedulesTable)
      .where(eq(schedulesTable.id, result.id))
      .execute();

    expect(schedules).toHaveLength(1);
    const savedSchedule = schedules[0];
    
    expect(savedSchedule.name).toEqual('Weekly Stream Schedule');
    expect(savedSchedule.obs_instance_id).toEqual(obsInstanceId);
    expect(savedSchedule.start_time).toEqual('20:00');
    expect(savedSchedule.end_time).toEqual('22:00');
    expect(savedSchedule.days_of_week).toEqual([1, 3, 5]); // jsonb returns array directly
    expect(savedSchedule.is_active).toBe(true);
    expect(savedSchedule.is_one_time).toBe(false);
    expect(savedSchedule.created_at).toBeInstanceOf(Date);
  });

  it('should create one-time schedule with execution date', async () => {
    const obsInstanceId = await createTestObsInstance();
    const executionDate = new Date('2024-12-25T20:00:00Z');
    
    const testInput: CreateScheduleInput = {
      name: 'Christmas Special Stream',
      obs_instance_id: obsInstanceId,
      start_time: '20:00',
      end_time: '23:00',
      days_of_week: [2], // Tuesday
      is_one_time: true,
      execution_date: executionDate,
      video_start_timestamp: 300 // Start 5 minutes into video
    };

    const result = await createSchedule(testInput);

    expect(result.name).toEqual('Christmas Special Stream');
    expect(result.is_one_time).toBe(true);
    expect(result.execution_date).toEqual(executionDate);
    expect(result.video_start_timestamp).toEqual(300);
  });

  it('should handle minimal input with defaults', async () => {
    const obsInstanceId = await createTestObsInstance();
    
    const minimalInput: CreateScheduleInput = {
      name: 'Simple Schedule',
      obs_instance_id: obsInstanceId,
      start_time: '10:00',
      end_time: '11:00',
      days_of_week: [0, 6] // Sunday, Saturday
    };

    const result = await createSchedule(minimalInput);

    expect(result.name).toEqual('Simple Schedule');
    expect(result.is_one_time).toBe(false); // Default value
    expect(result.execution_date).toBeNull(); // Default value
    expect(result.video_start_timestamp).toBeNull(); // Default value
    expect(result.is_active).toBe(true); // Database default
  });

  it('should handle complex days of week array', async () => {
    const obsInstanceId = await createTestObsInstance();
    
    const testInput: CreateScheduleInput = {
      name: 'Daily Stream',
      obs_instance_id: obsInstanceId,
      start_time: '18:00',
      end_time: '20:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6] // Every day
    };

    const result = await createSchedule(testInput);

    expect(result.days_of_week).toEqual([0, 1, 2, 3, 4, 5, 6]);
    
    // Verify in database that jsonb storage worked correctly
    const schedules = await db.select()
      .from(schedulesTable)
      .where(eq(schedulesTable.id, result.id))
      .execute();
    
    expect(schedules[0].days_of_week).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('should fail when OBS instance does not exist', async () => {
    const nonExistentObsId = 999;
    const testInput = createTestInput(nonExistentObsId);

    await expect(createSchedule(testInput)).rejects.toThrow(/OBS instance with id 999 not found/i);
  });

  it('should create schedule with video timestamp', async () => {
    const obsInstanceId = await createTestObsInstance();
    
    const testInput: CreateScheduleInput = {
      name: 'Timestamp Test Schedule',
      obs_instance_id: obsInstanceId,
      start_time: '15:30',
      end_time: '16:45',
      days_of_week: [2, 4], // Tuesday, Thursday
      video_start_timestamp: 1800 // 30 minutes
    };

    const result = await createSchedule(testInput);

    expect(result.video_start_timestamp).toEqual(1800);
    expect(result.start_time).toEqual('15:30');
    expect(result.end_time).toEqual('16:45');
  });

  it('should handle empty days of week array', async () => {
    const obsInstanceId = await createTestObsInstance();
    
    const testInput: CreateScheduleInput = {
      name: 'No Days Schedule',
      obs_instance_id: obsInstanceId,
      start_time: '12:00',
      end_time: '13:00',
      days_of_week: []
    };

    const result = await createSchedule(testInput);

    expect(result.days_of_week).toEqual([]);
    
    // Verify database storage
    const schedules = await db.select()
      .from(schedulesTable)
      .where(eq(schedulesTable.id, result.id))
      .execute();
    
    expect(schedules[0].days_of_week).toEqual([]);
  });
});