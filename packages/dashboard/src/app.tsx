import { Link, Outlet, Route, Routes, Navigate } from "react-router-dom";
import { RolesPage } from "./pages/roles";
import { RoleDetailPage } from "./pages/role-detail";
import { UsersPage } from "./pages/users";
import { UserDetailPage } from "./pages/user-detail";

function Layout() {
	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
				<Link to="/roles" className="text-lg font-bold text-gray-900">Cerberus</Link>
				<Link to="/roles" className="text-gray-700 hover:text-blue-600">Roles</Link>
				<Link to="/users" className="text-gray-700 hover:text-blue-600">Users</Link>
			</nav>
			<main className="max-w-4xl mx-auto p-6">
				<Outlet />
			</main>
		</div>
	);
}

export function App() {
	return (
		<Routes>
			<Route element={<Layout />}>
				<Route index element={<Navigate to="/roles" replace />} />
				<Route path="roles" element={<RolesPage />} />
				<Route path="roles/:id" element={<RoleDetailPage />} />
				<Route path="users" element={<UsersPage />} />
				<Route path="users/:id" element={<UserDetailPage />} />
			</Route>
		</Routes>
	);
}
