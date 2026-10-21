"use client";

import { useEffect, useState } from "react";

/** Own a preview URL for the effect lifetime, including Strict Mode remounts. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    const url = blob ? URL.createObjectURL(blob) : null;
    queueMicrotask(() => {
      if (active) setPreview(blob && url ? { blob, url } : null);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob]);
  return blob && preview?.blob === blob ? preview.url : null;
}
