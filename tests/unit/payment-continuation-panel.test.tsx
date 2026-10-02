// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import UmkmPaymentPanel from "@/components/payments/UmkmPaymentPanel";
vi.mock("@/components/payments/usePaymentWindowCountdown", () => ({usePaymentWindowCountdown: (_now: string, deadline: string) => ({state:Date.parse(deadline)>Date.parse("2026-10-02T09:00:00Z") ? "running" : "expired",formatted:"11:45:00",urgency:"normal"})}));
vi.mock("@/components/payments/MidtransSnapLoader", () => ({default:()=>null}));
const order = { id:"order",status:"pending_payment",phase:"payment_open",quantity:111,unit:"kg",lockedUnitPrice:70000,finalAmount:7770000,lockedTier:3,batchDisplayCode:"BATCH-UJI",serverTime:"2026-10-02T09:00:00Z",timeline:{paymentOpensAt:"2026-10-01T20:45:00Z",paymentClosesAt:"2026-10-02T20:45:00Z"},capabilities:{canPay:true},invoice:{grossAmount:7770000},paymentAttempt:{id:"attempt",status:"expired",providerStatus:"expire",paymentMethod:null,checkoutMode:"snap",expiresAt:"2026-10-02T08:00:00Z"},paymentProgress:{state:"failed",canOpenCheckout:true,canCheckStatus:true,lastCheckedAt:null,blockedReason:null}} as unknown as UmkmOrderDetail;
afterEach(cleanup);
describe("payment panel deadlines",()=>{
  it("offers inspection instead of checkout for inconsistent cancelled invoices",()=>{
    render(<UmkmPaymentPanel order={{...order,status:"cancelled",phase:"cancelled",paymentAttempt:null,paymentProgress:{...order.paymentProgress!,state:"status_unknown",canOpenCheckout:false,canCheckStatus:false,blockedCode:"ORDER_STATUS_INCONSISTENT",integrityIssue:"cancelled_with_paid_invoice",blockedReason:"Muat ulang detail atau hubungi bantuan transaksi sebelum membayar."}}} onReload={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Status pesanan perlu diperiksa");
    expect(screen.getByRole("button",{name:"Muat ulang detail"})).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Bayar sekarang"})).toBeNull();
  });
  it("offers retry when only the previous checkout expired",()=>{
    render(<UmkmPaymentPanel order={order} onReload={vi.fn()} />);
    expect(screen.getByRole("button",{name:"Coba bayar lagi"})).toBeTruthy();
    expect(screen.queryByText("Waktu pembayaran berakhir")).toBeNull();
  });
  it("describes cancellation without a false expiry message",()=>{
    render(<UmkmPaymentPanel order={{...order,status:"cancelled",phase:"cancelled",paymentAttempt:null,paymentProgress:{...order.paymentProgress!,state:"cancelled" as never,canOpenCheckout:false,canCheckStatus:false}}} onReload={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Pesanan dibatalkan");
    expect(screen.queryByText("Waktu pembayaran berakhir")).toBeNull();
  });
});
