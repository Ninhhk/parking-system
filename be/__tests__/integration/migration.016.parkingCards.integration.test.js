// Integration test for migration 016_parking_cards_global_uid.sql.
// Exercises the REAL migration SQL file (read from disk, unmodified) against
// Docker Postgres. Each scenario runs inside a transaction that drops/recreates
// public.parking_cards in a controlled shape, runs the migration, asserts, then
// ROLLBACKs. Postgres has transactional DDL, so the live parking_cards table
// (and its seed rows) is fully restored after every test — nothing leaks.
//
// Requires Docker Postgres on port 55432; run with --runInBand --forceExit:
//   DB_HOST=localhost DB_PORT=55432 DB_USER=admin DB_PASSWORD=password123 \
//     DB_NAME=parking_lot npx jest migration.016.parkingCards --runInBand --forceExit
//
// Validates: Requirements 7.4, 7.5, 7.6, 7.7

const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/db");

const MIGRATION_PATH = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "db",
    "init",
    "016_parking_cards_global_uid.sql"
);
const migrationSql = fs.readFileSync(MIGRATION_PATH, "utf8");

// Reads the ordered primary-key column list for public.parking_cards, mirroring
// the introspection the migration itself uses. Returns null when no PK exists.
async function getPkCols(client) {
    const r = await client.query(`
        SELECT string_agg(att.attname, ',' ORDER BY att.attnum) AS pk_cols
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN unnest(con.conkey) AS k(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
        WHERE rel.relname = 'parking_cards' AND con.contype = 'p'
        GROUP BY con.conname
    `);
    return r.rows.length ? r.rows[0].pk_cols : null;
}

// Order-independent view of the PK columns. The raw pk_cols string is ordered by
// physical column position (attnum), so a composite PK reads back in whatever order
// the columns were declared. For composite-key assertions we only care about the
// set of columns, not their internal order (the migration itself accepts both
// 'lot_id,card_uid' and 'card_uid,lot_id').
async function getPkColSet(client) {
    const cols = await getPkCols(client);
    return cols === null ? null : cols.split(",").sort();
}

async function getLotIdNullable(client) {
    const r = await client.query(`
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'parking_cards' AND column_name = 'lot_id'
    `);
    return r.rows.length ? r.rows[0].is_nullable : null; // 'YES' | 'NO'
}

async function getRows(client) {
    const r = await client.query(
        "SELECT card_uid, lot_id, status FROM parking_cards ORDER BY lot_id, card_uid"
    );
    return r.rows;
}

// Recreates parking_cards in the pre-migration shape from 015:
//   PK (lot_id, card_uid), lot_id NOT NULL. (FK to parkinglots is intentionally
//   omitted; the migration never touches it, and dropping it keeps the test
//   self-contained against whatever lot rows happen to exist.)
async function setupOldShape(client) {
    await client.query("DROP TABLE IF EXISTS parking_cards CASCADE");
    await client.query(`
        CREATE TABLE parking_cards (
            card_uid   VARCHAR(100) NOT NULL,
            lot_id     INT          NOT NULL,
            status     VARCHAR(20)  NOT NULL DEFAULT 'available',
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (lot_id, card_uid)
        )
    `);
}

async function seed(client, rows) {
    for (const [cardUid, lotId, status = "available"] of rows) {
        await client.query(
            "INSERT INTO parking_cards (card_uid, lot_id, status) VALUES ($1, $2, $3)",
            [cardUid, lotId, status]
        );
    }
}

describe("Migration 016 — parking_cards global UID", () => {
    let client;

    beforeAll(async () => {
        client = await pool.connect();
    });

    afterEach(async () => {
        // Roll back whatever the test did, restoring the live parking_cards table.
        await client.query("ROLLBACK").catch(() => {});
    });

    afterAll(async () => {
        if (client) client.release();
        await pool.end();
    });

    test("converts (lot_id, card_uid) PK to card_uid, makes lot_id nullable, preserves rows (7.4)", async () => {
        await client.query("BEGIN");
        await setupOldShape(client);
        await seed(client, [
            ["CARD-A", 1],
            ["CARD-B", 1],
            ["CARD-C", 2, "lost"],
        ]);

        expect(await getPkColSet(client)).toEqual(["card_uid", "lot_id"]);
        const before = await getRows(client);

        await client.query(migrationSql);

        expect(await getPkCols(client)).toBe("card_uid");
        expect(await getLotIdNullable(client)).toBe("YES");
        expect(await getRows(client)).toEqual(before);
    });

    test("is idempotent: running a second time leaves schema and rows unchanged (7.6)", async () => {
        await client.query("BEGIN");
        await setupOldShape(client);
        await seed(client, [
            ["CARD-A", 1],
            ["CARD-B", 2],
        ]);

        await client.query(migrationSql);
        const afterFirst = await getRows(client);
        expect(await getPkCols(client)).toBe("card_uid");

        // Second run hits the idempotent RETURN branch — no error, no change.
        await client.query(migrationSql);

        expect(await getPkCols(client)).toBe("card_uid");
        expect(await getLotIdNullable(client)).toBe("YES");
        expect(await getRows(client)).toEqual(afterFirst);
    });

    test("aborts when the same card_uid exists across lots; PK and rows unchanged (7.5)", async () => {
        await client.query("BEGIN");
        await setupOldShape(client);
        await seed(client, [
            ["DUP", 1],
            ["DUP", 2], // same UID in another lot — illegal under the global model
            ["CARD-X", 1],
        ]);

        const before = await getRows(client);
        await client.query("SAVEPOINT before_migration");

        await expect(client.query(migrationSql)).rejects.toThrow(/Duplicate card_uid across lots/);

        // Recover from the aborted statement, then verify nothing changed.
        await client.query("ROLLBACK TO SAVEPOINT before_migration");

        expect(await getPkColSet(client)).toEqual(["card_uid", "lot_id"]);
        expect(await getLotIdNullable(client)).toBe("NO");
        expect(await getRows(client)).toEqual(before);
    });

    test("aborts on an unexpected PK shape; PK and rows unchanged (7.7)", async () => {
        await client.query("BEGIN");
        // Unexpected shape: PK on (card_uid, status), neither target nor old shape.
        await client.query("DROP TABLE IF EXISTS parking_cards CASCADE");
        await client.query(`
            CREATE TABLE parking_cards (
                card_uid   VARCHAR(100) NOT NULL,
                lot_id     INT          NOT NULL,
                status     VARCHAR(20)  NOT NULL DEFAULT 'available',
                created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (card_uid, status)
            )
        `);
        await seed(client, [
            ["CARD-A", 1],
            ["CARD-B", 2],
        ]);

        const before = await getRows(client);
        await client.query("SAVEPOINT before_migration");

        await expect(client.query(migrationSql)).rejects.toThrow(/Unexpected primary key/);

        await client.query("ROLLBACK TO SAVEPOINT before_migration");

        expect(await getPkCols(client)).toBe("card_uid,status");
        expect(await getRows(client)).toEqual(before);
    });
});
