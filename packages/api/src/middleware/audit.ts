import type { Context } from "hono";
import type { Database } from "../db/client";
import { auditLogs } from "../db/schema";

export interface AuditEntry {
	eventType: string;
	userId: string | null;
	ipAddress: string;
	metadata?: string | null;
}

export function getClientIp(c: Context): string {
	return (
		c.req.header("CF-Connecting-IP") ||
		c.req.header("X-Forwarded-For") ||
		"unknown"
	);
}

export async function writeAuditLog(db: Database, entry: AuditEntry) {
	try {
		await db.insert(auditLogs).values({
			eventType: entry.eventType,
			userId: entry.userId,
			ipAddress: entry.ipAddress,
			metadata: entry.metadata ?? null,
		});
	} catch {
		// Audit logging is best-effort — don't break the main operation
	}
}
