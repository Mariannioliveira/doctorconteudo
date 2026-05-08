import { useState, useEffect } from "react";
import { useSquadSocket } from "@/hooks/useSquadSocket";
import { SquadSidebar } from "@/components/SquadSidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { OfficePanel } from "@/components/OfficePanel";
import { StatusBar } from "@/components/StatusBar";
import { ScheduledPostsPanel } from "@/components/ScheduledPostsPanel";
import { useSquadStore } from "@/store/useSquadStore";

export function App() {
  useSquadSocket();
  const isConnected = useSquadStore((s) => s.isConnected);
  const [showScheduled, setShowScheduled] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/scheduled-posts")
        .then((r) => r.ok ? r.json() : [])
        .then((posts: { status: string }[]) => {
          setPendingCount(posts.filter((p) => p.status === "pending").length);
        })
        .catch(() => null);
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          height: 44,
          minHeight: 44,
          borderBottom: "1px solid var(--border)",
          background: "#060812",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.5,
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--accent-cyan), #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              boxShadow: "0 0 12px rgba(0,212,255,0.3)",
            }}
          >
            🤖
          </span>
          <span style={{ fontSize: 15 }}>Opensquad</span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(0,212,255,0.1)",
              color: "var(--accent-cyan)",
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            BETA
          </span>
        </span>

        {/* Connection status + scheduled posts button */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setShowScheduled(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)",
              borderRadius: 8, padding: "4px 12px", cursor: "pointer",
              fontFamily: "inherit", fontSize: 11, fontWeight: 600,
              color: "var(--accent-cyan)", position: "relative",
            }}
          >
            <span>📅</span>
            <span>Programados</span>
            {pendingCount > 0 && (
              <span style={{
                background: "#06b6d4", color: "#000", borderRadius: 10,
                fontSize: 9, fontWeight: 800, padding: "1px 6px", minWidth: 16,
                textAlign: "center",
              }}>
                {pendingCount}
              </span>
            )}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 7, height: 7, borderRadius: "50%",
                background: isConnected ? "var(--accent-green)" : "#64748b",
                boxShadow: isConnected ? "0 0 6px var(--accent-green)" : undefined,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {isConnected ? "conectado" : "desconectado"}
            </span>
          </div>
        </div>
      </header>

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Squad + Agent list */}
        <SquadSidebar />

        {/* Center: Chat (main interaction surface) */}
        <ChatPanel />

        {/* Right: Virtual office */}
        <OfficePanel />
      </div>

      {/* Footer: status + start/stop controls */}
      <StatusBar />

      {/* Scheduled posts modal */}
      {showScheduled && <ScheduledPostsPanel onClose={() => setShowScheduled(false)} />}
    </div>
  );
}
