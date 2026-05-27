'use client';

import { Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useModelStore } from "@/store/modelStore";

type ProviderId = "gemini" | "openai" | "ollama";

const PROVIDERS: { id: ProviderId; label: string; docs: string }[] = [
  { id: "gemini", label: "Google Gemini", docs: "https://ai.google.dev/gemini-api/docs" },
  { id: "openai", label: "OpenAI", docs: "https://platform.openai.com/api-keys" },
  { id: "ollama", label: "Ollama (local)", docs: "https://ollama.com/download" },
];

interface SavedSettings {
  provider: ProviderId;
  geminiKey: string;
  openaiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  geminiModel: string;
  openaiModel: string;
}

const STORAGE_KEY = "oe:settings";

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
    ollamaModel: "llama3.2",
    geminiModel: "gemini-2.5-flash",
    openaiModel: "gpt-4o",
  };
}

function saveSettings(s: SavedSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
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
  const loadCatalog = useModelStore((s) => s.loadCatalog);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const update = (patch: Partial<SavedSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    // Re-trigger catalog loading so the UI sees new provider/models
    loadCatalog();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
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

          {/* Gemini Key */}
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
              <a
                href={PROVIDERS.find((p) => p.id === "gemini")?.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-blue-400 hover:underline"
              >
                Get an API key →
              </a>
            </fieldset>
          )}

          {/* Gemini Model */}
          {settings.provider === "gemini" && (
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Model
              </label>
              <input
                type="text"
                value={settings.geminiModel}
                onChange={(e) => update({ geminiModel: e.target.value })}
                placeholder="gemini-2.5-flash"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono"
              />
            </fieldset>
          )}

          {/* OpenAI Key */}
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
              <a
                href={PROVIDERS.find((p) => p.id === "openai")?.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-blue-400 hover:underline"
              >
                Get an API key →
              </a>
            </fieldset>
          )}

          {/* OpenAI Model */}
          {settings.provider === "openai" && (
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Model
              </label>
              <input
                type="text"
                value={settings.openaiModel}
                onChange={(e) => update({ openaiModel: e.target.value })}
                placeholder="gpt-4o"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono"
              />
            </fieldset>
          )}

          {/* Ollama */}
          {settings.provider === "ollama" && (
            <>
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
              <fieldset>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Model
                </label>
                <input
                  type="text"
                  value={settings.ollamaModel}
                  onChange={(e) => update({ ollamaModel: e.target.value })}
                  placeholder="llama3.2"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono"
                />
              </fieldset>
            </>
          )}
        </div>

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