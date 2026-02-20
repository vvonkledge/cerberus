import { NavLink } from "react-router-dom";

const links = [
	{ to: "/roles", label: "Roles" },
	{ to: "/users", label: "Users" },
	{ to: "/audit-logs", label: "Audit Logs" },
	{ to: "/api-keys", label: "API Keys" },
	{ to: "/setup", label: "Setup" },
];

export function Sidebar() {
	return (
		<aside className="w-56 bg-white border-r min-h-0">
			<nav className="py-4">
				{links.map((link) => (
					<NavLink
						key={link.to}
						to={link.to}
						className={({ isActive }) =>
							isActive
								? "block px-6 py-2 bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-700"
								: "block px-6 py-2 text-gray-700 hover:bg-gray-100"
						}
					>
						{link.label}
					</NavLink>
				))}
			</nav>
		</aside>
	);
}
