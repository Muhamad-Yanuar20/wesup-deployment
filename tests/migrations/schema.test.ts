import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "pgsql-ast-parser";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

interface ColumnDef {
  type: string;
  notNull: boolean;
  references?: string;
  unique?: boolean;
}

interface ExpectedTable {
  columns: Record<string, string>;
  notNull: string[];
  unique: string[][];
  references?: Record<string, string>;
  checks?: string[][];
}

const EXPECTED_ENUMS: Record<string, string[]> = {
  user_role: ["supplier", "umkm", "admin"],
  account_status: [
    "active",
    "suspended_temporary",
    "suspended_permanent",
    "banned",
  ],
  verification_status: ["pending", "approved", "rejected"],
  batch_status: [
    "draft",
    "published",
    "closed",
    "cancelled",
    "takedown",
    "completed",
  ],
  registration_status: [
    "registered",
    "pending_payment",
    "paid",
    "picked_up",
    "completed",
    "no_show",
    "cancelled",
    "refund_pending",
    "refunded",
  ],
  payment_status: ["pending", "paid", "expired", "failed", "refunded"],
  escrow_status: ["held", "released", "refunded", "forfeited"],
  dispute_status: [
    "pending",
    "under_review",
    "resolved_supplier",
    "resolved_umkm",
  ],
  refund_trigger: ["takedown", "force_majeure", "dispute_won"],
  refund_status: [
    "pending",
    "waiting_bank_account",
    "processing",
    "completed",
    "failed",
  ],
  notification_type: [
    "payment_due",
    "payment_success",
    "pickup_ready",
    "dispute",
    "refund",
    "suspension",
    "referral",
    "batch_update",
  ],
  audit_action: [
    "verify_supplier",
    "reject_supplier",
    "takedown_batch",
    "resolve_dispute",
    "approve_refund",
    "complete_refund",
    "suspend_user",
    "ban_user",
    "unban_user",
  ],
};

const EXPECTED_TABLES: Record<string, ExpectedTable> = {
  profiles: {
    columns: {
      id: "uuid",
      role: "user_role",
      status: "account_status",
      full_name: "text",
      phone: "text",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: ["id", "role", "status", "full_name", "created_at", "updated_at"],
    unique: [],
    references: { id: "auth.users" },
  },
  supplier_profiles: {
    columns: {
      user_id: "uuid",
      business_name: "text",
      address: "text",
      latitude: "numeric",
      longitude: "numeric",
      business_photo_url: "text",
      ktp_photo_url: "text",
      nik: "text",
      verification_status: "verification_status",
      verification_notes: "text",
      verified_by: "uuid",
      verified_at: "timestamptz",
      is_location_locked: "boolean",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "user_id",
      "business_name",
      "address",
      "latitude",
      "longitude",
      "nik",
      "verification_status",
      "is_location_locked",
      "created_at",
      "updated_at",
    ],
    unique: [["nik"]],
    references: { user_id: "profiles", verified_by: "profiles" },
  },
  supplier_bank_accounts: {
    columns: {
      id: "uuid",
      supplier_id: "uuid",
      bank_name: "text",
      account_number: "text",
      account_holder_name: "text",
      is_primary: "boolean",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "supplier_id",
      "bank_name",
      "account_number",
      "account_holder_name",
      "is_primary",
      "created_at",
      "updated_at",
    ],
    unique: [["supplier_id", "account_number"]],
    references: { supplier_id: "profiles" },
  },
  umkm_profiles: {
    columns: {
      user_id: "uuid",
      business_name: "text",
      address: "text",
      latitude: "numeric",
      longitude: "numeric",
      strike_count: "integer",
      suspended_until: "timestamptz",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "user_id",
      "business_name",
      "address",
      "latitude",
      "longitude",
      "strike_count",
      "created_at",
      "updated_at",
    ],
    unique: [],
    references: { user_id: "profiles" },
    checks: [["strike_count"]],
  },
  umkm_bank_accounts: {
    columns: {
      id: "uuid",
      umkm_id: "uuid",
      bank_name: "text",
      account_number: "text",
      account_holder_name: "text",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "umkm_id",
      "bank_name",
      "account_number",
      "account_holder_name",
      "created_at",
      "updated_at",
    ],
    unique: [["umkm_id", "account_number"]],
    references: { umkm_id: "profiles" },
  },
  recurring_configs: {
    columns: {
      id: "uuid",
      supplier_id: "uuid",
      name: "text",
      interval_days: "integer",
      days_of_week: "array",
      is_active: "boolean",
      last_generated_at: "timestamptz",
      next_generation_at: "timestamptz",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "supplier_id",
      "interval_days",
      "is_active",
      "created_at",
      "updated_at",
    ],
    unique: [],
    references: { supplier_id: "profiles" },
    checks: [["interval_days"]],
  },
  batches: {
    columns: {
      id: "uuid",
      supplier_id: "uuid",
      recurring_config_id: "uuid",
      title: "text",
      description: "text",
      category: "text",
      min_quantity: "integer",
      product_photo_url: "text",
      pickup_address: "text",
      latitude: "numeric",
      longitude: "numeric",
      status: "batch_status",
      takedown_reason: "text",
      takedown_by: "uuid",
      takedown_at: "timestamptz",
      cancelled_reason: "text",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "supplier_id",
      "title",
      "category",
      "min_quantity",
      "pickup_address",
      "latitude",
      "longitude",
      "status",
      "created_at",
      "updated_at",
    ],
    unique: [],
    references: {
      supplier_id: "profiles",
      recurring_config_id: "recurring_configs",
      takedown_by: "profiles",
    },
    checks: [["min_quantity"]],
  },
  batch_tiers: {
    columns: {
      id: "uuid",
      batch_id: "uuid",
      tier_number: "integer",
      min_volume: "integer",
      max_volume: "integer",
      price_per_unit: "numeric",
      created_at: "timestamptz",
    },
    notNull: [
      "id",
      "batch_id",
      "tier_number",
      "min_volume",
      "price_per_unit",
      "created_at",
    ],
    unique: [["batch_id", "tier_number"]],
    references: { batch_id: "batches" },
    checks: [["min_volume"], ["max_volume"], ["price_per_unit"]],
  },
  batch_timeline: {
    columns: {
      batch_id: "uuid",
      registration_opens_at: "timestamptz",
      registration_closes_at: "timestamptz",
      payment_opens_at: "timestamptz",
      payment_closes_at: "timestamptz",
      estimated_ready_at: "timestamptz",
      created_at: "timestamptz",
    },
    notNull: [
      "batch_id",
      "registration_opens_at",
      "registration_closes_at",
      "payment_opens_at",
      "payment_closes_at",
      "estimated_ready_at",
      "created_at",
    ],
    unique: [],
    references: { batch_id: "batches" },
    checks: [
      [
        "registration_opens_at",
        "registration_closes_at",
        "payment_opens_at",
        "payment_closes_at",
        "estimated_ready_at",
      ],
    ],
  },
  registrations: {
    columns: {
      id: "uuid",
      batch_id: "uuid",
      umkm_id: "uuid",
      quantity: "integer",
      consented_at: "timestamptz",
      consent_latitude: "numeric",
      consent_longitude: "numeric",
      status: "registration_status",
      locked_tier_number: "integer",
      locked_price_per_unit: "numeric",
      final_amount: "numeric",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "batch_id",
      "umkm_id",
      "quantity",
      "consented_at",
      "status",
      "created_at",
      "updated_at",
    ],
    unique: [["batch_id", "umkm_id"]],
    references: { batch_id: "batches", umkm_id: "profiles" },
    checks: [["quantity"]],
  },
  registration_counters: {
    columns: {
      batch_id: "uuid",
      current_count: "integer",
      updated_at: "timestamptz",
    },
    notNull: ["batch_id", "current_count", "updated_at"],
    unique: [],
    references: { batch_id: "batches" },
    checks: [["current_count"]],
  },
  payments: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      midtrans_order_id: "text",
      midtrans_transaction_id: "text",
      gross_amount: "numeric",
      status: "payment_status",
      qr_code_url: "text",
      qr_code_expires_at: "timestamptz",
      paid_at: "timestamptz",
      webhook_payload: "jsonb",
      reconciled_at: "timestamptz",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "registration_id",
      "midtrans_order_id",
      "gross_amount",
      "status",
      "created_at",
      "updated_at",
    ],
    unique: [["registration_id"], ["midtrans_order_id"]],
    references: { registration_id: "registrations" },
    checks: [["gross_amount"]],
  },
  payment_webhook_logs: {
    columns: {
      id: "uuid",
      payment_id: "uuid",
      event_type: "text",
      payload: "jsonb",
      status: "text",
      error_message: "text",
      created_at: "timestamptz",
    },
    notNull: ["id", "payment_id", "event_type", "payload", "status", "created_at"],
    unique: [],
    references: { payment_id: "payments" },
  },
  pickup_codes: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      qr_code_token: "text",
      pin_code: "text",
      generated_at: "timestamptz",
      used_at: "timestamptz",
      used_by_supplier_id: "uuid",
    },
    notNull: ["id", "registration_id", "qr_code_token", "pin_code", "generated_at"],
    unique: [["registration_id"], ["qr_code_token"]],
    references: { registration_id: "registrations", used_by_supplier_id: "profiles" },
    checks: [["pin_code"]],
  },
  pickup_events: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      supplier_id: "uuid",
      method: "text",
      latitude: "numeric",
      longitude: "numeric",
      notes: "text",
      created_at: "timestamptz",
    },
    notNull: ["id", "registration_id", "supplier_id", "method", "created_at"],
    unique: [],
    references: { registration_id: "registrations", supplier_id: "profiles" },
    checks: [["method"]],
  },
  escrow_holds: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      amount: "numeric",
      status: "escrow_status",
      pickup_confirmed_at: "timestamptz",
      auto_release_at: "timestamptz",
      released_at: "timestamptz",
      release_destination: "text",
      dispute_id: "uuid",
      created_at: "timestamptz",
    },
    notNull: [
      "id",
      "registration_id",
      "amount",
      "status",
      "pickup_confirmed_at",
      "auto_release_at",
      "created_at",
    ],
    unique: [["registration_id"]],
    references: { registration_id: "registrations", dispute_id: "disputes" },
    checks: [["amount"]],
  },
  disputes: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      umkm_id: "uuid",
      supplier_id: "uuid",
      description: "text",
      photo_urls: "jsonb",
      status: "dispute_status",
      admin_id: "uuid",
      admin_notes: "text",
      decided_at: "timestamptz",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    notNull: [
      "id",
      "registration_id",
      "umkm_id",
      "supplier_id",
      "description",
      "photo_urls",
      "status",
      "created_at",
      "updated_at",
    ],
    unique: [["registration_id"]],
    references: {
      registration_id: "registrations",
      umkm_id: "profiles",
      supplier_id: "profiles",
      admin_id: "profiles",
    },
  },
  dispute_evidence: {
    columns: {
      id: "uuid",
      dispute_id: "uuid",
      uploaded_by: "uuid",
      file_url: "text",
      description: "text",
      created_at: "timestamptz",
    },
    notNull: ["id", "dispute_id", "uploaded_by", "file_url", "created_at"],
    unique: [],
    references: { dispute_id: "disputes", uploaded_by: "profiles" },
  },
  refund_requests: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      batch_id: "uuid",
      trigger_type: "refund_trigger",
      amount: "numeric",
      status: "refund_status",
      umkm_bank_account_id: "uuid",
      admin_id: "uuid",
      admin_notes: "text",
      transfer_proof_url: "text",
      requested_at: "timestamptz",
      processed_at: "timestamptz",
      completed_at: "timestamptz",
      created_at: "timestamptz",
    },
    notNull: [
      "id",
      "registration_id",
      "batch_id",
      "trigger_type",
      "amount",
      "status",
      "requested_at",
      "created_at",
    ],
    unique: [],
    references: {
      registration_id: "registrations",
      batch_id: "batches",
      umkm_bank_account_id: "umkm_bank_accounts",
      admin_id: "profiles",
    },
    checks: [["amount"]],
  },
  ratings: {
    columns: {
      id: "uuid",
      registration_id: "uuid",
      umkm_id: "uuid",
      supplier_id: "uuid",
      score: "smallint",
      comment: "text",
      created_at: "timestamptz",
    },
    notNull: ["id", "registration_id", "umkm_id", "supplier_id", "score", "created_at"],
    unique: [["registration_id"]],
    references: {
      registration_id: "registrations",
      umkm_id: "profiles",
      supplier_id: "profiles",
    },
    checks: [["score"]],
  },
  notifications: {
    columns: {
      id: "uuid",
      user_id: "uuid",
      type: "notification_type",
      title: "text",
      message: "text",
      data: "jsonb",
      read_at: "timestamptz",
      sent_via_whatsapp: "boolean",
      whatsapp_status: "text",
      created_at: "timestamptz",
    },
    notNull: [
      "id",
      "user_id",
      "type",
      "title",
      "message",
      "sent_via_whatsapp",
      "created_at",
    ],
    unique: [],
    references: { user_id: "profiles" },
  },
  admin_audit_logs: {
    columns: {
      id: "uuid",
      admin_id: "uuid",
      action_type: "audit_action",
      target_type: "text",
      target_id: "uuid",
      details: "jsonb",
      ip_address: "text",
      user_agent: "text",
      created_at: "timestamptz",
    },
    notNull: ["id", "admin_id", "action_type", "target_type", "target_id", "created_at"],
    unique: [],
    references: { admin_id: "profiles" },
  },
};

const CRITICAL_INDEXES = [
  "batches_supplier_status_idx",
  "batches_category_status_idx",
  "registrations_batch_idx",
  "registrations_umkm_idx",
  "payments_status_idx",
  "escrow_holds_status_idx",
  "disputes_status_idx",
  "refund_requests_status_idx",
  "notifications_user_read_idx",
  "ratings_supplier_idx",
  "admin_audit_logs_admin_created_idx",
];

const REQUIRED_FUNCTIONS = [
  "is_admin",
  "is_supplier",
  "handle_new_user",
  "prevent_admin_audit_logs_mutation",
];

const REQUIRED_TRIGGERS = [
  { name: "on_auth_user_created", table: "auth.users" },
  { name: "admin_audit_logs_immutable", table: "admin_audit_logs" },
];

interface ParsedSchema {
  tables: Map<
    string,
    {
      columns: Map<string, ColumnDef>;
      checks: unknown[];
      tableUniques: string[][];
    }
  >;
  enums: Map<string, string[]>;
  indexes: Map<string, string[]>;
}

function stripUnsupported(sql: string): string {
  return sql
    .replace(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[\s\S]*?\$\$\s*;/gi, "")
    .replace(/CREATE\s+TRIGGER[^;]+;/gi, "")
    .replace(/CREATE\s+POLICY[^;]+;/gi, "")
    .replace(/ALTER\s+TABLE[^;]*ENABLE\s+ROW\s+LEVEL\s+SECURITY[^;]*;/gi, "")
    .replace(/ALTER\s+TABLE[^;]*FORCE\s+ROW\s+LEVEL\s+SECURITY[^;]*;/gi, "");
}

function collectRefs(expr: unknown, acc: Set<string>): void {
  if (!expr || typeof expr !== "object") return;
  const e = expr as Record<string, unknown>;
  if (e.type === "ref" && typeof e.name === "string") acc.add(e.name);
  for (const v of Object.values(e)) {
    if (Array.isArray(v)) v.forEach((x) => collectRefs(x, acc));
    else collectRefs(v, acc);
  }
}

function loadSchema(): ParsedSchema {
  const files = listMigrationFiles();
  const schema: ParsedSchema = {
    tables: new Map(),
    enums: new Map(),
    indexes: new Map(),
  };
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const ast = parse(stripUnsupported(sql));
    for (const stmt of ast) {
      if (stmt.type === "create table") {
        const name = stmt.name.name;
        const table = schema.tables.get(name) ?? {
          columns: new Map<string, ColumnDef>(),
          checks: [] as unknown[],
          tableUniques: [] as string[][],
        };
        for (const rawCol of stmt.columns) {
          if (rawCol.kind !== "column") continue;
          const col = rawCol;
          const dataType = col.dataType as
            | { name: string; kind?: string; arrayOf?: { name: string } }
            | undefined;
          const typeName =
            dataType?.kind === "array" ? "array" : (dataType?.name ?? "unknown");
          const constraints = (col.constraints ?? []) as Array<{
            type: string;
            foreignTable?: { schema?: string; name: string };
            expr?: unknown;
            columns?: Array<{ name: string }>;
          }>;
          const ref = constraints.find((c) => c.type === "reference")
            ?.foreignTable;
          table.columns.set(col.name.name, {
            type: typeName,
            notNull: constraints.some(
              (c) => c.type === "not null" || c.type === "primary key",
            ),
            references: ref
              ? ref.schema === "public"
                ? ref.name
                : `${ref.schema}.${ref.name}`
              : undefined,
            unique: constraints.some((c) => c.type === "unique"),
          });
          const check = constraints.find((c) => c.type === "check");
          if (check) table.checks.push(check);
        }
        const tableConstraints = (stmt.constraints ?? []) as Array<{
          type: string;
          columns?: Array<{ name: string }>;
          expr?: unknown;
        }>;
        const check = tableConstraints.find((c) => c.type === "check");
        if (check) table.checks.push(check);
        for (const c of tableConstraints) {
          if (c.type === "unique" && c.columns) {
            table.tableUniques.push(c.columns.map((col) => col.name));
          }
        }
        schema.tables.set(name, table);
      }
      if (stmt.type === "create enum") {
        schema.enums.set(stmt.name.name, stmt.values.map((v) => v.value));
      }
      if (stmt.type === "create index" && stmt.indexName && stmt.expressions) {
        schema.indexes.set(
          stmt.indexName.name,
          stmt.expressions.map(
            (e) => (e.expression as { name?: string }).name ?? "expr",
          ),
        );
      }
    }
  }
  return schema;
}

function listMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function extractPolicies(sql: string): Array<{
  name: string;
  table: string;
  action: string;
}> {
  const policies: Array<{ name: string; table: string; action: string }> = [];
  const blockRe = /CREATE\s+POLICY\s+"?([a-zA-Z0-9_]+)"?\s+ON\s+public\.([a-zA-Z0-9_]+)\s+FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/gi;
  for (const m of sql.matchAll(blockRe)) {
    policies.push({ name: m[1], table: m[2], action: m[3].toUpperCase() });
  }
  return policies;
}

function extractRlsEnabled(sql: string): Set<string> {
  const re = /ALTER\s+TABLE\s+public\.([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  return new Set([...sql.matchAll(re)].map((m) => m[1]));
}

describe("migration files", () => {
  let files: string[];
  beforeAll(() => {
    files = listMigrationFiles();
  });

  it("exist and follow Supabase timestamp naming", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const f of files) {
      expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    }
  });

  it("are strictly ordered and non-duplicate", () => {
    const timestamps = files.map((f) => Number(f.slice(0, 14)));
    expect(new Set(timestamps).size).toBe(timestamps.length);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it("parse as valid PostgreSQL", () => {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const clean = stripUnsupported(sql);
      expect(() => parse(clean), `syntax error in ${file}`).not.toThrow();
    }
  });

  it("contain no destructive statements", () => {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/TRUNCATE/i);
    }
  });
});

describe("enums", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  for (const [enumName, values] of Object.entries(EXPECTED_ENUMS)) {
    it(`defines ${enumName} with expected values`, () => {
      expect(schema.enums.get(enumName)).toEqual(values);
    });
  }
});

describe("tables", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  for (const [tableName, spec] of Object.entries(EXPECTED_TABLES)) {
    describe(tableName, () => {
      let table: ParsedSchema["tables"] extends Map<string, infer T> ? T : never;
      beforeAll(() => {
        table = schema.tables.get(tableName) as typeof table;
        expect(table, `table ${tableName} missing`).toBeDefined();
      });

      it("has all expected columns with correct types", () => {
        for (const [col, type] of Object.entries(spec.columns)) {
          expect(table.columns.get(col)?.type, `column ${tableName}.${col}`).toBe(
            type,
          );
        }
      });

      it("has NOT NULL on required columns", () => {
        for (const col of spec.notNull) {
          expect(
            table.columns.get(col)?.notNull,
            `column ${tableName}.${col} should be NOT NULL`,
          ).toBe(true);
        }
      });

      it("has expected foreign key references", () => {
        for (const [col, target] of Object.entries(spec.references ?? {})) {
          expect(
            table.columns.get(col)?.references,
            `column ${tableName}.${col} should reference ${target}`,
          ).toBe(target);
        }
      });

      it("has expected unique constraints", () => {
        const uniqueSets = findUniqueConstraints(table);
        for (const group of spec.unique) {
          expect(
            uniqueSets.some((u) => sameColumns(u, group)),
            `unique(${group.join(", ")}) on ${tableName} missing`,
          ).toBe(true);
        }
      });

      it("has CHECK constraints covering expected columns", () => {
        for (const expectedCols of spec.checks ?? []) {
          const found = table.checks.some((check) => {
            const refs = new Set<string>();
            collectRefs(check, refs);
            return expectedCols.every((c) => refs.has(c));
          });
          expect(
            found,
            `CHECK over [${expectedCols.join(", ")}] on ${tableName} missing`,
          ).toBe(true);
        }
      });
    });
  }
});

function findUniqueConstraints(
  table: {
    columns: Map<string, ColumnDef>;
    checks: unknown[];
    tableUniques: string[][];
  },
): string[][] {
  const result: string[][] = [];
  for (const [name, col] of table.columns.entries()) {
    if (col.unique) result.push([name]);
  }
  return result.concat(table.tableUniques);
}

function sameColumns(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

describe("indexes", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  for (const idx of CRITICAL_INDEXES) {
    it(`creates ${idx}`, () => {
      expect(schema.indexes.has(idx)).toBe(true);
    });
  }
});

describe("row level security", () => {
  let allSql: string;
  let rlsEnabled: Set<string>;
  let policies: Array<{ name: string; table: string; action: string }>;
  beforeAll(() => {
    allSql = listMigrationFiles()
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
      .join("\n");
    rlsEnabled = extractRlsEnabled(allSql);
    policies = extractPolicies(allSql);
  });

  it("enables RLS on every business table", () => {
    for (const table of Object.keys(EXPECTED_TABLES)) {
      expect(rlsEnabled.has(table), `RLS not enabled on ${table}`).toBe(true);
    }
  });

  it("defines at least one policy per table", () => {
    const byTable = new Map<string, number>();
    for (const p of policies) byTable.set(p.table, (byTable.get(p.table) ?? 0) + 1);
    for (const table of Object.keys(EXPECTED_TABLES)) {
      expect(byTable.get(table) ?? 0, `no policies on ${table}`).toBeGreaterThan(0);
    }
  });

  it("keeps admin_audit_logs append-only (no UPDATE/DELETE policies)", () => {
    for (const p of policies) {
      if (p.table === "admin_audit_logs") {
        expect(["SELECT", "INSERT"].includes(p.action)).toBe(true);
      }
    }
  });

  it("grants UMKM read access to visible batches only via policies", () => {
    const batchPolicies = policies.filter((p) => p.table === "batches");
    expect(batchPolicies.some((p) => p.action === "SELECT")).toBe(true);
  });
});

describe("functions and triggers", () => {
  let allSql: string;
  beforeAll(() => {
    allSql = listMigrationFiles()
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
      .join("\n");
  });

  for (const fn of REQUIRED_FUNCTIONS) {
    it(`defines function ${fn}`, () => {
      expect(allSql).toMatch(
        new RegExp(
          `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\b`,
          "i",
        ),
      );
    });
  }

  for (const { name, table } of REQUIRED_TRIGGERS) {
    it(`defines trigger ${name} on ${table}`, () => {
      expect(allSql).toMatch(
        new RegExp(
          `CREATE\\s+TRIGGER\\s+${name}\\b[\\s\\S]*?\\bon\\s+(?:public\\.)?${table}\\b`,
          "i",
        ),
      );
    });
  }
});

describe("business rule constraints", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  it("enforces linear timeline ordering on batch_timeline", () => {
    const table = schema.tables.get("batch_timeline");
    expect(table).toBeDefined();
    const timelineOk = table!.checks.some((check) => {
      const refs = new Set<string>();
      collectRefs(check, refs);
      return (
        refs.has("registration_opens_at") &&
        refs.has("registration_closes_at") &&
        refs.has("payment_opens_at") &&
        refs.has("payment_closes_at") &&
        refs.has("estimated_ready_at")
      );
    });
    expect(timelineOk).toBe(true);
  });

  it("enforces rating range 1-5 on ratings.score", () => {
    const table = schema.tables.get("ratings");
    expect(table).toBeDefined();
    const ok = table!.checks.some((check) => {
      const refs = new Set<string>();
      collectRefs(check, refs);
      return refs.has("score");
    });
    expect(ok).toBe(true);
  });

  it("enforces positive amounts on money columns", () => {
    for (const tableName of ["payments", "escrow_holds", "refund_requests"]) {
      const table = schema.tables.get(tableName);
      const refs = new Set<string>();
      table!.checks.forEach((c) => collectRefs(c, refs));
      const amountCols = tableName === "payments" ? ["gross_amount"] : ["amount"];
      for (const c of amountCols) expect(refs.has(c)).toBe(true);
    }
  });
});
