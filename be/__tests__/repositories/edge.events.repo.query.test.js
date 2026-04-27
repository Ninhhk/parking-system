const edgeEventsRepo = require("../../repositories/edge.events.repo");

describe("edge.events.repo query building", () => {
    it("includes q filter against event id and payload json", async () => {
        const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
        };

        await edgeEventsRepo.listEvents(
            {
                q: "51A",
                page: "1",
                pageSize: "20",
            },
            mockClient
        );

        expect(mockClient.query).toHaveBeenCalledTimes(1);

        const [sql, params] = mockClient.query.mock.calls[0];
        expect(sql).toContain("event_id ILIKE");
        expect(sql).toContain("payload_json -> 'trigger' ->> 'value' ILIKE");
        expect(sql).toContain("payload_json -> 'trigger' ->> 'plate' ILIKE");
        expect(sql).toContain("payload_json ->> 'triggerValue' ILIKE");
        expect(params[0]).toBe("%51A%");
    });
});
