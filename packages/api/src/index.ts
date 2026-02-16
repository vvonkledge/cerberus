import { Hono } from "hono";

const app = new Hono();

app.get("*", (c) => {
	return c.text("this is a test yay");
});

export default app;
