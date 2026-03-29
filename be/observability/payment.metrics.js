const counters = {
    create_intent: 0,
    reuse_intent: 0,
    regenerate: 0,
    webhook_success: 0,
    webhook_replay: 0,
    webhook_failed: 0,
};

const timings = {
    finalize_latency: [],
};

exports.increment = (name) => {
    if (!(name in counters)) return;
    counters[name] += 1;
};

exports.observe = (name, valueMs) => {
    if (!(name in timings)) return;
    if (!Number.isFinite(valueMs)) return;
    timings[name].push(valueMs);
};

exports.snapshot = () => ({
    counters: { ...counters },
    timings: {
        finalize_latency: [...timings.finalize_latency],
    },
});
