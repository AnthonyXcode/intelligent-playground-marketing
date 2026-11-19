import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv } from "../src/csv.mjs";
import { importSchools, suppress, setSchoolStatus } from "../src/db.mjs";
import { makeCtx, stateOf } from "./helpers.mjs";
import { nullLogger } from "../src/log.mjs";

test("parseCsv: quotes, commas, CRLF, BOM", () => {
  const rows = parseCsv('\uFEFFid,name\r\n1,"a, ""b"""\r\n2,c\n');
  assert.deepEqual(rows, [{ id: "1", name: 'a, "b"' }, { id: "2", name: "c" }]);
});

test("import: statuses, email normalised, invalid rows skipped", () => {
  const ctx = makeCtx();
  assert.equal(stateOf(ctx, "PRI001").status, "pending");
  assert.equal(stateOf(ctx, "SEC002").status, "skipped_no_email");
  assert.equal(stateOf(ctx, "BAD001"), undefined);
  assert.equal(ctx.db.prepare("SELECT email FROM schools WHERE id='PRI002'").get().email, "mail@tpb.edu.hk");
  assert.equal(ctx.db.prepare("SELECT name_zh FROM schools WHERE id='PRI001'").get().name_zh, "測試小學, 甲");
});

test("unsubscribe/bounce are permanent across re-imports (by id and by email)", () => {
  const ctx = makeCtx();
  setSchoolStatus(ctx.db, "PRI001", "unsubscribed", "unsubscribe");
  suppress(ctx.db, "office@tpa.edu.hk", "unsubscribe", "PRI001");
  setSchoolStatus(ctx.db, "SEC001", "bounced", "bounce");
  suppress(ctx.db, "info@tsec.edu.hk", "bounce", "SEC001");
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(stateOf(ctx, "PRI001").status, "unsubscribed");
  assert.equal(stateOf(ctx, "SEC001").status, "bounced");
  // same email under a new id, and the old id with a changed email
  fs.appendFileSync(ctx.paths.schoolsCsv, "PRI999,PRI,新編號小學,,觀塘,,Office@TPA.edu.hk,,,,fixture,\n");
  const csv = fs.readFileSync(ctx.paths.schoolsCsv, "utf8").replace("info@tsec.edu.hk", "new@tsec.edu.hk");
  fs.writeFileSync(ctx.paths.schoolsCsv, csv);
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(stateOf(ctx, "PRI999").status, "unsubscribed");
  assert.equal(stateOf(ctx, "SEC001").status, "bounced");
});

test("skipped_no_email school becomes pending when an email appears", () => {
  const ctx = makeCtx();
  fs.writeFileSync(ctx.paths.schoolsCsv, fs.readFileSync(ctx.paths.schoolsCsv, "utf8").replace("灣仔,地址6,,", "灣仔,地址6,x@noemail.edu.hk,"));
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(stateOf(ctx, "SEC002").status, "pending");
});
