import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useEffect: vi.fn(),
		useCallback: <T,>(fn: T) => fn,
		useState: <T,>(init: T | (() => T)): [T, (v: T) => void] => {
			const value = typeof init === "function" ? (init as () => T)() : init;
			return [value, vi.fn()];
		},
	};
});

vi.mock("react-router-dom", () => ({
	NavLink: (props: any) => {
		return { type: "NavLink", props };
	},
}));

import { Sidebar } from "../sidebar";
import { NavLink } from "react-router-dom";

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

describe("Sidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders without crashing", () => {
		const tree = Sidebar();
		expect(tree).toBeTruthy();
	});

	it("contains links for all 5 pages", () => {
		const tree = Sidebar();
		const navLinks = findAll(tree, (el) => el.type === NavLink);
		expect(navLinks.length).toBe(5);

		const toPaths = navLinks.map((link: any) => link.props.to);
		expect(toPaths).toContain("/roles");
		expect(toPaths).toContain("/users");
		expect(toPaths).toContain("/audit-logs");
		expect(toPaths).toContain("/api-keys");
		expect(toPaths).toContain("/setup");
	});

	it("displays correct link text", () => {
		const tree = Sidebar();
		const text = getTextContent(tree);
		expect(text).toContain("Roles");
		expect(text).toContain("Users");
		expect(text).toContain("Audit Logs");
		expect(text).toContain("API Keys");
		expect(text).toContain("Setup");
	});

	it("uses NavLink for active state support", () => {
		const tree = Sidebar();
		const navLinks = findAll(tree, (el) => el.type === NavLink);
		expect(navLinks.length).toBe(5);
		// Every navigation link should be a NavLink, not a plain anchor or Link
		for (const link of navLinks) {
			expect(link.type).toBe(NavLink);
			expect(link.props.to).toBeDefined();
		}
	});

	it("applies active class to current route", () => {
		const tree = Sidebar();
		const navLinks = findAll(tree, (el) => el.type === NavLink);
		expect(navLinks.length).toBeGreaterThan(0);

		for (const link of navLinks) {
			const classNameFn = link.props.className;
			expect(typeof classNameFn).toBe("function");

			const activeClass = classNameFn({ isActive: true, isPending: false });
			expect(activeClass).toContain("text-blue-700");

			const inactiveClass = classNameFn({ isActive: false, isPending: false });
			expect(inactiveClass).toContain("text-gray-700");

			// Active and inactive classes should be different
			expect(activeClass).not.toBe(inactiveClass);
		}
	});

	it("does not include detail page links", () => {
		const tree = Sidebar();
		const navLinks = findAll(tree, (el) => el.type === NavLink);

		for (const link of navLinks) {
			const to = link.props.to as string;
			expect(to).not.toContain(":id");
			// Should not have nested paths like /roles/123 or /users/456
			const segments = to.split("/").filter(Boolean);
			expect(segments.length).toBe(1);
		}
	});
});
