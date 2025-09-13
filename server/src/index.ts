import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import all schemas
import {
  createLiveStreamInputSchema,
  updateLiveStreamInputSchema,
  bulkUpdateLiveStreamInputSchema,
  createObsInstanceInputSchema,
  updateObsInstanceInputSchema,
  createStreamTemplateInputSchema,
  updateStreamTemplateInputSchema,
  updateSettingsInputSchema,
  loginInputSchema,
  startStreamInputSchema,
  stopStreamInputSchema,
  scheduleStreamStopInputSchema
} from './schema';

// Import all handlers
import { getLiveStreams, getLiveStreamsHistory } from './handlers/get_live_streams';
import { createLiveStream } from './handlers/create_live_stream';
import { updateLiveStream, bulkUpdateLiveStreams } from './handlers/update_live_stream';
import { startStream, stopStream, scheduleStreamStop } from './handlers/stream_actions';
import {
  getObsInstances,
  createObsInstance,
  updateObsInstance,
  deleteObsInstance,
  testObsConnection
} from './handlers/obs_instances';
import {
  getStreamTemplates,
  createStreamTemplate,
  updateStreamTemplate,
  deleteStreamTemplate,
  getDefaultTemplate
} from './handlers/stream_templates';
import {
  getAppSettings,
  updateAppSettings,
  getApiQuotaUsage,
  resetApiQuota
} from './handlers/app_settings';
import {
  login,
  verifyToken,
  generateToken
} from './handlers/authentication';
import {
  getDashboardStats,
  refreshStreamData
} from './handlers/dashboard_stats';

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

  verifyToken: publicProcedure
    .input(loginInputSchema) // Reusing for token verification
    .query(({ input }) => verifyToken(input.password)), // Using password field as token

  // Live streams routes
  getLiveStreams: publicProcedure
    .query(() => getLiveStreams()),

  getLiveStreamsHistory: publicProcedure
    .query(() => getLiveStreamsHistory()),

  createLiveStream: publicProcedure
    .input(createLiveStreamInputSchema)
    .mutation(({ input }) => createLiveStream(input)),

  updateLiveStream: publicProcedure
    .input(updateLiveStreamInputSchema)
    .mutation(({ input }) => updateLiveStream(input)),

  bulkUpdateLiveStreams: publicProcedure
    .input(bulkUpdateLiveStreamInputSchema)
    .mutation(({ input }) => bulkUpdateLiveStreams(input)),

  // Stream actions
  startStream: publicProcedure
    .input(startStreamInputSchema)
    .mutation(({ input }) => startStream(input)),

  stopStream: publicProcedure
    .input(stopStreamInputSchema)
    .mutation(({ input }) => stopStream(input)),

  scheduleStreamStop: publicProcedure
    .input(scheduleStreamStopInputSchema)
    .mutation(({ input }) => scheduleStreamStop(input)),

  // OBS instances routes
  getObsInstances: publicProcedure
    .query(() => getObsInstances()),

  createObsInstance: publicProcedure
    .input(createObsInstanceInputSchema)
    .mutation(({ input }) => createObsInstance(input)),

  updateObsInstance: publicProcedure
    .input(updateObsInstanceInputSchema)
    .mutation(({ input }) => updateObsInstance(input)),

  deleteObsInstance: publicProcedure
    .input(loginInputSchema) // Reusing for ID input
    .mutation(({ input }) => deleteObsInstance(parseInt(input.password))), // Using password field as ID

  testObsConnection: publicProcedure
    .input(loginInputSchema) // Reusing for ID input
    .query(({ input }) => testObsConnection(parseInt(input.password))), // Using password field as ID

  // Stream templates routes
  getStreamTemplates: publicProcedure
    .query(() => getStreamTemplates()),

  createStreamTemplate: publicProcedure
    .input(createStreamTemplateInputSchema)
    .mutation(({ input }) => createStreamTemplate(input)),

  updateStreamTemplate: publicProcedure
    .input(updateStreamTemplateInputSchema)
    .mutation(({ input }) => updateStreamTemplate(input)),

  deleteStreamTemplate: publicProcedure
    .input(loginInputSchema) // Reusing for ID input
    .mutation(({ input }) => deleteStreamTemplate(parseInt(input.password))), // Using password field as ID

  getDefaultTemplate: publicProcedure
    .query(() => getDefaultTemplate()),

  // Application settings routes
  getAppSettings: publicProcedure
    .query(() => getAppSettings()),

  updateAppSettings: publicProcedure
    .input(updateSettingsInputSchema)
    .mutation(({ input }) => updateAppSettings(input)),

  getApiQuotaUsage: publicProcedure
    .query(() => getApiQuotaUsage()),

  resetApiQuota: publicProcedure
    .mutation(() => resetApiQuota()),

  // Dashboard stats
  getDashboardStats: publicProcedure
    .query(() => getDashboardStats()),

  refreshStreamData: publicProcedure
    .mutation(() => refreshStreamData()),
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
  console.log(`OBSphere TRPC server listening at port: ${port}`);
}

start();