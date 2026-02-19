import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthContextValue {
	token: string | null;
	login: (email: string, password: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(null);

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
	}, []);

	const logout = useCallback(() => {
		setToken(null);
	}, []);

	return (
		<AuthContext value={{ token, login, logout }}>
			{children}
		</AuthContext>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
