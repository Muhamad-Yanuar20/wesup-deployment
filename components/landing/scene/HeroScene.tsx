"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  BEATS,
  SCENE_LENGTH_MOBILE_VH,
  SCENE_LENGTH_VH,
  TARGET_QUOTA_KG,
  TARGET_REGISTERED_KG,
  formatKg,
  formatRupiah,
  lockedTierForKg,
  nextTier,
} from "@/lib/landing";
import { useScrollProgress } from "@/hooks/use-scroll-progress";

/**
 * The renderer is client-only and is the only thing that pulls in three.js. It
 * is mounted exclusively when the device has been cleared to render the scene,
 * so a reduced-motion or data-saver visitor never downloads the library at all.
 */
const HeroSceneCanvas = dynamic(() => import("./HeroSceneCanvas"), { ssr: false });

/**
 * `useLayoutEffect` warns when a client component is server-rendered, yet the
 * measurement below must land before paint or the calls to action would flash
 * at the tallest beat's height for one frame. Resolve to the layout effect on
 * the client and the passive effect on the server, where neither runs.
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const TRUST_NOTES = [
  "Harga terkunci saat pendaftaran ditutup",
  "Bayar sekali lewat QRIS",
  "Ambil sendiri di Bandung",
] as const;

function BeatHeadline({ title }: { title: string }) {
  const words = title.split(" ");

  return (
    <h2 className="hero-beat__title mt-3 font-landing-display text-[1.75rem] font-medium leading-[1.07] tracking-[-0.03em] text-wesup-ink text-balance sm:text-[2.5rem] sm:leading-[1.06] md:mt-4 md:text-[3.25rem] md:leading-[1.04] md:tracking-[-0.035em]">
      <span className="sr-only">{title}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`}>
            <span
              className="hero-beat__word"
              // Offset by one so the headline cascades in after the eyebrow.
              style={{ "--i": index + 1 } as CSSProperties}
            >
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </h2>
  );
}

export function HeroScene() {
  const sceneRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const beatsRef = useRef<HTMLOListElement>(null);
  const { progressRef, isVisible, canRenderScene, reduceMotion } = useScrollProgress(sceneRef);

  /**
   * Only the stage index lives in state. Scroll position is read through a ref
   * inside the render loop, so scrubbing the page re-renders a handful of times
   * rather than sixty times a second.
   */
  const [activeStage, setActiveStage] = useState(0);
  const handleStageChange = useCallback((stage: number) => {
    setActiveStage((previous) => (previous === stage ? previous : stage));
  }, []);

  // A WebGL context can exist and still fail to produce a renderer. Falling back
  // here means a broken context degrades to the static story instead of a blank
  // rectangle.
  const [sceneFailed, setSceneFailed] = useState(false);
  const handleSceneFailed = useCallback(() => setSceneFailed(true), []);

  const lockedTier = lockedTierForKg(TARGET_REGISTERED_KG);
  const upcomingTier = nextTier(TARGET_QUOTA_KG);
  const filledRatio = TARGET_REGISTERED_KG / TARGET_QUOTA_KG;
  const isSceneActive = canRenderScene && !sceneFailed;

  /**
   * Desktop only: the calls to action follow the active beat rather than sitting
   * pinned to the column's bottom. The beats share one grid cell, so the list is
   * otherwise as tall as the *tallest* beat and the CTA never moves. Sizing the
   * list to the active beat's measured height — transitioned in CSS alongside the
   * copy cross-fade — lets the group glide up and down as the story scrolls.
   *
   * Phones keep their bottom-anchored panel: the space there is too tight to
   * detach the CTA from the thumb. The static fallback (no WebGL or reduced
   * motion) keeps its ordinary stacked layout untouched.
   */
  useIsomorphicLayoutEffect(() => {
    if (!isSceneActive) return;

    const beats = beatsRef.current;
    if (!beats) return;

    const desktop = window.matchMedia("(min-width: 768px)");
    let disconnect: () => void = () => undefined;

    const measure = () => {
      disconnect();
      disconnect = () => undefined;

      const active = beats.querySelector<HTMLElement>('[data-beat][data-active="true"]');
      if (!desktop.matches || !active) {
        beats.style.height = "";
        return;
      }

      // No clamp: if the copy is taller than the viewport, the group overflows
      // below the fold exactly as the pinned layout did — clamping to the
      // available space would instead slide the CTA up over the copy itself.
      const apply = () => {
        beats.style.height = `${active.offsetHeight}px`;
      };
      apply();

      const observer = new ResizeObserver(apply);
      observer.observe(active);
      disconnect = () => observer.disconnect();
    };

    measure();
    desktop.addEventListener("change", measure);

    return () => {
      desktop.removeEventListener("change", measure);
      disconnect();
      beats.style.height = "";
    };
  }, [isSceneActive, activeStage]);

  return (
    <section
      ref={sceneRef}
      aria-label="Cara kerja Wesup"
      data-scene-root=""
      data-webgl={isSceneActive ? "on" : "off"}
      className="hero-scene relative bg-wesup-paper"
      style={
        {
          "--scene-length": `${SCENE_LENGTH_VH}vh`,
          "--scene-length-mobile": `${SCENE_LENGTH_MOBILE_VH}vh`,
        } as CSSProperties
      }
    >
      <div className="hero-scene__viewport sticky top-0 h-[100svh] overflow-hidden">
        {isSceneActive ? (
          <>
            <canvas
              ref={canvasRef}
              data-testid="hero-scene-canvas"
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
            />
            {/* The free area the 3D scene is composed into. The renderer
                centres the truck on this box, so layout is decided here in
                CSS, not in camera maths. Tune these classes to move the truck.
                Mobile: the band between headline and CTA.
                Desktop: the right 58% of the viewport. */}
            <div
              ref={stageRef}
              data-testid="hero-scene-stage"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[9%] bottom-[50%] md:inset-y-0 md:left-[52vw] md:right-0 md:top-[4.5rem] md:bottom-0"
            />
            <HeroSceneCanvas
              canvasRef={canvasRef}
              stageRef={stageRef}
              progressRef={progressRef}
              isVisible={isVisible}
              reduceMotion={reduceMotion}
              onStageChange={handleStageChange}
              onSceneFailed={handleSceneFailed}
            />
          </>
        ) : (
          <div data-testid="scene-static-fallback" className="absolute inset-0" aria-hidden="true" />
        )}

        {/* Readability wash, scoped to the text side (see globals.css). */}
        <div
          data-testid="hero-scene-wash"
          aria-hidden="true"
          className="hero-scene__wash pointer-events-none absolute inset-y-0 left-0 w-full"
        />

        <div className="hero-scene__overlay pointer-events-none relative container mx-auto h-full w-full px-4 sm:px-6 lg:px-8">
          <div className="hero-scene__column">
            <ol ref={beatsRef} className="hero-scene__beats" data-active-stage={activeStage}>
              {BEATS.map((beat, index) => (
                <li
                  key={beat.id}
                  data-beat={beat.index}
                  data-active={index === activeStage}
                  // Only the scroll-scrubbed overlay hides the inactive stages.
                  aria-hidden={isSceneActive && index !== activeStage ? true : undefined}
                  className="hero-beat"
                >
                  <p
                    className="hero-beat__eyebrow flex items-center gap-3 font-mono text-[0.6875rem] font-medium uppercase tabular-nums tracking-[0.2em] text-wesup-ink-sub"
                    style={{ "--i": 0 } as CSSProperties}
                  >
                    <span className="hero-beat__rule inline-block h-px w-6 bg-wesup-red" aria-hidden="true" />
                    {beat.eyebrow}
                  </p>
                  <BeatHeadline title={beat.title} />
                  <p
                    className="hero-beat__body mt-6 max-w-[36ch] text-[0.9375rem] leading-[1.65] text-wesup-ink-sub text-pretty sm:mt-4 sm:text-base"
                    style={{ "--i": 2 } as CSSProperties}
                  >
                    {beat.body}
                  </p>

                  {/* Plain statement, not a badge: red rule + text. */}
                  {beat.chip ? (
                    <p
                      className="hero-beat__chip mt-3 flex items-baseline gap-3 text-[0.875rem] font-medium text-wesup-ink sm:mt-4"
                      style={{ "--i": 3 } as CSSProperties}
                    >
                      <span className="mt-[0.6em] inline-block h-px w-4 shrink-0 bg-wesup-red" aria-hidden="true" />
                      {beat.chip}
                    </p>
                  ) : null}

                  {beat.id === "pintu-ditutup" ? (
                    <div
                      data-testid="scene-volume-meter"
                      className="hero-beat__meter mt-4 max-w-[21rem] border-t border-wesup-ink/20 pt-3 sm:mt-5 sm:max-w-sm"
                      style={{ "--i": 4 } as CSSProperties}
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                          Volume terkumpul
                        </span>
                        <span className="font-mono text-sm font-medium tabular-nums text-wesup-ink">
                          {formatKg(TARGET_REGISTERED_KG)}
                          <span className="text-wesup-ink-sub"> / {formatKg(TARGET_QUOTA_KG)} kg</span>
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(filledRatio * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Volume terkumpul"
                        className="mt-2 h-px w-full bg-wesup-ink/20"
                      >
                        <div
                          className="h-[3px] -translate-y-px bg-wesup-red"
                          style={{ width: `${filledRatio * 100}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-wesup-ink-sub">
                        Terkunci di <strong className="font-semibold text-wesup-ink">{lockedTier.label}</strong>,{" "}
                        {formatRupiah(lockedTier.unitPrice)}/kg. {upcomingTier.label} terbuka di{" "}
                        {formatKg(upcomingTier.minQuantityKg)} kg.
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <div className="hero-scene__cta pointer-events-auto">
              <ol
                data-testid="scene-stage-rail"
                className="hero-scene__rail mb-5 flex items-center gap-2"
                // Drives the travelling underline in globals.css.
                style={{ "--rail-index": activeStage } as CSSProperties}
                aria-hidden="true"
              >
                {BEATS.map((beat, index) => (
                  <li
                    key={beat.id}
                    data-active={index === activeStage}
                    className="hero-scene__rail-step h-1 transition-all duration-300"
                  >
                    <span className="sr-only">{beat.index}</span>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-6">
                <Link
                  href="/register?role=umkm"
                  className="group inline-flex min-h-12 w-full items-center justify-center gap-3 border border-wesup-ink bg-wesup-ink px-7 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper transition-colors duration-300 hover:border-wesup-red hover:bg-wesup-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red sm:w-auto"
                >
                  Mulai hemat bersama
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex min-h-12 items-center justify-center text-[0.9375rem] font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
                >
                  Lihat penawaran
                </Link>
              </div>

              {/* One quiet line instead of three icon chips. */}
              <ul className="mt-5 hidden flex-col gap-1 border-t border-wesup-ink/15 pt-3 text-[0.8125rem] text-wesup-ink-sub md:flex md:flex-row md:flex-wrap md:gap-x-5">
                {TRUST_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}