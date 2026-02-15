import { Hono } from "hono";
import { createDatabase } from "./db/client";
import type { Database } from "./db/client";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", async (c, next) => {
	const db = createDatabase({
		url: c.env.TURSO_DATABASE_URL,
		authToken: c.env.TURSO_AUTH_TOKEN,
	});
	c.set("db", db);
	await next();
});

app.get("/health", (c) => {
	return c.json({ status: "ok" });
});

export default app;
