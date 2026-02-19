import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUseAuth } = vi.hoisted(() => ({
	mockUseAuth: vi.fn(),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useCallback: <T,>(fn: T) => fn,
		useState: <T,>(init: T | (() => T)): [T, (v: T) => void] => {
			const value = typeof init === "function" ? (init as () => T)() : init;
			return [value, vi.fn()];
		},
	};
});

vi.mock("../auth-context", async () => {
	const actual = await vi.importActual<typeof import("../auth-context")>(
		"../auth-context",
	);
	return {
		...actual,
		useAuth: mockUseAuth,
	};
});

import { getTokens, setTokens, clearTokens } from "../token-storage";
import { AuthProvider } from "../auth-context";
import { useApiFetch } from "../api-client";

function createMockStorage() {
	const store = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			store.delete(key);
		}),
		clear: vi.fn(() => store.clear()),
	};
}

describe("tokenStorage", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", createMockStorage());
	});

	it("setTokens writes to localStorage", () => {
		setTokens("access-123", "refresh-456");
		expect(localStorage.getItem("cerberus_access_token")).toBe("access-123");
		expect(localStorage.getItem("cerberus_refresh_token")).toBe("refresh-456");
	});

	it("getTokens reads from localStorage", () => {
		localStorage.setItem("cerberus_access_token", "a");
		localStorage.setItem("cerberus_refresh_token", "r");
		expect(getTokens()).toEqual({ accessToken: "a", refreshToken: "r" });
	});

	it("getTokens returns null when localStorage is empty", () => {
		expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
	});

	it("clearTokens removes from localStorage", () => {
		localStorage.setItem("cerberus_access_token", "a");
		localStorage.setItem("cerberus_refresh_token", "r");
		clearTokens();
		expect(localStorage.getItem("cerberus_access_token")).toBeNull();
		expect(localStorage.getItem("cerberus_refresh_token")).toBeNull();
	});
});

describe("AuthProvider localStorage integration", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", createMockStorage());
	});

	function getContextValue() {
		const element = AuthProvider({ children: null }) as any;
		return element.props.value;
	}

	it("initializes auth state from localStorage on mount", () => {
		localStorage.setItem("cerberus_access_token", "stored-access");
		localStorage.setItem("cerberus_refresh_token", "stored-refresh");

		const ctx = getContextValue();
		expect(ctx.token).toBe("stored-access");
		expect(ctx.refreshToken).toBe("stored-refresh");
	});

	it("initializes with null when localStorage is empty", () => {
		const ctx = getContextValue();
		expect(ctx.token).toBeNull();
		expect(ctx.refreshToken).toBeNull();
	});

	it("login persists tokens to localStorage", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: "new-access",
						refresh_token: "new-refresh",
					}),
					{ status: 200 },
				),
			),
		);

		const ctx = getContextValue();
		await ctx.login("user@test.com", "password");

		expect(localStorage.getItem("cerberus_access_token")).toBe("new-access");
		expect(localStorage.getItem("cerberus_refresh_token")).toBe(
			"new-refresh",
		);
	});

	it("logout clears tokens from localStorage", () => {
		localStorage.setItem("cerberus_access_token", "a");
		localStorage.setItem("cerberus_refresh_token", "r");

		const ctx = getContextValue();
		ctx.logout();

		expect(localStorage.getItem("cerberus_access_token")).toBeNull();
		expect(localStorage.getItem("cerberus_refresh_token")).toBeNull();
	});

	it("updateTokens persists refreshed tokens to localStorage", () => {
		const ctx = getContextValue();
		ctx.updateTokens("refreshed-access", "refreshed-refresh");

		expect(localStorage.getItem("cerberus_access_token")).toBe(
			"refreshed-access",
		);
		expect(localStorage.getItem("cerberus_refresh_token")).toBe(
			"refreshed-refresh",
		);
	});
});

describe("401 refresh token persistence", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", createMockStorage());
		mockUseAuth.mockReturnValue({
			token: "old-access",
			refreshToken: "old-refresh",
			updateTokens: (access: string, refresh: string) => {
				setTokens(access, refresh);
			},
			logout: vi.fn(),
		});
	});

	it("successful 401 refresh persists new tokens to localStorage", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(new Response(null, { status: 401 }))
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({
							access_token: "new-access",
							refresh_token: "new-refresh",
						}),
						{ status: 200 },
					),
				)
				.mockResolvedValueOnce(new Response(null, { status: 200 })),
		);

		const apiFetch = useApiFetch();
		await apiFetch("/api/protected");

		expect(localStorage.getItem("cerberus_access_token")).toBe("new-access");
		expect(localStorage.getItem("cerberus_refresh_token")).toBe(
			"new-refresh",
		);
	});
});
