const FILTER_KEYS = ["status", "lane_id", "trigger", "q", "page"];

const hasValue = (value) => String(value ?? "").trim().length > 0;

export function buildQueryFromFilters(filters = {}) {
    return FILTER_KEYS.reduce((acc, key) => {
        const value = filters[key];

        if (key === "page") {
            const pageNum = Number(value);
            if (Number.isFinite(pageNum) && pageNum > 1) {
                acc.page = String(pageNum);
            }
            return acc;
        }

        if (hasValue(value)) {
            acc[key] = String(value).trim();
        }

        return acc;
    }, {});
}

export function parseFiltersFromSearch(search) {
    const raw = typeof search === "string" ? search : search?.toString?.() || "";
    const normalized = raw.startsWith("?") ? raw.slice(1) : raw;
    const params = new URLSearchParams(normalized);

    const pageValue = Number(params.get("page") || 1);

    return {
        status: params.get("status") || "",
        lane_id: params.get("lane_id") || "",
        trigger: params.get("trigger") || "",
        q: params.get("q") || "",
        page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
    };
}
