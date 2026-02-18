import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import loginApp from "../auth/login";
import registerApp from "../auth/register";
import { type Database, createDatabase } from "../db/client";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/authorization";
import rolesApp from "../rbac/roles";
import seedApp from "../rbac/seed";
import userRolesApp from "../rbac/user-roles";

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

const TEST_JWT_SECRET = "test-secret-for-e2e";

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

	// Protected users routes
	const protectedUsers = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	protectedUsers.use("*", authMiddleware());
	protectedUsers.use("*", requirePermission("manage_users"));
	protectedUsers.route("/", userRolesApp);

	app.route("/roles", protectedRoles);
	app.route("/users", protectedUsers);
	app.route("/seed", seedApp);
	app.route("/register", registerApp);
	app.route("/login", loginApp);

	testApp = app;
});

const env = { JWT_SECRET: TEST_JWT_SECRET };

describe("Admin Setup Journey", () => {
	let adminUserId: number;
	let accessToken: string;
	let secondUserId: number;
	let customRoleId: number;

	it("registers a new admin user", async () => {
		const res = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as { id: number; email: string };
		expect(body).toHaveProperty("id");
		expect(body.email).toBe("admin@example.com");
		adminUserId = body.id;
	});

	it("logs in and receives a JWT", async () => {
		// Register first
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		const res = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			access_token: string;
			refresh_token: string;
			token_type: string;
			expires_in: number;
		};
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.refresh_token).toEqual(expect.any(String));
		expect(body.token_type).toBe("Bearer");
		expect(body.expires_in).toBe(3600);
		accessToken = body.access_token;
	});

	it("seeds the admin role for the registered user", async () => {
		// Setup: register + login
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		const res = await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as { role: string; userId: number; permissions: string[] };
		expect(body.role).toBe("admin");
		expect(body.userId).toBe(adminUserId);
		expect(body.permissions).toContain("manage_roles");
		expect(body.permissions).toContain("manage_users");
	});

	it("returns 409 when seeding admin role again (idempotency check)", async () => {
		// Setup: register + first seed
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		const res = await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Admin role already exists");
	});

	it("lists roles including the seeded admin role with permissions", async () => {
		// Setup: register + login + seed
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		const loginRes = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		accessToken = ((await loginRes.json()) as { access_token: string }).access_token;

		const res = await testApp.request(
			"/roles",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			id: number;
			name: string;
			description: string | null;
			permissions: string[];
		}>;
		expect(body.length).toBeGreaterThanOrEqual(1);
		const adminRole = body.find((r) => r.name === "admin");
		expect(adminRole).toBeDefined();
		expect(adminRole!.permissions).toContain("manage_roles");
		expect(adminRole!.permissions).toContain("manage_users");
	});

	it("creates a new role and assigns a permission to it", async () => {
		// Setup: register + seed + login
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		const loginRes = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		accessToken = ((await loginRes.json()) as { access_token: string }).access_token;

		// Create a new role
		const createRes = await testApp.request(
			"/roles",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ name: "editor", description: "Content editor" }),
			},
			env,
		);

		expect(createRes.status).toBe(201);
		const role = (await createRes.json()) as { id: number; name: string; description: string };
		expect(role.name).toBe("editor");
		expect(role.description).toBe("Content editor");
		customRoleId = role.id;

		// Assign a permission to the role
		const permRes = await testApp.request(
			`/roles/${customRoleId}/permissions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ permission: "content:write" }),
			},
			env,
		);

		expect(permRes.status).toBe(200);
		const permBody = (await permRes.json()) as { roleId: number; permission: string };
		expect(permBody.roleId).toBe(customRoleId);
		expect(permBody.permission).toBe("content:write");
	});

	it("lists roles showing the new role with its permission", async () => {
		// Setup: register + seed + login + create role + assign perm
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		const loginRes = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		accessToken = ((await loginRes.json()) as { access_token: string }).access_token;

		const createRes = await testApp.request(
			"/roles",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ name: "editor", description: "Content editor" }),
			},
			env,
		);
		customRoleId = ((await createRes.json()) as { id: number }).id;

		await testApp.request(
			`/roles/${customRoleId}/permissions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ permission: "content:write" }),
			},
			env,
		);

		// List roles and verify
		const res = await testApp.request(
			"/roles",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			id: number;
			name: string;
			permissions: string[];
		}>;
		const editorRole = body.find((r) => r.name === "editor");
		expect(editorRole).toBeDefined();
		expect(editorRole!.permissions).toContain("content:write");
	});

	it("registers a second user, lists users, assigns role, and resolves permissions", async () => {
		// Setup: register admin + seed + login
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		const loginRes = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		accessToken = ((await loginRes.json()) as { access_token: string }).access_token;

		// Create a custom role with permission
		const createRoleRes = await testApp.request(
			"/roles",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ name: "editor", description: "Content editor" }),
			},
			env,
		);
		customRoleId = ((await createRoleRes.json()) as { id: number }).id;

		await testApp.request(
			`/roles/${customRoleId}/permissions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ permission: "content:write" }),
			},
			env,
		);

		// Register second user
		const reg2Res = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "editor@example.com", password: "editor-password-123" }),
			},
			env,
		);

		expect(reg2Res.status).toBe(201);
		secondUserId = ((await reg2Res.json()) as { id: number }).id;

		// List users — both should appear
		const listUsersRes = await testApp.request(
			"/users",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
			env,
		);

		expect(listUsersRes.status).toBe(200);
		const usersList = (await listUsersRes.json()) as Array<{ id: number; email: string }>;
		expect(usersList).toHaveLength(2);
		expect(usersList.find((u) => u.email === "admin@example.com")).toBeDefined();
		expect(usersList.find((u) => u.email === "editor@example.com")).toBeDefined();

		// Assign editor role to second user
		const assignRes = await testApp.request(
			`/users/${secondUserId}/roles`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ roleId: customRoleId }),
			},
			env,
		);

		expect(assignRes.status).toBe(200);
		const assignBody = (await assignRes.json()) as { userId: number; roleId: number };
		expect(assignBody).toEqual({ userId: secondUserId, roleId: customRoleId });

		// Resolve second user's permissions
		const permsRes = await testApp.request(
			`/users/${secondUserId}/permissions`,
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
			env,
		);

		expect(permsRes.status).toBe(200);
		const permsBody = (await permsRes.json()) as { permissions: string[] };
		expect(permsBody.permissions).toContain("content:write");
	});

	it("verifies admin user has manage_roles and manage_users permissions", async () => {
		// Setup: register + seed + login
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		adminUserId = ((await regRes.json()) as { id: number }).id;

		await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: adminUserId }),
			},
			env,
		);

		const loginRes = await testApp.request(
			"/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		accessToken = ((await loginRes.json()) as { access_token: string }).access_token;

		// Verify admin permissions
		const res = await testApp.request(
			`/users/${adminUserId}/permissions`,
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { permissions: string[] };
		expect(body.permissions).toContain("manage_roles");
		expect(body.permissions).toContain("manage_users");
	});
});
