"use strict";

const http = require("http");
const { CONFIG } = require("../config");

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const payload = options.body ? JSON.stringify(options.body) : null;
        const headers = { ...options.headers };

        if (payload) {
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = Buffer.byteLength(payload);
        }

        const req = http.request(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                method: options.method || "GET",
                headers,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => {
                    let json = null;
                    try { json = JSON.parse(data); } catch (_) {}
                    resolve({ statusCode: res.statusCode, body: data, json });
                });
            }
        );

        req.setTimeout(CONFIG.timeouts.responseTimeout, () => {
            req.destroy(new Error(`Request to ${url} timed out`));
        });
        req.on("error", (err) => reject(err));

        if (payload) req.write(payload);
        req.end();
    });
}

/**
 * Seed test data via the API.
 *
 * @param {string} baseUrl
 * @param {string} adminCookie - for admin routes (lots, cards)
 * @param {string} employeeCookie - for employee routes (check-in)
 * @returns {Promise<{lotId: number, sessionId: number, cardUid: string}>}
 */
async function seed(baseUrl, adminCookie, employeeCookie) {
    const adminHeaders = { Cookie: adminCookie };
    const employeeHeaders = { Cookie: employeeCookie };

    // 1. Ensure a parking lot exists
    const lotsRes = await request(`${baseUrl}/api/admin/parking-lots`, { headers: adminHeaders });
    let lotId;

    if (lotsRes.statusCode === 200 && lotsRes.json && lotsRes.json.data && lotsRes.json.data.length > 0) {
        lotId = lotsRes.json.data[0].lot_id;
    } else {
        const createLotRes = await request(`${baseUrl}/api/admin/parking-lots`, {
            method: "POST",
            headers: adminHeaders,
            body: {
                lot_name: "Load Test Lot",
                location: "Load Test Zone",
                total_slots: 100,
            },
        });
        if (createLotRes.statusCode !== 201 && createLotRes.statusCode !== 200) {
            throw new Error(`Seed: failed to create parking lot — HTTP ${createLotRes.statusCode}: ${createLotRes.body}`);
        }
        lotId = createLotRes.json && createLotRes.json.data && createLotRes.json.data.lot_id;
        if (!lotId) {
            throw new Error(`Seed: created lot but could not extract lot_id — ${createLotRes.body}`);
        }
    }

    // 2. Ensure a test card exists
    const cardUid = "LOADTEST0001";
    const cardsRes = await request(`${baseUrl}/api/admin/parking-cards?q=${cardUid}`, { headers: adminHeaders });

    let cardExists = false;
    if (cardsRes.statusCode === 200 && cardsRes.json && cardsRes.json.data) {
        const cards = Array.isArray(cardsRes.json.data) ? cardsRes.json.data : [];
        cardExists = cards.some((c) => c.card_uid === cardUid);
    }

    if (!cardExists) {
        const createCardRes = await request(`${baseUrl}/api/admin/parking-cards`, {
            method: "POST",
            headers: adminHeaders,
            body: { card_uid: cardUid, lot_id: lotId },
        });
        if (createCardRes.statusCode !== 201 && createCardRes.statusCode !== 409) {
            throw new Error(`Seed: failed to create card — HTTP ${createCardRes.statusCode}: ${createCardRes.body}`);
        }
    }

    // 3. Create an active session via check-in (employee role required)
    const checkinRes = await request(`${baseUrl}/api/employee/parking/entry`, {
        method: "POST",
        headers: employeeHeaders,
        body: {
            card_uid: cardUid,
            vehicle_type: "car",
            lot_id: lotId,
        },
    });

    let sessionId;
    if (checkinRes.statusCode === 201 && checkinRes.json) {
        sessionId = (checkinRes.json.data && checkinRes.json.data.session_id)
            || (checkinRes.json.ticket && checkinRes.json.ticket.session_id);
    } else if (checkinRes.statusCode === 409) {
        // Card already has an active session — find it
        const findRes = await request(
            `${baseUrl}/api/employee/parking/exit/by-card/${cardUid}`,
            { headers: employeeHeaders }
        );
        if (findRes.statusCode === 200 && findRes.json && findRes.json.data) {
            sessionId = findRes.json.data.session_id;
        }
    }

    if (!sessionId) {
        throw new Error(
            `Seed: failed to create or find active session — checkin HTTP ${checkinRes.statusCode}: ${checkinRes.body}`
        );
    }

    return { lotId, sessionId, cardUid };
}

module.exports = { seed };
