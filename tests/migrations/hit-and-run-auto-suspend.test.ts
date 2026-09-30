import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Hit-and-Run feature is deliberately split across four migrations so each
 * concern can be reviewed, applied and rolled back on its own. Static shape is
 * asserted here; the escalation ladder's actual behaviour is covered
 * behaviourally in tests/live/hit-and-run-escalation.integration.test.ts, which
 * is the test that matters. Regex assertions over SQL text pass even when the
 * branch logic is inverted, so nothing here should be treated as proof that the
 * ladder works.
 */
const MIGRATIONS = {
  escalation: "20260919000000_hit_and_run_escalation.sql",
  reconciliation: "20260919003000_payment_window_reconciliation.sql",
  complaint: "20260919004000_complaint_escrow_freeze.sql",
  materialize: "20260919005000_materialize_hit_and_run.sql",
} as const;

const read = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

const escalation = read(MIGRATIONS.escalation);
const reconciliation = read(MIGRATIONS.reconciliation);
const complaint = read(MIGRATIONS.complaint);
const materialize = read(MIGRATIONS.materialize);
const all = [escalation, reconciliation, complaint, materialize].join("\n");

describe("Hit-and-Run migration set is additive", () => {
  it("introduces no destructive statements in any file", () => {
    for (const name of Object.values(MIGRATIONS)) {
      const sql = read(name);
      expect(sql, name).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
      expect(sql, name).not.toMatch(/ALTER\s+TABLE.*(DROP|DELETE)\s+COLUMN/i);
    }
  });

  it("creates each function in exactly one migration", () => {
    const sources = { escalation, reconciliation, complaint, materialize };
    for (const fn of [
      "apply_hit_and_run_escalation",
      "lazy_lift_expired_suspension",
      "reconcile_batch_payment_window",
      "submit_order_complaint",
      "materialize_umkm_order",
      "materialize_supplier_order",
    ]) {
      const owners = Object.entries(sources)
        .filter(([, sql]) => sql.includes(`create or replace function public.${fn}`))
        .map(([name]) => name);
      expect(owners, fn).toHaveLength(1);
    }
  });

  it("keeps the batched materializer's dependency ordered after the singular one", () => {
    // materialize_umkm_orders delegates to materialize_umkm_order, so the
    // revision has to sort first or a fresh deploy binds an older body.
    const batched = read("20260920020000_batched_order_materialization.sql");
    expect(batched).toMatch(/perform public\.materialize_umkm_order\(/);
    expect(MIGRATIONS.materialize < "20260920020000").toBe(true);
  });
});

describe("escalation ladder shape", () => {
  it("computes the 7-day block retrospectively from the payment window deadline, never now()", () => {
    expect(escalation).toMatch(
      /p_payment_window_closed_at\s*\+\s*interval\s*'7\s+days'/i,
    );
    expect(escalation).not.toMatch(/suspended_until\s*=\s*now\(\)\s*\+\s*interval/i);
  });

  it("escalates only when the strike threshold is crossed (1 warn, 2 suspend, 3 permanent)", () => {
    expect(escalation).toMatch(/v_strike_count\s*=\s*1/i);
    expect(escalation).toMatch(/v_strike_count\s*=\s*2/i);
    expect(escalation).toMatch(/v_strike_count\s*>=\s*3/i);
    expect(escalation).toMatch(/'suspended_temporary'/i);
    expect(escalation).toMatch(/'suspended_permanent'/i);
  });

  it("refuses to escalate without the window deadline it sanctions from", () => {
    expect(escalation).toMatch(
      /if p_payment_window_closed_at is null then[\s\S]{0,80}?raise exception/i,
    );
  });

  it("dedupes escalation notifications on the escalationKey", () => {
    expect(escalation).toMatch(/notifications_hit_and_run_key_idx/i);
    expect(escalation).toMatch(
      /on\s+conflict\s+\(\(data->>'escalationKey'\)\)/i,
    );
  });

  it("grants escalation to service_role only and the lazy-lift to authenticated", () => {
    expect(escalation).toMatch(
      /revoke execute on function public\.apply_hit_and_run_escalation[\s\S]{0,120}?from public, anon, authenticated/i,
    );
    expect(escalation).toMatch(
      /grant execute on function public\.apply_hit_and_run_escalation[\s\S]{0,80}?to service_role/i,
    );
    expect(escalation).toMatch(
      /revoke execute on function public\.lazy_lift_expired_suspension[\s\S]{0,80}?from public, anon/i,
    );
    expect(escalation).toMatch(
      /grant execute on function public\.lazy_lift_expired_suspension[\s\S]{0,80}?to authenticated, service_role/i,
    );
  });
});

describe("payment window reconciliation shape", () => {
  it("gates the sweep on the absolute deadline having passed", () => {
    expect(reconciliation).toMatch(/if now\(\) < v_close then/i);
    expect(reconciliation).toMatch(
      /'reason',\s*'payment window still open'/i,
    );
  });

  it("reconciles pending provider attempts before penalising, so a late webhook is not punished", () => {
    expect(reconciliation).toMatch(
      /if not exists \(\s*select 1 from public\.payment_attempts[\s\S]{0,120}?status = 'pending'\s*\) then/i,
    );
  });

  it("grants the sweep to authenticated and service_role only", () => {
    expect(reconciliation).toMatch(
      /revoke execute on function public\.reconcile_batch_payment_window[\s\S]{0,80}?from public, anon/i,
    );
    expect(reconciliation).toMatch(
      /grant execute on function public\.reconcile_batch_payment_window[\s\S]{0,80}?to authenticated, service_role/i,
    );
  });
});

describe("complaint freeze shape", () => {
  it("hardens the freeze by nulling auto_release_at", () => {
    expect(complaint).toMatch(/submit_order_complaint/i);
    expect(complaint).toMatch(
      /set\s+status\s*=\s*'frozen',\s+dispute_id\s*=\s*v_dispute_id,\s+auto_release_at\s*=\s*null/i,
    );
  });
});

describe("materializer revisions shape", () => {
  it("keeps No-Show as a forfeiture-only sanction (no strike increment)", () => {
    const noShowBranch = materialize.match(
      /status\s*=\s*'no_show'[\s\S]{0,400}?end\s+if/i,
    );
    expect(noShowBranch).toBeTruthy();
    const branchText = noShowBranch![0];
    expect(branchText).toMatch(/'forfeited'/i);
    expect(branchText).not.toMatch(/strike_count/i);
  });

  it("escalates on the missed-payment branch of both materialize paths", () => {
    // The ladder is defined once, in the escalation migration, and called from
    // three places: the batch sweep and both per-registration materializers.
    // The superseded version of this test asserted a count of 3 while describing
    // them as "three definitions", which is how a call site could have been
    // deleted without the test noticing.
    const escalationCalls = (all.match(/perform public\.apply_hit_and_run_escalation\(/g) ?? []).length;
    expect(escalationCalls).toBe(3);

    expect(
      reconciliation.match(
        /perform public\.apply_hit_and_run_escalation\([\s\S]{0,120}?v_reg\.id\)/i,
      ),
    ).toBeTruthy();

    // Assert against each function body as a whole rather than a distance-sliced
    // branch: the nested if/end-if depth makes a windowed match brittle.
    const bodyOf = (fn: string) => {
      const start = materialize.indexOf(`create or replace function public.${fn}`);
      expect(start, fn).toBeGreaterThan(-1);
      const rest = materialize.slice(start + 1);
      const next = rest.search(/create or replace function public\.|^revoke |^grant /m);
      return next === -1 ? rest : rest.slice(0, next);
    };

    for (const fn of ["materialize_umkm_order", "materialize_supplier_order"]) {
      const body = bodyOf(fn);
      expect(body, fn).toMatch(/strike_count\s*=\s*strike_count\s*\+\s*1/i);
      expect(body, fn).toMatch(/perform public\.apply_hit_and_run_escalation\(/i);
      // The sanction is computed from the absolute window deadline, and a live
      // provider attempt must be reconciled before the UMKM is penalised.
      expect(body, fn).toMatch(/payment_closes_at/i);
      expect(body, fn).toMatch(/status\s*=\s*'pending'/i);
    }
  });
});
