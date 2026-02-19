import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLogout, mockUpdateTokens, mockUseAuth } = vi.hoisted(() => ({
	mockLogout: vi.fn(),
	mockUpdateTokens: vi.fn(),
	mockUseAuth: vi.fn(),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return { ...actual, useCallback: <T,>(fn: T) => fn };
});

vi.mock("../auth-context", () => ({
	useAuth: mockUseAuth,
}));

import { useApiFetch } from "../api-client";

describe("useApiFetch token refresh", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mockLogout.mockReset();
		mockUpdateTokens.mockReset();
		mockUseAuth.mockReturnValue({
			token: "old-access-token",
			refreshToken: "old-refresh-token",
			updateTokens: mockUpdateTokens,
			logout: mockLogout,
		});
	});

	it("sends Authorization header with the current token", async () => {
		const mockFetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);
		vi.stubGlobal("fetch", mockFetch);

		const apiFetch = useApiFetch();
		await apiFetch("/api/data");

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const headers = mockFetch.mock.calls[0][1].headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer old-access-token");
	});

	it("401 triggers a refresh request using the refresh token", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: "new-access-token",
						refresh_token: "new-refresh-token",
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", mockFetch);

		const apiFetch = useApiFetch();
		await apiFetch("/api/protected");

		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(mockFetch.mock.calls[1][0]).toBe("/refresh");
		expect(mockFetch.mock.calls[1][1]).toEqual({
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: "old-refresh-token" }),
		});
	});

	it("successful refresh retries the original request with new token", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						access_token: "new-access-token",
						refresh_token: "new-refresh-token",
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: "ok" }), { status: 200 }),
			);
		vi.stubGlobal("fetch", mockFetch);

		const apiFetch = useApiFetch();
		const result = await apiFetch("/api/protected");

		expect(mockUpdateTokens).toHaveBeenCalledWith(
			"new-access-token",
			"new-refresh-token",
		);

		expect(mockFetch.mock.calls[2][0]).toBe("/api/protected");
		const retryHeaders = mockFetch.mock.calls[2][1].headers as Headers;
		expect(retryHeaders.get("Authorization")).toBe(
			"Bearer new-access-token",
		);

		expect(result.status).toBe(200);
	});

	it("failed refresh calls logout and returns original 401", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(new Response(null, { status: 401 }));
		vi.stubGlobal("fetch", mockFetch);

		const apiFetch = useApiFetch();
		const result = await apiFetch("/api/protected");

		expect(mockLogout).toHaveBeenCalled();
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result.status).toBe(401);
	});

	it("401 without refresh token calls logout immediately", async () => {
		mockUseAuth.mockReturnValue({
			token: "old-access-token",
			refreshToken: null,
			updateTokens: mockUpdateTokens,
			logout: mockLogout,
		});
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 401 }));
		vi.stubGlobal("fetch", mockFetch);

		const apiFetch = useApiFetch();
		const result = await apiFetch("/api/protected");

		expect(mockLogout).toHaveBeenCalled();
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(result.status).toBe(401);
	});
});
