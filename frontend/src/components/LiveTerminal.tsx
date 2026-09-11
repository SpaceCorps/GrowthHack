import React, { useEffect, useRef, useState } from "react";
import { Terminal, Copy, Check, X, RefreshCw } from "lucide-react";

interface LiveTerminalProps {
  taskId: string | null;
  title?: string;
  onClose?: () => void;
  onTaskCompleted?: () => void;
}

export const LiveTerminal: React.FC<LiveTerminalProps> = ({
  taskId,
  title = "Antigravity Agent Stream",
  onClose,
  onTaskCompleted,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<"connecting" | "running" | "completed" | "error">(
    "connecting",
  );
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!taskId) return;

    setLogs([`Connecting to Antigravity stream for task: ${taskId}...`]);
    setIsStreaming(true);
    setStatus("connecting");

    const watchdog = setTimeout(() => {
      setLogs((prev) => {
        if (prev.length <= 1) {
          return [
            ...prev,
            "[WARNING] No logs received after 90s. Check that the Antigravity backend service is running and agy CLI is installed.",
          ];
        }
        return prev;
      });
    }, 90000);

    const eventSource = new EventSource(`/api/agent/stream/${taskId}`);

    eventSource.onmessage = (event) => {
      const line = event.data;
      setLogs((prev) => [...prev, line]);

      if (line.includes("[DONE]")) {
        setIsStreaming(false);
        setStatus("completed");
        if (onTaskCompleted) {
          onTaskCompleted();
        }
      } else if (line.includes("[ERROR]")) {
        setIsStreaming(false);
        setStatus("error");
        if (onTaskCompleted) {
          onTaskCompleted();
        }
      } else {
        setStatus("running");
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
      setLogs((prev) => {
        const hasDone = prev.some((l) => l.includes("[DONE]"));
        if (!hasDone) {
          setStatus("error");
          return [...prev, "[ERROR] Stream connection disconnected or lost."];
        } else {
          setStatus("completed");
          return prev;
        }
      });
    };

    return () => {
      clearTimeout(watchdog);
      eventSource.close();
    };
  }, [taskId, onTaskCompleted]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!taskId) return null;

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl flex flex-col font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800 text-slate-300">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-emerald-400 ml-1" />
          <span className="font-semibold text-slate-200">{title}</span>
          {status === "error" ? (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 font-sans px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800">
              Disconnected
            </span>
          ) : isStreaming ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-sans px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Running
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-sans px-2 py-0.5 rounded-full bg-slate-800">
              Completed
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Copy logs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Close terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={logContainerRef}
        className="p-3.5 max-h-72 min-h-44 overflow-y-auto space-y-1 bg-slate-950/90 text-slate-300 select-text"
      >
        {logs.map((line, idx) => {
          let lineClass = "text-slate-300";
          if (line.startsWith("[SYSTEM]")) lineClass = "text-cyan-400 font-semibold";
          else if (line.startsWith("[STAGE]")) lineClass = "text-purple-400 font-semibold";
          else if (line.startsWith("[PROMPT]")) lineClass = "text-indigo-400 italic";
          else if (line.startsWith("[DONE]")) lineClass = "text-emerald-400 font-bold";
          else if (line.startsWith("[ERROR]")) lineClass = "text-rose-400 font-semibold";
          else if (line.startsWith("[WARNING]")) lineClass = "text-amber-400 font-semibold";
          else if (line.startsWith("[STDERR]")) lineClass = "text-amber-300/80";
          else if (line.startsWith("#")) lineClass = "text-emerald-300 font-bold";

          return (
            <div
              key={idx}
              className={`leading-relaxed break-words whitespace-pre-wrap ${lineClass}`}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};
