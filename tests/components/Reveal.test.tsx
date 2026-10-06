// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Reveal } from "@/components/landing/Reveal";

/*
 * `Reveal` is the landing page's scroll-entry animation primitive. It must
 * never leave content invisible, so the no-intersection-observer and
 * reduced-motion paths all render the "shown" state outright, and these tests
 * pin that fail-open behaviour plus the one-shot observer handshake. The
 * third leg of the contract — scripting unavailable entirely — is a CSS
 * property, not a JS one: the hidden state only applies inside
 * `@media (scripting: enabled)` and is asserted in
 * tests/unit/landing-reveal-css.test.ts.
 */

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let captureCallback: IntersectionCallback | null = null;
let observedElements: Element[] = [];
let disconnected = false;

class MockIntersectionObserver {
  constructor(callback: IntersectionCallback) {
    captureCallback = callback;
  }
  observe(element: Element) {
    observedElements.push(element);
  }
  unobserve() {}
  disconnect() {
    disconnected = true;
  }
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [0];
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function stubIntersectionObserver() {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

function stubMatchMedia({ reducedMotion = false }: { reducedMotion?: boolean } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  captureCallback = null;
  observedElements = [];
  disconnected = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Reveal", () => {
  it("starts hidden and flips to shown once the observer reports an intersection", () => {
    stubIntersectionObserver();
    stubMatchMedia();

    render(
      <Reveal>
        <p>Manifest berjalan</p>
      </Reveal>,
    );

    const wrapper = screen.getByText("Manifest berjalan").parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("data-reveal")).toBe("hidden");

    act(() => {
      captureCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(wrapper?.getAttribute("data-reveal")).toBe("shown");
  });

  it("stays hidden when the observer reports no intersection", () => {
    stubIntersectionObserver();
    stubMatchMedia();

    render(
      <Reveal>
        <p>Masih di bawah lipatan</p>
      </Reveal>,
    );

    const wrapper = screen.getByText("Masih di bawah lipatan").parentElement;
    expect(wrapper?.getAttribute("data-reveal")).toBe("hidden");

    act(() => {
      captureCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    });

    expect(wrapper?.getAttribute("data-reveal")).toBe("hidden");
  });

  it("applies the transition delay from props", () => {
    stubIntersectionObserver();
    stubMatchMedia();

    render(
      <Reveal delayMs={120}>
        <p>Dengan tunda</p>
      </Reveal>,
    );

    const wrapper = screen.getByText("Dengan tunda").parentElement;
    expect(wrapper?.style.transitionDelay).toBe("120ms");
  });

  it("reveals immediately when the user prefers reduced motion, without constructing an observer", async () => {
    stubIntersectionObserver();
    stubMatchMedia({ reducedMotion: true });

    render(
      <Reveal>
        <p>Tanpa gerak</p>
      </Reveal>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const wrapper = screen.getByText("Tanpa gerak").parentElement;
    expect(wrapper?.getAttribute("data-reveal")).toBe("shown");
    expect(captureCallback).toBeNull();
  });

  it("reveals immediately when IntersectionObserver is unavailable (fail-open)", async () => {
    vi.unstubAllGlobals();
    stubMatchMedia();

    render(
      <Reveal>
        <p>Tanpa observer</p>
      </Reveal>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const wrapper = screen.getByText("Tanpa observer").parentElement;
    expect(wrapper?.getAttribute("data-reveal")).toBe("shown");
  });

  it("observes the element it wraps so the toggle is scoped to that node", () => {
    stubIntersectionObserver();
    stubMatchMedia();

    render(
      <Reveal>
        <p>Yang dipantau</p>
      </Reveal>,
    );

    const wrapper = screen.getByText("Yang dipantau").parentElement;
    expect(observedElements).toContain(wrapper);
    expect(observedElements).toHaveLength(1);
  });

  it("disconnects the observer when it unmounts", () => {
    stubIntersectionObserver();
    stubMatchMedia();

    const view = render(
      <Reveal>
        <p>Meninggalkan layar</p>
      </Reveal>,
    );
    expect(disconnected).toBe(false);

    view.unmount();
    expect(disconnected).toBe(true);
  });

  it("merges a caller className with the reveal class", () => {
    stubIntersectionObserver();
    stubMatchMedia();

    render(
      <Reveal className="mt-8">
        <p>Dengan kelas</p>
      </Reveal>,
    );

    const wrapper = screen.getByText("Dengan kelas").parentElement;
    expect(wrapper?.classList.contains("wesup-reveal")).toBe(true);
    expect(wrapper?.classList.contains("mt-8")).toBe(true);
  });
});
