"use client";

import { useEffect, useState } from "react";

export type ConnectorState<T> = {
  data: (T & { connected: boolean; reason?: string }) | null;
  loading: boolean;
};

// Poll a connector route. Routes never throw — they return
// { connected: false, reason } — so tiles only need the two states.
export function useConnector<T>(path: string, intervalMs = 60_000): ConnectorState<T> {
  const [state, setState] = useState<ConnectorState<T>>({ data: null, loading: true });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        const data = await res.json();
        if (alive) setState({ data, loading: false });
      } catch {
        if (alive)
          setState({
            data: { connected: false, reason: "fetch failed" } as ConnectorState<T>["data"],
            loading: false,
          });
      }
    };
    load();
    const id = intervalMs > 0 ? setInterval(load, intervalMs) : undefined;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
  }, [path, intervalMs]);

  return state;
}

export function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
