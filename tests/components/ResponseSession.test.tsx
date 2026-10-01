// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetReadRequests } from "@/lib/feedback/read-request";
import { NavigationSessionProvider, useNavigationSession } from "@/components/auth/NavigationSessionProvider";
const nav=vi.hoisted(()=>({path:"/supplier"}));
vi.mock("next/navigation",()=>({usePathname:()=>nav.path}));
const supplier={role:"supplier",status:"active",verificationStatus:"approved"} as const;
function Probe(){const s=useNavigationSession();return <button onClick={()=>{void s.refreshSession();void s.refreshSession();}}>Refresh</button>;}
beforeEach(()=>{nav.path="/supplier";vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(()=>{})));});
it("uses the fresh server snapshot on hydration and navigation",async()=>{
 const view=render(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{});expect(fetch).not.toHaveBeenCalled();
 nav.path="/supplier/catalog";view.rerender(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{});expect(fetch).not.toHaveBeenCalled();
});
it("coalesces concurrent session checks",async()=>{
 render(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{fireEvent.click(screen.getByText("Refresh"));});expect(fetch).toHaveBeenCalledTimes(1);
});

afterEach(()=>{resetReadRequests();vi.useRealTimers();});
it("refreshes an aged snapshot when returning to the tab, but not while fresh",async()=>{
 vi.useFakeTimers();
 render(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{window.dispatchEvent(new Event("focus"));});expect(fetch).not.toHaveBeenCalled();
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);window.dispatchEvent(new Event("focus"));});
 expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>{window.dispatchEvent(new Event("focus"));});expect(fetch).toHaveBeenCalledTimes(1);
});
it("refreshes an aged snapshot after navigation",async()=>{
 vi.useFakeTimers();
 const view=render(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
 nav.path="/supplier/catalog";
 view.rerender(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{});expect(fetch).toHaveBeenCalledTimes(1);
});

it("revalidates a visible idle tab after sixty seconds",async()=>{
 vi.useFakeTimers();
 render(<NavigationSessionProvider initialAccessState={supplier}><Probe/></NavigationSessionProvider>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(59999);});expect(fetch).not.toHaveBeenCalled();
 await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(fetch).toHaveBeenCalledTimes(1);
});
