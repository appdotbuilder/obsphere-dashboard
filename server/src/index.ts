import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createObsInstanceInputSchema,
  updateObsInstanceInputSchema,
  obsControlInputSchema,
  createScheduleInputSchema,
  updateScheduleInputSchema,
  bulkScheduleOperationInputSchema,
  createDayScheduleInputSchema,
  loginInputSchema,
} from './schema';

// Import handlers
import { createObsInstance } from './handlers/create_obs_instance';
import { getObsInstances } from './handlers/get_obs_instances';
import { updateObsInstance } from './handlers/update_obs_instance';
import { deleteObsInstance } from './handlers/delete_obs_instance';
import { getObsSourcesAndScenes } from './handlers/get_obs_sources_and_scenes';
import { obsControl } from './handlers/obs_control';
import { createSchedule } from './handlers/create_schedule';
import { getSchedules, getActiveSchedules } from './handlers/get_schedules';
import { updateSchedule } from './handlers/update_schedule';
import { deleteSchedule } from './handlers/delete_schedule';
import { generateSchedulePreview } from './handlers/schedule_preview';
import { performBulkScheduleOperation } from './handlers/bulk_schedule_operations';
import { saveDaySchedule, getDaySchedules, loadDaySchedule } from './handlers/day_schedule_management';
import { sendTelegramNotification, getNotificationLogs, processScheduleNotifications } from './handlers/notification_system';
import { login, validateSession, logout } from './handlers/auth';
import { getStreamStatus, getAllStreamStatuses, setVideoStartPosition } from './handlers/stream_monitoring';
import { executeScheduledStart, executeScheduledStop, processActiveSchedules, cancelScheduleExecution } from './handlers/schedule_executor';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  validateSession: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => validateSession(input.token)),

  logout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(({ input }) => logout(input.token)),

  // OBS Instance Management
  createObsInstance: publicProcedure
    .input(createObsInstanceInputSchema)
    .mutation(({ input }) => createObsInstance(input)),

  getObsInstances: publicProcedure
    .query(() => getObsInstances()),

  updateObsInstance: publicProcedure
    .input(updateObsInstanceInputSchema)
    .mutation(({ input }) => updateObsInstance(input)),

  deleteObsInstance: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteObsInstance(input.id)),

  getObsSourcesAndScenes: publicProcedure
    .input(z.object({ obsInstanceId: z.number() }))
    .query(({ input }) => getObsSourcesAndScenes(input.obsInstanceId)),

  // OBS Control
  obsControl: publicProcedure
    .input(obsControlInputSchema)
    .mutation(({ input }) => obsControl(input)),

  // Schedule Management
  createSchedule: publicProcedure
    .input(createScheduleInputSchema)
    .mutation(({ input }) => createSchedule(input)),

  getSchedules: publicProcedure
    .input(z.object({ date: z.coerce.date().optional() }).optional())
    .query(({ input }) => getSchedules(input?.date)),

  getActiveSchedules: publicProcedure
    .query(() => getActiveSchedules()),

  updateSchedule: publicProcedure
    .input(updateScheduleInputSchema)
    .mutation(({ input }) => updateSchedule(input)),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteSchedule(input.id)),

  // Schedule Preview and Bulk Operations
  generateSchedulePreview: publicProcedure
    .input(bulkScheduleOperationInputSchema)
    .query(({ input }) => generateSchedulePreview(input)),

  performBulkScheduleOperation: publicProcedure
    .input(bulkScheduleOperationInputSchema)
    .mutation(({ input }) => performBulkScheduleOperation(input)),

  // Day Schedule Management
  saveDaySchedule: publicProcedure
    .input(createDayScheduleInputSchema)
    .mutation(({ input }) => saveDaySchedule(input)),

  getDaySchedules: publicProcedure
    .query(() => getDaySchedules()),

  loadDaySchedule: publicProcedure
    .input(z.object({ id: z.number(), targetDate: z.coerce.date() }))
    .mutation(({ input }) => loadDaySchedule(input.id, input.targetDate)),

  // Notification System
  sendTelegramNotification: publicProcedure
    .input(z.object({
      message: z.string(),
      scheduleId: z.number(),
      type: z.enum(['pre_start', 'start', 'pre_stop', 'stop'])
    }))
    .mutation(({ input }) => sendTelegramNotification(input.message, input.scheduleId, input.type)),

  getNotificationLogs: publicProcedure
    .input(z.object({ scheduleId: z.number().optional() }).optional())
    .query(({ input }) => getNotificationLogs(input?.scheduleId)),

  processScheduleNotifications: publicProcedure
    .mutation(() => processScheduleNotifications()),

  // Stream Monitoring
  getStreamStatus: publicProcedure
    .input(z.object({ obsInstanceId: z.number() }))
    .query(({ input }) => getStreamStatus(input.obsInstanceId)),

  getAllStreamStatuses: publicProcedure
    .query(() => getAllStreamStatuses()),

  setVideoStartPosition: publicProcedure
    .input(z.object({
      obsInstanceId: z.number(),
      sourceName: z.string(),
      position: z.number()
    }))
    .mutation(({ input }) => setVideoStartPosition(input.obsInstanceId, input.sourceName, input.position)),

  // Schedule Execution
  executeScheduledStart: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => executeScheduledStart(input.scheduleId)),

  executeScheduledStop: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => executeScheduledStop(input.scheduleId)),

  processActiveSchedules: publicProcedure
    .mutation(() => processActiveSchedules()),

  cancelScheduleExecution: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => cancelScheduleExecution(input.scheduleId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  
  server.listen(port);
  console.log(`StreamPilot TRPC server listening at port: ${port}`);
  console.log('Ready to manage OBS instances and streaming schedules');
  
  // Start background processes
  setInterval(async () => {
    try {
      await processActiveSchedules();
      await processScheduleNotifications();
    } catch (error) {
      console.error('Background process error:', error);
    }
  }, 30000); // Run every 30 seconds
}

start();