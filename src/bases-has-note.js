const { FileValue, BasesEntry, BooleanValue } = require("obsidian");

/* ============================================================
 * Bases: implizite Property "file.hasNote"
 * Zeigt an, ob eine Notiz außerhalb des Frontmatters Inhalt hat -
 * abfragbar wie jede eingebaute Datei-Property (file.embeds, file.tags, ...),
 * ohne dass dafür etwas ins Frontmatter geschrieben wird.
 *
 * Obsidian hat dafür keine öffentliche Registrierung (nur
 * registerBasesView/registerGlobalFunc/registerInstanceFunc), die
 * benötigten Bausteine sind aber aus "obsidian" exportiert:
 *   - FileValue  - der Wert hinter "file.*"; dessen objectAccess()
 *                  löst die einzelnen Property-Namen auf, keys() listet sie
 *   - BasesEntry.FILE_PROPERTIES - die Liste, aus der Bases die
 *                  auswählbaren file.*-Properties in der UI aufbaut
 * Beides wird hier ergänzt statt ersetzt und beim Deaktivieren/Entladen
 * wieder zurückgenommen.
 *
 * Der Inhalt wird rein aus dem Metadaten-Cache bestimmt, weil objectAccess()
 * synchron antworten muss (ein vault.cachedRead() ginge nicht): der Cache
 * kennt für jede Notiz ihre sections, und der Frontmatter-Block ist darin
 * genau die Section vom Typ "yaml". Gibt es keine weitere Section, steht
 * außerhalb des Frontmatters nichts (Leerzeilen erzeugen keine Section).
 * Da Bases bei metadataCache "changed" neu auswertet, aktualisiert sich
 * die Property beim Bearbeiten der Notiz von selbst.
 * ============================================================ */

const PROPERTY_NAME = "hasNote";
const PROPERTY_KEY = PROPERTY_NAME.toLowerCase();
const PROPERTY_ID = "file." + PROPERTY_NAME;

// Auch direkt als plugin.hasNoteContent(file) nutzbar (siehe main.js), deshalb
// wird neben einem TFile auch ein Pfad akzeptiert - Ordner und Unbekanntes
// ergeben false statt eines Fehlers.
function hasNoteContent(app, fileOrPath) {
  const file = typeof fileOrPath === "string" ? app.vault.getFileByPath(fileOrPath) : fileOrPath;
  if (!file?.stat) return false;
  // Nicht-Markdown (Bilder, PDFs, ...) haben keine sections - dort ist die
  // Dateigröße das einzig sinnvolle Kriterium.
  if (file.extension !== "md") return file.stat.size > 0;
  const cache = app.metadataCache.getFileCache(file);
  // Noch nicht indexiert: Größe als Notbehelf, statt "leer" zu behaupten.
  if (!cache) return file.stat.size > 0;
  const sections = cache.sections;
  if (!sections || sections.length === 0) return false;
  return sections.some((section) => section.type !== "yaml");
}

function install() {
  if (!FileValue?.prototype || !BooleanValue) {
    console.warn("[Fred] Bases-Property \"file.hasNote\": FileValue/BooleanValue nicht verfügbar, übersprungen.");
    return null;
  }

  const originalObjectAccess = FileValue.prototype.objectAccess;
  const originalKeys = FileValue.prototype.keys;

  // Bases ruft objectAccess() immer kleingeschrieben auf, der Property-Name
  // darf in der UI deshalb trotzdem camelCase bleiben.
  FileValue.prototype.objectAccess = function (name) {
    if (typeof name === "string" && name.toLowerCase() === PROPERTY_KEY) {
      return new BooleanValue(hasNoteContent(this.app, this.file));
    }
    return originalObjectAccess.call(this, name);
  };

  FileValue.prototype.keys = function () {
    return originalKeys.call(this).concat([PROPERTY_NAME]);
  };

  const propertyList = Array.isArray(BasesEntry?.FILE_PROPERTIES) ? BasesEntry.FILE_PROPERTIES : null;
  const listed = propertyList && !propertyList.includes(PROPERTY_ID);
  if (listed) propertyList.push(PROPERTY_ID);

  return () => {
    FileValue.prototype.objectAccess = originalObjectAccess;
    FileValue.prototype.keys = originalKeys;
    if (listed) {
      const index = propertyList.indexOf(PROPERTY_ID);
      if (index !== -1) propertyList.splice(index, 1);
    }
  };
}

function registerBasesHasNote(plugin) {
  let uninstall = null;

  const update = () => {
    const enabled = plugin.settings.basesHasNoteEnabled;
    if (enabled && !uninstall) uninstall = install();
    else if (!enabled && uninstall) {
      uninstall();
      uninstall = null;
    }
  };

  update();
  plugin.register(() => {
    uninstall?.();
    uninstall = null;
  });

  return update;
}

module.exports = { registerBasesHasNote, hasNoteContent, PROPERTY_ID };
