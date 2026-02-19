import { describe, expect, it } from "vitest";
import { App } from "../app";
import { AuthProvider, useAuth } from "../auth-context";
import { useApiFetch } from "../api-client";
import { ProtectedRoute } from "../protected-route";
import { LoginPage } from "../pages/login";

describe("App", () => {
	it("is defined", () => {
		expect(App).toBeDefined();
	});

	it("is a function component", () => {
		expect(typeof App).toBe("function");
	});
});

describe("Auth modules", () => {
	it("AuthProvider is a function component", () => {
		expect(AuthProvider).toBeDefined();
		expect(typeof AuthProvider).toBe("function");
	});

	it("useAuth is a function", () => {
		expect(useAuth).toBeDefined();
		expect(typeof useAuth).toBe("function");
	});

	it("useApiFetch is a function", () => {
		expect(useApiFetch).toBeDefined();
		expect(typeof useApiFetch).toBe("function");
	});

	it("ProtectedRoute is a function component", () => {
		expect(ProtectedRoute).toBeDefined();
		expect(typeof ProtectedRoute).toBe("function");
	});

	it("LoginPage is a function component", () => {
		expect(LoginPage).toBeDefined();
		expect(typeof LoginPage).toBe("function");
	});
});
