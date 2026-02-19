import { describe, it, expect, vi, beforeEach } from "vitest";

const { ctrl, mockApiFetch } = vi.hoisted(() => ({
	ctrl: {
		idx: 0,
		overrides: new Map<number, any>(),
		setters: new Map<number, ReturnType<typeof vi.fn>>(),
	},
	mockApiFetch: vi.fn(),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useCallback: <T,>(fn: T) => fn,
		useEffect: () => {},
		useState: <T,>(init: T | (() => T)): [T, (v: T) => void] => {
			const i = ctrl.idx++;
			const setter = vi.fn();
			ctrl.setters.set(i, setter);
			const value = ctrl.overrides.has(i)
				? ctrl.overrides.get(i)
				: typeof init === "function"
					? (init as () => T)()
					: init;
			return [value, setter];
		},
	};
});

vi.mock("react-router-dom", () => ({
	useParams: () => ({ id: "1" }),
	Link: (props: any) => props,
}));

vi.mock("../api-client", () => ({
	useApiFetch: () => mockApiFetch,
}));

import { UserDetailPage } from "../pages/user-detail";

// Traverse JSX tree to find elements matching a predicate
function findAll(element: any, predicate: (el: any) => boolean): any[] {
	const results: any[] = [];
	if (!element || typeof element !== "object") return results;
	if (Array.isArray(element)) {
		for (const child of element) {
			results.push(...findAll(child, predicate));
		}
		return results;
	}
	if (predicate(element)) results.push(element);
	const children = element.props?.children;
	if (children != null) {
		if (Array.isArray(children)) {
			for (const child of children) {
				results.push(...findAll(child, predicate));
			}
		} else {
			results.push(...findAll(children, predicate));
		}
	}
	return results;
}

// State indices in UserDetailPage:
// 0: user, 1: permissions, 2: roles (all), 3: assignedRoles,
// 4: selectedRoleId, 5: loading, 6: error, 7: assigning, 8: removing
function setupLoadedState(assignedRoles: Array<{ id: number; name: string }>) {
	ctrl.overrides.set(0, { id: 1, email: "test@example.com" });
	ctrl.overrides.set(3, assignedRoles);
	ctrl.overrides.set(5, false);
}

describe("UserDetailPage role removal", () => {
	beforeEach(() => {
		ctrl.idx = 0;
		ctrl.overrides.clear();
		ctrl.setters.clear();
		mockApiFetch.mockReset();
	});

	it("renders a Remove button next to each assigned role", () => {
		setupLoadedState([
			{ id: 1, name: "admin" },
			{ id: 2, name: "editor" },
		]);

		const jsx = UserDetailPage();
		const removeButtons = findAll(
			jsx,
			(el) => el.type === "button" && el.props?.children === "Remove",
		);

		expect(removeButtons).toHaveLength(2);
	});

	it("calls DELETE /users/:userId/roles/:roleId when remove is clicked", async () => {
		setupLoadedState([{ id: 3, name: "viewer" }]);
		mockApiFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const jsx = UserDetailPage();
		const removeButtons = findAll(
			jsx,
			(el) => el.type === "button" && el.props?.children === "Remove",
		);

		await removeButtons[0].props.onClick();

		expect(mockApiFetch).toHaveBeenCalledWith("/users/1/roles/3", {
			method: "DELETE",
		});
	});

	it("removes the role from the list after successful deletion", async () => {
		setupLoadedState([
			{ id: 1, name: "admin" },
			{ id: 2, name: "editor" },
		]);
		mockApiFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const jsx = UserDetailPage();
		const removeButtons = findAll(
			jsx,
			(el) => el.type === "button" && el.props?.children === "Remove",
		);

		// Click remove on the first role (admin, id: 1)
		await removeButtons[0].props.onClick();

		// The setAssignedRoles setter (index 3) should have been called with a filter function
		const setAssignedRoles = ctrl.setters.get(3)!;
		expect(setAssignedRoles).toHaveBeenCalled();

		const filterFn = setAssignedRoles.mock.calls.find(
			(call: any[]) => typeof call[0] === "function",
		)?.[0];
		expect(filterFn).toBeDefined();

		const result = filterFn([
			{ id: 1, name: "admin" },
			{ id: 2, name: "editor" },
		]);
		expect(result).toEqual([{ id: 2, name: "editor" }]);
	});
});
