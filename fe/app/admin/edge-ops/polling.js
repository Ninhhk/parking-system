export function createPollingRunner(task) {
    let inFlight = false;

    return async () => {
        if (inFlight) {
            return false;
        }

        inFlight = true;
        try {
            await task();
            return true;
        } finally {
            inFlight = false;
        }
    };
}
