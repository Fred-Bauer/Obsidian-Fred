const { Notice } = require("obsidian");

/* ============================================================
 * Style Settings: "Modified"-Filter
 * Ergänzt im Einstellungs-Tab des Plugins "Style Settings" links neben
 * Import/Export einen Knopf, der die Liste auf die Einstellungen filtert,
 * die nicht mehr ihrem Standardwert entsprechen.
 *
 * Style Settings bringt selbst nur eine Textsuche mit. Deren Mechanik wird
 * hier weiterverwendet, nur mit einem anderen Kriterium: jede Sektion ist
 * eine Baumkomponente mit children/filteredChildren/filterMode, und
 * renderChildren() zeigt im filterMode ausschließlich die gefilterten
 * Kinder. Hier entscheidet statt eines Fuzzy-Treffers "Wert != Standard" -
 * und anders als dort bleibt der Auf-/Zuklapp-Zustand unberührt.
 *
 * Angefasst wird dabei nichts an Style Settings' Prototypen, sondern nur
 * je eine Methode auf den konkreten Objekten (Settings-Tab und dessen
 * Markup-Instanz), damit der Knopf auch die plugin-eigenen Neuaufbauten
 * (Import, "Reset all settings") übersteht. Der Einstieg läuft über
 * app.setting.openTab, weil Style Settings erst später geladen sein kann
 * (Lazy Loading) - dort gibt es kein Ereignis, auf das man warten könnte.
 * ============================================================ */

const STYLE_SETTINGS_ID = "obsidian-style-settings";

// Typ-Bezeichner aus Style Settings' SettingType-Enum.
const TYPE_HEADING = "heading";
const TYPE_INFO_TEXT = "info-text";
const TYPE_COLOR = "variable-color";
const TYPE_THEMED_COLOR = "variable-themed-color";

// Beschriftung englisch, weil der Knopf zwischen Style Settings' eigenen
// Beschriftungen sitzt ("Import", "Export", "Search Style Settings...").
const BUTTON_CLASS = "fred-style-settings-modified";
const BUTTON_LABEL = "Modified";
const BUTTON_TOOLTIP = "Nur Einstellungen zeigen, die vom Standard abweichen";

/* --- Wert vs. Standard ------------------------------------------------ */

// Farben dürfen in beliebiger CSS-Notation im Theme stehen, gespeichert wird
// dagegen immer HEX vom Farbwähler. Die CSSOM normalisiert beim Zurücklesen
// auf rgb()/rgba(); ein ungültiger Wert (es gibt Themes mit dem Platzhalter
// "#" als Standard) wird verworfen - dann bleibt es beim Textvergleich.
let colorProbe = null;
function normalizeColor(value) {
  if (!colorProbe) colorProbe = document.createElement("span");
  colorProbe.style.color = "";
  colorProbe.style.color = value;
  return colorProbe.style.color || null;
}

function valuesEqual(value, fallback, isColor) {
  if (typeof value === "boolean" || typeof fallback === "boolean") return !!value === !!fallback;

  const a = value === undefined || value === null ? "" : String(value).trim();
  const b = fallback === undefined || fallback === null ? "" : String(fallback).trim();
  if (a === b) return true;
  // "none" ist bei class-select/variable-select der Platzhalter für "nichts
  // gesetzt" - gegenüber einem fehlenden Standard also kein Unterschied.
  if ((a === "" || a === "none") && (b === "" || b === "none")) return true;

  if (isColor) {
    const normA = normalizeColor(a);
    const normB = normalizeColor(b);
    if (normA && normB) return normA === normB;
  }

  // Zahlen (variable-number, Slider) liegen als Zahl oder als Text vor.
  const numA = Number(a);
  const numB = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(numA) && !Number.isNaN(numB)) return numA === numB;

  return a.toLowerCase() === b.toLowerCase();
}

// Bei variable-color darf der Standard im CSS fehlen; Style Settings holt ihn
// dann aus der CSS-Variablen - allerdings erst beim Rendern der Zeile, und
// eingeklappte Sektionen sind noch nicht gerendert. Deshalb hier derselbe
// Rückgriff.
function defaultValueOf(component, manager) {
  const setting = component.setting;
  if (setting.type === TYPE_COLOR && typeof setting.default !== "string") {
    try {
      return manager.plugin.getCSSVar(setting.id)?.current?.trim();
    } catch (error) {
      return undefined;
    }
  }
  return setting.default;
}

function isModified(component, manager) {
  const setting = component.setting;
  const type = setting?.type;
  // info-text ist reiner Text, heading wird rekursiv behandelt.
  if (!type || type === TYPE_HEADING || type === TYPE_INFO_TEXT) return false;

  // Themenabhängige Farben sind zwei Werte unter "<id>@@light"/"<id>@@dark"
  // mit je eigenem Standard ("default-light"/"default-dark").
  if (type === TYPE_THEMED_COLOR) {
    return ["light", "dark"].some((scheme) => {
      const stored = manager.getSetting(component.sectionId, setting.id + "@@" + scheme);
      return stored !== undefined && !valuesEqual(stored, setting["default-" + scheme], true);
    });
  }

  const stored = manager.getSetting(component.sectionId, setting.id);
  // Nie angefasst - Style Settings speichert nur, was gesetzt wurde.
  if (stored === undefined) return false;
  // Gespeichert heißt aber nicht abweichend: wer einen Schalter zweimal
  // umlegt, hinterlässt einen Eintrag mit dem Standardwert darin.
  return !valuesEqual(stored, defaultValueOf(component, manager), type === TYPE_COLOR);
}

/* --- Filtern --------------------------------------------------------- */

/* Wie Style Settings' eigenes filter(suchbegriff) - mit einem Unterschied:
 * dort klappt jede Sektion mit Treffern auf und jede ohne zu (und
 * clearFilter() klappt anschließend alles zu). Hier bleibt der Auf-/Zuklapp-
 * Zustand unberührt, gefiltert wird nur der Inhalt.
 *
 * Deshalb in zwei Schritten: erst rechnen (setzt nur filterMode/
 * filteredChildren, auch in eingeklappten Sektionen - die zeigen beim
 * späteren Aufklappen dann von selbst die gefilterte Auswahl), dann neu
 * zeichnen. Und zwar nur die aufgeklappten obersten Sektionen: deren
 * renderChildren() baut die Unterbäume ohnehin neu auf, und jede
 * Unter-Überschrift stellt in ihrem render() ihren eigenen Zustand wieder
 * her. Eingeklappte Sektionen haben gar keine gezeichneten Kinder - dort
 * würde Zeichnen sie fälschlich anlegen.
 */
function computeFilter(component, manager) {
  component.filteredChildren = [];
  component.filterResultCount = 0;

  for (const child of component.children) {
    if (child.setting.type === TYPE_HEADING) {
      const count = computeFilter(child, manager);
      if (count > 0) {
        component.filterResultCount += count;
        component.filteredChildren.push(child);
      }
    } else if (isModified(child, manager)) {
      component.filteredChildren.push(child);
      component.filterResultCount += 1;
    }
  }

  component.filterMode = true;
  component.resultsEl?.setText(component.filterResultCount + " Results");
  return component.filterResultCount;
}

function computeClear(component) {
  component.filteredChildren = [];
  component.filterMode = false;
  component.resultsEl?.empty();
  for (const child of component.children) {
    if (child.setting.type === TYPE_HEADING) computeClear(child);
  }
}

function redraw(markup) {
  for (const tree of markup.settingsComponentTrees) {
    if (!tree.setting.collapsed) tree.renderChildren();
  }
}

function applyModifiedFilter(markup, manager) {
  let count = 0;
  for (const tree of markup.settingsComponentTrees) count += computeFilter(tree, manager);
  redraw(markup);
  return count;
}

function clearModifiedFilter(markup) {
  for (const tree of markup.settingsComponentTrees) computeClear(tree);
  redraw(markup);
}

/* --- Knopf ----------------------------------------------------------- */

function findSearchInput(markup) {
  return markup.containerEl?.querySelector("input[type=search]") ?? null;
}

function setFilterActive(markup, link, active) {
  markup.fredModifiedFilterActive = active;
  link.classList.toggle("is-active", active);
}

function toggleFilter(markup, link, manager) {
  if (markup.fredModifiedFilterActive) {
    setFilterActive(markup, link, false);
    // Bewusst nicht markup.clearFilter() - das klappt alle Sektionen zu.
    clearModifiedFilter(markup);
    return;
  }

  // Zwei Filter gleichzeitig ergäben nur Verwirrung, deshalb wird die
  // Textsuche geleert (Style Settings selbst räumt filterString nicht auf).
  const search = findSearchInput(markup);
  if (search) search.value = "";
  markup.filterString = "";

  setFilterActive(markup, link, true);
  const count = applyModifiedFilter(markup, manager);
  if (count === 0) new Notice("Keine Style Settings weichen vom Standard ab.");
}

function injectButton(markup, manager) {
  const container = markup.containerEl;
  // Ohne Import-Link zeigt Style Settings gerade keine Liste (keine
  // Konfiguration gefunden oder nur Fehlermeldungen).
  const importEl = container?.querySelector(".style-settings-import");
  if (!importEl) return;
  const row = importEl.parentElement;
  if (!row || row.querySelector("." + BUTTON_CLASS)) return;

  // Der Einstellungs-Dialog lebt in einem eigenen Fenster, deshalb bewusst
  // über dessen document statt über Obsidians globale Helfer (createEl & Co.
  // hängen am Hauptfenster).
  const link = row.ownerDocument.createElement("a");
  link.className = BUTTON_CLASS;
  link.href = "#";
  link.textContent = BUTTON_LABEL;
  link.setAttribute("aria-label", BUTTON_TOOLTIP);
  row.insertBefore(link, importEl);

  // Frisch aufgebaute Liste ist ungefiltert.
  markup.fredModifiedFilterActive = false;

  link.addEventListener("click", (evt) => {
    evt.preventDefault();
    toggleFilter(markup, link, manager);
  });

  // Tippt jemand in die Suche, übernimmt wieder Style Settings' Textfilter.
  findSearchInput(markup)?.addEventListener("input", () => {
    if (markup.fredModifiedFilterActive) setFilterActive(markup, link, false);
  });
}

/* --- Einhängen ------------------------------------------------------- */

function attachToMarkup(tab, manager) {
  const markup = tab.settingsMarkup;
  if (!markup) return;
  // generate() ist der eine Punkt, durch den jeder Aufbau der Liste läuft:
  // erstes Anzeigen, setSettings() und rerender() nach Import/Reset.
  if (!markup.fredOriginalGenerate) {
    const original = markup.generate;
    markup.fredOriginalGenerate = original;
    markup.generate = function (...args) {
      const result = original.apply(this, args);
      try {
        injectButton(this, manager);
      } catch (error) {
        console.error("[Fred] Style-Settings-Filter: Knopf konnte nicht eingefügt werden", error);
      }
      return result;
    };
  }
  injectButton(markup, manager);
}

function install(plugin) {
  const setting = plugin.app.setting;
  if (typeof setting?.openTab !== "function") {
    console.warn("[Fred] Style-Settings-Filter: app.setting.openTab nicht verfügbar, übersprungen.");
    return null;
  }

  const originalOpenTab = setting.openTab;
  let patchedTab = null;

  const patchedOpenTab = function (tab) {
    const result = originalOpenTab.call(this, tab);
    try {
      if (tab?.id === STYLE_SETTINGS_ID) {
        const manager = plugin.app.plugins.plugins[STYLE_SETTINGS_ID]?.settingsManager;
        if (manager) {
          // openTab() hat die Liste über renderTab() schon aufgebaut - also
          // erst den Tab für künftige display()-Aufrufe erweitern, dann
          // einmal direkt einhängen.
          if (!patchedTab) {
            patchedTab = tab;
            const originalDisplay = tab.display;
            tab.fredOriginalDisplay = originalDisplay;
            tab.display = function (...args) {
              const displayed = originalDisplay.apply(this, args);
              try {
                attachToMarkup(this, manager);
              } catch (error) {
                console.error("[Fred] Style-Settings-Filter: Einhängen fehlgeschlagen", error);
              }
              return displayed;
            };
          }
          attachToMarkup(tab, manager);
        }
      }
    } catch (error) {
      console.error("[Fred] Style-Settings-Filter: Einhängen fehlgeschlagen", error);
    }
    return result;
  };
  setting.openTab = patchedOpenTab;

  return () => {
    // Nur zurücknehmen, wenn in der Zwischenzeit niemand anders gepatcht hat.
    if (setting.openTab === patchedOpenTab) setting.openTab = originalOpenTab;

    const tab = patchedTab;
    patchedTab = null;
    if (!tab) return;
    if (tab.fredOriginalDisplay) {
      tab.display = tab.fredOriginalDisplay;
      delete tab.fredOriginalDisplay;
    }
    const markup = tab.settingsMarkup;
    if (!markup) return;
    if (markup.fredOriginalGenerate) {
      markup.generate = markup.fredOriginalGenerate;
      delete markup.fredOriginalGenerate;
    }
    markup.containerEl?.querySelector("." + BUTTON_CLASS)?.remove();
    if (markup.fredModifiedFilterActive) {
      markup.fredModifiedFilterActive = false;
      clearModifiedFilter(markup);
    }
  };
}

function registerStyleSettingsFilter(plugin) {
  let uninstall = null;

  const update = () => {
    const enabled = plugin.settings.styleSettingsModifiedFilterEnabled;
    if (enabled && !uninstall) uninstall = install(plugin);
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

module.exports = { registerStyleSettingsFilter };
