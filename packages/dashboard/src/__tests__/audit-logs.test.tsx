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

import { AuditLogsPage } from "../pages/audit-logs";

const mockEntries = [
	{
		id: 1,
		eventType: "login",
		userId: "user-1",
		ipAddress: "127.0.0.1",
		timestamp: "2024-01-15T10:30:00.000Z",
		metadata: '{"email":"test@example.com"}',
	},
	{
		id: 2,
		eventType: "register",
		userId: "user-2",
		ipAddress: "192.168.1.1",
		timestamp: "2024-01-15T10:29:00.000Z",
		metadata: null,
	},
];

function setupState(overrides: {
	entries?: any[];
	pagination?: { page: number; limit: number; total: number };
	loading?: boolean;
	error?: string | null;
	page?: number;
	eventType?: string;
} = {}) {
	useStateCallIndex = 0;
	stateValues.length = 0;
	// useState call order in AuditLogsPage:
	// 0: entries, 1: pagination, 2: loading, 3: error, 4: page, 5: eventType
	stateValues.push(
		overrides.entries ?? [],
		overrides.pagination ?? { page: 1, limit: 20, total: 0 },
		overrides.loading ?? false,
		overrides.error ?? null,
		overrides.page ?? 1,
		overrides.eventType ?? "",
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

describe("AuditLogsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders audit log entries in a table", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 1, limit: 20, total: 2 },
		});
		const tree = AuditLogsPage();
		const rows = findAll(tree, (el) => el.type === "tr");
		// 1 header row + 2 data rows
		expect(rows.length).toBe(3);

		const text = getTextContent(tree);
		expect(text).toContain("login");
		expect(text).toContain("user-1");
		expect(text).toContain("127.0.0.1");
		expect(text).toContain("register");
		expect(text).toContain("user-2");
		expect(text).toContain("192.168.1.1");
	});

	it("Previous button is disabled on page 1", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 1, limit: 20, total: 40 },
			page: 1,
		});
		const tree = AuditLogsPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const prevButton = buttons.find((btn) =>
			getTextContent(btn).includes("Previous"),
		);
		expect(prevButton).toBeDefined();
		expect(prevButton.props.disabled).toBe(true);
	});

	it("Previous button is not disabled on page 2", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 2, limit: 20, total: 40 },
			page: 2,
		});
		const tree = AuditLogsPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const prevButton = buttons.find((btn) =>
			getTextContent(btn).includes("Previous"),
		);
		expect(prevButton).toBeDefined();
		expect(prevButton.props.disabled).toBe(false);
	});

	it("Next button is not disabled when more pages exist", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 1, limit: 20, total: 40 },
			page: 1,
		});
		const tree = AuditLogsPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const nextButton = buttons.find((btn) =>
			getTextContent(btn).includes("Next"),
		);
		expect(nextButton).toBeDefined();
		expect(nextButton.props.disabled).toBe(false);
	});

	it("Next button is disabled on the last page", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 2, limit: 20, total: 40 },
			page: 2,
		});
		const tree = AuditLogsPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const nextButton = buttons.find((btn) =>
			getTextContent(btn).includes("Next"),
		);
		expect(nextButton).toBeDefined();
		expect(nextButton.props.disabled).toBe(true);
	});

	it("displays page info", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 1, limit: 20, total: 40 },
			page: 1,
		});
		const tree = AuditLogsPage();
		const text = getTextContent(tree);
		expect(text).toContain("Page 1 of 2");
	});

	it("renders event type filter dropdown with all options", () => {
		setupState({
			entries: mockEntries,
			pagination: { page: 1, limit: 20, total: 2 },
		});
		const tree = AuditLogsPage();
		const selects = findAll(tree, (el) => el.type === "select");
		expect(selects.length).toBe(1);
		const options = findAll(selects[0], (el) => el.type === "option");
		// "All" + 10 event types
		expect(options.length).toBe(11);
		expect(getTextContent(options[0])).toBe("All");
		expect(options[0].props.value).toBe("");
		expect(options[1].props.value).toBe("login");
	});

	it("shows loading state", () => {
		setupState({ loading: true });
		const tree = AuditLogsPage();
		const text = getTextContent(tree);
		expect(text).toContain("Loading audit logs...");
	});

	it("shows empty state when no entries", () => {
		setupState({ entries: [], loading: false });
		const tree = AuditLogsPage();
		const text = getTextContent(tree);
		expect(text).toContain("No audit log entries found.");
	});

	it("shows error message", () => {
		setupState({
			entries: [],
			loading: false,
			error: "Something went wrong",
		});
		const tree = AuditLogsPage();
		const text = getTextContent(tree);
		expect(text).toContain("Something went wrong");
	});
});
