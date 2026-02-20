import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";

function getUserIdFromToken(token: string): number | null {
	try {
		const payload = JSON.parse(atob(token.split(".")[1]));
		return Number(payload.sub);
	} catch {
		return null;
	}
}

export function SetupPage() {
	const { token } = useAuth();
	const navigate = useNavigate();
	const [seeding, setSeeding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [configured, setConfigured] = useState(false);

	async function handleBootstrap() {
		if (!token) {
			setError("Not authenticated");
			return;
		}

		const userId = getUserIdFromToken(token);
		if (userId === null) {
			setError("Could not determine user ID");
			return;
		}

		setSeeding(true);
		setError(null);

		try {
			const res = await fetch("/seed", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId }),
			});

			if (res.status === 409) {
				setConfigured(true);
				return;
			}

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(data?.error || `Failed to bootstrap admin: ${res.status}`);
			}

			navigate("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to bootstrap admin");
		} finally {
			setSeeding(false);
		}
	}

	if (configured) {
		return (
			<div>
				<h2 className="text-2xl font-bold mb-4">System Setup</h2>
				<p className="text-green-700">Admin role already exists — system is already configured.</p>
			</div>
		);
	}

	return (
		<div>
			<h2 className="text-2xl font-bold mb-4">System Setup</h2>
			<p className="mb-4 text-gray-700">
				Bootstrap the admin role to get started. This will assign full administrative permissions to your account.
			</p>
			{error && <p className="text-red-600 mb-4">{error}</p>}
			<button
				onClick={handleBootstrap}
				disabled={seeding}
				className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
			>
				{seeding ? "Bootstrapping..." : "Bootstrap Admin"}
			</button>
		</div>
	);
}
