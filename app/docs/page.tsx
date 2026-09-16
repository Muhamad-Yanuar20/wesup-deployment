import SwaggerUiClient from "./SwaggerUiClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Wesup API Documentation",
  description: "Dokumentasi API Wesup",
};

export default function DocsPage() {
  return (
    <main
      className="docs-dark-shell min-h-screen px-4 py-6 sm:px-8"
      style={{ colorScheme: "dark" }}
    >
      <div className="mx-auto max-w-7xl">
        <SwaggerUiClient specUrl="/docs/openapi.json" />
      </div>
    </main>
  );
}
