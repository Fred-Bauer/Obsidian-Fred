const { TFile } = require("obsidian");

/* ============================================================
 * Verschachtelte Checkboxen
 * Beim (Ent)Haken einer Checkbox werden automatisch alle darunter
 * verschachtelten Checkboxen mit (ent)hakt (Kaskade nach unten) -
 * und umgekehrt: sobald alle direkten Checkbox-Kinder eines
 * Eltern-Elements angehakt sind, wird auch das Eltern-Element
 * angehakt, und wieder entfernt, sobald eines seiner Kinder wieder
 * abgehakt wird (Bubble-up, rekursiv bis zur Wurzel).
 *
 * Erkennung per Diff gegen den zuletzt gesehenen Inhalt der Datei
 * (nicht per Klick-Interception): funktioniert dadurch unabhängig
 * davon, ob die Checkbox in der Reading View oder in der Live
 * Preview angeklickt wurde, ohne auf Obsidians undokumentierte
 * Render-Interna angewiesen zu sein. Ausgelöst wird nur, wenn sich
 * durch die Änderung genau eine Zeile unterscheidet und diese eine
 * Checkbox mit unveränderter Einrückung ist, deren Haken-Zustand
 * sich geändert hat - alles andere (Mehrfachänderungen, Tippen,
 * Ein-/Ausrücken, etc.) bleibt unangetastet.
 * ============================================================ */

const CHECKBOX_LINE_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[(.)\]/;

function parseCheckboxLine(line) {
  const match = line.match(CHECKBOX_LINE_RE);
  return match ? { indent: match[1].length, char: match[2] } : null;
}

// null für leere/nur-Leerzeichen-Zeilen, da sie für die Verschachtelungstiefe nicht zählen.
function indentOf(line) {
  const match = line.match(/^(\s*)\S/);
  return match ? match[1].length : null;
}

function isChecked(char) {
  return char !== " ";
}

function setCheckboxChar(line, newChar) {
  return line.replace(CHECKBOX_LINE_RE, (whole) => whole.slice(0, -2) + newChar + "]");
}

// Liefert die Zeilen mit angewendeter Kaskade, oder null, wenn sich nichts ändert.
function computeCascade(lines, toggledIndex) {
  const toggled = parseCheckboxLine(lines[toggledIndex]);
  if (!toggled) return null;

  const result = lines.slice();
  let touched = false;
  const nowChecked = isChecked(toggled.char);
  const newChar = nowChecked ? "x" : " ";

  // Nach unten: alle verschachtelten Checkboxen auf denselben Zustand bringen.
  for (let i = toggledIndex + 1; i < result.length; i++) {
    const ind = indentOf(result[i]);
    if (ind !== null && ind <= toggled.indent) break;
    const parsed = parseCheckboxLine(result[i]);
    if (parsed && isChecked(parsed.char) !== nowChecked) {
      result[i] = setCheckboxChar(result[i], newChar);
      touched = true;
    }
  }

  // Nach oben: Eltern-Checkboxen anhand ihrer direkten Kinder neu bewerten,
  // rekursiv weiter nach oben, solange sich dadurch tatsächlich etwas ändert.
  let childIndent = toggled.indent;
  let cursor = toggledIndex;
  for (;;) {
    let parentIndex = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      const ind = indentOf(result[i]);
      if (ind === null) continue;
      if (ind < childIndent) {
        parentIndex = i;
        break;
      }
    }
    if (parentIndex === -1) break;

    const parent = parseCheckboxLine(result[parentIndex]);
    if (!parent) break; // Eltern-Element ist keine Checkbox -> hier endet das Hochblubbern.

    let directChildIndent = null;
    let hasCheckboxChild = false;
    let allChecked = true;
    for (let i = parentIndex + 1; i < result.length; i++) {
      const ind = indentOf(result[i]);
      if (ind === null) continue;
      if (ind <= parent.indent) break;
      if (directChildIndent === null) directChildIndent = ind;
      if (ind !== directChildIndent) continue; // tiefer verschachteltes Enkelkind, hier irrelevant.
      const parsed = parseCheckboxLine(result[i]);
      if (!parsed) continue;
      hasCheckboxChild = true;
      if (!isChecked(parsed.char)) allChecked = false;
    }

    if (!hasCheckboxChild) break;
    if (isChecked(parent.char) === allChecked) break; // schon im richtigen Zustand -> weiter oben ändert sich nichts mehr.

    result[parentIndex] = setCheckboxChar(result[parentIndex], allChecked ? "x" : " ");
    touched = true;
    childIndent = parent.indent;
    cursor = parentIndex;
  }

  return touched ? result : null;
}

// Erkennt ein einfaches Umschalten (genau eine Checkbox-Zeile mit unveränderter
// Einrückung, deren Haken-Zustand sich geändert hat) zwischen zwei Textständen
// gleicher Zeilenzahl, sonst -1 (Mehrfachänderung, Tippen, Ein-/Ausrücken etc.).
function detectToggle(prevText, newText) {
  if (prevText === undefined || prevText === newText) return -1;
  const oldLines = prevText.split("\n");
  const newLines = newText.split("\n");
  if (oldLines.length !== newLines.length) return -1;

  let changedIndex = -1;
  for (let i = 0; i < oldLines.length; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (changedIndex !== -1) return -1;
      changedIndex = i;
    }
  }
  if (changedIndex === -1) return -1;

  const before = parseCheckboxLine(oldLines[changedIndex]);
  const after = parseCheckboxLine(newLines[changedIndex]);
  if (!before || !after || before.indent !== after.indent) return -1;
  if (isChecked(before.char) === isChecked(after.char)) return -1;
  return changedIndex;
}

// Zwei unabhängige Erkennungswege, da Obsidian Checkbox-Klicks je nach Ansicht
// unterschiedlich persistiert:
// - Reading View speichert sofort (löst "vault modify" direkt aus).
// - Live Preview/Source-Modus ändert zunächst nur den Editor-Puffer; das
//   tatsächliche Schreiben auf die Festplatte (und damit "vault modify") ist
//   um 2s debounced (Obsidians eigener Autosave) - viel zu spät für eine
//   Kaskade, die sich wie ein einzelner, ununterbrochener Klick anfühlen soll.
//   Dafür feuert "editor-change" synchron bei jeder Editor-Änderung und liest
//   direkt aus dem Editor-Puffer statt von der Festplatte.
// Beide Wege teilen sich denselben lastContent-Cache, damit der jeweils andere
// Weg eine bereits verarbeitete Änderung nicht ein zweites Mal aufgreift.
// Ein Checkbox-Klick kann nur in einer gerade offenen Ansicht passieren -
// Hintergrund-Speicherungen nicht angezeigter Notizen (z. B. durch andere
// Plugins) müssen wir daher weder verfolgen noch cachen.
function isFileOpen(plugin, path) {
  return plugin.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view?.file?.path === path);
}

function registerNestedCheckboxSync(plugin) {
  const lastContent = new Map(); // Pfad -> zuletzt gesehener Inhalt, nur für gerade offene Notizen
  const applying = new Set(); // Pfade, für die gerade selbst eine Kaskade geschrieben wird (Echo/Reentranz ignorieren)

  const forget = (path) => {
    lastContent.delete(path);
    applying.delete(path);
  };

  // Räumt beim Öffnen einer Notiz nebenbei Einträge für inzwischen geschlossene
  // Tabs weg, statt lastContent über die ganze Session unbegrenzt wachsen zu lassen.
  const pruneClosedFiles = () => {
    if (lastContent.size === 0) return;
    const openPaths = new Set(
      plugin.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view?.file?.path).filter(Boolean)
    );
    for (const path of lastContent.keys()) {
      if (!openPaths.has(path)) lastContent.delete(path);
    }
  };

  const seed = async (file) => {
    if (!plugin.settings.nestedCheckboxSyncEnabled) return;
    pruneClosedFiles();
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (lastContent.has(file.path)) return;
    lastContent.set(file.path, await plugin.app.vault.cachedRead(file));
  };

  const handleVaultModify = async (file) => {
    if (!plugin.settings.nestedCheckboxSyncEnabled) return;
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (applying.has(file.path)) return;
    if (!isFileOpen(plugin, file.path)) return; // kein Checkbox-Klick möglich -> nichts zu tun

    const newText = await plugin.app.vault.cachedRead(file);
    const prevText = lastContent.get(file.path);
    lastContent.set(file.path, newText);

    const idx = detectToggle(prevText, newText);
    if (idx === -1) return;

    const newLines = newText.split("\n");
    const cascaded = computeCascade(newLines, idx);
    if (!cascaded) return;
    const finalText = cascaded.join("\n");

    applying.add(file.path);
    lastContent.set(file.path, finalText);
    try {
      await plugin.app.vault.process(file, () => finalText);
    } finally {
      applying.delete(file.path);
    }
  };

  const handleEditorChange = (editor, info) => {
    if (!plugin.settings.nestedCheckboxSyncEnabled) return;
    const file = info?.file;
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (applying.has(file.path)) return;

    const newText = editor.getValue();
    const prevText = lastContent.get(file.path);
    lastContent.set(file.path, newText);

    const idx = detectToggle(prevText, newText);
    if (idx === -1) return;

    const newLines = newText.split("\n");
    const cascaded = computeCascade(newLines, idx);
    if (!cascaded) return;

    // Nur die tatsächlich abweichenden Zeilen ersetzen (die umgeschaltete Zeile
    // selbst ist bereits angewendet) - als eine gemeinsame Transaktion, damit
    // Cursor/Undo-Historie sauber bleiben und nicht mehrfach reentrant gefeuert wird.
    const changes = [];
    for (let i = 0; i < cascaded.length; i++) {
      if (i === idx || cascaded[i] === newLines[i]) continue;
      changes.push({ from: { line: i, ch: 0 }, to: { line: i, ch: newLines[i].length }, text: cascaded[i] });
    }
    if (changes.length === 0) return;

    const finalText = cascaded.join("\n");
    applying.add(file.path);
    lastContent.set(file.path, finalText);
    try {
      editor.transaction({ changes });
    } finally {
      applying.delete(file.path);
    }
  };

  plugin.registerEvent(plugin.app.vault.on("modify", handleVaultModify));
  plugin.registerEvent(plugin.app.workspace.on("editor-change", handleEditorChange));
  plugin.registerEvent(plugin.app.workspace.on("file-open", seed));
  plugin.registerEvent(plugin.app.vault.on("delete", (file) => forget(file.path)));
  plugin.registerEvent(plugin.app.vault.on("rename", (_file, oldPath) => forget(oldPath)));
  plugin.app.workspace.onLayoutReady(() => {
    const active = plugin.app.workspace.getActiveFile();
    if (active) seed(active);
  });
}

module.exports = { registerNestedCheckboxSync, computeCascade, parseCheckboxLine };
