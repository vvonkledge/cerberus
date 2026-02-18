import { Hono } from "hono";
import login from "./auth/login";
import refresh from "./auth/refresh";
import register from "./auth/register";
import revoke from "./auth/revoke";
import { createDatabase } from "./db/client";
import type { Database } from "./db/client";
import roles from "./rbac/roles";
import userRoles from "./rbac/user-roles";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
};

type Variables = {
	db: Database;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

app.route("/register", register);
app.route("/login", login);
app.route("/refresh", refresh);
app.route("/revoke", revoke);
app.route("/roles", roles);
app.route("/users", userRoles);

app.get("*", async (c) => {
	return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
