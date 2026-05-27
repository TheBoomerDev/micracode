"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  getModelCatalog,
  type ModelCatalog,
} from "@/lib/api/models";

type ProviderId = "openai" | "gemini" | "ollama";

interface PersistedSlice {
  provider: string | null;
  model: string | null;
  /** API keys saved by the user via Settings panel */
  geminiKey: string;
  openaiKey: string;
  ollamaUrl: string;
}

interface ModelStoreState extends PersistedSlice {
  catalog: ModelCatalog | null;
  isLoading: boolean;
  error: string | null;
  setSelection: (provider: string, model: string) => void;
  saveApiKey: (provider: ProviderId, key: string) => void;
  loadCatalog: () => Promise<void>;
}

function isPairInCatalog(
  catalog: ModelCatalog,
  provider: string | null,
  model: string | null,
): boolean {
  if (!provider || !model) return false;
  const p = catalog.providers.find((pp) => pp.id === provider);
  if (!p) return false;
  return p.models.some((m) => m.id === model);
}

const PERSIST_KEY = "oe:selected-model";

/** Fetch models directly from OpenAI API using the user's key */
async function fetchOpenAIModels(apiKey: string): Promise<{ id: string; label: string }[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .filter((m: any) => m.id.startsWith("gpt-") || m.id.startsWith("o"))
    .map((m: any) => ({ id: m.id, label: m.id }));
}

/** Fetch models directly from Gemini API using the user's key */
async function fetchGeminiModels(apiKey: string): Promise<{ id: string; label: string }[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return (data.models || [])
    .filter((m: any) => m.name.startsWith("models/gemini-") || m.name.startsWith("models/learnlm-"))
    .map((m: any) => {
      const id = m.name.replace("models/", "");
      return { id, label: id.replace(/-/g, " ") };
    });
}

export const useModelStore = create<ModelStoreState>()(
  persist(
    (set, get) => ({
      provider: null,
      model: null,
      geminiKey: "",
      openaiKey: "",
      ollamaUrl: "http://localhost:11434",
      catalog: null,
      isLoading: false,
      error: null,

      setSelection: (provider, model) => set({ provider, model }),

      saveApiKey: (provider, key) => {
        const patch: Partial<ModelStoreState> = {};
        if (provider === "gemini") patch.geminiKey = key;
        if (provider === "openai") patch.openaiKey = key;
        if (provider === "ollama") patch.ollamaUrl = key;
        set(patch);
      },

      loadCatalog: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        const { geminiKey, openaiKey, ollamaUrl } = get();

        try {
          // Try direct API fetch first (more dynamic, uses user's keys)
          const providers: any[] = [];
          let hasDirect = false;

          // Gemini
          if (geminiKey) {
            try {
              const models = await fetchGeminiModels(geminiKey);
              providers.push({ id: "gemini", label: "Google Gemini", available: true, models });
              hasDirect = true;
            } catch (e) {
              providers.push({ id: "gemini", label: "Google Gemini", available: true, models: get()?.catalog?.providers?.find(p => p.id === "gemini")?.models || [] });
            }
          }

          // OpenAI
          if (openaiKey) {
            try {
              const models = await fetchOpenAIModels(openaiKey);
              providers.push({ id: "openai", label: "OpenAI", available: true, models });
              hasDirect = true;
            } catch (e) {
              providers.push({ id: "openai", label: "OpenAI", available: true, models: [] });
            }
          }

          // Ollama
          if (ollamaUrl) {
            try {
              const res = await fetch(`${ollamaUrl}/api/tags`);
              if (res.ok) {
                const data = await res.json();
                const models = (data.models || []).map((m: any) => ({
                  id: m.name,
                  label: m.name,
                }));
                providers.push({ id: "ollama", label: "Ollama (local)", available: true, models });
                hasDirect = true;
              }
            } catch (e) {
              // ignore
            }
          }

          if (hasDirect) {
            const defaultProvider = providers[0]?.id || "gemini";
            const defaultModel = providers[0]?.models?.[0]?.id || "";
            const catalog: ModelCatalog = {
              providers,
              default: { provider: defaultProvider, model: defaultModel },
            };
            const { provider, model } = get();
            const keep = isPairInCatalog(catalog, provider, model);
            set({
              catalog,
              provider: keep ? provider : catalog.default.provider,
              model: keep ? model : catalog.default.model,
              isLoading: false,
            });
            return;
          }

          // Fall back to server catalog
          const catalog = await getModelCatalog();
          const { provider, model } = get();
          const keep = isPairInCatalog(catalog, provider, model);
          set({
            catalog,
            provider: keep ? provider : catalog.default.provider,
            model: keep ? model : catalog.default.model,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedSlice => ({
        provider: state.provider,
        model: state.model,
        geminiKey: state.geminiKey,
        openaiKey: state.openaiKey,
        ollamaUrl: state.ollamaUrl,
      }),
    },
  ),
);
