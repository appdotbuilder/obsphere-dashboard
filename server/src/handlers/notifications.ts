import { db } from '../db';
import { notificationsTable, schedulesTable, obsInstancesTable } from '../db/schema';
import { type Notification } from '../schema';
import { eq, isNull, and, gte, lte } from 'drizzle-orm';

export async function createNotification(scheduleId: number, type: 'pre_stream' | 'stream_start' | 'stream_stop', message: string): Promise<Notification> {
    try {
        const result = await db.insert(notificationsTable)
            .values({
                schedule_id: scheduleId,
                notification_type: type,
                message: message,
                sent_at: null // Not sent yet
            })
            .returning()
            .execute();

        // Type cast to ensure proper Zod schema compliance
        return {
            ...result[0],
            notification_type: result[0].notification_type as 'pre_stream' | 'stream_start' | 'stream_stop'
        };
    } catch (error) {
        console.error('Notification creation failed:', error);
        throw error;
    }
}

export async function sendTelegramNotification(notificationId: number): Promise<{ success: boolean; error?: string }> {
    try {
        // In a real implementation, this would send to Telegram API
        // For now, we'll simulate successful sending by updating the sent_at timestamp
        const result = await db.update(notificationsTable)
            .set({ sent_at: new Date() })
            .where(eq(notificationsTable.id, notificationId))
            .returning()
            .execute();

        if (result.length === 0) {
            return { success: false, error: 'Notification not found' };
        }

        // Simulate Telegram API call success
        return { success: true };
    } catch (error) {
        console.error('Telegram notification sending failed:', error);
        return { success: false, error: 'Failed to send Telegram notification' };
    }
}

export async function getPendingNotifications(): Promise<Notification[]> {
    try {
        const results = await db.select()
            .from(notificationsTable)
            .where(isNull(notificationsTable.sent_at))
            .execute();

        // Type cast to ensure proper Zod schema compliance
        return results.map(result => ({
            ...result,
            notification_type: result.notification_type as 'pre_stream' | 'stream_start' | 'stream_stop'
        }));
    } catch (error) {
        console.error('Failed to fetch pending notifications:', error);
        throw error;
    }
}

export async function generateScheduleNotifications(scheduleId: number): Promise<Notification[]> {
    try {
        // Get the schedule information to create meaningful messages
        const scheduleResults = await db.select({
            name: schedulesTable.name,
            start_time: schedulesTable.start_time,
            end_time: schedulesTable.end_time,
            obs_instance_name: obsInstancesTable.name
        })
            .from(schedulesTable)
            .innerJoin(obsInstancesTable, eq(schedulesTable.obs_instance_id, obsInstancesTable.id))
            .where(eq(schedulesTable.id, scheduleId))
            .execute();

        if (scheduleResults.length === 0) {
            throw new Error('Schedule not found');
        }

        const schedule = scheduleResults[0];
        const notifications: Notification[] = [];

        // Generate pre-stream notification
        const preStreamMessage = await formatNotificationMessage('pre_stream', {
            name: schedule.name,
            start_time: schedule.start_time,
            end_time: schedule.end_time
        });
        
        const preStreamNotification = await createNotification(scheduleId, 'pre_stream', preStreamMessage);
        notifications.push(preStreamNotification);

        // Generate stream start notification
        const streamStartMessage = await formatNotificationMessage('stream_start', {
            name: schedule.name,
            start_time: schedule.start_time,
            end_time: schedule.end_time
        });
        
        const streamStartNotification = await createNotification(scheduleId, 'stream_start', streamStartMessage);
        notifications.push(streamStartNotification);

        // Generate stream stop notification
        const streamStopMessage = await formatNotificationMessage('stream_stop', {
            name: schedule.name,
            start_time: schedule.start_time,
            end_time: schedule.end_time
        });
        
        const streamStopNotification = await createNotification(scheduleId, 'stream_stop', streamStopMessage);
        notifications.push(streamStopNotification);

        return notifications;
    } catch (error) {
        console.error('Failed to generate schedule notifications:', error);
        throw error;
    }
}

export async function sendPreStreamNotifications(): Promise<{ sent: number; failed: number }> {
    try {
        // Get current time and time 1 minute from now for checking upcoming streams
        const now = new Date();
        const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
        
        // Format times as HH:MM for database comparison
        const currentTime = now.toTimeString().slice(0, 5);
        const futureTime = oneMinuteFromNow.toTimeString().slice(0, 5);

        // Find schedules that should start within the next minute
        const upcomingSchedules = await db.select({
            schedule_id: schedulesTable.id,
            notification_id: notificationsTable.id
        })
            .from(schedulesTable)
            .innerJoin(notificationsTable, and(
                eq(notificationsTable.schedule_id, schedulesTable.id),
                eq(notificationsTable.notification_type, 'pre_stream'),
                isNull(notificationsTable.sent_at)
            ))
            .where(and(
                eq(schedulesTable.is_active, true),
                gte(schedulesTable.start_time, currentTime),
                lte(schedulesTable.start_time, futureTime)
            ))
            .execute();

        let sent = 0;
        let failed = 0;

        // Send notifications for each upcoming schedule
        for (const schedule of upcomingSchedules) {
            const result = await sendTelegramNotification(schedule.notification_id);
            if (result.success) {
                sent++;
            } else {
                failed++;
            }
        }

        return { sent, failed };
    } catch (error) {
        console.error('Failed to send pre-stream notifications:', error);
        throw error;
    }
}

export async function formatNotificationMessage(
    eventType: 'pre_stream' | 'stream_start' | 'stream_stop',
    currentStream: { name: string; start_time: string; end_time: string },
    nextStream?: { name: string; start_time: string }
): Promise<string> {
    try {
        switch (eventType) {
            case 'pre_stream':
                return `🔜 Starting Soon: "${currentStream.name}" will begin at ${currentStream.start_time} and end at ${currentStream.end_time}`;
            
            case 'stream_start':
                let startMessage = `🔴 Live Now: "${currentStream.name}" is now streaming! Started at ${currentStream.start_time}, ending at ${currentStream.end_time}`;
                if (nextStream) {
                    startMessage += `\n📅 Next: "${nextStream.name}" at ${nextStream.start_time}`;
                }
                return startMessage;
            
            case 'stream_stop':
                let stopMessage = `⏹️ Stream Ended: "${currentStream.name}" has finished streaming. Was live from ${currentStream.start_time} to ${currentStream.end_time}`;
                if (nextStream) {
                    stopMessage += `\n📅 Next: "${nextStream.name}" at ${nextStream.start_time}`;
                }
                return stopMessage;
            
            default:
                return `${eventType}: ${currentStream.name}`;
        }
    } catch (error) {
        console.error('Failed to format notification message:', error);
        throw error;
    }
}