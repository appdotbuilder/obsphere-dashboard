import { z } from 'zod';

// Enums for stream status and view modes
export const streamStatusSchema = z.enum(['streaming', 'idle', 'starting', 'stopping', 'error']);
export const viewModeSchema = z.enum(['cards', 'list']);
export const scheduledStopTypeSchema = z.enum(['duration', 'specific_time']);

// YouTube Live Stream schema
export const liveStreamSchema = z.object({
  id: z.number(),
  youtube_stream_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  tags: z.string().nullable(), // JSON string of tags array
  thumbnail_url: z.string().nullable(),
  status: streamStatusSchema,
  viewer_count: z.number().nullable(),
  stream_key: z.string().nullable(),
  started_at: z.coerce.date().nullable(),
  ended_at: z.coerce.date().nullable(),
  duration_seconds: z.number().nullable(),
  scheduled_end_time: z.coerce.date().nullable(),
  scheduled_stop_type: scheduledStopTypeSchema.nullable(),
  obs_instance_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type LiveStream = z.infer<typeof liveStreamSchema>;

// Input schemas for live streams
export const createLiveStreamInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  tags: z.array(z.string()).optional().transform(tags => tags ? JSON.stringify(tags) : null),
  obs_instance_id: z.number().optional()
});

export type CreateLiveStreamInput = z.infer<typeof createLiveStreamInputSchema>;

export const updateLiveStreamInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().transform(tags => tags ? JSON.stringify(tags) : null),
  scheduled_end_time: z.coerce.date().nullable().optional(),
  scheduled_stop_type: scheduledStopTypeSchema.nullable().optional()
});

export type UpdateLiveStreamInput = z.infer<typeof updateLiveStreamInputSchema>;

export const bulkUpdateLiveStreamInputSchema = z.object({
  stream_ids: z.array(z.number()),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().transform(tags => tags ? JSON.stringify(tags) : null)
});

export type BulkUpdateLiveStreamInput = z.infer<typeof bulkUpdateLiveStreamInputSchema>;

// OBS Instance schema
export const obsInstanceSchema = z.object({
  id: z.number(),
  name: z.string(),
  websocket_url: z.string(),
  websocket_password: z.string().nullable(),
  is_connected: z.boolean(),
  last_connected_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ObsInstance = z.infer<typeof obsInstanceSchema>;

export const createObsInstanceInputSchema = z.object({
  name: z.string().min(1),
  websocket_url: z.string().url(),
  websocket_password: z.string().nullable()
});

export type CreateObsInstanceInput = z.infer<typeof createObsInstanceInputSchema>;

export const updateObsInstanceInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  websocket_url: z.string().url().optional(),
  websocket_password: z.string().nullable().optional()
});

export type UpdateObsInstanceInput = z.infer<typeof updateObsInstanceInputSchema>;

// Stream Template schema
export const streamTemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  title_template: z.string(),
  description_template: z.string().nullable(),
  default_tags: z.string().nullable(), // JSON string of tags array
  is_default: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type StreamTemplate = z.infer<typeof streamTemplateSchema>;

export const createStreamTemplateInputSchema = z.object({
  name: z.string().min(1),
  title_template: z.string().min(1),
  description_template: z.string().nullable(),
  default_tags: z.array(z.string()).optional().transform(tags => tags ? JSON.stringify(tags) : null),
  is_default: z.boolean().default(false)
});

export type CreateStreamTemplateInput = z.infer<typeof createStreamTemplateInputSchema>;

export const updateStreamTemplateInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  title_template: z.string().min(1).optional(),
  description_template: z.string().nullable().optional(),
  default_tags: z.array(z.string()).optional().transform(tags => tags ? JSON.stringify(tags) : null),
  is_default: z.boolean().optional()
});

export type UpdateStreamTemplateInput = z.infer<typeof updateStreamTemplateInputSchema>;

// Application Settings schema
export const appSettingsSchema = z.object({
  id: z.number(),
  youtube_api_key: z.string().nullable(),
  api_quota_used: z.number(),
  api_quota_limit: z.number(),
  api_quota_reset_date: z.coerce.date().nullable(),
  password_hash: z.string().nullable(),
  default_view_mode: viewModeSchema,
  auto_refresh_interval: z.number(), // seconds
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const updateSettingsInputSchema = z.object({
  youtube_api_key: z.string().nullable().optional(),
  password: z.string().min(6).optional(), // Will be hashed before storage
  default_view_mode: viewModeSchema.optional(),
  auto_refresh_interval: z.number().min(5).max(300).optional() // 5 seconds to 5 minutes
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

// Authentication schema
export const loginInputSchema = z.object({
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().nullable(),
  message: z.string().nullable()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Stream action schemas
export const startStreamInputSchema = z.object({
  template_id: z.number().optional(),
  title: z.string().min(1),
  description: z.string().nullable(),
  tags: z.array(z.string()).optional(),
  obs_instance_id: z.number().optional()
});

export type StartStreamInput = z.infer<typeof startStreamInputSchema>;

export const stopStreamInputSchema = z.object({
  id: z.number()
});

export type StopStreamInput = z.infer<typeof stopStreamInputSchema>;

export const scheduleStreamStopInputSchema = z.object({
  id: z.number(),
  stop_type: scheduledStopTypeSchema,
  duration_minutes: z.number().min(1).optional(), // For duration type
  specific_time: z.coerce.date().optional() // For specific_time type
});

export type ScheduleStreamStopInput = z.infer<typeof scheduleStreamStopInputSchema>;

// API Quota tracking schema
export const apiQuotaUsageSchema = z.object({
  current_usage: z.number(),
  limit: z.number(),
  reset_date: z.coerce.date().nullable(),
  percentage_used: z.number()
});

export type ApiQuotaUsage = z.infer<typeof apiQuotaUsageSchema>;

// Dashboard stats schema
export const dashboardStatsSchema = z.object({
  active_streams: z.number(),
  total_viewers: z.number(),
  connected_obs_instances: z.number(),
  api_quota_percentage: z.number(),
  streams_today: z.number()
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;