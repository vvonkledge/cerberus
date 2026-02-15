import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/client";
import { healthChecks } from "../db/schema";

function setupTestDb() {
	const db = createDatabase({ url: "file::memory:" });
	return db;
}

describe("database", () => {
	it("can create tables, insert, and read a row", async () => {
		const db = setupTestDb();

		// Create the table using raw SQL (no migrations needed for test)
		await db.run(`
			CREATE TABLE health_checks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				status TEXT NOT NULL,
				checked_at TEXT NOT NULL
			)
		`);

		// Insert a row
		await db.insert(healthChecks).values({ status: "ok" });

		// Read it back
		const rows = await db
			.select()
			.from(healthChecks)
			.where(eq(healthChecks.status, "ok"));

		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe("ok");
		expect(rows[0].id).toBe(1);
		expect(rows[0].checkedAt).toBeTruthy();
	});
});
