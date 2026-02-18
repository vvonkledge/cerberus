import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import {
	permissions,
	rolePermissions,
	roles,
	userRoles,
	users,
} from "../db/schema";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
};

const userRolesApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

userRolesApp.get("/", async (c) => {
	const db = c.get("db");

	const allUsers = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.all();

	return c.json(allUsers, 200);
});

userRolesApp.post("/:userId/roles", async (c) => {
	const userId = Number(c.req.param("userId"));
	const body = await c.req.json<{ roleId?: number }>();

	if (!body.roleId) {
		return c.json({ error: "roleId is required" }, 400);
	}

	const db = c.get("db");

	const user = await db.select().from(users).where(eq(users.id, userId)).get();
	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	const role = await db
		.select()
		.from(roles)
		.where(eq(roles.id, body.roleId))
		.get();
	if (!role) {
		return c.json({ error: "Role not found" }, 404);
	}

	await db.insert(userRoles).values({
		userId,
		roleId: body.roleId,
	});

	return c.json({ userId, roleId: body.roleId }, 200);
});

userRolesApp.get("/:userId/permissions", async (c) => {
	const userId = Number(c.req.param("userId"));
	const db = c.get("db");

	const user = await db.select().from(users).where(eq(users.id, userId)).get();
	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	const rows = await db
		.select({ permission: permissions.permission })
		.from(userRoles)
		.innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(eq(userRoles.userId, userId))
		.all();

	const uniquePermissions = [...new Set(rows.map((r) => r.permission))];

	return c.json({ permissions: uniquePermissions }, 200);
});

export default userRolesApp;
