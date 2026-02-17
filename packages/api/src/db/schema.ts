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
