import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  authInputSchema,
  createObsInstanceInputSchema,
  updateObsInstanceInputSchema,
  createScheduleInputSchema,
  updateScheduleInputSchema,
  createStreamEventInputSchema,
  controlCommandInputSchema
} from './schema';

// Import handlers
import { authenticate } from './handlers/auth';
import {
  createObsInstance,
  getObsInstances,
  getObsInstanceById,
  updateObsInstance,
  deleteObsInstance,
  testObsConnection
} from './handlers/obs_instances';
import {
  getScenesByObsInstance,
  refreshScenesFromObs,
  switchScene
} from './handlers/scenes';
import {
  getSourcesByScene,
  refreshSourcesFromObs,
  toggleSource,
  updateSourceTimestamp,
  getSourceProgress
} from './handlers/sources';
import {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  copySchedule,
  previewScheduleChanges,
  applyScheduleChanges,
  getUpcomingSchedules
} from './handlers/schedules';
import {
  createStreamEvent,
  getStreamEvents,
  getStreamEventsByDateRange,
  getStreamStatistics
} from './handlers/stream_events';
import {
  startStream,
  stopStream,
  executeControlCommand,
  getStreamingStatus,
  getAllStreamingStatus
} from './handlers/streaming_control';
import {
  createNotification,
  sendTelegramNotification,
  getPendingNotifications,
  generateScheduleNotifications,
  sendPreStreamNotifications,
  formatNotificationMessage
} from './handlers/notifications';
import {
  initializeScheduler,
  scheduleStream,
  unscheduleStream,
  executeScheduledStart,
  executeScheduledStop,
  getNextScheduledEvent,
  validateScheduleConflicts,
  calculateNextExecution
} from './handlers/scheduler';
import {
  makeYouTubeStreamPublic,
  getYouTubeStreamStatus,
  updateYouTubeStreamMetadata
} from './handlers/youtube_integration';

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

  // Authentication
  authenticate: publicProcedure
    .input(authInputSchema)
    .mutation(({ input }) => authenticate(input)),

  // OBS Instance Management
  createObsInstance: publicProcedure
    .input(createObsInstanceInputSchema)
    .mutation(({ input }) => createObsInstance(input)),

  getObsInstances: publicProcedure
    .query(() => getObsInstances()),

  getObsInstanceById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getObsInstanceById(input.id)),

  updateObsInstance: publicProcedure
    .input(updateObsInstanceInputSchema)
    .mutation(({ input }) => updateObsInstance(input)),

  deleteObsInstance: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteObsInstance(input.id)),

  testObsConnection: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => testObsConnection(input.id)),

  // Scene Management
  getScenesByObsInstance: publicProcedure
    .input(z.object({ obsInstanceId: z.number() }))
    .query(({ input }) => getScenesByObsInstance(input.obsInstanceId)),

  refreshScenesFromObs: publicProcedure
    .input(z.object({ obsInstanceId: z.number() }))
    .mutation(({ input }) => refreshScenesFromObs(input.obsInstanceId)),

  switchScene: publicProcedure
    .input(z.object({ obsInstanceId: z.number(), sceneName: z.string() }))
    .mutation(({ input }) => switchScene(input.obsInstanceId, input.sceneName)),

  // Source Management
  getSourcesByScene: publicProcedure
    .input(z.object({ sceneId: z.number() }))
    .query(({ input }) => getSourcesByScene(input.sceneId)),

  refreshSourcesFromObs: publicProcedure
    .input(z.object({ obsInstanceId: z.number() }))
    .mutation(({ input }) => refreshSourcesFromObs(input.obsInstanceId)),

  toggleSource: publicProcedure
    .input(z.object({ sourceId: z.number() }))
    .mutation(({ input }) => toggleSource(input.sourceId)),

  updateSourceTimestamp: publicProcedure
    .input(z.object({ sourceId: z.number(), timestamp: z.number() }))
    .mutation(({ input }) => updateSourceTimestamp(input.sourceId, input.timestamp)),

  getSourceProgress: publicProcedure
    .input(z.object({ sourceId: z.number() }))
    .query(({ input }) => getSourceProgress(input.sourceId)),

  // Schedule Management
  createSchedule: publicProcedure
    .input(createScheduleInputSchema)
    .mutation(({ input }) => createSchedule(input)),

  getSchedules: publicProcedure
    .query(() => getSchedules()),

  getScheduleById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getScheduleById(input.id)),

  updateSchedule: publicProcedure
    .input(updateScheduleInputSchema)
    .mutation(({ input }) => updateSchedule(input)),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteSchedule(input.id)),

  copySchedule: publicProcedure
    .input(z.object({ id: z.number(), newName: z.string() }))
    .mutation(({ input }) => copySchedule(input.id, input.newName)),

  previewScheduleChanges: publicProcedure
    .input(z.object({ schedules: z.array(createScheduleInputSchema) }))
    .mutation(({ input }) => previewScheduleChanges(input.schedules)),

  applyScheduleChanges: publicProcedure
    .input(z.object({ schedules: z.array(createScheduleInputSchema), confirmed: z.boolean() }))
    .mutation(({ input }) => applyScheduleChanges(input.schedules, input.confirmed)),

  getUpcomingSchedules: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ input }) => getUpcomingSchedules(input.limit)),

  // Stream Events & History
  createStreamEvent: publicProcedure
    .input(createStreamEventInputSchema)
    .mutation(({ input }) => createStreamEvent(input)),

  getStreamEvents: publicProcedure
    .input(z.object({ obsInstanceId: z.number().optional(), limit: z.number().optional() }))
    .query(({ input }) => getStreamEvents(input.obsInstanceId, input.limit)),

  getStreamEventsByDateRange: publicProcedure
    .input(z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      obsInstanceId: z.number().optional()
    }))
    .query(({ input }) => getStreamEventsByDateRange(input.startDate, input.endDate, input.obsInstanceId)),

  getStreamStatistics: publicProcedure
    .input(z.object({ obsInstanceId: z.number().optional() }))
    .query(({ input }) => getStreamStatistics(input.obsInstanceId)),

  // Streaming Control
  startStream: publicProcedure
    .input(z.object({ obsInstanceId: z.number(), manual: z.boolean().optional() }))
    .mutation(({ input }) => startStream(input.obsInstanceId, input.manual)),

  stopStream: publicProcedure
    .input(z.object({ obsInstanceId: z.number(), manual: z.boolean().optional() }))
    .mutation(({ input }) => stopStream(input.obsInstanceId, input.manual)),

  executeControlCommand: publicProcedure
    .input(controlCommandInputSchema)
    .mutation(({ input }) => executeControlCommand(input)),

  getStreamingStatus: publicProcedure
    .input(z.object({ obsInstanceId: z.number() }))
    .query(({ input }) => getStreamingStatus(input.obsInstanceId)),

  getAllStreamingStatus: publicProcedure
    .query(() => getAllStreamingStatus()),

  // Notifications
  createNotification: publicProcedure
    .input(z.object({
      scheduleId: z.number(),
      type: z.enum(['pre_stream', 'stream_start', 'stream_stop']),
      message: z.string()
    }))
    .mutation(({ input }) => createNotification(input.scheduleId, input.type, input.message)),

  sendTelegramNotification: publicProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(({ input }) => sendTelegramNotification(input.notificationId)),

  getPendingNotifications: publicProcedure
    .query(() => getPendingNotifications()),

  generateScheduleNotifications: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => generateScheduleNotifications(input.scheduleId)),

  sendPreStreamNotifications: publicProcedure
    .mutation(() => sendPreStreamNotifications()),

  formatNotificationMessage: publicProcedure
    .input(z.object({
      eventType: z.enum(['pre_stream', 'stream_start', 'stream_stop']),
      currentStream: z.object({
        name: z.string(),
        start_time: z.string(),
        end_time: z.string()
      }),
      nextStream: z.object({
        name: z.string(),
        start_time: z.string()
      }).optional()
    }))
    .query(({ input }) => formatNotificationMessage(input.eventType, input.currentStream, input.nextStream)),

  // Scheduler
  initializeScheduler: publicProcedure
    .mutation(() => initializeScheduler()),

  scheduleStream: publicProcedure
    .input(z.object({ schedule: z.any() })) // Using z.any() for complex Schedule type
    .mutation(({ input }) => scheduleStream(input.schedule)),

  unscheduleStream: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => unscheduleStream(input.scheduleId)),

  executeScheduledStart: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => executeScheduledStart(input.scheduleId)),

  executeScheduledStop: publicProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(({ input }) => executeScheduledStop(input.scheduleId)),

  getNextScheduledEvent: publicProcedure
    .query(() => getNextScheduledEvent()),

  validateScheduleConflicts: publicProcedure
    .input(z.object({ schedules: z.array(z.any()) })) // Using z.any() for complex Schedule type
    .query(({ input }) => validateScheduleConflicts(input.schedules)),

  calculateNextExecution: publicProcedure
    .input(z.object({ schedule: z.any() })) // Using z.any() for complex Schedule type
    .query(({ input }) => calculateNextExecution(input.schedule)),

  // YouTube Integration
  makeYouTubeStreamPublic: publicProcedure
    .input(z.object({ streamKey: z.string() }))
    .mutation(({ input }) => makeYouTubeStreamPublic(input.streamKey)),

  getYouTubeStreamStatus: publicProcedure
    .input(z.object({ streamKey: z.string() }))
    .query(({ input }) => getYouTubeStreamStatus(input.streamKey)),

  updateYouTubeStreamMetadata: publicProcedure
    .input(z.object({
      streamKey: z.string(),
      metadata: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional()
      })
    }))
    .mutation(({ input }) => updateYouTubeStreamMetadata(input.streamKey, input.metadata))
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

  // Initialize the scheduler on server start
  try {
    await initializeScheduler();
    console.log('Scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
  }

  server.listen(port);
  console.log(`StreamPilot TRPC server listening at port: ${port}`);
  console.log('Server ready to manage OBS instances and streaming schedules');
}

start();