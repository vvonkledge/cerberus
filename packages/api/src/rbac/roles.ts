import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { permissions, rolePermissions, roles } from "../db/schema";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
};

type Variables = {
	db: Database;
};

const rolesApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

rolesApp.get("/", async (c) => {
	const db = c.get("db");

	const allRoles = await db.select().from(roles).all();

	const result = await Promise.all(
		allRoles.map(async (role) => {
			const perms = await db
				.select({ permission: permissions.permission })
				.from(rolePermissions)
				.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
				.where(eq(rolePermissions.roleId, role.id))
				.all();

			return {
				id: role.id,
				name: role.name,
				description: role.description,
				permissions: perms.map((p) => p.permission),
			};
		}),
	);

	return c.json(result, 200);
});

rolesApp.post("/", async (c) => {
	const body = await c.req.json<{ name?: string; description?: string }>();

	if (!body.name) {
		return c.json({ error: "Name is required" }, 400);
	}

	const db = c.get("db");

	try {
		const result = await db.insert(roles).values({
			name: body.name,
			description: body.description ?? null,
		});

		const id = Number(result.lastInsertRowid);
		return c.json(
			{ id, name: body.name, description: body.description ?? null },
			201,
		);
	} catch (err: unknown) {
		const message =
			err instanceof Error
				? err.message + (err.cause instanceof Error ? err.cause.message : "")
				: "";
		if (message.includes("UNIQUE constraint failed")) {
			return c.json({ error: "Role name already exists" }, 409);
		}
		throw err;
	}
});

rolesApp.post("/:roleId/permissions", async (c) => {
	const roleId = Number(c.req.param("roleId"));
	const body = await c.req.json<{ permission?: string }>();

	if (!body.permission) {
		return c.json({ error: "Permission is required" }, 400);
	}

	const db = c.get("db");

	// Check role exists
	const role = await db.select().from(roles).where(eq(roles.id, roleId)).get();
	if (!role) {
		return c.json({ error: "Role not found" }, 404);
	}

	// Upsert permission
	let permissionRow = await db
		.select()
		.from(permissions)
		.where(eq(permissions.permission, body.permission))
		.get();

	if (!permissionRow) {
		const result = await db.insert(permissions).values({
			permission: body.permission,
		});
		const permId = Number(result.lastInsertRowid);
		permissionRow = {
			id: permId,
			permission: body.permission,
			createdAt: new Date().toISOString(),
		};
	}

	// Check if role_permission already exists (idempotent)
	const existing = await db
		.select()
		.from(rolePermissions)
		.where(
			and(
				eq(rolePermissions.roleId, roleId),
				eq(rolePermissions.permissionId, permissionRow.id),
			),
		)
		.get();

	if (!existing) {
		await db.insert(rolePermissions).values({
			roleId,
			permissionId: permissionRow.id,
		});
	}

	return c.json({ roleId, permission: body.permission }, 200);
});

export default rolesApp;
