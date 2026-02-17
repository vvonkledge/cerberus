import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { refreshTokens } from "../db/schema";
import { signJwt } from "./crypto";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
};

type Variables = {
	db: Database;
};

const refresh = new Hono<{ Bindings: Bindings; Variables: Variables }>();

refresh.post("/", async (c) => {
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

	if (row.revokedAt !== null) {
		return c.json({ error: "Refresh token revoked" }, 401);
	}

	if (row.expiresAt < new Date().toISOString()) {
		return c.json({ error: "Refresh token expired" }, 401);
	}

	const token = await signJwt({ sub: String(row.userId) }, c.env.JWT_SECRET);

	return c.json({
		access_token: token,
		token_type: "Bearer",
		expires_in: 3600,
	});
});

export default refresh;
