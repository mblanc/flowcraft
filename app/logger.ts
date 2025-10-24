import winston from 'winston';

const { combine, timestamp, printf, colorize, align, errors } = winston.format;

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      errors({ stack: true }),
      colorize({ all: true }),
      timestamp({
        format: 'YYYY-MM-DD hh:mm:ss.SSS A',
      }),
      align(),
      printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
    ),
    transports: [new winston.transports.Console({ forceConsole: true })],
    exceptionHandlers: [new winston.transports.Console({ forceConsole: true })],
    rejectionHandlers: [new winston.transports.Console({ forceConsole: true })],
    exitOnError: false,
  });


export default logger;