export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const log = (level: string, message: string, context?: Record<string, unknown>): void => {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  };

  console.log(JSON.stringify(entry));
};

export const logger: Logger = {
  info: (message, context) => log("info", message, context),
  warn: (message, context) => log("warn", message, context),
  error: (message, context) => log("error", message, context)
};
