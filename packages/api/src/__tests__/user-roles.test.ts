import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { type Database, createDatabase } from "../db/client";
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

let testApp: Hono;
let db: Database;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string };
		Variables: { db: Database };
	}>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});
	app.route("/roles", rolesApp);
	app.route("/users", userRolesApp);
	testApp = app;
});

function postRoles(path: string, body: unknown) {
	return testApp.request(`/roles${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function postUserRoles(userId: number, body: unknown) {
	return testApp.request(`/users/${userId}/roles`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function getUserPermissions(userId: number) {
	return testApp.request(`/users/${userId}/permissions`, {
		method: "GET",
	});
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
	it("returns permissions array after assigning a role with permissions", async () => {
		const userId = await createUser();
		const roleId = await createRoleWithPermissions("admin", [
			"users:read",
			"users:write",
			"posts:read",
		]);
		await postUserRoles(userId, { roleId });

		const res = await getUserPermissions(userId);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { permissions: string[] };
		expect(body.permissions).toHaveLength(3);
		expect(body.permissions).toContain("users:read");
		expect(body.permissions).toContain("users:write");
		expect(body.permissions).toContain("posts:read");
	});

	it("returns empty array for user with no roles", async () => {
		const userId = await createUser();

		const res = await getUserPermissions(userId);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { permissions: string[] };
		expect(body.permissions).toEqual([]);
	});
});
