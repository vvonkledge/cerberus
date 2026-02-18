import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyJwt } from "../auth/crypto";
import login from "../auth/login";
import refresh from "../auth/refresh";
import revoke from "../auth/revoke";
import { createDatabase } from "../db/client";
import type { Database } from "../db/client";
import { refreshTokens } from "../db/schema";

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "correct-password";
const JWT_SECRET = "test-secret";

async function setupTestApp() {
	const db = createDatabase({ url: "file::memory:" });

	await db.run(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT UNIQUE NOT NULL,
			hashed_password TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
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

	const hashed = await hashPassword(TEST_PASSWORD);
	await db.insert((await import("../db/schema")).users).values({
		email: TEST_EMAIL,
		hashedPassword: hashed,
	});

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; JWT_SECRET: string };
		Variables: { db: Database };
	}>();

	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	app.route("/login", login);
	app.route("/refresh", refresh);
	app.route("/revoke", revoke);

	return { app, db };
}

function postLogin(app: Hono, body: unknown) {
	return app.request(
		"/login",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		{ TURSO_DATABASE_URL: "file::memory:", JWT_SECRET },
	);
}

function postRefresh(app: Hono, body: unknown) {
	return app.request(
		"/refresh",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		{ TURSO_DATABASE_URL: "file::memory:", JWT_SECRET },
	);
}

function postRevoke(app: Hono, body: unknown) {
	return app.request(
		"/revoke",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		{ TURSO_DATABASE_URL: "file::memory:", JWT_SECRET },
	);
}

async function loginAndGetTokens(app: Hono) {
	const res = await postLogin(app, {
		email: TEST_EMAIL,
		password: TEST_PASSWORD,
	});
	return res.json() as Promise<{
		access_token: string;
		refresh_token: string;
		token_type: string;
		expires_in: number;
	}>;
}

describe("POST /refresh", () => {
	it("returns a new access token for a valid refresh token", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		const res = await postRefresh(app, {
			refresh_token: tokens.refresh_token,
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({
			access_token: expect.any(String),
			refresh_token: expect.any(String),
			token_type: "Bearer",
			expires_in: 3600,
		});
	});

	it("returns new refresh token on successful refresh", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		const res = await postRefresh(app, {
			refresh_token: tokens.refresh_token,
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { access_token: string; refresh_token: string };
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.refresh_token).toEqual(expect.any(String));
		expect(body.refresh_token).not.toBe(tokens.refresh_token);
	});

	it("invalidates old refresh token after rotation", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		// Use the refresh token (this should rotate it)
		await postRefresh(app, { refresh_token: tokens.refresh_token });

		// Try to use the old refresh token again (it was cleaned up during rotation)
		const res = await postRefresh(app, {
			refresh_token: tokens.refresh_token,
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid refresh token" });
	});

	it("rejects already-rotated token in a chain", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		// Refresh with A -> get B
		const resB = await postRefresh(app, { refresh_token: tokens.refresh_token });
		const bodyB = (await resB.json()) as { refresh_token: string };

		// Refresh with B -> get C
		const resC = await postRefresh(app, { refresh_token: bodyB.refresh_token });
		expect(resC.status).toBe(200);

		// Try to refresh with B (already rotated and cleaned up) -> should fail
		const res = await postRefresh(app, { refresh_token: bodyB.refresh_token });
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid refresh token" });
	});

	it("returns 401 for an expired refresh token", async () => {
		const { app, db } = await setupTestApp();

		// Insert an expired token directly
		await db.run(`
			INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
			VALUES ('expired-token', 1, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')
		`);

		const res = await postRefresh(app, { refresh_token: "expired-token" });

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Refresh token expired" });
	});

	it("returns 401 for a revoked refresh token", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		// Revoke it
		await postRevoke(app, { refresh_token: tokens.refresh_token });

		// Try to use it
		const res = await postRefresh(app, {
			refresh_token: tokens.refresh_token,
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Refresh token revoked" });
	});

	it("returns 401 for an invalid/garbage token", async () => {
		const { app } = await setupTestApp();

		const res = await postRefresh(app, {
			refresh_token: "totally-invalid-garbage-token",
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid refresh token" });
	});

	it("returns a valid JWT as the new access token", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		const res = await postRefresh(app, {
			refresh_token: tokens.refresh_token,
		});
		const { access_token } = (await res.json()) as { access_token: string };
		const claims = await verifyJwt(access_token, JWT_SECRET);

		expect(claims).not.toBeNull();
		expect(claims!.sub).toBe("1");
		expect(claims!.exp - claims!.iat).toBe(3600);
	});

	it("cleans up revoked and expired tokens during rotation", async () => {
		const { app, db } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		// Rotate A -> B (A becomes revoked)
		const resB = await postRefresh(app, { refresh_token: tokens.refresh_token });
		expect(resB.status).toBe(200);
		const bodyB = (await resB.json()) as { refresh_token: string };

		// Insert an expired token directly to simulate a stale expired row
		await db.run(`
			INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
			VALUES ('manually-expired', 1, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')
		`);

		// Rotate B -> C (B becomes revoked; cleanup should remove A, B revoked + expired token)
		const resC = await postRefresh(app, { refresh_token: bodyB.refresh_token });
		expect(resC.status).toBe(200);
		const bodyC = (await resC.json()) as { refresh_token: string };

		// Query remaining tokens for user 1
		const remaining = await db
			.select()
			.from(refreshTokens)
			.where(eq(refreshTokens.userId, 1));

		// Only the latest non-revoked, unexpired token (C) should remain
		expect(remaining).toHaveLength(1);
		expect(remaining[0].token).toBe(bodyC.refresh_token);
		expect(remaining[0].revokedAt).toBeNull();
	});
});

describe("POST /revoke", () => {
	it("returns 200 for a valid refresh token", async () => {
		const { app } = await setupTestApp();
		const tokens = await loginAndGetTokens(app);

		const res = await postRevoke(app, {
			refresh_token: tokens.refresh_token,
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ message: "Token revoked" });
	});
});

describe("Refresh token storage", () => {
	it("stores refresh token with 7-day expiry", async () => {
		const { app, db } = await setupTestApp();
		await loginAndGetTokens(app);

		const rows = await db.select().from(refreshTokens);
		expect(rows).toHaveLength(1);

		const expiresAt = new Date(rows[0].expiresAt);
		const now = new Date();
		const diffDays =
			(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		// Should be approximately 7 days (within a small tolerance)
		expect(diffDays).toBeGreaterThan(6.9);
		expect(diffDays).toBeLessThan(7.1);
	});
});
