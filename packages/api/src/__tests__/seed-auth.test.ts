import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import registerApp from "../auth/register";
import { type Database, createDatabase } from "../db/client";
import seedApp from "../rbac/seed";

const CREATE_TABLES = `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		hashed_password TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
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

const TEST_JWT_SECRET = "test-secret-for-seed-auth";
const TEST_SETUP_TOKEN = "test-setup-token-for-seed-auth";

let testApp: Hono;
let db: Database;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<{
		Bindings: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN?: string; JWT_SECRET: string; ADMIN_SETUP_TOKEN?: string };
		Variables: { db: Database };
	}>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	app.route("/register", registerApp);
	app.route("/seed", seedApp);

	testApp = app;
});

const env = { JWT_SECRET: TEST_JWT_SECRET, ADMIN_SETUP_TOKEN: TEST_SETUP_TOKEN };

describe("Seed endpoint authentication", () => {
	it("returns 401 when no X-Setup-Token header is provided", async () => {
		const res = await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: 1 }),
			},
			env,
		);

		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Invalid setup token");
	});

	it("returns 401 when wrong X-Setup-Token is provided", async () => {
		const res = await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", "X-Setup-Token": "wrong-token" },
				body: JSON.stringify({ userId: 1 }),
			},
			env,
		);

		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Invalid setup token");
	});

	it("returns 401 when ADMIN_SETUP_TOKEN is not configured in environment", async () => {
		const envWithoutToken = { JWT_SECRET: TEST_JWT_SECRET };

		const res = await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", "X-Setup-Token": "any-token" },
				body: JSON.stringify({ userId: 1 }),
			},
			envWithoutToken,
		);

		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Invalid setup token");
	});

	it("succeeds with correct X-Setup-Token", async () => {
		// Register a user first
		const regRes = await testApp.request(
			"/register",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@example.com", password: "admin-password-123" }),
			},
			env,
		);
		const { id: userId } = (await regRes.json()) as { id: number };

		const res = await testApp.request(
			"/seed",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", "X-Setup-Token": TEST_SETUP_TOKEN },
				body: JSON.stringify({ userId }),
			},
			env,
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as { role: string; userId: number; permissions: string[] };
		expect(body.role).toBe("admin");
		expect(body.userId).toBe(userId);
		expect(body.permissions).toContain("manage_roles");
		expect(body.permissions).toContain("manage_users");
	});
});
