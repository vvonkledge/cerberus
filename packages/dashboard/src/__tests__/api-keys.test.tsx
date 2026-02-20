import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiFetch = vi.fn();

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

vi.mock("../api-client", () => ({
	useApiFetch: () => mockApiFetch,
}));

import { ApiKeysPage } from "../pages/api-keys";

const mockKeys = [
	{
		id: 1,
		name: "Production API",
		keyPrefix: "crb_abc1",
		createdAt: "2024-01-15T10:30:00.000Z",
		revokedAt: null,
	},
	{
		id: 2,
		name: "Test Key",
		keyPrefix: "crb_def2",
		createdAt: "2024-01-14T08:00:00.000Z",
		revokedAt: "2024-01-15T12:00:00.000Z",
	},
];

function setupState(overrides: {
	keys?: any[];
	loading?: boolean;
	error?: string | null;
	name?: string;
	creating?: boolean;
	newKey?: string | null;
} = {}) {
	useStateCallIndex = 0;
	stateValues.length = 0;
	// useState call order in ApiKeysPage:
	// 0: keys, 1: loading, 2: error, 3: name, 4: creating, 5: newKey
	stateValues.push(
		overrides.keys ?? [],
		overrides.loading ?? false,
		overrides.error ?? null,
		overrides.name ?? "",
		overrides.creating ?? false,
		overrides.newKey ?? null,
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

describe("ApiKeysPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// --- List rendering tests ---

	it("renders key list in a table with correct columns", () => {
		setupState({ keys: mockKeys });
		const tree = ApiKeysPage();
		const rows = findAll(tree, (el) => el.type === "tr");
		// 1 header row + 2 data rows
		expect(rows.length).toBe(3);

		// Check header columns
		const headerRow = rows[0];
		const headerText = getTextContent(headerRow);
		expect(headerText).toContain("Name");
		expect(headerText).toContain("Prefix");
		expect(headerText).toContain("Created");
		expect(headerText).toContain("Status");
		expect(headerText).toContain("Actions");

		// Check data rows
		const text = getTextContent(tree);
		expect(text).toContain("Production API");
		expect(text).toContain("crb_abc1");
		expect(text).toContain("Test Key");
		expect(text).toContain("crb_def2");
	});

	it("shows active status for non-revoked keys", () => {
		setupState({ keys: [mockKeys[0]] });
		const tree = ApiKeysPage();
		const text = getTextContent(tree);
		expect(text).toContain("Active");
	});

	it("shows revoked status for revoked keys", () => {
		setupState({ keys: [mockKeys[1]] });
		const tree = ApiKeysPage();
		const text = getTextContent(tree);
		expect(text).toContain("Revoked");
	});

	// --- Create flow tests ---

	it("create form calls POST /api-keys with correct body", () => {
		mockApiFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ key: "crb_test123", id: 3, name: "My Key", keyPrefix: "crb_tes" }),
		});
		setupState({ keys: mockKeys, name: "My Key" });
		const tree = ApiKeysPage();

		const forms = findAll(tree, (el) => el.type === "form");
		expect(forms.length).toBe(1);

		const mockEvent = { preventDefault: vi.fn() };
		forms[0].props.onSubmit(mockEvent);

		expect(mockEvent.preventDefault).toHaveBeenCalled();
		expect(mockApiFetch).toHaveBeenCalledWith("/api-keys", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "My Key" }),
		});
	});

	it("raw key display shows after creation", () => {
		setupState({ keys: mockKeys, newKey: "crb_testkey123" });
		const tree = ApiKeysPage();
		const text = getTextContent(tree);
		expect(text).toContain("Copy this key now");
		expect(text).toContain("crb_testkey123");
	});

	it("dismiss button hides raw key", () => {
		setupState({ keys: mockKeys, newKey: "crb_testkey123" });
		const tree = ApiKeysPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const dismissButton = buttons.find((btn) =>
			getTextContent(btn).includes("Dismiss"),
		);
		expect(dismissButton).toBeDefined();
		expect(dismissButton.props.onClick).toBeDefined();
	});

	// --- Revoke flow tests ---

	it("revoke button calls DELETE /api-keys/:keyId", () => {
		mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
		setupState({ keys: [mockKeys[0]] });
		const tree = ApiKeysPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const revokeButton = buttons.find((btn) =>
			getTextContent(btn).includes("Revoke"),
		);
		expect(revokeButton).toBeDefined();
		revokeButton.props.onClick();
		expect(mockApiFetch).toHaveBeenCalledWith("/api-keys/1", { method: "DELETE" });
	});

	it("revoke button not shown for revoked keys", () => {
		setupState({ keys: [mockKeys[1]] });
		const tree = ApiKeysPage();
		const rows = findAll(tree, (el) => el.type === "tr");
		// rows[0] is header, rows[1] is the revoked key row
		const dataRow = rows[1];
		const buttons = findAll(dataRow, (el) => el.type === "button");
		const revokeButton = buttons.find((btn) =>
			getTextContent(btn).includes("Revoke"),
		);
		expect(revokeButton).toBeUndefined();
	});

	// --- Edge state tests ---

	it("shows loading state", () => {
		setupState({ loading: true });
		const tree = ApiKeysPage();
		const text = getTextContent(tree);
		expect(text).toContain("Loading...");
	});

	it("shows empty state", () => {
		setupState({ keys: [], loading: false });
		const tree = ApiKeysPage();
		const text = getTextContent(tree);
		expect(text).toContain("No API keys found.");
	});

	it("shows error message", () => {
		setupState({
			keys: [],
			loading: false,
			error: "Something went wrong",
		});
		const tree = ApiKeysPage();
		const text = getTextContent(tree);
		expect(text).toContain("Something went wrong");
	});
});
