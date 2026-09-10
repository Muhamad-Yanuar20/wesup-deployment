// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BusinessLocationPicker from "@/components/maps/BusinessLocationPicker";
import { renderComponent as render } from "./test-utils";

vi.mock("react-leaflet", () => ({
  CircleMarker: ({ children }: { children?: ReactNode }) => createElement("div", { "data-testid": "marker" }, children),
  MapContainer: ({ children }: { children?: ReactNode }) => createElement("div", { "data-testid": "map" }, children),
  Popup: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  TileLayer: () => null,
  useMap: () => ({
    getCenter: () => ({ lat: -6.914744, lng: 107.60981 }),
    getContainer: () => ({ setAttribute: vi.fn() }),
    flyTo: vi.fn(),
  }),
  useMapEvents: () => null,
}));

describe("BusinessLocationPicker", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn() } });
  });

  it("provides manual and keyboard-friendly map selection controls", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BusinessLocationPicker value={null} onChange={onChange} />);
    expect(screen.getByRole("region", { name: /lokasi usaha pada peta/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /pilih titik tengah peta/i }));
    expect(onChange).toHaveBeenCalledWith({ lat: -6.914744, lng: 107.60981 });
  });

  it("uses device geolocation when available", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: -6.92, longitude: 107.61 } } as GeolocationPosition));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    render(<BusinessLocationPicker value={null} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /gunakan lokasi saya/i }));
    expect(onChange).toHaveBeenCalledWith({ lat: -6.92, lng: 107.61 });
  });
});
