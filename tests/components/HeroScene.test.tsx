// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { BEATS, TARGET_QUOTA_KG, TARGET_REGISTERED_KG } from "@/lib/landing";
import { HeroScene } from "@/components/landing/scene/HeroScene";

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

let restoreWebGL = () => undefined;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  stubMatchMedia();

  // WebGL is absent by default in jsdom, which is the fallback path.
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  restoreWebGL = () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
});

afterEach(() => {
  cleanup();
  restoreWebGL();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HeroScene content", () => {
  it("renders every stage headline into the DOM so the story is readable without WebGL", () => {
    const { container } = render(<HeroScene />);

    for (const beat of BEATS) {
      expect(screen.getByText(beat.title)).toBeInTheDocument();
      expect(screen.getByText(beat.eyebrow)).toBeInTheDocument();
    }

    // Beat copy must not depend on the canvas being mounted.
    expect(container.querySelector("canvas")).toBeNull();
  });

  /**
   * The word stagger splits each headline into one span per word so CSS can
   * delay them. That split is invisible in the design and invisible in the
   * markup, but it is what a screen reader actually walks: without a
   * whole-title node, assistive tech announces the headline as disconnected
   * fragments ("Harga" "Tier" "2" "terkunci" ...) instead of a sentence, and
   * the headline is announced twice if the split is not hidden.
   */
  it("exposes each headline once, as whole words, and hides the staggered spans from assistive tech", () => {
    const { container } = render(<HeroScene />);

    for (const beat of BEATS) {
      const heading = container.querySelector(
        `[data-beat="${beat.index}"] .hero-beat__title`,
      ) as HTMLElement;

      // The split exists: one span per word, which is what makes it a stagger.
      const words = beat.title.split(" ");
      const wordSpans = Array.from(heading.querySelectorAll(".hero-beat__word"));
      expect(wordSpans).toHaveLength(words.length);

      // Every staggered word sits inside the hidden subtree...
      for (const span of wordSpans) {
        expect(span.closest('[aria-hidden="true"]')).not.toBeNull();
      }

      // ...and the exposed remainder is exactly one node holding the full title.
      const exposed = Array.from(heading.childNodes).filter(
        (node) => !(node instanceof HTMLElement && node.getAttribute("aria-hidden") === "true"),
      );
      expect(exposed).toHaveLength(1);
      expect(exposed[0]?.textContent).toBe(beat.title);
    }
  });

  it("stagger delay indices run in reading order so the words cascade", () => {
    const { container } = render(<HeroScene />);

    for (const beat of BEATS) {
      const heading = container.querySelector(
        `[data-beat="${beat.index}"] .hero-beat__title`,
      ) as HTMLElement;
      const wordSpans = Array.from(heading.querySelectorAll(".hero-beat__word"));

      // --i is the animation-delay multiplier in globals.css. If every word
      // resolved to the same index the words would appear simultaneously and
      // the stagger would be dead code that still looks correct in the DOM.
      // The absolute values are not asserted: the headline is staggered after
      // the eyebrow, so it starts at 1 rather than 0. Reading order is the
      // invariant, not the starting point.
      const indices = wordSpans.map((span) => Number((span as HTMLElement).style.getPropertyValue("--i")));
      for (let i = 1; i < indices.length; i += 1) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
    }
  });

  /**
   * The beat is a vertical stack, so its entrance reads top to bottom: eyebrow,
   * headline, body, chip, volume meter. The indices are what encode that. The
   * cutoff beat is the one that carries every block, so it is the one that can
   * be checked for the whole sequence.
   */
  it("staggers each beat block in reading order so the story arrives top to bottom", () => {
    const { container } = render(<HeroScene />);

    const beat = container.querySelector('[data-beat="03"]') as HTMLElement;
    const indexOf = (selector: string) =>
      Number((beat.querySelector(selector) as HTMLElement).style.getPropertyValue("--i"));

    const sequence = [
      indexOf(".hero-beat__eyebrow"),
      indexOf(".hero-beat__title .hero-beat__word"),
      indexOf(".hero-beat__body"),
      indexOf(".hero-beat__chip"),
      indexOf('[data-testid="scene-volume-meter"]'),
    ];

    for (let i = 1; i < sequence.length; i += 1) {
      expect(sequence[i]).toBeGreaterThan(sequence[i - 1]);
    }
  });

  it("confines the escrow reassurance to the registration-cutoff stage", () => {
    const { container } = render(<HeroScene />);

    const beats = container.querySelector(".hero-scene__beats") as HTMLElement;
    const mentions = within(beats).queryAllByText(/escrow/i);
    expect(mentions).toHaveLength(1);
    // Case-insensitive: the chip is free to lead with a capitalised "Escrow".
    expect(mentions[0]).toHaveTextContent(/escrow/i);

    // And it sits on the cutoff beat specifically.
    const cutoffBeat = beats.querySelector('[data-beat="03"]') as HTMLElement;
    expect(within(cutoffBeat).getByText(/escrow/i)).toBeInTheDocument();
  });

  it("reports the registered volume honestly against the quota", () => {
    render(<HeroScene />);

    const meter = screen.getByTestId("scene-volume-meter");
    // The numbers share a text node with the slash and unit, so match the block.
    expect(meter.textContent).toContain(String(TARGET_REGISTERED_KG));
    expect(meter.textContent).toContain(String(TARGET_QUOTA_KG));
    expect(meter.textContent).toContain("kg");
  });

  it("publishes a progressbar that matches the filled share of the quota", () => {
    render(<HeroScene />);

    const bar = screen.getByRole("progressbar", { name: "Volume terkumpul" });
    expect(bar).toHaveAttribute("aria-valuenow", String(Math.round((TARGET_REGISTERED_KG / TARGET_QUOTA_KG) * 100)));
  });

  it("locks the tier the registered volume actually earned", () => {
    render(<HeroScene />);

    const meter = screen.getByTestId("scene-volume-meter");
    // 298 kg clears Tier 2 (250 kg) but not Tier 3 (500 kg).
    expect(meter.textContent).toContain("Tier 2");
    expect(meter.textContent).toContain("Rp 10.500");
    expect(meter.textContent).not.toContain("Rp 8.900");
    expect(screen.queryByText("Rp 8.900")).not.toBeInTheDocument();
  });

  it("keeps both calls to action reachable in every rendering mode", () => {
    render(<HeroScene />);

    expect(screen.getByRole("link", { name: /mulai hemat bersama/i })).toHaveAttribute(
      "href",
      "/register?role=umkm",
    );
    expect(screen.getByRole("link", { name: /lihat penawaran/i })).toHaveAttribute(
      "href",
      "/marketplace",
    );
  });

  it("pins the calls to action inside the overlay column, not after the scroll track", () => {
    const { container } = render(<HeroScene />);

    const overlay = container.querySelector(".hero-scene__overlay") as HTMLElement;
    const viewport = container.querySelector(".hero-scene__viewport") as HTMLElement;

    expect(within(overlay).getByRole("link", { name: /mulai hemat bersama/i })).toBeInTheDocument();
    expect(viewport.querySelector(".hero-scene__cta")).not.toBeNull();
    expect(viewport.nextElementSibling).toBeNull();
  });

  it("exposes the stage rail so progress is legible without the 3D scene", () => {
    render(<HeroScene />);

    const rail = screen.getByTestId("scene-stage-rail");
    for (const beat of BEATS) {
      expect(within(rail).getByText(beat.index)).toBeInTheDocument();
    }
  });
});

/**
 * The readability wash is a separate full-bleed layer rather than a background
 * on the type overlay. When it was a background on `.hero-scene__overlay` the
 * element was also the page container (`max-w-6xl`), so above 1152px the white
 * band was clipped to that column: it started dead at the container's left edge
 * with zero alpha beside it, and its fade died before reaching the screen edge.
 * These tests pin the split that removes the seam.
 */
describe("HeroScene wash", () => {
  it("washes from the left screen edge across half the viewport", () => {
    const { container } = render(<HeroScene />);

    const wash = screen.getByTestId("hero-scene-wash");
    const viewport = container.querySelector(".hero-scene__viewport") as HTMLElement;
    const overlay = container.querySelector(".hero-scene__overlay") as HTMLElement;

    // Anchored to the viewport's left edge and half the screen wide, so the
    // gradient reaches zero alpha at the element's own right edge. A cap or a
    // percentage of anything but the viewport brings the seam back. The desktop
    // width is owned by the stylesheet (see below), not an arbitrary Tailwind
    // class, so the layout hook stays assertable here and editable at the seam
    // in globals.css.
    expect(wash.className).toContain("left-0");
    expect(wash.className).toContain("hero-scene__wash");
    expect(wash.className).not.toContain("w-[52vw]");

    // Its own layer, a sibling of the overlay, not the overlay's background.
    expect(wash.parentElement).toBe(viewport);
    expect(overlay.contains(wash)).toBe(false);
  });

  it("owns the desktop wash width in the stylesheet, not in a Tailwind class", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    // The base rule is full-bleed; the 768px media query switches to 52vw. This
    // source-reading pin exists because the seam the browser pass measured is
    // governed by this width, and a class-name assertion can no longer see it
    // once it lives in CSS.
    const baseBlock = css.match(/\.hero-scene__wash\s*\{[^}]*\}/)?.[0] ?? "";
    expect(baseBlock).toContain("width: 100%");
    const desktopBlock = css.match(/@media\s*\(min-width:\s*768px\)\s*\{[^}]*\.hero-scene__wash\s*\{[^}]*width:\s*52vw[^}]*\}/)?.[0] ?? "";
    expect(desktopBlock).toContain("width: 52vw");
  });

  it("aligns the type overlay with the page container the fixed header uses", () => {
    const { container } = render(<HeroScene />);

    const overlay = container.querySelector(".hero-scene__overlay") as HTMLElement;

    // Same classes as the header's inner row (app/page.tsx), so the headline
    // lands on the wordmark's left edge at every breakpoint by construction.
    // Reproducing that edge with a calc() would have to duplicate every
    // container breakpoint, and drifts above 2xl where container is 128rem.
    expect(overlay.className).toContain("container");
    expect(overlay.className).not.toContain("max-w-6xl");
  });

  it("keeps the wash out of the accessibility tree and off the pointer", () => {
    render(<HeroScene />);

    const wash = screen.getByTestId("hero-scene-wash");
    expect(wash).toHaveAttribute("aria-hidden", "true");
    // The wash sits above the canvas and below the type; it must never eat a
    // click meant for the calls to action.
    expect(wash.className).toContain("pointer-events-none");
  });
});

describe("HeroScene mobile compression", () => {
  it("hides the decorative stage rail on phones to free the paper band for copy", () => {
    /* The phone panel carries the full copy stack inside the bottom paper band;
     * the rail is the first strip sacrificed. The hide lives in the stylesheet
     * (display:none keeps it in the DOM so a phone that rotates to a wider
     * viewport still gets the travelling progress), so the pin reads the source
     * like the wash-width test does. */
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const block =
      css.match(
        /@media\s*\(max-width:\s*639\.98px\)\s*\{[^}]*\.hero-scene__rail\s*\{[^}]*\}/,
      )?.[0] ?? "";
    expect(block).toContain("display: none");
  });

  it("compresses the headline size at the smallest breakpoint", () => {
    const { container } = render(<HeroScene />);

    const heading = container.querySelector(
      '[data-beat="00"] .hero-beat__title',
    ) as HTMLElement;
    const classes = heading.className;
    expect(classes).toContain("text-[1.75rem]");
    expect(classes).toContain("md:text-[3.25rem]");
  });
});

describe("HeroScene degradation", () => {
  it("marks the scene as unavailable when WebGL is missing", () => {
    const { container } = render(<HeroScene />);

    expect(container.querySelector("[data-scene-root]")).toHaveAttribute("data-webgl", "off");
  });

  it("falls back to the static story rather than an empty canvas", () => {
    const { container } = render(<HeroScene />);

    expect(screen.getByTestId("scene-static-fallback")).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("declines the 3D scene when the user prefers reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });

    const { container } = render(<HeroScene />);

    expect(container.querySelector("[data-scene-root]")).toHaveAttribute("data-webgl", "off");
    expect(container.querySelector("canvas")).toBeNull();
  });

  /**
   * The beat entrance staggers, the rail travels, and the wash breathes. All of
   * it is gated on one attribute so the kill switch is assertable in the DOM
   * rather than only implied by a CSS selector that no test reads. Without it
   * the static fallback would show six half-animated beats.
   */
  it("freezes every beat animation when the scene cannot run", () => {
    const { container } = render(<HeroScene />);

    expect(container.querySelector("[data-scene-root]")).toHaveAttribute("data-webgl", "off");
  });

  it("freezes every beat animation when the user prefers reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });

    const { container } = render(<HeroScene />);

    expect(container.querySelector("[data-scene-root]")).toHaveAttribute("data-webgl", "off");
  });
});
