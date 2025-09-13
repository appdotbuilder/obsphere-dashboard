import { z } from 'zod';

// OBS Instance schema
export const obsInstanceSchema = z.object({
  id: z.number(),
  name: z.string(),
  websocket_url: z.string().url(),
  profile_name: z.string().nullable(),
  stream_key: z.string().nullable(),
  status: z.enum(['connected', 'disconnected', 'error']),
  current_scene: z.string().nullable(),
  is_streaming: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ObsInstance = z.infer<typeof obsInstanceSchema>;

// Input schema for creating OBS instances
export const createObsInstanceInputSchema = z.object({
  name: z.string().min(1),
  websocket_url: z.string().url(),
  profile_name: z.string().nullable().optional(),
  stream_key: z.string().nullable().optional()
});

export type CreateObsInstanceInput = z.infer<typeof createObsInstanceInputSchema>;

// Input schema for updating OBS instances
export const updateObsInstanceInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  websocket_url: z.string().url().optional(),
  profile_name: z.string().nullable().optional(),
  stream_key: z.string().nullable().optional(),
  status: z.enum(['connected', 'disconnected', 'error']).optional(),
  current_scene: z.string().nullable().optional(),
  is_streaming: z.boolean().optional()
});

export type UpdateObsInstanceInput = z.infer<typeof updateObsInstanceInputSchema>;

// Scene schema
export const sceneSchema = z.object({
  id: z.number(),
  obs_instance_id: z.number(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Scene = z.infer<typeof sceneSchema>;

// Source schema
export const sourceSchema = z.object({
  id: z.number(),
  scene_id: z.number(),
  name: z.string(),
  type: z.string(),
  is_enabled: z.boolean(),
  settings: z.record(z.any()).nullable(), // JSON object for source settings
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Source = z.infer<typeof sourceSchema>;

// Schedule schema
export const scheduleSchema = z.object({
  id: z.number(),
  name: z.string(),
  obs_instance_id: z.number(),
  start_time: z.string(), // Time in HH:MM format
  end_time: z.string(), // Time in HH:MM format
  days_of_week: z.array(z.number().min(0).max(6)), // 0=Sunday, 1=Monday, etc.
  is_active: z.boolean(),
  is_one_time: z.boolean(),
  execution_date: z.coerce.date().nullable(), // For one-time schedules
  video_start_timestamp: z.number().nullable(), // Seconds from start of video
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Schedule = z.infer<typeof scheduleSchema>;

// Input schema for creating schedules
export const createScheduleInputSchema = z.object({
  name: z.string().min(1),
  obs_instance_id: z.number(),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
  days_of_week: z.array(z.number().min(0).max(6)),
  is_one_time: z.boolean().optional(),
  execution_date: z.coerce.date().nullable().optional(),
  video_start_timestamp: z.number().nullable().optional()
});

export type CreateScheduleInput = z.infer<typeof createScheduleInputSchema>;

// Input schema for updating schedules
export const updateScheduleInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  days_of_week: z.array(z.number().min(0).max(6)).optional(),
  is_active: z.boolean().optional(),
  is_one_time: z.boolean().optional(),
  execution_date: z.coerce.date().nullable().optional(),
  video_start_timestamp: z.number().nullable().optional()
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleInputSchema>;

// Stream event schema for history tracking
export const streamEventSchema = z.object({
  id: z.number(),
  obs_instance_id: z.number(),
  schedule_id: z.number().nullable(),
  event_type: z.enum(['stream_start', 'stream_stop', 'manual_start', 'manual_stop']),
  occurred_at: z.coerce.date(),
  notes: z.string().nullable()
});

export type StreamEvent = z.infer<typeof streamEventSchema>;

// Input schema for creating stream events
export const createStreamEventInputSchema = z.object({
  obs_instance_id: z.number(),
  schedule_id: z.number().nullable().optional(),
  event_type: z.enum(['stream_start', 'stream_stop', 'manual_start', 'manual_stop']),
  notes: z.string().nullable().optional()
});

export type CreateStreamEventInput = z.infer<typeof createStreamEventInputSchema>;

// Notification schema
export const notificationSchema = z.object({
  id: z.number(),
  schedule_id: z.number(),
  notification_type: z.enum(['pre_stream', 'stream_start', 'stream_stop']),
  message: z.string(),
  sent_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

// Schedule preview schema for showing changes before applying
export const schedulePreviewSchema = z.object({
  affected_streams: z.array(z.string()),
  new_timings: z.array(z.object({
    obs_instance_name: z.string(),
    start_time: z.string(),
    end_time: z.string()
  })),
  conflicts: z.array(z.string())
});

export type SchedulePreview = z.infer<typeof schedulePreviewSchema>;

// Control command schema for manual OBS control
export const controlCommandInputSchema = z.object({
  obs_instance_id: z.number(),
  command: z.enum(['start_stream', 'stop_stream', 'switch_scene', 'toggle_source']),
  parameters: z.record(z.any()).optional() // Additional parameters for the command
});

export type ControlCommandInput = z.infer<typeof controlCommandInputSchema>;

// Authentication schema
export const authInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type AuthInput = z.infer<typeof authInputSchema>;

// Common response schemas
export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional()
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;