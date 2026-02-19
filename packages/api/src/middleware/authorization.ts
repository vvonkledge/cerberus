import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { permissions, rolePermissions, userRoles } from "../db/schema";
import { getClientIp, writeAuditLog } from "./audit";

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
			await writeAuditLog(db, {
				eventType: "authz_denied",
				userId: user.sub,
				ipAddress: getClientIp(c),
				metadata: JSON.stringify({ permission: permissionName }),
			});
			return c.json({ error: "Forbidden" }, 403);
		}

		await writeAuditLog(db, {
			eventType: "authz_granted",
			userId: user.sub,
			ipAddress: getClientIp(c),
			metadata: JSON.stringify({ permission: permissionName }),
		});
		await next();
	};
}
