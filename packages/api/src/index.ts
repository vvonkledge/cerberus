import { Hono } from "hono";
import login from "./auth/login";
import refresh from "./auth/refresh";
import register from "./auth/register";
import revoke from "./auth/revoke";
import { createDatabase } from "./db/client";
import type { Database } from "./db/client";
import { authMiddleware } from "./middleware/auth";
import { requirePermission } from "./middleware/authorization";
import {
	InMemoryRateLimitStore,
	KVRateLimitStore,
	rateLimiter,
} from "./middleware/rate-limiter";
import roles from "./rbac/roles";
import seed from "./rbac/seed";
import userRoles from "./rbac/user-roles";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
	RATE_LIMIT_KV?: KVNamespace;
};

type Variables = {
	db: Database;
	user: { sub: string; iat: number; exp: number };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Fallback in-memory store used when KV is not available (e.g. tests)
const fallbackStore = new InMemoryRateLimitStore();

app.use("*", async (c, next) => {
	if (c.env.TURSO_DATABASE_URL) {
		const db = createDatabase({
			url: c.env.TURSO_DATABASE_URL,
			authToken: c.env.TURSO_AUTH_TOKEN,
		});
		c.set("db", db);
	}
	await next();
});

app.get("/health", async (c) => {
	const db = c.get("db");
	if (!db) {
		return c.json({ status: "ok", db: "not_configured" });
	}
	try {
		await db.run("SELECT 1");
		return c.json({ status: "ok", db: "ok" });
	} catch {
		return c.json({ status: "ok", db: "error" }, 500);
	}
});

function getStore(env: { RATE_LIMIT_KV?: KVNamespace }) {
	if (env.RATE_LIMIT_KV) {
		return new KVRateLimitStore(env.RATE_LIMIT_KV);
	}
	return fallbackStore;
}

// Rate-limited auth routes
const loginApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
loginApp.use("*", async (c, next) => {
	const store = getStore(c.env);
	const mw = rateLimiter({ limit: 10, windowMs: 60_000, store });
	return mw(c, next);
});
loginApp.route("/", login);

const registerApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
registerApp.use("*", async (c, next) => {
	const store = getStore(c.env);
	const mw = rateLimiter({ limit: 5, windowMs: 60_000, store });
	return mw(c, next);
});
registerApp.route("/", register);

const refreshApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
refreshApp.use("*", async (c, next) => {
	const store = getStore(c.env);
	const mw = rateLimiter({ limit: 10, windowMs: 60_000, store });
	return mw(c, next);
});
refreshApp.route("/", refresh);

app.route("/register", registerApp);
app.route("/login", loginApp);
app.route("/refresh", refreshApp);
app.route("/revoke", revoke);

// Auth-protected RBAC routes
const rolesApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
rolesApp.use("*", authMiddleware());
rolesApp.use("*", requirePermission("manage_roles"));
rolesApp.route("/", roles);

const usersApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
usersApp.use("*", authMiddleware());
usersApp.use("*", requirePermission("manage_users"));
usersApp.route("/", userRoles);

app.route("/roles", rolesApp);
app.route("/users", usersApp);

// Bootstrap seed route (no auth required)
app.route("/seed", seed);

app.get("*", async (c) => {
	return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
