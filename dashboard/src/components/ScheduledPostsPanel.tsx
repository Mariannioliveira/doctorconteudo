import { useEffect, useState, useCallback } from "react";

interface ScheduledPost {
  id: string;
  squad_name: string;
  run_id: string;
  caption: string;
  scheduled_time: string;
  status: "pending" | "running" | "published" | "cancelled" | "failed";
  created_at: string;
  published_at: string | null;
  instagram_url: string | null;
  error: string | null;
  image_url: string | null;
}

const STATUS_CONFIG = {
  pending:   { label: "Agendado",   color: "#06b6d4", bg: "rgba(6,182,212,0.12)"   },
  running:   { label: "Publicando", color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  published: { label: "Publicado",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  cancelled: { label: "Cancelado",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  failed:    { label: "Falhou",     color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: ScheduledPost["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color, textTransform: "uppercase", letterSpacing: 0.5,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

export function ScheduledPostsPanel({ onClose }: { onClose: () => void }) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPosts = useCallback(() => {
    fetch("/api/scheduled-posts")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ScheduledPost[]) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 30_000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    setActionLoading(id + ":cancel");
    try {
      await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
      fetchPosts();
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishNow = async (id: string) => {
    if (!confirm("Publicar este post agora?")) return;
    setActionLoading(id + ":publish");
    try {
      await fetch(`/api/scheduled-posts/${id}/publish-now`, { method: "POST" });
      // Refresh after a small delay so the status update has time to land
      setTimeout(fetchPosts, 2000);
    } finally {
      setActionLoading(null);
    }
  };

  const pending = posts.filter((p) => p.status === "pending");
  const rest    = posts.filter((p) => p.status !== "pending");

  return (
    // Overlay backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 95vw)", maxHeight: "85vh",
          background: "#0d0d18", border: "1px solid rgba(0,212,255,0.2)",
          borderRadius: 16, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          background: "rgba(0,0,0,0.25)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              Posts Programados
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {pending.length} aguardando publicação
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", fontSize: 18, padding: "2px 6px",
              borderRadius: 6, fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
              Carregando...
            </div>
          ) : posts.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>Nenhum post programado</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                Use "📅 Agendar post" ao aprovar um card para criar um agendamento.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...pending, ...rest].map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  actionLoading={actionLoading}
                  onCancel={handleCancel}
                  onPublishNow={handlePublishNow}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  actionLoading,
  onCancel,
  onPublishNow,
}: {
  post: ScheduledPost;
  actionLoading: string | null;
  onCancel: (id: string) => void;
  onPublishNow: (id: string) => void;
}) {
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const CAPTION_LIMIT = 160;
  const isLong = post.caption.length > CAPTION_LIMIT;
  const displayCaption = captionExpanded ? post.caption : post.caption.slice(0, CAPTION_LIMIT);

  const isCancelling = actionLoading === post.id + ":cancel";
  const isPublishing = actionLoading === post.id + ":publish";
  const isActive     = post.status === "pending";

  return (
    <div style={{
      borderRadius: 12, border: "1px solid var(--border)",
      background: "rgba(255,255,255,0.02)", overflow: "hidden",
    }}>
      <div style={{ display: "flex", gap: 0 }}>
        {/* Thumbnail */}
        {post.image_url ? (
          <img
            src={post.image_url}
            alt="card"
            style={{ width: 72, height: 90, objectFit: "cover", flexShrink: 0, display: "block" }}
          />
        ) : (
          <div style={{
            width: 72, height: 90, flexShrink: 0, background: "rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, color: "var(--text-secondary)",
          }}>
            🖼️
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, padding: "10px 14px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <StatusBadge status={post.status} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {post.status === "published" && post.published_at
                ? `Publicado em ${formatDateTime(post.published_at)}`
                : post.status === "pending"
                ? `Agendado para ${formatDateTime(post.scheduled_time)}`
                : post.status === "failed"
                ? "Falhou na publicação"
                : post.status === "running"
                ? "Publicando agora..."
                : `Cancelado`}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>
            {displayCaption}
            {isLong && !captionExpanded && <span style={{ color: "var(--text-secondary)" }}>…</span>}
          </div>
          {isLong && (
            <button
              onClick={() => setCaptionExpanded((e) => !e)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px 0",
                fontSize: 10, color: "var(--accent-cyan)", fontWeight: 600, fontFamily: "inherit",
              }}
            >
              {captionExpanded ? "Recolher ▲" : "Ver tudo ▼"}
            </button>
          )}

          {post.status === "failed" && post.error && (
            <div style={{
              marginTop: 6, padding: "5px 8px", borderRadius: 6,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 11, color: "#ef4444",
            }}>
              {post.error.slice(0, 200)}
            </div>
          )}

          {post.status === "published" && post.instagram_url && (
            <a
              href={post.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--accent-cyan)", display: "inline-block", marginTop: 4 }}
            >
              🔗 Ver no Instagram
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      {isActive && (
        <div style={{
          padding: "8px 14px", borderTop: "1px solid var(--border)",
          background: "rgba(0,0,0,0.15)", display: "flex", gap: 8,
        }}>
          <button
            onClick={() => onPublishNow(post.id)}
            disabled={!!actionLoading}
            style={{
              padding: "5px 14px", borderRadius: 8, cursor: actionLoading ? "not-allowed" : "pointer",
              fontSize: 11, fontFamily: "inherit", fontWeight: 600,
              background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e", color: "#22c55e",
              opacity: isPublishing ? 0.6 : 1,
            }}
          >
            {isPublishing ? "Publicando..." : "Publicar agora"}
          </button>
          <button
            onClick={() => onCancel(post.id)}
            disabled={!!actionLoading}
            style={{
              padding: "5px 14px", borderRadius: 8, cursor: actionLoading ? "not-allowed" : "pointer",
              fontSize: 11, fontFamily: "inherit", fontWeight: 600,
              background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)",
              opacity: isCancelling ? 0.6 : 1,
            }}
          >
            {isCancelling ? "Cancelando..." : "Cancelar agendamento"}
          </button>
        </div>
      )}
    </div>
  );
}
