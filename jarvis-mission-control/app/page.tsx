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
import AlphaDeskTile from "@/components/AlphaDeskTile";
import WeatherDial from "@/components/WeatherDial";
import DateDial from "@/components/DateDial";
import HudConnectors from "@/components/HudConnectors";
import CreationsPanel from "@/components/CreationsPanel";
import ClaudeUsageTile from "@/components/ClaudeUsageTile";
import {
  GmailTile,
  CalendarTile,
  DriveTile,
  SupabaseTile,
  PorterTile,
  ObsidianTile,
  RemindersTile,
} from "@/components/Tiles";
import {
  QuickActions,
  CommandConsole,
  AgentsPanel,
  TaskQueue,
  NotificationsFeed,
  PlaceholderTile,
} from "@/components/StubPanels";
import TileBoard, { TileLayout } from "@/components/TileBoard";
import { speak } from "@/lib/speech";

// ── All draggable tiles ────────────────────────────────────────────────────
const TILE_MAP: Record<string, ReactNode> = {
  date: <DateDial />,
  weather: <WeatherDial />,
  vitals: <VitalsPanel />,
  calendar: <CalendarTile />,
  reminders: <RemindersTile />,
  focus: <FocusPanel />,
  gmail: <GmailTile />,
  pomodoro: <PomodoroWidget />,
  robinhood: <RobinhoodTile />,
  alphadesk: <AlphaDeskTile />,
  brief: <BriefPanel />,
  supabase: <SupabaseTile />,
  drive: <DriveTile />,
  obsidian: <ObsidianTile />,
  porter: <PorterTile />,
  usage: <ClaudeUsageTile />,
  creations: <CreationsPanel />,
  console: <CommandConsole />,
  agents: <AgentsPanel />,
  tasks: <TaskQueue />,
  notifications: <NotificationsFeed />,
  ms365: (
    <PlaceholderTile
      title="Microsoft 365"
      rows={[["outlook unread", "—"], ["next teams call", "—"], ["onedrive recent", "—"]]}
      note="connector authed via Claude — app wiring TODO"
    />
  ),
  canva: <PlaceholderTile title="Canva Designs" rows={[["recent designs", "—"], ["pending exports", "—"]]} />,
  indeed: (
    <PlaceholderTile
      title="Indeed Pipeline"
      rows={[["saved jobs", "—"], ["applications", "—"], ["interviews", "—"]]}
    />
  ),
  karma: (
    <PlaceholderTile
      title="Credit Karma"
      locked
      rows={[["credit score", "•••"], ["accounts", "•••"], ["alerts", "•••"]]}
      note="sensitive — data wiring TODO"
    />
  ),
  pubmed: <PlaceholderTile title="PubMed Research" rows={[["saved searches", "—"], ["new results", "—"]]} />,
  // TODO: connect Blotato — NOT currently a live connector; do not fake its data
  blotato: <PlaceholderTile title="Blotato" rows={[["status", "no connector"]]} note="// TODO: connect Blotato" />,
};

const DEFAULT_LAYOUT: TileLayout = {
  left: ["date", "pomodoro", "vitals", "reminders", "console", "robinhood", "alphadesk"],
  center: [],
  right: ["weather", "focus", "brief", "calendar", "gmail"],
  secondary: ["supabase", "drive", "obsidian", "porter", "usage"],
  extended: ["creations", "agents", "tasks", "notifications", "ms365", "canva", "indeed", "karma", "pubmed", "blotato"],
};

export default function Home() {
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
      <BootIntro />
      <HudConnectors />
      <div className="hud-frame">
        <span /><span /><span /><span />
      </div>

      <main className="mx-auto max-w-[2400px] px-4 pt-3 pb-8 2xl:px-6">
        {/* ── Header ── */}
        <header className="mb-3 flex items-center gap-4">
          <h1 className="text-lg uppercase tracking-[0.35em] text-cyan glow-text">A.T.L.A.S</h1>
          <span className="text-[10px] uppercase tracking-widest text-dim">Mission Control</span>

          <div className="ml-auto flex items-center gap-2">
            {editMode ? (
              <>
                <span className="text-[10px] text-amber uppercase tracking-widest animate-pulse mr-1">
                  drag tiles anywhere to rearrange
                </span>
                <button
                  onClick={resetLayout}
                  className="text-[9px] uppercase tracking-widest border border-red text-red rounded px-2 py-1 hover:bg-red hover:text-black transition-colors"
                >
                  reset
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="text-[9px] uppercase tracking-widest border border-cyan text-cyan rounded px-2 py-1 hover:bg-cyan hover:text-black transition-colors"
                >
                  done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="text-[9px] uppercase tracking-widest border border-edge text-dim rounded px-2 py-1 hover:border-cyan hover:text-cyan transition-colors"
                >
                  edit layout
                </button>
                <div className="hidden md:block">
                  <QuickActions onBrief={runBrief} />
                </div>
              </>
            )}
          </div>
        </header>

        {/* ── Board — drag-and-drop tiles around the fixed core ── */}
        <TileBoard
          defaults={DEFAULT_LAYOUT}
          editMode={editMode}
          tileMap={TILE_MAP}
          fixedCenter={
            <div className="relative flex flex-col gap-3">
              <div className="core-rings" />
              <ClockWidget />
              <JarvisCore />
            </div>
          }
        />
      </main>
    </>
  );
}
