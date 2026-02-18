import { Hono } from "hono";
import { describe, expect, it, beforeEach } from "vitest";
import { verifyJwt } from "../auth/crypto";
import login from "../auth/login";
import refresh from "../auth/refresh";
import register from "../auth/register";
import revoke from "../auth/revoke";
import { createDatabase } from "../db/client";
import type { Database } from "../db/client";

const JWT_SECRET = "test-secret";

const CREATE_TABLES = `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT UNIQUE NOT NULL,
		hashed_password TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE refresh_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT UNIQUE NOT NULL,
		user_id INTEGER NOT NULL,
		expires_at TEXT NOT NULL,
		revoked_at TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
`;

let testApp: Hono;

beforeEach(async () => {
	const db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; JWT_SECRET: string };
		Variables: { db: Database };
	}>();

	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	app.route("/register", register);
	app.route("/login", login);
	app.route("/refresh", refresh);
	app.route("/revoke", revoke);

	testApp = app;
});

const env = { TURSO_DATABASE_URL: "file::memory:", JWT_SECRET };

function post(path: string, body: unknown) {
	return testApp.request(
		path,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		env,
	);
}

describe("New User Journey", () => {
	it("register → login → refresh → revoke full lifecycle", async () => {
		const email = "newuser@example.com";
		const password = "strong-password-123";

		// 1. Register a new user
		const registerRes = await post("/register", { email, password });
		expect(registerRes.status).toBe(201);
		const registerBody = (await registerRes.json()) as {
			id: number;
			email: string;
		};
		expect(registerBody.email).toBe(email);
		expect(registerBody.id).toEqual(expect.any(Number));

		// 2. Login with those credentials
		const loginRes = await post("/login", { email, password });
		expect(loginRes.status).toBe(200);
		const loginBody = (await loginRes.json()) as {
			access_token: string;
			refresh_token: string;
			token_type: string;
			expires_in: number;
		};
		expect(loginBody).toMatchObject({
			access_token: expect.any(String),
			refresh_token: expect.any(String),
			token_type: "Bearer",
			expires_in: 3600,
		});

		// 3. Verify the JWT has correct claims
		const claims = await verifyJwt(loginBody.access_token, JWT_SECRET);
		expect(claims).not.toBeNull();
		expect(claims!.sub).toBe(String(registerBody.id));
		expect(claims!.exp - claims!.iat).toBe(3600);

		// 4. Refresh the token
		const refreshRes = await post("/refresh", {
			refresh_token: loginBody.refresh_token,
		});
		expect(refreshRes.status).toBe(200);
		const refreshBody = (await refreshRes.json()) as {
			access_token: string;
			refresh_token: string;
			token_type: string;
			expires_in: number;
		};
		expect(refreshBody).toMatchObject({
			access_token: expect.any(String),
			refresh_token: expect.any(String),
			token_type: "Bearer",
			expires_in: 3600,
		});
		expect(refreshBody.refresh_token).not.toBe(loginBody.refresh_token);

		// 5. Verify the new JWT is valid
		const newClaims = await verifyJwt(refreshBody.access_token, JWT_SECRET);
		expect(newClaims).not.toBeNull();
		expect(newClaims!.sub).toBe(String(registerBody.id));

		// 6. Revoke the new refresh token
		const revokeRes = await post("/revoke", {
			refresh_token: refreshBody.refresh_token,
		});
		expect(revokeRes.status).toBe(200);
		const revokeBody = await revokeRes.json();
		expect(revokeBody).toEqual({ message: "Token revoked" });

		// 7. Confirm revoked token can't be used
		const failedRefreshRes = await post("/refresh", {
			refresh_token: refreshBody.refresh_token,
		});
		expect(failedRefreshRes.status).toBe(401);
		const failedBody = await failedRefreshRes.json();
		expect(failedBody).toEqual({ error: "Refresh token revoked" });
	});
});
