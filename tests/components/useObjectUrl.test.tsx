// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useObjectUrl } from "@/hooks/use-object-url";

afterEach(() => vi.restoreAllMocks());

it("keeps a live preview through Strict Mode and releases it on replacement or clearing", async () => {
  const live = new Set<string>();
  let sequence = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    const url = `blob:preview-${++sequence}`;
    live.add(url);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(url => { live.delete(url); });
  const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
  const { result, rerender, unmount } = renderHook(({ blob }: { blob: Blob | null }) => useObjectUrl(blob), { initialProps: { blob: new Blob(["first"]) as Blob | null }, wrapper });
  await waitFor(() => expect(result.current).not.toBeNull());
  const first = result.current!;
  expect(live.has(first)).toBe(true);
  expect(live.size).toBe(1);
  rerender({ blob: new Blob(["replacement"]) });
  await waitFor(() => expect(result.current).not.toBe(first));
  await waitFor(() => expect(result.current).not.toBeNull());
  expect(live.has(first)).toBe(false);
  expect(live.has(result.current!)).toBe(true);
  rerender({ blob: null });
  await waitFor(() => expect(result.current).toBeNull());
  expect(live.size).toBe(0);
  unmount();
});
