const { TFile, TFolder, FuzzySuggestModal, Notice } = require("obsidian");

/* ============================================================
 * Datenbank-Ordner
 * Ordner mit konfigurierbarem Präfix (Standard "~") werden im
 * File-Explorer nicht mehr auf-/zuklappbar dargestellt und zeigen
 * statt des Pfeils die Anzahl enthaltener .md-Dateien.
 * ============================================================ */

// CSS zielt bewusst auf die Klasse ".fred-db-folder" statt auf ein
// [data-path^=...]/[data-path*=...]-Attributselektor: Ein Attributselektor
// matcht den GESAMTEN Pfad-String, nicht nur den Ordnernamen - ein
// Unterordner OHNE Präfix innerhalb eines Datenbank-Ordners (z. B.
// "~DB/Sub") hätte einen data-path, der ebenfalls mit dem Präfix beginnt,
// und würde faelschlich die Pfeil-Ausblend-Regel erben. Die Klasse wird in
// refreshWatchedFolders() ausschliesslich über isDatabasePath() (prüft nur
// den eigenen Ordnernamen) gesetzt, dieselbe Quelle wie für die Badge-Logik
// - damit können CSS und JS nie auseinanderlaufen.
function buildStyle(prefix, suppressUnderline, countAtEnd) {
  if (!prefix) return "";
  let css = "";

  if (countAtEnd) {
    css += `
.nav-folder-title.fred-db-folder .collapse-icon {
  display: none !important;
}
`;
  } else {
    css += `
.nav-folder-title.fred-db-folder .collapse-icon svg {
  display: none !important;
}
.nav-folder-title.fred-db-folder .collapse-icon {
  display: flex !important;
  align-items: center;
  justify-content: center;
}
.fred-db-count {
  font-size: var(--font-ui-smaller);
  color: var(--text-muted);
}
`;
  }

  if (suppressUnderline) {
    css += `
.nav-folder-title.fred-db-folder .nav-folder-title-content {
  text-decoration-line: none !important;
}
`;
  }
  return css;
}

function isDatabasePath(path, prefix) {
  if (!path || !prefix) return false;
  const name = path.split("/").pop();
  return name.startsWith(prefix);
}

function isDatabaseFolderTitle(titleEl, prefix) {
  if (!titleEl) return false;
  return isDatabasePath(titleEl.getAttribute("data-path"), prefix);
}

// Äußerster Datenbank-Ordner auf dem Pfad einer Datei (nicht die Datei selbst) -
// bei verschachtelten Datenbank-Ordnern der oberste, weil ein weiter innen
// liegender Treffer ohnehin unsichtbar wäre, solange der äußere zugeklappt ist.
function findDatabaseAncestorFolder(app, filePath, prefix) {
  if (!prefix) return null;
  const segments = filePath.split("/");
  segments.pop();
  for (let i = 1; i <= segments.length; i++) {
    const candidatePath = segments.slice(0, i).join("/");
    if (isDatabasePath(candidatePath, prefix)) {
      const folder = app.vault.getAbstractFileByPath(candidatePath);
      if (folder instanceof TFolder) return folder;
    }
  }
  return null;
}

function countMarkdownFiles(app, folderPath) {
  const childPrefix = folderPath + "/";
  let count = 0;
  for (const file of app.vault.getMarkdownFiles()) {
    if (file.path.startsWith(childPrefix)) count++;
  }
  return count;
}

function updateFolderBadge(app, navFolder, folderPath, atEnd) {
  const titleEl = navFolder.querySelector(":scope > .nav-folder-title");
  if (!titleEl) return;
  const collapseIcon = titleEl.querySelector(":scope > .collapse-icon");

  // Badge aus der jeweils anderen Position entfernen, falls die Einstellung
  // seit dem letzten Update gewechselt hat.
  if (atEnd && collapseIcon) {
    const stale = collapseIcon.querySelector(".fred-db-count");
    if (stale) stale.remove();
  }
  if (!atEnd) {
    const stale = titleEl.querySelector(":scope > .fred-db-count");
    if (stale) stale.remove();
  }

  const parent = atEnd ? titleEl : collapseIcon;
  if (!parent) return;

  let badge = parent.querySelector(":scope > .fred-db-count");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = atEnd ? "nav-file-tag fred-db-count" : "fred-db-count";
    parent.appendChild(badge);
  }
  badge.textContent = String(countMarkdownFiles(app, folderPath));
}

function removeFolderBadge(navFolder) {
  navFolder.querySelectorAll(".fred-db-count").forEach((el) => el.remove());
}

function setDatabaseFolderClass(titleEl, isDbFolder) {
  titleEl.classList.toggle("fred-db-folder", isDbFolder);
}

function collectDatabaseFolders(app, prefix) {
  const result = [];
  const walk = (folder) => {
    for (const child of folder.children) {
      if (!(child instanceof TFolder)) continue;
      if (isDatabasePath(child.path, prefix)) result.push(child);
      walk(child);
    }
  };
  walk(app.vault.getRoot());
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

// Für den Befehl "Datenbank-Ordner öffnen/schließen": Fuzzy-Auswahl über alle
// vorhandenen Datenbank-Ordner, mit Anzeige, ob sie aktuell manuell offen sind.
class DatabaseFolderPickerModal extends FuzzySuggestModal {
  constructor(app, folders, manuallyOpenPaths, resolve) {
    super(app);
    this.folders = folders;
    this.manuallyOpenPaths = manuallyOpenPaths;
    this.resolve = resolve;
    this.chosen = false;
    this.setPlaceholder("Datenbank-Ordner zum Öffnen/Schließen wählen - ESC für Abbruch");
  }

  getItems() {
    return this.folders;
  }

  getItemText(folder) {
    return folder.path;
  }

  renderSuggestion(match, el) {
    const folder = match.item;
    const isOpen = this.manuallyOpenPaths.has(folder.path);
    el.createSpan({ text: folder.path });
    const state = el.createSpan({ text: isOpen ? "geöffnet" : "geschlossen" });
    state.style.float = "right";
    state.style.color = "var(--text-muted)";
  }

  selectSuggestion(item, evt) {
    this.chosen = true;
    super.selectSuggestion(item, evt);
  }

  onChooseItem(folder) {
    this.resolve(folder);
  }

  onClose() {
    super.onClose();
    if (!this.chosen) this.resolve(null);
  }
}

// Ersetzt in der Datei-Explorer-Ansicht das Ziel von revealInFolder() für eine
// Datei innerhalb eines Datenbank-Ordners: statt zur (unsichtbaren, weil der
// patchFolderItem-Patch unten das Aufklappen ohnehin verhindert) Datei selbst
// zu springen, wird der Datenbank-Ordner selbst gezeigt. Rein kosmetisch -
// dass der Ordner zu bleibt, garantiert bereits patchFolderItem unten,
// unabhängig davon, welches Ziel hier gewählt wird.
function patchRevealInFolder(plugin, view, patchedViews) {
  if (!view || typeof view.revealInFolder !== "function") return;
  if (view.__fredRevealOriginal) {
    patchedViews.add(view);
    return;
  }
  const original = view.revealInFolder.bind(view);
  view.__fredRevealOriginal = original;
  view.revealInFolder = (item) => {
    if (plugin.settings.databaseFoldersEnabled && item instanceof TFile) {
      const dbFolder = findDatabaseAncestorFolder(plugin.app, item.path, plugin.settings.databaseFolderPrefix);
      if (dbFolder) return original(dbFolder);
    }
    return original(item);
  };
  patchedViews.add(view);
}

// Ersetzt view.revealActiveFile() - läuft bei jedem Dateiwechsel, wenn im
// Datei-Explorer "Aktuelle Datei automatisch anzeigen" aktiv ist. Obsidians
// eigene Implementierung expandiert zwar die Ahnenkette (wirkungslos für den
// Datenbank-Ordner selbst dank patchFolderItem unten), scrollt danach aber zur
// - dann unsichtbar bleibenden - Datei und zeigt dabei KEINE Markierung an
// (das native "Aufblitzen" gibt es nur bei revealInFolder(), nicht hier).
// Liegt die aktive Datei in einem Datenbank-Ordner, wird deshalb stattdessen
// view.revealInFolder(dbFolder) aufgerufen: dieselbe Methode, die auch der
// Befehl "Datei im Navigator anzeigen" nutzt - klappt Ahnenordner auf, scrollt
// zum Ordner und lässt ihn kurz aufblitzen.
//
// Ist der Datei-Explorer gerade gar nicht sichtbar, wird unverändert an
// original() delegiert: Obsidian merkt sich das dann selbst vor und ruft bei
// erneuter Sichtbarkeit view.revealActiveFile() (zu dem Zeitpunkt bereits
// wieder diese gepatchte Version) automatisch erneut auf - genau der Fall, in
// dem das erneute Fokussieren des Datei-Explorers zuvor nicht sauber erfasst
// wurde.
function patchRevealActiveFile(plugin, view, patchedViews) {
  if (!view || typeof view.revealActiveFile !== "function") return;
  if (view.__fredRevealActiveOriginal) {
    patchedViews.add(view);
    return;
  }
  const original = view.revealActiveFile.bind(view);
  view.__fredRevealActiveOriginal = original;
  view.revealActiveFile = () => {
    if (!plugin.settings.databaseFoldersEnabled) return original();
    if (!view.containerEl.isShown()) return original();

    const filePath = view.activeDom?.file?.path;
    const dbFolder = filePath
      ? findDatabaseAncestorFolder(plugin.app, filePath, plugin.settings.databaseFolderPrefix)
      : null;
    if (!dbFolder) return original();

    return view.revealInFolder(dbFolder);
  };
  patchedViews.add(view);
}

// Fängt Auf-/Zuklapp-Versuche direkt an der Quelle ab, statt sie reaktiv per
// MutationObserver rückgängig zu machen (der vorherige Ansatz - ließ sich
// durch Obsidians virtualisierte Baumdarstellung umgehen, z. B. beim erneuten
// Fokussieren des Datei-Explorers, wenn dessen "infinityScroll" für wieder
// sichtbare Zeilen frische DOM-Elemente erzeugt, die der Observer nicht mehr
// kennt).
//
// view.fileItems[path] sind Obsidians eigene Ordner-Item-Objekte. JEDER Weg,
// einen Ordner aufzuklappen - nativer Pfeil-Klick, "Alle aufklappen",
// "Aktuelle Datei automatisch anzeigen", revealInFolder() für eine Datei
// darin, jede künftige Obsidian-Funktion - läuft letztlich über genau eine
// Methode an diesem Objekt: item.setCollapsed(). (toggleCollapsed() ruft
// intern this.setCollapsed() auf, "Alle aufklappen" ruft toggleCollapsed() je
// Ordner-Item auf - beides landet also ebenfalls hier.) Ein einmaliger Patch
// dieser einen Methode deckt somit ausnahmslos jeden Auslöser ab.
function patchFolderItem(plugin, item, manuallyOpenPaths, patchedItems) {
  if (!item || typeof item.setCollapsed !== "function") return;
  if (item.__fredSetCollapsedOriginal) {
    patchedItems.add(item);
    return;
  }

  const original = item.setCollapsed.bind(item);
  item.__fredSetCollapsedOriginal = original;
  item.setCollapsed = (collapsed, instant) => {
    const path = item.file?.path;
    const isDbFolder = plugin.settings.databaseFoldersEnabled && isDatabasePath(path, plugin.settings.databaseFolderPrefix);
    if (isDbFolder && !collapsed && !manuallyOpenPaths.has(path)) {
      // Expand-Versuch abgefangen - Datenbank-Ordner bleibt zugeklappt.
      // setCollapsed liefert normalerweise ein Promise; ein aufgelöstes
      // Promise statt undefined zurückzugeben hält den Vertrag für Aufrufer
      // ein, die (wie revealInFolder intern) darauf verketten.
      return Promise.resolve();
    }
    return original(collapsed, instant);
  };
  patchedItems.add(item);

  // Einmalig beim Patchen sicherstellen, dass der Ordner tatsächlich
  // zugeklappt ist (z. B. falls Obsidian ihn aus dem letzten Sitzungsstand
  // bereits aufgeklappt wiederhergestellt hat).
  const path = item.file?.path;
  if (
    plugin.settings.databaseFoldersEnabled &&
    isDatabasePath(path, plugin.settings.databaseFolderPrefix) &&
    !manuallyOpenPaths.has(path) &&
    item.collapsed !== true
  ) {
    original(true, true);
  }
}

function registerDatabaseFolders(plugin) {
  const styleEl = document.createElement("style");
  styleEl.id = "fred-database-folders-style";
  document.head.appendChild(styleEl);

  const watchedFolders = new Map(); // path -> navFolder (nur für die Badge-Anzeige)
  const patchedItems = new Set();
  const patchedViews = new Set();
  // Ein MutationObserver pro Datei-Explorer-View (view.containerEl selbst
  // wird von Obsidians virtualisiertem Baum nie zerstört - siehe unten -
  // nur einzelne Zeilen werden aus dem DOM entfernt/wieder eingefügt).
  const containerObservers = new Map(); // view -> MutationObserver
  let refreshScheduled = false;
  // Pfade von Datenbank-Ordnern, die über den Befehl "Datenbank-Ordner
  // öffnen/schließen" manuell aufgeklappt wurden - gilt nur für die laufende
  // Sitzung (bewusst nicht persistiert), siehe toggleDatabaseFolder unten.
  const manuallyOpenPaths = new Set();

  // Obsidians Datei-Baum ist virtualisiert (view.tree.infinityScroll): Zeilen
  // außerhalb des sichtbaren Bereichs werden per el.detach() aus dem DOM
  // entfernt und beim Zurückscrollen wieder eingefügt - OHNE dass dabei ein
  // "layout-change"-Event feuert (verifiziert im entpackten Obsidian-Bundle,
  // s. InfinityScroll.update()). Ein reiner DOM-Scan bei "layout-change" +
  // Vault-Events verpasst deshalb Ordner, deren Zeile gerade unsichtbar ist -
  // ihr Badge bleibt dann fehlend oder veraltet, bis irgendein anderer Grund
  // zufällig einen Rescan auslöst, während die Zeile sichtbar ist (z. B.
  // Anklicken/Fokussieren). view.containerEl selbst wird dabei nie ersetzt,
  // nur einzelne Zeilen-Elemente werden an-/abgehängt - ein darauf lauschender
  // MutationObserver bekommt daher jede Zeilen-Änderung zuverlässig mit.
  const refreshWatchedFolders = () => {
    for (const navFolder of watchedFolders.values()) {
      removeFolderBadge(navFolder);
    }
    watchedFolders.clear();

    if (!plugin.settings.databaseFoldersEnabled) {
      document.querySelectorAll(".fred-db-folder").forEach((el) => el.classList.remove("fred-db-folder"));
      return;
    }

    const prefix = plugin.settings.databaseFolderPrefix;
    for (const leaf of plugin.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view;
      patchRevealInFolder(plugin, view, patchedViews);
      patchRevealActiveFile(plugin, view, patchedViews);
      ensureContainerObserver(view);

      // Patcht ausnahmslos alle Datenbank-Ordner-Items, unabhängig davon, ob
      // ihre Zeile aktuell im (virtualisierten) DOM gerendert ist - anders als
      // der DOM-Scan unten, der das für die Badge-Anzeige braucht.
      for (const path in view.fileItems ?? {}) {
        if (!isDatabasePath(path, prefix)) continue;
        patchFolderItem(plugin, view.fileItems[path], manuallyOpenPaths, patchedItems);
      }

      // Setzt die Klasse für JEDE aktuell gerenderte Ordner-Titelzeile (nicht
      // nur für Treffer) - sonst würde ein Ordner, der sein Präfix per
      // Umbenennung verliert, die Klasse (und damit die ausgeblendete
      // Pfeil-Darstellung) fälschlich behalten.
      view.containerEl.querySelectorAll(".nav-folder-title[data-path]").forEach((titleEl) => {
        const path = titleEl.getAttribute("data-path");
        const isDbFolder = isDatabasePath(path, prefix);
        setDatabaseFolderClass(titleEl, isDbFolder);
        if (!isDbFolder) return;
        const navFolder = titleEl.parentElement;
        if (!navFolder || !navFolder.classList.contains("nav-folder")) return;

        watchedFolders.set(path, navFolder);
        updateFolderBadge(plugin.app, navFolder, path, plugin.settings.databaseFolderCountAtEnd);
      });
    }
  };

  // Bündelt mehrere schnell aufeinanderfolgende Mutationen (z. B. während
  // eines Scrolls) zu einem Rescan pro Frame. Die eigenen Mutationen von
  // refreshWatchedFolders (Badge-Elemente, Klassen) werden dafür per
  // disconnect()/observe() rund um den Aufruf ausgeblendet - sonst würde der
  // Observer sich selbst laufend erneut auslösen.
  const scheduleRefresh = () => {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      for (const observer of containerObservers.values()) observer.disconnect();
      refreshWatchedFolders();
      for (const [view, observer] of containerObservers) {
        observer.observe(view.containerEl, { childList: true, subtree: true });
      }
    });
  };

  const ensureContainerObserver = (view) => {
    if (containerObservers.has(view)) return;
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(view.containerEl, { childList: true, subtree: true });
    containerObservers.set(view, observer);
  };

  plugin.app.workspace.onLayoutReady(refreshWatchedFolders);
  plugin.registerEvent(plugin.app.workspace.on("layout-change", refreshWatchedFolders));

  // Hält die Zähler aktuell, wenn Markdown-Dateien in einem beobachteten Ordner
  // (oder einem Unterordner davon) angelegt/gelöscht/verschoben werden.
  const refreshBadgeForPath = (path) => {
    if (!path) return;
    for (const [folderPath, navFolder] of watchedFolders) {
      if (path === folderPath || path.startsWith(folderPath + "/")) {
        updateFolderBadge(plugin.app, navFolder, folderPath, plugin.settings.databaseFolderCountAtEnd);
      }
    }
  };
  const onVaultFileChange = (file, oldPath) => {
    if (!plugin.settings.databaseFoldersEnabled) return;
    if (!(file instanceof TFile) || file.extension !== "md") return;
    refreshBadgeForPath(file.path);
    if (oldPath) refreshBadgeForPath(oldPath);
  };
  plugin.registerEvent(plugin.app.vault.on("create", onVaultFileChange));
  plugin.registerEvent(plugin.app.vault.on("delete", onVaultFileChange));
  plugin.registerEvent(plugin.app.vault.on("rename", onVaultFileChange));

  // Ein neu angelegter oder umbenannter Ordner kann sofort auf den Präfix
  // passen - hier direkt patchen, statt auf den nächsten Layout-Wechsel zu
  // warten.
  const onVaultFolderChange = (file) => {
    if (!plugin.settings.databaseFoldersEnabled) return;
    if (file instanceof TFolder) refreshWatchedFolders();
  };
  plugin.registerEvent(plugin.app.vault.on("create", onVaultFolderChange));
  plugin.registerEvent(plugin.app.vault.on("rename", onVaultFolderChange));

  // Klick auf den Namen selbst bleibt unangetastet (z. B. Folder Notes öffnet dort
  // wie gewohnt die zugehörige Notiz). Klick daneben (Leerraum der Titelzeile)
  // unterdrückt nur das Auf-/Zuklappen; capture:true reicht dafür, weil die
  // Capture-Phase Obsidians eigenem Toggle-Handler am Element immer vorausgeht.
  const onClickCapture = (evt) => {
    if (!plugin.settings.databaseFoldersEnabled) return;
    const titleEl = evt.target.closest(".nav-folder-title");
    if (!isDatabaseFolderTitle(titleEl, plugin.settings.databaseFolderPrefix)) return;

    const nameEl = titleEl.querySelector(".nav-folder-title-content");
    if (nameEl && nameEl.contains(evt.target)) return;

    evt.preventDefault();
    evt.stopPropagation();

    if (plugin.settings.folderNoteClickExtensionEnabled && nameEl) {
      nameEl.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: evt.ctrlKey,
          metaKey: evt.metaKey,
          shiftKey: evt.shiftKey,
          altKey: evt.altKey,
          button: evt.button,
        })
      );
    }
  };
  document.addEventListener("click", onClickCapture, true);

  plugin.register(() => {
    document.removeEventListener("click", onClickCapture, true);
    for (const navFolder of watchedFolders.values()) {
      removeFolderBadge(navFolder);
    }
    for (const item of patchedItems) {
      if (item.__fredSetCollapsedOriginal) {
        item.setCollapsed = item.__fredSetCollapsedOriginal;
        delete item.__fredSetCollapsedOriginal;
      }
    }
    patchedItems.clear();
    for (const view of patchedViews) {
      if (view.__fredRevealOriginal) {
        view.revealInFolder = view.__fredRevealOriginal;
        delete view.__fredRevealOriginal;
      }
      if (view.__fredRevealActiveOriginal) {
        view.revealActiveFile = view.__fredRevealActiveOriginal;
        delete view.__fredRevealActiveOriginal;
      }
    }
    patchedViews.clear();
    for (const observer of containerObservers.values()) observer.disconnect();
    containerObservers.clear();
    document.querySelectorAll(".fred-db-folder").forEach((el) => el.classList.remove("fred-db-folder"));
    styleEl.remove();
  });

  const updateStyle = () => {
    styleEl.textContent = plugin.settings.databaseFoldersEnabled
      ? buildStyle(
          plugin.settings.databaseFolderPrefix,
          plugin.settings.folderNoteClickExtensionEnabled,
          plugin.settings.databaseFolderCountAtEnd
        )
      : "";
    refreshWatchedFolders();
  };

  // Setzt den Auf-/Zugeklappt-Zustand eines einzelnen Datenbank-Ordners - für
  // toggleDatabaseFolder unten. manuallyOpenPaths wird VOR dem eigentlichen
  // Aufruf aktualisiert, weil patchFolderItem() oben genau dort nachsieht, ob
  // ein Expand-Versuch erlaubt ist.
  const setFolderOpen = (path, open) => {
    if (open) manuallyOpenPaths.add(path);
    else manuallyOpenPaths.delete(path);

    const view = plugin.app.workspace.getLeavesOfType("file-explorer")[0]?.view;
    view?.fileItems?.[path]?.setCollapsed(!open, true);
  };

  // Für den Befehl: Datei-Explorer zum gewählten Ordner scrollen (klappt dafür
  // dessen Elternordner auf, sofern nötig) - unverändertes natives
  // revealInFolder, betrifft nur die Ahnenordner, nicht den Ordner selbst.
  const revealDatabaseFolder = (folder) => {
    const leaf = plugin.app.workspace.getLeavesOfType("file-explorer")[0];
    leaf?.view?.revealInFolder?.(folder);
  };

  // Befehl "Datenbank-Ordner öffnen/schließen": lässt einen Datenbank-Ordner
  // aus einer Fuzzy-Liste wählen und kehrt dessen Zustand um. Der reguläre
  // Klick auf einen Datenbank-Ordner bleibt bewusst weiter blockiert (siehe
  // onClickCapture oben) - dieser Befehl ist der einzige Weg, einen einzelnen
  // Datenbank-Ordner gezielt auf-/zuzuklappen.
  plugin.toggleDatabaseFolder = () => {
    if (!plugin.settings.databaseFoldersEnabled) {
      new Notice("Datenbank-Ordner sind deaktiviert.");
      return;
    }
    const folders = collectDatabaseFolders(plugin.app, plugin.settings.databaseFolderPrefix);
    if (folders.length === 0) {
      new Notice("Keine Datenbank-Ordner vorhanden.");
      return;
    }
    new DatabaseFolderPickerModal(plugin.app, folders, manuallyOpenPaths, (folder) => {
      if (!folder) return;
      const wasOpen = manuallyOpenPaths.has(folder.path);
      setFolderOpen(folder.path, !wasOpen);
      if (!wasOpen) revealDatabaseFolder(folder);
    }).open();
  };

  updateStyle();
  return updateStyle;
}

module.exports = { registerDatabaseFolders };
