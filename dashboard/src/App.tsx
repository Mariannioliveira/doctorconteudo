import { useSquadSocket } from "@/hooks/useSquadSocket";
import { SquadSidebar } from "@/components/SquadSidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { OfficePanel } from "@/components/OfficePanel";
import { StatusBar } from "@/components/StatusBar";
import { useSquadStore } from "@/store/useSquadStore";

export function App() {
  useSquadSocket();
  const isConnected = useSquadStore((s) => s.isConnected);

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

        {/* Connection status */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isConnected ? "var(--accent-green)" : "#64748b",
              boxShadow: isConnected ? "0 0 6px var(--accent-green)" : undefined,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {isConnected ? "conectado" : "desconectado"}
          </span>
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
    </div>
  );
}
