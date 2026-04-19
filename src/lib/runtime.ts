import { Layer } from "effect";
import { OllamaModelLive } from "@/lib/chat";
import { ChromaDbLive } from "@/lib/chroma";
import { DatabaseLive } from "@/lib/db";
import { EmbeddingsLive } from "@/lib/embed";
import { SearchIndexLive } from "@/lib/search";
import { WebsiteFetcherLive } from "@/lib/website";

/**
 * Application layer using Supabase REST API
 *
 * Requires environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY
 */

const BaseLayer = Layer.mergeAll(DatabaseLive, ChromaDbLive);

const ServiceLayer = Layer.mergeAll(
  SearchIndexLive,
  EmbeddingsLive,
  OllamaModelLive,
  WebsiteFetcherLive,
);

export const AppLayer = ServiceLayer.pipe(Layer.provideMerge(BaseLayer));
