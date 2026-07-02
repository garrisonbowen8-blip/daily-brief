# ATLAS — Design Reference

The visual north star for this build is the classic Iron Man / JARVIS
"Stark Industries" Rainmeter desktop HUD. Keep new panels building toward
that model, not away from it:

- **Cyan-on-black HUD** — glowing cyan (`--color-cyan: #2de2e6`) linework and
  type on a near-black field; amber and red reserved for warnings/alerts.
- **Central core** — a circular reactor/orb centerpiece with concentric
  rotating rings (here: the ATLAS orb, `JarvisCore`).
- **Data-dense side columns** — small instrument clusters framing the core:
  gauges, dials, counters, feeds. Density over whitespace.
- **Instrument typography** — small uppercase tracked-out labels, big glowing
  numerals for the one value that matters per panel.
- **Everything reads live** — blinking status dots, sparklines, tickers;
  panels look like telemetry, not cards.

The original reference screenshot lives with Garrison; this file exists so
autonomous sessions keep the aesthetic without re-asking.
