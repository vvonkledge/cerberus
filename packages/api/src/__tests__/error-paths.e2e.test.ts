import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import register from "../auth/register";
import login from "../auth/login";
import refresh from "../auth/refresh";
import revoke from "../auth/revoke";
import { type Database, createDatabase } from "../db/client";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/authorization";
import rolesApp from "../rbac/roles";
import userRolesApp from "../rbac/user-roles";
import seed from "../rbac/seed";

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
	CREATE TABLE roles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		description TEXT,
		created_at TEXT NOT NULL
	);
	CREATE TABLE permissions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		permission TEXT NOT NULL UNIQUE,
		created_at TEXT NOT NULL
	);
	CREATE TABLE role_permissions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		role_id INTEGER NOT NULL,
		permission_id INTEGER NOT NULL,
		created_at TEXT NOT NULL
	);
	CREATE TABLE user_roles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		role_id INTEGER NOT NULL,
		created_at TEXT NOT NULL
	);
`;

const JWT_SECRET = "test-secret-for-error-paths";
const ENV = { JWT_SECRET };

type AppBindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
};
type AppVariables = {
	db: Database;
	user: { sub: string; iat: number; exp: number };
};
type AppEnv = { Bindings: AppBindings; Variables: AppVariables };

let testApp: Hono;
let db: Database;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	// Auth routes
	app.route("/register", register);
	app.route("/login", login);
	app.route("/refresh", refresh);
	app.route("/revoke", revoke);
	app.route("/seed", seed);

	// Protected RBAC routes
	const protectedRoles = new Hono<AppEnv>();
	protectedRoles.use("*", authMiddleware());
	protectedRoles.use("*", requirePermission("manage_roles"));
	protectedRoles.route("/", rolesApp);

	const protectedUsers = new Hono<AppEnv>();
	protectedUsers.use("*", authMiddleware());
	protectedUsers.use("*", requirePermission("manage_users"));
	protectedUsers.route("/", userRolesApp);

	app.route("/roles", protectedRoles);
	app.route("/users", protectedUsers);
	testApp = app;
});

function post(path: string, body: unknown) {
	return testApp.request(
		path,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		ENV,
	);
}

function get(path: string, headers?: Record<string, string>) {
	return testApp.request(
		path,
		{ method: "GET", headers },
		ENV,
	);
}

async function registerUser(email: string, password: string) {
	return post("/register", { email, password });
}

async function loginUser(email: string, password: string) {
	const res = await post("/login", { email, password });
	return res.json() as Promise<{
		access_token: string;
		refresh_token: string;
		token_type: string;
		expires_in: number;
	}>;
}

describe("Authentication Error Paths", () => {
	it("returns 401 for invalid password", async () => {
		await registerUser("user@test.com", "correct-password");

		const res = await post("/login", {
			email: "user@test.com",
			password: "wrong-password",
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid credentials" });
	});

	it("returns 401 for nonexistent user login", async () => {
		const res = await post("/login", {
			email: "nobody@test.com",
			password: "any-password",
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid credentials" });
	});

	it("returns 409 for duplicate registration", async () => {
		const first = await registerUser("dupe@test.com", "password123");
		expect(first.status).toBe(201);

		const second = await registerUser("dupe@test.com", "different-pass");
		expect(second.status).toBe(409);
	});

	it("returns 400 when register is missing email", async () => {
		const res = await post("/register", { password: "password123" });
		expect(res.status).toBe(400);
	});

	it("returns 400 when register is missing password", async () => {
		const res = await post("/register", { email: "test@test.com" });
		expect(res.status).toBe(400);
	});

	it("returns 400 when login is missing email", async () => {
		const res = await post("/login", { password: "password123" });
		expect(res.status).toBe(400);
	});

	it("returns 400 when login is missing password", async () => {
		const res = await post("/login", { email: "test@test.com" });
		expect(res.status).toBe(400);
	});
});

describe("Token Error Paths", () => {
	it("returns 401 for expired refresh token", async () => {
		await registerUser("user@test.com", "password123");

		// Insert an expired token directly into the DB
		await db.run(`
			INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
			VALUES ('expired-token-abc', 1, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')
		`);

		const res = await post("/refresh", { refresh_token: "expired-token-abc" });

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Refresh token expired" });
	});

	it("returns 401 for revoked refresh token", async () => {
		await registerUser("user@test.com", "password123");
		const tokens = await loginUser("user@test.com", "password123");

		// Revoke it
		await post("/revoke", { refresh_token: tokens.refresh_token });

		// Try to refresh with the revoked token
		const res = await post("/refresh", { refresh_token: tokens.refresh_token });

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Refresh token revoked" });
	});

	it("returns 401 for invalid/garbage refresh token", async () => {
		const res = await post("/refresh", { refresh_token: "totally-garbage-token" });

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid refresh token" });
	});

	it("returns 401 for already-rotated refresh token", async () => {
		await registerUser("user@test.com", "password123");
		const tokens = await loginUser("user@test.com", "password123");

		// Rotate: use old token to get a new one
		const refreshRes = await post("/refresh", { refresh_token: tokens.refresh_token });
		expect(refreshRes.status).toBe(200);

		// Try to use the old token again — it was cleaned up during rotation
		const res = await post("/refresh", { refresh_token: tokens.refresh_token });

		expect(res.status).toBe(401);
	});
});

describe("Authorization Error Paths", () => {
	it("returns 401 when no auth header on GET /roles", async () => {
		const res = await get("/roles");

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Authorization required" });
	});

	it("returns 401 when no auth header on GET /users", async () => {
		const res = await get("/users");

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Authorization required" });
	});

	it("returns 401 for invalid JWT on GET /roles", async () => {
		const res = await get("/roles", {
			Authorization: "Bearer invalid.token.here",
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid token" });
	});

	it("returns 401 for invalid JWT on GET /users", async () => {
		const res = await get("/users", {
			Authorization: "Bearer invalid.token.here",
		});

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Invalid token" });
	});

	it("returns 403 for valid JWT but no manage_roles permission on GET /roles", async () => {
		// Register a real user and get a real JWT — no admin seeding
		await registerUser("unprivileged@test.com", "password123");
		const tokens = await loginUser("unprivileged@test.com", "password123");

		const res = await get("/roles", {
			Authorization: `Bearer ${tokens.access_token}`,
		});

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body).toEqual({ error: "Forbidden" });
	});

	it("returns 403 for valid JWT but no manage_users permission on GET /users", async () => {
		// Register a real user and get a real JWT — no admin seeding
		await registerUser("unprivileged@test.com", "password123");
		const tokens = await loginUser("unprivileged@test.com", "password123");

		const res = await get("/users", {
			Authorization: `Bearer ${tokens.access_token}`,
		});

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body).toEqual({ error: "Forbidden" });
	});
});
