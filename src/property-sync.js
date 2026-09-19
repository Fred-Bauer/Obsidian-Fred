const { TFile } = require("obsidian");

/* ============================================================
 * Property-Backlinking
 * Beliebige Notizen (nicht auf einen TYP beschränkt) mit einer
 * Listen-Property (z. B. "Familie", "Freunde") aus Links zu
 * anderen Notizen bekommen den Property-Backlink automatisch bei
 * der jeweils anderen Notiz ergänzt - und wieder entfernt, sobald
 * die ursprüngliche Verlinkung wegfällt. Die konfigurierte
 * Property-Liste selbst ist der einzige Filter.
 *
 * Erkennung per Vergleich mit dem gespeicherten Stand des letzten
 * Laufs (nicht per Herkunfts-Tracking einzelner Links): was neu
 * dazugekommen ist, wird gespiegelt ergänzt; was weggefallen ist,
 * wird beim anderen ebenfalls entfernt - unabhängig davon, wer die
 * Verlinkung ursprünglich gesetzt hatte.
 * ============================================================ */

function parseLinkText(entry) {
  const match = entry.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  return match ? match[1] : entry;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function resolveLinkTargets(app, ownerFile, propertyValue) {
  const targets = [];
  for (const entry of toArray(propertyValue)) {
    if (typeof entry !== "string") continue;
    const dest = app.metadataCache.getFirstLinkpathDest(parseLinkText(entry), ownerFile.path);
    if (!dest) {
      console.warn(`[Property-Backlinking] Link konnte nicht aufgelöst werden: "${entry}" in ${ownerFile.path}`);
      continue;
    }
    if (dest.path !== ownerFile.path) targets.push(dest);
  }
  return targets;
}

// { [property]: { [sourcePath]: [targetPath, ...] } } - reine JSON-taugliche Struktur,
// damit sie 1:1 in den Plugin-Settings gespeichert werden kann.
function computeDeclaredPairs(app, propertyNames, files) {
  const pairs = {};
  for (const propertyName of propertyNames) {
    const bySource = {};
    for (const file of files) {
      const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter?.[propertyName]) continue;
      const targets = resolveLinkTargets(app, file, frontmatter[propertyName]);
      if (targets.length > 0) bySource[file.path] = targets.map((t) => t.path);
    }
    pairs[propertyName] = bySource;
  }
  return pairs;
}

function getTargetSet(pairs, propertyName, sourcePath) {
  return new Set(pairs?.[propertyName]?.[sourcePath] ?? []);
}

async function addLinkToProperty(app, propertyName, ownerFile, targetFile) {
  await app.fileManager.processFrontMatter(ownerFile, (frontmatter) => {
    const current = toArray(frontmatter[propertyName]);
    const alreadyThere = resolveLinkTargets(app, ownerFile, current).some((f) => f.path === targetFile.path);
    if (alreadyThere) return;
    const link = app.fileManager.generateMarkdownLink(targetFile, ownerFile.path);
    frontmatter[propertyName] = [...current, link];
  });
}

async function removeLinkFromProperty(app, propertyName, ownerFile, targetPath) {
  await app.fileManager.processFrontMatter(ownerFile, (frontmatter) => {
    const current = toArray(frontmatter[propertyName]);
    const filtered = current.filter((entry) => {
      if (typeof entry !== "string") return true;
      const dest = app.metadataCache.getFirstLinkpathDest(parseLinkText(entry), ownerFile.path);
      return !(dest && dest.path === targetPath);
    });
    if (filtered.length === current.length) return;
    if (filtered.length === 0) delete frontmatter[propertyName];
    else frontmatter[propertyName] = filtered;
  });
}

async function applyChanges(app, propertyNames, previousPairs, currentPairs) {
  let added = 0;
  let removed = 0;

  for (const propertyName of propertyNames) {
    const sourcePaths = new Set([
      ...Object.keys(previousPairs?.[propertyName] ?? {}),
      ...Object.keys(currentPairs?.[propertyName] ?? {}),
    ]);

    for (const sourcePath of sourcePaths) {
      const prevTargets = getTargetSet(previousPairs, propertyName, sourcePath);
      const currTargets = getTargetSet(currentPairs, propertyName, sourcePath);

      for (const targetPath of currTargets) {
        if (prevTargets.has(targetPath)) continue; // unverändert

        const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
        const targetFile = app.vault.getAbstractFileByPath(targetPath);
        if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) continue;

        await addLinkToProperty(app, propertyName, targetFile, sourceFile);
        console.log(`[Property-Backlinking] "${propertyName}": ${targetFile.path} <- ${sourceFile.path} ergänzt`);
        added++;
      }

      for (const targetPath of prevTargets) {
        if (currTargets.has(targetPath)) continue; // weiterhin vorhanden

        const targetFile = app.vault.getAbstractFileByPath(targetPath);
        if (!(targetFile instanceof TFile)) continue;

        await removeLinkFromProperty(app, propertyName, targetFile, sourcePath);
        console.log(`[Property-Backlinking] "${propertyName}": ${targetFile.path} <- ${sourcePath} entfernt`);
        removed++;
      }
    }
  }

  return { added, removed };
}

async function syncAllLinks(app, propertyNames, previousPairs) {
  const files = app.vault.getMarkdownFiles();
  console.log(`[Property-Backlinking] Prüfe ${files.length} Notizen für Properties: ${propertyNames.join(", ")}`);

  const currentPairs = computeDeclaredPairs(app, propertyNames, files);
  const { added, removed } = await applyChanges(app, propertyNames, previousPairs, currentPairs);

  return {
    checked: files.length,
    added,
    removed,
    declaredPairs: currentPairs,
  };
}

// Live-Modus: löst bei jeder Metadaten-Änderung einen vollständigen Abgleich aus.
// Ein einfaches Lock verhindert überlappende Läufe bei schnell aufeinanderfolgenden
// Speicherungen; während ein Lauf aktiv ist, wird höchstens ein weiterer nachgeholt.
function registerPropertyBacklinksLive(plugin) {
  let running = false;
  let pending = false;

  const runSync = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      const result = await syncAllLinks(plugin.app, plugin.settings.reciprocalLinkProperties, plugin.settings.declaredLinkPairs);
      plugin.settings.declaredLinkPairs = result.declaredPairs;
      await plugin.saveSettings();
    } catch (e) {
      console.error("[Property-Backlinking] Fehler:", e);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        runSync();
      }
    }
  };

  const onMetadataChanged = (file) => {
    if (!plugin.settings.propertyBacklinksLiveEnabled) return;
    if (file.extension !== "md") return;
    runSync();
  };

  plugin.registerEvent(plugin.app.metadataCache.on("changed", onMetadataChanged));
}

module.exports = { syncAllLinks, registerPropertyBacklinksLive };
