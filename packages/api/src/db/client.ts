import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type DatabaseConfig = {
	url: string;
	authToken?: string;
};

export function createDatabase(config: DatabaseConfig) {
	const client: Client = createClient({
		url: config.url,
		authToken: config.authToken,
	});
	return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
