import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Leaflet paints its panes with z-index values up to 1000. A map that does not
 * create its own stacking context therefore hands those values to the root
 * stacking context, where they out-paint the sticky navigation bar (z-40) and
 * cover the interface.
 *
 * Contract: every map wrapper that clips its content (overflow-hidden) must
 * also isolate it (isolation: isolate), so the map can never paint above
 * page chrome.
 */

const MAP_COMPONENTS = [
  "components/demo/LeafletMap.tsx",
  "components/maps/BusinessLocationPicker.tsx",
  "components/marketplace/MarketplaceRadiusMap.tsx",
  "components/marketplace/MarketplaceRouteMap.tsx",
  "components/marketplace/PickupLocationMap.tsx",
];

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

function classNameLiterals(source: string): string[] {
  const literals: string[] = [];
  for (const match of source.matchAll(/className="([^"]*)"/g)) literals.push(match[1]);
  for (const match of source.matchAll(/className=\{`([^`]*)`\}/g)) literals.push(match[1]);
  return literals;
}

describe("Leaflet map stacking context", () => {
  it.each(MAP_COMPONENTS)("%s renders a map", (file) => {
    expect(read(file)).toContain("<MapContainer");
  });

  it.each(MAP_COMPONENTS)("%s isolates every clipping map wrapper", (file) => {
    const clipping = classNameLiterals(read(file)).filter((literal) =>
      literal.includes("overflow-hidden"),
    );
    expect(clipping.length).toBeGreaterThan(0);
    for (const literal of clipping) {
      expect(literal).toContain("isolate");
    }
  });
});
