import {describe,expect,it} from "vitest";
import {INCIDENT_ORDER,recoveryBlockers} from "../../scripts/recover-payment-continuation.mjs";
const row={id:INCIDENT_ORDER,quantity:111,final_amount:7770000,status:"cancelled",cancellation_reason:null,batch_status:"closed",opens_at:"2026-10-01T20:45:00Z",closes_at:"2026-10-02T20:45:00Z",invoice_status:"pending",gross_amount:7770000,has_attempt:false,has_provider_evidence:false,has_escrow:false,has_refund:false,premature_audit:true};
const now=Date.parse("2026-10-02T09:00:00Z");
describe("incident recovery eligibility",()=>{
 it("allows only the verified incident while payment is open",()=>expect(recoveryBlockers(row,now)).toEqual([]));
 it("never restores other orders",()=>expect(recoveryBlockers({...row,id:"another-order"},now)).toContain("incident_identity_mismatch"));
 it("stops exactly at the deadline",()=>expect(recoveryBlockers(row,Date.parse(row.closes_at))).toContain("payment_window_not_open"));
 it.each(["has_attempt","has_provider_evidence","has_escrow","has_refund"])("requires reconciliation when %s exists",key=>expect(recoveryBlockers({...row,[key]:true},now)).toContain("financial_reconciliation_required"));
 it("preserves deliberate cancellation",()=>expect(recoveryBlockers({...row,cancellation_reason:"buyer_withdrawal"},now)).toContain("not_unexplained_cancellation"));
 it("requires matching invoice and audit evidence",()=>expect(recoveryBlockers({...row,gross_amount:1,premature_audit:false},now)).toEqual(["invoice_not_payable","cancellation_not_verified"]));
});
