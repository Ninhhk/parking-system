import { createPollingRunner } from "@/app/employee/edge-monitor/polling";

describe("edge monitor polling", () => {
    it("skips overlapping executions while a poll is in-flight", async () => {
        let release;
        const task = jest.fn(() => {
            if (task.mock.calls.length === 0) {
                return Promise.resolve();
            }
            if (task.mock.calls.length === 1) {
                return new Promise((resolve) => {
                    release = resolve;
                });
            }
            return Promise.resolve();
        });

        const runPoll = createPollingRunner(task);

        const firstRun = runPoll();
        const secondRun = runPoll();

        expect(task).toHaveBeenCalledTimes(1);
        await expect(secondRun).resolves.toBe(false);

        release();
        await expect(firstRun).resolves.toBe(true);

        await runPoll();
        expect(task).toHaveBeenCalledTimes(2);
    });
});
