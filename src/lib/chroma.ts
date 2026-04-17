import { ChromaClient } from "chromadb";

const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";

let _client: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (!_client) {
    _client = new ChromaClient({ path: CHROMA_URL });
  }
  return _client;
}

const COLLECTION_NAME = "shiryouku_chunks";

export async function getOrCreateCollection() {
  const client = getChromaClient();
  return client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });
}

export async function deleteCollection() {
  const client = getChromaClient();
  try {
    await client.deleteCollection({ name: COLLECTION_NAME });
  } catch {
    // collection doesn't exist, that's fine
  }
}
