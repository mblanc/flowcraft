import { ExecutionContext } from "../../types";

/**
 * Centralized utility for making node API calls with a consistent
 * fetch pattern: POST with JSON body, error propagation, and
 * optional fetch injection for testing.
 */
export async function executeNodeApiCall<T>(
    endpoint: string,
    body: unknown,
    context?: ExecutionContext,
): Promise<T> {
    const fetcher = context?.fetch || fetch;
    const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request to ${endpoint} failed: ${errorText}`);
    }

    return response.json() as Promise<T>;
}
