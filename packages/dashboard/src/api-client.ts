import { useCallback } from "react";
import { useAuth } from "./auth-context";

export function useApiFetch(): (path: string, options?: RequestInit) => Promise<Response> {
	const { token, refreshToken, updateTokens, logout } = useAuth();

	return useCallback(
		async (path: string, options?: RequestInit) => {
			const headers = new Headers(options?.headers);
			if (token) {
				headers.set("Authorization", `Bearer ${token}`);
			}
			const response = await fetch(path, { ...options, headers });

			if (response.status === 401) {
				if (!refreshToken) {
					logout();
					return response;
				}

				const refreshRes = await fetch("/refresh", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refresh_token: refreshToken }),
				});

				if (!refreshRes.ok) {
					logout();
					return response;
				}

				const data = await refreshRes.json();
				updateTokens(data.access_token, data.refresh_token);

				const retryHeaders = new Headers(options?.headers);
				retryHeaders.set("Authorization", `Bearer ${data.access_token}`);
				return fetch(path, { ...options, headers: retryHeaders });
			}

			return response;
		},
		[token, refreshToken, updateTokens, logout],
	);
}
