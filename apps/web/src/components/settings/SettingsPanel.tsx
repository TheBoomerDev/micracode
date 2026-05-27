'use client';

import { Check, ChevronDown, RefreshCw, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useModelStore } from "@/store/modelStore";

type ProviderId = "gemini" | "openai" | "ollama";

const PROVIDERS: { id: ProviderId; label: string; docs: string }[] = [
  { id: "gemini", label: "Google Gemini", docs: "https://ai.google.dev/gemini-api/docs" },
  { id: "openai", label: "OpenAI", docs: "https://platform.openai.com/api-keys" },
  { id: "ollama", label: "Ollama (local)", docs: "https://ollama.com/download" },
];

const STORAGE_KEY = "oe:settings";

interface SavedSettings {
  provider: ProviderId;
  geminiKey: string;
  openaiKey: string;
  ollamaUrl: string;
  outputDir: string;
}

function loadSettings(): SavedSettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {}
  return defaultSettings();
}

function defaultSettings(): SavedSettings {
  return {
    provider: "gemini",
    geminiKey: "",
    openaiKey: "",
    ollamaUrl: "http://localhost:11434",
    outputDir: "",
  };
}

function saveSettings(s: SavedSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg transition hover:bg-zinc-700 hover:text-white"
        title="Settings"
      >
        <Settings className="size-5" />
      </button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<SavedSettings>(loadSettings);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const catalog = useModelStore((s) => s.catalog);
  const isLoading = useModelStore((s) => s.isLoading);
  const storeProvider = useModelStore((s) => s.provider);
  const storeModel = useModelStore((s) => s.model);
  const setSelection = useModelStore((s) => s.setSelection);
  const loadCatalog = useModelStore((s) => s.loadCatalog);
  const saveApiKey = useModelStore((s) => s.saveApiKey);

  // Load models from providers on mount
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modelPickerOpen) setModelPickerOpen(false);
        else onClose();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose, modelPickerOpen]);

  const update = (patch: Partial<SavedSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    // Sync API keys with modelStore so it can fetch models directly
    if (patch.geminiKey !== undefined) saveApiKey("gemini", patch.geminiKey);
    if (patch.openaiKey !== undefined) saveApiKey("openai", patch.openaiKey);
    if (patch.ollamaUrl !== undefined) saveApiKey("ollama", patch.ollamaUrl);
    if (patch.provider !== undefined) {
      // When provider changes, trigger catalog reload
      loadCatalog();
    }
  };

  const activeProvider = catalog?.providers.find((p) => p.id === settings.provider);
  const activeModel = activeProvider?.models.find((m) => m.id === storeModel);
  const activeLabel = activeModel?.label ?? storeModel ?? "Select model";
  const hasApiKey = settings.provider === "gemini" ? settings.geminiKey
    : settings.provider === "openai" ? settings.openaiKey
    : settings.ollamaUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 px-5 py-5">
          {/* Provider */}
          <fieldset>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              LLM Provider
            </label>
            <select
              value={settings.provider}
              onChange={(e) => update({ provider: e.target.value as ProviderId })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </fieldset>

          {/* API Key */}
          {settings.provider === "gemini" && (
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={settings.geminiKey}
                onChange={(e) => update({ geminiKey: e.target.value })}
                placeholder="AIza..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
              />
              <a href={PROVIDERS.find((p) => p.id === "gemini")?.docs}
                 target="_blank" rel="noopener noreferrer"
                 className="mt-1 block text-xs text-blue-400 hover:underline">
                Get an API key →
              </a>
            </fieldset>
          )}
          {settings.provider === "openai" && (
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={settings.openaiKey}
                onChange={(e) => update({ openaiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
              />
              <a href={PROVIDERS.find((p) => p.id === "openai")?.docs}
                 target="_blank" rel="noopener noreferrer"
                 className="mt-1 block text-xs text-blue-400 hover:underline">
                Get an API key →
              </a>
            </fieldset>
          )}
          {settings.provider === "ollama" && (
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Ollama Base URL
              </label>
              <input
                type="text"
                value={settings.ollamaUrl}
                onChange={(e) => update({ ollamaUrl: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono"
              />
            </fieldset>
          )}

          {/* Model selector (dynamic from API) */}
          <fieldset>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Model
            </label>
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => {
                  if (catalog && activeProvider) setModelPickerOpen(!modelPickerOpen);
                  else if (hasApiKey) loadCatalog();
                }}
                disabled={isLoading}
                className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                <span className="truncate font-mono">{isLoading ? "Loading models..." : activeLabel}</span>
                <ChevronDown className="size-4 shrink-0 opacity-70" />
              </button>

              {/* Refresh button */}
              {hasApiKey && (
                <button
                  type="button"
                  onClick={() => loadCatalog()}
                  disabled={isLoading}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
                  title="Refresh models from API"
                >
                  <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              )}

              {/* Dropdown */}
              {modelPickerOpen && catalog && activeProvider && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
                  {activeProvider.models.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-zinc-500">
                      {hasApiKey ? "No models found. Try refreshing." : "Enter an API key to load models."}
                    </div>
                  ) : (
                    activeProvider.models.map((m) => {
                      const isActive = storeModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelection(settings.provider, m.id);
                            setModelPickerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-zinc-800 ${
                            isActive ? "bg-zinc-800 text-white" : "text-zinc-300"
                          }`}
                        >
                          <span className="flex flex-col">
                            <span className="font-medium">{m.label}</span>
                            <span className="font-mono text-[10px] text-zinc-500">{m.id}</span>
                          </span>
                          {isActive && <Check className="size-4 text-zinc-200" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            {!hasApiKey && (
              <p className="mt-1 text-[10px] text-zinc-600">
                Enter an API key above to load available models dynamically.
              </p>
            )}
          </fieldset>

          {/* Output Directory */}
          <fieldset>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Output Directory
            </label>
            <p className="mb-2 text-[10px] text-zinc-600">
              Projects will be created at this path: <code className="text-zinc-500">{settings.outputDir || "~/opener-apps/"} / {"{project-name}"}</code>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.outputDir}
                onChange={(e) => update({ outputDir: e.target.value })}
                placeholder="./output"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono"
              />
              <button
                type="button"
                onClick={() => update({ outputDir: "" })}
                className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Default
              </button>
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}