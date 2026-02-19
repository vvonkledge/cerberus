import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { passwordResetTokens, users } from "../db/schema";
import { getClientIp, writeAuditLog } from "../middleware/audit";
import { hashPassword } from "./crypto";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
};

type Variables = {
	db: Database;
};

const resetPassword = new Hono<{
	Bindings: Bindings;
	Variables: Variables;
}>();

resetPassword.post("/", async (c) => {
	const body = await c.req.json();
	const { token, newPassword } = body;

	if (!token || !newPassword) {
		return c.json({ error: "Missing token or newPassword" }, 400);
	}

	const db = c.get("db");
	const [row] = await db
		.select()
		.from(passwordResetTokens)
		.where(eq(passwordResetTokens.token, token));

	if (!row) {
		await writeAuditLog(db, {
			eventType: "password_reset_failed",
			userId: null,
			ipAddress: getClientIp(c),
			metadata: JSON.stringify({ reason: "invalid_token" }),
		});
		return c.json({ error: "Invalid or expired reset token" }, 400);
	}

	if (row.usedAt !== null) {
		await writeAuditLog(db, {
			eventType: "password_reset_failed",
			userId: String(row.userId),
			ipAddress: getClientIp(c),
			metadata: JSON.stringify({ reason: "token_already_used" }),
		});
		return c.json({ error: "Invalid or expired reset token" }, 400);
	}

	if (row.expiresAt < new Date().toISOString()) {
		await writeAuditLog(db, {
			eventType: "password_reset_failed",
			userId: String(row.userId),
			ipAddress: getClientIp(c),
			metadata: JSON.stringify({ reason: "token_expired" }),
		});
		return c.json({ error: "Invalid or expired reset token" }, 400);
	}

	const hashedPassword = await hashPassword(newPassword);
	await db
		.update(users)
		.set({ hashedPassword, updatedAt: new Date().toISOString() })
		.where(eq(users.id, row.userId));

	await db
		.update(passwordResetTokens)
		.set({ usedAt: new Date().toISOString() })
		.where(eq(passwordResetTokens.token, token));

	await writeAuditLog(db, {
		eventType: "password_reset_completed",
		userId: String(row.userId),
		ipAddress: getClientIp(c),
	});

	return c.json({ message: "Password has been reset" });
});

export default resetPassword;
