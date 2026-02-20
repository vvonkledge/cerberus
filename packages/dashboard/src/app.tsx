import { Link, Outlet, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { RolesPage } from "./pages/roles";
import { RoleDetailPage } from "./pages/role-detail";
import { UsersPage } from "./pages/users";
import { UserDetailPage } from "./pages/user-detail";
import { AuditLogsPage } from "./pages/audit-logs";
import { ApiKeysPage } from "./pages/api-keys";
import { LoginPage } from "./pages/login";
import { ProtectedRoute } from "./protected-route";
import { useAuth } from "./auth-context";

function Layout() {
	const { logout } = useAuth();
	const navigate = useNavigate();

	function handleLogout() {
		logout();
		navigate("/login");
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
				<Link to="/roles" className="text-lg font-bold text-gray-900">Cerberus</Link>
				<Link to="/roles" className="text-gray-700 hover:text-blue-600">Roles</Link>
				<Link to="/users" className="text-gray-700 hover:text-blue-600">Users</Link>
				<Link to="/audit-logs" className="text-gray-700 hover:text-blue-600">Audit Logs</Link>
				<Link to="/api-keys" className="text-gray-700 hover:text-blue-600">API Keys</Link>
				<button
					onClick={handleLogout}
					className="ml-auto text-gray-600 hover:text-red-600"
				>
					Logout
				</button>
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
			<Route path="login" element={<LoginPage />} />
			<Route element={<ProtectedRoute />}>
				<Route element={<Layout />}>
					<Route index element={<Navigate to="/roles" replace />} />
					<Route path="roles" element={<RolesPage />} />
					<Route path="roles/:id" element={<RoleDetailPage />} />
					<Route path="users" element={<UsersPage />} />
					<Route path="users/:id" element={<UserDetailPage />} />
					<Route path="audit-logs" element={<AuditLogsPage />} />
					<Route path="api-keys" element={<ApiKeysPage />} />
				</Route>
			</Route>
		</Routes>
	);
}
