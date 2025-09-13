import { serial, text, pgTable, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// OBS Instances table
export const obsInstancesTable = pgTable('obs_instances', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  websocket_url: text('websocket_url').notNull(),
  profile_name: text('profile_name'), // Nullable by default
  stream_key: text('stream_key'), // Nullable by default
  status: text('status').notNull().default('disconnected'), // 'connected', 'disconnected', 'error'
  current_scene: text('current_scene'), // Nullable by default
  is_streaming: boolean('is_streaming').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Scenes table
export const scenesTable = pgTable('scenes', {
  id: serial('id').primaryKey(),
  obs_instance_id: integer('obs_instance_id').notNull().references(() => obsInstancesTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  is_active: boolean('is_active').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Sources table
export const sourcesTable = pgTable('sources', {
  id: serial('id').primaryKey(),
  scene_id: integer('scene_id').notNull().references(() => scenesTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  is_enabled: boolean('is_enabled').notNull().default(true),
  settings: jsonb('settings'), // JSON object for source settings, nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Schedules table
export const schedulesTable = pgTable('schedules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  obs_instance_id: integer('obs_instance_id').notNull().references(() => obsInstancesTable.id, { onDelete: 'cascade' }),
  start_time: text('start_time').notNull(), // Time in HH:MM format
  end_time: text('end_time').notNull(), // Time in HH:MM format
  days_of_week: jsonb('days_of_week').notNull(), // Array of integers [0-6]
  is_active: boolean('is_active').notNull().default(true),
  is_one_time: boolean('is_one_time').notNull().default(false),
  execution_date: timestamp('execution_date'), // For one-time schedules, nullable
  video_start_timestamp: integer('video_start_timestamp'), // Seconds from start of video, nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Stream events table for history tracking
export const streamEventsTable = pgTable('stream_events', {
  id: serial('id').primaryKey(),
  obs_instance_id: integer('obs_instance_id').notNull().references(() => obsInstancesTable.id, { onDelete: 'cascade' }),
  schedule_id: integer('schedule_id').references(() => schedulesTable.id, { onDelete: 'set null' }), // Nullable for manual events
  event_type: text('event_type').notNull(), // 'stream_start', 'stream_stop', 'manual_start', 'manual_stop'
  occurred_at: timestamp('occurred_at').defaultNow().notNull(),
  notes: text('notes') // Nullable by default
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  schedule_id: integer('schedule_id').notNull().references(() => schedulesTable.id, { onDelete: 'cascade' }),
  notification_type: text('notification_type').notNull(), // 'pre_stream', 'stream_start', 'stream_stop'
  message: text('message').notNull(),
  sent_at: timestamp('sent_at'), // Nullable until actually sent
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const obsInstancesRelations = relations(obsInstancesTable, ({ many }) => ({
  scenes: many(scenesTable),
  schedules: many(schedulesTable),
  streamEvents: many(streamEventsTable)
}));

export const scenesRelations = relations(scenesTable, ({ one, many }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [scenesTable.obs_instance_id],
    references: [obsInstancesTable.id]
  }),
  sources: many(sourcesTable)
}));

export const sourcesRelations = relations(sourcesTable, ({ one }) => ({
  scene: one(scenesTable, {
    fields: [sourcesTable.scene_id],
    references: [scenesTable.id]
  })
}));

export const schedulesRelations = relations(schedulesTable, ({ one, many }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [schedulesTable.obs_instance_id],
    references: [obsInstancesTable.id]
  }),
  streamEvents: many(streamEventsTable),
  notifications: many(notificationsTable)
}));

export const streamEventsRelations = relations(streamEventsTable, ({ one }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [streamEventsTable.obs_instance_id],
    references: [obsInstancesTable.id]
  }),
  schedule: one(schedulesTable, {
    fields: [streamEventsTable.schedule_id],
    references: [schedulesTable.id]
  })
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  schedule: one(schedulesTable, {
    fields: [notificationsTable.schedule_id],
    references: [schedulesTable.id]
  })
}));

// Export all tables for relation queries
export const tables = {
  obsInstances: obsInstancesTable,
  scenes: scenesTable,
  sources: sourcesTable,
  schedules: schedulesTable,
  streamEvents: streamEventsTable,
  notifications: notificationsTable
};

// TypeScript types for the table schemas
export type ObsInstance = typeof obsInstancesTable.$inferSelect;
export type NewObsInstance = typeof obsInstancesTable.$inferInsert;

export type Scene = typeof scenesTable.$inferSelect;
export type NewScene = typeof scenesTable.$inferInsert;

export type Source = typeof sourcesTable.$inferSelect;
export type NewSource = typeof sourcesTable.$inferInsert;

export type Schedule = typeof schedulesTable.$inferSelect;
export type NewSchedule = typeof schedulesTable.$inferInsert;

export type StreamEvent = typeof streamEventsTable.$inferSelect;
export type NewStreamEvent = typeof streamEventsTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;