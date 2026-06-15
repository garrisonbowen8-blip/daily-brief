"use client";

import { useState } from "react";
import Panel from "./Panel";
import { useConnector } from "@/lib/useConnector";

type FocusItem = {
  priority: number;
  category: string;
  task: string;
  detail: string;
};

type FocusData = {
  items: FocusItem[];
  date: string;
};

const CATEGORY_COLOR: Record<string, string> = {
  "McKinsey": "#ffb347",
  "Buddy Check": "#3ddc84",
  "Academics": "#2de2e6",
  "Trading": "#a78bfa",
  "Health": "#ff4f5e",
};

function categoryColor(cat: string) {
  return CATEGORY_COLOR[cat] ?? "#5a7884";
}

export default function FocusPanel() {
  const { data, loading } = useConnector<FocusData>("/api/focus", 3_600_000); // refresh hourly
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <Panel title="Today's Focus" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <div className="text-[11px] text-dim blink">generating focus items…</div>
      ) : !data?.connected ? (
        <div className="text-[11px] text-dim">
          <span className="text-red">not connected</span>
          <p className="mt-1 opacity-80">{(data as { reason?: string })?.reason}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[9px] text-dim uppercase tracking-widest mb-1">{data.date}</div>
          {(data.items ?? []).map((item, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="flex items-start gap-2 text-left group w-full"
            >
              {/* Checkbox */}
              <div
                className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors"
                style={{
                  borderColor: checked.has(i) ? categoryColor(item.category) : "#13242f",
                  background: checked.has(i) ? categoryColor(item.category) + "33" : "transparent",
                }}
              >
                {checked.has(i) && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2 2 4-4" stroke={categoryColor(item.category)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className={checked.has(i) ? "opacity-40 line-through" : ""}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-[9px] uppercase tracking-widest px-1 py-px rounded"
                    style={{ color: categoryColor(item.category), background: categoryColor(item.category) + "18" }}
                  >
                    {item.category}
                  </span>
                </div>
                <div className="text-[11px] text-fg leading-snug">{item.task}</div>
                <div className="text-[10px] text-dim mt-0.5 leading-snug">{item.detail}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
