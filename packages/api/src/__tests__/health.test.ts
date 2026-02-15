import { describe, expect, it } from "vitest";
import app from "../index";

describe("health check", () => {
	it("returns 200 with ok status", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok" });
	});
});
