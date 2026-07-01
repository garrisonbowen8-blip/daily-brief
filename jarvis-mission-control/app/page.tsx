"use client";

import { ReactNode, useState } from "react";
import BootIntro from "@/components/BootIntro";
import JarvisCore from "@/components/JarvisCore";
import FocusPanel from "@/components/FocusPanel";
import VitalsPanel from "@/components/VitalsPanel";
import BriefPanel from "@/components/BriefPanel";
import ClockWidget from "@/components/ClockWidget";
import PomodoroWidget from "@/components/PomodoroWidget";
import RobinhoodTile from "@/components/RobinhoodTile";
import {
  GmailTile, CalendarTile, DriveTile,
  SupabaseTile, ObsidianTile, RemindersTile,
} from "@/components/Tiles";
import { QuickActions, CommandConsole, PlaceholderTile } from "@/components/StubPanels";
import TileBoard, { TileLayout } from "@/components/TileBoard";
import { speak } from "@/lib/speech";

// ── All draggable tiles ────────────────────────────────────────────────────────
const TILE_MAP: Record<string, ReactNode> = {
  vitals:    <VitalsPanel />,
  calendar:  <CalendarTile />,
  reminders: <RemindersTile />,
  focus:     <FocusPanel />,
  gmail:     <GmailTile />,
  pomodoro:  <PomodoroWidget />,
  robinhood: <RobinhoodTile />,
  brief:     <BriefPanel />,
  supabase:  <SupabaseTile />,
  drive:     <DriveTile />,
  obsidian:  <ObsidianTile />,
  console:   <CommandConsole />,
  ms365:     <PlaceholderTile title="Microsoft 365" rows={[["outlook unread","—"],["next teams call","—"],["onedrive recent","—"]]} note="connector authed via Claude — app wiring TODO" />,
  canva:     <PlaceholderTile title="Canva Designs"   rows={[["recent designs","—"],["pending exports","—"]]} />,
  indeed:    <PlaceholderTile title="Indeed Pipeline"  rows={[["saved jobs","—"],["applications","—"],["interviews","—"]]} />,
  karma:     <PlaceholderTile title="Credit Karma" locked rows={[["credit score","•••"],["accounts","•••"],["alerts","•••"]]} note="sensitive — data wiring TODO" />,
  pubmed:    <PlaceholderTile title="PubMed Research"  rows={[["saved searches","—"],["new results","—"]]} />,
  blotato:   <PlaceholderTile title="Blotato" rows={[["status","no connector"]]} note="// TODO: connect Blotato" />,
};

const DEFAULT_LAYOUT: TileLayout = {
  left:      ["vitals", "calendar", "reminders"],
  center:    ["pomodoro", "robinhood"],
  right:     ["focus", "gmail"],
  secondary: ["brief", "supabase", "drive", "obsidian"],
  extended:  ["console", "ms365", "canva", "indeed", "karma", "pubmed", "blotato"],
};

export default function Home() {
  const [booted, setBooted]     = useState(false);
  const [editMode, setEditMode] = useState(false);

  const runBrief = async () => {
    const res = await fetch("/api/brief", { cache: "no-store" });
    const { script } = await res.json();
    speak(script);
  };

  const resetLayout = () => {
    (window as unknown as Record<string, () => void>).__atlasResetLayout?.();
    setEditMode(false);
  };

  return (
    <>
      {!booted && <BootIntro onDone={() => setBooted(true)} />}

      <main className="mx-auto max-w-[1920px] px-4 pt-3 pb-8">

        {/* ── Header ── */}
        <header className="mb-3 flex items-center gap-4">
          <h1 className="text-lg uppercase tracking-[0.35em] text-cyan glow-text">A.T.L.A.S.</h1>
          <span className="text-[10px] uppercase tracking-widest text-dim">Mission Control</span>

          <div className="ml-auto flex items-center gap-2">
            {editMode ? (
              <>
                <span className="text-[10px] text-amber uppercase tracking-widest animate-pulse mr-1">
                  drag tiles anywhere to rearrange
                </span>
                <button onClick={resetLayout}
                  className="text-[9px] uppercase tracking-widest border border-red text-red rounded px-2 py-1 hover:bg-red hover:text-black transition-colors">
                  reset
                </button>
                <button onClick={() => setEditMode(false)}
                  className="text-[9px] uppercase tracking-widest border border-cyan text-cyan rounded px-2 py-1 hover:bg-cyan hover:text-black transition-colors">
                  done
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditMode(true)}
                  className="text-[9px] uppercase tracking-widest border border-edge text-dim rounded px-2 py-1 hover:border-cyan hover:text-cyan transition-colors">
                  edit layout
                </button>
                <QuickActions onBrief={runBrief} />
              </>
            )}
          </div>
        </header>

        {/* ── Board — all drag-and-drop logic lives in TileBoard ── */}
        <TileBoard
          defaults={DEFAULT_LAYOUT}
          editMode={editMode}
          tileMap={TILE_MAP}
          fixedCenter={
            <div className="flex flex-col gap-3">
              <ClockWidget />
              <JarvisCore />
            </div>
          }
        />

      </main>
    </>
  );
}
