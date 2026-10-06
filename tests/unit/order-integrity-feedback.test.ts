import {describe,it,expect} from 'vitest';
import {derivePaymentProgress} from '@/lib/payments/progress';
const input={status:'cancelled',invoiceStatus:'pending',attempt:null,now:'2026-10-02T10:00:00Z',opensAt:'2026-10-02T00:00:00Z',closesAt:'2026-10-03T00:00:00Z',cancellationReason:null,batchStatus:'closed'};
describe('order integrity feedback',()=>{
 it('blocks checkout and requests inspection for unexplained premature cancellation',()=>expect(derivePaymentProgress(input)).toMatchObject({canOpenCheckout:false,blockedCode:'ORDER_STATUS_INCONSISTENT',integrityIssue:'unexplained_cancellation_before_deadline'}));
 it('recognizes a cancelled order with confirmed invoice',()=>expect(derivePaymentProgress({...input,invoiceStatus:'paid'})).toMatchObject({canOpenCheckout:false,blockedCode:'ORDER_STATUS_INCONSISTENT',integrityIssue:'cancelled_with_paid_invoice'}));
 it('does not flag legitimate supplier cancellation',()=>expect(derivePaymentProgress({...input,batchStatus:'cancelled',cancellationReason:'supplier_cancel'}).blockedCode).toBe('ORDER_CANCELLED'));
 it('does not reopen checkout after deadline',()=>expect(derivePaymentProgress({...input,now:input.closesAt}).canOpenCheckout).toBe(false));
});
