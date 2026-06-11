import { ReactNode } from "react";

type Status = "online" | "stub" | "offline" | "locked";

const statusColor: Record<Status, string> = {
  online: "bg-green",
  stub: "bg-amber",
  offline: "bg-red",
  locked: "bg-dim",
};

const statusLabel: Record<Status, string> = {
  online: "LIVE",
  stub: "STUB",
  offline: "OFFLINE",
  locked: "LOCKED",
};

export default function Panel({
  title,
  status,
  children,
  actions,
  className = "",
}: {
  title: string;
  status?: Status;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <header className="flex items-center gap-2 border-b border-edge px-3 py-1.5">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-cyan glow-text">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {status && (
            <span className="flex items-center gap-1.5 text-[9px] tracking-widest text-dim">
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusColor[status]} ${
                  status === "online" ? "blink" : ""
                }`}
              />
              {statusLabel[status]}
            </span>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </section>
  );
}
