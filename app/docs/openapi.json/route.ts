import { NextResponse } from "next/server";
import { authorizeDocsRequest } from "@/lib/docs/basic-auth";
import { openApiDocument } from "@/lib/openapi/document";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const denied = authorizeDocsRequest(request);
  if (denied) return denied;

  return NextResponse.json(openApiDocument, {
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}
