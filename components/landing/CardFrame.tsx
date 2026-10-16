import type { ReactNode } from "react";

interface CardFrameProps {
  children: ReactNode;
  /** Classes for the outer surface: grid placement, margins, colour, border. */
  className?: string;
  /** Classes for the inner panel: background, padding, layout. */
  panelClassName?: string;
  /** Frame thickness in rem; 0 makes the panel flush with the outer border. */
  frameRem?: number;
}

/**
 * Framed card shell: an outer surface padded by `frameRem` around an inner
 * panel. No radius — Swiss Industrial Print is all hard edges. Geometry is
 * inline style because it is computed; colour, border and typography stay in
 * Tailwind classes.
 */
export function CardFrame({
  children,
  className = "",
  panelClassName = "",
  frameRem = 0.375,
}: CardFrameProps) {
  return (
    <div className={className} style={{ padding: `${frameRem}rem` }}>
      <div className={panelClassName}>{children}</div>
    </div>
  );
}
