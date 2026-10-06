import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { GET as getTransactions } from "@/app/api/suppliers/batches/[id]/transactions/route";
import { POST as closeBatch } from "@/app/api/suppliers/batches/[id]/close/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));

const mockGetServerClient = vi.mocked(getServerClient);
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

function client(options: {
  materializeError?: unknown;
  snapshotError?: unknown;
} = {}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "get_supplier_batch_transaction") return options.snapshotError
      ? { data: null, error: options.snapshotError }
      : { data: { batch: { id: BATCH_ID }, summary: {}, orders: [], serverTime: "2026-09-15T00:00:00Z" }, error: null };
    if (name === "materialize_supplier_batch") return { data: { closed: false }, error: options.materializeError ?? null };
    if (name === "close_batch_and_issue_invoices") return { data: { closed: true, invoiceCount: 2 }, error: null };
    return { data: null, error: null };
  });
  const value = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "supplier@example.com" } }, error: null })) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "supplier", status: "active", full_name: "Supplier" }, error: null })) })) })) })),
    rpc,
  };
  mockGetServerClient.mockResolvedValue(value as never);
  return { rpc };
}

function clientWithBoundRpc() {
  const expectedClient: { rpc?: unknown } = {};
  const rpc = vi.fn(function (this: unknown, name: string) {
    if (this !== expectedClient) throw new Error("rpc binding lost");
    if (name === "materialize_supplier_batch") return Promise.resolve({ data: { closed: false }, error: null });
    return Promise.resolve({ data: { batch: { id: BATCH_ID }, summary: {}, orders: [], serverTime: "2026-09-15T00:00:00Z" }, error: null });
  });
  Object.assign(expectedClient, {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "supplier@example.com" } }, error: null })) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "supplier", status: "active", full_name: "Supplier" }, error: null })) })) })) })),
    rpc,
  });
  mockGetServerClient.mockResolvedValue(expectedClient as never);
  return { rpc };
}

describe("Supplier transaction APIs", () => {
  beforeEach(() => mockGetServerClient.mockReset());

  it("materializes lazily and returns the transaction snapshot", async () => {
    const { rpc } = client();
    const response = await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("materialize_supplier_batch", { p_batch_id: BATCH_ID });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ item: expect.objectContaining({ batch: { id: BATCH_ID } }) }));
  });

  it("closes a batch and issues invoices through the guarded RPC", async () => {
    const { rpc } = client();
    const response = await closeBatch(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/close`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("close_batch_and_issue_invoices", expect.objectContaining({ p_batch_id: BATCH_ID, p_trigger: "supplier_manual" }));
  });

  it("returns a retryable schema error and does not read the snapshot when materialization RPC is missing", async () => {
    const missingRpc = { code: "PGRST202", message: "Could not find the function public.materialize_supplier_batch(p_batch_id) in the schema cache" };
    const { rpc } = client({ materializeError: missingRpc });
    const response = await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "SUPPLIER_SCHEMA_NOT_READY", requestId: expect.any(String) }));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("materialize_supplier_batch", { p_batch_id: BATCH_ID });
  });

  it("returns a retryable schema error when snapshot RPC is missing", async () => {
    const missingRpc = { code: "PGRST202", message: "Could not find the function public.get_supplier_batch_transaction(p_batch_id) in the schema cache" };
    const { rpc } = client({ snapshotError: missingRpc });
    const response = await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "SUPPLIER_SCHEMA_NOT_READY", requestId: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("get_supplier_batch_transaction", { p_batch_id: BATCH_ID });
  });

  it("classifies the ambiguous-status lifecycle defect without leaking SQL details", async () => {
    const { rpc } = client({ materializeError: { code: "42702", message: 'column reference "status" is ambiguous' } });
    const response = await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      code: "SUPPLIER_LIFECYCLE_RPC_INVALID",
      requestId: expect.any(String),
      error: expect.not.stringContaining("ambiguous"),
    }));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps the Supabase client binding while invoking RPCs", async () => {
    const { rpc } = clientWithBoundRpc();
    const response = await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenLastCalledWith("get_offer_context",{p_batch_id:BATCH_ID});
  });

  it.each(["PGRST202", "42883", "42P01", "PGRST205"])("maps schema error %s to a retryable response", async (code) => {
    const { rpc } = client({ snapshotError: { code, message: "postgresql://secret-value" } });
    const response = await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "SUPPLIER_SCHEMA_NOT_READY" }));
    expect(rpc).toHaveBeenCalledWith("get_supplier_batch_transaction", { p_batch_id: BATCH_ID });
  });

  it("logs only safe request metadata for RPC failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      client({ materializeError: { code: "PGRST202", message: "postgresql://secret-value" } });
      await getTransactions(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/transactions`), { params: Promise.resolve({ id: BATCH_ID }) });
      expect(log).toHaveBeenCalledWith("[supplier-transactions] materialize failed", expect.objectContaining({ requestId: expect.any(String), code: "PGRST202" }));
      expect(JSON.stringify(log.mock.calls)).not.toContain("postgresql://secret-value");
    } finally {
      log.mockRestore();
    }
  });
});

it("waits for materialization, then reads snapshot and offer context in parallel",async()=>{
 const {rpc}=client();
 let materialize!:(value:unknown)=>void,snapshot!:(value:unknown)=>void,context!:(value:unknown)=>void;
 rpc.mockImplementation(((name:string)=>new Promise(resolve=>{
  if(name==="materialize_supplier_batch")materialize=resolve;
  if(name==="get_supplier_batch_transaction")snapshot=resolve;
  if(name==="get_offer_context")context=resolve;
 })) as never);
 const pending=getTransactions(new NextRequest("http://localhost/api/transactions"),{params:Promise.resolve({id:BATCH_ID})});
 await vi.waitFor(()=>expect(materialize).toBeTypeOf("function"));
 expect(rpc).toHaveBeenCalledTimes(1);
 materialize({data:{closed:false},error:null});
 await vi.waitFor(()=>{expect(snapshot).toBeTypeOf("function");expect(context).toBeTypeOf("function");});
 snapshot({data:{batch:{id:BATCH_ID},orders:[]},error:null});context({data:null,error:null});
 const result=await pending;expect(result.status).toBe(200);
 expect(result.headers.get("server-timing")).toMatch(/materialize.*snapshot|materialize.*context/);
});
