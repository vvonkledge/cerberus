import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Role {
	id: number;
	name: string;
	description: string | null;
	permissions: string[];
}

export function RolesPage() {
	const [roles, setRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [creating, setCreating] = useState(false);

	async function fetchRoles() {
		try {
			const res = await fetch("/roles");
			if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
			const data = await res.json();
			setRoles(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch roles");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchRoles();
	}, []);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		setCreating(true);
		try {
			const res = await fetch("/roles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || `Failed to create role: ${res.status}`);
			}
			setName("");
			setDescription("");
			await fetchRoles();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create role");
		} finally {
			setCreating(false);
		}
	}

	if (loading) return <p>Loading roles...</p>;

	return (
		<div>
			<h2 className="text-2xl font-bold mb-4">Roles</h2>

			{error && <p className="text-red-600 mb-4">{error}</p>}

			<form onSubmit={handleCreate} className="mb-6 p-4 border rounded bg-white">
				<h3 className="font-semibold mb-2">Create Role</h3>
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
					<label className="flex flex-col">
						<span className="text-sm text-gray-600">Description</span>
						<input
							type="text"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="border rounded px-2 py-1"
						/>
					</label>
					<button
						type="submit"
						disabled={creating}
						className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						{creating ? "Creating..." : "Create"}
					</button>
				</div>
			</form>

			{roles.length === 0 ? (
				<p className="text-gray-500">No roles found.</p>
			) : (
				<table className="w-full border-collapse">
					<thead>
						<tr className="border-b">
							<th className="text-left p-2">ID</th>
							<th className="text-left p-2">Name</th>
							<th className="text-left p-2">Description</th>
							<th className="text-left p-2">Permissions</th>
						</tr>
					</thead>
					<tbody>
						{roles.map((role) => (
							<tr key={role.id} className="border-b hover:bg-gray-50">
								<td className="p-2">{role.id}</td>
								<td className="p-2">
									<Link to={`/roles/${role.id}`} className="text-blue-600 hover:underline">
										{role.name}
									</Link>
								</td>
								<td className="p-2">{role.description || "—"}</td>
								<td className="p-2">{role.permissions.length}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
