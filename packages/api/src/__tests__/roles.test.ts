import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { signJwt } from "../auth/crypto";
import { type Database, createDatabase } from "../db/client";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/authorization";
import rolesApp from "../rbac/roles";

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

const TEST_JWT_SECRET = "test-secret-for-roles";

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
	app.route("/roles", protectedRoles);
	testApp = app;
});

function rolesRequest(path: string, body: unknown) {
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

function rolesPutRequest(path: string, body: unknown) {
	return testApp.request(
		`/roles${path}`,
		{
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${validToken}`,
			},
			body: JSON.stringify(body),
		},
		{ JWT_SECRET: TEST_JWT_SECRET },
	);
}

function rolesDeleteRequest(path: string) {
	return testApp.request(
		`/roles${path}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${validToken}`,
			},
		},
		{ JWT_SECRET: TEST_JWT_SECRET },
	);
}

describe("POST /roles", () => {
	it("returns 201 and creates a role with valid name and description", async () => {
		const res = await rolesRequest("", {
			name: "admin",
			description: "Administrator",
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body).toHaveProperty("id");
		expect(body.name).toBe("admin");
		expect(body.description).toBe("Administrator");
	});

	it("returns 409 when creating a role with duplicate name", async () => {
		const first = await rolesRequest("", {
			name: "admin",
			description: "Administrator",
		});
		expect(first.status).toBe(201);

		const second = await rolesRequest("", {
			name: "admin",
			description: "Different description",
		});
		expect(second.status).toBe(409);
	});

	it("returns 400 when name is missing", async () => {
		const res = await rolesRequest("", { description: "No name" });
		expect(res.status).toBe(400);
	});
});

describe("POST /roles/:roleId/permissions", () => {
	it("returns 200 and assigns a permission to a role", async () => {
		const roleRes = await rolesRequest("", {
			name: "admin",
			description: "Administrator",
		});
		const role = await roleRes.json();

		const res = await rolesRequest(`/${role.id}/permissions`, {
			permission: "users:read",
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.roleId).toBe(role.id);
		expect(body.permission).toBe("users:read");
	});

	it("returns 404 when roleId does not exist", async () => {
		const res = await rolesRequest("/9999/permissions", {
			permission: "users:read",
		});

		expect(res.status).toBe(404);
	});
});

describe("PUT /roles/:roleId", () => {
	it("returns 200 and updates the role name", async () => {
		const createRes = await rolesRequest("", {
			name: "editor",
			description: "Editor role",
		});
		const created = await createRes.json();

		const res = await rolesPutRequest(`/${created.id}`, { name: "reviewer" });

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe(created.id);
		expect(body.name).toBe("reviewer");
		expect(body.description).toBe("Editor role");
	});

	it("returns 400 when name is missing", async () => {
		const createRes = await rolesRequest("", {
			name: "editor",
			description: "Editor role",
		});
		const created = await createRes.json();

		const res = await rolesPutRequest(`/${created.id}`, {});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Name is required");
	});

	it("returns 400 when name is empty string", async () => {
		const createRes = await rolesRequest("", {
			name: "editor",
			description: "Editor role",
		});
		const created = await createRes.json();

		const res = await rolesPutRequest(`/${created.id}`, { name: "" });

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Name is required");
	});

	it("returns 404 when role does not exist", async () => {
		const res = await rolesPutRequest("/9999", { name: "ghost" });

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Role not found");
	});
});

describe("DELETE /roles/:roleId", () => {
	it("returns 200 and deletes the role", async () => {
		const createRes = await rolesRequest("", {
			name: "temp-role",
			description: "Temporary",
		});
		const created = await createRes.json();

		const res = await rolesDeleteRequest(`/${created.id}`);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.message).toBe("Role deleted");
	});

	it("returns 404 when role does not exist", async () => {
		const res = await rolesDeleteRequest("/9999");

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBe("Role not found");
	});

	it("returns 409 when role is assigned to users", async () => {
		// The seed data assigns role 1 (__seed__) to user 1 via user_roles
		const res = await rolesDeleteRequest("/1");

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toBe("Role is still assigned to users");
	});

	it("also cleans up role_permissions when deleting", async () => {
		const createRes = await rolesRequest("", {
			name: "perm-role",
			description: "Has permissions",
		});
		const created = await createRes.json();

		// Assign a permission to this role
		await rolesRequest(`/${created.id}/permissions`, {
			permission: "test:delete",
		});

		const deleteRes = await rolesDeleteRequest(`/${created.id}`);
		expect(deleteRes.status).toBe(200);

		// Verify role_permissions were cleaned up by checking GET /roles
		const listRes = await testApp.request(
			"/roles",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${validToken}` },
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		const allRoles = await listRes.json();
		const deletedRole = (allRoles as Array<{ id: number }>).find(
			(r) => r.id === created.id,
		);
		expect(deletedRole).toBeUndefined();
	});
});

describe("Auth middleware on /roles", () => {
	it("returns 401 for GET /roles without Authorization header", async () => {
		const res = await testApp.request(
			"/roles",
			{ method: "GET" },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for POST /roles without Authorization header", async () => {
		const res = await testApp.request(
			"/roles",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "admin", description: "Admin" }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for DELETE /roles/:id without Authorization header", async () => {
		const res = await testApp.request(
			"/roles/1",
			{ method: "DELETE" },
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for PUT /roles/:id without Authorization header", async () => {
		const res = await testApp.request(
			"/roles/1",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "new-name" }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Authorization required");
	});

	it("returns 401 for request with invalid JWT", async () => {
		const res = await testApp.request(
			"/roles",
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

describe("Authorization on /roles", () => {
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

	it("returns 403 for POST /roles without manage_roles permission", async () => {
		const res = await testApp.request(
			"/roles",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${noPermToken}`,
				},
				body: JSON.stringify({ name: "test", description: "Test" }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("returns 403 for POST /roles/:id/permissions without manage_roles permission", async () => {
		const res = await testApp.request(
			"/roles/1/permissions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${noPermToken}`,
				},
				body: JSON.stringify({ permission: "test:read" }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("returns 403 for DELETE /roles/:id without manage_roles permission", async () => {
		const res = await testApp.request(
			"/roles/1",
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

	it("returns 403 for PUT /roles/:id without manage_roles permission", async () => {
		const res = await testApp.request(
			"/roles/1",
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${noPermToken}`,
				},
				body: JSON.stringify({ name: "hacked" }),
			},
			{ JWT_SECRET: TEST_JWT_SECRET },
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});
});
