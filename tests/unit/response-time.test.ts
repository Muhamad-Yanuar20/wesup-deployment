import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/auth/session/route";
const { server } = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServerClient: server }));
describe("response-time regressions", () => {
 beforeEach(() => vi.clearAllMocks());
 it("reads user/profile once when returning the session and access state", async () => {
  const getUser=vi.fn(async()=>({data:{user:{id:"u",email:"u@example.com"}},error:null}));
  const profile=vi.fn(async()=>({data:{role:"supplier",status:"active",full_name:"Supplier"},error:null}));
  const supplier=vi.fn(async()=>({data:{verification_status:"approved"},error:null}));
  server.mockResolvedValue({auth:{getUser},from:(table:string)=>({select:()=>({eq:()=>table==="profiles"?{single:profile}:{maybeSingle:supplier}})})});
  const response=await GET(); expect(response.status).toBe(200);
  expect(getUser).toHaveBeenCalledTimes(1);expect(profile).toHaveBeenCalledTimes(1);expect(supplier).toHaveBeenCalledTimes(1);
  expect(response.headers.get("server-timing")).toMatch(/auth/);
 });
 it("returns temporary unavailability rather than logout on auth transport failure", async()=>{
  server.mockResolvedValue({auth:{getUser:async()=>({data:{user:null},error:new TypeError("fetch failed")})}});
  expect((await GET()).status).toBe(503);
 });
});
