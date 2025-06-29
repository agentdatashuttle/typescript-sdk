import * as winston from "winston";

export function createLogger(name: string): winston.Logger {
  return winston.createLogger({
    level: (process.env.LOG_LEVEL || "info").toLowerCase(),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${name}] ${level}: ${message}`;
      }),
      // winston.format.json(),
      winston.format.errors({ stack: true })
    ),
    transports: [new winston.transports.Console()],
  });
}
