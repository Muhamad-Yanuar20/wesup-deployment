import { getServerClient } from "@/lib/supabase/server";
import { requireRole, type AuthClient } from "@/lib/supabase/auth";
import OfferDraftListClient from "./OfferDraftListClient";

export default async function OfferDraftList() {
  const client = await getServerClient();
  const owner = await requireRole(client as unknown as AuthClient, ["supplier"]);
  return <OfferDraftListClient key={owner.userId} ownerId={owner.userId} />;
}
