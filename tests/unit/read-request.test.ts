import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchRead, resetReadRequests } from "@/lib/feedback/read-request";
import { withinReadBudget } from "@/lib/performance/read-budget";
beforeEach(()=>vi.useFakeTimers());afterEach(()=>{resetReadRequests();vi.useRealTimers();vi.unstubAllGlobals();});
it("shares an in-flight GET and gives independent response bodies",async()=>{
 let done!:(r:Response)=>void;vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(r=>done=r)));
 const a=fetchRead("/api/example"),b=fetchRead("/api/example");done(new Response('{"ok":true}'));
 expect(await (await a).json()).toEqual({ok:true});expect(await (await b).json()).toEqual({ok:true});expect(fetch).toHaveBeenCalledTimes(1);
});
it("keeps a StrictMode remount attached while releasing the old subscriber",async()=>{
 let done!:(r:Response)=>void;vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(r=>done=r)));
 const c=new AbortController();const a=fetchRead("/api/example",{signal:c.signal}).catch(e=>e.name);c.abort();
 const b=fetchRead("/api/example");await Promise.resolve();done(new Response('{}'));
 expect(await a).toBe("AbortError");await b;expect(fetch).toHaveBeenCalledTimes(1);
});
it("clears pending reads across an account change",async()=>{
 vi.stubGlobal("fetch",vi.fn((_url,options)=>new Promise((_r,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason)))));
 const read=fetchRead('/api/example').catch(e=>e.name);resetReadRequests();expect(await read).toBe('AbortError');
});
it("bounds a hanging read to eight seconds without retry",async()=>{
 vi.stubGlobal("fetch",vi.fn((_url,options)=>new Promise((_r,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason)))));
 const result=fetchRead('/api/example').catch(e=>e.name);await vi.advanceTimersByTimeAsync(8000);expect(await result).toBe('ReadTimeoutError');expect(fetch).toHaveBeenCalledTimes(1);
});
it("bounds a server read without retry",async()=>{
 const result=withinReadBudget(new Promise(()=>{})).catch(e=>e.name);await vi.advanceTimersByTimeAsync(8000);expect(await result).toBe('ReadTimeoutError');
});
