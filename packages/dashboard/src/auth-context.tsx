import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getTokens, setTokens, clearTokens } from "./token-storage";

interface AuthContextValue {
	token: string | null;
	refreshToken: string | null;
	login: (email: string, password: string) => Promise<void>;
	logout: () => void;
	updateTokens: (accessToken: string, refreshToken: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(() => getTokens().accessToken);
	const [refreshToken, setRefreshToken] = useState<string | null>(() => getTokens().refreshToken);

	const login = useCallback(async (email: string, password: string) => {
		const res = await fetch("/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		if (!res.ok) {
			const data = await res.json().catch(() => null);
			throw new Error(
				data && typeof data.error === "string"
					? data.error
					: "Invalid credentials",
			);
		}

		const data = await res.json();
		setToken(data.access_token);
		setRefreshToken(data.refresh_token);
		setTokens(data.access_token, data.refresh_token);
	}, []);

	const logout = useCallback(() => {
		setToken(null);
		setRefreshToken(null);
		clearTokens();
	}, []);

	const updateTokens = useCallback((accessToken: string, newRefreshToken: string) => {
		setToken(accessToken);
		setRefreshToken(newRefreshToken);
		setTokens(accessToken, newRefreshToken);
	}, []);

	return (
		<AuthContext value={{ token, refreshToken, login, logout, updateTokens }}>
			{children}
		</AuthContext>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
