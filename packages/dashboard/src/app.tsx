import { Link, Outlet, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { RolesPage } from "./pages/roles";
import { RoleDetailPage } from "./pages/role-detail";
import { UsersPage } from "./pages/users";
import { UserDetailPage } from "./pages/user-detail";
import { AuditLogsPage } from "./pages/audit-logs";
import { ApiKeysPage } from "./pages/api-keys";
import { SetupPage } from "./pages/setup";
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
		<div className="min-h-screen bg-gray-50 flex flex-col">
			<nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
				<Link to="/roles" className="text-lg font-bold text-gray-900">Cerberus</Link>
				<button
					onClick={handleLogout}
					className="ml-auto text-gray-600 hover:text-red-600"
				>
					Logout
				</button>
			</nav>
			<div className="flex flex-1">
				<Sidebar />
				<main className="flex-1 max-w-4xl p-6">
					<Outlet />
				</main>
			</div>
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
					<Route path="setup" element={<SetupPage />} />
				</Route>
			</Route>
		</Routes>
	);
}
