"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LockKeyhole, MapPin, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
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

const TRUST_MARKERS = [
  { icon: LockKeyhole, label: "Harga terkunci saat pendaftaran ditutup" },
  { icon: Wallet, label: "Bayar sekali lewat QRIS" },
  { icon: MapPin, label: "Ambil sendiri di Bandung" },
] as const;

function BeatHeadline({ title }: { title: string }) {
  const words = title.split(" ");

  return (
    <h2 className="hero-beat__title mt-3 font-landing-display text-2xl font-medium leading-[1.15] tracking-[-0.02em] text-slate-900 text-balance sm:mt-4 sm:text-[2.75rem] sm:leading-[1.08] sm:tracking-[-0.028em]">
      <span className="sr-only">{title}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`}>
            <span
              className="hero-beat__word"
              // Offset by one so the headline cascades in after the eyebrow
              // rather than alongside it. The reading order is eyebrow ->
              // headline -> body, and --i is what encodes that.
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

  return (
    <section
      ref={sceneRef}
      aria-label="Cara kerja Wesup"
      data-scene-root=""
      // One attribute gates both the 3D render and every scroll-linked
      // animation in the scene: the staggered beat entrance, the travelling
      // stage rail, the wash's ambient drift. The static fallback and reduced
      // motion both read it rather than being matched by a selector no test
      // can see. `data-motion` used to be a separate flag, but it was always
      // the same value — the canvas only mounts when WebGL is available and
      // reduced motion is not preferred, so "render the scene" already implies
      // "animate the beats".
      data-webgl={isSceneActive ? "on" : "off"}
      className="hero-scene relative bg-gradient-to-b from-blue-50 via-slate-50 to-white"
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
            <HeroSceneCanvas
              canvasRef={canvasRef}
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

        {/* Readability wash. Its own full-bleed layer rather than a background
            on the type overlay: the overlay is the page container, so a
            background there was clipped to that column and began dead at its
            left edge. Anchored at 0 with the gradient reaching zero alpha at
            this element's own right edge, there is no seam at any width. */}
        <div
          data-testid="hero-scene-wash"
          aria-hidden="true"
          className="hero-scene__wash pointer-events-none absolute inset-y-0 left-0 w-full"
        />

        {/* Shares the fixed header's container classes so the headline lands on
            the wordmark's left edge at every breakpoint, without duplicating
            the container breakpoints in a calc(). */}
        <div className="hero-scene__overlay pointer-events-none relative container mx-auto h-full w-full px-4 sm:px-6 lg:px-8">
          <div className="hero-scene__column">
            <ol className="hero-scene__beats mt-6 sm:mt-0" data-active-stage={activeStage}>
              {BEATS.map((beat, index) => (
                <li
                  key={beat.id}
                  data-beat={beat.index}
                  data-active={index === activeStage}
                  // Only the scroll-scrubbed overlay hides the inactive stages. In
                  // the static fallback every stage is visible, so hiding them would
                  // hide the whole product story from assistive technology.
                  aria-hidden={isSceneActive && index !== activeStage ? true : undefined}
                  className="hero-beat"
                >
              <p
                className="hero-beat__eyebrow flex items-center gap-3 font-mono text-[0.6875rem] font-medium uppercase tabular-nums tracking-[0.18em] text-slate-500 mt-2 sm:mt-0"
                style={{ "--i": 0 } as CSSProperties}
              >
                    <span className="hero-beat__rule inline-block h-px w-6 bg-slate-900/70" aria-hidden="true" />
                    {beat.eyebrow}
                  </p>
                  <BeatHeadline title={beat.title} />
                  <p
                    className="hero-beat__body mt-4 max-w-[36ch] text-[0.9375rem] leading-[1.65] text-slate-600 text-pretty sm:mt-4 sm:text-base"
                    style={{ "--i": 2 } as CSSProperties}
                  >
                    {beat.body}
                  </p>

                  {beat.chip ? (
                    <p
                      className="hero-beat__chip mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-3 py-1.5 text-[0.8125rem] font-semibold tracking-[0.01em] text-emerald-800"
                      style={{ "--i": 3 } as CSSProperties}
                    >
                      <ShieldCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                      {beat.chip}
                    </p>
                  ) : null}

                  {beat.id === "pintu-ditutup" ? (
                    <div
                      data-testid="scene-volume-meter"
                      className="hero-beat__meter mt-5 max-w-sm rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 backdrop-blur-xl"
                      style={{ "--i": 4 } as CSSProperties}
                    >
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="font-medium text-slate-700">Volume terkumpul</span>
                        <span className="font-semibold tabular-nums text-blue-700">
                          {formatKg(TARGET_REGISTERED_KG)}/{formatKg(TARGET_QUOTA_KG)} kg
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(filledRatio * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Volume terkumpul"
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ width: `${filledRatio * 100}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        Terkunci di <strong className="text-blue-700">{lockedTier.label}</strong> —{" "}
                        {formatRupiah(lockedTier.unitPrice)}/kg. {upcomingTier.label} terbuka di{" "}
                        {formatKg(upcomingTier.minQuantityKg)} kg.
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <div className="hero-scene__cta pointer-events-auto">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/70 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-blue-800 shadow-sm shadow-blue-600/5 backdrop-blur-md">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Beli bareng, harga grosir
              </p>
              <ol
                data-testid="scene-stage-rail"
                className="hero-scene__rail mb-5 flex items-center gap-2"
                // Drives the travelling underline in globals.css. The steps keep a
                // constant pitch (an active step scales rather than widens) so
                // this index maps to an exact offset instead of a cumulative one.
                style={{ "--rail-index": activeStage } as CSSProperties}
                aria-hidden="true"
              >
                {BEATS.map((beat, index) => (
                  <li
                    key={beat.id}
                    data-active={index === activeStage}
                    className="hero-scene__rail-step h-1 rounded-full transition-all duration-300"
                  >
                    <span className="sr-only">{beat.index}</span>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/register?role=umkm"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-3.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-white shadow-lg shadow-slate-900/25 ring-1 ring-inset ring-white/10 transition-all duration-500 wesup-ease hover:bg-slate-800 hover:shadow-slate-900/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98] sm:w-auto"
                >
                  <ShoppingBag className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  Mulai Hemat Bersama
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-8 py-3.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-800 backdrop-blur-sm shadow-sm transition-colors duration-500 hover:border-slate-900/20 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98] sm:w-auto"
                >
                  Lihat Penawaran
                </Link>
              </div>

              <ul className="mt-5 flex flex-wrap gap-2">
                {TRUST_MARKERS.map((marker) => (
                  <li key={marker.label} className="flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1.5 text-xs text-slate-700 backdrop-blur-sm sm:text-sm">
                    <marker.icon className="h-4 w-4 shrink-0 text-slate-900" strokeWidth={1.5} aria-hidden="true" />
                    {marker.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}