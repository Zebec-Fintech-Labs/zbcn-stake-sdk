export class RateLimitedQueue {
	private queue: Array<() => Promise<any>> = [];
	private running = 0;
	private maxConcurrent: number;
	private minDelay: number;
	private lastRequestTime = 0;

	constructor(maxConcurrent = 3, minDelayMs = 200) {
		this.maxConcurrent = maxConcurrent;
		this.minDelay = minDelayMs;
	}

	async add<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.queue.push(async () => {
				try {
					// Ensure minimum delay between requests
					const now = Date.now();
					const timeSinceLastRequest = now - this.lastRequestTime;
					if (timeSinceLastRequest < this.minDelay) {
						await new Promise((resolve) => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
					}

					this.lastRequestTime = Date.now();
					const result = await task();
					resolve(result);
				} catch (error) {
					reject(error);
				}
			});

			this.processQueue();
		});
	}

	private async processQueue() {
		if (this.running >= this.maxConcurrent || this.queue.length === 0) {
			return;
		}

		this.running++;
		const task = this.queue.shift()!;

		try {
			await task();
		} finally {
			this.running--;
			this.processQueue(); // Process next item
		}
	}

	// Test helper methods

	public getQueueLength(): number {
		return this.queue.length;
	}

	public getRunningCount(): number {
		return this.running;
	}
}
