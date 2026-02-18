import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { signJwt } from "../auth/crypto";
import { type Database, createDatabase } from "../db/client";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/authorization";
import { users } from "../db/schema";
import rolesApp from "../rbac/roles";
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

const TEST_JWT_SECRET = "test-secret-for-list";

let testApp: Hono;
let db: Database;
let validToken: string;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	// Seed admin role and permissions for the test user (sub: "1")
	await db.run("INSERT INTO roles (name, description, created_at) VALUES ('__seed__', 'Seed', datetime('now'))");
	await db.run("INSERT INTO permissions (permission, created_at) VALUES ('manage_roles', datetime('now'))");
	await db.run("INSERT INTO permissions (permission, created_at) VALUES ('manage_users', datetime('now'))");
	await db.run("INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (1, 1, datetime('now'))");
	await db.run("INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (1, 2, datetime('now'))");
	await db.run("INSERT INTO user_roles (user_id, role_id, created_at) VALUES (1, 1, datetime('now'))");

	validToken = await signJwt({ sub: "1" }, TEST_JWT_SECRET);

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});
	const protectedRoles = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	protectedRoles.use("*", authMiddleware());
	protectedRoles.use("*", requirePermission("manage_roles"));
	protectedRoles.route("/", rolesApp);

	const protectedUsers = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string };
		Variables: { db: Database; user: { sub: string; iat: number; exp: number } };
	}>();
	protectedUsers.use("*", authMiddleware());
	protectedUsers.use("*", requirePermission("manage_users"));
	protectedUsers.route("/", userRolesApp);

	app.route("/roles", protectedRoles);
	app.route("/users", protectedUsers);
	testApp = app;
});

function postRoles(path: string, body: unknown) {
	return testApp.request(
		`/roles${path}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${validToken}`,
			},
			body: JSON.stringify(body),
		},
		{ JWT_SECRET: TEST_JWT_SECRET },
	);
}

async function createUser(email: string): Promise<number> {
	const result = await db
		.insert(users)
		.values({ email, hashedPassword: "hashed" });
	return Number(result.lastInsertRowid);
}

async function createRoleWithPermissions(
	roleName: string,
	perms: string[],
): Promise<number> {
	const roleRes = await postRoles("", {
		name: roleName,
		description: `${roleName} role`,
	});
	const role = (await roleRes.json()) as { id: number };
	for (const perm of perms) {
		await postRoles(`/${role.id}/permissions`, { permission: perm });
	}
	return role.id;
}

describe("GET /roles", () => {
	it("returns the seeded admin role when no additional roles created", async () => {
		const res = await testApp.request(
			"/roles",
			{ method: "GET", headers: { Authorization: `Bearer ${validToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			name: string;
			permissions: string[];
		}>;
		expect(body).toHaveLength(1);
		expect(body[0].name).toBe("__seed__");
	});

	it("returns roles with their permissions", async () => {
		await createRoleWithPermissions("admin", ["users:read", "users:write"]);
		await createRoleWithPermissions("viewer", ["users:read"]);

		const res = await testApp.request(
			"/roles",
			{ method: "GET", headers: { Authorization: `Bearer ${validToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			id: number;
			name: string;
			description: string | null;
			permissions: string[];
		}>;
		expect(body).toHaveLength(3);

		const admin = body.find((r) => r.name === "admin");
		expect(admin).toBeDefined();
		expect(admin!.permissions).toHaveLength(2);
		expect(admin!.permissions).toContain("users:read");
		expect(admin!.permissions).toContain("users:write");

		const viewer = body.find((r) => r.name === "viewer");
		expect(viewer).toBeDefined();
		expect(viewer!.permissions).toEqual(["users:read"]);
	});

	it("returns role with empty permissions when none assigned", async () => {
		await postRoles("", { name: "empty-role", description: "No perms" });

		const res = await testApp.request(
			"/roles",
			{ method: "GET", headers: { Authorization: `Bearer ${validToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			name: string;
			permissions: string[];
		}>;
		expect(body).toHaveLength(2);
		const emptyRole = body.find((r) => r.name === "empty-role");
		expect(emptyRole).toBeDefined();
		expect(emptyRole!.permissions).toEqual([]);
	});
});

describe("GET /users", () => {
	it("returns empty array when no users exist", async () => {
		const res = await testApp.request(
			"/users",
			{ method: "GET", headers: { Authorization: `Bearer ${validToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual([]);
	});

	it("returns all users with id and email only", async () => {
		await createUser("alice@example.com");
		await createUser("bob@example.com");

		const res = await testApp.request(
			"/users",
			{ method: "GET", headers: { Authorization: `Bearer ${validToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: number; email: string }>;
		expect(body).toHaveLength(2);
		expect(body[0]).toEqual({ id: 1, email: "alice@example.com" });
		expect(body[1]).toEqual({ id: 2, email: "bob@example.com" });
		// Ensure no extra fields like hashed_password are returned
		expect(body[0]).not.toHaveProperty("hashedPassword");
		expect(body[0]).not.toHaveProperty("hashed_password");
	});
});

describe("Authorization on list endpoints", () => {
	let noPermToken: string;

	beforeEach(async () => {
		noPermToken = await signJwt({ sub: "999" }, TEST_JWT_SECRET);
	});

	it("returns 403 for GET /roles without manage_roles permission", async () => {
		const res = await testApp.request(
			"/roles",
			{ method: "GET", headers: { Authorization: `Bearer ${noPermToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("returns 403 for GET /users without manage_users permission", async () => {
		const res = await testApp.request(
			"/users",
			{ method: "GET", headers: { Authorization: `Bearer ${noPermToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});
});
