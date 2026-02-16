import { describe, expect, it } from "vitest";
import app from "../index";

describe("health check", () => {
	it("returns 200 with db ok when database is configured", async () => {
		const res = await app.request(
			"/health",
			{},
			{ TURSO_DATABASE_URL: "file::memory:" },
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok", db: "ok" });
	});

	it("returns 200 with db not_configured when no database URL", async () => {
		const res = await app.request("/health", {}, {});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok", db: "not_configured" });
	});
});
