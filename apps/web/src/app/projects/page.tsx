'use client';

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";

// Dynamically load heavy workspace components (client-side only)
const V0ChatPanel = dynamic(
  () => import("@/components/chat/V0ChatPanel").then((m) => m.V0ChatPanel),
  { ssr: false }
);

const V0WorkspacePanel = dynamic(
  () => import("@/components/editor/V0WorkspacePanel").then((m) => m.V0WorkspacePanel),
  { ssr: false }
);

function getUrlParams() {
  if (typeof window === "undefined") {
    return { id: null, prompt: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id"),
    prompt: params.get("prompt"),
  };
}

export default function ProjectsPage() {
  const [params, setParams] = useState<{ id: string | null; prompt: string | null }>({
    id: null,
    prompt: null,
  });

  useEffect(() => {
    setParams(getUrlParams());
  }, []);

  const { id: projectId, prompt } = params;

  if (!projectId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">
          {typeof window === "undefined" ? "" : "Missing project id"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[#0e0e11]">
      {/* Workspace Header */}
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
            Micracode
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-zinc-200">{projectId}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {prompt ? `"${prompt.slice(0, 30)}${prompt.length > 30 ? "…" : ""}"` : ""}
          </span>
        </div>
      </header>

      {/* Main workspace: chat sidebar + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel (left sidebar) */}
        <aside className="w-[400px] min-w-[320px] max-w-[500px] border-r border-zinc-800 overflow-hidden flex flex-col">
          <V0ChatPanel
            projectId={projectId}
            initialPrompt={prompt ?? ""}
            hasInitialHistory={false}
          />
        </aside>

        {/* Editor + Preview (right area) */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <V0WorkspacePanel
            projectId={projectId}
            projectName={projectId}
          />
        </main>
      </div>
    </div>
  );
}