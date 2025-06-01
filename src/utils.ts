// Set your backoff parameters
const MAX_ATTEMPTS = 5;
const INITIAL_DELAY = 100; // in milliseconds
const BACKOFF_FACTOR = 2;

// Helper function that wraps an async operation with exponential backoff.
export async function callWithExponentialBackoff<T>(fn: () => T, attemptsLeft = MAX_ATTEMPTS, delay = INITIAL_DELAY) {
	try {
		return await fn();
	} catch (error) {
		if (attemptsLeft === 1) {
			// If no attempts remain, rethrow the error.
			throw error;
		}
		console.warn(
			`Error encountered: ${error instanceof Error ? error.message : "Unknown error"}. Retrying in ${delay} ms... (${attemptsLeft - 1} attempts left)`,
		);
		// Wait for the delay period.
		await new Promise((resolve) => setTimeout(resolve, delay));
		// Try again with one fewer attempt and an exponentially increased delay.
		return callWithExponentialBackoff(fn, attemptsLeft - 1, delay * BACKOFF_FACTOR);
	}
}
