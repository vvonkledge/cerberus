import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { auditLogs } from "../db/schema";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
};

const auditLogsApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auditLogsApp.get("/", async (c) => {
	const db = c.get("db");

	const page = Math.max(1, Number(c.req.query("page")) || 1);
	const limit = Math.max(1, Math.min(100, Number(c.req.query("limit")) || 20));
	const eventType = c.req.query("event_type");
	const offset = (page - 1) * limit;

	const condition = eventType
		? eq(auditLogs.eventType, eventType)
		: undefined;

	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(auditLogs)
		.where(condition)
		.all();

	const total = Number(countResult.count);

	const data = await db
		.select()
		.from(auditLogs)
		.where(condition)
		.orderBy(desc(auditLogs.timestamp))
		.limit(limit)
		.offset(offset)
		.all();

	return c.json({
		data,
		pagination: { page, limit, total },
	});
});

export default auditLogsApp;
