import { Hono } from "hono";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { getClientIp, writeAuditLog } from "../middleware/audit";
import { hashPassword } from "./crypto";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
};

const register = new Hono<{ Bindings: Bindings; Variables: Variables }>();

register.post("/", async (c) => {
	const body = await c.req.json<{ email?: string; password?: string }>();

	if (!body.email || !body.password) {
		return c.json({ error: "Email and password are required" }, 400);
	}

	const db = c.get("db");
	const hashed = await hashPassword(body.password);

	try {
		const result = await db.insert(users).values({
			email: body.email,
			hashedPassword: hashed,
		});

		const id = Number(result.lastInsertRowid);
		await writeAuditLog(db, {
			eventType: "register",
			userId: String(id),
			ipAddress: getClientIp(c),
			metadata: JSON.stringify({ email: body.email }),
		});
		return c.json({ id, email: body.email }, 201);
	} catch (err: unknown) {
		const message =
			err instanceof Error
				? err.message + (err.cause instanceof Error ? err.cause.message : "")
				: "";
		if (message.includes("UNIQUE constraint failed")) {
			return c.json({ error: "Email already registered" }, 409);
		}
		throw err;
	}
});

export default register;
