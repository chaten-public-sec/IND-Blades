const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const { ROOT_DIR, REMINDERS_PATH, LOGS_PATH, COMMANDS_PATH, getEnv } = require('./config/env');
const { LegacyStoreService } = require('./services/legacyStoreService');
const { LogService } = require('./services/logService');
const { CommandQueueService } = require('./services/commandQueueService');
const { DiscordService } = require('./services/discordService');
const { AppStoreService } = require('./services/appStoreService');
const { RoleService } = require('./services/roleService');
const { AuthService } = require('./services/authService');
const { NotificationService } = require('./services/notificationService');
const { createSocketAuthMiddleware } = require('./middlewares/socketAuth');
const { createAuthController } = require('./controllers/authController');
const { createSystemController } = require('./controllers/systemController');
const { createDashboardController } = require('./controllers/dashboardController');
const { createLegacyController } = require('./controllers/legacyController');
const { createManagementController } = require('./controllers/managementController');
const { createStrikesController } = require('./controllers/strikesController');
const { createApiRouter } = require('./routes/api');

function createCorsOptions() {
  const configuredOrigins = String(getEnv('ALLOWED_ORIGINS', ''))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    String(getEnv('CLIENT_URL', '')).trim(),
    ...configuredOrigins
  ].filter(Boolean));

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      } catch {}

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
  };
}

async function createApplication() {
  const legacyStoreService = new LegacyStoreService();
  const logService = new LogService();
  const commandQueueService = new CommandQueueService();
  const discordService = new DiscordService();
  const appStoreService = new AppStoreService(console);

  legacyStoreService.ensureDataFiles();
  logService.ensure();
  commandQueueService.ensure();
  await appStoreService.init();

  const roleService = new RoleService({ appStoreService, discordService });
  const authService = new AuthService({ discordService, roleService, logger: console });

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  const botState = {
    connected: false,
    lastHeartbeatAt: null,
    emit: null
  };

  let lastManualEmit = 0;
  const emitSystemUpdate = (type, payload = {}) => {
    lastManualEmit = Date.now();
    io.emit('systemUpdate', { type, payload });
    if (type.startsWith('EVENT_')) {
      io.emit('eventsUpdated');
    }
    if (type === 'BOT_STATUS_UPDATED') {
      io.emit('systemUpdate', { type: 'BOT_STATUS', payload });
    }
  };
  botState.emit = emitSystemUpdate;

  const notificationService = new NotificationService({ appStoreService, roleService, io });

  const authController = createAuthController({ authService });
  const systemController = createSystemController({ legacyStoreService, botState, appStoreService });
  const dashboardController = createDashboardController({
    legacyStoreService,
    discordService,
    roleService,
    appStoreService,
    notificationService,
    botState,
    logService
  });
  const legacyController = createLegacyController({
    legacyStoreService,
    logService,
    commandQueueService,
    emitSystemUpdate,
    notificationService
  });
  const managementController = createManagementController({
    appStoreService,
    roleService,
    notificationService,
    emitSystemUpdate,
    logService
  });
  const strikesController = createStrikesController({
    legacyStoreService,
    appStoreService,
    commandQueueService,
    emitSystemUpdate,
    notificationService,
    logService
  });

  app.set('trust proxy', 1);
  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: '2mb' }));
  app.use(authService.attachViewer);

  io.use(createSocketAuthMiddleware({ authService }));
  io.on('connection', (socket) => {
    if (socket.viewer?.id) {
      socket.join(`user:${socket.viewer.id}`);
    }
    socket.emit('connected', {
      ok: true,
      timestamp: Date.now()
    });
  });

  app.use('/api', createApiRouter({
    authService,
    roleService,
    authController,
    systemController,
    dashboardController,
    legacyController,
    managementController,
    strikesController
  }));

  fs.watchFile(REMINDERS_PATH, { interval: 1000 }, () => {
    if (Date.now() - lastManualEmit < 1200) {
      return;
    }
    discordService.invalidateCatalogCaches();
    emitSystemUpdate('SYSTEM_REFRESH', {});
  });

  fs.watchFile(LOGS_PATH, { interval: 1000 }, () => {
    if (Date.now() - lastManualEmit < 1200) {
      return;
    }
    emitSystemUpdate('LOG_UPDATED', {});
  });

  fs.watchFile(COMMANDS_PATH, { interval: 1000 }, () => {
    if (Date.now() - lastManualEmit < 1200) {
      return;
    }
    const commands = commandQueueService.getCommands();
    const last = commands[commands.length - 1];
    if (!last || last.status !== 'done') {
      return;
    }

    if (last.type === 'strike_added' || last.type === 'strike_removed' || last.type === 'strike_sync') {
      discordService.invalidateCatalogCaches();
      emitSystemUpdate('USER_UPDATED', last.payload || {});
      return;
    }

    if (String(last.type || '').startsWith('event_')) {
      emitSystemUpdate('EVENT_UPDATED', last.payload || {});
    }
  });

  const clientDistPath = path.join(ROOT_DIR, 'client', 'dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  return {
    app,
    server,
    io,
    dispose: async () => {
      fs.unwatchFile(REMINDERS_PATH);
      fs.unwatchFile(LOGS_PATH);
      fs.unwatchFile(COMMANDS_PATH);
      await appStoreService.close();
    },
    services: {
      legacyStoreService,
      logService,
      commandQueueService,
      discordService,
      appStoreService,
      roleService,
      authService,
      notificationService
    },
    emitSystemUpdate,
    botState
  };
}

module.exports = {
  createApplication
};
