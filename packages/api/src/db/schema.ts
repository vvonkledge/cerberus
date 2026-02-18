import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthChecks = sqliteTable("health_checks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	status: text("status").notNull(),
	checkedAt: text("checked_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	email: text("email").unique().notNull(),
	hashedPassword: text("hashed_password").notNull(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	token: text("token").unique().notNull(),
	userId: integer("user_id").notNull(),
	expiresAt: text("expires_at").notNull(),
	revokedAt: text("revoked_at"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const roles = sqliteTable("roles", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").unique().notNull(),
	description: text("description"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const permissions = sqliteTable("permissions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	permission: text("permission").unique().notNull(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const rolePermissions = sqliteTable("role_permissions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	roleId: integer("role_id").notNull(),
	permissionId: integer("permission_id").notNull(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const userRoles = sqliteTable("user_roles", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull(),
	roleId: integer("role_id").notNull(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});
