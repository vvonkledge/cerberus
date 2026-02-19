import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { generateApiKey, hashApiKey } from "../auth/crypto";
import type { Database } from "../db/client";
import { apiKeys } from "../db/schema";
import { getClientIp, writeAuditLog } from "../middleware/audit";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
	user: { sub: string; iat: number; exp: number };
};

const apiKeysApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

apiKeysApp.post("/", async (c) => {
	const body = await c.req.json<{ name?: string }>();

	if (!body.name) {
		return c.json({ error: "Name is required" }, 400);
	}

	const db = c.get("db");
	const user = c.get("user");
	const userId = Number(user.sub);

	const key = generateApiKey();
	const keyHash = await hashApiKey(key);
	const keyPrefix = key.substring(0, 8);

	const result = await db.insert(apiKeys).values({
		userId,
		name: body.name,
		keyHash,
		keyPrefix,
	});

	const id = Number(result.lastInsertRowid);

	await writeAuditLog(db, {
		eventType: "api_key_created",
		userId: user.sub,
		ipAddress: getClientIp(c),
		metadata: JSON.stringify({ name: body.name, keyPrefix }),
	});

	return c.json({ id, name: body.name, keyPrefix, key }, 201);
});

apiKeysApp.get("/", async (c) => {
	const db = c.get("db");
	const user = c.get("user");
	const userId = Number(user.sub);

	const keys = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			createdAt: apiKeys.createdAt,
			revokedAt: apiKeys.revokedAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))
		.all();

	return c.json(keys, 200);
});

apiKeysApp.delete("/:keyId", async (c) => {
	const keyId = Number(c.req.param("keyId"));
	const db = c.get("db");
	const user = c.get("user");
	const userId = Number(user.sub);

	const existing = await db
		.select()
		.from(apiKeys)
		.where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
		.get();

	if (!existing) {
		return c.json({ error: "API key not found" }, 404);
	}

	await db
		.update(apiKeys)
		.set({ revokedAt: new Date().toISOString() })
		.where(eq(apiKeys.id, keyId));

	await writeAuditLog(db, {
		eventType: "api_key_revoked",
		userId: user.sub,
		ipAddress: getClientIp(c),
		metadata: JSON.stringify({ keyId, keyPrefix: existing.keyPrefix }),
	});

	return c.json({ message: "API key revoked" }, 200);
});

export default apiKeysApp;
