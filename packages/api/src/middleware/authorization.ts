import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { permissions, rolePermissions, userRoles } from "../db/schema";

export function requirePermission(permissionName: string) {
	return async (c: Context, next: Next) => {
		const user = c.get("user") as { sub: string };
		const db = c.get("db");
		const userId = Number(user.sub);

		const rows = await db
			.select({ permission: permissions.permission })
			.from(userRoles)
			.innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(eq(userRoles.userId, userId))
			.all();

		const hasPermission = rows.some(
			(r: { permission: string }) => r.permission === permissionName,
		);

		if (!hasPermission) {
			return c.json({ error: "Forbidden" }, 403);
		}

		await next();
	};
}
