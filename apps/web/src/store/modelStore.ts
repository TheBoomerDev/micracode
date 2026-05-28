"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  getModelCatalog,
  type ModelCatalog,
} from "@/lib/api/models";

interface PersistedSlice {
  provider: string | null;
  model: string | null;
  geminiKey: string;
  openaiKey: string;
  openrouterKey: string;
  deepseekKey: string;
  glmKey: string;
  ollamaUrl: string;
}

interface ModelStoreState extends PersistedSlice {
  catalog: ModelCatalog | null;
  isLoading: boolean;
  error: string | null;
  setSelection: (provider: string, model: string) => void;
  saveApiKey: (provider: string, key: string) => void;
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

function buildKeysDict(state: PersistedSlice): Record<string, string> {
  const keys: Record<string, string> = {};
  if (state.geminiKey) keys.gemini = state.geminiKey;
  if (state.openaiKey) keys.openai = state.openaiKey;
  if (state.openrouterKey) keys.openrouter = state.openrouterKey;
  if (state.deepseekKey) keys.deepseek = state.deepseekKey;
  if (state.glmKey) keys.glm = state.glmKey;
  if (state.ollamaUrl) keys.ollama = state.ollamaUrl;
  return keys;
}

const PERSIST_KEY = "oe:selected-model";

export const useModelStore = create<ModelStoreState>()(
  persist(
    (set, get) => ({
      provider: null,
      model: null,
      geminiKey: "",
      openaiKey: "",
      openrouterKey: "",
      deepseekKey: "",
      glmKey: "",
      ollamaUrl: "http://localhost:11434",
      catalog: null,
      isLoading: false,
      error: null,

      setSelection: (provider: string, model: string) => set({ provider, model }),

      saveApiKey: (provider: string, key: string) => {
        const patch: Record<string, string | null> = {};
        patch[`${provider}Key`] = key;
        set(patch as unknown as Partial<ModelStoreState>);
      },

      loadCatalog: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        try {
          const state = get();
          const keys = buildKeysDict(state);
          const catalog = await getModelCatalog(keys);

          const { provider, model } = state;
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
        openrouterKey: state.openrouterKey,
        deepseekKey: state.deepseekKey,
        glmKey: state.glmKey,
        ollamaUrl: state.ollamaUrl,
      }),
    },
  ),
);
