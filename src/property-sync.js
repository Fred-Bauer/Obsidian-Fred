const { TFile, Notice } = require("obsidian");

/* ============================================================
 * Property-Backlinking
 * Beliebige Notizen (nicht auf einen TYP beschränkt) mit einer
 * Listen-Property (z. B. "Familie", "Freunde") aus Links zu
 * anderen Notizen bekommen den Property-Backlink automatisch bei
 * der jeweils anderen Notiz ergänzt - und wieder entfernt, sobald
 * die ursprüngliche Verlinkung wegfällt. Die konfigurierte
 * Property-Liste selbst ist der einzige Filter.
 *
 * Erkennung pro Notiz, ohne eigenen gespeicherten Stand: Beim
 * vault-"modify" liefert der metadataCache noch die alte Fassung der
 * Notiz (er indexiert erst danach, asynchron), beim folgenden
 * "changed" die neue. Gespiegelt wird nur der Unterschied dieser
 * einen Notiz. Ein früher in data.json gespeicherter Stand des ganzen
 * Vaults ging mit Obsidian Sync kaputt: jedes Gerät schrieb seinen
 * eigenen, und ein fremder oder veralteter Stand ließ Links
 * fälschlich als neu oder weggefallen gelten.
 *
 * Ohne alte Fassung (neue Notiz, Neuindexierung beim Start) wird nur
 * ergänzt, nie entfernt - eine Löschung lässt sich am bloßen
 * Ist-Zustand nicht von einer neuen Verlinkung unterscheiden.
 * ============================================================ */

// Kurz warten, bevor die Gegenseite geschrieben wird: Kommt eine Änderung
// per Sync, hat das Gerät, auf dem sie gemacht wurde, die Gegenseite meist
// schon selbst angepasst. Deren Fassung trifft dann in dieser Zeit ein, und
// processFrontMatter (liest die Datei frisch) findet nichts mehr zu tun -
// sonst schrieben beide Geräte dieselbe Notiz, und Sync müsste zusammenführen.
const WRITE_DELAY_MS = 2000;

function parseLinkText(entry) {
  const match = entry.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  return match ? match[1] : entry;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

// Nicht auflösbare Links (etwa auf eine noch nicht angelegte Notiz) fallen
// weg - sobald es die Notiz gibt, holt onFileAppeared sie nach.
function resolveLinkTargets(app, ownerFile, propertyValue) {
  const targets = [];
  for (const entry of toArray(propertyValue)) {
    if (typeof entry !== "string") continue;
    const dest = app.metadataCache.getFirstLinkpathDest(parseLinkText(entry), ownerFile.path);
    if (dest && dest.path !== ownerFile.path) targets.push(dest);
  }
  return targets;
}

// { [property]: Set<Pfad> } - worauf die Properties einer Notiz laut dem
// gegebenen Frontmatter zeigen.
function linkTargetsByProperty(app, file, frontmatter, propertyNames) {
  const targets = {};
  for (const propertyName of propertyNames) {
    const value = frontmatter?.[propertyName];
    targets[propertyName] = new Set(value ? resolveLinkTargets(app, file, value).map((f) => f.path) : []);
  }
  return targets;
}

// typOrder: eine dabei NEU angelegte Property per TYP-System (placeProperty)
// an ihren Platz laut dessen Frontmatter-Sortierung setzen, statt sie am Ende
// anzuhängen - nur diese eine, der Rest bleibt unverändert. Ohne TYP-System
// (oder in einer Version ohne placeProperty) bleibt es beim Anhängen.
// Liefert true, wenn der Link tatsächlich ergänzt wurde.
async function addLinkToProperty(app, propertyName, ownerFile, targetFile, typOrder) {
  let added = false;
  await app.fileManager.processFrontMatter(ownerFile, (frontmatter) => {
    const current = toArray(frontmatter[propertyName]);
    const alreadyThere = resolveLinkTargets(app, ownerFile, current).some((f) => f.path === targetFile.path);
    if (alreadyThere) return;
    const isNew = !Object.prototype.hasOwnProperty.call(frontmatter, propertyName);
    const link = app.fileManager.generateMarkdownLink(targetFile, ownerFile.path);
    frontmatter[propertyName] = [...current, link];
    if (isNew && typOrder) app.plugins.plugins["typ-system"]?.placeProperty?.(frontmatter, propertyName);
    added = true;
  });
  return added;
}

// Liefert true, wenn ein Link tatsächlich entfernt wurde.
async function removeLinkFromProperty(app, propertyName, ownerFile, targetPath) {
  let removed = false;
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
    removed = true;
  });
  return removed;
}

function registerPropertyBacklinks(plugin) {
  const { app } = plugin;
  const isEnabled = () => plugin.settings.propertyBacklinksLiveEnabled;
  const propertyNames = () => plugin.settings.reciprocalLinkProperties;
  const typOrder = () => plugin.settings.propertyBacklinksTypOrder;
  const isNote = (file) => file instanceof TFile && file.extension === "md";
  // Eine zwischenzeitlich gelöschte Notiz nicht mehr verlinken.
  const stillExists = (file) => app.vault.getAbstractFileByPath(file.path) === file;

  // Alte Fassung je Notiz, zwischen ihrem "modify" und dem zugehörigen "changed".
  const before = new Map();

  // Letzte beobachtete Änderung je (Property, Notiz, Link), als laufende
  // Nummer. Eine Spiegelung ist überholt, sobald genau dieser Link in genau
  // der Notiz, die sie ändern soll, nach ihrem Einreihen geändert wurde - vom
  // Nutzer, per Sync oder durch eine andere Spiegelung: die neuere Änderung an
  // der Notiz selbst gilt. Sonst stellte etwa das Echo einer Spiegelung (B hat
  // A bekommen, also soll A auch B haben) einen Link wieder her, den der
  // Nutzer in A inzwischen entfernt hat - auf einem Gerät wie über zwei
  // Geräte hinweg.
  let changeCount = 0;
  const lastChange = new Map();
  const pairKey = (propertyName, ownerPath, linkPath) => `${propertyName}\u0000${ownerPath}\u0000${linkPath}`;
  const isOutdated = (propertyName, ownerPath, linkPath, enqueuedAt) =>
    (lastChange.get(pairKey(propertyName, ownerPath, linkPath)) ?? 0) > enqueuedAt;

  // Schreibvorgänge laufen nacheinander und frühestens WRITE_DELAY_MS nach
  // dem letzten neu hinzugekommenen (siehe dort).
  const queue = [];
  let timer = null;
  let running = false;

  const flush = async () => {
    timer = null;
    if (running) {
      schedule();
      return;
    }
    running = true;
    try {
      for (const job of queue.splice(0)) {
        if (!isEnabled()) break;
        try {
          await job();
        } catch (e) {
          console.error("[Property-Backlinking] Fehler:", e);
        }
      }
    } finally {
      running = false;
    }
    // Ohne wartende Spiegelung kann keine Markierung mehr etwas überholen.
    if (queue.length === 0) lastChange.clear();
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, WRITE_DELAY_MS);
  };
  plugin.register(() => window.clearTimeout(timer));

  const enqueue = (job) => {
    queue.push(job);
    schedule();
  };

  const mirrorAdd = (propertyName, sourceFile, targetPath, enqueuedAt) =>
    enqueue(async () => {
      if (isOutdated(propertyName, targetPath, sourceFile.path, enqueuedAt)) return;
      const targetFile = app.vault.getAbstractFileByPath(targetPath);
      if (!(targetFile instanceof TFile) || !stillExists(sourceFile)) return;
      if (await addLinkToProperty(app, propertyName, targetFile, sourceFile, typOrder())) {
        console.log(`[Property-Backlinking] "${propertyName}": ${targetFile.path} <- ${sourceFile.path} ergänzt`);
      }
    });

  const mirrorRemove = (propertyName, sourceFile, targetPath, enqueuedAt) =>
    enqueue(async () => {
      if (isOutdated(propertyName, targetPath, sourceFile.path, enqueuedAt)) return;
      const targetFile = app.vault.getAbstractFileByPath(targetPath);
      if (!(targetFile instanceof TFile)) return;
      if (await removeLinkFromProperty(app, propertyName, targetFile, sourceFile.path)) {
        console.log(`[Property-Backlinking] "${propertyName}": ${targetFile.path} <- ${sourceFile.path} entfernt`);
      }
    });

  // Ergänzt jede fehlende Gegenseite, entfernt nie. onlyTargets (Set von
  // Pfaden) beschränkt das auf Links, die auf diese Notizen zeigen.
  const addMissingBacklinks = async (onlyTargets = null) => {
    const names = propertyNames();
    let added = 0;
    for (const sourceFile of app.vault.getMarkdownFiles()) {
      const frontmatter = app.metadataCache.getFileCache(sourceFile)?.frontmatter;
      const targets = linkTargetsByProperty(app, sourceFile, frontmatter, names);
      for (const propertyName of names) {
        for (const targetPath of targets[propertyName]) {
          if (onlyTargets && !onlyTargets.has(targetPath)) continue;
          const targetFile = app.vault.getAbstractFileByPath(targetPath);
          if (!(targetFile instanceof TFile)) continue;
          if (await addLinkToProperty(app, propertyName, targetFile, sourceFile, typOrder())) {
            console.log(`[Property-Backlinking] "${propertyName}": ${targetFile.path} <- ${sourceFile.path} ergänzt`);
            added++;
          }
        }
      }
    }
    return added;
  };

  const onModify = (file) => {
    if (!isEnabled() || !isNote(file)) return;
    // null bei einer noch nie indexierten Notiz - dann gibt es keine alte Fassung.
    const cache = app.metadataCache.getFileCache(file);
    if (cache) before.set(file.path, linkTargetsByProperty(app, file, cache.frontmatter, propertyNames()));
  };

  const onChanged = (file, _data, cache) => {
    if (!isEnabled() || !isNote(file)) return;
    const previous = before.get(file.path);
    before.delete(file.path);
    const names = propertyNames();
    const current = linkTargetsByProperty(app, file, cache?.frontmatter, names);
    for (const propertyName of names) {
      const previousTargets = previous?.[propertyName];
      const added = [...current[propertyName]].filter((path) => !previousTargets?.has(path));
      const removed = previousTargets ? [...previousTargets].filter((path) => !current[propertyName].has(path)) : [];
      // Nur ein echter Vergleich zählt als Änderung - ohne alte Fassung ist
      // "added" bloß der Ist-Zustand und dürfte eine wartende Entfernung
      // nicht als überholt verwerfen.
      if (previousTargets) {
        for (const path of [...added, ...removed]) lastChange.set(pairKey(propertyName, file.path, path), ++changeCount);
      }
      for (const path of added) mirrorAdd(propertyName, file, path, changeCount);
      for (const path of removed) mirrorRemove(propertyName, file, path, changeCount);
    }
  };

  // Ein Link auf eine Notiz, die es beim Setzen noch nicht gab, löst erst auf,
  // wenn sie angelegt (oder eine andere passend umbenannt) wird - die
  // verlinkende Notiz ändert sich dabei nicht, ihr "changed" kommt also nie.
  // Deshalb einmal nachsehen, wer auf die neue Notiz zeigt. Gesammelt, damit
  // z. B. der Kontakt-Import mit seinen vielen neuen Notizen nur einen Lauf
  // über den Vault auslöst (die übrigen Jobs finden appeared schon leer vor);
  // erst in der Warteschlange, weil der metadataCache die Notiz erst nach
  // diesem Event in seine Link-Auflösung aufnimmt. Beim Start feuert "create"
  // für jede Datei des Vaults - das vor layoutReady ignorieren.
  const appeared = new Set();
  const addBacklinksToAppeared = async () => {
    if (appeared.size === 0) return;
    const paths = new Set([...appeared].map((f) => f.path));
    appeared.clear();
    await addMissingBacklinks(paths);
  };
  const onFileAppeared = (file) => {
    if (!isEnabled() || !app.workspace.layoutReady || !isNote(file)) return;
    appeared.add(file);
    enqueue(addBacklinksToAppeared);
  };

  plugin.registerEvent(app.vault.on("modify", onModify));
  plugin.registerEvent(app.metadataCache.on("changed", onChanged));
  plugin.registerEvent(app.vault.on("create", onFileAppeared));
  plugin.registerEvent(
    app.vault.on("rename", (file, oldPath) => {
      if (before.has(oldPath)) {
        before.set(file.path, before.get(oldPath));
        before.delete(oldPath);
      }
      onFileAppeared(file);
    })
  );
  plugin.registerEvent(app.vault.on("delete", (file) => before.delete(file.path)));

  // Für die Einstellungen (Einschalten, geänderte Property-Liste): bewusst nur
  // auf dem Gerät, auf dem geklickt wurde - die übrigen bekommen die
  // Ergänzungen per Sync, statt dieselben Notizen gleichzeitig zu schreiben.
  return () =>
    enqueue(async () => {
      const added = await addMissingBacklinks();
      new Notice(`Property-Backlinking: ${added} Backlink${added === 1 ? "" : "s"} ergänzt.`);
    });
}

module.exports = { registerPropertyBacklinks };
