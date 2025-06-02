import assert from "assert";
import { describe } from "mocha";

import { RateLimitedQueue } from "../src/rateLimitQueue";

// Test utilities
// Test utilities
function createMockTask(id: number, duration: number = 100, shouldFail: boolean = false) {
	return async (): Promise<string> => {
		await new Promise((resolve) => setTimeout(resolve, duration));

		if (shouldFail) {
			throw new Error(`Task ${id} failed`);
		}

		return `Result ${id}`;
	};
}

async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
	const startTime = Date.now();
	const result = await fn();
	const duration = Date.now() - startTime;
	return { result, duration };
}

describe("RateLimitedQueue", function () {
	describe("Constructor", function () {
		it("should create queue with default parameters", function () {
			const queue = new RateLimitedQueue();
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});

		it("should create queue with custom parameters", function () {
			const queue = new RateLimitedQueue(5, 500);
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});
	});

	describe("Basic Functionality", function () {
		it("should process single task successfully", async function () {
			const queue = new RateLimitedQueue(1, 100);
			const result = await queue.add(createMockTask(1, 50));

			assert.strictEqual(result, "Result 1");
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});

		it("should process multiple tasks successfully", async function () {
			const queue = new RateLimitedQueue(2, 100);
			const tasks = [1, 2, 3, 4, 5].map((i) => queue.add(createMockTask(i, 100)));

			const results = await Promise.all(tasks);

			assert.deepStrictEqual(results, ["Result 1", "Result 2", "Result 3", "Result 4", "Result 5"]);
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});
	});

	describe("Concurrency Control", function () {
		it("should respect maximum concurrent limit", async function () {
			const maxConcurrent = 2;
			const queue = new RateLimitedQueue(maxConcurrent, 50);
			let currentConcurrent = 0;
			let maxObservedConcurrent = 0;

			const tasks = Array.from({ length: 6 }, (_, i) =>
				queue.add(async () => {
					currentConcurrent++;
					maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);

					// Verify we never exceed the limit during execution
					assert(
						currentConcurrent <= maxConcurrent,
						`Concurrent tasks (${currentConcurrent}) exceeded limit (${maxConcurrent})`,
					);

					await new Promise((resolve) => setTimeout(resolve, 200));

					currentConcurrent--;
					return `Task ${i + 1}`;
				}),
			);

			await Promise.all(tasks);

			assert(
				maxObservedConcurrent <= maxConcurrent,
				`Max observed concurrent (${maxObservedConcurrent}) should not exceed limit (${maxConcurrent})`,
			);
			assert(maxObservedConcurrent > 0, "Should have observed some concurrent execution");
		});

		it("should queue tasks when at capacity", async function () {
			const queue = new RateLimitedQueue(1, 50); // Only 1 concurrent

			// Add multiple tasks quickly
			const task1Promise = queue.add(createMockTask(1, 200));
			const task2Promise = queue.add(createMockTask(2, 200));

			// After adding 2 tasks with capacity of 1, queue should have 1 waiting
			// Give a small delay for the first task to start
			await new Promise((resolve) => setTimeout(resolve, 10));

			assert.strictEqual(queue.getRunningCount(), 1, "Should have 1 task running");
			assert.strictEqual(queue.getQueueLength(), 1, "Should have 1 task queued");

			await Promise.all([task1Promise, task2Promise]);
		});
	});

	describe("Rate Limiting", function () {
		it("should enforce minimum delay between requests", async function () {
			const minDelay = 300;
			const queue = new RateLimitedQueue(1, minDelay); // Single concurrent to ensure sequential
			const timestamps: number[] = [];

			const tasks = [1, 2, 3].map((i) =>
				queue.add(async () => {
					timestamps.push(Date.now());
					return `Task ${i}`;
				}),
			);

			await Promise.all(tasks);

			// Check delays between consecutive tasks
			for (let i = 1; i < timestamps.length; i++) {
				const actualDelay = timestamps[i] - timestamps[i - 1];
				assert(
					actualDelay >= minDelay - 50, // Allow 50ms tolerance for timing
					`Delay between tasks (${actualDelay}ms) should be at least ${minDelay}ms`,
				);
			}
		});

		it("should not add unnecessary delay when tasks are naturally spaced", async function () {
			const minDelay = 200;
			const queue = new RateLimitedQueue(1, minDelay);

			const startTime = Date.now();

			// First task
			await queue.add(createMockTask(1, 50));

			// Wait longer than minDelay before second task
			await new Promise((resolve) => setTimeout(resolve, minDelay + 100));

			// Second task should start immediately
			await queue.add(createMockTask(2, 50));

			const totalTime = Date.now() - startTime;

			// Total time should be approximately: 50 + (minDelay + 100) + 50 = minDelay + 200
			// We allow some tolerance for execution overhead
			assert(totalTime < minDelay + 300, `Total execution time (${totalTime}ms) suggests unnecessary delay was added`);
		});
	});

	describe("Error Handling", function () {
		it("should handle task failures without affecting other tasks", async function () {
			const queue = new RateLimitedQueue(2, 100);

			const tasks = [
				queue.add(createMockTask(1, 100, false)), // success
				queue.add(createMockTask(2, 100, true)), // failure
				queue.add(createMockTask(3, 100, false)), // success
				queue.add(createMockTask(4, 100, true)), // failure
				queue.add(createMockTask(5, 100, false)), // success
			];

			const results = await Promise.allSettled(tasks);

			// Check results
			assert.strictEqual(results[0].status, "fulfilled");
			assert.strictEqual(results[0].value, "Result 1");

			assert.strictEqual(results[1].status, "rejected");
			assert(results[1].reason.message.includes("Task 2 failed"));

			assert.strictEqual(results[2].status, "fulfilled");
			assert.strictEqual(results[2].value, "Result 3");

			assert.strictEqual(results[3].status, "rejected");
			assert(results[3].reason.message.includes("Task 4 failed"));

			assert.strictEqual(results[4].status, "fulfilled");
			assert.strictEqual(results[4].value, "Result 5");

			// Queue should be empty after all tasks complete
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});

		it("should continue processing after errors", async function () {
			const queue = new RateLimitedQueue(1, 100);

			// First task fails
			try {
				await queue.add(createMockTask(1, 100, true));
				assert.fail("Should have thrown an error");
			} catch (error) {
				assert(error.message.includes("Task 1 failed"));
			}

			// Second task should still work
			const result = await queue.add(createMockTask(2, 100, false));
			assert.strictEqual(result, "Result 2");
		});
	});

	describe("Performance", function () {
		it("should be faster than sequential execution", async function () {
			const taskCount = 8;
			const taskDuration = 100;

			// Sequential execution
			const { duration: sequentialTime } = await measureExecutionTime(async () => {
				const results: string[] = [];
				for (let i = 1; i <= taskCount; i++) {
					const result = await createMockTask(i, taskDuration)();
					results.push(result);
				}
				return results;
			});

			// Parallel execution with queue
			const { duration: parallelTime } = await measureExecutionTime(async () => {
				const queue = new RateLimitedQueue(3, 50);
				const tasks = Array.from({ length: taskCount }, (_, i) => queue.add(createMockTask(i + 1, taskDuration)));
				return await Promise.all(tasks);
			});

			console.log(`Sequential: ${sequentialTime}ms, Parallel: ${parallelTime}ms`);

			// Parallel should be significantly faster (allow for some overhead)
			assert(
				parallelTime < sequentialTime * 0.7,
				`Parallel execution (${parallelTime}ms) should be faster than sequential (${sequentialTime}ms)`,
			);
		});

		it("should be slower than unlimited parallel execution", async function () {
			const taskCount = 6;
			const taskDuration = 100;

			// Rate limited execution
			const { duration: limitedTime } = await measureExecutionTime(async () => {
				const queue = new RateLimitedQueue(2, 100);
				const tasks = Array.from({ length: taskCount }, (_, i) => queue.add(createMockTask(i + 1, taskDuration)));
				return await Promise.all(tasks);
			});

			// Unlimited parallel execution
			const { duration: unlimitedTime } = await measureExecutionTime(async () => {
				const tasks = Array.from({ length: taskCount }, (_, i) => createMockTask(i + 1, taskDuration)());
				return await Promise.all(tasks);
			});

			console.log(`Limited: ${limitedTime}ms, Unlimited: ${unlimitedTime}ms`);

			// Limited should be slower due to rate limiting
			assert(
				limitedTime > unlimitedTime,
				`Rate limited execution (${limitedTime}ms) should be slower than unlimited (${unlimitedTime}ms)`,
			);
		});
	});

	describe("Queue State Management", function () {
		it("should properly track queue and running counts", async function () {
			const queue = new RateLimitedQueue(2, 100);

			// Initial state
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);

			// Add tasks that will run for a while
			const task1 = queue.add(createMockTask(1, 300));
			const task2 = queue.add(createMockTask(2, 300));
			const task3 = queue.add(createMockTask(3, 300));

			// Give tasks time to start
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should have 2 running, 1 queued
			assert.strictEqual(queue.getRunningCount(), 2);
			assert.strictEqual(queue.getQueueLength(), 1);

			// Wait for tasks to complete
			await Promise.all([task1, task2, task3]);

			// Final state should be clean
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});

		it("should handle rapid task additions", async function () {
			const queue = new RateLimitedQueue(1, 50);
			const taskCount = 10;

			// Add many tasks rapidly
			const tasks = Array.from({ length: taskCount }, (_, i) => queue.add(createMockTask(i + 1, 50)));

			// Should have 1 running and 9 queued (or close to it due to timing)
			await new Promise((resolve) => setTimeout(resolve, 10));

			const running = queue.getRunningCount();
			const queued = queue.getQueueLength();

			assert(running <= 1, `Running count (${running}) should not exceed limit`);
			assert(running + queued >= taskCount - 2, "Most tasks should be tracked"); // Allow for timing variations

			await Promise.all(tasks);

			// Final cleanup
			assert.strictEqual(queue.getQueueLength(), 0);
			assert.strictEqual(queue.getRunningCount(), 0);
		});
	});
});
