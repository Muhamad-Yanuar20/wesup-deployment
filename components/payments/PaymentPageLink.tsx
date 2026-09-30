import type { AnchorHTMLAttributes, ReactNode } from "react";

export default function PaymentPageLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return <a {...props}>{children}</a>;
}
