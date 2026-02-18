import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { type Database, createDatabase } from "../db/client";
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
	testApp = app;
});

function rolesRequest(path: string, body: unknown) {
	return testApp.request(`/roles${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
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
