import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();
const mockAuth = {
	token: "header.eyJzdWIiOiI0MiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAzNjAwfQ.signature",
	refreshToken: null,
	login: vi.fn(),
	logout: vi.fn(),
	updateTokens: vi.fn(),
};

let useStateCallIndex = 0;
const stateValues: any[] = [];

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useEffect: vi.fn(),
		useCallback: <T,>(fn: T) => fn,
		useState: <T,>(init: T | (() => T)): [T, (v: T) => void] => {
			const idx = useStateCallIndex++;
			if (idx < stateValues.length && stateValues[idx] !== undefined) {
				return [stateValues[idx], vi.fn()];
			}
			const value = typeof init === "function" ? (init as () => T)() : init;
			return [value, vi.fn()];
		},
	};
});

vi.mock("../auth-context", () => ({
	useAuth: () => mockAuth,
}));

vi.mock("react-router-dom", () => ({
	useNavigate: () => mockNavigate,
}));

import { SetupPage } from "../pages/setup";

function setupState(overrides: {
	seeding?: boolean;
	error?: string | null;
	configured?: boolean;
} = {}) {
	useStateCallIndex = 0;
	stateValues.length = 0;
	// useState call order in SetupPage:
	// 0: seeding, 1: error, 2: configured
	stateValues.push(
		overrides.seeding ?? false,
		overrides.error ?? null,
		overrides.configured ?? false,
	);
}

function findAll(element: any, predicate: (el: any) => boolean): any[] {
	const results: any[] = [];
	if (
		element == null ||
		typeof element === "boolean" ||
		typeof element === "string" ||
		typeof element === "number"
	) {
		return results;
	}
	if (Array.isArray(element)) {
		for (const child of element) {
			results.push(...findAll(child, predicate));
		}
		return results;
	}
	if (predicate(element)) results.push(element);
	if (element.props?.children) {
		results.push(...findAll(element.props.children, predicate));
	}
	return results;
}

function getTextContent(element: any): string {
	if (element == null || typeof element === "boolean") return "";
	if (typeof element === "string" || typeof element === "number")
		return String(element);
	if (Array.isArray(element)) return element.map(getTextContent).join("");
	if (element.props?.children) return getTextContent(element.props.children);
	return "";
}

describe("SetupPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	// --- Rendering tests ---

	it("renders heading and explanation text", () => {
		setupState();
		const tree = SetupPage();
		const text = getTextContent(tree);
		expect(text).toContain("System Setup");
		expect(text).toContain("Bootstrap the admin role");
	});

	it("renders Bootstrap Admin button", () => {
		setupState();
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		expect(bootstrapButton).toBeDefined();
		expect(bootstrapButton.props.disabled).toBe(false);
	});

	it("shows Bootstrapping... text when seeding", () => {
		setupState({ seeding: true });
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const seedingButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrapping..."),
		);
		expect(seedingButton).toBeDefined();
		expect(seedingButton.props.disabled).toBe(true);
	});

	it("shows error message", () => {
		setupState({ error: "Something went wrong" });
		const tree = SetupPage();
		const text = getTextContent(tree);
		expect(text).toContain("Something went wrong");
		const errorEls = findAll(
			tree,
			(el) => el.props?.className?.includes("text-red-600"),
		);
		expect(errorEls.length).toBeGreaterThan(0);
	});

	it("shows already configured message when configured", () => {
		setupState({ configured: true });
		const tree = SetupPage();
		const text = getTextContent(tree);
		expect(text).toContain("Admin role already exists");
		expect(text).toContain("already configured");
		// No bootstrap button in configured state
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		expect(bootstrapButton).toBeUndefined();
	});

	// --- Bootstrap action tests ---

	it("calls POST /seed with correct userId on click", () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: () => Promise.resolve({ role: "admin", userId: 42, permissions: ["manage_roles", "manage_users"] }),
		});
		globalThis.fetch = mockFetch;

		setupState();
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		bootstrapButton.props.onClick();

		expect(mockFetch).toHaveBeenCalledWith("/seed", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: 42 }),
		});
	});

	it("navigates to / after successful seed", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: () => Promise.resolve({ role: "admin", userId: 42, permissions: [] }),
		});
		globalThis.fetch = mockFetch;

		setupState();
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		await bootstrapButton.props.onClick();

		expect(mockNavigate).toHaveBeenCalledWith("/");
	});

	it("handles 409 conflict (admin already exists)", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 409,
		});
		globalThis.fetch = mockFetch;

		// Track setConfigured calls
		let setConfiguredCalled = false;
		let setConfiguredValue: any;
		let callIdx = 0;
		const { useState: mockUseState } = await import("react");
		// Override useState to capture setConfigured
		const origPush = stateValues.push;

		setupState();
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		await bootstrapButton.props.onClick();

		expect(mockFetch).toHaveBeenCalledWith("/seed", expect.objectContaining({
			method: "POST",
		}));
		// Navigate should NOT be called on 409
		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("handles network error", async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
		globalThis.fetch = mockFetch;

		setupState();
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		await bootstrapButton.props.onClick();

		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("handles missing token", async () => {
		const origToken = mockAuth.token;
		mockAuth.token = null as any;

		setupState();
		const tree = SetupPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const bootstrapButton = buttons.find((btn) =>
			getTextContent(btn).includes("Bootstrap Admin"),
		);
		await bootstrapButton.props.onClick();

		expect(mockNavigate).not.toHaveBeenCalled();

		mockAuth.token = origToken;
	});
});
