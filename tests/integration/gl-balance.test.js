"use strict";

/**
 * GL integrity integration test (BACKEND_COMPLETION_PLAN §1.1).
 *
 * The spec's hard invariant (§5.1 / §6.6): the General Ledger must balance —
 * every journal entry's debits equal its credits, and the whole ledger nets to
 * zero. `accounting.service.postEntry` enforces this on write; this test proves
 * it against the ACTUAL data in every business schema, with no assumptions
 * about chart-of-accounts seeding (it discovers the journal tables).
 *
 * On a freshly bootstrapped DB it passes vacuously (0 entries); it becomes a
 * real regression guard the moment any revenue/expense posts.
 *
 * OPT-IN: needs a live Postgres. Enable with RUN_DB_TESTS=1 (the CI job that
 * runs migrate + bootstrap should set it). Skipped otherwise so it never
 * produces a false failure in an env without a database.
 *
 *   RUN_DB_TESTS=1 DB_HOST=localhost DB_NAME=pixie_hub_test ... npx jest gl-balance
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const db = require("../../src/config/database");

const suite = RUN ? describe : describe.skip;

suite("General Ledger integrity", () => {
  beforeAll(async () => {
    await db.initDatabase();
  });
  afterAll(async () => {
    await db.closeDatabase();
  });

  /** Every schema that has a journal_lines table with the expected columns. */
  async function journalLineTables() {
    const { rows } = await db.query(
      `SELECT c.table_schema
         FROM information_schema.columns c
        WHERE c.table_name = 'journal_lines'
          AND c.column_name IN ('entry_id','debit_ngn','credit_ngn')
        GROUP BY c.table_schema
       HAVING count(DISTINCT c.column_name) = 3`,
    );
    return rows.map((r) => r.table_schema);
  }

  test("at least one business ledger exists to check", async () => {
    const schemas = await journalLineTables();
    // If this fails, the brands were never bootstrapped — run db:bootstrap:<brand>.
    expect(schemas.length).toBeGreaterThan(0);
  });

  test("every journal entry balances (sum debits = sum credits)", async () => {
    const schemas = await journalLineTables();
    const offenders = [];
    for (const schema of schemas) {
      const { rows } = await db.query(
        `SELECT entry_id,
                SUM(debit_ngn)  AS dr,
                SUM(credit_ngn) AS cr
           FROM "${schema}".journal_lines
          GROUP BY entry_id
         HAVING ABS(SUM(debit_ngn) - SUM(credit_ngn)) > 0.01`,
      );
      for (const r of rows) {
        offenders.push(`${schema}#${r.entry_id}: dr=${r.dr} cr=${r.cr}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("each ledger nets to zero overall (trial balance)", async () => {
    const schemas = await journalLineTables();
    for (const schema of schemas) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(debit_ngn),0) - COALESCE(SUM(credit_ngn),0) AS net
           FROM "${schema}".journal_lines`,
      );
      const net = Number(rows[0].net);
      expect(Math.abs(net)).toBeLessThanOrEqual(0.01);
    }
  });
});
