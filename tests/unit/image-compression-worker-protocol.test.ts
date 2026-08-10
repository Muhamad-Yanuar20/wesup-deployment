import { describe, expect, it, vi } from "vitest";
import {
  createCompressionWorkerFailure,
  createCompressionWorkerRequest,
  createCompressionWorkerSuccess,
  isCompressionWorkerRequest,
  isCompressionWorkerResponse,
  parseCompressionWorkerResponse,
  workerErrorToFailure,
} from "@/lib/image-compression/worker-protocol";
import { processCompressionWorkerRequest } from "@/lib/image-compression/image-compression.worker";

function imageFile(size = 1_024, type = "image/png") {
  return { size, type } as File;
}

describe("image compression worker protocol", () => {
  it("preserves the request ID in request and success messages", () => {
    const file = imageFile();
    const request = createCompressionWorkerRequest("request-17", file, { quality: 0.6 });
    const result = {
      blob: new Blob(["compressed"], { type: "image/webp" }),
      originalSize: 1_024,
      compressedSize: 10,
      width: 800,
      height: 600,
      mimeType: "image/webp",
    };

    expect(request).toEqual({ id: "request-17", file, options: { quality: 0.6 } });
    expect(createCompressionWorkerSuccess(request.id, result)).toEqual({
      id: "request-17",
      ok: true,
      result,
    });
    expect(isCompressionWorkerRequest(request)).toBe(true);
    expect(isCompressionWorkerResponse(createCompressionWorkerSuccess(request.id, result))).toBe(true);
  });

  it("preserves the request ID and typed code in failure messages", () => {
    const failure = createCompressionWorkerFailure("request-18", "ENCODE_FAILED", "Encoding failed");

    expect(failure).toEqual({
      id: "request-18",
      ok: false,
      code: "ENCODE_FAILED",
      message: "Encoding failed",
    });
    expect(isCompressionWorkerResponse(failure)).toBe(true);
  });

  it("converts an unknown worker error into a WORKER_FAILED response", () => {
    expect(workerErrorToFailure("request-19", new Error("worker crashed"))).toEqual({
      id: "request-19",
      ok: false,
      code: "WORKER_FAILED",
      message: "worker crashed",
    });
  });

  it("turns a malformed response into a typed failure without exposing a raw error", () => {
    expect(parseCompressionWorkerResponse({ id: "wrong", ok: true }, "request-20")).toEqual({
      id: "request-20",
      ok: false,
      code: "WORKER_FAILED",
      message: "Worker returned an invalid response",
    });
    expect(isCompressionWorkerResponse({ id: "request-20", ok: false, code: "UNKNOWN", message: "bad" })).toBe(
      false,
    );
  });
});

describe("processCompressionWorkerRequest", () => {
  it("resizes proportionally, encodes the requested type, and closes the bitmap", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(new Blob(["compressed"], { type: "image/webp" }));
    const createCanvas = vi.fn().mockReturnValue({ getContext: () => ({ drawImage }), convertToBlob });
    const file = imageFile(4_096, "image/png");

    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("request-21", file, {
        maxDimension: 1_000,
        quality: 0.7,
        outputType: "image/webp",
      }),
      {
        createImageBitmap: vi.fn().mockResolvedValue({ width: 4_000, height: 2_000, close }),
        createCanvas,
      },
    );

    expect(response).toEqual({
      id: "request-21",
      ok: true,
      result: {
        blob: expect.any(Blob),
        originalSize: 4_096,
        compressedSize: 10,
        width: 1_000,
        height: 500,
        mimeType: "image/webp",
      },
    });
    expect(createCanvas).toHaveBeenCalledWith(1_000, 500);
    expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 4_000, height: 2_000 }), 0, 0, 1_000, 500);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/webp", quality: 0.7 });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns DECODE_FAILED when image decoding fails", async () => {
    const response = await processCompressionWorkerRequest(createCompressionWorkerRequest("decode-id", imageFile(), {}), {
      createImageBitmap: vi.fn().mockRejectedValue(new Error("corrupt image")),
      createCanvas: vi.fn(),
    });

    expect(response).toEqual({ id: "decode-id", ok: false, code: "DECODE_FAILED", message: "corrupt image" });
  });

  it("returns CANVAS_FAILED and closes the bitmap when a 2D context is unavailable", async () => {
    const close = vi.fn();
    const response = await processCompressionWorkerRequest(createCompressionWorkerRequest("canvas-id", imageFile(), {}), {
      createImageBitmap: vi.fn().mockResolvedValue({ width: 800, height: 600, close }),
      createCanvas: vi.fn().mockReturnValue({ getContext: () => null, convertToBlob: vi.fn() }),
    });

    expect(response).toEqual({
      id: "canvas-id",
      ok: false,
      code: "CANVAS_FAILED",
      message: "Unable to create a 2D canvas context",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns ENCODE_FAILED and closes the bitmap when encoding fails", async () => {
    const close = vi.fn();
    const response = await processCompressionWorkerRequest(createCompressionWorkerRequest("encode-id", imageFile(), {}), {
      createImageBitmap: vi.fn().mockResolvedValue({ width: 800, height: 600, close }),
      createCanvas: vi.fn().mockReturnValue({
        getContext: () => ({ drawImage: vi.fn() }),
        convertToBlob: vi.fn().mockRejectedValue(new Error("codec unavailable")),
      }),
    });

    expect(response).toEqual({
      id: "encode-id",
      ok: false,
      code: "ENCODE_FAILED",
      message: "codec unavailable",
    });
    expect(close).toHaveBeenCalledOnce();
  });
});
