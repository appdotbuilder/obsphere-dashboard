import { serial, text, pgTable, timestamp, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const repeatTypeEnum = pgEnum('repeat_type', ['once', 'daily', 'weekly']);
export const notificationTypeEnum = pgEnum('notification_type', ['pre_start', 'start', 'pre_stop', 'stop']);
export const obsActionEnum = pgEnum('obs_action', ['start_stream', 'stop_stream', 'switch_scene', 'toggle_source']);

// OBS Instances table
export const obsInstancesTable = pgTable('obs_instances', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  websocket_url: text('websocket_url').notNull(),
  is_connected: boolean('is_connected').notNull().default(false),
  current_scene: text('current_scene'),
  is_streaming: boolean('is_streaming').notNull().default(false),
  stream_key: text('stream_key'),
  profile_name: text('profile_name'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// OBS Sources table
export const obsSourcesTable = pgTable('obs_sources', {
  id: serial('id').primaryKey(),
  obs_instance_id: integer('obs_instance_id').references(() => obsInstancesTable.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  scene_name: text('scene_name').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// OBS Scenes table
export const obsScenesTable = pgTable('obs_scenes', {
  id: serial('id').primaryKey(),
  obs_instance_id: integer('obs_instance_id').references(() => obsInstancesTable.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  is_current: boolean('is_current').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Schedules table
export const schedulesTable = pgTable('schedules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  obs_instance_id: integer('obs_instance_id').references(() => obsInstancesTable.id, { onDelete: 'cascade' }).notNull(),
  start_time: timestamp('start_time').notNull(),
  end_time: timestamp('end_time').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  stream_key: text('stream_key'),
  profile_name: text('profile_name'),
  video_start_position: integer('video_start_position'), // in seconds
  repeat_type: repeatTypeEnum('repeat_type').notNull().default('once'),
  repeat_days: jsonb('repeat_days'), // Array of numbers 0-6 for days of week
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Day Schedules table (for saving/loading entire day schedules)
export const daySchedulesTable = pgTable('day_schedules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  schedule_data: text('schedule_data').notNull(), // JSON stringified schedule data
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Notification Logs table
export const notificationLogsTable = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  schedule_id: integer('schedule_id').references(() => schedulesTable.id, { onDelete: 'cascade' }).notNull(),
  notification_type: notificationTypeEnum('notification_type').notNull(),
  message: text('message').notNull(),
  sent_at: timestamp('sent_at').notNull(),
  telegram_sent: boolean('telegram_sent').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// User Sessions table (simple auth)
export const userSessionsTable = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  session_token: text('session_token').notNull().unique(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const obsInstancesRelations = relations(obsInstancesTable, ({ many }) => ({
  sources: many(obsSourcesTable),
  scenes: many(obsScenesTable),
  schedules: many(schedulesTable),
}));

export const obsSourcesRelations = relations(obsSourcesTable, ({ one }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [obsSourcesTable.obs_instance_id],
    references: [obsInstancesTable.id],
  }),
}));

export const obsScenesRelations = relations(obsScenesTable, ({ one }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [obsScenesTable.obs_instance_id],
    references: [obsInstancesTable.id],
  }),
}));

export const schedulesRelations = relations(schedulesTable, ({ one, many }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [schedulesTable.obs_instance_id],
    references: [obsInstancesTable.id],
  }),
  notificationLogs: many(notificationLogsTable),
}));

export const notificationLogsRelations = relations(notificationLogsTable, ({ one }) => ({
  schedule: one(schedulesTable, {
    fields: [notificationLogsTable.schedule_id],
    references: [schedulesTable.id],
  }),
}));

// TypeScript types for the table schemas
export type ObsInstance = typeof obsInstancesTable.$inferSelect;
export type NewObsInstance = typeof obsInstancesTable.$inferInsert;

export type ObsSource = typeof obsSourcesTable.$inferSelect;
export type NewObsSource = typeof obsSourcesTable.$inferInsert;

export type ObsScene = typeof obsScenesTable.$inferSelect;
export type NewObsScene = typeof obsScenesTable.$inferInsert;

export type Schedule = typeof schedulesTable.$inferSelect;
export type NewSchedule = typeof schedulesTable.$inferInsert;

export type DaySchedule = typeof daySchedulesTable.$inferSelect;
export type NewDaySchedule = typeof daySchedulesTable.$inferInsert;

export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type NewNotificationLog = typeof notificationLogsTable.$inferInsert;

export type UserSession = typeof userSessionsTable.$inferSelect;
export type NewUserSession = typeof userSessionsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  obsInstances: obsInstancesTable,
  obsSources: obsSourcesTable,
  obsScenes: obsScenesTable,
  schedules: schedulesTable,
  daySchedules: daySchedulesTable,
  notificationLogs: notificationLogsTable,
  userSessions: userSessionsTable,
};