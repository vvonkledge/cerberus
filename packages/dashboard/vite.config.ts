import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			"/login": "http://localhost:8787",
			"/register": "http://localhost:8787",
			"/refresh": "http://localhost:8787",
			"/revoke": "http://localhost:8787",
			"/roles": "http://localhost:8787",
			"/users": "http://localhost:8787",
			"/seed": "http://localhost:8787",
			"/health": "http://localhost:8787",
		},
	},
});
