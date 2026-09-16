// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MidtransSnapLoader, { getInitialSnapLoaderState, type SnapLoaderState } from "@/components/payments/MidtransSnapLoader";
import { renderComponent as render } from "./test-utils";

const scriptMock = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));

vi.mock("next/script", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    scriptMock.props.push(props);
    return <div data-testid="snap-script" />;
  },
}));

describe("MidtransSnapLoader", () => {
  it("starts loading when the existing Snap API is absent", () => {
    delete window.snap;
    expect(getInitialSnapLoaderState()).toBe("loading");
  });

  it("forwards the CSP nonce and reports ready/error events", () => {
    scriptMock.props.length = 0;
    const states: SnapLoaderState[] = [];
    render(
      <MidtransSnapLoader
        config={{
          clientKey: "client-key",
          scriptUrl: "https://app.sandbox.midtrans.com/snap/snap.js",
          nonce: "nonce-123",
        }}
        onStateChange={(state) => states.push(state)}
      />,
    );

    expect(screen.getByTestId("snap-script")).toBeInTheDocument();
    expect(scriptMock.props[0]).toMatchObject({
      src: "https://app.sandbox.midtrans.com/snap/snap.js",
      "data-client-key": "client-key",
      nonce: "nonce-123",
    });

    act(() => {
      (scriptMock.props[0].onReady as () => void)();
    });
    act(() => {
      (scriptMock.props[0].onError as () => void)();
    });
    expect(states).toEqual(["ready", "error"]);
  });
});
