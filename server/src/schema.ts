import { z } from 'zod';

// OBS Instance schema
export const obsInstanceSchema = z.object({
  id: z.number(),
  name: z.string(),
  websocket_url: z.string().url(),
  is_connected: z.boolean(),
  current_scene: z.string().nullable(),
  is_streaming: z.boolean(),
  stream_key: z.string().nullable(),
  profile_name: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type ObsInstance = z.infer<typeof obsInstanceSchema>;

// Input schema for creating OBS instances
export const createObsInstanceInputSchema = z.object({
  name: z.string().min(1),
  websocket_url: z.string().url(),
  stream_key: z.string().nullable().optional(),
  profile_name: z.string().nullable().optional(),
});

export type CreateObsInstanceInput = z.infer<typeof createObsInstanceInputSchema>;

// Input schema for updating OBS instances
export const updateObsInstanceInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  websocket_url: z.string().url().optional(),
  is_connected: z.boolean().optional(),
  current_scene: z.string().nullable().optional(),
  is_streaming: z.boolean().optional(),
  stream_key: z.string().nullable().optional(),
  profile_name: z.string().nullable().optional(),
});

export type UpdateObsInstanceInput = z.infer<typeof updateObsInstanceInputSchema>;

// OBS Source schema
export const obsSourceSchema = z.object({
  id: z.number(),
  obs_instance_id: z.number(),
  name: z.string(),
  type: z.string(),
  enabled: z.boolean(),
  scene_name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type ObsSource = z.infer<typeof obsSourceSchema>;

// OBS Scene schema
export const obsSceneSchema = z.object({
  id: z.number(),
  obs_instance_id: z.number(),
  name: z.string(),
  is_current: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type ObsScene = z.infer<typeof obsSceneSchema>;

// Schedule schema
export const scheduleSchema = z.object({
  id: z.number(),
  name: z.string(),
  obs_instance_id: z.number(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
  is_active: z.boolean(),
  stream_key: z.string().nullable(),
  profile_name: z.string().nullable(),
  video_start_position: z.number().nullable(), // in seconds
  repeat_type: z.enum(['once', 'daily', 'weekly']),
  repeat_days: z.array(z.number()).nullable(), // 0-6 for Sunday-Saturday
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Schedule = z.infer<typeof scheduleSchema>;

// Input schema for creating schedules
export const createScheduleInputSchema = z.object({
  name: z.string().min(1),
  obs_instance_id: z.number(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
  stream_key: z.string().nullable().optional(),
  profile_name: z.string().nullable().optional(),
  video_start_position: z.number().nullable().optional(),
  repeat_type: z.enum(['once', 'daily', 'weekly']).default('once'),
  repeat_days: z.array(z.number().min(0).max(6)).nullable().optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleInputSchema>;

// Input schema for updating schedules
export const updateScheduleInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  obs_instance_id: z.number().optional(),
  start_time: z.coerce.date().optional(),
  end_time: z.coerce.date().optional(),
  is_active: z.boolean().optional(),
  stream_key: z.string().nullable().optional(),
  profile_name: z.string().nullable().optional(),
  video_start_position: z.number().nullable().optional(),
  repeat_type: z.enum(['once', 'daily', 'weekly']).optional(),
  repeat_days: z.array(z.number().min(0).max(6)).nullable().optional(),
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleInputSchema>;

// Day Schedule schema for saving/loading entire day schedules
export const dayScheduleSchema = z.object({
  id: z.number(),
  name: z.string(), // e.g., "Monday Schedule"
  schedule_data: z.string(), // JSON stringified schedule data
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type DaySchedule = z.infer<typeof dayScheduleSchema>;

// Input schema for creating day schedules
export const createDayScheduleInputSchema = z.object({
  name: z.string().min(1),
  schedule_data: z.string(),
});

export type CreateDayScheduleInput = z.infer<typeof createDayScheduleInputSchema>;

// Notification Log schema
export const notificationLogSchema = z.object({
  id: z.number(),
  schedule_id: z.number(),
  notification_type: z.enum(['pre_start', 'start', 'pre_stop', 'stop']),
  message: z.string(),
  sent_at: z.coerce.date(),
  telegram_sent: z.boolean(),
  created_at: z.coerce.date(),
});

export type NotificationLog = z.infer<typeof notificationLogSchema>;

// User session schema (simple auth)
export const userSessionSchema = z.object({
  id: z.number(),
  username: z.string(),
  session_token: z.string(),
  expires_at: z.coerce.date(),
  created_at: z.coerce.date(),
});

export type UserSession = z.infer<typeof userSessionSchema>;

// Auth input schemas
export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// OBS Control input schemas
export const obsControlInputSchema = z.object({
  obs_instance_id: z.number(),
  action: z.enum(['start_stream', 'stop_stream', 'switch_scene', 'toggle_source']),
  scene_name: z.string().optional(),
  source_name: z.string().optional(),
});

export type ObsControlInput = z.infer<typeof obsControlInputSchema>;

// Schedule preview schema
export const schedulePreviewSchema = z.object({
  affected_streams: z.array(z.object({
    obs_instance_id: z.number(),
    obs_instance_name: z.string(),
    current_schedule: z.string().nullable(),
    new_schedule: z.string(),
  })),
  conflicts: z.array(z.object({
    schedule_id: z.number(),
    conflict_description: z.string(),
    suggested_resolution: z.string(),
  })),
  total_changes: z.number(),
});

export type SchedulePreview = z.infer<typeof schedulePreviewSchema>;

// Bulk schedule operation input
export const bulkScheduleOperationInputSchema = z.object({
  operation: z.enum(['apply', 'copy', 'delete']),
  source_schedule_ids: z.array(z.number()).optional(),
  target_date: z.coerce.date().optional(),
  schedule_data: z.array(createScheduleInputSchema).optional(),
});

export type BulkScheduleOperationInput = z.infer<typeof bulkScheduleOperationInputSchema>;