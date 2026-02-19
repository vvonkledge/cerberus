import { and, eq, isNotNull, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { refreshTokens } from "../db/schema";
import { getClientIp, writeAuditLog } from "../middleware/audit";
import { generateRefreshToken, signJwt } from "./crypto";

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

	// Revoke the old refresh token
	await db
		.update(refreshTokens)
		.set({ revokedAt: new Date().toISOString() })
		.where(eq(refreshTokens.token, refresh_token));

	// Generate and store a new refresh token
	const newRefreshToken = generateRefreshToken();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
	await db.insert(refreshTokens).values({
		token: newRefreshToken,
		userId: row.userId,
		expiresAt,
	});

	// Eager cleanup: remove all revoked or expired tokens for this user
	await db
		.delete(refreshTokens)
		.where(
			and(
				eq(refreshTokens.userId, row.userId),
				or(
					isNotNull(refreshTokens.revokedAt),
					lt(refreshTokens.expiresAt, new Date().toISOString()),
				),
			),
		);

	const token = await signJwt({ sub: String(row.userId) }, c.env.JWT_SECRET);

	await writeAuditLog(db, {
		eventType: "refresh",
		userId: String(row.userId),
		ipAddress: getClientIp(c),
	});

	return c.json({
		access_token: token,
		refresh_token: newRefreshToken,
		token_type: "Bearer",
		expires_in: 3600,
	});
});

export default refresh;
