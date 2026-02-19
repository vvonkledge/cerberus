import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { signJwt } from "../auth/crypto";
import loginApp from "../auth/login";
import refreshApp from "../auth/refresh";
import registerApp from "../auth/register";
import revokeApp from "../auth/revoke";
import { type Database, createDatabase } from "../db/client";
import { auditLogs } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/authorization";
import auditLogsApp from "../rbac/audit-logs";
import rolesApp from "../rbac/roles";
import seedApp from "../rbac/seed";

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
	CREATE TABLE audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		event_type TEXT NOT NULL,
		user_id TEXT,
		ip_address TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		metadata TEXT
	);
`;

const TEST_JWT_SECRET = "test-secret-for-audit";

let testApp: Hono;
let db: Database;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	// Protected roles routes
	const protectedRoles = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	protectedRoles.use("*", authMiddleware());
	protectedRoles.use("*", requirePermission("manage_roles"));
	protectedRoles.route("/", rolesApp);

	// Protected audit-logs routes
	const protectedAuditLogs = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	protectedAuditLogs.use("*", authMiddleware());
	protectedAuditLogs.use("*", requirePermission("manage_users"));
	protectedAuditLogs.route("/", auditLogsApp);

	app.route("/register", registerApp);
	app.route("/login", loginApp);
	app.route("/refresh", refreshApp);
	app.route("/revoke", revokeApp);
	app.route("/roles", protectedRoles);
	app.route("/audit-logs", protectedAuditLogs);
	app.route("/seed", seedApp);

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

async function getAuditLogs() {
	return db.select().from(auditLogs).all();
}

async function getAuditLogsByType(eventType: string) {
	return db.select().from(auditLogs).where(eq(auditLogs.eventType, eventType)).all();
}

describe("Auth endpoint audit logging", () => {
	it("POST /register creates audit entry with event_type='register'", async () => {
		const { body } = await registerUser();

		const logs = await getAuditLogsByType("register");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("register");
		expect(logs[0].userId).toBe(String(body.id));
		expect(logs[0].ipAddress).toBeTruthy();
		expect(logs[0].timestamp).toBeTruthy();
	});

	it("POST /login success creates audit entry with event_type='login'", async () => {
		await registerUser();
		await loginUser();

		const logs = await getAuditLogsByType("login");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("login");
		expect(logs[0].userId).toBeTruthy();
	});

	it("POST /login failure creates audit entry with event_type='login_failed'", async () => {
		await registerUser();
		const res = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
			},
			env,
		);
		expect(res.status).toBe(401);

		const logs = await getAuditLogsByType("login_failed");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("login_failed");
		expect(logs[0].userId).toBeNull();
		const metadata = JSON.parse(logs[0].metadata!);
		expect(metadata.email).toBe("user@example.com");
	});

	it("POST /login failure for non-existent user creates audit entry with event_type='login_failed'", async () => {
		const res = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "nobody@example.com", password: "doesntmatter" }),
			},
			env,
		);
		expect(res.status).toBe(401);

		const logs = await getAuditLogsByType("login_failed");
		expect(logs).toHaveLength(1);
		expect(logs[0].userId).toBeNull();
		const metadata = JSON.parse(logs[0].metadata!);
		expect(metadata.email).toBe("nobody@example.com");
	});

	it("POST /refresh creates audit entry with event_type='refresh'", async () => {
		await registerUser();
		const { body: loginBody } = await loginUser();

		const res = await testApp.request(
			"/refresh",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refresh_token: loginBody.refresh_token }),
			},
			env,
		);
		expect(res.status).toBe(200);

		const logs = await getAuditLogsByType("refresh");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("refresh");
		expect(logs[0].userId).toBeTruthy();
	});

	it("POST /revoke creates audit entry with event_type='revoke'", async () => {
		await registerUser();
		const { body: loginBody } = await loginUser();

		const res = await testApp.request(
			"/revoke",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refresh_token: loginBody.refresh_token }),
			},
			env,
		);
		expect(res.status).toBe(200);

		const logs = await getAuditLogsByType("revoke");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("revoke");
		expect(logs[0].userId).toBeTruthy();
	});
});

describe("Authorization audit logging", () => {
	it("successful permission check creates audit entry with event_type='authz_granted'", async () => {
		const { body: regBody } = await registerUser("admin@example.com", "admin-pass-123");
		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: regBody.id }),
			},
			env,
		);
		const { body: loginBody } = await loginUser("admin@example.com", "admin-pass-123");

		const res = await testApp.request(
			"/roles",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${loginBody.access_token}` },
			},
			env,
		);
		expect(res.status).toBe(200);

		const logs = await getAuditLogsByType("authz_granted");
		expect(logs.length).toBeGreaterThanOrEqual(1);
		const rolesGrant = logs.find((l) => {
			const meta = JSON.parse(l.metadata!);
			return meta.permission === "manage_roles";
		});
		expect(rolesGrant).toBeDefined();
		expect(rolesGrant!.userId).toBe(String(regBody.id));
	});

	it("failed permission check creates audit entry with event_type='authz_denied'", async () => {
		const { body: regBody } = await registerUser();
		const { body: loginBody } = await loginUser();

		const res = await testApp.request(
			"/roles",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${loginBody.access_token}` },
			},
			env,
		);
		expect(res.status).toBe(403);

		const logs = await getAuditLogsByType("authz_denied");
		expect(logs).toHaveLength(1);
		expect(logs[0].eventType).toBe("authz_denied");
		expect(logs[0].userId).toBe(String(regBody.id));
		const metadata = JSON.parse(logs[0].metadata!);
		expect(metadata.permission).toBe("manage_roles");
	});
});

describe("GET /audit-logs endpoint", () => {
	it("returns paginated results", async () => {
		// Create some audit entries via register + login
		const { body: regBody } = await registerUser("admin@example.com", "admin-pass-123");
		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: regBody.id }),
			},
			env,
		);
		const { body: loginBody } = await loginUser("admin@example.com", "admin-pass-123");

		const res = await testApp.request(
			"/audit-logs",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${loginBody.access_token}` },
			},
			env,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: unknown[];
			pagination: { page: number; limit: number; total: number };
		};
		expect(body).toHaveProperty("data");
		expect(body).toHaveProperty("pagination");
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.pagination).toHaveProperty("page");
		expect(body.pagination).toHaveProperty("limit");
		expect(body.pagination).toHaveProperty("total");
		expect(body.data.length).toBeGreaterThan(0);
		expect(body.pagination.total).toBeGreaterThan(0);
	});

	it("filters by event_type", async () => {
		// Create audit entries via register and login
		const { body: regBody } = await registerUser("admin@example.com", "admin-pass-123");
		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: regBody.id }),
			},
			env,
		);
		const { body: loginBody } = await loginUser("admin@example.com", "admin-pass-123");

		// There should be both 'register' and 'login' entries
		const allLogs = await getAuditLogs();
		const registerLogs = allLogs.filter((l) => l.eventType === "register");
		const loginLogs = allLogs.filter((l) => l.eventType === "login");
		expect(registerLogs.length).toBeGreaterThan(0);
		expect(loginLogs.length).toBeGreaterThan(0);

		// Filter by event_type=login
		const res = await testApp.request(
			"/audit-logs?event_type=login",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${loginBody.access_token}` },
			},
			env,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: Array<{ eventType: string }>;
			pagination: { total: number };
		};
		for (const entry of body.data) {
			expect(entry.eventType).toBe("login");
		}
		expect(body.pagination.total).toBe(loginLogs.length);
	});

	it("requires authentication", async () => {
		const res = await testApp.request(
			"/audit-logs",
			{ method: "GET" },
			env,
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("requires manage_users permission", async () => {
		// Register a user with no permissions
		await registerUser();
		const { body: loginBody } = await loginUser();

		const res = await testApp.request(
			"/audit-logs",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${loginBody.access_token}` },
			},
			env,
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("respects page and limit query parameters", async () => {
		const { body: regBody } = await registerUser("admin@example.com", "admin-pass-123");
		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: regBody.id }),
			},
			env,
		);
		const { body: loginBody } = await loginUser("admin@example.com", "admin-pass-123");

		const res = await testApp.request(
			"/audit-logs?page=1&limit=1",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${loginBody.access_token}` },
			},
			env,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: unknown[];
			pagination: { page: number; limit: number; total: number };
		};
		expect(body.data).toHaveLength(1);
		expect(body.pagination.page).toBe(1);
		expect(body.pagination.limit).toBe(1);
		expect(body.pagination.total).toBeGreaterThan(1);
	});
});

describe("Audit entry field completeness", () => {
	it("every audit entry has event_type, ip_address, and timestamp", async () => {
		// Do a few operations to create audit entries
		await registerUser();
		await loginUser();

		const logs = await getAuditLogs();
		expect(logs.length).toBeGreaterThan(0);

		for (const log of logs) {
			expect(log.eventType).toBeTruthy();
			expect(log.ipAddress).toBeTruthy();
			expect(log.timestamp).toBeTruthy();
		}
	});

	it("register entry includes user_id", async () => {
		const { body } = await registerUser();

		const logs = await getAuditLogsByType("register");
		expect(logs).toHaveLength(1);
		expect(logs[0].userId).toBe(String(body.id));
	});

	it("login entry includes user_id", async () => {
		const { body: regBody } = await registerUser();
		await loginUser();

		const logs = await getAuditLogsByType("login");
		expect(logs).toHaveLength(1);
		expect(logs[0].userId).toBe(String(regBody.id));
	});

	it("login_failed entry has null user_id", async () => {
		await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
			},
			env,
		);

		const logs = await getAuditLogsByType("login_failed");
		expect(logs).toHaveLength(1);
		expect(logs[0].userId).toBeNull();
	});

	it("register entry metadata includes email", async () => {
		await registerUser("meta@example.com", "password123");

		const logs = await getAuditLogsByType("register");
		expect(logs).toHaveLength(1);
		const metadata = JSON.parse(logs[0].metadata!);
		expect(metadata.email).toBe("meta@example.com");
	});
});
