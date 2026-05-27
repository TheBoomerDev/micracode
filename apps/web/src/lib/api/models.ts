/**
 * Typed client for `GET /v1/models`.
 *
 * The backend returns the catalog of provider+model pairs the server
 * will accept, flagging each provider with `available: boolean` based
 * on whether the corresponding API key is configured. The UI picker
 * consumes this to disable unavailable providers.
 *
 * When the user has API keys saved in Settings, they are passed to
 * the backend so it can fetch models dynamically from each provider.
 */

import { env } from "@/lib/env";

export type ProviderId = "openai" | "gemini" | "openrouter" | "deepseek" | "glm" | "zai" | "ollama";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderCatalog {
  id: ProviderId;
  label: string;
  available: boolean;
  models: ModelOption[];
}

export interface ModelCatalog {
  providers: ProviderCatalog[];
  default: { provider: string; model: string };
}

/**
 * Fetch model catalog from the backend.
 *
 * @param apiKeys - Optional dict of provider_id → api_key from user settings.
 *                  When provided, the backend fetches models directly from
 *                  each provider's API for live results.
 */
export async function getModelCatalog(
  apiKeys?: Record<string, string>,
  init?: RequestInit,
): Promise<ModelCatalog> {
  let url = `${env.API_BASE_URL}/v1/models`;
  if (apiKeys && Object.keys(apiKeys).length > 0) {
    url += `?keys=${encodeURIComponent(JSON.stringify(apiKeys))}`;
  }
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`GET /v1/models failed: ${res.status}`);
  }
  return (await res.json()) as ModelCatalog;
}
