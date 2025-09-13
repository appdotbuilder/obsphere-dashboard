import { db } from '../db';
import { schedulesTable, obsInstancesTable, streamEventsTable, notificationsTable } from '../db/schema';
import { type Schedule, type CreateStreamEventInput } from '../schema';
import { eq, and, gte, lte, or, desc } from 'drizzle-orm';

// In-memory storage for active scheduled jobs
const activeSchedules = new Map<number, Timer[]>();

export async function initializeScheduler(): Promise<void> {
    try {
        console.log('Initializing scheduler system...');
        
        // Clear any existing scheduled jobs
        activeSchedules.forEach(timers => {
            timers.forEach(timer => clearTimeout(timer));
        });
        activeSchedules.clear();
        
        // Load all active schedules from database
        const activeSchedulesList = await db.select()
            .from(schedulesTable)
            .where(eq(schedulesTable.is_active, true))
            .execute();
        
        // Schedule each active schedule
        for (const scheduleData of activeSchedulesList) {
            // Convert database result to Schedule type
            const schedule: Schedule = {
                ...scheduleData,
                days_of_week: scheduleData.days_of_week as number[]
            };
            const scheduleResult = await scheduleStream(schedule);
            if (!scheduleResult.success) {
                console.error(`Failed to schedule stream ${schedule.id}:`, scheduleResult.error);
            }
        }
        
        console.log(`Scheduler initialized with ${activeSchedulesList.length} active schedules`);
    } catch (error) {
        console.error('Scheduler initialization failed:', error);
        throw error;
    }
}

export async function scheduleStream(schedule: Schedule): Promise<{ success: boolean; error?: string }> {
    try {
        // Unschedule existing timers for this schedule
        await unscheduleStream(schedule.id);
        
        const nextExecution = await calculateNextExecution(schedule);
        if (!nextExecution) {
            return { success: false, error: 'No valid next execution time found' };
        }
        
        const now = new Date();
        const timeUntilStart = nextExecution.getTime() - now.getTime();
        
        if (timeUntilStart <= 0) {
            return { success: false, error: 'Calculated execution time is in the past' };
        }
        
        // Calculate end time based on start time and duration
        const [startHours, startMinutes] = schedule.start_time.split(':').map(Number);
        const [endHours, endMinutes] = schedule.end_time.split(':').map(Number);
        
        const startTime = new Date(nextExecution);
        const endTime = new Date(nextExecution);
        endTime.setHours(endHours, endMinutes, 0, 0);
        
        // If end time is before start time, it's next day
        if (endTime <= startTime) {
            endTime.setDate(endTime.getDate() + 1);
        }
        
        const timeUntilEnd = endTime.getTime() - now.getTime();
        const timers: Timer[] = [];
        
        // Schedule start
        const startTimer = setTimeout(async () => {
            await executeScheduledStart(schedule.id);
        }, timeUntilStart);
        timers.push(startTimer);
        
        // Schedule end (only if it's in the future)
        if (timeUntilEnd > 0) {
            const endTimer = setTimeout(async () => {
                await executeScheduledStop(schedule.id);
            }, timeUntilEnd);
            timers.push(endTimer);
        }
        
        // Store timers
        activeSchedules.set(schedule.id, timers);
        
        console.log(`Scheduled stream ${schedule.id} - Start: ${nextExecution.toISOString()}, End: ${endTime.toISOString()}`);
        return { success: true };
        
    } catch (error) {
        console.error('Failed to schedule stream:', error);
        return { success: false, error: 'Internal scheduling error' };
    }
}

export async function unscheduleStream(scheduleId: number): Promise<{ success: boolean }> {
    try {
        const timers = activeSchedules.get(scheduleId);
        if (timers) {
            timers.forEach(timer => clearTimeout(timer));
            activeSchedules.delete(scheduleId);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Failed to unschedule stream:', error);
        return { success: false };
    }
}

export async function executeScheduledStart(scheduleId: number): Promise<void> {
    try {
        console.log(`Executing scheduled start for schedule ${scheduleId}`);
        
        // Get schedule details
        const scheduleResults = await db.select()
            .from(schedulesTable)
            .innerJoin(obsInstancesTable, eq(schedulesTable.obs_instance_id, obsInstancesTable.id))
            .where(eq(schedulesTable.id, scheduleId))
            .execute();
        
        if (scheduleResults.length === 0) {
            console.error(`Schedule ${scheduleId} not found`);
            return;
        }
        
        const schedule = scheduleResults[0].schedules;
        const obsInstance = scheduleResults[0].obs_instances;
        
        // Update OBS instance status to streaming
        await db.update(obsInstancesTable)
            .set({ 
                is_streaming: true,
                status: 'connected'
            })
            .where(eq(obsInstancesTable.id, obsInstance.id))
            .execute();
        
        // Log the stream event
        await db.insert(streamEventsTable)
            .values({
                obs_instance_id: obsInstance.id,
                schedule_id: scheduleId,
                event_type: 'stream_start',
                notes: `Scheduled stream started at ${new Date().toISOString()}`
            })
            .execute();
        
        // Create start notification
        await db.insert(notificationsTable)
            .values({
                schedule_id: scheduleId,
                notification_type: 'stream_start',
                message: `Stream "${schedule.name}" started on ${obsInstance.name}`,
                sent_at: new Date()
            })
            .execute();
        
        // Reschedule for recurring schedules
        if (!schedule.is_one_time) {
            const scheduleObj: Schedule = {
                ...schedule,
                days_of_week: schedule.days_of_week as number[]
            };
            await scheduleStream(scheduleObj);
        }
        
    } catch (error) {
        console.error(`Failed to execute scheduled start for ${scheduleId}:`, error);
    }
}

export async function executeScheduledStop(scheduleId: number): Promise<void> {
    try {
        console.log(`Executing scheduled stop for schedule ${scheduleId}`);
        
        // Get schedule details
        const scheduleResults = await db.select()
            .from(schedulesTable)
            .innerJoin(obsInstancesTable, eq(schedulesTable.obs_instance_id, obsInstancesTable.id))
            .where(eq(schedulesTable.id, scheduleId))
            .execute();
        
        if (scheduleResults.length === 0) {
            console.error(`Schedule ${scheduleId} not found`);
            return;
        }
        
        const schedule = scheduleResults[0].schedules;
        const obsInstance = scheduleResults[0].obs_instances;
        
        // Update OBS instance status to not streaming
        await db.update(obsInstancesTable)
            .set({ 
                is_streaming: false,
                status: 'connected'
            })
            .where(eq(obsInstancesTable.id, obsInstance.id))
            .execute();
        
        // Log the stream event
        await db.insert(streamEventsTable)
            .values({
                obs_instance_id: obsInstance.id,
                schedule_id: scheduleId,
                event_type: 'stream_stop',
                notes: `Scheduled stream stopped at ${new Date().toISOString()}`
            })
            .execute();
        
        // Create stop notification
        await db.insert(notificationsTable)
            .values({
                schedule_id: scheduleId,
                notification_type: 'stream_stop',
                message: `Stream "${schedule.name}" stopped on ${obsInstance.name}`,
                sent_at: new Date()
            })
            .execute();
        
    } catch (error) {
        console.error(`Failed to execute scheduled stop for ${scheduleId}:`, error);
    }
}

export async function getNextScheduledEvent(): Promise<{
    schedule_id: number;
    event_type: 'start' | 'stop';
    scheduled_time: Date;
    obs_instance_name: string;
} | null> {
    try {
        // Get all active schedules
        const schedules = await db.select()
            .from(schedulesTable)
            .innerJoin(obsInstancesTable, eq(schedulesTable.obs_instance_id, obsInstancesTable.id))
            .where(eq(schedulesTable.is_active, true))
            .execute();
        
        let nextEvent: {
            schedule_id: number;
            event_type: 'start' | 'stop';
            scheduled_time: Date;
            obs_instance_name: string;
        } | null = null;
        
        const now = new Date();
        
        for (const result of schedules) {
            const scheduleData = result.schedules;
            const obsInstance = result.obs_instances;
            
            // Convert database result to Schedule type
            const schedule: Schedule = {
                ...scheduleData,
                days_of_week: scheduleData.days_of_week as number[]
            };
            
            const nextStart = await calculateNextExecution(schedule);
            if (nextStart && nextStart > now) {
                if (!nextEvent || nextStart < nextEvent.scheduled_time) {
                    nextEvent = {
                        schedule_id: schedule.id,
                        event_type: 'start',
                        scheduled_time: nextStart,
                        obs_instance_name: obsInstance.name
                    };
                }
            }
        }
        
        return nextEvent;
        
    } catch (error) {
        console.error('Failed to get next scheduled event:', error);
        return null;
    }
}

export async function validateScheduleConflicts(schedules: Schedule[]): Promise<string[]> {
    try {
        const conflicts: string[] = [];
        
        // Sort schedules by OBS instance and start time for easier comparison
        const sortedSchedules = [...schedules].sort((a, b) => {
            if (a.obs_instance_id !== b.obs_instance_id) {
                return a.obs_instance_id - b.obs_instance_id;
            }
            return a.start_time.localeCompare(b.start_time);
        });
        
        for (let i = 0; i < sortedSchedules.length; i++) {
            const currentSchedule = sortedSchedules[i];
            
            // Validate time range
            if (currentSchedule.start_time >= currentSchedule.end_time) {
                conflicts.push(`Schedule "${currentSchedule.name}" has invalid time range: ${currentSchedule.start_time} to ${currentSchedule.end_time}`);
            }
            
            // Check for overlaps with other schedules on same OBS instance
            for (let j = i + 1; j < sortedSchedules.length; j++) {
                const otherSchedule = sortedSchedules[j];
                
                // Only check schedules on the same OBS instance
                if (currentSchedule.obs_instance_id !== otherSchedule.obs_instance_id) {
                    continue;
                }
                
                // Check if schedules have overlapping days
                const currentDays = currentSchedule.days_of_week as number[];
                const otherDays = otherSchedule.days_of_week as number[];
                const hasOverlappingDays = currentDays.some(day => otherDays.includes(day));
                
                if (hasOverlappingDays) {
                    // Check for time overlap
                    const currentStart = parseTimeString(currentSchedule.start_time);
                    const currentEnd = parseTimeString(currentSchedule.end_time);
                    const otherStart = parseTimeString(otherSchedule.start_time);
                    const otherEnd = parseTimeString(otherSchedule.end_time);
                    
                    // Handle overnight schedules
                    let currentEndAdjusted = currentEnd;
                    let otherEndAdjusted = otherEnd;
                    
                    if (currentEnd <= currentStart) currentEndAdjusted += 24 * 60; // Next day
                    if (otherEnd <= otherStart) otherEndAdjusted += 24 * 60; // Next day
                    
                    // Check for overlap
                    const overlaps = (currentStart < otherEndAdjusted && currentEndAdjusted > otherStart);
                    
                    if (overlaps) {
                        conflicts.push(`Schedules "${currentSchedule.name}" and "${otherSchedule.name}" have overlapping times on the same OBS instance`);
                    }
                    
                    // Check for insufficient break time (5 minutes minimum)
                    const minBreakTime = 5; // 5 minutes
                    
                    // Check if current schedule ends and other starts with insufficient gap
                    if (currentEndAdjusted <= otherStart && (otherStart - currentEndAdjusted) < minBreakTime) {
                        conflicts.push(`Insufficient break time between "${currentSchedule.name}" and "${otherSchedule.name}" (minimum 5 minutes required)`);
                    }
                    // Check if other schedule ends and current starts with insufficient gap
                    if (otherEndAdjusted <= currentStart && (currentStart - otherEndAdjusted) < minBreakTime) {
                        conflicts.push(`Insufficient break time between "${otherSchedule.name}" and "${currentSchedule.name}" (minimum 5 minutes required)`);
                    }
                }
            }
        }
        
        return conflicts;
        
    } catch (error) {
        console.error('Failed to validate schedule conflicts:', error);
        return ['Internal error during conflict validation'];
    }
}

export async function calculateNextExecution(schedule: Schedule): Promise<Date | null> {
    try {
        const now = new Date();
        
        // Convert current time to IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
        const nowIST = new Date(now.getTime() + istOffset);
        
        // For one-time schedules
        if (schedule.is_one_time && schedule.execution_date) {
            const executionDate = new Date(schedule.execution_date);
            const [hours, minutes] = schedule.start_time.split(':').map(Number);
            
            // Convert execution date to IST
            const executionIST = new Date(executionDate.getTime() + istOffset);
            executionIST.setHours(hours, minutes, 0, 0);
            
            // Convert back to UTC for return
            const executionUTC = new Date(executionIST.getTime() - istOffset);
            
            if (executionUTC > now) {
                return executionUTC;
            }
            return null;
        }
        
        // For recurring schedules
        const daysOfWeek = schedule.days_of_week as number[];
        if (daysOfWeek.length === 0) {
            return null;
        }
        
        const [hours, minutes] = schedule.start_time.split(':').map(Number);
        
        // Check next 14 days to find the next valid execution
        for (let daysAhead = 0; daysAhead <= 14; daysAhead++) {
            const checkDate = new Date(nowIST);
            checkDate.setDate(checkDate.getDate() + daysAhead);
            checkDate.setHours(hours, minutes, 0, 0);
            
            const dayOfWeek = checkDate.getDay();
            
            if (daysOfWeek.includes(dayOfWeek)) {
                // Convert back to UTC
                const executionUTC = new Date(checkDate.getTime() - istOffset);
                
                // Only return if it's in the future
                if (executionUTC > now) {
                    return executionUTC;
                }
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Failed to calculate next execution:', error);
        return null;
    }
}

// Helper function to parse time string to minutes since midnight
function parseTimeString(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}