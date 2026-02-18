import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { permissions, rolePermissions, roles, userRoles } from "../db/schema";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
};

const seedApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

seedApp.post("/", async (c) => {
	const body = await c.req.json<{ userId?: number }>();

	if (!body.userId) {
		return c.json({ error: "userId is required" }, 400);
	}

	const db = c.get("db");

	const existingAdmin = await db
		.select()
		.from(roles)
		.where(eq(roles.name, "admin"))
		.get();

	if (existingAdmin) {
		return c.json({ error: "Admin role already exists" }, 409);
	}

	const roleResult = await db.insert(roles).values({
		name: "admin",
		description: "Administrator with full access",
	});
	const roleId = Number(roleResult.lastInsertRowid);

	const permissionNames = ["manage_roles", "manage_users"];
	const permissionIds: number[] = [];

	for (const perm of permissionNames) {
		const result = await db.insert(permissions).values({ permission: perm });
		permissionIds.push(Number(result.lastInsertRowid));
	}

	for (const permissionId of permissionIds) {
		await db.insert(rolePermissions).values({ roleId, permissionId });
	}

	await db.insert(userRoles).values({ userId: body.userId, roleId });

	return c.json(
		{
			role: "admin",
			userId: body.userId,
			permissions: permissionNames,
		},
		201,
	);
});

export default seedApp;
