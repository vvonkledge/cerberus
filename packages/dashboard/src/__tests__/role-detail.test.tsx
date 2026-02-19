import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNavigate = vi.fn();
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

vi.mock("react-router-dom", () => ({
	useParams: () => ({ id: "1" }),
	useNavigate: () => mockNavigate,
	Link: ({ to, children, ...props }: any) => ({
		type: "a",
		props: { href: to, children, ...props },
	}),
}));

vi.mock("../api-client", () => ({
	useApiFetch: () => mockApiFetch,
}));

import { RoleDetailPage } from "../pages/role-detail";

const mockRole = {
	id: 1,
	name: "Admin",
	description: "Administrator role",
	permissions: ["users:read", "users:write"],
};

function setupLoadedState() {
	useStateCallIndex = 0;
	stateValues.length = 0;
	// useState call order in RoleDetailPage:
	// 0: role, 1: loading, 2: error, 3: permission, 4: assigning,
	// 5: editName, 6: saving, 7: deleting
	stateValues.push(
		mockRole, // role
		false, // loading
		null, // error
		"", // permission
		false, // assigning
		"Admin", // editName (pre-filled)
		false, // saving
		false, // deleting
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

describe("RoleDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupLoadedState();
	});

	it("renders delete button", () => {
		const tree = RoleDetailPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const deleteButton = buttons.find((btn) =>
			getTextContent(btn).includes("Delete Role"),
		);
		expect(deleteButton).toBeDefined();
	});

	it("renders edit form with current role name", () => {
		const tree = RoleDetailPage();
		const inputs = findAll(
			tree,
			(el) => el.type === "input" && el.props?.type === "text",
		);
		const editInput = inputs.find(
			(input) => input.props.value === "Admin",
		);
		expect(editInput).toBeDefined();
	});

	it("clicking delete calls DELETE /roles/:id", async () => {
		mockApiFetch.mockResolvedValueOnce({ ok: true });
		const tree = RoleDetailPage();
		const buttons = findAll(tree, (el) => el.type === "button");
		const deleteButton = buttons.find((btn) =>
			getTextContent(btn).includes("Delete Role"),
		);
		expect(deleteButton).toBeDefined();

		await deleteButton.props.onClick();

		expect(mockApiFetch).toHaveBeenCalledWith("/roles/1", {
			method: "DELETE",
		});
		expect(mockNavigate).toHaveBeenCalledWith("/roles");
	});

	it("submitting edit form calls PUT /roles/:id with new name", async () => {
		mockApiFetch.mockResolvedValueOnce({ ok: true });
		const tree = RoleDetailPage();
		const forms = findAll(
			tree,
			(el) => el.type === "form" && el.props?.onSubmit,
		);
		// First form is the edit form (Rename Role)
		const editForm = forms[0];
		expect(editForm).toBeDefined();

		await editForm.props.onSubmit({ preventDefault: vi.fn() });

		expect(mockApiFetch).toHaveBeenCalledWith("/roles/1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Admin" }),
		});
	});
});
