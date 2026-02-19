import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { passwordResetTokens, users } from "../db/schema";
import { getClientIp, writeAuditLog } from "../middleware/audit";
import { generateRefreshToken } from "./crypto";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
};

type Variables = {
	db: Database;
};

const forgotPassword = new Hono<{
	Bindings: Bindings;
	Variables: Variables;
}>();

forgotPassword.post("/", async (c) => {
	const body = await c.req.json();
	const { email } = body;

	if (!email) {
		return c.json({ error: "Missing email" }, 400);
	}

	const db = c.get("db");
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, email));

	if (!user) {
		await writeAuditLog(db, {
			eventType: "password_reset_requested",
			userId: null,
			ipAddress: getClientIp(c),
			metadata: JSON.stringify({ email }),
		});
		return c.json({ message: "If the email exists, a reset token has been generated" });
	}

	const token = generateRefreshToken();
	const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
	await db.insert(passwordResetTokens).values({
		token,
		userId: user.id,
		expiresAt,
	});

	await writeAuditLog(db, {
		eventType: "password_reset_requested",
		userId: String(user.id),
		ipAddress: getClientIp(c),
		metadata: JSON.stringify({ email }),
	});

	return c.json({ resetToken: token });
});

export default forgotPassword;
