import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  integer, 
  boolean,
  pgEnum,
  varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const streamStatusEnum = pgEnum('stream_status', ['streaming', 'idle', 'starting', 'stopping', 'error']);
export const viewModeEnum = pgEnum('view_mode', ['cards', 'list']);
export const scheduledStopTypeEnum = pgEnum('scheduled_stop_type', ['duration', 'specific_time']);

// Live Streams table
export const liveStreamsTable = pgTable('live_streams', {
  id: serial('id').primaryKey(),
  youtube_stream_id: varchar('youtube_stream_id', { length: 255 }).notNull(),
  title: text('title').notNull(),
  description: text('description'), // Nullable
  tags: text('tags'), // JSON string of tags array, nullable
  thumbnail_url: text('thumbnail_url'), // Nullable
  status: streamStatusEnum('status').notNull().default('idle'),
  viewer_count: integer('viewer_count'), // Nullable
  stream_key: text('stream_key'), // Nullable
  started_at: timestamp('started_at'), // Nullable
  ended_at: timestamp('ended_at'), // Nullable
  duration_seconds: integer('duration_seconds'), // Nullable
  scheduled_end_time: timestamp('scheduled_end_time'), // Nullable
  scheduled_stop_type: scheduledStopTypeEnum('scheduled_stop_type'), // Nullable
  obs_instance_id: integer('obs_instance_id'), // Foreign key, nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// OBS Instances table
export const obsInstancesTable = pgTable('obs_instances', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  websocket_url: text('websocket_url').notNull(),
  websocket_password: text('websocket_password'), // Nullable
  is_connected: boolean('is_connected').default(false).notNull(),
  last_connected_at: timestamp('last_connected_at'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Stream Templates table
export const streamTemplatesTable = pgTable('stream_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  title_template: text('title_template').notNull(),
  description_template: text('description_template'), // Nullable
  default_tags: text('default_tags'), // JSON string of tags array, nullable
  is_default: boolean('is_default').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Application Settings table (singleton)
export const appSettingsTable = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  youtube_api_key: text('youtube_api_key'), // Nullable, encrypted
  api_quota_used: integer('api_quota_used').default(0).notNull(),
  api_quota_limit: integer('api_quota_limit').default(10000).notNull(),
  api_quota_reset_date: timestamp('api_quota_reset_date'), // Nullable
  password_hash: text('password_hash'), // Nullable, bcrypt hash
  default_view_mode: viewModeEnum('default_view_mode').default('cards').notNull(),
  auto_refresh_interval: integer('auto_refresh_interval').default(30).notNull(), // seconds
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const liveStreamsRelations = relations(liveStreamsTable, ({ one }) => ({
  obsInstance: one(obsInstancesTable, {
    fields: [liveStreamsTable.obs_instance_id],
    references: [obsInstancesTable.id],
  }),
}));

export const obsInstancesRelations = relations(obsInstancesTable, ({ many }) => ({
  liveStreams: many(liveStreamsTable),
}));

// TypeScript types
export type LiveStream = typeof liveStreamsTable.$inferSelect;
export type NewLiveStream = typeof liveStreamsTable.$inferInsert;

export type ObsInstance = typeof obsInstancesTable.$inferSelect;
export type NewObsInstance = typeof obsInstancesTable.$inferInsert;

export type StreamTemplate = typeof streamTemplatesTable.$inferSelect;
export type NewStreamTemplate = typeof streamTemplatesTable.$inferInsert;

export type AppSettings = typeof appSettingsTable.$inferSelect;
export type NewAppSettings = typeof appSettingsTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  liveStreams: liveStreamsTable,
  obsInstances: obsInstancesTable,
  streamTemplates: streamTemplatesTable,
  appSettings: appSettingsTable,
};