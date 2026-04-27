import {
    buildQueryFromFilters,
    parseFiltersFromSearch,
} from "@/app/employee/edge-monitor/query";

describe("edge monitor query helpers", () => {
    it("buildQueryFromFilters omits empty values", () => {
        const result = buildQueryFromFilters({
            status: "FAILED",
            lane_id: "",
            trigger: "  ",
            q: "51G",
            page: 2,
            extra: null,
        });

        expect(result).toEqual({
            status: "FAILED",
            q: "51G",
            page: "2",
        });
    });

    it("parseFiltersFromSearch parses known keys", () => {
        const result = parseFiltersFromSearch("status=FAILED&lane_id=A1&trigger=LPD&q=plate&page=3");

        expect(result).toEqual({
            status: "FAILED",
            lane_id: "A1",
            trigger: "LPD",
            q: "plate",
            page: 3,
        });
    });

    it("parseFiltersFromSearch normalizes invalid page", () => {
        const result = parseFiltersFromSearch("status=SUCCESS&page=0");

        expect(result.page).toBe(1);
        expect(result.status).toBe("SUCCESS");
    });
});
