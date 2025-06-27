import { sleep } from "@zebec-network/core-utils";

// Set your backoff parameters
const MAX_RETRIES = 5;
const MIN_DELAY = 200; // in milliseconds
const BACKOFF_FACTOR = 2;
const MAX_DELAY = 30000;

// Helper function that wraps an async operation with exponential backoff.
export async function callWithEnhancedBackoff<T>(
	fn: () => Promise<T>,
	maxRetries: number = MAX_RETRIES,
	backoffFactor: number = BACKOFF_FACTOR,
	baseDelay: number = MIN_DELAY,
	maxDelay: number = MAX_DELAY,
): Promise<T> {
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error: any) {
			if (attempt === maxRetries) throw error;

			let delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);

			// Handle 429 specifically with longer delays
			if (error?.status === 429 || error?.code === 429 || error?.message?.includes("429")) {
				delay = Math.min(delay * backoffFactor, maxDelay); // Double delay for rate limits
				console.warn(`Rate limit hit, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
			}

			// Add jitter to prevent thundering herd
			const jitter = Math.random() * 0.3 * delay;
			await sleep(delay + jitter);
		}
	}

	throw new Error("Max retries exceeded");
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}

	return result;
}
