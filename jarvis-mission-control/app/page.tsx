"use client";

import { useState } from "react";
import BootIntro from "@/components/BootIntro";
import JarvisCore from "@/components/JarvisCore";
import FocusPanel from "@/components/FocusPanel";
import VitalsPanel from "@/components/VitalsPanel";
import BriefPanel from "@/components/BriefPanel";
import {
  GmailTile,
  CalendarTile,
  DriveTile,
  SupabaseTile,
  PorterTile,
  ObsidianTile,
} from "@/components/Tiles";
import {
  PlaceholderTile,
  CommandConsole,
  AgentsPanel,
  TaskQueue,
  NotificationsFeed,
  QuickActions,
} from "@/components/StubPanels";
import { speak } from "@/lib/speech";

export default function Home() {
  const [booted, setBooted] = useState(false);

  const runBrief = async () => {
    const res = await fetch("/api/brief", { cache: "no-store" });
    const { script } = await res.json();
    speak(script);
  };

  return (
    <>
      {!booted && <BootIntro onDone={() => setBooted(true)} />}

      <main className="mx-auto max-w-[1920px] p-4">
        <header className="mb-4 flex items-baseline gap-4">
          <h1 className="text-lg uppercase tracking-[0.35em] text-cyan glow-text">
            A.T.L.A.S
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-dim">
            Mission Control
          </span>
          <div className="ml-auto">
            <QuickActions onBrief={runBrief} />
          </div>
        </header>

        {/* ── Hero row: left (calendar) | orb | right (focus + gmail) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[240px_auto_1fr] gap-3 mb-3">

          {/* Left — calendar only, narrow */}
          <div className="hidden xl:flex flex-col gap-3">
            <CalendarTile />
          </div>

          {/* Center — ATLAS orb */}
          <div className="flex justify-center">
            <JarvisCore />
          </div>

          {/* Right — focus + filtered inbox */}
          <div className="hidden xl:flex flex-col gap-3">
            <FocusPanel />
            <GmailTile />
          </div>
        </div>

        {/* Mobile fallback — stacked below orb */}
        <div className="flex xl:hidden flex-col gap-3 mb-3">
          <CalendarTile />
          <FocusPanel />
          <GmailTile />
        </div>

        {/* ── Secondary row ── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 mb-3">
          <VitalsPanel />
          <BriefPanel />
          <SupabaseTile />
          <DriveTile />
        </div>

        {/* ── Rest of the dashboard ── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PorterTile />
          <ObsidianTile />
          <CommandConsole />
          <AgentsPanel />
          <TaskQueue />
          <NotificationsFeed />
          <PlaceholderTile
            title="Microsoft 365"
            rows={[["outlook unread","—"],["next teams call","—"],["onedrive recent","—"]]}
            note="connector authed via Claude — app wiring TODO"
          />
          <PlaceholderTile title="Canva Designs" rows={[["recent designs","—"],["pending exports","—"]]} />
          <PlaceholderTile title="Indeed Pipeline" rows={[["saved jobs","—"],["applications","—"],["interviews","—"]]} />
          <PlaceholderTile title="Credit Karma" locked rows={[["credit score","•••"],["accounts","•••"],["alerts","•••"]]} note="sensitive — data wiring TODO" />
          <PlaceholderTile title="PubMed Research" rows={[["saved searches","—"],["new results","—"]]} />
          <PlaceholderTile title="Blotato" rows={[["status","no connector"]]} note="// TODO: connect Blotato" />
        </div>
      </main>
    </>
  );
}
