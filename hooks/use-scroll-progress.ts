"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clamp01 } from "@/lib/landing/math";

/**
 * WebGL support is stable for the lifetime of a document, so the result is
 * memoised at module scope rather than re-probed on every mount.
 */
let webglSupportCache: boolean | null = null;

const WEBGL_LOSE_CONTEXT = "WEBGL_lose_context";

function detectWebGL(): boolean {
  if (webglSupportCache !== null) return webglSupportCache;
  if (typeof document === "undefined") return false;
  try {
    // getContext is the feature probe: if it yields a context, WebGL works. A
    // separate `typeof WebGLRenderingContext` check would only add a way to be
    // wrong, since some browsers expose the constructor under a vendor prefix.
    const probe = document.createElement("canvas");
    const gl = (probe.getContext("webgl2") ??
      probe.getContext("webgl")) as WebGLRenderingContext | WebGL2RenderingContext | null;
    // Release the probe context so the GPU resources it held are returned
    // immediately instead of waiting on the context's eventual garbage
    // collection — a handful of these probes across mounts should never
    // accumulate live canvases.
    gl?.getExtension?.(WEBGL_LOSE_CONTEXT)?.loseContext();
    webglSupportCache = Boolean(gl);
  } catch {
    webglSupportCache = false;
  }
  return webglSupportCache;
}

interface NetworkInformation {
  readonly saveData?: boolean;
}

function prefersDataSaver(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return connection?.saveData === true;
}

function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  return typeof cores === "number" && cores > 0 && cores <= 4;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** No-op: scene capability cannot change without a reload, so nothing to watch. */
function subscribeCapability(): () => void {
  return () => undefined;
}

/**
 * Whether this device should render the 3D scene.
 *
 * The scene is an enhancement: a user who asked for reduced motion, is on a data
 * saver, or has a weak device gets the static hero instead. This reads browser
 * APIs that do not exist during SSR, so it is exposed through
 * useSyncExternalStore — React renders the server snapshot during hydration and
 * swaps in the real value immediately after, without a cascading render.
 */
function readSceneCapability(): boolean {
  if (typeof document === "undefined") return false;
  return !readReducedMotion() && !prefersDataSaver() && !isLowPowerDevice() && detectWebGL();
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

interface SceneGeometry {
  /** Document offset of the scene element's top edge. */
  readonly top: number;
  /** Pixels of scrollable travel once the sticky viewport is accounted for. */
  readonly scrollable: number;
}

/**
 * Cached scene geometry. Read once per resize rather than per frame: calling
 * getBoundingClientRect() inside the render loop forces a synchronous layout on
 * every animation frame.
 */
function readGeometry(element: HTMLElement): SceneGeometry {
  return {
    top: element.getBoundingClientRect().top + window.scrollY,
    scrollable: Math.max(1, element.offsetHeight - window.innerHeight),
  };
}

function computeProgress(scrollY: number, geometry: SceneGeometry): number {
  return clamp01((scrollY - geometry.top) / geometry.scrollable);
}

export interface UseScrollProgressResult {
  /**
   * Live scroll progress through the target element, in [0, 1].
   *
   * Deliberately a ref rather than state: the render loop reads this every
   * animation frame and must not trigger a React re-render to do so.
   */
  progressRef: React.RefObject<number>;
  /** Whether the target element is currently intersecting the viewport. */
  isVisible: boolean;
  /** Whether the browser honours a reduced-motion preference. */
  reduceMotion: boolean;
  /**
   * Whether the 3D scene should be rendered at all. False when the user asked
   * for reduced motion, the device cannot afford it, or WebGL is unavailable.
   */
  canRenderScene: boolean;
}

/**
 * Tracks scroll progress through a tall element while its sticky child is
 * pinned to the viewport.
 *
 * The element's geometry is measured once and cached, then invalidated on
 * resize. The per-frame path reads `window.scrollY` only.
 */
export function useScrollProgress(
  target: React.RefObject<HTMLElement | null>,
): UseScrollProgressResult {
  const progressRef = useRef(0);
  const geometryRef = useRef<SceneGeometry>({ top: 0, scrollable: 1 });

  const [isVisible, setIsVisible] = useState(false);

  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const supportsScene = useSyncExternalStore(subscribeCapability, readSceneCapability, () => false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    const measure = () => {
      geometryRef.current = readGeometry(element);
    };
    const sync = () => {
      progressRef.current = computeProgress(window.scrollY, geometryRef.current);
    };

    measure();
    sync();

    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", measure);

    const resizeObserver = new ResizeObserver(() => {
      measure();
      sync();
    });
    resizeObserver.observe(element);

    // Late-loading fonts or images above the scene can shift its document
    // offset without changing its own size, so re-measure once things settle.
    const onLoad = () => {
      measure();
      sync();
    };
    window.addEventListener("load", onLoad);
    void document.fonts?.ready.then(onLoad).catch(() => undefined);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries.some((entry) => entry.isIntersecting));
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(element);

    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", onLoad);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [target]);

  return {
    progressRef,
    isVisible,
    reduceMotion,
    canRenderScene: supportsScene && !reduceMotion,
  };
}
