import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <div className={`mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 ${className}`}>{children}</div>;
}
