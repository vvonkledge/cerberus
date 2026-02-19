import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { refreshTokens } from "../db/schema";
import { getClientIp, writeAuditLog } from "../middleware/audit";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
};

type Variables = {
	db: Database;
};

const revoke = new Hono<{ Bindings: Bindings; Variables: Variables }>();

revoke.post("/", async (c) => {
	const body = await c.req.json();
	const { refresh_token } = body;

	if (!refresh_token) {
		return c.json({ error: "Missing refresh_token" }, 400);
	}

	const db = c.get("db");
	const [row] = await db
		.select()
		.from(refreshTokens)
		.where(eq(refreshTokens.token, refresh_token));

	if (!row) {
		return c.json({ error: "Invalid refresh token" }, 401);
	}

	await db
		.update(refreshTokens)
		.set({ revokedAt: new Date().toISOString() })
		.where(eq(refreshTokens.token, refresh_token));

	await writeAuditLog(db, {
		eventType: "revoke",
		userId: String(row.userId),
		ipAddress: getClientIp(c),
	});

	return c.json({ message: "Token revoked" });
});

export default revoke;
