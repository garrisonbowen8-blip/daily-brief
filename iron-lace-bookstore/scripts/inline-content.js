#!/usr/bin/env node
// Runs during every Netlify build. Copies content/site.json into the built-in
// fallback blocks of index.html (seedData) and menu.html (menuSeed) so the
// published pages always carry the owner's latest edits — even before the
// live-fetch script runs, and even if it fails.
//
// Defensive by design: any problem logs a warning and exits 0 so a content
// hiccup can never break a deploy (the runtime fetch still applies live data).

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function inject(file, blockId, data) {
  const p = path.join(root, file);
  const html = fs.readFileSync(p, "utf8");
  const re = new RegExp(
    '(<script type="application/json" id="' + blockId + '">)[\\s\\S]*?(</script>)'
  );
  if (!re.test(html)) throw new Error(blockId + " block not found in " + file);
  // <\/ keeps any "</script" inside JSON strings from ending the block early.
  const json = JSON.stringify(data, null, 2).replace(/<\/script/gi, "<\\/script");
  fs.writeFileSync(p, html.replace(re, "$1\n" + json + "\n$2"));
  console.log("inline-content: refreshed " + blockId + " in " + file);
}

try {
  const site = JSON.parse(
    fs.readFileSync(path.join(root, "content", "site.json"), "utf8")
  );
  inject("index.html", "seedData", site);
  inject("menu.html", "menuSeed", {
    menu_coffee: site.menu_coffee || [],
    menu_tea: site.menu_tea || [],
  });
} catch (e) {
  console.warn("inline-content: skipped (" + e.message + ")");
}
process.exit(0);
