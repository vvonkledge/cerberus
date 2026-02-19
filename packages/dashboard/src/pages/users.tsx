import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApiFetch } from "../api-client";

interface User {
	id: number;
	email: string;
}

export function UsersPage() {
	const apiFetch = useApiFetch();
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchUsers() {
			try {
				const res = await apiFetch("/users");
				if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
				const data = await res.json();
				setUsers(data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch users");
			} finally {
				setLoading(false);
			}
		}
		fetchUsers();
	}, []);

	if (loading) return <p>Loading users...</p>;

	return (
		<div>
			<h2 className="text-2xl font-bold mb-4">Users</h2>

			{error && <p className="text-red-600 mb-4">{error}</p>}

			{users.length === 0 ? (
				<p className="text-gray-500">No users found.</p>
			) : (
				<table className="w-full border-collapse">
					<thead>
						<tr className="border-b">
							<th className="text-left p-2">ID</th>
							<th className="text-left p-2">Email</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => (
							<tr key={user.id} className="border-b hover:bg-gray-50">
								<td className="p-2">{user.id}</td>
								<td className="p-2">
									<Link to={`/users/${user.id}`} className="text-blue-600 hover:underline">
										{user.email}
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
