const { TFile } = require("obsidian");

// "Property als Bild": stellt den Wert einer Property (z. B. Cover) als
// Bild für CSS-Snippets bereit - fred zeigt selbst nichts an. Jede Notiz-
// Ansicht (.workspace-leaf-content), deren Notiz die Property mit einem Wert
// hat, bekommt
//   --fred-image: url("…")   das Bild, z. B. für background-image
//   data-fred-image          als Marker für Selektoren
// Das Styling (wo, wie groß, Zeile ausblenden …) liegt komplett in Snippets.
//
// Werte: eine URL (http/https/data/app), ein Link oder Embed auf eine Datei
// im Vault ([[cover.jpg]], ![[cover.jpg|200]]) oder ein Vault-Pfad; bei einer
// Liste zählt der erste Eintrag. Nur normale Notiz-Tabs (Bearbeiten und
// Lesen), keine Hover-Vorschauen oder eingebetteten Notizen.

const VAR = "--fred-image";
const ATTR = "data-fred-image";

// Der Bild-Quelltext für CSS oder null.
function imageSource(app, file, value) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (text === "") return null;
  if (/^(https?|data|app):/i.test(text)) return text;
  const link = /^!?\[\[([^\]]+)\]\]$/.exec(text);
  if (link) text = link[1];
  text = text.split("|")[0].split("#")[0].trim();
  const target = app.metadataCache.getFirstLinkpathDest(text, file.path) ?? app.vault.getAbstractFileByPath(text);
  return target instanceof TFile ? app.vault.getResourcePath(target) : null;
}

// Obsidian liest Property-Namen ohne Groß-/Kleinschreibung; die exakte
// Schreibweise gewinnt.
function propertyValue(frontmatter, name) {
  if (!frontmatter || !name) return undefined;
  if (name in frontmatter) return frontmatter[name];
  const lower = name.toLowerCase();
  const key = Object.keys(frontmatter).find((k) => k.toLowerCase() === lower);
  return key === undefined ? undefined : frontmatter[key];
}

function clear(el) {
  el.style.removeProperty(VAR);
  el.removeAttribute(ATTR);
}

function apply(plugin, leaf) {
  const el = leaf.view.containerEl;
  const file = leaf.view.file;
  const { propertyImageEnabled, propertyImageName } = plugin.settings;
  const src =
    propertyImageEnabled && file instanceof TFile
      ? imageSource(plugin.app, file, propertyValue(plugin.app.metadataCache.getFileCache(file)?.frontmatter, propertyImageName.trim()))
      : null;
  if (src === null) return clear(el);
  const css = `url(${JSON.stringify(src)})`;
  if (el.style.getPropertyValue(VAR) !== css) el.style.setProperty(VAR, css);
  if (!el.hasAttribute(ATTR)) el.setAttribute(ATTR, "");
}

function registerPropertyImage(plugin) {
  const { app } = plugin;
  const { workspace } = app;
  const refresh = () => {
    for (const leaf of workspace.getLeavesOfType("markdown")) apply(plugin, leaf);
  };
  plugin.registerEvent(workspace.on("file-open", refresh));
  plugin.registerEvent(workspace.on("layout-change", refresh));
  plugin.registerEvent(workspace.on("active-leaf-change", refresh));
  // Nur wenn eine gerade offene Notiz sich ändert.
  plugin.registerEvent(
    app.metadataCache.on("changed", (file) => {
      if (workspace.getLeavesOfType("markdown").some((leaf) => leaf.view.file === file)) refresh();
    })
  );
  workspace.onLayoutReady(refresh);
  plugin.register(() => {
    for (const leaf of workspace.getLeavesOfType("markdown")) clear(leaf.view.containerEl);
  });
  return refresh;
}

module.exports = { registerPropertyImage, imageSource };
