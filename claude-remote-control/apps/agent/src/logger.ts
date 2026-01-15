import pino from 'pino';

// Get log level from environment or default to 'info'
const level = process.env.LOG_LEVEL || 'info';

// Check if we're in development mode (for pretty printing)
const isDev = process.env.NODE_ENV !== 'production';

// Create base logger
const baseLogger = pino({
  level,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Create child loggers for each module
export const logger = {
  // Main logger for generic messages
  main: baseLogger,

  // Server/API related logs
  server: baseLogger.child({ module: 'Server' }),

  // Database related logs
  db: baseLogger.child({ module: 'DB' }),

  // Session management logs
  session: baseLogger.child({ module: 'Session' }),

  // Terminal/PTY related logs
  terminal: baseLogger.child({ module: 'Terminal' }),

  // Environment management logs
  env: baseLogger.child({ module: 'Environments' }),

  // Connection management logs
  connections: baseLogger.child({ module: 'Connections' }),

  // Hook status logs
  hooks: baseLogger.child({ module: 'Hooks' }),
};

export default logger;
