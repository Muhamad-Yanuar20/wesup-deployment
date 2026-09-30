import {beforeEach,describe,it,expect,vi} from 'vitest';
import {joinVersionedBatch} from '@/lib/transactions/registration';
import {acquireCutoffLock,releaseCutoffLock,reserveVolumeCounter,restoreVolumeCounter} from '@/lib/orders/registration-counter';
vi.mock('@/lib/orders/registration-counter',()=>({acquireCutoffLock:vi.fn(),releaseCutoffLock:vi.fn(),reserveVolumeCounter:vi.fn(),restoreVolumeCounter:vi.fn()}));
const input={batchId:'batch',quantity:2,capacity:10,consentLat:null,consentLng:null,consentSnapshot:{maximumUnitPrice:10000}};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(acquireCutoffLock).mockResolvedValue({acquired:true,token:'owned-token'});vi.mocked(restoreVolumeCounter).mockResolvedValue();vi.mocked(releaseCutoffLock).mockResolvedValue();vi.mocked(reserveVolumeCounter).mockResolvedValue(2);});
describe('authoritative registration recovery',()=>{
 it('recovers a committed registration when the response was lost',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:{quantity:0,registered:false},error:null}).mockRejectedValueOnce(new Error('network lost')).mockResolvedValueOnce({data:{quantity:2,registered:true,registrationId:'same-order'},error:null});
  expect(await joinVersionedBatch({rpc},input)).toMatchObject({registrationId:'same-order',count:2});
  expect(restoreVolumeCounter).toHaveBeenLastCalledWith('batch',2);expect(releaseCutoffLock).toHaveBeenCalledWith('batch','owned-token');
 });
 it('resyncs rolled-back reservations even when transport failed',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:{quantity:3,registered:false},error:null}).mockRejectedValueOnce(new Error('network lost')).mockResolvedValueOnce({data:{quantity:3,registered:false},error:null});
  await expect(joinVersionedBatch({rpc},input)).rejects.toThrow('network lost');
  expect(restoreVolumeCounter).toHaveBeenCalledTimes(2);expect(restoreVolumeCounter).toHaveBeenLastCalledWith('batch',3);expect(releaseCutoffLock).toHaveBeenCalled();
 });
 it('does not reserve another slot when retrying an existing registration',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:{quantity:2,registered:true,registrationId:'order'},error:null}).mockResolvedValueOnce({data:{registrationId:'order'},error:null}).mockResolvedValueOnce({data:{quantity:2,registered:true},error:null});
  await joinVersionedBatch({rpc},input);expect(reserveVolumeCounter).not.toHaveBeenCalled();
 });
 it('rejects a competing write before touching Redis volume or SQL',async()=>{
  vi.mocked(acquireCutoffLock).mockResolvedValue({acquired:false,token:''});const rpc=vi.fn();
  await expect(joinVersionedBatch({rpc},input)).rejects.toMatchObject({code:'55000'});expect(rpc).not.toHaveBeenCalled();
 });
});
