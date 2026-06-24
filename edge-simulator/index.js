"use strict";

const readline = require("readline");
const { apiUrl, apiKey, scenarios } = require("./lib/config");
const { validateAll } = require("./lib/validator");
const { buildPayload } = require("./lib/payload");
const { sendEvent } = require("./lib/sender");

// Parse CLI args
const args = process.argv.slice(2);
const autoMode = args.includes("--auto");
const intervalIdx = args.indexOf("--interval");
const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1], 10) : 2000;
const countIdx = args.indexOf("--count");
const maxCount = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : Infinity;

// Validate scenarios at startup
const { valid, results } = validateAll(scenarios);
if (!valid) {
    console.error("Scenario validation failed:");
    for (const [name, errors] of Object.entries(results)) {
        console.error(`  ${name}: ${errors.join(", ")}`);
    }
    process.exit(1);
}

// ─── Interactive Mode ────────────────────────────────────────────────────────

function runInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    function showMenu() {
        console.log("\n=== Edge Gateway Simulator ===");
        scenarios.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.name}`);
        });
        console.log(`  q. Quit`);
        console.log("");
    }

    function prompt() {
        showMenu();
        rl.question("Select scenario: ", async (answer) => {
            const trimmed = answer.trim().toLowerCase();
            if (trimmed === "q" || trimmed === "quit") {
                rl.close();
                return;
            }

            const idx = parseInt(trimmed, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= scenarios.length) {
                console.log("Invalid selection.");
                prompt();
                return;
            }

            const scenario = scenarios[idx];
            const payload = buildPayload(scenario);
            console.log(`\nSending: ${scenario.name} (event_id: ${payload.event_id})`);

            try {
                const { status, body } = await sendEvent(apiUrl, apiKey, payload);
                console.log(`Status: ${status}`);
                console.log(`Response: ${JSON.stringify(body, null, 2)}`);
            } catch (err) {
                console.error(`Error: ${err.message}`);
            }

            prompt();
        });
    }

    rl.on("close", () => {
        console.log("Goodbye.");
        process.exit(0);
    });

    prompt();
}

// ─── Auto (Non-Interactive) Mode ─────────────────────────────────────────────

function runAuto() {
    let count = 0;
    let stopped = false;

    function stop() {
        if (stopped) return;
        stopped = true;
        console.log(`\nAuto mode stopped. Sent ${count} event(s).`);
        process.exit(0);
    }

    process.on("SIGINT", stop);

    async function tick() {
        if (stopped || count >= maxCount) {
            stop();
            return;
        }

        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        const payload = buildPayload(scenario);
        count++;

        try {
            const { status } = await sendEvent(apiUrl, apiKey, payload);
            console.log(
                `[${count}] event_id=${payload.event_id} lane_id=${payload.lane_id} trigger=${payload.trigger.type} status=${status}`
            );
        } catch (err) {
            console.log(
                `[${count}] event_id=${payload.event_id} lane_id=${payload.lane_id} trigger=${payload.trigger.type} error=${err.message}`
            );
        }

        if (!stopped && count < maxCount) {
            setTimeout(tick, interval);
        } else {
            stop();
        }
    }

    console.log(`Auto mode: interval=${interval}ms, count=${maxCount === Infinity ? "unlimited" : maxCount}`);
    tick();
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (autoMode) {
    runAuto();
} else {
    runInteractive();
}
