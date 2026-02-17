import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { signJwt, verifyPassword } from "./crypto";

type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN?: string;
	JWT_SECRET: string;
	ASSETS: Fetcher;
};

type Variables = {
	db: Database;
};

const login = new Hono<{ Bindings: Bindings; Variables: Variables }>();

login.post("/", async (c) => {
	const body = await c.req.json();
	const { email, password } = body;

	if (!email || !password) {
		return c.json({ error: "Missing email or password" }, 400);
	}

	const db = c.get("db");
	const [user] = await db.select().from(users).where(eq(users.email, email));

	if (!user) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const valid = await verifyPassword(password, user.hashedPassword);
	if (!valid) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const token = await signJwt({ sub: String(user.id) }, c.env.JWT_SECRET);

	return c.json({
		access_token: token,
		token_type: "Bearer",
		expires_in: 3600,
	});
});

export default login;
