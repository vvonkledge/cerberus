import type { Context, Next } from "hono";
import { verifyJwt } from "../auth/crypto";

export function authMiddleware() {
	return async (c: Context, next: Next) => {
		const authHeader = c.req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return c.json({ error: "Authorization required" }, 401);
		}

		const token = authHeader.slice(7);
		const payload = await verifyJwt(token, c.env.JWT_SECRET);
		if (!payload) {
			return c.json({ error: "Invalid token" }, 401);
		}

		c.set("user", payload);
		await next();
	};
}
