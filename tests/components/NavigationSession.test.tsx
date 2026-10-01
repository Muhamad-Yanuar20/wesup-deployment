// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationSessionProvider, useNavigationSession } from "@/components/auth/NavigationSessionProvider";
import { NavigationBar } from "@/components/layout/NavigationBar";
import LoginForm from "@/components/auth/LoginForm";
import { ToastProvider } from "@/components/ui/GlobalToast";
import type { UserAccessState } from "@/lib/auth/access-state";

const navigation = vi.hoisted(() => ({ pathname: "/supplier/catalog", replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, refresh: navigation.refresh }),
}));
const supplier: UserAccessState = { role: "supplier", status: "active", verificationStatus: "approved" };
const buyer: UserAccessState = { role: "umkm", status: "active", profileComplete: true };
function RefreshSession() {
  const { refreshSession } = useNavigationSession();
  return <button onClick={() => void refreshSession()}>Periksa sesi</button>;
}

describe("persistent navigation session", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    navigation.pathname = "/supplier/catalog";
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  });

  it("renders supplier links immediately while a session check is pending", () => {
    render(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /></NavigationSessionProvider>);
    expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Masuk" })).not.toBeInTheDocument();
  });

  it("retains the resolved role when the navigation bar remounts during loading", () => {
    const view = render(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /></NavigationSessionProvider>);
    view.rerender(<NavigationSessionProvider initialAccessState={supplier}><div>Memuat konten</div></NavigationSessionProvider>);
    navigation.pathname = "/supplier/notifikasi";
    view.rerender(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /></NavigationSessionProvider>);
    expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Masuk" })).not.toBeInTheDocument();
  });

  it.each(["network", "server"])("keeps the previous menu on a %s failure", async failure => {
    vi.mocked(fetch).mockImplementation(async () => {
      if (failure === "network") throw new Error("offline");
      return new Response("Unavailable", { status: 503 });
    });
    render(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /><RefreshSession /></NavigationSessionProvider>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Periksa sesi" })); });
    expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Masuk" })).not.toBeInTheDocument();
  });

  it.each([401, 403])("clears workspace links after an authoritative %s", async status => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
    render(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /><RefreshSession /></NavigationSessionProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Periksa sesi" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Masuk" })).toHaveLength(2));
    expect(screen.queryByRole("link", { name: "Katalog" })).not.toBeInTheDocument();
  });

  it("uses refreshed server state immediately rather than the previous role", () => {
    const view = render(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /></NavigationSessionProvider>);
    view.rerender(<NavigationSessionProvider initialAccessState={buyer}><NavigationBar /></NavigationSessionProvider>);
    expect(screen.getAllByRole("link", { name: "Marketplace" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Katalog" })).not.toBeInTheDocument();
    view.rerender(<NavigationSessionProvider initialAccessState={null}><NavigationBar /></NavigationSessionProvider>);
    expect(screen.getAllByRole("link", { name: "Masuk" })).toHaveLength(2);
  });

  it("refreshes a guest session after login", async () => {
    render(<NavigationSessionProvider initialAccessState={null}><NavigationBar /><RefreshSession /></NavigationSessionProvider>);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ accessState: supplier }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Periksa sesi" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2));
  });

  it("updates the shared menu when the actual login form succeeds", async () => {
    let loggedIn = false;
    vi.mocked(fetch).mockImplementation(async url => {
      if (url === "/api/auth/login") {
        loggedIn = true;
        return new Response(JSON.stringify({ user: { email: "fixture@example.com" },
          profile: { role: "supplier", status: "active", fullName: "Fixture" }, accessState: supplier, redirectTo: "/supplier" }), { status: 200 });
      }
      return loggedIn ? new Response(JSON.stringify({ accessState: supplier }), { status: 200 }) : new Response("{}", { status: 401 });
    });
    render(<NavigationSessionProvider initialAccessState={null}><ToastProvider>
      <NavigationBar /><LoginForm fixedRole="supplier" />
    </ToastProvider></NavigationSessionProvider>);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "fixture@example.com" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "fixture-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk ke akun" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Katalog" })).toHaveLength(2));
    expect(screen.queryByRole("link", { name: "Masuk" })).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/supplier");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("prevents a stale session response from restoring links after logout", async () => {
    let resolveSession!: (response: Response) => void;
    let reads = 0;
    vi.mocked(fetch).mockImplementation((url) => url === "/api/auth/logout"
      ? Promise.resolve(new Response("{}", { status: 200 }))
      : ++reads === 1 ? new Promise(resolve => { resolveSession = resolve; }) : Promise.resolve(new Response("{}", { status: 401 })));
    render(<NavigationSessionProvider initialAccessState={supplier}><NavigationBar /><RefreshSession /></NavigationSessionProvider>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Periksa sesi" })); });
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Keluar" }).at(-1)!);
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Masuk" })).toHaveLength(2));
    await act(async () => { resolveSession(new Response(JSON.stringify({ accessState: supplier }), { status: 200 })); });
    expect(screen.queryByRole("link", { name: "Katalog" })).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/");
  });
});
