"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileText,
  History,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { V0ChatInput } from "@/components/chat/V0ChatInput";
import { env } from "@/lib/env";
import {
  getProjectFiles,
  popLastAssistantPrompt,
  restoreSnapshot,
} from "@/lib/api/projects";
import {
  messageText,
  type MicracodeUIMessage,
} from "@/lib/api/uiMessage";
import { cn } from "@/lib/utils";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { useModelStore } from "@/store/modelStore";
import { usePendingPromptStore } from "@/store/pendingPromptStore";
import { useWebContainerStore } from "@/store/webContainerStore";

export interface V0ChatPanelProps {
  projectId: string;
  initialMessages?: MicracodeUIMessage[];
  initialPrompt?: string;
  hasInitialHistory?: boolean;
}

type Stage = "idle" | "planning" | "generating" | "done" | "cancelled" | "plan_ready";

type ProcessLog =
  | { id: string; kind: "thought"; seconds: number }
  | { id: string; kind: "brief"; note?: string }
  | { id: string; kind: "explore"; note: string }
  | { id: string; kind: "file-write"; path: string; created: boolean }
  | { id: string; kind: "file-delete"; path: string }
  | { id: string; kind: "shell"; command: string };

const autoSubmittedProjectIds = new Set<string>();

let logIdCounter = 0;
const nextLogId = () => `log-${++logIdCounter}-${Date.now()}`;

function basename(path: string): string {
  const clean = path.replace(/\/+$/, "");
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? clean : clean.slice(idx + 1);
}

function LogRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs text-zinc-400">
      {children}
    </div>
  );
}

function LogIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-4 shrink-0 items-center justify-center text-zinc-500">
      {children}
    </span>
  );
}

function renderLog(log: ProcessLog): React.ReactNode {
  switch (log.kind) {
    case "thought":
      return (
        <LogRow>
          <LogIcon>
            <Zap className="size-3.5" />
          </LogIcon>
          <span>Thought for {log.seconds}s</span>
        </LogRow>
      );
    case "brief":
      return (
        <LogRow>
          <LogIcon>
            <Sparkles className="size-3.5" />
          </LogIcon>
          <span>{log.note ?? "Generated design brief"}</span>
        </LogRow>
      );
    case "explore":
      return (
        <LogRow>
          <LogIcon>
            <Search className="size-3.5" />
          </LogIcon>
          <span>{log.note}</span>
        </LogRow>
      );
    case "file-write":
      return (
        <LogRow>
          <LogIcon>
            <FileText className="size-3.5" />
          </LogIcon>
          <span>
            {log.created ? "Added" : "Updated"}{" "}
            <span className="font-mono text-zinc-300">{basename(log.path)}</span>
          </span>
        </LogRow>
      );
    case "file-delete":
      return (
        <LogRow>
          <LogIcon>
            <FileText className="size-3.5" />
          </LogIcon>
          <span>
            Deleted{" "}
            <span className="font-mono text-zinc-300">{basename(log.path)}</span>
          </span>
        </LogRow>
      );
    case "shell":
      return (
        <LogRow>
          <LogIcon>
            <Terminal className="size-3.5" />
          </LogIcon>
          <span className="font-mono text-zinc-300">$ {log.command}</span>
        </LogRow>
      );
  }
}

export function V0ChatPanel({
  projectId,
  initialMessages,
  initialPrompt,
  hasInitialHistory = false,
}: V0ChatPanelProps) {
  const pathname = usePathname();
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [logsByAssistantId, setLogsByAssistantId] = useState<
    Record<string, ProcessLog[]>
  >({});

  const retryFlagRef = useRef(false);
  const pendingLogsRef = useRef<ProcessLog[]>([]);
  const planningStartedAtRef = useRef<number | null>(null);
  const briefEmittedRef = useRef(false);
  const messagesScrollerRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<MicracodeUIMessage>({
        api: `${env.API_BASE_URL}/v1/generate`,
        prepareSendMessagesRequest: ({ messages }) => {
          const lastUser = [...messages]
            .reverse()
            .find((m) => m.role === "user");
          const prompt = lastUser ? messageText(lastUser) : "";
          const retry = retryFlagRef.current;
          retryFlagRef.current = false;
          // Read selection at request time (not closure capture) so
          // swapping models mid-session doesn't require recreating the
          // transport and resetting `useChat`'s internal state.
          const { provider, model } = useModelStore.getState();
          return {
            body: {
              project_id: projectId,
              prompt,
              retry,
              provider,
              model,
            },
          };
        },
      }),
    [projectId],
  );

  const appendLogToLatestAssistant = useCallback(
    (log: ProcessLog, messagesSnapshot: MicracodeUIMessage[]) => {
      let id: string | null = null;
      for (let i = messagesSnapshot.length - 1; i >= 0; i--) {
        if (messagesSnapshot[i]!.role === "assistant") {
          id = messagesSnapshot[i]!.id;
          break;
        }
      }
      if (id) {
        const targetId = id;
        setLogsByAssistantId((prev) => ({
          ...prev,
          [targetId]: [...(prev[targetId] ?? []), log],
        }));
      } else {
        pendingLogsRef.current.push(log);
      }
    },
    [],
  );

  const { messages, setMessages, sendMessage, status, error, stop } =
    useChat<MicracodeUIMessage>({
      id: projectId,
      messages: initialMessages,
      transport,
      onData: (part) => {
        switch (part.type) {
          case "data-file-write": {
            const path = part.data.path;
            const created = !useFileSystemStore
              .getState()
              .hydratedPaths.has(path);
            useFileSystemStore
              .getState()
              .upsertFile(path, part.data.content);
            setMessages((prev) => {
              appendLogToLatestAssistant(
                { id: nextLogId(), kind: "file-write", path, created },
                prev,
              );
              return prev;
            });
            break;
          }
          case "data-file-delete": {
            const path = part.data.path;
            useFileSystemStore.getState().deleteFile(path);
            setMessages((prev) => {
              appendLogToLatestAssistant(
                { id: nextLogId(), kind: "file-delete", path },
                prev,
              );
              return prev;
            });
            break;
          }
          case "data-shell-exec": {
            const command = part.data.command;
            useWebContainerStore
              .getState()
              .enqueueShell(command, part.data.cwd ?? undefined);
            setMessages((prev) => {
              appendLogToLatestAssistant(
                { id: nextLogId(), kind: "shell", command },
                prev,
              );
              return prev;
            });
            break;
          }
          case "data-status": {
            const nextStage = part.data.stage;
            setStage(nextStage);

            if (nextStage === "planning") {
              planningStartedAtRef.current = Date.now();
              briefEmittedRef.current = false;
            } else if (nextStage === "generating") {
              const startedAt = planningStartedAtRef.current;
              if (startedAt != null) {
                const seconds = Math.max(
                  1,
                  Math.round((Date.now() - startedAt) / 1000),
                );
                planningStartedAtRef.current = null;
                setMessages((prev) => {
                  appendLogToLatestAssistant(
                    { id: nextLogId(), kind: "thought", seconds },
                    prev,
                  );
                  if (!briefEmittedRef.current) {
                    briefEmittedRef.current = true;
                    appendLogToLatestAssistant(
                      {
                        id: nextLogId(),
                        kind: "brief",
                        note: part.data.note ?? "Generated design brief",
                      },
                      prev,
                    );
                  }
                  return prev;
                });
              }
            }

            if (part.data.snapshot_id) {
              const snapshotId = part.data.snapshot_id;
              setMessages((prev) => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i]!.role === "assistant") {
                    next[i] = {
                      ...next[i]!,
                      metadata: {
                        ...(next[i]!.metadata ?? {}),
                        snapshot_id: snapshotId,
                      },
                    };
                    break;
                  }
                }
                return next;
              });
            }
            break;
          }
        }
      },
      onFinish: () => {
        setStage("idle");
      },
      onError: () => {
        setStage("idle");
      },
    });

  const isStreaming = status === "submitted" || status === "streaming";

  // Flush buffered logs onto the first assistant message once it exists.
  useEffect(() => {
    if (pendingLogsRef.current.length === 0) return;
    let id: string | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "assistant") {
        id = messages[i]!.id;
        break;
      }
    }
    if (!id) return;
    const targetId = id;
    const buffered = pendingLogsRef.current;
    pendingLogsRef.current = [];
    setLogsByAssistantId((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] ?? []), ...buffered],
    }));
  }, [messages]);

  // Auto-scroll chat to bottom as new content streams in.
  useEffect(() => {
    const el = messagesScrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, logsByAssistantId, stage]);

  useEffect(() => {
    const trimmed = initialPrompt?.trim();
    if (!trimmed || hasInitialHistory) return;
    if (autoSubmittedProjectIds.has(projectId)) return;
    autoSubmittedProjectIds.add(projectId);

    if (typeof window !== "undefined") {
      const nextUrl = `${pathname}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }

    void sendMessage({ text: trimmed });
  }, [hasInitialHistory, initialPrompt, pathname, projectId, sendMessage]);

  const pendingPrompt = usePendingPromptStore((s) => s.pending);
  const clearPending = usePendingPromptStore((s) => s.clearPending);
  useEffect(() => {
    if (!pendingPrompt || isStreaming) return;
    clearPending();
    void sendMessage({ text: pendingPrompt });
  }, [pendingPrompt, isStreaming, clearPending, sendMessage]);

  const onSend = useCallback(async () => {
    if (!draft.trim() || isStreaming) return;
    const prompt = draft;
    setDraft("");
    await sendMessage({ text: prompt });
  }, [draft, isStreaming, sendMessage]);

  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") return messageText(messages[i]!);
    }
    return "";
  }, [messages]);

  const onRetry = useCallback(async () => {
    if (isStreaming || !lastUserText) return;
    try {
      await popLastAssistantPrompt(projectId);
    } catch {
      // Non-fatal.
    }
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]!.role === "assistant") {
          next.splice(i, 1);
          break;
        }
      }
      return next;
    });
    retryFlagRef.current = true;
    await sendMessage({ text: lastUserText });
  }, [isStreaming, lastUserText, projectId, sendMessage, setMessages]);

  const onRevert = useCallback(
    async (messageId: string, snapshotId: string) => {
      if (isStreaming || isReverting) return;
      setIsReverting(messageId);
      try {
        await restoreSnapshot(projectId, snapshotId);
        const { tree } = await getProjectFiles(projectId);
        useFileSystemStore.getState().replaceTree(tree);
      } catch {
        // Surfaced via existing error banner.
      } finally {
        setIsReverting(null);
      }
    },
    [isReverting, isStreaming, projectId],
  );

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "assistant") return messages[i]!.id;
    }
    return null;
  }, [messages]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0E0E11] text-zinc-50">
      <div
        ref={messagesScrollerRef}
        className="min-h-0 flex-1 overflow-auto px-4 py-4 bg-black"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Describe the app you want to build. Code will stream into the
            editor on the right.
          </p>
        ) : null}

        <div className="space-y-4">
          {messages.map((m) => {
            const text = messageText(m);
            const snapshotId =
              m.role === "assistant" ? m.metadata?.snapshot_id ?? null : null;
            const isLastAssistant = m.id === lastAssistantId;
            const logs = logsByAssistantId[m.id] ?? [];

            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-zinc-800 px-4 py-2 text-sm text-zinc-50">
                    {text}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="space-y-2 text-sm">
                {logs.length > 0 ? (
                  <div className="space-y-0.5">
                    {logs.map((log) => (
                      <div key={log.id}>{renderLog(log)}</div>
                    ))}
                  </div>
                ) : null}

                {text ? (
                  <div className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                    {text}
                  </div>
                ) : null}

                {!text && logs.length === 0 ? (
                  <div className="text-zinc-500">…</div>
                ) : null}

                {isLastAssistant && !isStreaming ? (
                  <div className="flex items-center gap-2 pt-1 text-xs text-zinc-500">
                    {lastUserText ? (
                      <button
                        type="button"
                        onClick={() => void onRetry()}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isStreaming || isReverting !== null}
                      >
                        <RefreshCw className="size-3" />
                        Retry
                      </button>
                    ) : null}
                    {snapshotId ? (
                      <button
                        type="button"
                        onClick={() => void onRevert(m.id, snapshotId)}
                        disabled={
                          isStreaming ||
                          isReverting !== null ||
                          isReverting === m.id
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Revert project files to the state before this message"
                      >
                        <History className="size-3" />
                        {isReverting === m.id ? "Reverting…" : "Revert"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {error ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              <span className="min-w-0 flex-1 truncate">{error.message}</span>
              {lastUserText ? (
                <button
                  type="button"
                  onClick={() => void onRetry()}
                  disabled={isStreaming}
                  className="inline-flex items-center gap-1 rounded-md border border-red-900/60 px-2 py-0.5 text-red-200 transition hover:bg-red-950/70 disabled:opacity-50"
                >
                  <RefreshCw className="size-3" />
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 border-zinc-800 bg-black p-3",
        )}
      >
        <V0ChatInput
          value={draft}
          onChange={setDraft}
          onSubmit={() => void onSend()}
          onStop={() => stop()}
          isStreaming={isStreaming}
          placeholder={
            messages.length === 0
              ? "Describe what you want to build..."
              : "Ask a follow-up..."
          }
        />
      </div>
    </section>
  );
}
