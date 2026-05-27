'use client';

import { FileText, GitBranch, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    setParams(getUrlParams());
  }, []);

  const { id: projectId, prompt } = params;

  const runAction = async (action: "docs" | "git") => {
    if (!projectId || actionLoading) return;
    setActionLoading(action);
    setActionResult(null);
    try {
      const res = await fetch(
        `http://127.0.0.1:8001/v1/projects/${encodeURIComponent(projectId)}/${action === "docs" ? "docs/generate" : "git/init"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: action === "docs" ? JSON.stringify({ prompt: prompt ?? projectId }) : undefined,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const count = action === "docs" ? data.sections?.length : data.repos?.length;
      setActionResult(`${action === "docs" ? "Docs" : "Git"} ready (${count || 0} items)`);
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

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
          {/* Action buttons */}
          <div className="flex items-center gap-1 ml-4 border-l border-zinc-800 pl-4">
            <button
              type="button"
              onClick={() => runAction("docs")}
              disabled={actionLoading !== null}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              title="Generate project documentation (PRD, specs, roadmap)"
            >
              {actionLoading === "docs" ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
              Docs
            </button>
            <button
              type="button"
              onClick={() => runAction("git")}
              disabled={actionLoading !== null}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              title="Initialize git repos with conventional commits"
            >
              {actionLoading === "git" ? <Loader2 className="size-3 animate-spin" /> : <GitBranch className="size-3" />}
              Git
            </button>
            {actionResult && (
              <span className="ml-2 text-[10px] text-zinc-500 truncate max-w-[200px]">{actionResult}</span>
            )}
          </div>
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