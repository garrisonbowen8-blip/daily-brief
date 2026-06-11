"use client";

// Routes recognized command intents (from the console or voice) to actual
// dashboard behavior via window events, so saying "run my brief" really runs it.

export function dispatchIntent(intent: string) {
  window.dispatchEvent(new CustomEvent("jarvis:intent", { detail: intent }));
}

export function onIntent(handler: (intent: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener("jarvis:intent", listener);
  return () => window.removeEventListener("jarvis:intent", listener);
}

// Scroll a panel into view by its header title
export function scrollToPanel(title: string) {
  for (const h of document.querySelectorAll("h2")) {
    if (h.textContent?.toLowerCase().includes(title.toLowerCase())) {
      h.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
}
