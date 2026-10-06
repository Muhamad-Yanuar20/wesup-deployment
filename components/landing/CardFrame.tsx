import type { ReactNode } from "react";

interface CardFrameProps {
  children: ReactNode;
  /** Classes for the outer surface: grid placement, margins, colour, ring. */
  className?: string;
  /** Classes for the inner panel: background, padding, layout. */
  panelClassName?: string;
  /** Outer corner radius, in rem. */
  radius?: number;
  /** Frame thickness in rem; the panel radius is compensated by the same amount. */
  frameRem?: number;
}

/**
 * Double-bezel card shell: an outer surface padded by `frameRem` around an
 * inner panel whose corner radius is reduced by the same amount, so the two
 * curves stay concentric at any size. Geometry is inline style because it is
 * computed; all colour, ring, shadow and typography stay in Tailwind classes.
 */
export function CardFrame({
  children,
  className = "",
  panelClassName = "",
  radius = 2,
  frameRem = 0.375,
}: CardFrameProps) {
  return (
    <div
      className={className}
      style={{ borderRadius: `${radius}rem`, padding: `${frameRem}rem` }}
    >
      <div className={panelClassName} style={{ borderRadius: `${radius - frameRem}rem` }}>
        {children}
      </div>
    </div>
  );
}
