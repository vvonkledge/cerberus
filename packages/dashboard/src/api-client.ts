import { useCallback } from "react";
import { useAuth } from "./auth-context";

export function useApiFetch(): (path: string, options?: RequestInit) => Promise<Response> {
	const { token } = useAuth();

	return useCallback(
		(path: string, options?: RequestInit) => {
			const headers = new Headers(options?.headers);
			if (token) {
				headers.set("Authorization", `Bearer ${token}`);
			}
			return fetch(path, { ...options, headers });
		},
		[token],
	);
}
