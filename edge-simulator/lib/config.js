"use strict";

const fs = require("fs");
const path = require("path");

const apiUrl = process.env.EDGE_API_URL;
const apiKey = process.env.EDGE_API_KEY;

if (!apiUrl || !apiKey) {
    console.error("EDGE_API_URL and EDGE_API_KEY env vars required");
    process.exit(1);
}

const scenariosPath = path.resolve(__dirname, "..", "scenarios.json");

let scenarios;
try {
    const raw = fs.readFileSync(scenariosPath, "utf8");
    scenarios = JSON.parse(raw);
} catch (err) {
    if (err.code === "ENOENT") {
        console.error(`Cannot find scenarios.json at ${scenariosPath}`);
    } else if (err instanceof SyntaxError) {
        console.error(`Invalid JSON in scenarios.json: ${err.message}`);
    } else {
        console.error(`Error reading scenarios.json: ${err.message}`);
    }
    process.exit(1);
}

module.exports = { apiUrl, apiKey, scenarios };
