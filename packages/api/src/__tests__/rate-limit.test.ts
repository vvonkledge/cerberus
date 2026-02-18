import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import login from "../auth/login";
import refresh from "../auth/refresh";
import register from "../auth/register";
import { createDatabase } from "../db/client";
import type { Database } from "../db/client";
import {
	InMemoryRateLimitStore,
	rateLimiter,
} from "../middleware/rate-limiter";

const JWT_SECRET = "test-secret";

type AppBindings = {
	TURSO_DATABASE_URL: string;
	JWT_SECRET: string;
};
type AppVariables = { db: Database };

function buildApp(store: InMemoryRateLimitStore, db: Database) {
	const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	// Rate-limited login (10 req / 60s)
	const loginApp = new Hono<{
		Bindings: AppBindings;
		Variables: AppVariables;
	}>();
	loginApp.use("*", rateLimiter({ limit: 10, windowMs: 60_000, store }));
	loginApp.route("/", login);

	// Rate-limited register (5 req / 60s)
	const registerApp = new Hono<{
		Bindings: AppBindings;
		Variables: AppVariables;
	}>();
	registerApp.use("*", rateLimiter({ limit: 5, windowMs: 60_000, store }));
	registerApp.route("/", register);

	// Rate-limited refresh (10 req / 60s)
	const refreshApp = new Hono<{
		Bindings: AppBindings;
		Variables: AppVariables;
	}>();
	refreshApp.use("*", rateLimiter({ limit: 10, windowMs: 60_000, store }));
	refreshApp.route("/", refresh);

	app.route("/login", loginApp);
	app.route("/register", registerApp);
	app.route("/refresh", refreshApp);

	app.get("/health", async (c) => {
		return c.json({ status: "ok" });
	});

	return app;
}

const bindings = { TURSO_DATABASE_URL: "file::memory:", JWT_SECRET };

function post(app: Hono, path: string, body: unknown) {
	return app.request(
		path,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Forwarded-For": "1.2.3.4",
			},
			body: JSON.stringify(body),
		},
		bindings,
	);
}

describe("rate limiting", () => {
	let store: InMemoryRateLimitStore;
	let db: ReturnType<typeof createDatabase>;
	let app: Hono;

	beforeEach(async () => {
		store = new InMemoryRateLimitStore();
		db = createDatabase({ url: "file::memory:" });
		await db.run(`
			CREATE TABLE users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT UNIQUE NOT NULL,
				hashed_password TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
		await db.run(`
			CREATE TABLE refresh_tokens (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				token TEXT UNIQUE NOT NULL,
				user_id INTEGER NOT NULL,
				expires_at TEXT NOT NULL,
				revoked_at TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
		app = buildApp(store, db);
	});

	it("POST /login returns 429 after exceeding 10 requests", async () => {
		const body = { email: "a@b.com", password: "password" };

		for (let i = 0; i < 10; i++) {
			const res = await post(app, "/login", body);
			expect(res.status).not.toBe(429);
		}

		const blocked = await post(app, "/login", body);
		expect(blocked.status).toBe(429);
		const json = await blocked.json();
		expect(json).toEqual({ error: "Too many requests" });
	});

	it("POST /register returns 429 after exceeding 5 requests", async () => {
		const body = { email: "a@b.com", password: "password" };

		for (let i = 0; i < 5; i++) {
			const res = await post(app, "/register", body);
			expect(res.status).not.toBe(429);
		}

		const blocked = await post(app, "/register", body);
		expect(blocked.status).toBe(429);
		const json = await blocked.json();
		expect(json).toEqual({ error: "Too many requests" });
	});

	it("POST /refresh returns 429 after exceeding 10 requests", async () => {
		const body = { refresh_token: "fake-token" };

		for (let i = 0; i < 10; i++) {
			const res = await post(app, "/refresh", body);
			expect(res.status).not.toBe(429);
		}

		const blocked = await post(app, "/refresh", body);
		expect(blocked.status).toBe(429);
		const json = await blocked.json();
		expect(json).toEqual({ error: "Too many requests" });
	});

	it("GET /health is not rate-limited", async () => {
		for (let i = 0; i < 25; i++) {
			const res = await app.request(
				"/health",
				{
					headers: { "X-Forwarded-For": "1.2.3.4" },
				},
				bindings,
			);
			expect(res.status).toBe(200);
		}
	});

	it("429 response includes rate limit headers", async () => {
		const body = { email: "a@b.com", password: "password" };

		// Exhaust the limit
		for (let i = 0; i < 10; i++) {
			await post(app, "/login", body);
		}

		const blocked = await post(app, "/login", body);
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("X-RateLimit-Limit")).toBe("10");
		expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
		expect(blocked.headers.get("X-RateLimit-Reset")).toBeTruthy();
	});

	it("successful responses include rate limit headers", async () => {
		const body = { email: "a@b.com", password: "password" };
		const res = await post(app, "/login", body);

		expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
		expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
	});
});
