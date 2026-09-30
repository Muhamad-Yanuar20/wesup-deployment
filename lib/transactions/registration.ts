import { acquireCutoffLock, releaseCutoffLock, reserveVolumeCounter, restoreVolumeCounter } from "@/lib/orders/registration-counter";
import type { TransactionRpcClient } from "./api";

/** DB volume is authoritative; all HTTP writers share the cutoff lock. */
export async function withRegistrationLock<T>(batchId: string, operation: () => Promise<T>) {
  const lock = await acquireCutoffLock(batchId);
  if (!lock.acquired) throw { code: "55000", message: "Batch sedang diperbarui. Coba lagi." };
  try { return await operation(); } finally { await releaseCutoffLock(batchId, lock.token); }
}

export async function joinVersionedBatch(client: TransactionRpcClient, input: { batchId: string; quantity: number; capacity: number; consentLat: number | null; consentLng: number | null; consentSnapshot:Record<string,unknown> }): Promise<Record<string,unknown> & {count:number;batchClosed:boolean}> {
  return withRegistrationLock(input.batchId, async () => {
    const volume = await client.rpc("get_registration_volume_v2", { p_batch_id: input.batchId });
    if (volume.error) throw volume.error;
    const snapshot = volume.data as { quantity: number; registrationId: string | null; registered: boolean; batchClosed?:boolean;phase?:string;deadlineAt?:string;capabilities?:Record<string,boolean>;blockedReason?:string|null };
    await restoreVolumeCounter(input.batchId, snapshot.quantity);
    if (!snapshot.registered) await reserveVolumeCounter(input.batchId, input.quantity, input.capacity);
    let joined:{data:unknown;error:unknown}={data:null,error:null};
    let transportError:unknown;
    try { joined = await client.rpc("join_batch_v2", { p_batch_id: input.batchId, p_quantity: input.quantity, p_terms: { ...input.consentSnapshot,accepted: true }, p_consent_lat: input.consentLat, p_consent_lng: input.consentLng }); }
    catch(error) {transportError=error;}
    // Resync after success OR rollback, so failed or duplicate reservations cannot leak capacity.
    const current = await Promise.resolve(client.rpc("get_registration_volume_v2", { p_batch_id: input.batchId })).catch(()=>({data:null,error:{code:'TRANSPORT_UNAVAILABLE'}}));
    if (!current.error) await restoreVolumeCounter(input.batchId, (current.data as { quantity: number }).quantity).catch(() => undefined);
    if (joined.error) throw joined.error;
    if(transportError) {
      const recovered=current.data as {quantity:number;registered:boolean;registrationId:string|null;batchClosed?:boolean;phase?:string;deadlineAt?:string}|null;
      if(!current.error&&recovered?.registered&&recovered.registrationId) return {...recovered,registrationId:recovered.registrationId,count:recovered.quantity,batchClosed:recovered.batchClosed??false,recovered:true};
      throw transportError;
    }
    return { ...(joined.data as Record<string, unknown>), count: (current.data as { quantity: number } | null)?.quantity ?? snapshot.quantity, batchClosed: Boolean((joined.data as Record<string,unknown>)?.batchClosed ?? (current.data as Record<string,unknown>)?.batchClosed) };
  });
}
