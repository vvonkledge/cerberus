import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import forgotPasswordApp from "../auth/forgot-password";
import loginApp from "../auth/login";
import registerApp from "../auth/register";
import resetPasswordApp from "../auth/reset-password";
import { type Database, createDatabase } from "../db/client";
import { auditLogs, passwordResetTokens } from "../db/schema";

const CREATE_TABLES = `
	CREATE TABLE health_checks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		status TEXT NOT NULL,
		checked_at TEXT NOT NULL
	);
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		hashed_password TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE refresh_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT NOT NULL UNIQUE,
		user_id INTEGER NOT NULL,
		expires_at TEXT NOT NULL,
		revoked_at TEXT,
		created_at TEXT NOT NULL
	);
	CREATE TABLE password_reset_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT NOT NULL UNIQUE,
		user_id INTEGER NOT NULL,
		expires_at TEXT NOT NULL,
		used_at TEXT,
		created_at TEXT NOT NULL
	);
	CREATE TABLE audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		event_type TEXT NOT NULL,
		user_id TEXT,
		ip_address TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		metadata TEXT
	);
`;

const TEST_JWT_SECRET = "test-secret-for-password-reset";

let testApp: Hono;
let db: Database;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database };
	}>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});
	app.route("/register", registerApp);
	app.route("/login", loginApp);
	app.route("/forgot-password", forgotPasswordApp);
	app.route("/reset-password", resetPasswordApp);
	testApp = app;
});

const env = { JWT_SECRET: TEST_JWT_SECRET };

async function registerUser(email = "user@example.com", password = "password123") {
	const res = await testApp.request(
		"/register",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		},
		env,
	);
	return { res, body: (await res.json()) as { id: number; email: string } };
}

async function loginUser(email = "user@example.com", password = "password123") {
	const res = await testApp.request(
		"/login",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		},
		env,
	);
	return {
		res,
		body: (await res.json()) as {
			access_token: string;
			refresh_token: string;
			token_type: string;
			expires_in: number;
		},
	};
}

async function forgotPassword(email: string) {
	const res = await testApp.request(
		"/forgot-password",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email }),
		},
		env,
	);
	return { res, body: (await res.json()) as { resetToken?: string; message?: string } };
}

async function resetPassword(token: string, newPassword: string) {
	const res = await testApp.request(
		"/reset-password",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token, newPassword }),
		},
		env,
	);
	return { res, body: (await res.json()) as { message?: string; error?: string } };
}

async function getAuditLogsByType(eventType: string) {
	return db.select().from(auditLogs).where(eq(auditLogs.eventType, eventType)).all();
}

describe("POST /forgot-password", () => {
	it("returns 200 and resetToken for a registered email", async () => {
		await registerUser();
		const { res, body } = await forgotPassword("user@example.com");

		expect(res.status).toBe(200);
		expect(body).toHaveProperty("resetToken");
		expect(typeof body.resetToken).toBe("string");
	});

	it("returns 200 with no resetToken for non-existent email", async () => {
		const { res, body } = await forgotPassword("nobody@example.com");

		expect(res.status).toBe(200);
		expect(body).toHaveProperty("message");
		expect(body).not.toHaveProperty("resetToken");
	});

	it("returns 400 when email is missing", async () => {
		const res = await testApp.request(
			"/forgot-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			env,
		);

		expect(res.status).toBe(400);
	});

	it("writes password_reset_requested audit log", async () => {
		await registerUser();
		await forgotPassword("user@example.com");

		const logs = await getAuditLogsByType("password_reset_requested");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("password_reset_requested");
		expect(logs[0].userId).toBeTruthy();
	});
});

describe("POST /reset-password", () => {
	it("resets password with valid token", async () => {
		await registerUser();
		const { body: forgotBody } = await forgotPassword("user@example.com");
		const { res } = await resetPassword(forgotBody.resetToken!, "new-password-123");

		expect(res.status).toBe(200);
	});

	it("user can login with new password after reset", async () => {
		await registerUser();
		const { body: forgotBody } = await forgotPassword("user@example.com");
		await resetPassword(forgotBody.resetToken!, "new-password-123");

		const { res, body } = await loginUser("user@example.com", "new-password-123");
		expect(res.status).toBe(200);
		expect(body).toHaveProperty("access_token");
	});

	it("user cannot login with old password after reset", async () => {
		await registerUser("user@example.com", "old-password-123");
		const { body: forgotBody } = await forgotPassword("user@example.com");
		await resetPassword(forgotBody.resetToken!, "new-password-123");

		const { res } = await loginUser("user@example.com", "old-password-123");
		expect(res.status).toBe(401);
	});

	it("rejects already-used token", async () => {
		await registerUser();
		const { body: forgotBody } = await forgotPassword("user@example.com");
		await resetPassword(forgotBody.resetToken!, "new-password-123");

		const { res } = await resetPassword(forgotBody.resetToken!, "another-password");
		expect(res.status).toBe(400);
	});

	it("rejects expired token", async () => {
		await registerUser();
		const { body: forgotBody } = await forgotPassword("user@example.com");

		await db
			.update(passwordResetTokens)
			.set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
			.where(eq(passwordResetTokens.token, forgotBody.resetToken!));

		const { res } = await resetPassword(forgotBody.resetToken!, "new-password-123");
		expect(res.status).toBe(400);
	});

	it("rejects invalid token", async () => {
		const { res } = await resetPassword("random-invalid-token", "new-password-123");
		expect(res.status).toBe(400);
	});

	it("returns 400 when token or newPassword is missing", async () => {
		const noToken = await testApp.request(
			"/reset-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPassword: "something" }),
			},
			env,
		);
		expect(noToken.status).toBe(400);

		const noPassword = await testApp.request(
			"/reset-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: "something" }),
			},
			env,
		);
		expect(noPassword.status).toBe(400);
	});

	it("writes password_reset_completed audit log", async () => {
		await registerUser();
		const { body: forgotBody } = await forgotPassword("user@example.com");
		await resetPassword(forgotBody.resetToken!, "new-password-123");

		const logs = await getAuditLogsByType("password_reset_completed");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("password_reset_completed");
		expect(logs[0].userId).toBeTruthy();
	});

	it("writes password_reset_failed audit log for invalid token", async () => {
		await resetPassword("totally-bogus-token", "new-password-123");

		const logs = await getAuditLogsByType("password_reset_failed");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("password_reset_failed");
		const metadata = JSON.parse(logs[0].metadata!);
		expect(metadata.reason).toBe("invalid_token");
	});
});
