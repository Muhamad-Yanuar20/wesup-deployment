// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEATS, SCENE_LENGTH_MOBILE_VH, SCENE_LENGTH_VH } from "@/lib/landing";
import { HeroScene } from "@/components/landing/scene/HeroScene";
import HeroSceneCanvas from "@/components/landing/scene/HeroSceneCanvas";
import { buildScene, type SceneController } from "@/components/landing/scene/renderer";

/**
 * The renderer never runs a real WebGL context in jsdom. The module is mocked
 * so `buildScene` returns a controllable controller, which is what lets the
 * race regression tests prove the render loop is (and stays) driven by the
 * *current* visibility rather than the value captured when the build started.
 */
vi.mock("@/components/landing/scene/renderer", () => ({
  buildScene: vi.fn(),
}));

const buildSceneMock = vi.mocked(buildScene);

function makeController(initialVisible: boolean): SceneController {
  const controller: SceneController = { setVisible: vi.fn(), dispose: vi.fn() };
  if (initialVisible) controller.setVisible(true);
  return controller;
}

/**
 * The WebGL probe result is memoised at module scope, so the capable path needs
 * its own file: by the time any other test in this suite has rendered, the
 * cache is already populated with the jsdom default of "no WebGL".
 */
function stubWebGL() {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ getParameter: vi.fn() }) as unknown as RenderingContext,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
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
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: SCENE_LENGTH_VH * 10,
  });
  // navigator.hardwareConcurrency is 8 in jsdom, clearing the low-power gate.
  Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
  stubWebGL();

  buildSceneMock.mockClear();
  buildSceneMock.mockImplementation((...args) => makeController(args[5]));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HeroScene scene mode", () => {
  it("mounts the canvas and publishes the scroll length when WebGL is available", () => {
    const { container } = render(<HeroScene />);

    const scene = container.querySelector("[data-scene-root]");
    expect(scene).toHaveAttribute("data-webgl", "on");
    expect(screen.getByTestId("hero-scene-canvas")).toBeInTheDocument();
    expect(scene).toHaveStyle({ "--scene-length": `${SCENE_LENGTH_VH}vh` });
  });

  it("shortens the scroll track on small screens", () => {
    const { container } = render(<HeroScene />);

    expect(container.querySelector("[data-scene-root]")).toHaveStyle({
      "--scene-length-mobile": `${SCENE_LENGTH_MOBILE_VH}vh`,
    });
  });

  it("still renders the full story alongside the canvas", () => {
    render(<HeroScene />);

    // Read the closing headline from the timeline so rewording the story cannot
    // silently break this guard — the point is that the last beat is on the page
    // next to a live canvas, not that it reads a particular way.
    expect(screen.getByText(BEATS[BEATS.length - 1].title)).toBeInTheDocument();
    expect(screen.getByTestId("scene-volume-meter")).toBeInTheDocument();
  });

  /**
   * The counterpart to the degradation suite: the gate must actually open when
   * the scene is live. A gate that is permanently `off` would satisfy every
   * fallback test while silently deleting the entrance animation the whole
   * scroll track is built around.
   */
  it("opens the motion gate when the scene is live", () => {
    const { container } = render(<HeroScene />);

    expect(container.querySelector("[data-scene-root]")).toHaveAttribute("data-webgl", "on");
  });
});

/**
 * The C1 regression drives HeroSceneCanvas directly rather than through
 * useScrollProgress: the race is entirely inside the canvas component (read
 * the live visibility at build time, then keep the controller in sync with
 * later flips), and a harness makes the flip a plain controlled prop instead
 * of contending with the hook's own IntersectionObserver.
 */
describe("HeroSceneCanvas render-loop visibility (C1 regression)", () => {
  const NOOP = () => undefined;

  function Harness({ initialVisible }: { initialVisible: boolean }) {
    const [isVisible, setIsVisible] = useState(initialVisible);
    const progressRef = useRef(0);
    const stageRef = useRef<HTMLElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(document.createElement("canvas"));

    return (
      <div>
        <button
          type="button"
          data-testid="scene-visibility-toggle"
          onClick={() => setIsVisible((visible) => !visible)}
        >
          toggle
        </button>
        <HeroSceneCanvas
          canvasRef={canvasRef}
          stageRef={stageRef}
          progressRef={progressRef}
          isVisible={isVisible}
          reduceMotion={false}
          onStageChange={NOOP}
          onSceneFailed={NOOP}
        />
      </div>
    );
  }

  /** Let the async three.js import settle, then ensure exactly one build. */
  async function settleBuild() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(buildSceneMock).toHaveBeenCalledTimes(1), { timeout: 5000 });
  }

  it("starts the render loop when visibility arrives after the build has settled", async () => {
    render(<Harness initialVisible={false} />);

    // The build lands while the scene is still hidden, so the controller is
    // built frozen. That part is expected — the loop is *not* started yet.
    await settleBuild();
    expect(buildSceneMock.mock.calls[0][5]).toBe(false);
    const controller = buildSceneMock.mock.results[0].value as SceneController;
    expect(controller.setVisible).not.toHaveBeenCalled();

    // Visibility flips true only afterwards. The fix: a follow-up effect
    // re-syncs the controller, so the loop restarts instead of being left
    // running-but-frozen.
    await act(async () => {
      fireEvent.click(screen.getByTestId("scene-visibility-toggle"));
    });
    await vi.waitFor(() => expect(controller.setVisible).toHaveBeenLastCalledWith(true), {
      timeout: 5000,
    });
  });

  it("passes the current visibility into the build, not a stale captured value", async () => {
    // The scene is already visible when the import resolves, which is the exact
    // race that left the loop dead: the canvas mounted while the import was
    // still settling, so any value captured at effect-run time would read a
    // stale `false`. The build must read the live ref instead.
    render(<Harness initialVisible={true} />);

    await settleBuild();
    expect(buildSceneMock.mock.calls[0][5]).toBe(true);
    const controller = buildSceneMock.mock.results[0].value as SceneController;
    expect(controller.setVisible).toHaveBeenLastCalledWith(true);

    // And a later flip back off must be pushed into the same controller.
    await act(async () => {
      fireEvent.click(screen.getByTestId("scene-visibility-toggle"));
    });
    await vi.waitFor(() => expect(controller.setVisible).toHaveBeenLastCalledWith(false), {
      timeout: 5000,
    });
  });
});