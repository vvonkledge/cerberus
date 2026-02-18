import type { Context, Next } from "hono";

export interface RateLimitStore {
	get(key: string): Promise<number>;
	increment(key: string, windowMs: number): Promise<number>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
	private store = new Map<string, { count: number; expiresAt: number }>();

	async get(key: string): Promise<number> {
		const entry = this.store.get(key);
		if (!entry || Date.now() > entry.expiresAt) {
			return 0;
		}
		return entry.count;
	}

	async increment(key: string, windowMs: number): Promise<number> {
		const now = Date.now();
		const entry = this.store.get(key);

		if (!entry || now > entry.expiresAt) {
			this.store.set(key, { count: 1, expiresAt: now + windowMs });
			return 1;
		}

		entry.count += 1;
		return entry.count;
	}
}

export class KVRateLimitStore implements RateLimitStore {
	constructor(private kv: KVNamespace) {}

	async get(key: string): Promise<number> {
		const value = await this.kv.get(key);
		if (!value) return 0;
		return Number(value);
	}

	async increment(key: string, windowMs: number): Promise<number> {
		const current = await this.get(key);
		const next = current + 1;
		const ttlSeconds = Math.ceil(windowMs / 1000);
		await this.kv.put(key, String(next), { expirationTtl: ttlSeconds });
		return next;
	}
}

interface RateLimiterConfig {
	limit: number;
	windowMs: number;
	store: RateLimitStore;
}

export function rateLimiter(config: RateLimiterConfig) {
	const { limit, windowMs, store } = config;

	return async (c: Context, next: Next) => {
		const ip =
			c.req.header("CF-Connecting-IP") ||
			c.req.header("X-Forwarded-For") ||
			"unknown";
		const path = new URL(c.req.url).pathname;
		const key = `rate-limit:${ip}:${path}`;

		const count = await store.increment(key, windowMs);
		const remaining = Math.max(0, limit - count);
		const resetAt = Math.ceil((Date.now() + windowMs) / 1000);

		c.header("X-RateLimit-Limit", String(limit));
		c.header("X-RateLimit-Remaining", String(remaining));
		c.header("X-RateLimit-Reset", String(resetAt));

		if (count > limit) {
			return c.json({ error: "Too many requests" }, 429);
		}

		await next();
	};
}
