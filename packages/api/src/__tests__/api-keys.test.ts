import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import loginApp from "../auth/login";
import registerApp from "../auth/register";
import { type Database, createDatabase } from "../db/client";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/authorization";
import apiKeysRoute from "../rbac/api-keys";
import auditLogsRoute from "../rbac/audit-logs";
import rolesRoute from "../rbac/roles";
import seedApp from "../rbac/seed";
import userRolesRoute from "../rbac/user-roles";

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
	CREATE TABLE api_keys (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		name TEXT NOT NULL,
		key_hash TEXT NOT NULL UNIQUE,
		key_prefix TEXT NOT NULL,
		created_at TEXT NOT NULL,
		revoked_at TEXT
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

const TEST_JWT_SECRET = "test-secret-for-api-keys";

let testApp: Hono;
let db: Database;

beforeEach(async () => {
	db = createDatabase({ url: "file::memory:" });
	for (const stmt of CREATE_TABLES.split(";").filter((s) => s.trim())) {
		await db.run(stmt);
	}

	const app = new Hono<{
		Bindings: {
			TURSO_DATABASE_URL: string;
			TURSO_AUTH_TOKEN?: string;
			JWT_SECRET: string;
		};
		Variables: {
			db: Database;
			user: { sub: string; iat: number; exp: number };
		};
	}>();
	app.use("*", async (c, next) => {
		c.set("db", db);
		await next();
	});

	// Protected API keys routes
	const protectedApiKeys = new Hono<{
		Bindings: {
			TURSO_DATABASE_URL: string;
			TURSO_AUTH_TOKEN?: string;
			JWT_SECRET: string;
		};
		Variables: {
			db: Database;
			user: { sub: string; iat: number; exp: number };
		};
	}>();
	protectedApiKeys.use("*", authMiddleware());
	protectedApiKeys.route("/", apiKeysRoute);

	// Protected roles routes
	const protectedRoles = new Hono<{
		Bindings: {
			TURSO_DATABASE_URL: string;
			TURSO_AUTH_TOKEN?: string;
			JWT_SECRET: string;
		};
		Variables: {
			db: Database;
			user: { sub: string; iat: number; exp: number };
		};
	}>();
	protectedRoles.use("*", authMiddleware());
	protectedRoles.use("*", requirePermission("manage_roles"));
	protectedRoles.route("/", rolesRoute);

	// Protected audit-logs routes
	const protectedAuditLogs = new Hono<{
		Bindings: {
			TURSO_DATABASE_URL: string;
			TURSO_AUTH_TOKEN?: string;
			JWT_SECRET: string;
		};
		Variables: {
			db: Database;
			user: { sub: string; iat: number; exp: number };
		};
	}>();
	protectedAuditLogs.use("*", authMiddleware());
	protectedAuditLogs.use("*", requirePermission("manage_users"));
	protectedAuditLogs.route("/", auditLogsRoute);

	// Protected users routes
	const protectedUsers = new Hono<{
		Bindings: {
			TURSO_DATABASE_URL: string;
			TURSO_AUTH_TOKEN?: string;
			JWT_SECRET: string;
		};
		Variables: {
			db: Database;
			user: { sub: string; iat: number; exp: number };
		};
	}>();
	protectedUsers.use("*", authMiddleware());
	protectedUsers.use("*", requirePermission("manage_users"));
	protectedUsers.route("/", userRolesRoute);

	app.route("/register", registerApp);
	app.route("/login", loginApp);
	app.route("/api-keys", protectedApiKeys);
	app.route("/roles", protectedRoles);
	app.route("/audit-logs", protectedAuditLogs);
	app.route("/users", protectedUsers);
	app.route("/seed", seedApp);

	testApp = app;
});

const TEST_SETUP_TOKEN = "test-setup-token-for-api-keys";
const env = { JWT_SECRET: TEST_JWT_SECRET, ADMIN_SETUP_TOKEN: TEST_SETUP_TOKEN };

async function registerUser(
	email = "user@example.com",
	password = "password123",
) {
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

describe("API key management", () => {
	describe("POST /api-keys", () => {
		it("creates an API key and returns it", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const res = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "my-service-key" }),
				},
				env,
			);

			expect(res.status).toBe(201);
			const body = (await res.json()) as {
				id: number;
				name: string;
				keyPrefix: string;
				key: string;
			};
			expect(body).toHaveProperty("id");
			expect(body).toHaveProperty("name");
			expect(body).toHaveProperty("keyPrefix");
			expect(body).toHaveProperty("key");
			expect(body.name).toBe("my-service-key");
			expect(body.key.startsWith("crb_")).toBe(true);
			expect(body.keyPrefix).toBe(body.key.substring(0, 8));
		});

		it("creates unique keys for different names", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const res1 = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "key-one" }),
				},
				env,
			);
			const body1 = (await res1.json()) as { key: string };

			const res2 = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "key-two" }),
				},
				env,
			);
			const body2 = (await res2.json()) as { key: string };

			expect(body1.key).not.toBe(body2.key);
		});

		it("returns 400 if name is missing", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const res = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({}),
				},
				env,
			);

			expect(res.status).toBe(400);
		});

		it("returns 401 without auth", async () => {
			const res = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "my-key" }),
				},
				env,
			);

			expect(res.status).toBe(401);
		});
	});

	describe("GET /api-keys", () => {
		it("lists all keys for authenticated user", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "key-one" }),
				},
				env,
			);
			await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "key-two" }),
				},
				env,
			);

			const res = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = (await res.json()) as Array<{
				id: number;
				name: string;
				keyPrefix: string;
				createdAt: string;
			}>;
			expect(body).toHaveLength(2);
			for (const entry of body) {
				expect(entry).toHaveProperty("id");
				expect(entry).toHaveProperty("name");
				expect(entry).toHaveProperty("keyPrefix");
				expect(entry).toHaveProperty("createdAt");
				expect(entry).not.toHaveProperty("key");
				expect(entry).not.toHaveProperty("keyHash");
			}
		});

		it("returns empty array when user has no keys", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const res = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = (await res.json()) as unknown[];
			expect(body).toHaveLength(0);
		});

		it("does not show keys from other users", async () => {
			await registerUser("alice@example.com", "password123");
			const { body: aliceLogin } = await loginUser(
				"alice@example.com",
				"password123",
			);

			await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${aliceLogin.access_token}`,
					},
					body: JSON.stringify({ name: "alice-key" }),
				},
				env,
			);

			await registerUser("bob@example.com", "password123");
			const { body: bobLogin } = await loginUser(
				"bob@example.com",
				"password123",
			);

			await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${bobLogin.access_token}`,
					},
					body: JSON.stringify({ name: "bob-key" }),
				},
				env,
			);

			const aliceRes = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${aliceLogin.access_token}` },
				},
				env,
			);
			const aliceKeys = (await aliceRes.json()) as Array<{ name: string }>;
			expect(aliceKeys).toHaveLength(1);
			expect(aliceKeys[0].name).toBe("alice-key");

			const bobRes = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${bobLogin.access_token}` },
				},
				env,
			);
			const bobKeys = (await bobRes.json()) as Array<{ name: string }>;
			expect(bobKeys).toHaveLength(1);
			expect(bobKeys[0].name).toBe("bob-key");
		});
	});

	describe("DELETE /api-keys/:keyId", () => {
		it("revokes a key", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "to-revoke" }),
				},
				env,
			);
			const { id } = (await createRes.json()) as { id: number };

			const res = await testApp.request(
				`/api-keys/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = (await res.json()) as { message: string };
			expect(body.message).toBe("API key revoked");
		});

		it("shows revokedAt after revocation", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "to-check-revoked" }),
				},
				env,
			);
			const { id } = (await createRes.json()) as { id: number };

			await testApp.request(
				`/api-keys/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			const listRes = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);
			const keys = (await listRes.json()) as Array<{
				id: number;
				revokedAt: string | null;
			}>;
			const revokedKey = keys.find((k) => k.id === id);
			expect(revokedKey).toBeDefined();
			expect(revokedKey?.revokedAt).not.toBeNull();
		});

		it("returns 404 for another user's key", async () => {
			await registerUser("alice@example.com", "password123");
			const { body: aliceLogin } = await loginUser(
				"alice@example.com",
				"password123",
			);

			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${aliceLogin.access_token}`,
					},
					body: JSON.stringify({ name: "alice-key" }),
				},
				env,
			);
			const { id } = (await createRes.json()) as { id: number };

			await registerUser("bob@example.com", "password123");
			const { body: bobLogin } = await loginUser(
				"bob@example.com",
				"password123",
			);

			const res = await testApp.request(
				`/api-keys/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${bobLogin.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(404);
		});

		it("returns 404 for non-existent key", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const res = await testApp.request(
				"/api-keys/99999",
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(404);
		});
	});

	describe("API key authentication", () => {
		it("authenticates with valid API key", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "auth-test-key" }),
				},
				env,
			);
			const { key } = (await createRes.json()) as { key: string };

			const res = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${key}` },
				},
				env,
			);

			expect(res.status).toBe(200);
			const keys = (await res.json()) as Array<{ name: string }>;
			expect(keys.length).toBeGreaterThanOrEqual(1);
		});

		it("rejects revoked API key", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "revoke-test-key" }),
				},
				env,
			);
			const { id, key } = (await createRes.json()) as {
				id: number;
				key: string;
			};

			await testApp.request(
				`/api-keys/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			const res = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${key}` },
				},
				env,
			);

			expect(res.status).toBe(401);
		});

		it("rejects invalid API key", async () => {
			await registerUser();

			const res = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: "Bearer crb_invalidkeythatdoesnotexist" },
				},
				env,
			);

			expect(res.status).toBe(401);
		});

		it("JWT auth still works alongside API key auth", async () => {
			await registerUser();
			const { body: loginBody } = await loginUser();

			// Create a key via JWT
			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "dual-auth-test" }),
				},
				env,
			);
			const { key } = (await createRes.json()) as { key: string };

			// List via JWT
			const jwtRes = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);
			expect(jwtRes.status).toBe(200);

			// List via API key
			const apiKeyRes = await testApp.request(
				"/api-keys",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${key}` },
				},
				env,
			);
			expect(apiKeyRes.status).toBe(200);

			const jwtKeys = (await jwtRes.json()) as unknown[];
			const apiKeyKeys = (await apiKeyRes.json()) as unknown[];
			expect(jwtKeys).toHaveLength(apiKeyKeys.length);
		});
	});

	describe("Audit logging", () => {
		it("logs api_key_created event", async () => {
			const { body: regBody } = await registerUser(
				"admin@example.com",
				"admin-pass-123",
			);

			await testApp.request(
				"/seed",
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "X-Setup-Token": TEST_SETUP_TOKEN },
					body: JSON.stringify({ userId: regBody.id }),
				},
				env,
			);

			const { body: loginBody } = await loginUser(
				"admin@example.com",
				"admin-pass-123",
			);

			await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "audit-test-key" }),
				},
				env,
			);

			const res = await testApp.request(
				"/audit-logs?event_type=api_key_created",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = (await res.json()) as {
				data: Array<{
					eventType: string;
					userId: string;
					metadata: string;
				}>;
				pagination: { total: number };
			};
			expect(body.data).toHaveLength(1);
			expect(body.data[0].eventType).toBe("api_key_created");
			expect(body.data[0].userId).toBe(String(regBody.id));
			const metadata = JSON.parse(body.data[0].metadata);
			expect(metadata.name).toBe("audit-test-key");
			expect(metadata.keyPrefix).toBeTruthy();
		});

		it("logs api_key_revoked event", async () => {
			const { body: regBody } = await registerUser(
				"admin@example.com",
				"admin-pass-123",
			);

			await testApp.request(
				"/seed",
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "X-Setup-Token": TEST_SETUP_TOKEN },
					body: JSON.stringify({ userId: regBody.id }),
				},
				env,
			);

			const { body: loginBody } = await loginUser(
				"admin@example.com",
				"admin-pass-123",
			);

			const createRes = await testApp.request(
				"/api-keys",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${loginBody.access_token}`,
					},
					body: JSON.stringify({ name: "revoke-audit-key" }),
				},
				env,
			);
			const { id, keyPrefix } = (await createRes.json()) as {
				id: number;
				keyPrefix: string;
			};

			await testApp.request(
				`/api-keys/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			const res = await testApp.request(
				"/audit-logs?event_type=api_key_revoked",
				{
					method: "GET",
					headers: { Authorization: `Bearer ${loginBody.access_token}` },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = (await res.json()) as {
				data: Array<{
					eventType: string;
					userId: string;
					metadata: string;
				}>;
				pagination: { total: number };
			};
			expect(body.data).toHaveLength(1);
			expect(body.data[0].eventType).toBe("api_key_revoked");
			const metadata = JSON.parse(body.data[0].metadata);
			expect(metadata.keyId).toBe(id);
			expect(metadata.keyPrefix).toBe(keyPrefix);
		});
	});
});
