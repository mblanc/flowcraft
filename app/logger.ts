const isServer = typeof window === "undefined";

interface Logger {
    error: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    debug: (msg: string, ...args: unknown[]) => void;
}

let logger: Logger;

if (isServer) {
    // Dynamically require server-only modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const winston = require("winston");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { config } = require("@/lib/config");

    const { combine, timestamp, printf, colorize, align, errors } =
        winston.format;
    const winstonLogger = winston.createLogger({
        level: config.LOG_LEVEL,
        format: combine(
            errors({ stack: true }),
            colorize({ all: true }),
            timestamp({
                format: "YYYY-MM-DD hh:mm:ss.SSS A",
            }),
            align(),
            printf(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (info: any) =>
                    `[${info.timestamp}] ${info.level}: ${info.message}`,
            ),
        ),
        transports: [new winston.transports.Console({ forceConsole: true })],
        exceptionHandlers: [
            new winston.transports.Console({ forceConsole: true }),
        ],
        rejectionHandlers: [
            new winston.transports.Console({ forceConsole: true }),
        ],
        exitOnError: false,
    });
    logger = winstonLogger as unknown as Logger;
} else {
    // Client-side simple logger that matches Winston API
    const levels = ["error", "warn", "info", "debug"];
    // On the client, we don't have access to server-side config.LOG_LEVEL easily
    // without a NEXT_PUBLIC_ prefix. We'll default to 'info'.
    const currentLevel = "info";
    const levelPriority = levels.indexOf(currentLevel);

    const formatMessage = (level: string, message: string) => {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    };

    logger = {
        error: (msg: string, ...args: unknown[]) => {
            if (levels.indexOf("error") <= levelPriority)
                console.error(formatMessage("error", msg), ...args);
        },
        warn: (msg: string, ...args: unknown[]) => {
            if (levels.indexOf("warn") <= levelPriority)
                console.warn(formatMessage("warn", msg), ...args);
        },
        info: (msg: string, ...args: unknown[]) => {
            if (levels.indexOf("info") <= levelPriority)
                console.log(formatMessage("info", msg), ...args);
        },
        debug: (msg: string, ...args: unknown[]) => {
            if (levels.indexOf("debug") <= levelPriority)
                console.debug(formatMessage("debug", msg), ...args);
        },
    };
}

export default logger;
