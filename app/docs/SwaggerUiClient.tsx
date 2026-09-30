"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import "./swagger-dark.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="docs-swagger-loading rounded-xl border p-6 text-sm">
      Memuat dokumentasi API…
    </div>
  ),
});

interface SwaggerUiClientProps {
  specUrl: string;
}

export default function SwaggerUiClient({ specUrl }: SwaggerUiClientProps) {
  return (
    <div className="swagger-dark" data-testid="swagger-ui-dark">
      <SwaggerUI
        url={specUrl}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        supportedSubmitMethods={[]}
        tryItOutEnabled={false}
        persistAuthorization={false}
      />
    </div>
  );
}
