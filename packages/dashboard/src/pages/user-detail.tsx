import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApiFetch } from "../api-client";

interface User {
	id: number;
	email: string;
}

interface Role {
	id: number;
	name: string;
}

export function UserDetailPage() {
	const apiFetch = useApiFetch();
	const { id } = useParams<{ id: string }>();
	const [user, setUser] = useState<User | null>(null);
	const [permissions, setPermissions] = useState<string[]>([]);
	const [roles, setRoles] = useState<Role[]>([]);
	const [selectedRoleId, setSelectedRoleId] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [assigning, setAssigning] = useState(false);

	async function fetchData() {
		try {
			const [usersRes, permsRes, rolesRes] = await Promise.all([
				apiFetch("/users"),
				apiFetch(`/users/${id}/permissions`),
				apiFetch("/roles"),
			]);

			if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`);
			const usersData: User[] = await usersRes.json();
			const found = usersData.find((u) => u.id === Number(id));
			if (!found) throw new Error("User not found");
			setUser(found);

			if (permsRes.ok) {
				const permsData = await permsRes.json();
				setPermissions(permsData.permissions || []);
			}

			if (rolesRes.ok) {
				const rolesData = await rolesRes.json();
				setRoles(rolesData);
			}

			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch data");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchData();
	}, [id]);

	async function handleAssignRole(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedRoleId) return;
		setAssigning(true);
		try {
			const res = await apiFetch(`/users/${id}/roles`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ roleId: Number(selectedRoleId) }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || `Failed to assign role: ${res.status}`);
			}
			setSelectedRoleId("");
			await fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to assign role");
		} finally {
			setAssigning(false);
		}
	}

	if (loading) return <p>Loading user...</p>;
	if (!user) return <p className="text-red-600">{error || "User not found"}</p>;

	return (
		<div>
			<Link to="/users" className="text-blue-600 hover:underline text-sm">&larr; Back to Users</Link>

			<h2 className="text-2xl font-bold mt-2 mb-1">{user.email}</h2>
			<p className="text-gray-500 text-sm mb-4">User ID: {user.id}</p>

			{error && <p className="text-red-600 mb-4">{error}</p>}

			<div className="mb-6">
				<h3 className="font-semibold mb-2">Resolved Permissions</h3>
				{permissions.length === 0 ? (
					<p className="text-gray-500">No permissions.</p>
				) : (
					<ul className="list-disc list-inside">
						{permissions.map((perm) => (
							<li key={perm} className="font-mono text-sm">{perm}</li>
						))}
					</ul>
				)}
			</div>

			<form onSubmit={handleAssignRole} className="p-4 border rounded bg-white">
				<h3 className="font-semibold mb-2">Assign Role</h3>
				<div className="flex gap-2 items-end">
					<label className="flex flex-col">
						<span className="text-sm text-gray-600">Role</span>
						<select
							value={selectedRoleId}
							onChange={(e) => setSelectedRoleId(e.target.value)}
							className="border rounded px-2 py-1"
							required
						>
							<option value="">Select a role...</option>
							{roles.map((role) => (
								<option key={role.id} value={role.id}>
									{role.name}
								</option>
							))}
						</select>
					</label>
					<button
						type="submit"
						disabled={assigning || !selectedRoleId}
						className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						{assigning ? "Assigning..." : "Assign"}
					</button>
				</div>
			</form>
		</div>
	);
}
