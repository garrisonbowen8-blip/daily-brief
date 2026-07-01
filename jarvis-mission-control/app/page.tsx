"use client";

import JarvisCore from "@/components/JarvisCore";
import BootIntro from "@/components/BootIntro";
import CreationsPanel from "@/components/CreationsPanel";
import FocusPanel from "@/components/FocusPanel";
import VitalsPanel from "@/components/VitalsPanel";
import BriefPanel from "@/components/BriefPanel";
import ClaudeUsageTile from "@/components/ClaudeUsageTile";
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
  const runBrief = async () => {
    const res = await fetch("/api/brief", { cache: "no-store" });
    const { script } = await res.json();
    speak(script);
  };

  return (
    <main className="mx-auto max-w-[2400px] p-4 2xl:p-6">
      <BootIntro />
      <header className="mb-3 flex items-baseline gap-4">
        <h1 className="text-lg uppercase tracking-[0.35em] text-cyan glow-text">
          A.T.L.A.S
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-dim">
          Mission Control
        </span>
        <div className="ml-auto hidden md:block">
          <QuickActions onBrief={runBrief} />
        </div>
      </header>

      {/* Hero — calendar | the entity | today's focus + human inbox */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)_360px] items-stretch">
        <div className="flex flex-col gap-3">
          <CalendarTile />
          <VitalsPanel />
        </div>
        <div className="panel flex items-center justify-center min-h-[480px]">
          <JarvisCore />
        </div>
        <div className="flex flex-col gap-3">
          <FocusPanel />
          <GmailTile />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {/* Row 2 — brief + live connectors */}
        <BriefPanel />
        <SupabaseTile />
        <DriveTile />

        {/* Row 3 — creations + content + knowledge + console */}
        <CreationsPanel />
        <PorterTile />
        <ObsidianTile />
        <ClaudeUsageTile />
        <CommandConsole />

        {/* Row 4 — wired-looking, clearly-TODO */}
        <AgentsPanel />
        <TaskQueue />
        <NotificationsFeed />
        <PlaceholderTile
          title="Microsoft 365"
          rows={[
            ["outlook unread", "—"],
            ["next teams call", "—"],
            ["onedrive recent", "—"],
          ]}
          note="connector authed via Claude — app wiring TODO"
        />

        {/* Row 5 — remaining connector stubs */}
        <PlaceholderTile
          title="Canva Designs"
          rows={[
            ["recent designs", "—"],
            ["pending exports", "—"],
          ]}
        />
        <PlaceholderTile
          title="Indeed Pipeline"
          rows={[
            ["saved jobs", "—"],
            ["applications", "—"],
            ["interviews", "—"],
          ]}
        />
        <PlaceholderTile
          title="Credit Karma"
          locked
          rows={[
            ["credit score", "•••"],
            ["accounts", "•••"],
            ["alerts", "•••"],
          ]}
          note="sensitive — data wiring TODO even after unlock"
        />
        <PlaceholderTile
          title="PubMed Research"
          rows={[
            ["saved searches", "—"],
            ["new results", "—"],
          ]}
        />
        {/* TODO: connect Blotato — NOT currently a live connector; do not fake its data */}
        <PlaceholderTile
          title="Blotato"
          rows={[["status", "no connector"]]}
          note="// TODO: connect Blotato"
        />
      </div>
    </main>
  );
}
