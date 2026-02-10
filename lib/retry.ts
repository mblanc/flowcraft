import logger from "@/app/logger";

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

/**
 * Executes a function with exponential backoff retry logic.
 *
 * @param fn The function to execute.
 * @param options Retry options.
 * @returns The result of the function.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const { maxRetries = 5, initialDelay = 1000, onRetry } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt < maxRetries) {
                const baseDelay = initialDelay * Math.pow(2, attempt);
                const jitter = Math.random() * 2000;
                const delay = baseDelay + jitter;

                if (onRetry) {
                    onRetry(attempt + 1, error, delay);
                } else {
                    logger.warn(
                        `Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay)}ms...`,
                        error,
                    );
                }

                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                if (attempt >= maxRetries) {
                    logger.error(`Failed after ${maxRetries} attempts.`, error);
                }
                throw error;
            }
        }
    }
    throw new Error("Retry loop failed unexpectedly");
}
