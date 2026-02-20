import { useEffect, useState } from "react";
import { useApiFetch } from "../api-client";

interface ApiKey {
	id: number;
	name: string;
	keyPrefix: string;
	createdAt: string;
	revokedAt: string | null;
}

function formatTimestamp(ts: string): string {
	return new Date(ts).toLocaleString();
}

export function ApiKeysPage() {
	const apiFetch = useApiFetch();
	const [keys, setKeys] = useState<ApiKey[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [newKey, setNewKey] = useState<string | null>(null);

	async function fetchKeys() {
		try {
			const res = await apiFetch("/api-keys");
			if (!res.ok) throw new Error(`Failed to fetch API keys: ${res.status}`);
			const data = await res.json();
			setKeys(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch API keys");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchKeys();
	}, []);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		setCreating(true);
		try {
			const res = await apiFetch("/api-keys", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim() }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || `Failed to create API key: ${res.status}`);
			}
			const data = await res.json();
			setNewKey(data.key);
			setName("");
			await fetchKeys();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create API key");
		} finally {
			setCreating(false);
		}
	}

	async function handleRevoke(keyId: number) {
		try {
			const res = await apiFetch(`/api-keys/${keyId}`, { method: "DELETE" });
			if (!res.ok) throw new Error(`Failed to revoke API key: ${res.status}`);
			await fetchKeys();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to revoke API key");
		}
	}

	if (loading) return <p>Loading...</p>;

	return (
		<div>
			<h2 className="text-2xl font-bold mb-4">API Keys</h2>

			{error && <p className="text-red-600 mb-4">{error}</p>}

			{newKey && (
				<div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded">
					<p className="font-semibold text-yellow-800 mb-2">Copy this key now. It will not be shown again.</p>
					<code className="block bg-yellow-100 p-2 rounded text-sm break-all">{newKey}</code>
					<button
						onClick={() => setNewKey(null)}
						className="mt-2 bg-gray-600 text-white px-4 py-1 rounded hover:bg-gray-700"
					>
						Dismiss
					</button>
				</div>
			)}

			<form onSubmit={handleCreate} className="mb-6 p-4 border rounded bg-white">
				<h3 className="font-semibold mb-2">Create API Key</h3>
				<div className="flex gap-2 items-end">
					<label className="flex flex-col">
						<span className="text-sm text-gray-600">Name</span>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="border rounded px-2 py-1"
							required
						/>
					</label>
					<button
						type="submit"
						disabled={creating}
						className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						{creating ? "Creating..." : "Create API Key"}
					</button>
				</div>
			</form>

			{keys.length === 0 ? (
				<p className="text-gray-500">No API keys found.</p>
			) : (
				<table className="w-full border-collapse">
					<thead>
						<tr className="border-b">
							<th className="text-left p-2">Name</th>
							<th className="text-left p-2">Prefix</th>
							<th className="text-left p-2">Created</th>
							<th className="text-left p-2">Status</th>
							<th className="text-left p-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{keys.map((key) => (
							<tr key={key.id} className="border-b hover:bg-gray-50">
								<td className="p-2">{key.name}</td>
								<td className="p-2 font-mono text-sm">{key.keyPrefix}</td>
								<td className="p-2">{formatTimestamp(key.createdAt)}</td>
								<td className="p-2">
									{key.revokedAt
										? `Revoked ${formatTimestamp(key.revokedAt)}`
										: "Active"}
								</td>
								<td className="p-2">
									{!key.revokedAt && (
										<button
											onClick={() => handleRevoke(key.id)}
											className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
										>
											Revoke
										</button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
