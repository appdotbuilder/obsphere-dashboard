import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { obsInstancesTable, schedulesTable, notificationsTable } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import {
    createNotification,
    sendTelegramNotification,
    getPendingNotifications,
    generateScheduleNotifications,
    sendPreStreamNotifications,
    formatNotificationMessage
} from '../handlers/notifications';

// Test data
const testObsInstance = {
    name: 'Test OBS Instance',
    websocket_url: 'ws://localhost:4444',
    profile_name: 'Test Profile',
    stream_key: 'test-stream-key'
};

const testSchedule = {
    name: 'Morning Stream',
    start_time: '09:00',
    end_time: '11:00',
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
    is_active: true,
    is_one_time: false,
    execution_date: null,
    video_start_timestamp: null
};

describe('notifications', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    let obsInstanceId: number;
    let scheduleId: number;

    beforeEach(async () => {
        // Create prerequisite data
        const obsResult = await db.insert(obsInstancesTable)
            .values(testObsInstance)
            .returning()
            .execute();
        obsInstanceId = obsResult[0].id;

        const scheduleResult = await db.insert(schedulesTable)
            .values({
                ...testSchedule,
                obs_instance_id: obsInstanceId
            })
            .returning()
            .execute();
        scheduleId = scheduleResult[0].id;
    });

    describe('createNotification', () => {
        it('should create a notification', async () => {
            const message = 'Test notification message';
            const result = await createNotification(scheduleId, 'pre_stream', message);

            expect(result.schedule_id).toEqual(scheduleId);
            expect(result.notification_type).toEqual('pre_stream');
            expect(result.message).toEqual(message);
            expect(result.sent_at).toBeNull();
            expect(result.id).toBeDefined();
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('should save notification to database', async () => {
            const message = 'Database test message';
            const result = await createNotification(scheduleId, 'stream_start', message);

            const notifications = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.id, result.id))
                .execute();

            expect(notifications).toHaveLength(1);
            expect(notifications[0].schedule_id).toEqual(scheduleId);
            expect(notifications[0].notification_type).toEqual('stream_start');
            expect(notifications[0].message).toEqual(message);
            expect(notifications[0].sent_at).toBeNull();
        });

        it('should handle different notification types', async () => {
            const types: ('pre_stream' | 'stream_start' | 'stream_stop')[] = ['pre_stream', 'stream_start', 'stream_stop'];
            
            for (const type of types) {
                const result = await createNotification(scheduleId, type, `Test ${type} message`);
                expect(result.notification_type).toEqual(type);
            }
        });
    });

    describe('sendTelegramNotification', () => {
        it('should mark notification as sent', async () => {
            // Create a notification first
            const notification = await createNotification(scheduleId, 'pre_stream', 'Test message');
            
            const result = await sendTelegramNotification(notification.id);
            
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            // Verify the notification was marked as sent
            const updatedNotifications = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.id, notification.id))
                .execute();

            expect(updatedNotifications[0].sent_at).toBeInstanceOf(Date);
        });

        it('should return error for non-existent notification', async () => {
            const result = await sendTelegramNotification(99999);
            
            expect(result.success).toBe(false);
            expect(result.error).toEqual('Notification not found');
        });
    });

    describe('getPendingNotifications', () => {
        it('should return empty array when no pending notifications', async () => {
            const result = await getPendingNotifications();
            expect(result).toHaveLength(0);
        });

        it('should return only unsent notifications', async () => {
            // Create multiple notifications
            const notification1 = await createNotification(scheduleId, 'pre_stream', 'Message 1');
            const notification2 = await createNotification(scheduleId, 'stream_start', 'Message 2');
            
            // Send one notification
            await sendTelegramNotification(notification1.id);
            
            const pending = await getPendingNotifications();
            
            expect(pending).toHaveLength(1);
            expect(pending[0].id).toEqual(notification2.id);
            expect(pending[0].sent_at).toBeNull();
        });

        it('should return multiple pending notifications', async () => {
            // Create multiple unsent notifications
            await createNotification(scheduleId, 'pre_stream', 'Message 1');
            await createNotification(scheduleId, 'stream_start', 'Message 2');
            await createNotification(scheduleId, 'stream_stop', 'Message 3');
            
            const pending = await getPendingNotifications();
            
            expect(pending).toHaveLength(3);
            pending.forEach(notification => {
                expect(notification.sent_at).toBeNull();
            });
        });
    });

    describe('generateScheduleNotifications', () => {
        it('should generate three notifications for a schedule', async () => {
            const notifications = await generateScheduleNotifications(scheduleId);
            
            expect(notifications).toHaveLength(3);
            
            const types = notifications.map(n => n.notification_type);
            expect(types).toContain('pre_stream');
            expect(types).toContain('stream_start');
            expect(types).toContain('stream_stop');
            
            notifications.forEach(notification => {
                expect(notification.schedule_id).toEqual(scheduleId);
                expect(notification.sent_at).toBeNull();
                expect(notification.message).toBeDefined();
                expect(notification.message.length).toBeGreaterThan(0);
            });
        });

        it('should create notifications in database', async () => {
            await generateScheduleNotifications(scheduleId);
            
            const dbNotifications = await db.select()
                .from(notificationsTable)
                .where(eq(notificationsTable.schedule_id, scheduleId))
                .execute();
                
            expect(dbNotifications).toHaveLength(3);
        });

        it('should throw error for non-existent schedule', async () => {
            await expect(generateScheduleNotifications(99999)).rejects.toThrow(/Schedule not found/i);
        });
    });

    describe('sendPreStreamNotifications', () => {
        it('should handle no upcoming streams', async () => {
            const result = await sendPreStreamNotifications();
            
            expect(result.sent).toEqual(0);
            expect(result.failed).toEqual(0);
        });

        it('should process upcoming streams within time window', async () => {
            // Create a schedule that should start soon
            const now = new Date();
            const soonTime = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
            const futureSchedule = {
                ...testSchedule,
                name: 'Upcoming Stream',
                start_time: soonTime.toTimeString().slice(0, 5),
                obs_instance_id: obsInstanceId
            };

            const scheduleResult = await db.insert(schedulesTable)
                .values(futureSchedule)
                .returning()
                .execute();

            // Generate notifications for this schedule
            await generateScheduleNotifications(scheduleResult[0].id);
            
            const result = await sendPreStreamNotifications();
            
            expect(result.sent).toEqual(1);
            expect(result.failed).toEqual(0);
        });
    });

    describe('formatNotificationMessage', () => {
        const streamInfo = {
            name: 'Test Stream',
            start_time: '09:00',
            end_time: '11:00'
        };

        it('should format pre_stream message', async () => {
            const message = await formatNotificationMessage('pre_stream', streamInfo);
            
            expect(message).toContain('🔜 Starting Soon');
            expect(message).toContain('Test Stream');
            expect(message).toContain('09:00');
            expect(message).toContain('11:00');
        });

        it('should format stream_start message', async () => {
            const message = await formatNotificationMessage('stream_start', streamInfo);
            
            expect(message).toContain('🔴 Live Now');
            expect(message).toContain('Test Stream');
            expect(message).toContain('09:00');
            expect(message).toContain('11:00');
        });

        it('should format stream_stop message', async () => {
            const message = await formatNotificationMessage('stream_stop', streamInfo);
            
            expect(message).toContain('⏹️ Stream Ended');
            expect(message).toContain('Test Stream');
            expect(message).toContain('09:00');
            expect(message).toContain('11:00');
        });

        it('should include next stream information when provided', async () => {
            const nextStream = { name: 'Next Stream', start_time: '14:00' };
            const message = await formatNotificationMessage('stream_start', streamInfo, nextStream);
            
            expect(message).toContain('📅 Next');
            expect(message).toContain('Next Stream');
            expect(message).toContain('14:00');
        });

        it('should handle message formatting errors gracefully', async () => {
            // Test with invalid event type
            const message = await formatNotificationMessage('invalid_type' as any, streamInfo);
            
            expect(message).toContain('invalid_type');
            expect(message).toContain('Test Stream');
        });
    });
});