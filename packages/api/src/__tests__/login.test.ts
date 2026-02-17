import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyJwt } from "../auth/crypto";
import login from "../auth/login";
import { createDatabase } from "../db/client";
import type { Database } from "../db/client";
import { users } from "../db/schema";

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
	await db.insert(users).values({
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

describe("POST /login", () => {
	it("returns 200 with OAuth token for valid credentials", async () => {
		const { app } = await setupTestApp();
		const res = await postLogin(app, {
			email: TEST_EMAIL,
			password: TEST_PASSWORD,
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

	it("returns 401 for invalid password", async () => {
		const { app } = await setupTestApp();
		const res = await postLogin(app, {
			email: TEST_EMAIL,
			password: "wrong-password",
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid credentials" });
	});

	it("returns 401 for nonexistent user", async () => {
		const { app } = await setupTestApp();
		const res = await postLogin(app, {
			email: "nobody@example.com",
			password: TEST_PASSWORD,
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid credentials" });
	});

	it("returns JWT with correct claims", async () => {
		const { app } = await setupTestApp();
		const res = await postLogin(app, {
			email: TEST_EMAIL,
			password: TEST_PASSWORD,
		});

		const { access_token } = await res.json();
		const claims = await verifyJwt(access_token, JWT_SECRET);

		expect(claims).not.toBeNull();
		const { sub, iat, exp } = claims as {
			sub: string;
			iat: number;
			exp: number;
		};
		expect(sub).toBe("1");
		expect(iat).toEqual(expect.any(Number));
		expect(exp).toEqual(expect.any(Number));
		expect(exp - iat).toBe(3600);
	});

	it("returns 400 for missing fields", async () => {
		const { app } = await setupTestApp();

		const noEmail = await postLogin(app, { password: TEST_PASSWORD });
		expect(noEmail.status).toBe(400);

		const noPassword = await postLogin(app, { email: TEST_EMAIL });
		expect(noPassword.status).toBe(400);
	});
});
