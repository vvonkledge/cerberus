import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { hashApiKey, verifyJwt } from "../auth/crypto";
import { apiKeys } from "../db/schema";

export function authMiddleware() {
	return async (c: Context, next: Next) => {
		const authHeader = c.req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return c.json({ error: "Authorization required" }, 401);
		}

		const token = authHeader.slice(7);

		if (token.startsWith("crb_")) {
			const db = c.get("db");
			const keyHash = await hashApiKey(token);
			const apiKey = await db
				.select()
				.from(apiKeys)
				.where(eq(apiKeys.keyHash, keyHash))
				.get();

			if (!apiKey) {
				return c.json({ error: "Invalid token" }, 401);
			}

			if (apiKey.revokedAt) {
				return c.json({ error: "Invalid token" }, 401);
			}

			c.set("user", { sub: String(apiKey.userId), iat: 0, exp: 0 });
			await next();
			return;
		}

		const payload = await verifyJwt(token, c.env.JWT_SECRET);
		if (!payload) {
			return c.json({ error: "Invalid token" }, 401);
		}

		c.set("user", payload);
		await next();
	};
}
