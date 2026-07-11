import { describe, it, expect } from "vitest";
import { buildQueryString } from "../../utils/ApiUtils";

describe("buildQueryString", () => {
    it("returns empty string for no params", () => {
        expect(buildQueryString({})).toBe("");
    });

    it("encodes a simple string param", () => {
        expect(buildQueryString({ search: "John" })).toBe("?search=John");
    });

    it("skips null and undefined values", () => {
        expect(buildQueryString({ a: null, b: undefined, c: "x" })).toBe("?c=x");
    });

    it("skips blank strings", () => {
        expect(buildQueryString({ name: "   " })).toBe("");
    });

    it("trims whitespace from strings", () => {
        expect(buildQueryString({ q: "  hello  " })).toBe("?q=hello");
    });

    it("expands arrays into repeated params", () => {
        const result = buildQueryString({ status: [ "ACTIVE", "INACTIVE" ] });
        expect(result).toBe("?status=ACTIVE&status=INACTIVE");
    });

    it("skips null/undefined array elements", () => {
        const result = buildQueryString({ ids: [ 1, null, 2, undefined ] });
        expect(result).toBe("?ids=1&ids=2");
    });

    it("encodes numeric values", () => {
        expect(buildQueryString({ page: 3 })).toBe("?page=3");
    });

    it("combines multiple params", () => {
        const result = buildQueryString({ status: [ "ACTIVE" ], search: "Ana", page: 2 });
        expect(result).toContain("status=ACTIVE");
        expect(result).toContain("search=Ana");
        expect(result).toContain("page=2");
    });
});
