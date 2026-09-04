import { type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";

function NonStrict({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderComponent(ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { ...options, wrapper: NonStrict });
}
