import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES, normalizeCompressionOptions, validateImageInput } from "@/lib/image-compression/validation";

function imageFile(size: number, type = "image/png") {
  return { size, type } as File;
}

describe("validateImageInput", () => {
  it("accepts an image exactly at the 10 MiB input limit", () => {
    expect(() => validateImageInput(imageFile(MAX_INPUT_BYTES))).not.toThrow();
  });

  it("rejects an image above the 10 MiB input limit", () => {
    expect(() => validateImageInput(imageFile(MAX_INPUT_BYTES + 1))).toThrow(
      expect.objectContaining({ code: "INPUT_TOO_LARGE" }),
    );
  });

  it("rejects a non-image MIME type", () => {
    expect(() => validateImageInput(imageFile(1, "application/pdf"))).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_TYPE" }),
    );
  });
});

describe("normalizeCompressionOptions", () => {
  it("returns the documented defaults when options are omitted", () => {
    expect(normalizeCompressionOptions()).toEqual({
      maxDimension: 2000,
      quality: 0.82,
      outputType: "image/jpeg",
    });
  });

  it.each([-0.01, 1.01])("rejects quality outside the 0 through 1 range: %s", (quality) => {
    expect(() => normalizeCompressionOptions({ quality })).toThrow();
  });

  it.each([0, -1])("rejects a non-positive max dimension: %s", (maxDimension) => {
    expect(() => normalizeCompressionOptions({ maxDimension })).toThrow();
  });
});
