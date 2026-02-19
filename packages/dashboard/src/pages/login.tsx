import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";

export function LoginPage() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await login(email, password);
			navigate("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="w-full max-w-sm p-6 bg-white rounded border">
				<h1 className="text-2xl font-bold mb-6 text-center text-gray-900">Cerberus</h1>

				{error && <p className="text-red-600 text-sm mb-4">{error}</p>}

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<label className="flex flex-col">
						<span className="text-sm text-gray-600 mb-1">Email</span>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="border rounded px-3 py-2"
							required
							autoFocus
						/>
					</label>

					<label className="flex flex-col">
						<span className="text-sm text-gray-600 mb-1">Password</span>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="border rounded px-3 py-2"
							required
						/>
					</label>

					<button
						type="submit"
						disabled={loading}
						className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						{loading ? "Logging in..." : "Log in"}
					</button>
				</form>
			</div>
		</div>
	);
}
