"use client";

import { useEffect, useRef, useState } from "react";
import { useObjectUrl } from "@/hooks/use-object-url";
import { Image as ImageIcon, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { compressImage, CompressionError } from "@/lib/image-compression";
import { validateRawImageInput } from "@/lib/supplier-registration/contracts";

type PhotoStatus = "idle" | "compressing" | "ready" | "error";

export interface BusinessPhotoFieldProps {
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  disabled?: boolean;
  variant?: "business" | "product";
  existingUrl?: string | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSavings(originalSize: number, compressedSize: number): string {
  if (originalSize <= 0 || compressedSize >= originalSize) return "";
  return "Foto berhasil diunggah";
}

export default function BusinessPhotoField({
  value,
  onChange,
  error,
  disabled = false,
  variant = "business",
  existingUrl = null,
}: BusinessPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<PhotoStatus>(value ? "ready" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(error);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(value?.size ?? null);
  const [dragActive, setDragActive] = useState(false);
  const isProduct = variant === "product";
  const uploadLabel = isProduct ? "Unggah foto produk" : "Unggah foto usaha";
  const uploadHint = isProduct
    ? "Foto produk diproses menjadi WebP secara otomatis"
    : "Foto diproses menjadi WebP secara otomatis";
  const previewAlt = isProduct ? "Pratinjau foto produk" : "Pratinjau foto tempat usaha";
  const errorId = isProduct ? "product-photo-error" : "business-photo-error";

  const previewUrl = useObjectUrl(value);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function processFile(rawFile: File) {
    if (disabled) return;
    const metadataError = validateRawImageInput(rawFile);
    if (metadataError) {
      setStatus("error");
      setErrorMessage(metadataError);
      onChange(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    setStatus("compressing");
    setErrorMessage(undefined);
    setOriginalSize(rawFile.size);
    setCompressedSize(null);

    try {
      const result = await compressImage(rawFile, {
        outputType: "image/webp",
        maxDimension: 2000,
        quality: 0.82,
        signal: controller.signal,
      });
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      const baseName = rawFile.name.replace(/\.[^.]+$/, "") || (isProduct ? "product-photo" : "business-photo");
      const compressed = new File([result.blob], `${baseName}.webp`, { type: "image/webp" });
      onChange(compressed);
      setCompressedSize(compressed.size);
      setStatus("ready");
    } catch (compressionError) {
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      setStatus("error");
      setErrorMessage(
        compressionError instanceof CompressionError
          ? "Foto tidak dapat diproses. Pilih foto lain dan coba lagi."
          : "Foto tidak dapat diproses. Coba lagi.",
      );
      onChange(null);
    }
  }

  function removeFile() {
    abortRef.current?.abort();
    requestRef.current += 1;
    setStatus("idle");
    setOriginalSize(null);
    setCompressedSize(null);
    setErrorMessage(undefined);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const describedBy = error || errorMessage ? errorId : undefined;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only font-sans normal-case tracking-normal"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void processFile(file);
        }}
        disabled={disabled || status === "compressing"}
        aria-describedby={describedBy}
      />

      {!value && existingUrl && status !== "compressing" && (
        <div className="mb-3 flex items-center gap-3 border border-wesup-ink/15 bg-wesup-paper p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingUrl} alt={previewAlt} className="h-20 w-20 object-cover" />
          <p className="text-sm text-wesup-ink-sub">Foto saat ini tersimpan. Unggah foto baru untuk menggantinya.</p>
        </div>
      )}

      {!value && status !== "compressing" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files[0];
            if (file) void processFile(file);
          }}
          disabled={disabled}
          className={`flex w-full flex-col items-center justify-center  border-2 border-dashed px-6 py-10 transition-colors duration-500 wesup-ease ${
            dragActive ? "border-wesup-ink/20 bg-wesup-paper" : "border-wesup-ink/20 bg-wesup-paper hover:border-wesup-ink/20 hover:bg-wesup-paper"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <UploadCloud className="h-11 w-11 text-wesup-ink-sub" aria-hidden="true" />
          <span className="mt-3 text-sm font-semibold text-wesup-ink-sub">{uploadLabel}</span>
          <span className="mt-1 text-xs text-wesup-ink-sub">JPEG, PNG, atau WebP · maksimal 10 MB</span>
          <span className="mt-1 text-xs text-wesup-ink-sub">{uploadHint}</span>
        </button>
      ) : status === "compressing" ? (
        <div className="flex items-center gap-3 border border-wesup-ink/15 bg-wesup-paper px-5 py-6 text-sm font-medium text-wesup-ink" role="status" aria-live="polite">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Mengompres foto tanpa mengganggu halaman…
        </div>
      ) : value ? (
        <div className="grid gap-4 border border-wesup-ink/15 bg-wesup-paper p-4 sm:grid-cols-[128px_1fr_auto] sm:items-center">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={previewAlt} className="h-28 w-32 object-cover" />
          ) : (
            <div className="flex h-28 w-32 items-center justify-center bg-wesup-paper-sub"><ImageIcon className="h-8 w-8 text-wesup-ink-sub" /></div>
          )}
          <div>
            <p className="font-semibold text-wesup-ink">{value.name}</p>
            <p className="mt-1 text-sm text-wesup-ink-sub">WebP · {formatFileSize(compressedSize ?? value.size)}</p>
            {originalSize !== null && <p className="mt-1 text-xs font-medium text-wesup-ink-sub">{formatSavings(originalSize, compressedSize ?? value.size)}</p>}
          </div>
          <button type="button" onClick={removeFile} disabled={disabled} className="inline-flex items-center justify-center gap-2 border border-wesup-red px-3 py-2 text-sm font-semibold text-wesup-ink hover:bg-wesup-paper disabled:opacity-60">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      ) : null}

      {(error || errorMessage) && (
        <p id={errorId} className="mt-2 text-sm font-medium text-wesup-ink" role="alert">
          {error || errorMessage}
        </p>
      )}
    </div>
  );
}
