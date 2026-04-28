import { Config } from "effect";

export const OpenRouterApiKey = Config.redacted("OPENROUTER_API_KEY");
export const OllamaApiKey = Config.redacted("OLLAMA_API_KEY");
export const OllamaApiUrl = Config.string("OLLAMA_API_URL");
export const ChromaUrl = Config.string("CHROMA_URL").pipe(
  Config.withDefault("http://localhost:8000"),
);

// Supabase configuration
export const SupabaseUrl = Config.string("SUPABASE_URL");
export const SupabaseAnonKey = Config.redacted("SUPABASE_ANON_KEY");
export const SupabaseServiceKey = Config.redacted("SUPABASE_SERVICE_ROLE_KEY");
