/**
 * Structured logger for the 247 web application.
 * In development: logs to console with prefixes
 * In production: can be extended to send to external logging service
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isDevelopment = process.env.NODE_ENV === 'development';

function formatMessage(level: LogLevel, tag: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}${contextStr}`;
}

function shouldLog(level: LogLevel): boolean {
  // In production, only log warnings and errors
  if (!isDevelopment && (level === 'debug' || level === 'info')) {
    return false;
  }
  return true;
}

/**
 * Creates a scoped logger with a specific tag prefix.
 * Example: const log = createLogger('WS');
 */
export function createLogger(tag: string) {
  return {
    debug(message: string, context?: LogContext) {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', tag, message, context));
      }
    },
    info(message: string, context?: LogContext) {
      if (shouldLog('info')) {
        console.info(formatMessage('info', tag, message, context));
      }
    },
    warn(message: string, context?: LogContext) {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', tag, message, context));
      }
    },
    error(message: string, error?: unknown, context?: LogContext) {
      if (shouldLog('error')) {
        const errorContext = error instanceof Error
          ? { ...context, errorMessage: error.message, stack: error.stack }
          : { ...context, error };
        console.error(formatMessage('error', tag, message, errorContext));
      }
    },
  };
}

// Pre-configured loggers for common use cases
export const wsLogger = createLogger('WS');
export const pollingLogger = createLogger('Polling');
export const terminalLogger = createLogger('Terminal');
export const archivedLogger = createLogger('Archived');
