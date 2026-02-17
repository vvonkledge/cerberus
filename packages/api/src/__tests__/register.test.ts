import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import registerApp from "../auth/register";
import { type Database, createDatabase } from "../db/client";

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
	app.route("/register", registerApp);
	testApp = app;
});

function registerRequest(body: unknown) {
	return testApp.request("/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /register", () => {
	it("returns 201 and creates a user with valid email and password", async () => {
		const res = await registerRequest({
			email: "test@example.com",
			password: "securepassword123",
		});

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body).toHaveProperty("id");
		expect(body.email).toBe("test@example.com");
		expect(body).not.toHaveProperty("password");
		expect(body).not.toHaveProperty("hashedPassword");
	});

	it("returns 409 when registering a duplicate email", async () => {
		const first = await registerRequest({
			email: "dupe@example.com",
			password: "password123",
		});
		expect(first.status).toBe(201);

		const second = await registerRequest({
			email: "dupe@example.com",
			password: "differentpassword",
		});
		expect(second.status).toBe(409);
	});

	it("returns 400 when email is missing", async () => {
		const res = await registerRequest({ password: "password123" });
		expect(res.status).toBe(400);
	});

	it("returns 400 when password is missing", async () => {
		const res = await registerRequest({ email: "test@example.com" });
		expect(res.status).toBe(400);
	});
});
