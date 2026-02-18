import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface Role {
	id: number;
	name: string;
	description: string | null;
	permissions: string[];
}

export function RoleDetailPage() {
	const { id } = useParams<{ id: string }>();
	const [role, setRole] = useState<Role | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [permission, setPermission] = useState("");
	const [assigning, setAssigning] = useState(false);

	async function fetchRole() {
		try {
			const res = await fetch("/roles");
			if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
			const data: Role[] = await res.json();
			const found = data.find((r) => r.id === Number(id));
			if (!found) throw new Error("Role not found");
			setRole(found);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch role");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchRole();
	}, [id]);

	async function handleAssignPermission(e: React.FormEvent) {
		e.preventDefault();
		if (!permission.trim()) return;
		setAssigning(true);
		try {
			const res = await fetch(`/roles/${id}/permissions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ permission: permission.trim() }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || `Failed to assign permission: ${res.status}`);
			}
			setPermission("");
			await fetchRole();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to assign permission");
		} finally {
			setAssigning(false);
		}
	}

	if (loading) return <p>Loading role...</p>;
	if (!role) return <p className="text-red-600">{error || "Role not found"}</p>;

	return (
		<div>
			<Link to="/roles" className="text-blue-600 hover:underline text-sm">&larr; Back to Roles</Link>

			<h2 className="text-2xl font-bold mt-2 mb-1">{role.name}</h2>
			<p className="text-gray-600 mb-4">{role.description || "No description"}</p>

			{error && <p className="text-red-600 mb-4">{error}</p>}

			<div className="mb-6">
				<h3 className="font-semibold mb-2">Permissions</h3>
				{role.permissions.length === 0 ? (
					<p className="text-gray-500">No permissions assigned.</p>
				) : (
					<ul className="list-disc list-inside">
						{role.permissions.map((perm) => (
							<li key={perm} className="font-mono text-sm">{perm}</li>
						))}
					</ul>
				)}
			</div>

			<form onSubmit={handleAssignPermission} className="p-4 border rounded bg-white">
				<h3 className="font-semibold mb-2">Assign Permission</h3>
				<div className="flex gap-2 items-end">
					<label className="flex flex-col">
						<span className="text-sm text-gray-600">Permission</span>
						<input
							type="text"
							value={permission}
							onChange={(e) => setPermission(e.target.value)}
							placeholder="e.g. articles:read"
							className="border rounded px-2 py-1"
							required
						/>
					</label>
					<button
						type="submit"
						disabled={assigning}
						className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						{assigning ? "Assigning..." : "Assign"}
					</button>
				</div>
			</form>
		</div>
	);
}
