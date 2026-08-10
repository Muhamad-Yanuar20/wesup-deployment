import { CompressionError, type CompressionOptions } from "./types";

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 2000,
  quality: 0.82,
  outputType: "image/jpeg",
};

type ImageInput = Pick<File, "size" | "type">;

export function validateImageInput(file: ImageInput): void {
  if (file.size > MAX_INPUT_BYTES) {
    throw new CompressionError("INPUT_TOO_LARGE", "Image must not exceed 10 MiB");
  }

  if (!file.type.startsWith("image/")) {
    throw new CompressionError("UNSUPPORTED_TYPE", "Only image files are supported");
  }
}

export function normalizeCompressionOptions(options: CompressionOptions = {}): Required<CompressionOptions> {
  const normalized = { ...DEFAULT_OPTIONS, ...options };

  if (normalized.quality < 0 || normalized.quality > 1) {
    throw new CompressionError("INVALID_OPTIONS", "Quality must be between 0 and 1");
  }

  if (normalized.maxDimension <= 0) {
    throw new CompressionError("INVALID_OPTIONS", "Maximum dimension must be positive");
  }

  return normalized;
}
