"use client";

import { useEffect, useRef } from "react";

import { buildScene, type SceneController } from "./renderer";

interface HeroSceneCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stageRef: React.RefObject<HTMLElement | null>;
  progressRef: React.RefObject<number>;
  isVisible: boolean;
  reduceMotion: boolean;
  onStageChange: (stage: number) => void;
  onSceneFailed: () => void;
}

/**
 * Mounts the three.js scene and drives its visibility.
 *
 * The scene is built asynchronously (the wrapper dynamic-imports three.js), so
 * visibility must not be captured at effect-run time: `isVisible` can flip true
 * while the import is still settling. The build reads the *latest* visibility
 * through a ref instead, and the follow-up effect keeps the controller in sync
 * with any later flip, so the loop can never be left running-but-frozen.
 */
export default function HeroSceneCanvas({
  canvasRef,
  stageRef,
  progressRef,
  isVisible,
  reduceMotion,
  onStageChange,
  onSceneFailed,
}: HeroSceneCanvasProps) {
  const controllerRef = useRef<SceneController | null>(null);
  const visibleRef = useRef(isVisible);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    void (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        controllerRef.current = buildScene(
          THREE,
          canvas,
          stageRef.current,
          progressRef,
          onStageChange,
          // The value read at build time — not the (possibly stale) value
          // captured when this effect ran.
          visibleRef.current,
          reduceMotion,
        );
      } catch (error) {
        if (!disposed) {
          console.error("[HeroScene] WebGL scene failed to initialise", error);
          onSceneFailed();
        }
      }
    })();

    return () => {
      disposed = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [canvasRef, stageRef, onSceneFailed, onStageChange, progressRef, reduceMotion]);

  useEffect(() => {
    visibleRef.current = isVisible;
    controllerRef.current?.setVisible(isVisible);
  }, [isVisible]);

  return null;
}