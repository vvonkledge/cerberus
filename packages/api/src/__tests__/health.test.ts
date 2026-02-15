import { describe, expect, it } from "vitest";
import app from "../index";

const testEnv = {
	TURSO_DATABASE_URL: "file::memory:",
};

describe("health check", () => {
	it("returns 200 with ok status", async () => {
		const res = await app.request("/health", {}, testEnv);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok" });
	});
});
