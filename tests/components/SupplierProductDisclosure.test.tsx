// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SupplierBatchProductDisclosure from "@/components/supplier-batch/SupplierBatchProductDisclosure";
vi.mock("@/components/supplier-batch/SupplierBatchDetailClient", () => ({ default: ({ batchId }: { batchId: string }) => <p>Produk {batchId}</p> }));
it("does not mount the fetching form before disclosure is opened, and retains it afterwards", () => {
 const view = render(<SupplierBatchProductDisclosure batchId="fixture" />);
 expect(screen.queryByText("Produk fixture")).not.toBeInTheDocument();
 const disclosure = view.container.querySelector("details")!;
 disclosure.open = true; fireEvent(disclosure, new Event("toggle"));
 expect(screen.getByText("Produk fixture")).toBeInTheDocument();
 disclosure.open = false; fireEvent(disclosure, new Event("toggle"));
 expect(screen.getByText("Produk fixture")).toBeInTheDocument();
});
