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

const TEST_JWT_SECRET = "test-secret-for-user-roles";

let testApp: Hono;
let db: Database;
let validToken: string;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	// Seed admin user and permissions for the test JWT user (sub: "1")
	await db.run("INSERT INTO users (email, hashed_password, created_at, updated_at) VALUES ('seed@test.local', 'x', datetime('now'), datetime('now'))");
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

function postUserRoles(userId: number, body: unknown) {
	return testApp.request(
		`/users/${userId}/roles`,
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

function getUserPermissions(userId: number) {
	return testApp.request(
		`/users/${userId}/permissions`,
		{
			method: "GET",
			headers: { Authorization: `Bearer ${validToken}` },
		},
		{ JWT_SECRET: TEST_JWT_SECRET },
	);
}

async function createUser(email = "test@example.com"): Promise<number> {
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

describe("POST /users/:userId/roles", () => {
	it("returns 200 and assigns a role to a user", async () => {
		const userId = await createUser();
		const roleId = await createRoleWithPermissions("admin", ["users:read"]);

		const res = await postUserRoles(userId, { roleId });

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ userId, roleId });
	});

	it("returns 404 when userId does not exist", async () => {
		const roleId = await createRoleWithPermissions("admin", ["users:read"]);

		const res = await postUserRoles(9999, { roleId });

		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("User not found");
	});

	it("returns 404 when roleId does not exist", async () => {
		const userId = await createUser();

		const res = await postUserRoles(userId, { roleId: 9999 });

		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Role not found");
	});
});

describe("GET /users/:userId/permissions", () => {
	it("returns permissions and roles after assigning a role with permissions", async () => {
		const userId = await createUser();
		const roleId = await createRoleWithPermissions("admin", [
			"users:read",
			"users:write",
			"posts:read",
		]);
		await postUserRoles(userId, { roleId });

		const res = await getUserPermissions(userId);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			permissions: string[];
			roles: { id: number; name: string }[];
		};
		expect(body.permissions).toHaveLength(3);
		expect(body.permissions).toContain("users:read");
		expect(body.permissions).toContain("users:write");
		expect(body.permissions).toContain("posts:read");
		expect(body.roles).toHaveLength(1);
		expect(body.roles[0]).toEqual({ id: roleId, name: "admin" });
	});

	it("returns empty arrays for user with no roles", async () => {
		const userId = await createUser();

		const res = await getUserPermissions(userId);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			permissions: string[];
			roles: { id: number; name: string }[];
		};
		expect(body.permissions).toEqual([]);
		expect(body.roles).toEqual([]);
	});
});

function deleteUserRole(userId: number, roleId: number) {
	return testApp.request(
		`/users/${userId}/roles/${roleId}`,
		{
			method: "DELETE",
			headers: { Authorization: `Bearer ${validToken}` },
		},
		{ JWT_SECRET: TEST_JWT_SECRET },
	);
}

describe("DELETE /users/:userId/roles/:roleId", () => {
	it("returns 200 and removes the role assignment", async () => {
		const userId = await createUser();
		const roleId = await createRoleWithPermissions("admin", ["users:read"]);
		await postUserRoles(userId, { roleId });

		const res = await deleteUserRole(userId, roleId);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ message: "Role unassigned" });

		// Verify the role is actually removed by checking permissions
		const permRes = await getUserPermissions(userId);
		const permBody = (await permRes.json()) as { permissions: string[] };
		expect(permBody.permissions).toEqual([]);
	});

	it("returns 404 when userId does not exist", async () => {
		const res = await deleteUserRole(9999, 1);

		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("User not found");
	});

	it("returns 404 when role is not assigned to user", async () => {
		const userId = await createUser();
		const roleId = await createRoleWithPermissions("admin", ["users:read"]);

		const res = await deleteUserRole(userId, roleId);

		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Role not assigned to user");
	});
});

describe("Auth middleware on /users", () => {
	it("returns 401 for GET /users without Authorization header", async () => {
		const res = await testApp.request(
			"/users",
			{ method: "GET" },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for POST /users/:id/roles without Authorization header", async () => {
		const res = await testApp.request(
			"/users/1/roles",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ roleId: 1 }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for DELETE /users/:id/roles/:id without Authorization header", async () => {
		const res = await testApp.request(
			"/users/1/roles/1",
			{ method: "DELETE" },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for request with invalid JWT", async () => {
		const res = await testApp.request(
			"/users",
			{
				method: "GET",
				headers: { Authorization: "Bearer invalid.token.here" },
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Invalid token");
	});
});

describe("Authorization on /users", () => {
	let noPermToken: string;

	beforeEach(async () => {
		noPermToken = await signJwt({ sub: "999" }, TEST_JWT_SECRET);
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

	it("returns 403 for POST /users/:id/roles without manage_users permission", async () => {
		const res = await testApp.request(
			"/users/1/roles",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${noPermToken}`,
				},
				body: JSON.stringify({ roleId: 1 }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("returns 403 for DELETE /users/:id/roles/:id without manage_users permission", async () => {
		const res = await testApp.request(
			"/users/1/roles/1",
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${noPermToken}` },
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("returns 403 for GET /users/:id/permissions without manage_users permission", async () => {
		const res = await testApp.request(
			"/users/1/permissions",
			{ method: "GET", headers: { Authorization: `Bearer ${noPermToken}` } },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});
});
