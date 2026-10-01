"use client";

import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ContentSkeleton, ErrorState, AsyncButton } from "@/components/feedback";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import "./swagger-dark.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <ContentSkeleton label="Memuat dokumentasi…" variant="table" />,
});

interface SwaggerUiClientProps {
  specUrl: string;
}

export default function SwaggerUiClient({ specUrl }: SwaggerUiClientProps) {
  const { data, loading, error, reload } = useFeedbackResource<object>(specUrl, "Dokumentasi belum dapat dimuat.");
  if (!data && loading) return <ContentSkeleton label="Memuat dokumentasi…" variant="table" />;
  if (!data) return <ErrorState title="Dokumentasi belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />;
  return (
    <div className="swagger-dark" data-testid="swagger-ui-dark">
      <SwaggerUI
        spec={data}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        supportedSubmitMethods={[]}
        tryItOutEnabled={false}
        persistAuthorization={false}
      />
    </div>
  );
}
