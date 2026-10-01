var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/important-plugins.js
var require_important_plugins = __commonJS({
  "src/important-plugins.js"(exports2, module2) {
    var { FuzzySuggestModal, Notice } = require("obsidian");
    var PluginPickerModal = class extends FuzzySuggestModal {
      constructor(app, manifests, resolve) {
        super(app);
        this.manifests = manifests;
        this.resolve = resolve;
        this.chosen = false;
        this.setPlaceholder("ESC f\xFCr Abbruch");
      }
      getItems() {
        return this.manifests;
      }
      getItemText(manifest) {
        return manifest.name;
      }
      selectSuggestion(item, evt) {
        this.chosen = true;
        super.selectSuggestion(item, evt);
      }
      onChooseItem(manifest) {
        this.resolve(manifest.id);
      }
      onClose() {
        super.onClose();
        if (!this.chosen) this.resolve(null);
      }
    };
    function isEnabled(app, id) {
      return Object.prototype.hasOwnProperty.call(app.plugins.plugins, id);
    }
    function enabledImportantManifests(plugin) {
      return plugin.settings.importantPlugins.filter((id) => isEnabled(plugin.app, id)).map((id) => plugin.app.plugins.manifests[id]).filter(Boolean);
    }
    function openPluginSettings(app, id) {
      app.setting.open();
      if (!app.setting.openTabById(id)) new Notice("Dieses Plugin hat keine eigenen Einstellungen.");
    }
    async function openImportantPluginSettingsPicker(plugin) {
      const manifests = enabledImportantManifests(plugin);
      if (manifests.length === 0) {
        new Notice('Keine wichtigen Plugins eingetragen (Einstellungen -> Generell -> "Important Plugin Settings").');
        return;
      }
      if (manifests.length === 1) {
        openPluginSettings(plugin.app, manifests[0].id);
        return;
      }
      const id = await new Promise((resolve) => new PluginPickerModal(plugin.app, manifests, resolve).open());
      if (id) openPluginSettings(plugin.app, id);
    }
    var registeredCommandIds = /* @__PURE__ */ new Set();
    function commandIdFor(pluginId) {
      return `open-${pluginId}-settings`;
    }
    function refreshPerPluginCommands(plugin) {
      const desired = new Map(enabledImportantManifests(plugin).map((manifest) => [commandIdFor(manifest.id), manifest]));
      for (const id of registeredCommandIds) {
        if (desired.has(id)) continue;
        plugin.app.commands.removeCommand(`${plugin.manifest.id}:${id}`);
        registeredCommandIds.delete(id);
      }
      for (const [id, manifest] of desired) {
        if (registeredCommandIds.has(id)) continue;
        plugin.addCommand({
          id,
          name: `Open ${manifest.name} Settings`,
          callback: () => openPluginSettings(plugin.app, manifest.id)
        });
        registeredCommandIds.add(id);
      }
    }
    function registerImportantPlugins2(plugin) {
      const refresh = () => refreshPerPluginCommands(plugin);
      plugin.registerEvent(plugin.app.plugins.on("changed", refresh));
      plugin.app.workspace.onLayoutReady(refresh);
      return refresh;
    }
    module2.exports = { registerImportantPlugins: registerImportantPlugins2, openImportantPluginSettingsPicker, PluginPickerModal, enabledImportantManifests };
  }
});

// src/settings.js
var require_settings = __commonJS({
  "src/settings.js"(exports2, module2) {
    var { PluginSettingTab, SettingGroup, Notice, setIcon } = require("obsidian");
    var { PluginPickerModal } = require_important_plugins();
    var DEFAULT_SETTINGS2 = {
      contactsCsvPath: "_obsidian/data/contacts.csv",
      contactsBaseDir: "~Kontakte",
      contactsTyp: "KONTAKT",
      contactsTrashSubdir: "_Trash",
      contactsEditOnly: false,
      contactsFilterRelevant: true,
      contactsNormalizeEnabled: true,
      // "csv" = CSV gewinnt, "gaps" = nur leere Properties füllen,
      // "ask" = je betroffenem Kontakt ein Dialog.
      contactsConflictMode: "csv",
      contactsDryRun: false,
      databaseFoldersEnabled: true,
      databaseFolderPrefix: "~",
      folderNoteClickExtensionEnabled: true,
      databaseFolderCountAtEnd: false,
      reciprocalLinkProperties: ["Familie"],
      propertyBacklinksLiveEnabled: true,
      propertyBacklinksTypOrder: true,
      nestedCheckboxSyncEnabled: false,
      italicUnderscoreEnabled: false,
      basesHasNoteEnabled: true,
      styleSettingsModifiedFilterEnabled: true,
      declaredLinkPairs: {},
      // Siehe important-plugins.js: aktivierte Plugin-IDs, für die automatisch
      // je ein eigener "Einstellungen öffnen"-Befehl entsteht.
      importantPlugins: []
    };
    var TABS = [
      { id: "general", label: "Generell" },
      { id: "kontakte", label: "KONTAKTE" },
      { id: "media", label: "MEDIA" }
    ];
    var FredSettingTab2 = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.activeTab = TABS[0].id;
      }
      display() {
        const { containerEl } = this;
        containerEl.empty();
        const tabBar = containerEl.createDiv({ cls: "fred-settings-tabs" });
        for (const tab of TABS) {
          const btn = tabBar.createEl("button", {
            text: tab.label,
            cls: "fred-settings-tab" + (this.activeTab === tab.id ? " is-active" : "")
          });
          btn.addEventListener("click", () => {
            this.activeTab = tab.id;
            this.display();
          });
        }
        const content = containerEl.createDiv({ cls: "fred-settings-content" });
        if (this.activeTab === "general") this.displayGeneralTab(content);
        else if (this.activeTab === "kontakte") this.displayKontakteTab(content);
        else if (this.activeTab === "media") this.displayMediaTab(content);
      }
      // Jeder Abschnitt ist eine SettingGroup - Obsidians eigene Gruppierung
      // (Überschrift + eine Box, Einträge darin durch Trennlinien getrennt), wie
      // in den Core-Einstellungen. Einzeln per new Setting(containerEl) angelegte
      // Einträge würden stattdessen je als eigene kleine Box gerendert.
      displayGeneralTab(containerEl) {
        new SettingGroup(containerEl).setHeading("Datenbank-Ordner").addSetting(
          (setting) => setting.setName("Pr\xE4fix-Ordner als Datenbank behandeln").setDesc("Ordner, deren Name mit dem Pr\xE4fix beginnt, sind im Dateibaum nicht mehr auf-/zuklappbar.").addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.databaseFoldersEnabled).onChange(async (value) => {
              this.plugin.settings.databaseFoldersEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Pr\xE4fix").setDesc("Ordnernamen, die mit diesem Zeichen/Text beginnen, gelten als Datenbank-Ordner.").addText(
            (text) => text.setValue(this.plugin.settings.databaseFolderPrefix).onChange(async (value) => {
              this.plugin.settings.databaseFolderPrefix = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Folder-Notes-Erweiterung: gesamte Zeile klickbar").setDesc(
            "Bei Datenbank-Ordnern \xF6ffnet ein Klick irgendwo in der Titelzeile (nicht nur auf dem Namen) die zugeh\xF6rige Folder-Note, sofern das Folder-Notes-Plugin genutzt wird."
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.folderNoteClickExtensionEnabled).onChange(async (value) => {
              this.plugin.settings.folderNoteClickExtensionEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Anzahl am Zeilenende anzeigen").setDesc("Zeigt die .md-Datei-Anzahl statt an Stelle des Pfeils am Zeilenende an, wie sonst die Dateiendung.").addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.databaseFolderCountAtEnd).onChange(async (value) => {
              this.plugin.settings.databaseFolderCountAtEnd = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
        );
        new SettingGroup(containerEl).setHeading("Property-Backlinking").addSetting(
          (setting) => setting.setName("Properties").setDesc(
            "Kommagetrennte Liste von Frontmatter-Properties mit Links zu anderen Notizen (z. B. Familie, Freunde) - gilt f\xFCr alle Notizen, unabh\xE4ngig vom TYP. Verlinkt eine Notiz hier eine andere, bekommt die andere automatisch den Backlink in derselben Property erg\xE4nzt - und wieder entfernt, sobald die Verlinkung wegf\xE4llt. Gro\xDF-/Kleinschreibung muss exakt zum Property-Namen passen."
          ).addText(
            (text) => text.setValue(this.plugin.settings.reciprocalLinkProperties.join(", ")).onChange(async (value) => {
              this.plugin.settings.reciprocalLinkProperties = value.split(",").map((name) => name.trim()).filter((name) => name.length > 0);
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Live aktualisieren").setDesc(
            'Property-Backlinking sofort beim Speichern abgleichen, statt nur auf Befehl ("Property-Backlinking aktualisieren").'
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.propertyBacklinksLiveEnabled).onChange(async (value) => {
              this.plugin.settings.propertyBacklinksLiveEnabled = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Reihenfolge aus TYP-System \xFCbernehmen").setDesc(
            "Legt das Backlinking eine Property in einer Notiz neu an, landet sie an ihrem Platz laut Frontmatter-Sortierung des TYP-Systems (globale Reihenfolge, TYP-Frontmatter samt Floating Properties) statt am Ende. Nur die neue Property wird einsortiert, die \xFCbrigen bleiben, wie sie sind. Ohne aktiviertes TYP-System wird wie bisher angeh\xE4ngt."
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.propertyBacklinksTypOrder).onChange(async (value) => {
              this.plugin.settings.propertyBacklinksTypOrder = value;
              await this.plugin.saveSettings();
            })
          )
        );
        new SettingGroup(containerEl).setHeading("Checklisten").addSetting(
          (setting) => setting.setName("Verschachtelte Checkboxen mit umschalten").setDesc(
            "Beim (Ent)Haken einer Checkbox werden alle darunter verschachtelten Checkboxen automatisch mit (ent)hakt - und umgekehrt: sind alle Checkboxen einer Unterliste angehakt, wird die \xFCbergeordnete Checkbox automatisch mit angehakt, und wieder entfernt, sobald eine davon wieder abgehakt wird."
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.nestedCheckboxSyncEnabled).onChange(async (value) => {
              this.plugin.settings.nestedCheckboxSyncEnabled = value;
              await this.plugin.saveSettings();
            })
          )
        );
        new SettingGroup(containerEl).setHeading("Formatierung").addSetting(
          (setting) => setting.setName("Kursiv mit Unterstrichen").setDesc(
            'Der Befehl "Kursiv umschalten" setzt beim Einf\xFCgen Unterstriche (_Text_) statt Sternchen (*Text*) um die Auswahl. Bereits vorhandene Kursivformatierung (mit * oder _) wird beim erneuten Umschalten weiterhin korrekt erkannt und entfernt.'
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.italicUnderscoreEnabled).onChange(async (value) => {
              this.plugin.settings.italicUnderscoreEnabled = value;
              await this.plugin.saveSettings();
            })
          )
        );
        new SettingGroup(containerEl).setHeading("Bases").addSetting(
          (setting) => setting.setName('Property "file.hasNote"').setDesc(
            'Stellt in Bases die zus\xE4tzliche Datei-Property "file.hasNote" bereit - wie die eingebauten file.embeds/file.tags, also ohne etwas ins Frontmatter zu schreiben. Sie ist true, wenn die Notiz au\xDFerhalb des Frontmatters Inhalt hat, und damit als Spalte, Filter oder Gruppierung nutzbar. Bereits ge\xF6ffnete Bases zeigen sie erst nach einem Neuaufbau (Tab neu \xF6ffnen).'
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.basesHasNoteEnabled).onChange(async (value) => {
              this.plugin.settings.basesHasNoteEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateBasesHasNote?.();
            })
          )
        );
        new SettingGroup(containerEl).setHeading("Style Settings").addSetting(
          (setting) => setting.setName('Knopf "Modified"').setDesc(
            `Erg\xE4nzt in den Einstellungen des Plugins "Style Settings" links neben Import/Export einen Knopf, der die Liste auf die Einstellungen filtert, die nicht mehr ihrem Standardwert entsprechen - ein zweiter Klick zeigt wieder alle. Z\xE4hlt nur echte Abweichungen: ein Wert, der (z. B. durch zweimaliges Umschalten) wieder dem Standard entspricht, gilt als unver\xE4ndert. Der Auf-/Zuklapp-Zustand der \xDCberschriften bleibt dabei unber\xFChrt; wie viel in einer zugeklappten Sektion steckt, zeigt deren Trefferzahl. Wirkt im Einstellungs-Dialog, nicht in Style Settings' Seitenleisten-Ansicht.`
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.styleSettingsModifiedFilterEnabled).onChange(async (value) => {
              this.plugin.settings.styleSettingsModifiedFilterEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateStyleSettingsFilter?.();
            })
          )
        );
        let listEl;
        new SettingGroup(containerEl).setHeading("Important Plugin Settings").addExtraButton(
          (button) => button.setIcon("plus").setTooltip("Plugin hinzuf\xFCgen").onClick(() => {
            const manifests = this.plugin.app.plugins.manifests;
            const candidates = Object.keys(this.plugin.app.plugins.plugins).filter((id) => manifests[id] && !this.plugin.settings.importantPlugins.includes(id)).map((id) => manifests[id]).sort((a, b) => a.name.localeCompare(b.name));
            if (candidates.length === 0) {
              new Notice("Keine weiteren aktivierten Plugins verf\xFCgbar.");
              return;
            }
            new PluginPickerModal(this.plugin.app, candidates, async (id) => {
              if (!id) return;
              this.plugin.settings.importantPlugins.push(id);
              await this.plugin.saveSettings();
              this.plugin.refreshImportantPluginCommands?.();
              renderImportantPluginsList();
            }).open();
          })
        ).addSetting((setting) => {
          setting.setDesc("Eigener Befehl je Plugin, um dessen Einstellungen direkt zu \xF6ffnen. Reihenfolge per Drag&Drop.");
          listEl = setting.infoEl.createDiv({ cls: "fred-important-plugins-list" });
        });
        const renderImportantPluginsList = () => {
          listEl.empty();
          const manifests = this.plugin.app.plugins.manifests;
          const enabledIds = this.plugin.settings.importantPlugins.filter(
            (id) => manifests[id] && Object.prototype.hasOwnProperty.call(this.plugin.app.plugins.plugins, id)
          );
          if (enabledIds.length === 0) {
            listEl.createDiv({ cls: "setting-item-description", text: "Keine wichtigen Plugins eingetragen." });
            return;
          }
          const saveOrderFromDom = async () => {
            const visible = new Set(enabledIds);
            const newOrder = Array.from(listEl.children, (el) => el.dataset.pluginId);
            let next = 0;
            this.plugin.settings.importantPlugins = this.plugin.settings.importantPlugins.map(
              (id) => visible.has(id) ? newOrder[next++] : id
            );
            await this.plugin.saveSettings();
            this.plugin.refreshImportantPluginCommands?.();
          };
          const dropsBefore = (row, evt) => {
            const rect = row.getBoundingClientRect();
            if (evt.clientY < rect.top) return true;
            if (evt.clientY > rect.bottom) return false;
            return evt.clientX < rect.left + rect.width / 2;
          };
          for (const id of enabledIds) {
            const row = listEl.createDiv({ cls: "fred-important-plugins-row" });
            row.draggable = true;
            row.dataset.pluginId = id;
            const grip = row.createDiv({ cls: "fred-important-plugins-grip" });
            setIcon(grip, "grip-vertical");
            row.createSpan({ cls: "fred-important-plugins-name", text: manifests[id].name });
            const removeBtn = row.createDiv({
              cls: "clickable-icon fred-important-plugins-remove",
              attr: { "aria-label": "Entfernen" }
            });
            setIcon(removeBtn, "x");
            removeBtn.addEventListener("click", async () => {
              this.plugin.settings.importantPlugins = this.plugin.settings.importantPlugins.filter((x) => x !== id);
              await this.plugin.saveSettings();
              this.plugin.refreshImportantPluginCommands?.();
              renderImportantPluginsList();
            });
            row.addEventListener("dragstart", (evt) => {
              dragged = row;
              row.addClass("is-dragging");
              evt.dataTransfer.effectAllowed = "move";
              evt.dataTransfer.setData("text/plain", id);
            });
            row.addEventListener("dragover", (evt) => {
              if (!dragged || dragged === row) return;
              evt.preventDefault();
              evt.dataTransfer.dropEffect = "move";
              listEl.insertBefore(dragged, dropsBefore(row, evt) ? row : row.nextSibling);
            });
            row.addEventListener("dragend", async () => {
              row.removeClass("is-dragging");
              dragged = null;
              await saveOrderFromDom();
            });
          }
        };
        let dragged = null;
        renderImportantPluginsList();
      }
      displayKontakteTab(containerEl) {
        new SettingGroup(containerEl).setHeading("Kontaktimport").addSetting(
          (setting) => setting.setName("CSV-Datei").setDesc("Pfad zur Kontakte-CSV, relativ zum Vault-Root.").addText(
            (text) => text.setValue(this.plugin.settings.contactsCsvPath).onChange(async (value) => {
              this.plugin.settings.contactsCsvPath = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Kontakte-Basisverzeichnis").setDesc(
            "Alle Kontakte landen flach direkt in diesem Ordner (relativ zum Vault-Root). Gro\xDF-/Kleinschreibung wird beim Abgleich ignoriert."
          ).addText(
            (text) => text.setValue(this.plugin.settings.contactsBaseDir).onChange(async (value) => {
              this.plugin.settings.contactsBaseDir = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("TYP der Kontakt-Notizen").setDesc(
            "Bestimmt zugleich, aus welchem TYP-Frontmatter der Import seine Feldliste liest. L\xE4uft das TYP-System nicht, greift eine interne Liste."
          ).addText(
            (text) => text.setValue(this.plugin.settings.contactsTyp).onChange(async (value) => {
              this.plugin.settings.contactsTyp = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Papierkorb-Unterordner").setDesc(
            "Kontakte, zu denen keine CSV-Zeile mehr passt, wandern hierhin (innerhalb des Basisverzeichnisses). Eingehende Links bleiben dabei erhalten."
          ).addText(
            (text) => text.setValue(this.plugin.settings.contactsTrashSubdir).onChange(async (value) => {
              this.plugin.settings.contactsTrashSubdir = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Nur bestehende Kontakte aktualisieren").setDesc("Wenn aktiv, werden keine neuen Kontakt-Notizen angelegt, nur bestehende aktualisiert.").addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.contactsEditOnly).onChange(async (value) => {
              this.plugin.settings.contactsEditOnly = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Irrelevante Kontakte \xFCberspringen").setDesc("Kontakte ohne Geburtstag und ohne Tags werden \xFCbersprungen.").addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.contactsFilterRelevant).onChange(async (value) => {
              this.plugin.settings.contactsFilterRelevant = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Werte normalisieren").setDesc(
            "Telefonnummern auf +49-Format (inkl. gesch\xFCtzter Leerzeichen), E-Mails klein, L\xE4nderk\xFCrzel ausgeschrieben, Hausnummern in deutsche Reihenfolge. Jede Korrektur wird in der Konsole protokolliert."
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.contactsNormalizeEnabled).onChange(async (value) => {
              this.plugin.settings.contactsNormalizeEnabled = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Bei abweichenden Werten").setDesc(
            "Was passiert, wenn eine Notiz bereits einen anderen Wert hat als die CSV. Leere Properties werden immer gef\xFCllt, Tags immer zusammengef\xFChrt."
          ).addDropdown(
            (dropdown) => dropdown.addOption("csv", "CSV gewinnt").addOption("gaps", "Notiz behalten, nur L\xFCcken f\xFCllen").addOption("ask", "Pro Kontakt nachfragen").setValue(this.plugin.settings.contactsConflictMode).onChange(async (value) => {
              this.plugin.settings.contactsConflictMode = value;
              await this.plugin.saveSettings();
            })
          )
        ).addSetting(
          (setting) => setting.setName("Probelauf").setDesc(
            "Rechnet den Lauf komplett durch und meldet in der Konsole, was passieren w\xFCrde - schreibt aber nichts. Gilt f\xFCr beide Kontakt-Befehle."
          ).addToggle(
            (toggle) => toggle.setValue(this.plugin.settings.contactsDryRun).onChange(async (value) => {
              this.plugin.settings.contactsDryRun = value;
              await this.plugin.saveSettings();
            })
          )
        );
      }
      displayMediaTab(containerEl) {
        containerEl.createEl("p", { text: "Noch keine Einstellungen." });
      }
    };
    module2.exports = { DEFAULT_SETTINGS: DEFAULT_SETTINGS2, FredSettingTab: FredSettingTab2 };
  }
});

// src/kontakt-import.js
var require_kontakt_import = __commonJS({
  "src/kontakt-import.js"(exports2, module2) {
    var { Notice, Modal, Setting, ButtonComponent } = require("obsidian");
    var MULTI_VALUE_SEPARATOR = " ::: ";
    var IGNORED_LABELS = /* @__PURE__ */ new Set(["* myContacts", "* starred"]);
    var STARRED_LABEL = "* starred";
    var COLUMN_MAPPING = {
      "First Name": "Vorname",
      "Middle Name": "Zweitname",
      "Last Name": "Nachname",
      "Birthday": "Geburtstag",
      "Address 1 - Street": "Strasse",
      "Address 1 - City": "Stadt",
      "Address 1 - Postal Code": "Plz",
      "Address 1 - Country": "Nation"
    };
    var FALLBACK_CONTACT_KEYS = [
      "Vorname",
      "Zweitname",
      "Nachname",
      "Geburtstag",
      "Handynummer",
      "Handynummer-Alt",
      "Festnetz",
      "E-Mail",
      "E-Mail-Alt",
      "Strasse",
      "Stadt",
      "Plz",
      "Nation",
      "Familie",
      "Freunde"
    ];
    var IMPORT_OWNED_KEYS = [
      "Vorname",
      "Zweitname",
      "Nachname",
      "Geburtstag",
      "Handynummer",
      "Handynummer-Alt",
      "Festnetz",
      "E-Mail",
      "E-Mail-Alt",
      "Strasse",
      "Stadt",
      "Plz",
      "Nation",
      "tags"
    ];
    var SOURCE_COLUMNS = {
      Vorname: ["First Name"],
      Zweitname: ["Middle Name"],
      Nachname: ["Last Name"],
      Geburtstag: ["Birthday"],
      Handynummer: ["Phone 1 - Value"],
      "Handynummer-Alt": ["Phone 1 - Value"],
      Festnetz: ["Phone 2 - Value"],
      "E-Mail": ["E-mail 1 - Value"],
      "E-Mail-Alt": ["E-mail 2 - Value", "E-mail 3 - Value"],
      Strasse: ["Address 1 - Street"],
      Stadt: ["Address 1 - City"],
      Plz: ["Address 1 - Postal Code"],
      Nation: ["Address 1 - Country"],
      tags: ["Labels"]
    };
    var COUNTRY_NAMES = {
      DE: "Deutschland",
      AT: "\xD6sterreich",
      CH: "Schweiz",
      FR: "Frankreich",
      NL: "Niederlande",
      BE: "Belgien",
      LU: "Luxemburg",
      IT: "Italien",
      ES: "Spanien",
      PL: "Polen",
      CZ: "Tschechien",
      DK: "D\xE4nemark",
      GB: "Vereinigtes K\xF6nigreich",
      US: "USA",
      TR: "T\xFCrkei"
    };
    function joinVaultPath(...parts) {
      return parts.filter((part) => part !== void 0 && part !== null && part !== "").join("/").replace(/\/+/g, "/").replace(/\/$/, "");
    }
    function isInFolder(path, folder) {
      const p = path.toLowerCase();
      const f = folder.toLowerCase();
      return p === f || p.startsWith(f + "/");
    }
    function resolveFolderPath(app, folder) {
      if (app.vault.getAbstractFileByPath(folder)) return folder;
      const lower = folder.toLowerCase();
      for (const item of app.vault.getAllLoadedFiles?.() ?? []) {
        if (item.children && item.path.toLowerCase() === lower) return item.path;
      }
      return folder;
    }
    function sanitizeFileName(name) {
      return name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim();
    }
    function parseCsv(text) {
      const rows = [];
      let row = [];
      let field = "";
      let inQuotes = false;
      let i = 0;
      while (i < text.length) {
        const char = text[i];
        if (inQuotes) {
          if (char === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            inQuotes = false;
            i++;
            continue;
          }
          field += char;
          i++;
          continue;
        }
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (char === ",") {
          row.push(field);
          field = "";
          i++;
          continue;
        }
        if (char === "\r") {
          i++;
          continue;
        }
        if (char === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
          continue;
        }
        field += char;
        i++;
      }
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      return rows.filter((r) => !(r.length === 1 && r[0] === ""));
    }
    function csvToObjects(text) {
      const rows = parseCsv(text.replace(/^﻿/, ""));
      if (rows.length === 0) return [];
      const header = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        header.forEach((key, idx) => obj[key] = row[idx] ?? "");
        return obj;
      });
    }
    function splitMulti(value) {
      return String(value ?? "").split(MULTI_VALUE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
    }
    function normalizePhone(raw) {
      let phone = String(raw ?? "").replace(/[\s   ()/.-]/g, "");
      if (!phone) return "";
      if (phone.startsWith("00")) phone = "+" + phone.slice(2);
      else if (phone.startsWith("0")) phone = "+49" + phone.slice(1);
      return phone.replace(/^\+490/, "+49");
    }
    function normalizeEmail(raw) {
      return String(raw ?? "").trim().toLowerCase();
    }
    function normalizeCountry(raw) {
      const value = String(raw ?? "").trim();
      return COUNTRY_NAMES[value.toUpperCase()] ?? value;
    }
    function normalizeStreet(raw) {
      let street = String(raw ?? "").trim().replace(/\s+/g, " ");
      if (!street) return "";
      street = street.replace(/([a-zäöüß])str\.?(?=\s|$)/g, "$1stra\xDFe");
      street = street.replace(/\bStr\.?(?=\s|$)/g, "Stra\xDFe");
      const usOrder = street.match(/^(\d+\s?[a-zA-Z]?)\s+(\D.*)$/);
      if (usOrder) street = `${usOrder[2].trim()} ${usOrder[1].replace(/\s/g, "")}`;
      return street;
    }
    function normalizeBirthday(raw) {
      const value = String(raw ?? "").trim();
      return value.startsWith("--") ? "0001" + value.slice(1) : value;
    }
    function normalizeTag(raw) {
      return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    }
    function collectPhones(row) {
      const mobile = [];
      const landline = [];
      for (const value of splitMulti(row["Phone 1 - Value"])) {
        const phone = normalizePhone(value);
        if (phone && !mobile.includes(phone)) mobile.push(phone);
      }
      for (const value of splitMulti(row["Phone 2 - Value"])) {
        const phone = normalizePhone(value);
        if (phone && !mobile.includes(phone) && !landline.includes(phone)) landline.push(phone);
      }
      return { mobile, landline };
    }
    function collectEmails(row) {
      const emails = [];
      for (const column of ["E-mail 1 - Value", "E-mail 2 - Value", "E-mail 3 - Value"]) {
        for (const value of splitMulti(row[column])) {
          const email = normalizeEmail(value);
          if (email && !emails.includes(email)) emails.push(email);
        }
      }
      return emails;
    }
    function collectTags(row) {
      const labels = splitMulti(row["Labels"]);
      const tags = [];
      for (const label of labels) {
        if (IGNORED_LABELS.has(label)) continue;
        const tag = normalizeTag(label);
        if (tag && !tags.includes(tag)) tags.push(tag);
      }
      if (labels.includes(STARRED_LABEL) && !tags.includes("favorit")) tags.push("favorit");
      return tags;
    }
    function noteCorrection(corrections, name, field, from, to) {
      if (from === to || !from) return;
      corrections.push({ name, field, from, to });
    }
    function buildContact(row, corrections, normalize) {
      const firstName = (row["First Name"] || "").trim();
      const lastName = (row["Last Name"] || "").trim();
      let baseName = "";
      if (firstName && lastName) baseName = `${firstName} ${lastName}`;
      else if (firstName || lastName) baseName = firstName || lastName;
      const data = {};
      for (const [column, key] of Object.entries(COLUMN_MAPPING)) {
        const raw = (row[column] || "").trim();
        if (!raw) continue;
        let value = raw;
        if (key === "Geburtstag") value = normalizeBirthday(raw);
        else if (normalize && key === "Nation") value = normalizeCountry(raw);
        else if (normalize && key === "Strasse") value = normalizeStreet(raw);
        noteCorrection(corrections, baseName, key, raw, value);
        data[key] = value;
      }
      const { mobile, landline } = collectPhones(row);
      if (mobile[0]) {
        noteCorrection(corrections, baseName, "Handynummer", splitMulti(row["Phone 1 - Value"])[0] ?? "", mobile[0]);
        data["Handynummer"] = mobile[0];
      }
      if (mobile.length > 1) data["Handynummer-Alt"] = mobile.length === 2 ? mobile[1] : mobile.slice(1);
      if (landline.length > 0) data["Festnetz"] = landline.length === 1 ? landline[0] : landline;
      const emails = collectEmails(row);
      if (emails[0]) {
        if (normalize) noteCorrection(corrections, baseName, "E-Mail", splitMulti(row["E-mail 1 - Value"])[0] ?? "", emails[0]);
        data["E-Mail"] = emails[0];
      }
      if (emails.length > 1) data["E-Mail-Alt"] = emails.length === 2 ? emails[1] : emails.slice(1);
      const tags = collectTags(row);
      if (tags.length > 0) data["tags"] = tags;
      return {
        baseName,
        data,
        phones: [...mobile, ...landline],
        emails,
        body: (row["Notes"] || "").trim()
      };
    }
    function isRelevant(contact) {
      return Boolean(contact.data.Geburtstag) || (contact.data.tags?.length ?? 0) > 0;
    }
    function getTypSystem(app) {
      return app.plugins.plugins["typ-system"] ?? null;
    }
    function contactPropertyKeys(app, typ) {
      const defaults = getTypSystem(app)?.getTypeDefaults?.(typ, { includeFloating: true });
      const keys = defaults ? Object.keys(defaults) : null;
      return keys && keys.length > 0 ? keys : FALLBACK_CONTACT_KEYS;
    }
    function toArray(value) {
      if (Array.isArray(value)) return value;
      if (value === void 0 || value === null || value === "") return [];
      return [value];
    }
    function buildNoteIndex(app, baseDir, typ) {
      const byPhone = /* @__PURE__ */ new Map();
      const byEmail = /* @__PURE__ */ new Map();
      const byName = /* @__PURE__ */ new Map();
      const notes = [];
      for (const file of app.vault.getMarkdownFiles()) {
        if (!isInFolder(file.path, baseDir)) continue;
        const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        if (String(frontmatter.TYP ?? frontmatter.typ ?? "") !== typ) continue;
        const entry = { file, frontmatter };
        notes.push(entry);
        for (const key of ["Handynummer", "Handynummer-Alt", "Festnetz"]) {
          for (const value of toArray(frontmatter[key])) {
            const phone = normalizePhone(value);
            if (phone && !byPhone.has(phone)) byPhone.set(phone, entry);
          }
        }
        for (const key of ["E-Mail", "E-Mail-Alt"]) {
          for (const value of toArray(frontmatter[key])) {
            const email = normalizeEmail(value);
            if (email && !byEmail.has(email)) byEmail.set(email, entry);
          }
        }
        const name = file.basename.toLowerCase();
        if (!byName.has(name)) byName.set(name, entry);
      }
      return { byPhone, byEmail, byName, notes };
    }
    function matchNote(index, contact, taken) {
      for (const phone of contact.phones) {
        const hit2 = index.byPhone.get(phone);
        if (hit2 && !taken.has(hit2.file.path)) return { entry: hit2, via: "Telefon" };
      }
      for (const email of contact.emails) {
        const hit2 = index.byEmail.get(email);
        if (hit2 && !taken.has(hit2.file.path)) return { entry: hit2, via: "E-Mail" };
      }
      const hit = index.byName.get(contact.baseName.toLowerCase());
      if (hit && !taken.has(hit.file.path)) return { entry: hit, via: "Name" };
      return null;
    }
    function uniqueSuffix(contact) {
      const phone = contact.phones[0];
      if (phone && phone.length >= 4) return phone.slice(-4);
      const email = contact.emails[0];
      if (email) {
        const local = email.split("@")[0].replace(/[^\p{L}\p{N}]/gu, "");
        if (local.length >= 4) return local.slice(-4);
      }
      return null;
    }
    function assignFileNames(contacts, skipped) {
      const byName = /* @__PURE__ */ new Map();
      for (const contact of contacts) {
        const key = contact.baseName.toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(contact);
      }
      const result = [];
      for (const group of byName.values()) {
        if (group.length === 1) {
          group[0].fileName = sanitizeFileName(group[0].baseName);
          result.push(group[0]);
          continue;
        }
        const used = /* @__PURE__ */ new Set();
        for (const contact of group) {
          const suffix = uniqueSuffix(contact);
          if (!suffix || used.has(suffix)) {
            skipped.push({
              name: contact.baseName,
              reason: suffix ? "gleicher Namenszusatz wie ein anderer Kontakt" : "Namensgleichheit ohne Nummer oder E-Mail"
            });
            continue;
          }
          used.add(suffix);
          contact.fileName = sanitizeFileName(`${contact.baseName} (${suffix})`);
          result.push(contact);
        }
      }
      return result;
    }
    function valuesEqual(a, b) {
      if (Array.isArray(a) || Array.isArray(b)) {
        const x = toArray(a).map(String);
        const y = toArray(b).map(String);
        return x.length === y.length && x.every((v, i) => v === y[i]);
      }
      if (a === void 0 || a === null || a === "") return b === void 0 || b === null || b === "";
      return String(a) === String(b);
    }
    function mergeTags(existing, incoming) {
      return [.../* @__PURE__ */ new Set([...toArray(incoming).map(String), ...toArray(existing).map(String)])];
    }
    function buildChanges(contact, frontmatter, ownedKeys, removableKeys) {
      const changes = [];
      for (const key of ownedKeys) {
        let value = contact.data[key];
        if (key === "tags") {
          if (value === void 0 && toArray(frontmatter.tags).length === 0) continue;
          value = mergeTags(frontmatter.tags, value);
        }
        if (value === void 0) {
          const existing = frontmatter[key];
          const hasExisting = !(existing === void 0 || existing === null || existing === "" || toArray(existing).length === 0);
          if (!hasExisting || !removableKeys?.has(key)) continue;
          changes.push({ key, from: existing, to: void 0 });
          continue;
        }
        if (valuesEqual(frontmatter[key], value)) continue;
        changes.push({ key, from: frontmatter[key], to: value });
      }
      return changes;
    }
    function canonicalValue(key, value) {
      const parts = toArray(value).map(String);
      if (key === "Handynummer" || key === "Handynummer-Alt" || key === "Festnetz") {
        return parts.map(normalizePhone).join("|");
      }
      if (key === "E-Mail" || key === "E-Mail-Alt") return parts.map(normalizeEmail).join("|");
      if (key === "Nation") return parts.map(normalizeCountry).join("|");
      if (key === "Strasse") return parts.map(normalizeStreet).join("|");
      return parts.join("|");
    }
    function splitChanges(changes, frontmatter) {
      const plain = [];
      const conflicts = [];
      for (const change of changes) {
        const existing = frontmatter[change.key];
        const isEmpty = existing === void 0 || existing === null || existing === "" || toArray(existing).length === 0;
        const sameValue = canonicalValue(change.key, existing) === canonicalValue(change.key, change.to);
        if (isEmpty || sameValue || change.key === "tags") plain.push(change);
        else conflicts.push(change);
      }
      return { changes: plain, conflicts };
    }
    async function buildPlan(plugin) {
      const { app, settings } = plugin;
      const { adapter } = app.vault;
      const csvPath = settings.contactsCsvPath;
      const configuredDir = settings.contactsBaseDir.replace(/\/$/, "");
      const typ = settings.contactsTyp || "KONTAKT";
      if (!await adapter.exists(csvPath)) throw new Error(`Datei nicht gefunden: ${csvPath}`);
      if (!await adapter.exists(configuredDir)) throw new Error(`Basisverzeichnis nicht gefunden: ${configuredDir}`);
      const baseDir = resolveFolderPath(app, configuredDir);
      const trashDir = joinVaultPath(baseDir, settings.contactsTrashSubdir || "_Trash");
      const corrections = [];
      const skipped = [];
      const normalize = settings.contactsNormalizeEnabled !== false;
      const rows = csvToObjects(await adapter.read(csvPath));
      let contacts = [];
      for (const row of rows) {
        const contact = buildContact(row, corrections, normalize);
        if (!contact.baseName) {
          skipped.push({ name: "(ohne Namen)", reason: "weder Vor- noch Nachname" });
          continue;
        }
        if (settings.contactsFilterRelevant && !isRelevant(contact)) continue;
        contacts.push(contact);
      }
      contacts = assignFileNames(contacts, skipped);
      const index = buildNoteIndex(app, baseDir, typ);
      const typKeys = contactPropertyKeys(app, typ);
      const ownedKeys = new Set(IMPORT_OWNED_KEYS.filter((key) => key === "tags" || typKeys.includes(key)));
      const header = new Set(rows.length > 0 ? Object.keys(rows[0]) : []);
      const removableKeys = new Set(
        [...ownedKeys].filter((key) => key !== "tags" && (SOURCE_COLUMNS[key] ?? []).some((column) => header.has(column)))
      );
      const actions = [];
      const taken = /* @__PURE__ */ new Set();
      for (const contact of contacts) {
        const match = matchNote(index, contact, taken);
        const targetPath = joinVaultPath(baseDir, `${contact.fileName}.md`);
        if (!match) {
          if (settings.contactsEditOnly) {
            skipped.push({ name: contact.baseName, reason: "neu, aber \u201ENur bestehende aktualisieren\u201C ist aktiv" });
            continue;
          }
          actions.push({
            kind: "create",
            contact,
            targetPath,
            changes: buildChanges(contact, {}, ownedKeys, removableKeys),
            conflicts: []
          });
          continue;
        }
        taken.add(match.entry.file.path);
        const split = splitChanges(
          buildChanges(contact, match.entry.frontmatter, ownedKeys, removableKeys),
          match.entry.frontmatter
        );
        const rename = match.entry.file.path !== targetPath ? targetPath : null;
        if (split.changes.length === 0 && split.conflicts.length === 0 && !rename) continue;
        actions.push({
          kind: "update",
          contact,
          file: match.entry.file,
          via: match.via,
          targetPath,
          rename,
          changes: split.changes,
          conflicts: split.conflicts
        });
      }
      const orphans = index.notes.filter((entry) => !taken.has(entry.file.path) && !isInFolder(entry.file.path, trashDir));
      return { typ, baseDir, trashDir, contacts, actions, orphans, corrections, skipped, ownedKeys };
    }
    function formatValue(value) {
      if (value === void 0 || value === null || value === "") return "\u2014";
      return Array.isArray(value) ? value.join(", ") : String(value);
    }
    var ConflictModal = class extends Modal {
      constructor(app, action, resolve) {
        super(app);
        this.action = action;
        this.resolve = resolve;
        this.accepted = new Set(action.conflicts.map((c) => c.key));
        this.answered = false;
      }
      onOpen() {
        const { contentEl, action } = this;
        contentEl.addClass("fred-kontakt-conflict");
        contentEl.createEl("h3", { text: action.contact.baseName });
        contentEl.createEl("p", {
          cls: "setting-item-description",
          text: `${action.conflicts.length} abweichende ${action.conflicts.length === 1 ? "Property" : "Properties"}. Angehakt wird der CSV-Wert \xFCbernommen.`
        });
        for (const conflict of action.conflicts) {
          const isRemoval = conflict.to === void 0;
          new Setting(contentEl).setName(conflict.key + (isRemoval ? "  (in Google gel\xF6scht)" : "")).setDesc(
            isRemoval ? `Notiz: ${formatValue(conflict.from)}   \u2192   aus der Notiz entfernen` : `Notiz: ${formatValue(conflict.from)}   \u2192   CSV: ${formatValue(conflict.to)}`
          ).addToggle(
            (toggle) => toggle.setValue(true).onChange((value) => {
              if (value) this.accepted.add(conflict.key);
              else this.accepted.delete(conflict.key);
            })
          );
        }
        const footer = contentEl.createDiv({ cls: "modal-button-container fred-kontakt-conflict-buttons" });
        const button = (text, cta, onClick) => {
          const btn = new ButtonComponent(footer).setButtonText(text).onClick(onClick);
          if (cta) btn.setCta();
          return btn;
        };
        button("\xDCbernehmen", true, () => this.finish({ accepted: this.accepted }));
        button("Notiz behalten", false, () => this.finish({ accepted: /* @__PURE__ */ new Set() }));
        button("Rest: CSV", false, () => this.finish({ accepted: this.accepted, restMode: "csv" }));
        button("Rest: Notiz", false, () => this.finish({ accepted: /* @__PURE__ */ new Set(), restMode: "gaps" }));
      }
      finish(result) {
        this.answered = true;
        this.resolve(result);
        this.close();
      }
      onClose() {
        this.contentEl.empty();
        if (!this.answered) this.resolve({ accepted: /* @__PURE__ */ new Set() });
      }
    };
    function askConflicts(app, action) {
      return new Promise((resolve) => new ConflictModal(app, action, resolve).open());
    }
    async function resolveConflicts(plugin, actions) {
      let mode = plugin.settings.contactsConflictMode || "csv";
      for (const action of actions) {
        if (action.conflicts.length === 0) continue;
        if (mode === "csv") {
          action.changes.push(...action.conflicts);
        } else if (mode === "ask") {
          const { accepted, restMode } = await askConflicts(plugin.app, action);
          action.changes.push(...action.conflicts.filter((c) => accepted.has(c.key)));
          if (restMode) mode = restMode;
        }
        action.conflicts = [];
      }
    }
    function createProgress(plugin, total) {
      const el = plugin.addStatusBarItem();
      el.addClass("fred-kontakt-progress");
      const label = el.createSpan({ cls: "fred-kontakt-progress-label" });
      const cancelBtn = el.createEl("span", { cls: "fred-kontakt-progress-cancel", text: "Abbrechen" });
      const state = {
        cancelled: false,
        update(done, name) {
          const width = 12;
          const filled = total > 0 ? Math.round(width * done / total) : width;
          const bar = "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, width - filled));
          label.setText(`Kontakte ${bar} ${done}/${total}${name ? "  \xB7  " + name : ""}`);
        },
        finish() {
          el.remove();
        }
      };
      cancelBtn.addEventListener("click", () => {
        state.cancelled = true;
        cancelBtn.setText("wird abgebrochen \u2026");
      });
      state.update(0, "");
      return state;
    }
    function existingSubtyp(frontmatter) {
      const key = Object.keys(frontmatter).find((name) => name.toLowerCase() === "subtyp");
      const value = key === void 0 ? void 0 : frontmatter[key];
      return typeof value === "string" && value.trim() !== "" ? value : null;
    }
    async function writeFrontmatter(app, file, changes, typ) {
      const typSystem = getTypSystem(app);
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        const subtyp = existingSubtyp(frontmatter);
        if (typSystem?.applyTypeProperties) typSystem.applyTypeProperties(frontmatter, typ, subtyp);
        else frontmatter.TYP = typ;
        for (const change of changes) {
          if (change.to === void 0 || change.to === null || change.to === "") delete frontmatter[change.key];
          else frontmatter[change.key] = change.to;
        }
        typSystem?.sortFrontmatter?.(frontmatter, typ, subtyp);
      });
    }
    async function ensureFolder(app, path) {
      if (!path) return;
      if (!await app.vault.adapter.exists(path)) await app.vault.createFolder(path).catch(() => {
      });
    }
    async function applyPlan(plugin, plan, progress) {
      const { app } = plugin;
      const stats = { created: 0, updated: 0, renamed: 0, trashed: 0, errors: 0 };
      const total = plan.actions.length + plan.orphans.length;
      let done = 0;
      for (const action of plan.actions) {
        if (progress?.cancelled) break;
        done++;
        progress?.update(done, action.contact.baseName);
        try {
          if (action.kind === "create") {
            await ensureFolder(app, plan.baseDir);
            const file = await app.vault.create(action.targetPath, action.contact.body ? action.contact.body + "\n" : "");
            await writeFrontmatter(app, file, action.changes, plan.typ);
            stats.created++;
            continue;
          }
          if (action.changes.length > 0) {
            await writeFrontmatter(app, action.file, action.changes, plan.typ);
            stats.updated++;
          }
          if (action.rename) {
            await app.fileManager.renameFile(action.file, action.rename);
            stats.renamed++;
          }
        } catch (e) {
          stats.errors++;
          console.error("[Kontakt-Import] Fehler bei", action.contact.baseName, e);
        }
      }
      for (const orphan of plan.orphans) {
        if (progress?.cancelled) break;
        done++;
        progress?.update(done, orphan.file.basename);
        try {
          await ensureFolder(app, plan.trashDir);
          await app.fileManager.renameFile(orphan.file, joinVaultPath(plan.trashDir, orphan.file.name));
          stats.trashed++;
        } catch (e) {
          stats.errors++;
          console.error("[Kontakt-Import] Fehler beim Verschieben nach _Trash:", orphan.file.path, e);
        }
      }
      progress?.update(total, "");
      return stats;
    }
    function logGroup(title, lines) {
      if (lines.length === 0) return;
      console.groupCollapsed(`[Kontakt-Import] ${title}`);
      for (const line of lines) console.log(line);
      console.groupEnd();
    }
    function reportPlan(plan, stats, dryRun) {
      const byField = /* @__PURE__ */ new Map();
      for (const c of plan.corrections) {
        if (!byField.has(c.field)) byField.set(c.field, []);
        byField.get(c.field).push(c);
      }
      const breakdown = [...byField.entries()].map(([field, list]) => `${list.length}\xD7 ${field}`);
      logGroup(
        `${plan.corrections.length} Normalisierungen (${breakdown.join(", ")})`,
        [...byField.entries()].flatMap(([field, list]) => [
          `\u2500\u2500 ${field} (${list.length})`,
          ...list.map((c) => `   ${c.name}: "${c.from}" \u2192 "${c.to}"`)
        ])
      );
      logGroup(
        `${plan.skipped.length} \xFCbersprungen`,
        plan.skipped.map((s) => `${s.name}: ${s.reason}`)
      );
      const renames = plan.actions.filter((a) => a.rename);
      logGroup(
        `${renames.length} Umbenennungen`,
        renames.map((a) => `${a.file?.path ?? "(neu)"} \u2192 ${a.rename} (erkannt \xFCber ${a.via})`)
      );
      logGroup(
        `${plan.orphans.length} nicht mehr in der CSV`,
        plan.orphans.map((o) => o.file.path)
      );
      const cleared = plan.actions.flatMap(
        (a) => a.changes.filter((c) => c.to === void 0).map((c) => `${a.contact.baseName} \u2013 ${c.key}: "${formatValue(c.from)}" entfernt`)
      );
      logGroup(`${cleared.length} Properties geleert (in Google gel\xF6scht)`, cleared);
      const parts = [
        `${stats.created} neu`,
        `${stats.updated} aktualisiert`,
        `${stats.renamed} umbenannt`,
        `${stats.trashed} nach _Trash`
      ];
      if (cleared.length) parts.push(`${cleared.length} geleert`);
      if (plan.corrections.length) parts.push(`${plan.corrections.length} normalisiert`);
      if (plan.skipped.length) parts.push(`${plan.skipped.length} \xFCbersprungen`);
      if (stats.errors) parts.push(`${stats.errors} Fehler`);
      const summary = `${dryRun ? "[Probelauf] " : ""}Kontakt-Import: ${parts.join(", ")}. Details in der Konsole.`;
      console.log("[Kontakt-Import]", summary);
      new Notice(summary, 1e4);
    }
    async function importContactsFromCsv(plugin) {
      let plan;
      try {
        plan = await buildPlan(plugin);
      } catch (e) {
        new Notice(`Kontakt-Import: ${e.message}`);
        console.error("[Kontakt-Import]", e);
        return;
      }
      await resolveConflicts(plugin, plan.actions);
      if (plugin.settings.contactsDryRun) {
        reportPlan(
          plan,
          {
            created: plan.actions.filter((a) => a.kind === "create").length,
            updated: plan.actions.filter((a) => a.kind === "update" && a.changes.length > 0).length,
            renamed: plan.actions.filter((a) => a.rename).length,
            trashed: plan.orphans.length,
            errors: 0
          },
          true
        );
        return;
      }
      const progress = createProgress(plugin, plan.actions.length + plan.orphans.length);
      plugin.suspendPropertyBacklinks = true;
      let stats;
      try {
        stats = await applyPlan(plugin, plan, progress);
      } finally {
        plugin.suspendPropertyBacklinks = false;
        progress.finish();
      }
      if (progress.cancelled) new Notice("Kontakt-Import: abgebrochen.");
      reportPlan(plan, stats, false);
      await plugin.runPropertyBacklinkSync?.();
    }
    async function deleteUntouchedContacts(plugin) {
      const { app } = plugin;
      let plan;
      try {
        plan = await buildPlan(plugin);
      } catch (e) {
        new Notice(`Kontakt-Import: ${e.message}`);
        return;
      }
      const sollByPath = /* @__PURE__ */ new Map();
      for (const contact of plan.contacts) {
        sollByPath.set(joinVaultPath(plan.baseDir, `${contact.fileName}.md`).toLowerCase(), contact);
      }
      const index = buildNoteIndex(app, plan.baseDir, plan.typ);
      const candidates = [];
      for (const entry of index.notes) {
        if (isInFolder(entry.file.path, plan.trashDir)) continue;
        const contact = sollByPath.get(entry.file.path.toLowerCase());
        if (!contact) continue;
        const keys = Object.keys(entry.frontmatter).filter((key) => key !== "TYP");
        if (keys.some((key) => !plan.ownedKeys.has(key))) continue;
        if (keys.some((key) => !valuesEqual(entry.frontmatter[key], contact.data[key]))) continue;
        const raw = await app.vault.cachedRead(entry.file);
        const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
        if (body !== (contact.body || "").trim()) continue;
        candidates.push(entry.file);
      }
      if (plugin.settings.contactsDryRun) {
        logGroup(
          `Probelauf: ${candidates.length} unver\xE4ndert`,
          candidates.map((f) => f.path)
        );
        new Notice(`[Probelauf] ${index.notes.length} gepr\xFCft, ${candidates.length} unver\xE4ndert.`);
        return;
      }
      let deleted = 0;
      let errors = 0;
      for (const file of candidates) {
        try {
          await app.fileManager.trashFile(file);
          console.log(`[Kontakt-Import] Unver\xE4nderter Kontakt gel\xF6scht: ${file.path}`);
          deleted++;
        } catch (e) {
          errors++;
          console.error("[Kontakt-Import] Fehler beim L\xF6schen:", file.path, e);
        }
      }
      new Notice(
        `Kontakt-Import: ${index.notes.length} gepr\xFCft, ${deleted} unver\xE4nderte gel\xF6scht${errors ? `, ${errors} Fehler` : ""}.`
      );
    }
    module2.exports = { importContactsFromCsv, deleteUntouchedContacts };
    module2.exports.__test = { buildPlan, normalizePhone, normalizeStreet, normalizeCountry, normalizeBirthday };
  }
});

// src/property-sync.js
var require_property_sync = __commonJS({
  "src/property-sync.js"(exports2, module2) {
    var { TFile } = require("obsidian");
    function parseLinkText(entry) {
      const match = entry.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
      return match ? match[1] : entry;
    }
    function toArray(value) {
      if (Array.isArray(value)) return value;
      if (value === void 0 || value === null || value === "") return [];
      return [value];
    }
    function resolveLinkTargets(app, ownerFile, propertyValue) {
      const targets = [];
      for (const entry of toArray(propertyValue)) {
        if (typeof entry !== "string") continue;
        const dest = app.metadataCache.getFirstLinkpathDest(parseLinkText(entry), ownerFile.path);
        if (!dest) {
          console.warn(`[Property-Backlinking] Link konnte nicht aufgel\xF6st werden: "${entry}" in ${ownerFile.path}`);
          continue;
        }
        if (dest.path !== ownerFile.path) targets.push(dest);
      }
      return targets;
    }
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
    async function addLinkToProperty(app, propertyName, ownerFile, targetFile, typOrder) {
      await app.fileManager.processFrontMatter(ownerFile, (frontmatter) => {
        const current = toArray(frontmatter[propertyName]);
        const alreadyThere = resolveLinkTargets(app, ownerFile, current).some((f) => f.path === targetFile.path);
        if (alreadyThere) return;
        const isNew = !Object.prototype.hasOwnProperty.call(frontmatter, propertyName);
        const link = app.fileManager.generateMarkdownLink(targetFile, ownerFile.path);
        frontmatter[propertyName] = [...current, link];
        if (isNew && typOrder) app.plugins.plugins["typ-system"]?.placeProperty?.(frontmatter, propertyName);
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
    async function applyChanges(app, propertyNames, previousPairs, currentPairs, typOrder) {
      let added = 0;
      let removed = 0;
      for (const propertyName of propertyNames) {
        const sourcePaths = /* @__PURE__ */ new Set([
          ...Object.keys(previousPairs?.[propertyName] ?? {}),
          ...Object.keys(currentPairs?.[propertyName] ?? {})
        ]);
        for (const sourcePath of sourcePaths) {
          const prevTargets = getTargetSet(previousPairs, propertyName, sourcePath);
          const currTargets = getTargetSet(currentPairs, propertyName, sourcePath);
          for (const targetPath of currTargets) {
            if (prevTargets.has(targetPath)) continue;
            const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
            const targetFile = app.vault.getAbstractFileByPath(targetPath);
            if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) continue;
            await addLinkToProperty(app, propertyName, targetFile, sourceFile, typOrder);
            console.log(`[Property-Backlinking] "${propertyName}": ${targetFile.path} <- ${sourceFile.path} erg\xE4nzt`);
            added++;
          }
          for (const targetPath of prevTargets) {
            if (currTargets.has(targetPath)) continue;
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
    async function syncAllLinks(app, propertyNames, previousPairs, { typOrder = false } = {}) {
      const files = app.vault.getMarkdownFiles();
      console.log(`[Property-Backlinking] Pr\xFCfe ${files.length} Notizen f\xFCr Properties: ${propertyNames.join(", ")}`);
      const currentPairs = computeDeclaredPairs(app, propertyNames, files);
      const { added, removed } = await applyChanges(app, propertyNames, previousPairs, currentPairs, typOrder);
      return {
        checked: files.length,
        added,
        removed,
        declaredPairs: currentPairs
      };
    }
    function registerPropertyBacklinksLive2(plugin) {
      let running = false;
      let pending = false;
      const runSync = async () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        try {
          const result = await syncAllLinks(plugin.app, plugin.settings.reciprocalLinkProperties, plugin.settings.declaredLinkPairs, {
            typOrder: plugin.settings.propertyBacklinksTypOrder
          });
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
        if (plugin.suspendPropertyBacklinks) return;
        if (file.extension !== "md") return;
        runSync();
      };
      plugin.registerEvent(plugin.app.metadataCache.on("changed", onMetadataChanged));
      return runSync;
    }
    module2.exports = { syncAllLinks, registerPropertyBacklinksLive: registerPropertyBacklinksLive2 };
  }
});

// src/commands.js
var require_commands = __commonJS({
  "src/commands.js"(exports2, module2) {
    var { Notice } = require("obsidian");
    var { importContactsFromCsv, deleteUntouchedContacts } = require_kontakt_import();
    var { syncAllLinks } = require_property_sync();
    var { openImportantPluginSettingsPicker } = require_important_plugins();
    function registerCommands2(plugin) {
      plugin.addCommand({
        id: "kontakte-csv-import",
        name: "KONTAKTE - Kontakte aus CSV aktualisieren",
        callback: () => importContactsFromCsv(plugin)
      });
      plugin.addCommand({
        id: "kontakte-unveraendert-loeschen",
        name: "KONTAKTE - Unver\xE4nderte Kontakte l\xF6schen",
        callback: () => deleteUntouchedContacts(plugin)
      });
      plugin.addCommand({
        id: "property-sync",
        name: "Property-Backlinking - Aktualisieren",
        callback: async () => {
          const result = await syncAllLinks(plugin.app, plugin.settings.reciprocalLinkProperties, plugin.settings.declaredLinkPairs, {
            typOrder: plugin.settings.propertyBacklinksTypOrder
          });
          plugin.settings.declaredLinkPairs = result.declaredPairs;
          await plugin.saveSettings();
          new Notice(`Property-Backlinking: ${result.checked} Notizen gepr\xFCft, ${result.added} erg\xE4nzt, ${result.removed} entfernt.`);
        }
      });
      plugin.addCommand({
        id: "open-important-plugin-settings",
        name: "Open Important Plugin Settings (Picker)",
        callback: () => openImportantPluginSettingsPicker(plugin)
      });
      plugin.addCommand({
        id: "datenbank-ordner-oeffnen-schliessen",
        name: "Datenbank - Ordner \xF6ffnen/schlie\xDFen",
        callback: () => plugin.toggleDatabaseFolder?.()
      });
    }
    module2.exports = { registerCommands: registerCommands2 };
  }
});

// src/database-folders.js
var require_database_folders = __commonJS({
  "src/database-folders.js"(exports2, module2) {
    var { TFile, TFolder, FuzzySuggestModal, Notice } = require("obsidian");
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
    var DatabaseFolderPickerModal = class extends FuzzySuggestModal {
      constructor(app, folders, manuallyOpenPaths, resolve) {
        super(app);
        this.folders = folders;
        this.manuallyOpenPaths = manuallyOpenPaths;
        this.resolve = resolve;
        this.chosen = false;
        this.setPlaceholder("Datenbank-Ordner zum \xD6ffnen/Schlie\xDFen w\xE4hlen - ESC f\xFCr Abbruch");
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
        const state = el.createSpan({ text: isOpen ? "ge\xF6ffnet" : "geschlossen" });
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
    };
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
        const dbFolder = filePath ? findDatabaseAncestorFolder(plugin.app, filePath, plugin.settings.databaseFolderPrefix) : null;
        if (!dbFolder) return original();
        return view.revealInFolder(dbFolder);
      };
      patchedViews.add(view);
    }
    function patchFolderItem(plugin, item, manuallyOpenPaths, patchedItems) {
      if (!item || typeof item.setCollapsed !== "function") return;
      if (item.__fredSetCollapsedOriginal) {
        patchedItems.add(item);
        return;
      }
      const original = item.setCollapsed.bind(item);
      item.__fredSetCollapsedOriginal = original;
      item.setCollapsed = (collapsed, instant) => {
        const path2 = item.file?.path;
        const isDbFolder = plugin.settings.databaseFoldersEnabled && isDatabasePath(path2, plugin.settings.databaseFolderPrefix);
        if (isDbFolder && !collapsed && !manuallyOpenPaths.has(path2)) {
          return Promise.resolve();
        }
        return original(collapsed, instant);
      };
      patchedItems.add(item);
      const path = item.file?.path;
      if (plugin.settings.databaseFoldersEnabled && isDatabasePath(path, plugin.settings.databaseFolderPrefix) && !manuallyOpenPaths.has(path) && item.collapsed !== true) {
        original(true, true);
      }
    }
    function registerDatabaseFolders2(plugin) {
      const styleEl = document.createElement("style");
      styleEl.id = "fred-database-folders-style";
      document.head.appendChild(styleEl);
      const watchedFolders = /* @__PURE__ */ new Map();
      const patchedItems = /* @__PURE__ */ new Set();
      const patchedViews = /* @__PURE__ */ new Set();
      const containerObservers = /* @__PURE__ */ new Map();
      let refreshScheduled = false;
      const manuallyOpenPaths = /* @__PURE__ */ new Set();
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
          for (const path in view.fileItems ?? {}) {
            if (!isDatabasePath(path, prefix)) continue;
            patchFolderItem(plugin, view.fileItems[path], manuallyOpenPaths, patchedItems);
          }
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
      const onVaultFolderChange = (file) => {
        if (!plugin.settings.databaseFoldersEnabled) return;
        if (file instanceof TFolder) refreshWatchedFolders();
      };
      plugin.registerEvent(plugin.app.vault.on("create", onVaultFolderChange));
      plugin.registerEvent(plugin.app.vault.on("rename", onVaultFolderChange));
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
              button: evt.button
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
        styleEl.textContent = plugin.settings.databaseFoldersEnabled ? buildStyle(
          plugin.settings.databaseFolderPrefix,
          plugin.settings.folderNoteClickExtensionEnabled,
          plugin.settings.databaseFolderCountAtEnd
        ) : "";
        refreshWatchedFolders();
      };
      const setFolderOpen = (path, open) => {
        if (open) manuallyOpenPaths.add(path);
        else manuallyOpenPaths.delete(path);
        const view = plugin.app.workspace.getLeavesOfType("file-explorer")[0]?.view;
        view?.fileItems?.[path]?.setCollapsed(!open, true);
      };
      const revealDatabaseFolder = (folder) => {
        const leaf = plugin.app.workspace.getLeavesOfType("file-explorer")[0];
        leaf?.view?.revealInFolder?.(folder);
      };
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
    module2.exports = { registerDatabaseFolders: registerDatabaseFolders2 };
  }
});

// src/nested-checkboxes.js
var require_nested_checkboxes = __commonJS({
  "src/nested-checkboxes.js"(exports2, module2) {
    var { TFile } = require("obsidian");
    var CHECKBOX_LINE_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[(.)\]/;
    function parseCheckboxLine(line) {
      const match = line.match(CHECKBOX_LINE_RE);
      return match ? { indent: match[1].length, char: match[2] } : null;
    }
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
    function computeCascade(lines, toggledIndex) {
      const toggled = parseCheckboxLine(lines[toggledIndex]);
      if (!toggled) return null;
      const result = lines.slice();
      let touched = false;
      const nowChecked = isChecked(toggled.char);
      const newChar = nowChecked ? "x" : " ";
      for (let i = toggledIndex + 1; i < result.length; i++) {
        const ind = indentOf(result[i]);
        if (ind !== null && ind <= toggled.indent) break;
        const parsed = parseCheckboxLine(result[i]);
        if (parsed && isChecked(parsed.char) !== nowChecked) {
          result[i] = setCheckboxChar(result[i], newChar);
          touched = true;
        }
      }
      let childIndent = toggled.indent;
      let cursor = toggledIndex;
      for (; ; ) {
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
        if (!parent) break;
        let directChildIndent = null;
        let hasCheckboxChild = false;
        let allChecked = true;
        for (let i = parentIndex + 1; i < result.length; i++) {
          const ind = indentOf(result[i]);
          if (ind === null) continue;
          if (ind <= parent.indent) break;
          if (directChildIndent === null) directChildIndent = ind;
          if (ind !== directChildIndent) continue;
          const parsed = parseCheckboxLine(result[i]);
          if (!parsed) continue;
          hasCheckboxChild = true;
          if (!isChecked(parsed.char)) allChecked = false;
        }
        if (!hasCheckboxChild) break;
        if (isChecked(parent.char) === allChecked) break;
        result[parentIndex] = setCheckboxChar(result[parentIndex], allChecked ? "x" : " ");
        touched = true;
        childIndent = parent.indent;
        cursor = parentIndex;
      }
      return touched ? result : null;
    }
    function detectToggle(prevText, newText) {
      if (prevText === void 0 || prevText === newText) return -1;
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
    function isFileOpen(plugin, path) {
      return plugin.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view?.file?.path === path);
    }
    function registerNestedCheckboxSync2(plugin) {
      const lastContent = /* @__PURE__ */ new Map();
      const applying = /* @__PURE__ */ new Set();
      const forget = (path) => {
        lastContent.delete(path);
        applying.delete(path);
      };
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
        if (!isFileOpen(plugin, file.path)) return;
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
    module2.exports = { registerNestedCheckboxSync: registerNestedCheckboxSync2, computeCascade, parseCheckboxLine };
  }
});

// src/italic-underscore.js
var require_italic_underscore = __commonJS({
  "src/italic-underscore.js"(exports2, module2) {
    var COMMAND_ID = "editor:toggle-italics";
    function dropSpuriousBoldStarRemovals(doc, changes) {
      let changed = false;
      const kept = changes.filter((change) => {
        if (change.insert !== "" || change.to - change.from !== 1) return true;
        if (doc.sliceString(change.from, change.to) !== "*") return true;
        const before = change.from > 0 ? doc.sliceString(change.from - 1, change.from) : "";
        const after = change.to < doc.length ? doc.sliceString(change.to, change.to + 1) : "";
        if (before !== "*" && after !== "*") return true;
        changed = true;
        return false;
      });
      return changed ? kept : changes;
    }
    function registerItalicUnderscore2(plugin) {
      const patch = () => {
        const cmd = plugin.app.commands.commands[COMMAND_ID];
        if (!cmd || cmd.__fredItalicPatched) return;
        cmd.__fredItalicPatched = true;
        const original = cmd.editorCallback;
        cmd.editorCallback = function(editor, ctx) {
          if (!plugin.settings.italicUnderscoreEnabled) return original.call(this, editor, ctx);
          const cm = editor.cm;
          const originalDispatch = cm.dispatch.bind(cm);
          cm.dispatch = function(spec) {
            if (spec && Array.isArray(spec.changes)) {
              const doc = cm.state.doc;
              for (const change of spec.changes) {
                if (change.insert === "*") change.insert = "_";
              }
              const repaired = dropSpuriousBoldStarRemovals(doc, spec.changes);
              if (repaired !== spec.changes) {
                const { selection, ...rest } = spec;
                spec = { ...rest, changes: repaired };
              }
            }
            return originalDispatch(spec);
          };
          try {
            return original.call(this, editor, ctx);
          } finally {
            cm.dispatch = originalDispatch;
          }
        };
        plugin.register(() => {
          cmd.editorCallback = original;
          delete cmd.__fredItalicPatched;
        });
      };
      plugin.app.workspace.onLayoutReady(patch);
    }
    module2.exports = { registerItalicUnderscore: registerItalicUnderscore2 };
  }
});

// src/bases-has-note.js
var require_bases_has_note = __commonJS({
  "src/bases-has-note.js"(exports2, module2) {
    var { FileValue, BasesEntry, BooleanValue } = require("obsidian");
    var PROPERTY_NAME = "hasNote";
    var PROPERTY_KEY = PROPERTY_NAME.toLowerCase();
    var PROPERTY_ID = "file." + PROPERTY_NAME;
    function hasNoteContent2(app, fileOrPath) {
      const file = typeof fileOrPath === "string" ? app.vault.getFileByPath(fileOrPath) : fileOrPath;
      if (!file?.stat) return false;
      if (file.extension !== "md") return file.stat.size > 0;
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) return file.stat.size > 0;
      const sections = cache.sections;
      if (!sections || sections.length === 0) return false;
      return sections.some((section) => section.type !== "yaml");
    }
    function install() {
      if (!FileValue?.prototype || !BooleanValue) {
        console.warn('[Fred] Bases-Property "file.hasNote": FileValue/BooleanValue nicht verf\xFCgbar, \xFCbersprungen.');
        return null;
      }
      const originalObjectAccess = FileValue.prototype.objectAccess;
      const originalKeys = FileValue.prototype.keys;
      FileValue.prototype.objectAccess = function(name) {
        if (typeof name === "string" && name.toLowerCase() === PROPERTY_KEY) {
          return new BooleanValue(hasNoteContent2(this.app, this.file));
        }
        return originalObjectAccess.call(this, name);
      };
      FileValue.prototype.keys = function() {
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
    function registerBasesHasNote2(plugin) {
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
    module2.exports = { registerBasesHasNote: registerBasesHasNote2, hasNoteContent: hasNoteContent2, PROPERTY_ID };
  }
});

// src/style-settings-filter.js
var require_style_settings_filter = __commonJS({
  "src/style-settings-filter.js"(exports2, module2) {
    var { Notice } = require("obsidian");
    var STYLE_SETTINGS_ID = "obsidian-style-settings";
    var TYPE_HEADING = "heading";
    var TYPE_INFO_TEXT = "info-text";
    var TYPE_COLOR = "variable-color";
    var TYPE_THEMED_COLOR = "variable-themed-color";
    var BUTTON_CLASS = "fred-style-settings-modified";
    var BUTTON_LABEL = "Modified";
    var BUTTON_TOOLTIP = "Nur Einstellungen zeigen, die vom Standard abweichen";
    var colorProbe = null;
    function normalizeColor(value) {
      if (!colorProbe) colorProbe = document.createElement("span");
      colorProbe.style.color = "";
      colorProbe.style.color = value;
      return colorProbe.style.color || null;
    }
    function valuesEqual(value, fallback, isColor) {
      if (typeof value === "boolean" || typeof fallback === "boolean") return !!value === !!fallback;
      const a = value === void 0 || value === null ? "" : String(value).trim();
      const b = fallback === void 0 || fallback === null ? "" : String(fallback).trim();
      if (a === b) return true;
      if ((a === "" || a === "none") && (b === "" || b === "none")) return true;
      if (isColor) {
        const normA = normalizeColor(a);
        const normB = normalizeColor(b);
        if (normA && normB) return normA === normB;
      }
      const numA = Number(a);
      const numB = Number(b);
      if (a !== "" && b !== "" && !Number.isNaN(numA) && !Number.isNaN(numB)) return numA === numB;
      return a.toLowerCase() === b.toLowerCase();
    }
    function defaultValueOf(component, manager) {
      const setting = component.setting;
      if (setting.type === TYPE_COLOR && typeof setting.default !== "string") {
        try {
          return manager.plugin.getCSSVar(setting.id)?.current?.trim();
        } catch (error) {
          return void 0;
        }
      }
      return setting.default;
    }
    function isModified(component, manager) {
      const setting = component.setting;
      const type = setting?.type;
      if (!type || type === TYPE_HEADING || type === TYPE_INFO_TEXT) return false;
      if (type === TYPE_THEMED_COLOR) {
        return ["light", "dark"].some((scheme) => {
          const stored2 = manager.getSetting(component.sectionId, setting.id + "@@" + scheme);
          return stored2 !== void 0 && !valuesEqual(stored2, setting["default-" + scheme], true);
        });
      }
      const stored = manager.getSetting(component.sectionId, setting.id);
      if (stored === void 0) return false;
      return !valuesEqual(stored, defaultValueOf(component, manager), type === TYPE_COLOR);
    }
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
        clearModifiedFilter(markup);
        return;
      }
      const search = findSearchInput(markup);
      if (search) search.value = "";
      markup.filterString = "";
      setFilterActive(markup, link, true);
      const count = applyModifiedFilter(markup, manager);
      if (count === 0) new Notice("Keine Style Settings weichen vom Standard ab.");
    }
    function injectButton(markup, manager) {
      const container = markup.containerEl;
      const importEl = container?.querySelector(".style-settings-import");
      if (!importEl) return;
      const row = importEl.parentElement;
      if (!row || row.querySelector("." + BUTTON_CLASS)) return;
      const link = row.ownerDocument.createElement("a");
      link.className = BUTTON_CLASS;
      link.href = "#";
      link.textContent = BUTTON_LABEL;
      link.setAttribute("aria-label", BUTTON_TOOLTIP);
      row.insertBefore(link, importEl);
      markup.fredModifiedFilterActive = false;
      link.addEventListener("click", (evt) => {
        evt.preventDefault();
        toggleFilter(markup, link, manager);
      });
      findSearchInput(markup)?.addEventListener("input", () => {
        if (markup.fredModifiedFilterActive) setFilterActive(markup, link, false);
      });
    }
    function attachToMarkup(tab, manager) {
      const markup = tab.settingsMarkup;
      if (!markup) return;
      if (!markup.fredOriginalGenerate) {
        const original = markup.generate;
        markup.fredOriginalGenerate = original;
        markup.generate = function(...args) {
          const result = original.apply(this, args);
          try {
            injectButton(this, manager);
          } catch (error) {
            console.error("[Fred] Style-Settings-Filter: Knopf konnte nicht eingef\xFCgt werden", error);
          }
          return result;
        };
      }
      injectButton(markup, manager);
    }
    function install(plugin) {
      const setting = plugin.app.setting;
      if (typeof setting?.openTab !== "function") {
        console.warn("[Fred] Style-Settings-Filter: app.setting.openTab nicht verf\xFCgbar, \xFCbersprungen.");
        return null;
      }
      const originalOpenTab = setting.openTab;
      let patchedTab = null;
      const patchedOpenTab = function(tab) {
        const result = originalOpenTab.call(this, tab);
        try {
          if (tab?.id === STYLE_SETTINGS_ID) {
            const manager = plugin.app.plugins.plugins[STYLE_SETTINGS_ID]?.settingsManager;
            if (manager) {
              if (!patchedTab) {
                patchedTab = tab;
                const originalDisplay = tab.display;
                tab.fredOriginalDisplay = originalDisplay;
                tab.display = function(...args) {
                  const displayed = originalDisplay.apply(this, args);
                  try {
                    attachToMarkup(this, manager);
                  } catch (error) {
                    console.error("[Fred] Style-Settings-Filter: Einh\xE4ngen fehlgeschlagen", error);
                  }
                  return displayed;
                };
              }
              attachToMarkup(tab, manager);
            }
          }
        } catch (error) {
          console.error("[Fred] Style-Settings-Filter: Einh\xE4ngen fehlgeschlagen", error);
        }
        return result;
      };
      setting.openTab = patchedOpenTab;
      return () => {
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
    function registerStyleSettingsFilter2(plugin) {
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
    module2.exports = { registerStyleSettingsFilter: registerStyleSettingsFilter2 };
  }
});

// src/main.js
var { Plugin } = require("obsidian");
var { DEFAULT_SETTINGS, FredSettingTab } = require_settings();
var { registerCommands } = require_commands();
var { registerDatabaseFolders } = require_database_folders();
var { registerPropertyBacklinksLive } = require_property_sync();
var { registerNestedCheckboxSync } = require_nested_checkboxes();
var { registerImportantPlugins } = require_important_plugins();
var { registerItalicUnderscore } = require_italic_underscore();
var { registerBasesHasNote, hasNoteContent } = require_bases_has_note();
var { registerStyleSettingsFilter } = require_style_settings_filter();
module.exports = class FredPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.addSettingTab(new FredSettingTab(this.app, this));
    this.updateDatabaseFolderStyle = registerDatabaseFolders(this);
    this.runPropertyBacklinkSync = registerPropertyBacklinksLive(this);
    registerNestedCheckboxSync(this);
    this.refreshImportantPluginCommands = registerImportantPlugins(this);
    registerItalicUnderscore(this);
    this.updateBasesHasNote = registerBasesHasNote(this);
    this.updateStyleSettingsFilter = registerStyleSettingsFilter(this);
    this.hasNoteContent = (fileOrPath) => hasNoteContent(this.app, fileOrPath);
  }
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL2ltcG9ydGFudC1wbHVnaW5zLmpzIiwgInNyYy9zZXR0aW5ncy5qcyIsICJzcmMva29udGFrdC1pbXBvcnQuanMiLCAic3JjL3Byb3BlcnR5LXN5bmMuanMiLCAic3JjL2NvbW1hbmRzLmpzIiwgInNyYy9kYXRhYmFzZS1mb2xkZXJzLmpzIiwgInNyYy9uZXN0ZWQtY2hlY2tib3hlcy5qcyIsICJzcmMvaXRhbGljLXVuZGVyc2NvcmUuanMiLCAic3JjL2Jhc2VzLWhhcy1ub3RlLmpzIiwgInNyYy9zdHlsZS1zZXR0aW5ncy1maWx0ZXIuanMiLCAic3JjL21haW4uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IHsgRnV6enlTdWdnZXN0TW9kYWwsIE5vdGljZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vLyBHZW5lcmlzY2hlciBQaWNrZXI6IHdcdTAwRTRobHQgYXVzIGVpbmVyIE1hbmlmZXN0LUxpc3RlIGVpbnMgYXVzLCBsXHUwMEY2c3QgbWl0XG4vLyBkZXNzZW4gSUQgb2RlciBudWxsIChBYmJydWNoKSBhdWYgLSBnZW51dHp0IHNvd29obCB6dW0gSGluenVmXHUwMEZDZ2VuIGVpbmVzXG4vLyBQbHVnaW5zIGluIGRlbiBFaW5zdGVsbHVuZ2VuIChzZXR0aW5ncy5qcykgYWxzIGF1Y2ggdm9tIFNhbW1lbGJlZmVobCB1bnRlbi5cbi8vIEdsZWljaGVyIEF1ZmJhdSB3aWUgVHlwUGlja2VyTW9kYWwgKHR5cGUtcGlja2VyLmpzKSwgaW5rbC4gZGVzc2VsYmVuXG4vLyBzZWxlY3RTdWdnZXN0aW9uKCkvb25DaG9vc2VJdGVtKCktS29tbWVudGFycyBkb3J0OiBPYnNpZGlhbnMgU3VnZ2VzdE1vZGFsXG4vLyBydWZ0IGludGVybiBlcnN0IGNsb3NlKCkgdW5kIGRhbmFjaCBlcnN0IG9uQ2hvb3NlSXRlbSgpIGF1ZiAtIFwiY2hvc2VuXCJcbi8vIG11c3MgZGVzaGFsYiBzY2hvbiBpbiBzZWxlY3RTdWdnZXN0aW9uKCkgZ2VzZXR6dCB3ZXJkZW4sIHNvbnN0IGxcdTAwRjZzdCBkYXMgdm9uXG4vLyBjbG9zZSgpIGF1c2dlbFx1MDBGNnN0ZSBvbkNsb3NlKCkgZGFzIFByb21pc2UgZlx1MDBFNGxzY2hsaWNoIHp1ZXJzdCBtaXQgbnVsbCBhdWYuXG5jbGFzcyBQbHVnaW5QaWNrZXJNb2RhbCBleHRlbmRzIEZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCBtYW5pZmVzdHMsIHJlc29sdmUpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMubWFuaWZlc3RzID0gbWFuaWZlc3RzO1xuICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgdGhpcy5jaG9zZW4gPSBmYWxzZTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiRVNDIGZcdTAwRkNyIEFiYnJ1Y2hcIik7XG4gIH1cblxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5tYW5pZmVzdHM7XG4gIH1cblxuICBnZXRJdGVtVGV4dChtYW5pZmVzdCkge1xuICAgIHJldHVybiBtYW5pZmVzdC5uYW1lO1xuICB9XG5cbiAgc2VsZWN0U3VnZ2VzdGlvbihpdGVtLCBldnQpIHtcbiAgICB0aGlzLmNob3NlbiA9IHRydWU7XG4gICAgc3VwZXIuc2VsZWN0U3VnZ2VzdGlvbihpdGVtLCBldnQpO1xuICB9XG5cbiAgb25DaG9vc2VJdGVtKG1hbmlmZXN0KSB7XG4gICAgdGhpcy5yZXNvbHZlKG1hbmlmZXN0LmlkKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKSB7XG4gICAgc3VwZXIub25DbG9zZSgpO1xuICAgIGlmICghdGhpcy5jaG9zZW4pIHRoaXMucmVzb2x2ZShudWxsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0VuYWJsZWQoYXBwLCBpZCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFwcC5wbHVnaW5zLnBsdWdpbnMsIGlkKTtcbn1cblxuLy8gQWxzIFwid2ljaHRpZ1wiIG1hcmtpZXJ0ZSBQbHVnaW5zIChzZXR0aW5ncy5qcywgR2VuZXJlbGwgLT4gSW1wb3J0YW50IFBsdWdpblxuLy8gU2V0dGluZ3MpLCBnZWZpbHRlcnQgYXVmIGFrdHVlbGwgYWt0aXZpZXJ0ZSAtIEdydW5kbGFnZSBzb3dvaGwgZlx1MDBGQ3IgZGllXG4vLyBFaW56ZWxiZWZlaGxlIGFscyBhdWNoIGRlbiBTYW1tZWxiZWZlaGwuIEVpbiBkZWFrdGl2aWVydGVzIFBsdWdpbiBoYXQga2VpbmVcbi8vIG9mZmVuZSBTZXR0aW5ncy1UYWIgKE9ic2lkaWFuIGVudGxcdTAwRTRkdCBzaWUgbWl0IGRlbSBQbHVnaW4pLCBlaW4gQmVmZWhsIGRhZlx1MDBGQ3Jcbi8vIHdcdTAwRTRyZSBhbHNvIG9obmVoaW4gd2lya3VuZ3Nsb3MuXG5mdW5jdGlvbiBlbmFibGVkSW1wb3J0YW50TWFuaWZlc3RzKHBsdWdpbikge1xuICByZXR1cm4gcGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnNcbiAgICAuZmlsdGVyKChpZCkgPT4gaXNFbmFibGVkKHBsdWdpbi5hcHAsIGlkKSlcbiAgICAubWFwKChpZCkgPT4gcGx1Z2luLmFwcC5wbHVnaW5zLm1hbmlmZXN0c1tpZF0pXG4gICAgLmZpbHRlcihCb29sZWFuKTtcbn1cblxuZnVuY3Rpb24gb3BlblBsdWdpblNldHRpbmdzKGFwcCwgaWQpIHtcbiAgYXBwLnNldHRpbmcub3BlbigpO1xuICBpZiAoIWFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKGlkKSkgbmV3IE5vdGljZShcIkRpZXNlcyBQbHVnaW4gaGF0IGtlaW5lIGVpZ2VuZW4gRWluc3RlbGx1bmdlbi5cIik7XG59XG5cbi8vIFNhbW1lbGJlZmVobCBcIldpY2h0aWdlcyBQbHVnaW4gLSBFaW5zdGVsbHVuZ2VuIFx1MDBGNmZmbmVuXCI6IGJlaSBnZW5hdSBlaW5lbVxuLy8gbWFya2llcnRlbiAoYWt0aXZpZXJ0ZW4pIFBsdWdpbiBvaG5lIFp3aXNjaGVuc2Nocml0dCwgc29uc3QgXHUwMEZDYmVyIGRlbnNlbGJlblxuLy8gUGlja2VyIHdpZSBiZWltIEhpbnp1Zlx1MDBGQ2dlbiBpbiBkZW4gRWluc3RlbGx1bmdlbi4gRXJnXHUwMEU0bnp0IGRpZSBFaW56ZWxiZWZlaGxlXG4vLyB1bnRlbiwgZXJzZXR6dCBzaWUgbmljaHQgLSBwcmFrdGlzY2gsIHdlbm4gbWFuIGRlbiBOYW1lbiBkZXMgRWluemVsYmVmZWhsc1xuLy8gbmljaHQgaW0gS29wZiBoYXQuXG5hc3luYyBmdW5jdGlvbiBvcGVuSW1wb3J0YW50UGx1Z2luU2V0dGluZ3NQaWNrZXIocGx1Z2luKSB7XG4gIGNvbnN0IG1hbmlmZXN0cyA9IGVuYWJsZWRJbXBvcnRhbnRNYW5pZmVzdHMocGx1Z2luKTtcblxuICBpZiAobWFuaWZlc3RzLmxlbmd0aCA9PT0gMCkge1xuICAgIG5ldyBOb3RpY2UoJ0tlaW5lIHdpY2h0aWdlbiBQbHVnaW5zIGVpbmdldHJhZ2VuIChFaW5zdGVsbHVuZ2VuIC0+IEdlbmVyZWxsIC0+IFwiSW1wb3J0YW50IFBsdWdpbiBTZXR0aW5nc1wiKS4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG1hbmlmZXN0cy5sZW5ndGggPT09IDEpIHtcbiAgICBvcGVuUGx1Z2luU2V0dGluZ3MocGx1Z2luLmFwcCwgbWFuaWZlc3RzWzBdLmlkKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBpZCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBuZXcgUGx1Z2luUGlja2VyTW9kYWwocGx1Z2luLmFwcCwgbWFuaWZlc3RzLCByZXNvbHZlKS5vcGVuKCkpO1xuICBpZiAoaWQpIG9wZW5QbHVnaW5TZXR0aW5ncyhwbHVnaW4uYXBwLCBpZCk7XG59XG5cbi8vIEVpbiBlaWdlbmVyIEJlZmVobCBqZSBtYXJraWVydGVtIChha3RpdmllcnRlbSkgUGx1Z2luLiBPYnNpZGlhbnMgQ29tbWFuZHMtXG4vLyBSZWdpc3RyeSBlcmxhdWJ0IGFkZENvbW1hbmQoKS9yZW1vdmVDb21tYW5kKCkgamVkZXJ6ZWl0LCBuaWNodCBudXIgYmVpbVxuLy8gUGx1Z2luLVN0YXJ0IC0gaGllciBkZXNoYWxiIGJlaSBqZWRlciBcdTAwQzRuZGVydW5nIGRlciBMaXN0ZSAoRWluc3RlbGx1bmdlbilcbi8vIHNvd2llIGJlaSBqZWRlciBQbHVnaW4tQWt0aXZpZXJ1bmcvLURlYWt0aXZpZXJ1bmcgbmV1IG1pdCBkZW0gSXN0LVp1c3RhbmRcbi8vIGFiZ2VnbGljaGVuLCBzdGF0dCBkaWUgQmVmZWhsZSBlaW5tYWxpZyBmaXggenUgcmVnaXN0cmllcmVuLlxuY29uc3QgcmVnaXN0ZXJlZENvbW1hbmRJZHMgPSBuZXcgU2V0KCk7XG5cbmZ1bmN0aW9uIGNvbW1hbmRJZEZvcihwbHVnaW5JZCkge1xuICByZXR1cm4gYG9wZW4tJHtwbHVnaW5JZH0tc2V0dGluZ3NgO1xufVxuXG5mdW5jdGlvbiByZWZyZXNoUGVyUGx1Z2luQ29tbWFuZHMocGx1Z2luKSB7XG4gIGNvbnN0IGRlc2lyZWQgPSBuZXcgTWFwKGVuYWJsZWRJbXBvcnRhbnRNYW5pZmVzdHMocGx1Z2luKS5tYXAoKG1hbmlmZXN0KSA9PiBbY29tbWFuZElkRm9yKG1hbmlmZXN0LmlkKSwgbWFuaWZlc3RdKSk7XG5cbiAgZm9yIChjb25zdCBpZCBvZiByZWdpc3RlcmVkQ29tbWFuZElkcykge1xuICAgIGlmIChkZXNpcmVkLmhhcyhpZCkpIGNvbnRpbnVlO1xuICAgIHBsdWdpbi5hcHAuY29tbWFuZHMucmVtb3ZlQ29tbWFuZChgJHtwbHVnaW4ubWFuaWZlc3QuaWR9OiR7aWR9YCk7XG4gICAgcmVnaXN0ZXJlZENvbW1hbmRJZHMuZGVsZXRlKGlkKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgW2lkLCBtYW5pZmVzdF0gb2YgZGVzaXJlZCkge1xuICAgIGlmIChyZWdpc3RlcmVkQ29tbWFuZElkcy5oYXMoaWQpKSBjb250aW51ZTtcbiAgICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZCxcbiAgICAgIG5hbWU6IGBPcGVuICR7bWFuaWZlc3QubmFtZX0gU2V0dGluZ3NgLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IG9wZW5QbHVnaW5TZXR0aW5ncyhwbHVnaW4uYXBwLCBtYW5pZmVzdC5pZCksXG4gICAgfSk7XG4gICAgcmVnaXN0ZXJlZENvbW1hbmRJZHMuYWRkKGlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3RlckltcG9ydGFudFBsdWdpbnMocGx1Z2luKSB7XG4gIGNvbnN0IHJlZnJlc2ggPSAoKSA9PiByZWZyZXNoUGVyUGx1Z2luQ29tbWFuZHMocGx1Z2luKTtcblxuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnBsdWdpbnMub24oXCJjaGFuZ2VkXCIsIHJlZnJlc2gpKTtcbiAgcGx1Z2luLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeShyZWZyZXNoKTtcblxuICByZXR1cm4gcmVmcmVzaDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVySW1wb3J0YW50UGx1Z2lucywgb3BlbkltcG9ydGFudFBsdWdpblNldHRpbmdzUGlja2VyLCBQbHVnaW5QaWNrZXJNb2RhbCwgZW5hYmxlZEltcG9ydGFudE1hbmlmZXN0cyB9O1xuIiwgImNvbnN0IHsgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZ0dyb3VwLCBOb3RpY2UsIHNldEljb24gfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcbmNvbnN0IHsgUGx1Z2luUGlja2VyTW9kYWwgfSA9IHJlcXVpcmUoXCIuL2ltcG9ydGFudC1wbHVnaW5zXCIpO1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTID0ge1xuICBjb250YWN0c0NzdlBhdGg6IFwiX29ic2lkaWFuL2RhdGEvY29udGFjdHMuY3N2XCIsXG4gIGNvbnRhY3RzQmFzZURpcjogXCJ+S29udGFrdGVcIixcbiAgY29udGFjdHNUeXA6IFwiS09OVEFLVFwiLFxuICBjb250YWN0c1RyYXNoU3ViZGlyOiBcIl9UcmFzaFwiLFxuICBjb250YWN0c0VkaXRPbmx5OiBmYWxzZSxcbiAgY29udGFjdHNGaWx0ZXJSZWxldmFudDogdHJ1ZSxcbiAgY29udGFjdHNOb3JtYWxpemVFbmFibGVkOiB0cnVlLFxuICAvLyBcImNzdlwiID0gQ1NWIGdld2lubnQsIFwiZ2Fwc1wiID0gbnVyIGxlZXJlIFByb3BlcnRpZXMgZlx1MDBGQ2xsZW4sXG4gIC8vIFwiYXNrXCIgPSBqZSBiZXRyb2ZmZW5lbSBLb250YWt0IGVpbiBEaWFsb2cuXG4gIGNvbnRhY3RzQ29uZmxpY3RNb2RlOiBcImNzdlwiLFxuICBjb250YWN0c0RyeVJ1bjogZmFsc2UsXG4gIGRhdGFiYXNlRm9sZGVyc0VuYWJsZWQ6IHRydWUsXG4gIGRhdGFiYXNlRm9sZGVyUHJlZml4OiBcIn5cIixcbiAgZm9sZGVyTm90ZUNsaWNrRXh0ZW5zaW9uRW5hYmxlZDogdHJ1ZSxcbiAgZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kOiBmYWxzZSxcbiAgcmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzOiBbXCJGYW1pbGllXCJdLFxuICBwcm9wZXJ0eUJhY2tsaW5rc0xpdmVFbmFibGVkOiB0cnVlLFxuICBwcm9wZXJ0eUJhY2tsaW5rc1R5cE9yZGVyOiB0cnVlLFxuICBuZXN0ZWRDaGVja2JveFN5bmNFbmFibGVkOiBmYWxzZSxcbiAgaXRhbGljVW5kZXJzY29yZUVuYWJsZWQ6IGZhbHNlLFxuICBiYXNlc0hhc05vdGVFbmFibGVkOiB0cnVlLFxuICBzdHlsZVNldHRpbmdzTW9kaWZpZWRGaWx0ZXJFbmFibGVkOiB0cnVlLFxuICBkZWNsYXJlZExpbmtQYWlyczoge30sXG4gIC8vIFNpZWhlIGltcG9ydGFudC1wbHVnaW5zLmpzOiBha3RpdmllcnRlIFBsdWdpbi1JRHMsIGZcdTAwRkNyIGRpZSBhdXRvbWF0aXNjaFxuICAvLyBqZSBlaW4gZWlnZW5lciBcIkVpbnN0ZWxsdW5nZW4gXHUwMEY2ZmZuZW5cIi1CZWZlaGwgZW50c3RlaHQuXG4gIGltcG9ydGFudFBsdWdpbnM6IFtdLFxufTtcblxuY29uc3QgVEFCUyA9IFtcbiAgeyBpZDogXCJnZW5lcmFsXCIsIGxhYmVsOiBcIkdlbmVyZWxsXCIgfSxcbiAgeyBpZDogXCJrb250YWt0ZVwiLCBsYWJlbDogXCJLT05UQUtURVwiIH0sXG4gIHsgaWQ6IFwibWVkaWFcIiwgbGFiZWw6IFwiTUVESUFcIiB9LFxuXTtcblxuY2xhc3MgRnJlZFNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5hY3RpdmVUYWIgPSBUQUJTWzBdLmlkO1xuICB9XG5cbiAgZGlzcGxheSgpIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCB0YWJCYXIgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZnJlZC1zZXR0aW5ncy10YWJzXCIgfSk7XG4gICAgZm9yIChjb25zdCB0YWIgb2YgVEFCUykge1xuICAgICAgY29uc3QgYnRuID0gdGFiQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgdGV4dDogdGFiLmxhYmVsLFxuICAgICAgICBjbHM6IFwiZnJlZC1zZXR0aW5ncy10YWJcIiArICh0aGlzLmFjdGl2ZVRhYiA9PT0gdGFiLmlkID8gXCIgaXMtYWN0aXZlXCIgOiBcIlwiKSxcbiAgICAgIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYWN0aXZlVGFiID0gdGFiLmlkO1xuICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnQgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZnJlZC1zZXR0aW5ncy1jb250ZW50XCIgfSk7XG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcImdlbmVyYWxcIikgdGhpcy5kaXNwbGF5R2VuZXJhbFRhYihjb250ZW50KTtcbiAgICBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCJrb250YWt0ZVwiKSB0aGlzLmRpc3BsYXlLb250YWt0ZVRhYihjb250ZW50KTtcbiAgICBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCJtZWRpYVwiKSB0aGlzLmRpc3BsYXlNZWRpYVRhYihjb250ZW50KTtcbiAgfVxuXG4gIC8vIEplZGVyIEFic2Nobml0dCBpc3QgZWluZSBTZXR0aW5nR3JvdXAgLSBPYnNpZGlhbnMgZWlnZW5lIEdydXBwaWVydW5nXG4gIC8vIChcdTAwRENiZXJzY2hyaWZ0ICsgZWluZSBCb3gsIEVpbnRyXHUwMEU0Z2UgZGFyaW4gZHVyY2ggVHJlbm5saW5pZW4gZ2V0cmVubnQpLCB3aWVcbiAgLy8gaW4gZGVuIENvcmUtRWluc3RlbGx1bmdlbi4gRWluemVsbiBwZXIgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpIGFuZ2VsZWd0ZVxuICAvLyBFaW50clx1MDBFNGdlIHdcdTAwRkNyZGVuIHN0YXR0ZGVzc2VuIGplIGFscyBlaWdlbmUga2xlaW5lIEJveCBnZXJlbmRlcnQuXG4gIGRpc3BsYXlHZW5lcmFsVGFiKGNvbnRhaW5lckVsKSB7XG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiRGF0ZW5iYW5rLU9yZG5lclwiKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIlByXHUwMEU0Zml4LU9yZG5lciBhbHMgRGF0ZW5iYW5rIGJlaGFuZGVsblwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiT3JkbmVyLCBkZXJlbiBOYW1lIG1pdCBkZW0gUHJcdTAwRTRmaXggYmVnaW5udCwgc2luZCBpbSBEYXRlaWJhdW0gbmljaHQgbWVociBhdWYtL3p1a2xhcHBiYXIuXCIpXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi51cGRhdGVEYXRhYmFzZUZvbGRlclN0eWxlPy4oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIlByXHUwMEU0Zml4XCIpXG4gICAgICAgICAgLnNldERlc2MoXCJPcmRuZXJuYW1lbiwgZGllIG1pdCBkaWVzZW0gWmVpY2hlbi9UZXh0IGJlZ2lubmVuLCBnZWx0ZW4gYWxzIERhdGVuYmFuay1PcmRuZXIuXCIpXG4gICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXggPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnVwZGF0ZURhdGFiYXNlRm9sZGVyU3R5bGU/LigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiRm9sZGVyLU5vdGVzLUVyd2VpdGVydW5nOiBnZXNhbXRlIFplaWxlIGtsaWNrYmFyXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIkJlaSBEYXRlbmJhbmstT3JkbmVybiBcdTAwRjZmZm5ldCBlaW4gS2xpY2sgaXJnZW5kd28gaW4gZGVyIFRpdGVsemVpbGUgKG5pY2h0IG51ciBhdWYgZGVtIE5hbWVuKSBkaWUgenVnZWhcdTAwRjZyaWdlIEZvbGRlci1Ob3RlLCBzb2Zlcm4gZGFzIEZvbGRlci1Ob3Rlcy1QbHVnaW4gZ2VudXR6dCB3aXJkLlwiXG4gICAgICAgICAgKVxuICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJOb3RlQ2xpY2tFeHRlbnNpb25FbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyTm90ZUNsaWNrRXh0ZW5zaW9uRW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4udXBkYXRlRGF0YWJhc2VGb2xkZXJTdHlsZT8uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJBbnphaGwgYW0gWmVpbGVuZW5kZSBhbnplaWdlblwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiWmVpZ3QgZGllIC5tZC1EYXRlaS1BbnphaGwgc3RhdHQgYW4gU3RlbGxlIGRlcyBQZmVpbHMgYW0gWmVpbGVuZW5kZSBhbiwgd2llIHNvbnN0IGRpZSBEYXRlaWVuZHVuZy5cIilcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi51cGRhdGVEYXRhYmFzZUZvbGRlclN0eWxlPy4oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nR3JvdXAoY29udGFpbmVyRWwpXG4gICAgICAuc2V0SGVhZGluZyhcIlByb3BlcnR5LUJhY2tsaW5raW5nXCIpXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiUHJvcGVydGllc1wiKVxuICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgXCJLb21tYWdldHJlbm50ZSBMaXN0ZSB2b24gRnJvbnRtYXR0ZXItUHJvcGVydGllcyBtaXQgTGlua3MgenUgYW5kZXJlbiBOb3RpemVuICh6LiBCLiBGYW1pbGllLCBGcmV1bmRlKSAtIGdpbHQgZlx1MDBGQ3IgYWxsZSBOb3RpemVuLCB1bmFiaFx1MDBFNG5naWcgdm9tIFRZUC4gVmVybGlua3QgZWluZSBOb3RpeiBoaWVyIGVpbmUgYW5kZXJlLCBiZWtvbW10IGRpZSBhbmRlcmUgYXV0b21hdGlzY2ggZGVuIEJhY2tsaW5rIGluIGRlcnNlbGJlbiBQcm9wZXJ0eSBlcmdcdTAwRTRuenQgLSB1bmQgd2llZGVyIGVudGZlcm50LCBzb2JhbGQgZGllIFZlcmxpbmt1bmcgd2VnZlx1MDBFNGxsdC4gR3JvXHUwMERGLS9LbGVpbnNjaHJlaWJ1bmcgbXVzcyBleGFrdCB6dW0gUHJvcGVydHktTmFtZW4gcGFzc2VuLlwiXG4gICAgICAgICAgKVxuICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzLmpvaW4oXCIsIFwiKSlcbiAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnJlY2lwcm9jYWxMaW5rUHJvcGVydGllcyA9IHZhbHVlXG4gICAgICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAgICAgICAgICAgICAubWFwKChuYW1lKSA9PiBuYW1lLnRyaW0oKSlcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKG5hbWUpID0+IG5hbWUubGVuZ3RoID4gMCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIkxpdmUgYWt0dWFsaXNpZXJlblwiKVxuICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgXCJQcm9wZXJ0eS1CYWNrbGlua2luZyBzb2ZvcnQgYmVpbSBTcGVpY2hlcm4gYWJnbGVpY2hlbiwgc3RhdHQgbnVyIGF1ZiBCZWZlaGwgKFxcXCJQcm9wZXJ0eS1CYWNrbGlua2luZyBha3R1YWxpc2llcmVuXFxcIikuXCJcbiAgICAgICAgICApXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzTGl2ZUVuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm9wZXJ0eUJhY2tsaW5rc0xpdmVFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiUmVpaGVuZm9sZ2UgYXVzIFRZUC1TeXN0ZW0gXHUwMEZDYmVybmVobWVuXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIkxlZ3QgZGFzIEJhY2tsaW5raW5nIGVpbmUgUHJvcGVydHkgaW4gZWluZXIgTm90aXogbmV1IGFuLCBsYW5kZXQgc2llIGFuIGlocmVtIFBsYXR6IGxhdXQgRnJvbnRtYXR0ZXItU29ydGllcnVuZyBkZXMgVFlQLVN5c3RlbXMgKGdsb2JhbGUgUmVpaGVuZm9sZ2UsIFRZUC1Gcm9udG1hdHRlciBzYW10IEZsb2F0aW5nIFByb3BlcnRpZXMpIHN0YXR0IGFtIEVuZGUuIE51ciBkaWUgbmV1ZSBQcm9wZXJ0eSB3aXJkIGVpbnNvcnRpZXJ0LCBkaWUgXHUwMEZDYnJpZ2VuIGJsZWliZW4sIHdpZSBzaWUgc2luZC4gT2huZSBha3RpdmllcnRlcyBUWVAtU3lzdGVtIHdpcmQgd2llIGJpc2hlciBhbmdlaFx1MDBFNG5ndC5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucHJvcGVydHlCYWNrbGlua3NUeXBPcmRlcikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzVHlwT3JkZXIgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZ0dyb3VwKGNvbnRhaW5lckVsKVxuICAgICAgLnNldEhlYWRpbmcoXCJDaGVja2xpc3RlblwiKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIlZlcnNjaGFjaHRlbHRlIENoZWNrYm94ZW4gbWl0IHVtc2NoYWx0ZW5cIilcbiAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgIFwiQmVpbSAoRW50KUhha2VuIGVpbmVyIENoZWNrYm94IHdlcmRlbiBhbGxlIGRhcnVudGVyIHZlcnNjaGFjaHRlbHRlbiBDaGVja2JveGVuIGF1dG9tYXRpc2NoIG1pdCAoZW50KWhha3QgLSB1bmQgdW1nZWtlaHJ0OiBzaW5kIGFsbGUgQ2hlY2tib3hlbiBlaW5lciBVbnRlcmxpc3RlIGFuZ2VoYWt0LCB3aXJkIGRpZSBcdTAwRkNiZXJnZW9yZG5ldGUgQ2hlY2tib3ggYXV0b21hdGlzY2ggbWl0IGFuZ2VoYWt0LCB1bmQgd2llZGVyIGVudGZlcm50LCBzb2JhbGQgZWluZSBkYXZvbiB3aWVkZXIgYWJnZWhha3Qgd2lyZC5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubmVzdGVkQ2hlY2tib3hTeW5jRW5hYmxlZCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZ0dyb3VwKGNvbnRhaW5lckVsKVxuICAgICAgLnNldEhlYWRpbmcoXCJGb3JtYXRpZXJ1bmdcIilcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJLdXJzaXYgbWl0IFVudGVyc3RyaWNoZW5cIilcbiAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICdEZXIgQmVmZWhsIFwiS3Vyc2l2IHVtc2NoYWx0ZW5cIiBzZXR6dCBiZWltIEVpbmZcdTAwRkNnZW4gVW50ZXJzdHJpY2hlIChfVGV4dF8pIHN0YXR0IFN0ZXJuY2hlbiAoKlRleHQqKSB1bSBkaWUgQXVzd2FobC4gQmVyZWl0cyB2b3JoYW5kZW5lIEt1cnNpdmZvcm1hdGllcnVuZyAobWl0ICogb2RlciBfKSB3aXJkIGJlaW0gZXJuZXV0ZW4gVW1zY2hhbHRlbiB3ZWl0ZXJoaW4ga29ycmVrdCBlcmthbm50IHVuZCBlbnRmZXJudC4nXG4gICAgICAgICAgKVxuICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGFsaWNVbmRlcnNjb3JlRW5hYmxlZCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLml0YWxpY1VuZGVyc2NvcmVFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiQmFzZXNcIilcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoJ1Byb3BlcnR5IFwiZmlsZS5oYXNOb3RlXCInKVxuICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgJ1N0ZWxsdCBpbiBCYXNlcyBkaWUgenVzXHUwMEU0dHpsaWNoZSBEYXRlaS1Qcm9wZXJ0eSBcImZpbGUuaGFzTm90ZVwiIGJlcmVpdCAtIHdpZSBkaWUgZWluZ2ViYXV0ZW4gZmlsZS5lbWJlZHMvZmlsZS50YWdzLCBhbHNvIG9obmUgZXR3YXMgaW5zIEZyb250bWF0dGVyIHp1IHNjaHJlaWJlbi4gU2llIGlzdCB0cnVlLCB3ZW5uIGRpZSBOb3RpeiBhdVx1MDBERmVyaGFsYiBkZXMgRnJvbnRtYXR0ZXJzIEluaGFsdCBoYXQsIHVuZCBkYW1pdCBhbHMgU3BhbHRlLCBGaWx0ZXIgb2RlciBHcnVwcGllcnVuZyBudXR6YmFyLiBCZXJlaXRzIGdlXHUwMEY2ZmZuZXRlIEJhc2VzIHplaWdlbiBzaWUgZXJzdCBuYWNoIGVpbmVtIE5ldWF1ZmJhdSAoVGFiIG5ldSBcdTAwRjZmZm5lbikuJ1xuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYmFzZXNIYXNOb3RlRW5hYmxlZCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmJhc2VzSGFzTm90ZUVuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnVwZGF0ZUJhc2VzSGFzTm90ZT8uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZ0dyb3VwKGNvbnRhaW5lckVsKVxuICAgICAgLnNldEhlYWRpbmcoXCJTdHlsZSBTZXR0aW5nc1wiKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZSgnS25vcGYgXCJNb2RpZmllZFwiJylcbiAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICdFcmdcdTAwRTRuenQgaW4gZGVuIEVpbnN0ZWxsdW5nZW4gZGVzIFBsdWdpbnMgXCJTdHlsZSBTZXR0aW5nc1wiIGxpbmtzIG5lYmVuIEltcG9ydC9FeHBvcnQgZWluZW4gS25vcGYsIGRlciBkaWUgTGlzdGUgYXVmIGRpZSBFaW5zdGVsbHVuZ2VuIGZpbHRlcnQsIGRpZSBuaWNodCBtZWhyIGlocmVtIFN0YW5kYXJkd2VydCBlbnRzcHJlY2hlbiAtIGVpbiB6d2VpdGVyIEtsaWNrIHplaWd0IHdpZWRlciBhbGxlLiBaXHUwMEU0aGx0IG51ciBlY2h0ZSBBYndlaWNodW5nZW46IGVpbiBXZXJ0LCBkZXIgKHouIEIuIGR1cmNoIHp3ZWltYWxpZ2VzIFVtc2NoYWx0ZW4pIHdpZWRlciBkZW0gU3RhbmRhcmQgZW50c3ByaWNodCwgZ2lsdCBhbHMgdW52ZXJcdTAwRTRuZGVydC4gRGVyIEF1Zi0vWnVrbGFwcC1adXN0YW5kIGRlciBcdTAwRENiZXJzY2hyaWZ0ZW4gYmxlaWJ0IGRhYmVpIHVuYmVyXHUwMEZDaHJ0OyB3aWUgdmllbCBpbiBlaW5lciB6dWdla2xhcHB0ZW4gU2VrdGlvbiBzdGVja3QsIHplaWd0IGRlcmVuIFRyZWZmZXJ6YWhsLiBXaXJrdCBpbSBFaW5zdGVsbHVuZ3MtRGlhbG9nLCBuaWNodCBpbiBTdHlsZSBTZXR0aW5nc1xcJyBTZWl0ZW5sZWlzdGVuLUFuc2ljaHQuJ1xuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc3R5bGVTZXR0aW5nc01vZGlmaWVkRmlsdGVyRW5hYmxlZCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnN0eWxlU2V0dGluZ3NNb2RpZmllZEZpbHRlckVuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnVwZGF0ZVN0eWxlU2V0dGluZ3NGaWx0ZXI/LigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApO1xuXG4gICAgLy8gXCIrXCItQnV0dG9uIGFscyBFeHRyYS1CdXR0b24gaW0gR3J1cHBlbi1IZWFkZXIgKHdpZSB6LiBCLiBiZWkgT2JzaWRpYW5zXG4gICAgLy8gSG90a2V5LUdydXBwZSksIGRpZSBMaXN0ZSBzZWxic3QgaW4gZWluZW0gZWluemlnZW4gRWludHJhZyBkZXIgR3J1cHBlXG4gICAgLy8gdW50ZXIgZGVzc2VuIEJlc2NocmVpYnVuZy5cbiAgICBsZXQgbGlzdEVsO1xuICAgIG5ldyBTZXR0aW5nR3JvdXAoY29udGFpbmVyRWwpXG4gICAgICAuc2V0SGVhZGluZyhcIkltcG9ydGFudCBQbHVnaW4gU2V0dGluZ3NcIilcbiAgICAgIC5hZGRFeHRyYUJ1dHRvbigoYnV0dG9uKSA9PlxuICAgICAgICBidXR0b25cbiAgICAgICAgICAuc2V0SWNvbihcInBsdXNcIilcbiAgICAgICAgICAuc2V0VG9vbHRpcChcIlBsdWdpbiBoaW56dWZcdTAwRkNnZW5cIilcbiAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYW5pZmVzdHMgPSB0aGlzLnBsdWdpbi5hcHAucGx1Z2lucy5tYW5pZmVzdHM7XG4gICAgICAgICAgICBjb25zdCBjYW5kaWRhdGVzID0gT2JqZWN0LmtleXModGhpcy5wbHVnaW4uYXBwLnBsdWdpbnMucGx1Z2lucylcbiAgICAgICAgICAgICAgLmZpbHRlcigoaWQpID0+IG1hbmlmZXN0c1tpZF0gJiYgIXRoaXMucGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnMuaW5jbHVkZXMoaWQpKVxuICAgICAgICAgICAgICAubWFwKChpZCkgPT4gbWFuaWZlc3RzW2lkXSlcbiAgICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpO1xuXG4gICAgICAgICAgICBpZiAoY2FuZGlkYXRlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgbmV3IE5vdGljZShcIktlaW5lIHdlaXRlcmVuIGFrdGl2aWVydGVuIFBsdWdpbnMgdmVyZlx1MDBGQ2diYXIuXCIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ldyBQbHVnaW5QaWNrZXJNb2RhbCh0aGlzLnBsdWdpbi5hcHAsIGNhbmRpZGF0ZXMsIGFzeW5jIChpZCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoIWlkKSByZXR1cm47XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnMucHVzaChpZCk7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoSW1wb3J0YW50UGx1Z2luQ29tbWFuZHM/LigpO1xuICAgICAgICAgICAgICByZW5kZXJJbXBvcnRhbnRQbHVnaW5zTGlzdCgpO1xuICAgICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT4ge1xuICAgICAgICBzZXR0aW5nLnNldERlc2MoXCJFaWdlbmVyIEJlZmVobCBqZSBQbHVnaW4sIHVtIGRlc3NlbiBFaW5zdGVsbHVuZ2VuIGRpcmVrdCB6dSBcdTAwRjZmZm5lbi4gUmVpaGVuZm9sZ2UgcGVyIERyYWcmRHJvcC5cIik7XG4gICAgICAgIGxpc3RFbCA9IHNldHRpbmcuaW5mb0VsLmNyZWF0ZURpdih7IGNsczogXCJmcmVkLWltcG9ydGFudC1wbHVnaW5zLWxpc3RcIiB9KTtcbiAgICAgIH0pO1xuXG4gICAgY29uc3QgcmVuZGVySW1wb3J0YW50UGx1Z2luc0xpc3QgPSAoKSA9PiB7XG4gICAgICBsaXN0RWwuZW1wdHkoKTtcbiAgICAgIGNvbnN0IG1hbmlmZXN0cyA9IHRoaXMucGx1Z2luLmFwcC5wbHVnaW5zLm1hbmlmZXN0cztcbiAgICAgIC8vIE51ciBha3RpdmllcnRlIEVpbnRyXHUwMEU0Z2UgLSBlaW4gZGVha3RpdmllcnRlcyBQbHVnaW4gaGF0IGtlaW5lIGVpZ2VuZVxuICAgICAgLy8gU2V0dGluZ3MtVGFiLCBlaW4gQmVmZWhsIGRhZlx1MDBGQ3Igd1x1MDBFNHJlIHdpcmt1bmdzbG9zIChzaWVoZSBpbXBvcnRhbnQtcGx1Z2lucy5qcykuXG4gICAgICBjb25zdCBlbmFibGVkSWRzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1wb3J0YW50UGx1Z2lucy5maWx0ZXIoXG4gICAgICAgIChpZCkgPT4gbWFuaWZlc3RzW2lkXSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5wbHVnaW4uYXBwLnBsdWdpbnMucGx1Z2lucywgaWQpXG4gICAgICApO1xuXG4gICAgICBpZiAoZW5hYmxlZElkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIiwgdGV4dDogXCJLZWluZSB3aWNodGlnZW4gUGx1Z2lucyBlaW5nZXRyYWdlbi5cIiB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBcdTAwRENiZXJuaW1tdCBkaWUgUmVpaGVuZm9sZ2UsIHdpZSBkaWUgWmVpbGVuIGdlcmFkZSBpbSBET00gc3RlaGVuIChuYWNoXG4gICAgICAvLyBkZW0gWmllaGVuKSwgaW4gZGllIEVpbnN0ZWxsdW5nLiBBbmdlemVpZ3Qgd2VyZGVuIG51ciBha3RpdmllcnRlXG4gICAgICAvLyBQbHVnaW5zLCBnZXNwZWljaGVydCBzaW5kIGF1Y2ggZGVha3RpdmllcnRlOiBkZXJlbiBQbFx1MDBFNHR6ZSBpbiBkZXIgTGlzdGVcbiAgICAgIC8vIGJsZWliZW4gdW52ZXJcdTAwRTRuZGVydCwgbnVyIGRpZSBzaWNodGJhcmVuIFBsXHUwMEU0dHplIHdlcmRlbiBuZXUgYmVmXHUwMEZDbGx0LlxuICAgICAgY29uc3Qgc2F2ZU9yZGVyRnJvbURvbSA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgdmlzaWJsZSA9IG5ldyBTZXQoZW5hYmxlZElkcyk7XG4gICAgICAgIGNvbnN0IG5ld09yZGVyID0gQXJyYXkuZnJvbShsaXN0RWwuY2hpbGRyZW4sIChlbCkgPT4gZWwuZGF0YXNldC5wbHVnaW5JZCk7XG4gICAgICAgIGxldCBuZXh0ID0gMDtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1wb3J0YW50UGx1Z2lucyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnMubWFwKChpZCkgPT5cbiAgICAgICAgICB2aXNpYmxlLmhhcyhpZCkgPyBuZXdPcmRlcltuZXh0KytdIDogaWRcbiAgICAgICAgKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIC8vIERpZSBSZWloZW5mb2xnZSBiZXN0aW1tdCwgaW4gd2VsY2hlciBGb2xnZSBkZXIgU2FtbWVsYmVmZWhsIGRpZVxuICAgICAgICAvLyBQbHVnaW5zIHp1ciBBdXN3YWhsIGFuYmlldGV0IChzaWVoZSBpbXBvcnRhbnQtcGx1Z2lucy5qcykuXG4gICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hJbXBvcnRhbnRQbHVnaW5Db21tYW5kcz8uKCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBEaWUgTGlzdGUgaXN0IGVpbiBHcmlkIG1pdCBtZWhyZXJlbiBTcGFsdGVuIChzdHlsZXMuY3NzKSwgZGllXG4gICAgICAvLyBSZWloZW5mb2xnZSBsXHUwMEU0dWZ0IGRhcmluIHplaWxlbndlaXNlIHZvbiBsaW5rcyBuYWNoIHJlY2h0cy4gRGVzaGFsYlxuICAgICAgLy8gZW50c2NoZWlkZXQgaW5uZXJoYWxiIGRlcnNlbGJlbiBaZWlsZSBkaWUgWC1Qb3NpdGlvbiwgb2Jlci0gYnp3LlxuICAgICAgLy8gdW50ZXJoYWxiIGRhdm9uIGRpZSBZLVBvc2l0aW9uLlxuICAgICAgY29uc3QgZHJvcHNCZWZvcmUgPSAocm93LCBldnQpID0+IHtcbiAgICAgICAgY29uc3QgcmVjdCA9IHJvdy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgaWYgKGV2dC5jbGllbnRZIDwgcmVjdC50b3ApIHJldHVybiB0cnVlO1xuICAgICAgICBpZiAoZXZ0LmNsaWVudFkgPiByZWN0LmJvdHRvbSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gZXZ0LmNsaWVudFggPCByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMjtcbiAgICAgIH07XG5cbiAgICAgIC8vIEJld3Vzc3Qga2VpbiBlaWdlbmVyIFNldHRpbmctRWludHJhZyBqZSBaZWlsZSAtIGRlc3NlbiByZWd1bFx1MDBFNHJlc1xuICAgICAgLy8gUGFkZGluZy9TY2hyaWZ0Z3JcdTAwRjZcdTAwREZlIHdpcmt0IGZcdTAwRkNyIGVpbmUgcmVpbmUgTmFtZStFbnRmZXJuZW4tTGlzdGUgenVcbiAgICAgIC8vIHd1Y2h0aWcuIFNjaGxpY2h0ZSBlaWdlbmUgWmVpbGUgc3RhdHRkZXNzZW4uXG4gICAgICBmb3IgKGNvbnN0IGlkIG9mIGVuYWJsZWRJZHMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJmcmVkLWltcG9ydGFudC1wbHVnaW5zLXJvd1wiIH0pO1xuICAgICAgICAvLyBOYXRpdmVzIEhUTUw1LURyYWcmRHJvcCBzdGF0dCBPYnNpZGlhbnMgaW50ZXJuZXIgRHJhZ01hbmFnZXI6IGZcdTAwRkNyIGVpbmVcbiAgICAgICAgLy8gTGlzdGUgaW4gZGVuIGVpZ2VuZW4gRWluc3RlbGx1bmdlbiBnZW5cdTAwRkNndCBkYXMgdW5kIGJsZWlidCB1bmFiaFx1MDBFNG5naWdcbiAgICAgICAgLy8gdm9uIGRlcmVuIG5pY2h0IGRva3VtZW50aWVydGVyIEFQSS5cbiAgICAgICAgcm93LmRyYWdnYWJsZSA9IHRydWU7XG4gICAgICAgIHJvdy5kYXRhc2V0LnBsdWdpbklkID0gaWQ7XG4gICAgICAgIGNvbnN0IGdyaXAgPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcImZyZWQtaW1wb3J0YW50LXBsdWdpbnMtZ3JpcFwiIH0pO1xuICAgICAgICBzZXRJY29uKGdyaXAsIFwiZ3JpcC12ZXJ0aWNhbFwiKTtcbiAgICAgICAgcm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwiZnJlZC1pbXBvcnRhbnQtcGx1Z2lucy1uYW1lXCIsIHRleHQ6IG1hbmlmZXN0c1tpZF0ubmFtZSB9KTtcbiAgICAgICAgY29uc3QgcmVtb3ZlQnRuID0gcm93LmNyZWF0ZURpdih7XG4gICAgICAgICAgY2xzOiBcImNsaWNrYWJsZS1pY29uIGZyZWQtaW1wb3J0YW50LXBsdWdpbnMtcmVtb3ZlXCIsXG4gICAgICAgICAgYXR0cjogeyBcImFyaWEtbGFiZWxcIjogXCJFbnRmZXJuZW5cIiB9LFxuICAgICAgICB9KTtcbiAgICAgICAgc2V0SWNvbihyZW1vdmVCdG4sIFwieFwiKTtcbiAgICAgICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1wb3J0YW50UGx1Z2lucyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnMuZmlsdGVyKCh4KSA9PiB4ICE9PSBpZCk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEltcG9ydGFudFBsdWdpbkNvbW1hbmRzPy4oKTtcbiAgICAgICAgICByZW5kZXJJbXBvcnRhbnRQbHVnaW5zTGlzdCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdzdGFydFwiLCAoZXZ0KSA9PiB7XG4gICAgICAgICAgZHJhZ2dlZCA9IHJvdztcbiAgICAgICAgICByb3cuYWRkQ2xhc3MoXCJpcy1kcmFnZ2luZ1wiKTtcbiAgICAgICAgICBldnQuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSBcIm1vdmVcIjtcbiAgICAgICAgICAvLyBPaG5lIGdlc2V0enRlIERhdGVuIHN0YXJ0ZXQgaW4gRWxlY3Ryb24vQ2hyb21pdW0ga2VpbiBEcmFnLlxuICAgICAgICAgIGV2dC5kYXRhVHJhbnNmZXIuc2V0RGF0YShcInRleHQvcGxhaW5cIiwgaWQpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBEaWUgWmVpbGVuIHdlcmRlbiBzY2hvbiB3XHUwMEU0aHJlbmQgZGVzIFppZWhlbnMgdW1nZXN0ZWxsdCwgZGFzIGlzdCBkaWVcbiAgICAgICAgLy8gVm9yc2NoYXUgLSBnZXNwZWljaGVydCB3aXJkIGVyc3QgYW0gRW5kZSAoZHJhZ2VuZCkuXG4gICAgICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGV2dCkgPT4ge1xuICAgICAgICAgIGlmICghZHJhZ2dlZCB8fCBkcmFnZ2VkID09PSByb3cpIHJldHVybjtcbiAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBldnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSBcIm1vdmVcIjtcbiAgICAgICAgICBsaXN0RWwuaW5zZXJ0QmVmb3JlKGRyYWdnZWQsIGRyb3BzQmVmb3JlKHJvdywgZXZ0KSA/IHJvdyA6IHJvdy5uZXh0U2libGluZyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2VuZFwiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgcm93LnJlbW92ZUNsYXNzKFwiaXMtZHJhZ2dpbmdcIik7XG4gICAgICAgICAgZHJhZ2dlZCA9IG51bGw7XG4gICAgICAgICAgYXdhaXQgc2F2ZU9yZGVyRnJvbURvbSgpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIC8vIFx1MDBEQ2JlciByZW5kZXJJbXBvcnRhbnRQbHVnaW5zTGlzdCgpIGhpbndlZyBnXHUwMEZDbHRpZywgd2VpbCBlaW4gRHJhZyBkaWUgTGlzdGVcbiAgICAvLyBuaWNodCBuZXUgYXVmYmF1dCAtIGVyc3QgZGFzIGRyYWdlbmQgc3BlaWNoZXJ0LlxuICAgIGxldCBkcmFnZ2VkID0gbnVsbDtcbiAgICByZW5kZXJJbXBvcnRhbnRQbHVnaW5zTGlzdCgpO1xuICB9XG5cbiAgZGlzcGxheUtvbnRha3RlVGFiKGNvbnRhaW5lckVsKSB7XG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiS29udGFrdGltcG9ydFwiKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIkNTVi1EYXRlaVwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiUGZhZCB6dXIgS29udGFrdGUtQ1NWLCByZWxhdGl2IHp1bSBWYXVsdC1Sb290LlwiKVxuICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0NzdlBhdGgpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0NzdlBhdGggPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJLb250YWt0ZS1CYXNpc3ZlcnplaWNobmlzXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIkFsbGUgS29udGFrdGUgbGFuZGVuIGZsYWNoIGRpcmVrdCBpbiBkaWVzZW0gT3JkbmVyIChyZWxhdGl2IHp1bSBWYXVsdC1Sb290KS4gR3JvXHUwMERGLS9LbGVpbnNjaHJlaWJ1bmcgd2lyZCBiZWltIEFiZ2xlaWNoIGlnbm9yaWVydC5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNCYXNlRGlyKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNCYXNlRGlyID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiVFlQIGRlciBLb250YWt0LU5vdGl6ZW5cIilcbiAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgIFwiQmVzdGltbXQgenVnbGVpY2gsIGF1cyB3ZWxjaGVtIFRZUC1Gcm9udG1hdHRlciBkZXIgSW1wb3J0IHNlaW5lIEZlbGRsaXN0ZSBsaWVzdC4gTFx1MDBFNHVmdCBkYXMgVFlQLVN5c3RlbSBuaWNodCwgZ3JlaWZ0IGVpbmUgaW50ZXJuZSBMaXN0ZS5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNUeXApLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c1R5cCA9IHZhbHVlO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIlBhcGllcmtvcmItVW50ZXJvcmRuZXJcIilcbiAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgIFwiS29udGFrdGUsIHp1IGRlbmVuIGtlaW5lIENTVi1aZWlsZSBtZWhyIHBhc3N0LCB3YW5kZXJuIGhpZXJoaW4gKGlubmVyaGFsYiBkZXMgQmFzaXN2ZXJ6ZWljaG5pc3NlcykuIEVpbmdlaGVuZGUgTGlua3MgYmxlaWJlbiBkYWJlaSBlcmhhbHRlbi5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNUcmFzaFN1YmRpcikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzVHJhc2hTdWJkaXIgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJOdXIgYmVzdGVoZW5kZSBLb250YWt0ZSBha3R1YWxpc2llcmVuXCIpXG4gICAgICAgICAgLnNldERlc2MoXCJXZW5uIGFrdGl2LCB3ZXJkZW4ga2VpbmUgbmV1ZW4gS29udGFrdC1Ob3RpemVuIGFuZ2VsZWd0LCBudXIgYmVzdGVoZW5kZSBha3R1YWxpc2llcnQuXCIpXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzRWRpdE9ubHkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0VkaXRPbmx5ID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiSXJyZWxldmFudGUgS29udGFrdGUgXHUwMEZDYmVyc3ByaW5nZW5cIilcbiAgICAgICAgICAuc2V0RGVzYyhcIktvbnRha3RlIG9obmUgR2VidXJ0c3RhZyB1bmQgb2huZSBUYWdzIHdlcmRlbiBcdTAwRkNiZXJzcHJ1bmdlbi5cIilcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNGaWx0ZXJSZWxldmFudCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzRmlsdGVyUmVsZXZhbnQgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJXZXJ0ZSBub3JtYWxpc2llcmVuXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIlRlbGVmb25udW1tZXJuIGF1ZiArNDktRm9ybWF0IChpbmtsLiBnZXNjaFx1MDBGQ3R6dGVyIExlZXJ6ZWljaGVuKSwgRS1NYWlscyBrbGVpbiwgTFx1MDBFNG5kZXJrXHUwMEZDcnplbCBhdXNnZXNjaHJpZWJlbiwgSGF1c251bW1lcm4gaW4gZGV1dHNjaGUgUmVpaGVuZm9sZ2UuIEplZGUgS29ycmVrdHVyIHdpcmQgaW4gZGVyIEtvbnNvbGUgcHJvdG9rb2xsaWVydC5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNOb3JtYWxpemVFbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNOb3JtYWxpemVFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiQmVpIGFid2VpY2hlbmRlbiBXZXJ0ZW5cIilcbiAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgIFwiV2FzIHBhc3NpZXJ0LCB3ZW5uIGVpbmUgTm90aXogYmVyZWl0cyBlaW5lbiBhbmRlcmVuIFdlcnQgaGF0IGFscyBkaWUgQ1NWLiBMZWVyZSBQcm9wZXJ0aWVzIHdlcmRlbiBpbW1lciBnZWZcdTAwRkNsbHQsIFRhZ3MgaW1tZXIgenVzYW1tZW5nZWZcdTAwRkNocnQuXCJcbiAgICAgICAgICApXG4gICAgICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cbiAgICAgICAgICAgIGRyb3Bkb3duXG4gICAgICAgICAgICAgIC5hZGRPcHRpb24oXCJjc3ZcIiwgXCJDU1YgZ2V3aW5udFwiKVxuICAgICAgICAgICAgICAuYWRkT3B0aW9uKFwiZ2Fwc1wiLCBcIk5vdGl6IGJlaGFsdGVuLCBudXIgTFx1MDBGQ2NrZW4gZlx1MDBGQ2xsZW5cIilcbiAgICAgICAgICAgICAgLmFkZE9wdGlvbihcImFza1wiLCBcIlBybyBLb250YWt0IG5hY2hmcmFnZW5cIilcbiAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzQ29uZmxpY3RNb2RlKVxuICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNDb25mbGljdE1vZGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiUHJvYmVsYXVmXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIlJlY2huZXQgZGVuIExhdWYga29tcGxldHQgZHVyY2ggdW5kIG1lbGRldCBpbiBkZXIgS29uc29sZSwgd2FzIHBhc3NpZXJlbiB3XHUwMEZDcmRlIC0gc2NocmVpYnQgYWJlciBuaWNodHMuIEdpbHQgZlx1MDBGQ3IgYmVpZGUgS29udGFrdC1CZWZlaGxlLlwiXG4gICAgICAgICAgKVxuICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0RyeVJ1bikub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzRHJ5UnVuID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApO1xuICB9XG5cbiAgZGlzcGxheU1lZGlhVGFiKGNvbnRhaW5lckVsKSB7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJOb2NoIGtlaW5lIEVpbnN0ZWxsdW5nZW4uXCIgfSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IERFRkFVTFRfU0VUVElOR1MsIEZyZWRTZXR0aW5nVGFiIH07XG4iLCAiY29uc3QgeyBOb3RpY2UsIE1vZGFsLCBTZXR0aW5nLCBCdXR0b25Db21wb25lbnQgfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBLb250YWt0ZS1DU1YtSW1wb3J0XG4gKlxuICogQXJiZWl0ZXQgaW4gendlaSBTY2hyaXR0ZW46IGVyc3Qgd2lyZCBkZXIga29tcGxldHRlIExhdWZcbiAqIGR1cmNoZ2VyZWNobmV0IChidWlsZFBsYW4pLCBkYW5uIGFuZ2V3YW5kdCAoYXBwbHlQbGFuKS4gRGFzXG4gKiBoXHUwMEU0bHQgZGVuIFByb2JlbGF1ZiB0cml2aWFsIChQbGFuIGJhdWVuLCBuaWNodCBhbndlbmRlbiksIG1hY2h0XG4gKiBkYXMgS29uZmxpa3QtTW9kYWwgbVx1MDBGNmdsaWNoIChhbGxlIEFid2VpY2h1bmdlbiBzaW5kIGJla2FubnQsXG4gKiBiZXZvciBpcmdlbmRldHdhcyBnZXNjaHJpZWJlbiB3aXJkKSB1bmQgZXJsYXVidCBkZW0gTFx1MDBGNnNjaC1cbiAqIEJlZmVobCwgZGVuc2VsYmVuIFNvbGwtWnVzdGFuZCB6dSBiZW51dHplbi5cbiAqXG4gKiBHZXNjaHJpZWJlbiB3aXJkIGF1c3NjaGxpZVx1MDBERmxpY2ggXHUwMEZDYmVyIGZpbGVNYW5hZ2VyLnByb2Nlc3NGcm9udE1hdHRlclxuICogdW5kIGRpZSBBUEkgZGVzIFRZUC1TeXN0ZW1zIC0gbmllIFx1MDBGQ2JlciBhZGFwdGVyLndyaXRlIG1pdCBzZWxic3RcbiAqIGdlYmF1dGVtIFlBTUwuIFNvbnN0IGtcdTAwRTRtZW4gc2ljaCBJbXBvcnQgdW5kIEZyb250bWF0dGVyLVNvcnRpZXJ1bmdcbiAqIGJlaSBqZWRlbSBMYXVmIGdlZ2Vuc2VpdGlnIGluIGRpZSBRdWVyZS5cbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jb25zdCBNVUxUSV9WQUxVRV9TRVBBUkFUT1IgPSBcIiA6OjogXCI7XG5jb25zdCBJR05PUkVEX0xBQkVMUyA9IG5ldyBTZXQoW1wiKiBteUNvbnRhY3RzXCIsIFwiKiBzdGFycmVkXCJdKTtcbmNvbnN0IFNUQVJSRURfTEFCRUwgPSBcIiogc3RhcnJlZFwiO1xuXG4vLyBDU1YtU3BhbHRlIC0+IFByb3BlcnR5LiBUZWxlZm9uIHVuZCBFLU1haWwgZmVobGVuIGhpZXIgYmV3dXNzdDogZGllXG4vLyBrXHUwMEY2bm5lbiBtZWhyd2VydGlnIHNlaW4gdW5kIHdlcmRlbiBpbiBjb2xsZWN0UGhvbmVzL2NvbGxlY3RFbWFpbHNcbi8vIHp1c2FtbWVuZ2VmXHUwMEZDaHJ0LlxuY29uc3QgQ09MVU1OX01BUFBJTkcgPSB7XG4gIFwiRmlyc3QgTmFtZVwiOiBcIlZvcm5hbWVcIixcbiAgXCJNaWRkbGUgTmFtZVwiOiBcIlp3ZWl0bmFtZVwiLFxuICBcIkxhc3QgTmFtZVwiOiBcIk5hY2huYW1lXCIsXG4gIFwiQmlydGhkYXlcIjogXCJHZWJ1cnRzdGFnXCIsXG4gIFwiQWRkcmVzcyAxIC0gU3RyZWV0XCI6IFwiU3RyYXNzZVwiLFxuICBcIkFkZHJlc3MgMSAtIENpdHlcIjogXCJTdGFkdFwiLFxuICBcIkFkZHJlc3MgMSAtIFBvc3RhbCBDb2RlXCI6IFwiUGx6XCIsXG4gIFwiQWRkcmVzcyAxIC0gQ291bnRyeVwiOiBcIk5hdGlvblwiLFxufTtcblxuLy8gRmFsbGJhY2ssIGZhbGxzIGRhcyBUWVAtU3lzdGVtIG5pY2h0IGxcdTAwRTR1ZnQgLSBzb25zdCBpc3Rcbi8vIGdldFR5cGVEZWZhdWx0cyhUWVAsIHsgaW5jbHVkZUZsb2F0aW5nOiB0cnVlIH0pIGRpZSBRdWVsbGUuXG5jb25zdCBGQUxMQkFDS19DT05UQUNUX0tFWVMgPSBbXG4gIFwiVm9ybmFtZVwiLFxuICBcIlp3ZWl0bmFtZVwiLFxuICBcIk5hY2huYW1lXCIsXG4gIFwiR2VidXJ0c3RhZ1wiLFxuICBcIkhhbmR5bnVtbWVyXCIsXG4gIFwiSGFuZHludW1tZXItQWx0XCIsXG4gIFwiRmVzdG5ldHpcIixcbiAgXCJFLU1haWxcIixcbiAgXCJFLU1haWwtQWx0XCIsXG4gIFwiU3RyYXNzZVwiLFxuICBcIlN0YWR0XCIsXG4gIFwiUGx6XCIsXG4gIFwiTmF0aW9uXCIsXG4gIFwiRmFtaWxpZVwiLFxuICBcIkZyZXVuZGVcIixcbl07XG5cbi8vIFByb3BlcnRpZXMsIGRpZSBkZXIgSW1wb3J0IHNlbGJzdCBiZWZcdTAwRkNsbHQuIEFsbGVzIGFuZGVyZSAoRmFtaWxpZSxcbi8vIEZyZXVuZGUsIGVpZ2VuZSBFcmdcdTAwRTRuenVuZ2VuKSBnZWhcdTAwRjZydCBkZW0gTnV0emVyIGJ6dy4gZGVtXG4vLyBQcm9wZXJ0eS1CYWNrbGlua2luZyB1bmQgd2lyZCBuaWUgYW5nZWZhc3N0LlxuY29uc3QgSU1QT1JUX09XTkVEX0tFWVMgPSBbXG4gIFwiVm9ybmFtZVwiLFxuICBcIlp3ZWl0bmFtZVwiLFxuICBcIk5hY2huYW1lXCIsXG4gIFwiR2VidXJ0c3RhZ1wiLFxuICBcIkhhbmR5bnVtbWVyXCIsXG4gIFwiSGFuZHludW1tZXItQWx0XCIsXG4gIFwiRmVzdG5ldHpcIixcbiAgXCJFLU1haWxcIixcbiAgXCJFLU1haWwtQWx0XCIsXG4gIFwiU3RyYXNzZVwiLFxuICBcIlN0YWR0XCIsXG4gIFwiUGx6XCIsXG4gIFwiTmF0aW9uXCIsXG4gIFwidGFnc1wiLFxuXTtcblxuLy8gQXVzIHdlbGNoZW4gQ1NWLVNwYWx0ZW4gZWluZSBQcm9wZXJ0eSBnZXNwZWlzdCB3aXJkLiBHZWJyYXVjaHQsIHVtIHp1XG4vLyBlcmtlbm5lbiwgb2IgZWluIGxlZXJlcyBGZWxkIFwiaW4gR29vZ2xlIGdlbFx1MDBGNnNjaHRcIiBiZWRldXRldCBvZGVyIG51clxuLy8gXCJkaWVzZSBTcGFsdGUgbGllZmVydCBkZXIgRXhwb3J0IGdhciBuaWNodFwiLiBPaG5lIGRpZSBVbnRlcnNjaGVpZHVuZ1xuLy8gd1x1MDBGQ3JkZSBlaW4gRXhwb3J0IG9obmUgXCJQaG9uZSAyIC0gVmFsdWVcIiBkYXMgRmVzdG5ldHogYmVpIGFsbGVuIEtvbnRha3RlblxuLy8gbGVlcmVuLCBzdGF0dCBlcyBlaW5mYWNoIGluIFJ1aGUgenUgbGFzc2VuLlxuY29uc3QgU09VUkNFX0NPTFVNTlMgPSB7XG4gIFZvcm5hbWU6IFtcIkZpcnN0IE5hbWVcIl0sXG4gIFp3ZWl0bmFtZTogW1wiTWlkZGxlIE5hbWVcIl0sXG4gIE5hY2huYW1lOiBbXCJMYXN0IE5hbWVcIl0sXG4gIEdlYnVydHN0YWc6IFtcIkJpcnRoZGF5XCJdLFxuICBIYW5keW51bW1lcjogW1wiUGhvbmUgMSAtIFZhbHVlXCJdLFxuICBcIkhhbmR5bnVtbWVyLUFsdFwiOiBbXCJQaG9uZSAxIC0gVmFsdWVcIl0sXG4gIEZlc3RuZXR6OiBbXCJQaG9uZSAyIC0gVmFsdWVcIl0sXG4gIFwiRS1NYWlsXCI6IFtcIkUtbWFpbCAxIC0gVmFsdWVcIl0sXG4gIFwiRS1NYWlsLUFsdFwiOiBbXCJFLW1haWwgMiAtIFZhbHVlXCIsIFwiRS1tYWlsIDMgLSBWYWx1ZVwiXSxcbiAgU3RyYXNzZTogW1wiQWRkcmVzcyAxIC0gU3RyZWV0XCJdLFxuICBTdGFkdDogW1wiQWRkcmVzcyAxIC0gQ2l0eVwiXSxcbiAgUGx6OiBbXCJBZGRyZXNzIDEgLSBQb3N0YWwgQ29kZVwiXSxcbiAgTmF0aW9uOiBbXCJBZGRyZXNzIDEgLSBDb3VudHJ5XCJdLFxuICB0YWdzOiBbXCJMYWJlbHNcIl0sXG59O1xuXG4vLyBOdXIgYmVrYW5udGUgS1x1MDBGQ3J6ZWwgd2VyZGVuIGF1c2dlc2NocmllYmVuOyBhbGxlcyBVbmJla2FubnRlIGJsZWlidFxuLy8gdW5hbmdldGFzdGV0LCBkYW1pdCBkZXIgSW1wb3J0IGtlaW5lIExcdTAwRTRuZGVyIGVyZmluZGV0LlxuY29uc3QgQ09VTlRSWV9OQU1FUyA9IHtcbiAgREU6IFwiRGV1dHNjaGxhbmRcIixcbiAgQVQ6IFwiXHUwMEQ2c3RlcnJlaWNoXCIsXG4gIENIOiBcIlNjaHdlaXpcIixcbiAgRlI6IFwiRnJhbmtyZWljaFwiLFxuICBOTDogXCJOaWVkZXJsYW5kZVwiLFxuICBCRTogXCJCZWxnaWVuXCIsXG4gIExVOiBcIkx1eGVtYnVyZ1wiLFxuICBJVDogXCJJdGFsaWVuXCIsXG4gIEVTOiBcIlNwYW5pZW5cIixcbiAgUEw6IFwiUG9sZW5cIixcbiAgQ1o6IFwiVHNjaGVjaGllblwiLFxuICBESzogXCJEXHUwMEU0bmVtYXJrXCIsXG4gIEdCOiBcIlZlcmVpbmlndGVzIEtcdTAwRjZuaWdyZWljaFwiLFxuICBVUzogXCJVU0FcIixcbiAgVFI6IFwiVFx1MDBGQ3JrZWlcIixcbn07XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyogUGZhZGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbmZ1bmN0aW9uIGpvaW5WYXVsdFBhdGgoLi4ucGFydHMpIHtcbiAgcmV0dXJuIHBhcnRzXG4gICAgLmZpbHRlcigocGFydCkgPT4gcGFydCAhPT0gdW5kZWZpbmVkICYmIHBhcnQgIT09IG51bGwgJiYgcGFydCAhPT0gXCJcIilcbiAgICAuam9pbihcIi9cIilcbiAgICAucmVwbGFjZSgvXFwvKy9nLCBcIi9cIilcbiAgICAucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xufVxuXG4vLyBWZXJnbGVpY2hlIHVuZW1wZmluZGxpY2ggZ2VnZW4gR3JvXHUwMERGLS9LbGVpbnNjaHJlaWJ1bmc6IGRhcyBTZXR0aW5nIHNhZ3RlXG4vLyBsYW5nZSBcIn5LT05UQUtURVwiLCBkZXIgT3JkbmVyIGhlaVx1MDBERnQgXCJ+S29udGFrdGVcIi4gVW50ZXIgV2luZG93cyBsaWVmIGRlclxuLy8gRGF0ZWl6dWdyaWZmIHRyb3R6ZGVtLCBudXIgT2JzaWRpYW5zIGVpZ2VuZXIgSW5kZXggKGZpbGUucGF0aCkgdmVyZ2xpY2hcbi8vIHNpY2ggbmllIGdsZWljaCAtIGRlciBMXHUwMEY2c2NoLUJlZmVobCBmYW5kIGRhZHVyY2ggc3RpbGxzY2h3ZWlnZW5kIG5pY2h0cy5cbmZ1bmN0aW9uIGlzSW5Gb2xkZXIocGF0aCwgZm9sZGVyKSB7XG4gIGNvbnN0IHAgPSBwYXRoLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGYgPSBmb2xkZXIudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIHAgPT09IGYgfHwgcC5zdGFydHNXaXRoKGYgKyBcIi9cIik7XG59XG5cbi8vIERpZSBlY2h0ZSBTY2hyZWlid2Vpc2UgZGVzIE9yZG5lcnMgYXVzIGRlbSBWYXVsdCBob2xlbiwgc3RhdHQgZGVyIGF1cyBkZW1cbi8vIFNldHRpbmcgenUgdmVydHJhdWVuLiBTb25zdCB6aWVsZW4gVW1iZW5lbm51bmdlbiB1bmQgX1RyYXNoLVZlcnNjaGllYnVuZ2VuXG4vLyBhdWYgZWluZW4gUGZhZCwgZGVuIGVzIHVudGVyIFdpbmRvd3MgendhciBnaWJ0LCBkZW4gT2JzaWRpYW5zIEluZGV4IGFiZXJcbi8vIGFuZGVycyBzY2hyZWlidC5cbmZ1bmN0aW9uIHJlc29sdmVGb2xkZXJQYXRoKGFwcCwgZm9sZGVyKSB7XG4gIGlmIChhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZvbGRlcikpIHJldHVybiBmb2xkZXI7XG4gIGNvbnN0IGxvd2VyID0gZm9sZGVyLnRvTG93ZXJDYXNlKCk7XG4gIGZvciAoY29uc3QgaXRlbSBvZiBhcHAudmF1bHQuZ2V0QWxsTG9hZGVkRmlsZXM/LigpID8/IFtdKSB7XG4gICAgaWYgKGl0ZW0uY2hpbGRyZW4gJiYgaXRlbS5wYXRoLnRvTG93ZXJDYXNlKCkgPT09IGxvd2VyKSByZXR1cm4gaXRlbS5wYXRoO1xuICB9XG4gIHJldHVybiBmb2xkZXI7XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplRmlsZU5hbWUobmFtZSkge1xuICByZXR1cm4gbmFtZVxuICAgIC5yZXBsYWNlKC9bXFxcXC86Kj9cIjw+fCNeW1xcXV0vZywgXCItXCIpXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXG4gICAgLnRyaW0oKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG4vKiBDU1YgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cblxuZnVuY3Rpb24gcGFyc2VDc3YodGV4dCkge1xuICBjb25zdCByb3dzID0gW107XG4gIGxldCByb3cgPSBbXTtcbiAgbGV0IGZpZWxkID0gXCJcIjtcbiAgbGV0IGluUXVvdGVzID0gZmFsc2U7XG4gIGxldCBpID0gMDtcblxuICB3aGlsZSAoaSA8IHRleHQubGVuZ3RoKSB7XG4gICAgY29uc3QgY2hhciA9IHRleHRbaV07XG5cbiAgICBpZiAoaW5RdW90ZXMpIHtcbiAgICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICAgIGlmICh0ZXh0W2kgKyAxXSA9PT0gJ1wiJykge1xuICAgICAgICAgIGZpZWxkICs9ICdcIic7XG4gICAgICAgICAgaSArPSAyO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGluUXVvdGVzID0gZmFsc2U7XG4gICAgICAgIGkrKztcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBmaWVsZCArPSBjaGFyO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgIGluUXVvdGVzID0gdHJ1ZTtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY2hhciA9PT0gXCIsXCIpIHtcbiAgICAgIHJvdy5wdXNoKGZpZWxkKTtcbiAgICAgIGZpZWxkID0gXCJcIjtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY2hhciA9PT0gXCJcXHJcIikge1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChjaGFyID09PSBcIlxcblwiKSB7XG4gICAgICByb3cucHVzaChmaWVsZCk7XG4gICAgICByb3dzLnB1c2gocm93KTtcbiAgICAgIHJvdyA9IFtdO1xuICAgICAgZmllbGQgPSBcIlwiO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGZpZWxkICs9IGNoYXI7XG4gICAgaSsrO1xuICB9XG5cbiAgaWYgKGZpZWxkLmxlbmd0aCA+IDAgfHwgcm93Lmxlbmd0aCA+IDApIHtcbiAgICByb3cucHVzaChmaWVsZCk7XG4gICAgcm93cy5wdXNoKHJvdyk7XG4gIH1cblxuICByZXR1cm4gcm93cy5maWx0ZXIoKHIpID0+ICEoci5sZW5ndGggPT09IDEgJiYgclswXSA9PT0gXCJcIikpO1xufVxuXG5mdW5jdGlvbiBjc3ZUb09iamVjdHModGV4dCkge1xuICBjb25zdCByb3dzID0gcGFyc2VDc3YodGV4dC5yZXBsYWNlKC9eXHVGRUZGLywgXCJcIikpO1xuICBpZiAocm93cy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgY29uc3QgaGVhZGVyID0gcm93c1swXTtcbiAgcmV0dXJuIHJvd3Muc2xpY2UoMSkubWFwKChyb3cpID0+IHtcbiAgICBjb25zdCBvYmogPSB7fTtcbiAgICBoZWFkZXIuZm9yRWFjaCgoa2V5LCBpZHgpID0+IChvYmpba2V5XSA9IHJvd1tpZHhdID8/IFwiXCIpKTtcbiAgICByZXR1cm4gb2JqO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc3BsaXRNdWx0aSh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlID8/IFwiXCIpXG4gICAgLnNwbGl0KE1VTFRJX1ZBTFVFX1NFUEFSQVRPUilcbiAgICAubWFwKChwYXJ0KSA9PiBwYXJ0LnRyaW0oKSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbi8qIE5vcm1hbGlzaWVydW5nICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG4vLyBHb29nbGUgbGllZmVydCBOdW1tZXJuIG1hbCBtaXQgbm9ybWFsZW4sIG1hbCBtaXQgZ2VzY2hcdTAwRkN0enRlblxuLy8gTGVlcnplaWNoZW4gKFUrMDBBMCkuIERhcyBhbHRlIC5yZXBsYWNlKC8gL2csIFwiXCIpIHRyYWYgbnVyIGRpZVxuLy8gbm9ybWFsZW4gLSBuZXVuIE51bW1lcm4gc3RhbmRlbiBkYWR1cmNoIG1pdCB1bnNpY2h0YmFyZW4gWmVpY2hlbiBpblxuLy8gZGVuIE5vdGl6ZW4gdW5kIHdhcmVuIG5pY2h0IGF1ZmZpbmRiYXIuIFVuZCBvaG5lIGVpbmhlaXRsaWNoZXMgRm9ybWF0XG4vLyBzY2hsXHUwMEU0Z3QgZGllIFp1b3JkbnVuZyBcdTAwRkNiZXIgZGllIFRlbGVmb25udW1tZXIgZmVobC5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVBob25lKHJhdykge1xuICBsZXQgcGhvbmUgPSBTdHJpbmcocmF3ID8/IFwiXCIpLnJlcGxhY2UoL1tcXHNcdTAwQTBcdTIwMkZcdTIwMDkoKS8uLV0vZywgXCJcIik7XG4gIGlmICghcGhvbmUpIHJldHVybiBcIlwiO1xuICBpZiAocGhvbmUuc3RhcnRzV2l0aChcIjAwXCIpKSBwaG9uZSA9IFwiK1wiICsgcGhvbmUuc2xpY2UoMik7XG4gIGVsc2UgaWYgKHBob25lLnN0YXJ0c1dpdGgoXCIwXCIpKSBwaG9uZSA9IFwiKzQ5XCIgKyBwaG9uZS5zbGljZSgxKTtcbiAgcmV0dXJuIHBob25lLnJlcGxhY2UoL15cXCs0OTAvLCBcIis0OVwiKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRW1haWwocmF3KSB7XG4gIHJldHVybiBTdHJpbmcocmF3ID8/IFwiXCIpXG4gICAgLnRyaW0oKVxuICAgIC50b0xvd2VyQ2FzZSgpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb3VudHJ5KHJhdykge1xuICBjb25zdCB2YWx1ZSA9IFN0cmluZyhyYXcgPz8gXCJcIikudHJpbSgpO1xuICByZXR1cm4gQ09VTlRSWV9OQU1FU1t2YWx1ZS50b1VwcGVyQ2FzZSgpXSA/PyB2YWx1ZTtcbn1cblxuLy8gWndlaSBFaWdlbmhlaXRlbiBkZXMgR29vZ2xlLUV4cG9ydHM6IG1hbmNoZSBBZHJlc3NlbiBrb21tZW4gaW5cbi8vIFVTLVJlaWhlbmZvbGdlIChcIjUgU2NoYW56ZW5zdHJhXHUwMERGZVwiKSwgdW5kIFwiU3RyYVx1MDBERmVcIiBpc3QgZ2VsZWdlbnRsaWNoXG4vLyBhYmdla1x1MDBGQ3J6dC4gRXJzdCBhdXNzY2hyZWliZW4sIGRhbm4gZHJlaGVuIC0gc29uc3Qgc3RlaHQgZGFzIFwiU3RyXCJcbi8vIG5hY2ggZGVtIERyZWhlbiBuaWNodCBtZWhyIGFtIFdvcnRlbmRlLlxuZnVuY3Rpb24gbm9ybWFsaXplU3RyZWV0KHJhdykge1xuICBsZXQgc3RyZWV0ID0gU3RyaW5nKHJhdyA/PyBcIlwiKVxuICAgIC50cmltKClcbiAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIik7XG4gIGlmICghc3RyZWV0KSByZXR1cm4gXCJcIjtcbiAgc3RyZWV0ID0gc3RyZWV0LnJlcGxhY2UoLyhbYS16XHUwMEU0XHUwMEY2XHUwMEZDXHUwMERGXSlzdHJcXC4/KD89XFxzfCQpL2csIFwiJDFzdHJhXHUwMERGZVwiKTtcbiAgc3RyZWV0ID0gc3RyZWV0LnJlcGxhY2UoL1xcYlN0clxcLj8oPz1cXHN8JCkvZywgXCJTdHJhXHUwMERGZVwiKTtcbiAgY29uc3QgdXNPcmRlciA9IHN0cmVldC5tYXRjaCgvXihcXGQrXFxzP1thLXpBLVpdPylcXHMrKFxcRC4qKSQvKTtcbiAgaWYgKHVzT3JkZXIpIHN0cmVldCA9IGAke3VzT3JkZXJbMl0udHJpbSgpfSAke3VzT3JkZXJbMV0ucmVwbGFjZSgvXFxzL2csIFwiXCIpfWA7XG4gIHJldHVybiBzdHJlZXQ7XG59XG5cbi8vIEdlYnVydHN0YWdlIG9obmUgSmFociBrb21tZW4gYWxzIFwiLS1NTS1UVFwiLiBEYXMgU2VudGluZWwtSmFociAwMDAxXG4vLyBibGVpYnQgYmV3dXNzdCBlcmhhbHRlbjogZGllIEZvcm1lbCBpbiB+S29udGFrdGUuYmFzZSBiYXV0IGRhcyBEYXR1bVxuLy8gb2huZWhpbiBtaXQgZGVtIGxhdWZlbmRlbiBKYWhyIG5ldSB6dXNhbW1lbiB1bmQgaWdub3JpZXJ0IGRhcyBKYWhyLlxuZnVuY3Rpb24gbm9ybWFsaXplQmlydGhkYXkocmF3KSB7XG4gIGNvbnN0IHZhbHVlID0gU3RyaW5nKHJhdyA/PyBcIlwiKS50cmltKCk7XG4gIHJldHVybiB2YWx1ZS5zdGFydHNXaXRoKFwiLS1cIikgPyBcIjAwMDFcIiArIHZhbHVlLnNsaWNlKDEpIDogdmFsdWU7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVRhZyhyYXcpIHtcbiAgcmV0dXJuIFN0cmluZyhyYXcgPz8gXCJcIilcbiAgICAudHJpbSgpXG4gICAgLnRvTG93ZXJDYXNlKClcbiAgICAucmVwbGFjZSgvXFxzKy9nLCBcIl9cIik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyogQ1NWLVplaWxlIC0+IEtvbnRha3QgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbi8vIFNhbW1lbHQgYWxsZSBUZWxlZm9ubnVtbWVybiBlaW5lciBaZWlsZSAoUGhvbmUgMSBrYW5uIG1laHJlcmVcbi8vIFwiOjo6XCItZ2V0cmVubnRlIFdlcnRlIGVudGhhbHRlbiwgUGhvbmUgMiBrb21tdCBzZXBhcmF0KSwgbm9ybWFsaXNpZXJ0XG4vLyBzaWUgdW5kIHdpcmZ0IER1YmxldHRlbiByYXVzIC0gR29vZ2xlIGV4cG9ydGllcnQgZGllc2VsYmUgTnVtbWVyIGdlcm5cbi8vIHp3ZWltYWwgaGludGVyZWluYW5kZXIuXG5mdW5jdGlvbiBjb2xsZWN0UGhvbmVzKHJvdykge1xuICBjb25zdCBtb2JpbGUgPSBbXTtcbiAgY29uc3QgbGFuZGxpbmUgPSBbXTtcbiAgZm9yIChjb25zdCB2YWx1ZSBvZiBzcGxpdE11bHRpKHJvd1tcIlBob25lIDEgLSBWYWx1ZVwiXSkpIHtcbiAgICBjb25zdCBwaG9uZSA9IG5vcm1hbGl6ZVBob25lKHZhbHVlKTtcbiAgICBpZiAocGhvbmUgJiYgIW1vYmlsZS5pbmNsdWRlcyhwaG9uZSkpIG1vYmlsZS5wdXNoKHBob25lKTtcbiAgfVxuICBmb3IgKGNvbnN0IHZhbHVlIG9mIHNwbGl0TXVsdGkocm93W1wiUGhvbmUgMiAtIFZhbHVlXCJdKSkge1xuICAgIGNvbnN0IHBob25lID0gbm9ybWFsaXplUGhvbmUodmFsdWUpO1xuICAgIGlmIChwaG9uZSAmJiAhbW9iaWxlLmluY2x1ZGVzKHBob25lKSAmJiAhbGFuZGxpbmUuaW5jbHVkZXMocGhvbmUpKSBsYW5kbGluZS5wdXNoKHBob25lKTtcbiAgfVxuICByZXR1cm4geyBtb2JpbGUsIGxhbmRsaW5lIH07XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RFbWFpbHMocm93KSB7XG4gIGNvbnN0IGVtYWlscyA9IFtdO1xuICBmb3IgKGNvbnN0IGNvbHVtbiBvZiBbXCJFLW1haWwgMSAtIFZhbHVlXCIsIFwiRS1tYWlsIDIgLSBWYWx1ZVwiLCBcIkUtbWFpbCAzIC0gVmFsdWVcIl0pIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHNwbGl0TXVsdGkocm93W2NvbHVtbl0pKSB7XG4gICAgICBjb25zdCBlbWFpbCA9IG5vcm1hbGl6ZUVtYWlsKHZhbHVlKTtcbiAgICAgIGlmIChlbWFpbCAmJiAhZW1haWxzLmluY2x1ZGVzKGVtYWlsKSkgZW1haWxzLnB1c2goZW1haWwpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZW1haWxzO1xufVxuXG5mdW5jdGlvbiBjb2xsZWN0VGFncyhyb3cpIHtcbiAgY29uc3QgbGFiZWxzID0gc3BsaXRNdWx0aShyb3dbXCJMYWJlbHNcIl0pO1xuICBjb25zdCB0YWdzID0gW107XG4gIGZvciAoY29uc3QgbGFiZWwgb2YgbGFiZWxzKSB7XG4gICAgaWYgKElHTk9SRURfTEFCRUxTLmhhcyhsYWJlbCkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHRhZyA9IG5vcm1hbGl6ZVRhZyhsYWJlbCk7XG4gICAgaWYgKHRhZyAmJiAhdGFncy5pbmNsdWRlcyh0YWcpKSB0YWdzLnB1c2godGFnKTtcbiAgfVxuICBpZiAobGFiZWxzLmluY2x1ZGVzKFNUQVJSRURfTEFCRUwpICYmICF0YWdzLmluY2x1ZGVzKFwiZmF2b3JpdFwiKSkgdGFncy5wdXNoKFwiZmF2b3JpdFwiKTtcbiAgcmV0dXJuIHRhZ3M7XG59XG5cbi8vIEplZGUgQWJ3ZWljaHVuZyB6d2lzY2hlbiBSb2h3ZXJ0IHVuZCBub3JtYWxpc2llcnRlbSBXZXJ0IGxhbmRldCBpbVxuLy8gQmVyaWNodCwgZGFtaXQgbmFjaHZvbGx6aWVoYmFyIGJsZWlidCwgd2FzIGRlciBJbXBvcnQgc3RpbGxzY2h3ZWlnZW5kXG4vLyBnZXJhZGVnZXpvZ2VuIGhhdC5cbmZ1bmN0aW9uIG5vdGVDb3JyZWN0aW9uKGNvcnJlY3Rpb25zLCBuYW1lLCBmaWVsZCwgZnJvbSwgdG8pIHtcbiAgaWYgKGZyb20gPT09IHRvIHx8ICFmcm9tKSByZXR1cm47XG4gIGNvcnJlY3Rpb25zLnB1c2goeyBuYW1lLCBmaWVsZCwgZnJvbSwgdG8gfSk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQ29udGFjdChyb3csIGNvcnJlY3Rpb25zLCBub3JtYWxpemUpIHtcbiAgY29uc3QgZmlyc3ROYW1lID0gKHJvd1tcIkZpcnN0IE5hbWVcIl0gfHwgXCJcIikudHJpbSgpO1xuICBjb25zdCBsYXN0TmFtZSA9IChyb3dbXCJMYXN0IE5hbWVcIl0gfHwgXCJcIikudHJpbSgpO1xuXG4gIGxldCBiYXNlTmFtZSA9IFwiXCI7XG4gIGlmIChmaXJzdE5hbWUgJiYgbGFzdE5hbWUpIGJhc2VOYW1lID0gYCR7Zmlyc3ROYW1lfSAke2xhc3ROYW1lfWA7XG4gIGVsc2UgaWYgKGZpcnN0TmFtZSB8fCBsYXN0TmFtZSkgYmFzZU5hbWUgPSBmaXJzdE5hbWUgfHwgbGFzdE5hbWU7XG5cbiAgY29uc3QgZGF0YSA9IHt9O1xuICBmb3IgKGNvbnN0IFtjb2x1bW4sIGtleV0gb2YgT2JqZWN0LmVudHJpZXMoQ09MVU1OX01BUFBJTkcpKSB7XG4gICAgY29uc3QgcmF3ID0gKHJvd1tjb2x1bW5dIHx8IFwiXCIpLnRyaW0oKTtcbiAgICBpZiAoIXJhdykgY29udGludWU7XG4gICAgbGV0IHZhbHVlID0gcmF3O1xuICAgIGlmIChrZXkgPT09IFwiR2VidXJ0c3RhZ1wiKSB2YWx1ZSA9IG5vcm1hbGl6ZUJpcnRoZGF5KHJhdyk7XG4gICAgZWxzZSBpZiAobm9ybWFsaXplICYmIGtleSA9PT0gXCJOYXRpb25cIikgdmFsdWUgPSBub3JtYWxpemVDb3VudHJ5KHJhdyk7XG4gICAgZWxzZSBpZiAobm9ybWFsaXplICYmIGtleSA9PT0gXCJTdHJhc3NlXCIpIHZhbHVlID0gbm9ybWFsaXplU3RyZWV0KHJhdyk7XG4gICAgbm90ZUNvcnJlY3Rpb24oY29ycmVjdGlvbnMsIGJhc2VOYW1lLCBrZXksIHJhdywgdmFsdWUpO1xuICAgIGRhdGFba2V5XSA9IHZhbHVlO1xuICB9XG5cbiAgY29uc3QgeyBtb2JpbGUsIGxhbmRsaW5lIH0gPSBjb2xsZWN0UGhvbmVzKHJvdyk7XG4gIGlmIChtb2JpbGVbMF0pIHtcbiAgICBub3RlQ29ycmVjdGlvbihjb3JyZWN0aW9ucywgYmFzZU5hbWUsIFwiSGFuZHludW1tZXJcIiwgc3BsaXRNdWx0aShyb3dbXCJQaG9uZSAxIC0gVmFsdWVcIl0pWzBdID8/IFwiXCIsIG1vYmlsZVswXSk7XG4gICAgZGF0YVtcIkhhbmR5bnVtbWVyXCJdID0gbW9iaWxlWzBdO1xuICB9XG4gIGlmIChtb2JpbGUubGVuZ3RoID4gMSkgZGF0YVtcIkhhbmR5bnVtbWVyLUFsdFwiXSA9IG1vYmlsZS5sZW5ndGggPT09IDIgPyBtb2JpbGVbMV0gOiBtb2JpbGUuc2xpY2UoMSk7XG4gIGlmIChsYW5kbGluZS5sZW5ndGggPiAwKSBkYXRhW1wiRmVzdG5ldHpcIl0gPSBsYW5kbGluZS5sZW5ndGggPT09IDEgPyBsYW5kbGluZVswXSA6IGxhbmRsaW5lO1xuXG4gIGNvbnN0IGVtYWlscyA9IGNvbGxlY3RFbWFpbHMocm93KTtcbiAgaWYgKGVtYWlsc1swXSkge1xuICAgIGlmIChub3JtYWxpemUpIG5vdGVDb3JyZWN0aW9uKGNvcnJlY3Rpb25zLCBiYXNlTmFtZSwgXCJFLU1haWxcIiwgc3BsaXRNdWx0aShyb3dbXCJFLW1haWwgMSAtIFZhbHVlXCJdKVswXSA/PyBcIlwiLCBlbWFpbHNbMF0pO1xuICAgIGRhdGFbXCJFLU1haWxcIl0gPSBlbWFpbHNbMF07XG4gIH1cbiAgaWYgKGVtYWlscy5sZW5ndGggPiAxKSBkYXRhW1wiRS1NYWlsLUFsdFwiXSA9IGVtYWlscy5sZW5ndGggPT09IDIgPyBlbWFpbHNbMV0gOiBlbWFpbHMuc2xpY2UoMSk7XG5cbiAgY29uc3QgdGFncyA9IGNvbGxlY3RUYWdzKHJvdyk7XG4gIGlmICh0YWdzLmxlbmd0aCA+IDApIGRhdGFbXCJ0YWdzXCJdID0gdGFncztcblxuICByZXR1cm4ge1xuICAgIGJhc2VOYW1lLFxuICAgIGRhdGEsXG4gICAgcGhvbmVzOiBbLi4ubW9iaWxlLCAuLi5sYW5kbGluZV0sXG4gICAgZW1haWxzLFxuICAgIGJvZHk6IChyb3dbXCJOb3Rlc1wiXSB8fCBcIlwiKS50cmltKCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGlzUmVsZXZhbnQoY29udGFjdCkge1xuICByZXR1cm4gQm9vbGVhbihjb250YWN0LmRhdGEuR2VidXJ0c3RhZykgfHwgKGNvbnRhY3QuZGF0YS50YWdzPy5sZW5ndGggPz8gMCkgPiAwO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbi8qIFRZUC1TeXN0ZW0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG5mdW5jdGlvbiBnZXRUeXBTeXN0ZW0oYXBwKSB7XG4gIHJldHVybiBhcHAucGx1Z2lucy5wbHVnaW5zW1widHlwLXN5c3RlbVwiXSA/PyBudWxsO1xufVxuXG4vLyBEaWUgRmVsZGxpc3RlIGtvbW10IGF1cyBkZW0gVFlQLVN5c3RlbSwgZGFtaXQgc2llIG51ciBhbiBlaW5lciBTdGVsbGVcbi8vIGdlcGZsZWd0IHdlcmRlbiBtdXNzLiBMXHUwMEU0dWZ0IGVzIG5pY2h0LCBncmVpZnQgZGllIGludGVybmUgTGlzdGUuXG5mdW5jdGlvbiBjb250YWN0UHJvcGVydHlLZXlzKGFwcCwgdHlwKSB7XG4gIGNvbnN0IGRlZmF1bHRzID0gZ2V0VHlwU3lzdGVtKGFwcCk/LmdldFR5cGVEZWZhdWx0cz8uKHR5cCwgeyBpbmNsdWRlRmxvYXRpbmc6IHRydWUgfSk7XG4gIGNvbnN0IGtleXMgPSBkZWZhdWx0cyA/IE9iamVjdC5rZXlzKGRlZmF1bHRzKSA6IG51bGw7XG4gIHJldHVybiBrZXlzICYmIGtleXMubGVuZ3RoID4gMCA/IGtleXMgOiBGQUxMQkFDS19DT05UQUNUX0tFWVM7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyogQmVzdGVoZW5kZSBOb3RpemVuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbmZ1bmN0aW9uIHRvQXJyYXkodmFsdWUpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSBcIlwiKSByZXR1cm4gW107XG4gIHJldHVybiBbdmFsdWVdO1xufVxuXG4vLyBEZXIgRGF0ZWluYW1lIHdhciBiaXNoZXIgZGVyIGVpbnppZ2UgU2NobFx1MDBGQ3NzZWwgLSBlaW5lIFVtYmVuZW5udW5nIGluXG4vLyBHb29nbGUgZXJ6ZXVndGUgZGFkdXJjaCBlaW4gRHVwbGlrYXQgdW5kIGxpZVx1MDBERiBkaWUgYWx0ZSBOb3RpeiBtaXQgaWhyZW5cbi8vIEZhbWlsaWUtL0ZyZXVuZGUtQmFja2xpbmtzIHZlcndhaXN0IHp1clx1MDBGQ2NrLiBUZWxlZm9ubnVtbWVyIHVuZCBFLU1haWxcbi8vIHN0ZWhlbiBvaG5laGluIHNjaG9uIGluIGRlbiBOb3RpemVuIHVuZCBzaW5kIFx1MDBGQ2JlciBkZW4gQmVzdGFuZCBlaW5kZXV0aWcsXG4vLyB0YXVnZW4gYWxzbyBhbHMgSWRlbnRpdFx1MDBFNHQsIG9obmUgZGFzcyBlaW5lIHRlY2huaXNjaGUgSUQgblx1MDBGNnRpZyB3XHUwMEU0cmUuXG5mdW5jdGlvbiBidWlsZE5vdGVJbmRleChhcHAsIGJhc2VEaXIsIHR5cCkge1xuICBjb25zdCBieVBob25lID0gbmV3IE1hcCgpO1xuICBjb25zdCBieUVtYWlsID0gbmV3IE1hcCgpO1xuICBjb25zdCBieU5hbWUgPSBuZXcgTWFwKCk7XG4gIGNvbnN0IG5vdGVzID0gW107XG5cbiAgZm9yIChjb25zdCBmaWxlIG9mIGFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkpIHtcbiAgICBpZiAoIWlzSW5Gb2xkZXIoZmlsZS5wYXRoLCBiYXNlRGlyKSkgY29udGludWU7XG4gICAgY29uc3QgZnJvbnRtYXR0ZXIgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyID8/IHt9O1xuICAgIGlmIChTdHJpbmcoZnJvbnRtYXR0ZXIuVFlQID8/IGZyb250bWF0dGVyLnR5cCA/PyBcIlwiKSAhPT0gdHlwKSBjb250aW51ZTtcblxuICAgIGNvbnN0IGVudHJ5ID0geyBmaWxlLCBmcm9udG1hdHRlciB9O1xuICAgIG5vdGVzLnB1c2goZW50cnkpO1xuXG4gICAgZm9yIChjb25zdCBrZXkgb2YgW1wiSGFuZHludW1tZXJcIiwgXCJIYW5keW51bW1lci1BbHRcIiwgXCJGZXN0bmV0elwiXSkge1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB0b0FycmF5KGZyb250bWF0dGVyW2tleV0pKSB7XG4gICAgICAgIGNvbnN0IHBob25lID0gbm9ybWFsaXplUGhvbmUodmFsdWUpO1xuICAgICAgICBpZiAocGhvbmUgJiYgIWJ5UGhvbmUuaGFzKHBob25lKSkgYnlQaG9uZS5zZXQocGhvbmUsIGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBrZXkgb2YgW1wiRS1NYWlsXCIsIFwiRS1NYWlsLUFsdFwiXSkge1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB0b0FycmF5KGZyb250bWF0dGVyW2tleV0pKSB7XG4gICAgICAgIGNvbnN0IGVtYWlsID0gbm9ybWFsaXplRW1haWwodmFsdWUpO1xuICAgICAgICBpZiAoZW1haWwgJiYgIWJ5RW1haWwuaGFzKGVtYWlsKSkgYnlFbWFpbC5zZXQoZW1haWwsIGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbmFtZSA9IGZpbGUuYmFzZW5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoIWJ5TmFtZS5oYXMobmFtZSkpIGJ5TmFtZS5zZXQobmFtZSwgZW50cnkpO1xuICB9XG5cbiAgcmV0dXJuIHsgYnlQaG9uZSwgYnlFbWFpbCwgYnlOYW1lLCBub3RlcyB9O1xufVxuXG5mdW5jdGlvbiBtYXRjaE5vdGUoaW5kZXgsIGNvbnRhY3QsIHRha2VuKSB7XG4gIGZvciAoY29uc3QgcGhvbmUgb2YgY29udGFjdC5waG9uZXMpIHtcbiAgICBjb25zdCBoaXQgPSBpbmRleC5ieVBob25lLmdldChwaG9uZSk7XG4gICAgaWYgKGhpdCAmJiAhdGFrZW4uaGFzKGhpdC5maWxlLnBhdGgpKSByZXR1cm4geyBlbnRyeTogaGl0LCB2aWE6IFwiVGVsZWZvblwiIH07XG4gIH1cbiAgZm9yIChjb25zdCBlbWFpbCBvZiBjb250YWN0LmVtYWlscykge1xuICAgIGNvbnN0IGhpdCA9IGluZGV4LmJ5RW1haWwuZ2V0KGVtYWlsKTtcbiAgICBpZiAoaGl0ICYmICF0YWtlbi5oYXMoaGl0LmZpbGUucGF0aCkpIHJldHVybiB7IGVudHJ5OiBoaXQsIHZpYTogXCJFLU1haWxcIiB9O1xuICB9XG4gIGNvbnN0IGhpdCA9IGluZGV4LmJ5TmFtZS5nZXQoY29udGFjdC5iYXNlTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgaWYgKGhpdCAmJiAhdGFrZW4uaGFzKGhpdC5maWxlLnBhdGgpKSByZXR1cm4geyBlbnRyeTogaGl0LCB2aWE6IFwiTmFtZVwiIH07XG4gIHJldHVybiBudWxsO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbi8qIEVpbmRldXRpZ2UgRGF0ZWluYW1lbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG4vLyBHbGVpY2huYW1pZ2UgS29udGFrdGUgXHUwMEZDYmVyc2NocmllYmVuIHNpY2ggYmlzaGVyIGdlZ2Vuc2VpdGlnLCBvaG5lIGRhc3Ncbi8vIGVzIGF1ZmZpZWwgLSBpbSBCZXN0YW5kIGJldHJpZmZ0IGRhcyAxNSBOYW1lbi4gRGVyIFp1c2F0eiBrb21tdCBhdXMgZGVuXG4vLyBsZXR6dGVuIHZpZXIgWmlmZmVybiBkZXIgSGFuZHludW1tZXIsIHdlaWwgZGllIFx1MDBGQ2JlciBMXHUwMEU0dWZlIGhpbndlZyBzdGFiaWxcbi8vIGlzdDsgZWluZSBEdXJjaG51bW1lcmllcnVuZyBoaW5nZSBkYWdlZ2VuIGFuIGRlciBDU1YtWmVpbGVucmVpaGVuZm9sZ2Vcbi8vIHVuZCBrXHUwMEY2bm50ZSBiZWltIG5cdTAwRTRjaHN0ZW4gRXhwb3J0IFdlcnRlIHp3aXNjaGVuIE5vdGl6ZW4gdmVyc2NoaWViZW4uXG5mdW5jdGlvbiB1bmlxdWVTdWZmaXgoY29udGFjdCkge1xuICBjb25zdCBwaG9uZSA9IGNvbnRhY3QucGhvbmVzWzBdO1xuICBpZiAocGhvbmUgJiYgcGhvbmUubGVuZ3RoID49IDQpIHJldHVybiBwaG9uZS5zbGljZSgtNCk7XG4gIGNvbnN0IGVtYWlsID0gY29udGFjdC5lbWFpbHNbMF07XG4gIGlmIChlbWFpbCkge1xuICAgIC8vIFxcVyB3XHUwMEZDcmRlIFVtbGF1dGUgbWl0ZW50ZmVybmVuIChcImJcdTAwRjZsdGVcIiAtPiBcImJsdGVcIik7IFxccHtMfSBtaXQgdS1GbGFnXG4gICAgLy8gYmVoXHUwMEU0bHQgc2llIHVuZCB3aXJmdCBudXIgUHVua3RlLCBQbHVzIHVuZCBcdTAwQzRobmxpY2hlcyByYXVzLlxuICAgIGNvbnN0IGxvY2FsID0gZW1haWwuc3BsaXQoXCJAXCIpWzBdLnJlcGxhY2UoL1teXFxwe0x9XFxwe059XS9ndSwgXCJcIik7XG4gICAgaWYgKGxvY2FsLmxlbmd0aCA+PSA0KSByZXR1cm4gbG9jYWwuc2xpY2UoLTQpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBhc3NpZ25GaWxlTmFtZXMoY29udGFjdHMsIHNraXBwZWQpIHtcbiAgY29uc3QgYnlOYW1lID0gbmV3IE1hcCgpO1xuICBmb3IgKGNvbnN0IGNvbnRhY3Qgb2YgY29udGFjdHMpIHtcbiAgICBjb25zdCBrZXkgPSBjb250YWN0LmJhc2VOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKCFieU5hbWUuaGFzKGtleSkpIGJ5TmFtZS5zZXQoa2V5LCBbXSk7XG4gICAgYnlOYW1lLmdldChrZXkpLnB1c2goY29udGFjdCk7XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBbXTtcbiAgZm9yIChjb25zdCBncm91cCBvZiBieU5hbWUudmFsdWVzKCkpIHtcbiAgICBpZiAoZ3JvdXAubGVuZ3RoID09PSAxKSB7XG4gICAgICBncm91cFswXS5maWxlTmFtZSA9IHNhbml0aXplRmlsZU5hbWUoZ3JvdXBbMF0uYmFzZU5hbWUpO1xuICAgICAgcmVzdWx0LnB1c2goZ3JvdXBbMF0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHVzZWQgPSBuZXcgU2V0KCk7XG4gICAgZm9yIChjb25zdCBjb250YWN0IG9mIGdyb3VwKSB7XG4gICAgICBjb25zdCBzdWZmaXggPSB1bmlxdWVTdWZmaXgoY29udGFjdCk7XG4gICAgICBpZiAoIXN1ZmZpeCB8fCB1c2VkLmhhcyhzdWZmaXgpKSB7XG4gICAgICAgIHNraXBwZWQucHVzaCh7XG4gICAgICAgICAgbmFtZTogY29udGFjdC5iYXNlTmFtZSxcbiAgICAgICAgICByZWFzb246IHN1ZmZpeCA/IFwiZ2xlaWNoZXIgTmFtZW5zenVzYXR6IHdpZSBlaW4gYW5kZXJlciBLb250YWt0XCIgOiBcIk5hbWVuc2dsZWljaGhlaXQgb2huZSBOdW1tZXIgb2RlciBFLU1haWxcIixcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdXNlZC5hZGQoc3VmZml4KTtcbiAgICAgIGNvbnRhY3QuZmlsZU5hbWUgPSBzYW5pdGl6ZUZpbGVOYW1lKGAke2NvbnRhY3QuYmFzZU5hbWV9ICgke3N1ZmZpeH0pYCk7XG4gICAgICByZXN1bHQucHVzaChjb250YWN0KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG4vKiBQbGFuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cblxuZnVuY3Rpb24gdmFsdWVzRXF1YWwoYSwgYikge1xuICBpZiAoQXJyYXkuaXNBcnJheShhKSB8fCBBcnJheS5pc0FycmF5KGIpKSB7XG4gICAgY29uc3QgeCA9IHRvQXJyYXkoYSkubWFwKFN0cmluZyk7XG4gICAgY29uc3QgeSA9IHRvQXJyYXkoYikubWFwKFN0cmluZyk7XG4gICAgcmV0dXJuIHgubGVuZ3RoID09PSB5Lmxlbmd0aCAmJiB4LmV2ZXJ5KCh2LCBpKSA9PiB2ID09PSB5W2ldKTtcbiAgfVxuICBpZiAoYSA9PT0gdW5kZWZpbmVkIHx8IGEgPT09IG51bGwgfHwgYSA9PT0gXCJcIikgcmV0dXJuIGIgPT09IHVuZGVmaW5lZCB8fCBiID09PSBudWxsIHx8IGIgPT09IFwiXCI7XG4gIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbn1cblxuLy8gdGFncyB3ZXJkZW4genVzYW1tZW5nZWZcdTAwRkNocnQgc3RhdHQgZXJzZXR6dDogaW4gZGVuIE5vdGl6ZW4gc3RlaGVuIGF1Y2hcbi8vIFRhZ3MsIGRpZSBuaWUgYXVzIEdvb2dsZSBrYW1lbi5cbmZ1bmN0aW9uIG1lcmdlVGFncyhleGlzdGluZywgaW5jb21pbmcpIHtcbiAgcmV0dXJuIFsuLi5uZXcgU2V0KFsuLi50b0FycmF5KGluY29taW5nKS5tYXAoU3RyaW5nKSwgLi4udG9BcnJheShleGlzdGluZykubWFwKFN0cmluZyldKV07XG59XG5cbi8vIFNvbGx3ZXJ0ZSBnZWdlbiBkZW4gSXN0LVp1c3RhbmQgZGVyIE5vdGl6LiBMaWVmZXJ0IGRpZSBDU1YgenUgZWluZXJcbi8vIFByb3BlcnR5IG5pY2h0cyBtZWhyLCBvYndvaGwgaWhyZSBRdWVsbHNwYWx0ZSBpbSBFeHBvcnQgdm9ya29tbXQsIGdpbHRcbi8vIGRlciBXZXJ0IGFscyBpbiBHb29nbGUgZ2VsXHUwMEY2c2NodCB1bmQgd2lyZCB6dXIgRW50ZmVybnVuZyB2b3JnZW1lcmt0XG4vLyAodG86IHVuZGVmaW5lZCkgLSB3YXMgZGFubiBqZSBuYWNoIEtvbmZsaWt0LU1vZHVzIGdyZWlmdCBvZGVyIG5pY2h0LlxuLy8gdGFncyBzaW5kIGRhdm9uIGF1c2dlbm9tbWVuOiBkb3J0IHN0ZWhlbiBhdWNoIFRhZ3MsIGRpZSBuaWUgYXVzIEdvb2dsZVxuLy8ga2FtZW4sIGRlc2hhbGIgd2lyZCBudXIgenVzYW1tZW5nZWZcdTAwRkNocnQsIG5pZSBlbnRmZXJudC5cbmZ1bmN0aW9uIGJ1aWxkQ2hhbmdlcyhjb250YWN0LCBmcm9udG1hdHRlciwgb3duZWRLZXlzLCByZW1vdmFibGVLZXlzKSB7XG4gIGNvbnN0IGNoYW5nZXMgPSBbXTtcbiAgZm9yIChjb25zdCBrZXkgb2Ygb3duZWRLZXlzKSB7XG4gICAgbGV0IHZhbHVlID0gY29udGFjdC5kYXRhW2tleV07XG4gICAgaWYgKGtleSA9PT0gXCJ0YWdzXCIpIHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkICYmIHRvQXJyYXkoZnJvbnRtYXR0ZXIudGFncykubGVuZ3RoID09PSAwKSBjb250aW51ZTtcbiAgICAgIHZhbHVlID0gbWVyZ2VUYWdzKGZyb250bWF0dGVyLnRhZ3MsIHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gZnJvbnRtYXR0ZXJba2V5XTtcbiAgICAgIGNvbnN0IGhhc0V4aXN0aW5nID0gIShleGlzdGluZyA9PT0gdW5kZWZpbmVkIHx8IGV4aXN0aW5nID09PSBudWxsIHx8IGV4aXN0aW5nID09PSBcIlwiIHx8IHRvQXJyYXkoZXhpc3RpbmcpLmxlbmd0aCA9PT0gMCk7XG4gICAgICBpZiAoIWhhc0V4aXN0aW5nIHx8ICFyZW1vdmFibGVLZXlzPy5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICBjaGFuZ2VzLnB1c2goeyBrZXksIGZyb206IGV4aXN0aW5nLCB0bzogdW5kZWZpbmVkIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmICh2YWx1ZXNFcXVhbChmcm9udG1hdHRlcltrZXldLCB2YWx1ZSkpIGNvbnRpbnVlO1xuICAgIGNoYW5nZXMucHVzaCh7IGtleSwgZnJvbTogZnJvbnRtYXR0ZXJba2V5XSwgdG86IHZhbHVlIH0pO1xuICB9XG4gIHJldHVybiBjaGFuZ2VzO1xufVxuXG4vLyBEZXJzZWxiZSBXZXJ0IGluIGFuZGVyZXIgU2NocmVpYndlaXNlLCBhdWYgZWluZSBWZXJnbGVpY2hzZm9ybSBnZWJyYWNodC5cbi8vIE5cdTAwRjZ0aWcsIGRhbWl0IGVpbmUgTm9ybWFsaXNpZXJ1bmcgbmljaHQgYWxzIEtvbmZsaWt0IGR1cmNoZ2VodDogaW4gZGVyXG4vLyBOb3RpeiBzdGVodCBcIis0OSAxNzcgMzA3MjE3N1wiLCBkaWUgQ1NWIGxpZWZlcnQgZGllc2VsYmUgTnVtbWVyIC0gZGFzIGlzdFxuLy8ga2VpbmUgQWJ3ZWljaHVuZywgXHUwMEZDYmVyIGRpZSBtYW4gZGVuIE51dHplciBiZWZyYWdlbiBtXHUwMEZDc3N0ZS5cbmZ1bmN0aW9uIGNhbm9uaWNhbFZhbHVlKGtleSwgdmFsdWUpIHtcbiAgY29uc3QgcGFydHMgPSB0b0FycmF5KHZhbHVlKS5tYXAoU3RyaW5nKTtcbiAgaWYgKGtleSA9PT0gXCJIYW5keW51bW1lclwiIHx8IGtleSA9PT0gXCJIYW5keW51bW1lci1BbHRcIiB8fCBrZXkgPT09IFwiRmVzdG5ldHpcIikge1xuICAgIHJldHVybiBwYXJ0cy5tYXAobm9ybWFsaXplUGhvbmUpLmpvaW4oXCJ8XCIpO1xuICB9XG4gIGlmIChrZXkgPT09IFwiRS1NYWlsXCIgfHwga2V5ID09PSBcIkUtTWFpbC1BbHRcIikgcmV0dXJuIHBhcnRzLm1hcChub3JtYWxpemVFbWFpbCkuam9pbihcInxcIik7XG4gIGlmIChrZXkgPT09IFwiTmF0aW9uXCIpIHJldHVybiBwYXJ0cy5tYXAobm9ybWFsaXplQ291bnRyeSkuam9pbihcInxcIik7XG4gIGlmIChrZXkgPT09IFwiU3RyYXNzZVwiKSByZXR1cm4gcGFydHMubWFwKG5vcm1hbGl6ZVN0cmVldCkuam9pbihcInxcIik7XG4gIHJldHVybiBwYXJ0cy5qb2luKFwifFwiKTtcbn1cblxuLy8gRWluZSBcdTAwQzRuZGVydW5nIGlzdCBudXIgZGFubiBlaW4gS29uZmxpa3QsIHdlbm4gZGllIE5vdGl6IHNjaG9uIGVpbmVuXG4vLyBpbmhhbHRsaWNoIGFid2VpY2hlbmRlbiBXZXJ0IGhhdHRlLiBMZWVyZSBGZWxkZXIgenUgZlx1MDBGQ2xsZW4gaXN0IG5pZSBlaW5cbi8vIEtvbmZsaWt0LCB0YWdzIHdlcmRlbiB6dXNhbW1lbmdlZlx1MDBGQ2hydCBzdGF0dCBcdTAwRkNiZXJzY2hyaWViZW4sIHVuZCBlaW5lIHJlaW5lXG4vLyBVbXNjaHJlaWJ1bmcgKFRlbGVmb25mb3JtYXQsIEdyb1x1MDBERi0vS2xlaW5zY2hyZWlidW5nLCBMXHUwMEU0bmRlcmtcdTAwRkNyemVsLCBIYXVzLVxuLy8gbnVtbWVyKSB3aXJkIGltbWVyIGFuZ2V3YW5kdCAtIHNvbnN0IGJsaWViZSBzaWUgaW0gTW9kdXMgXCJudXIgTFx1MDBGQ2NrZW5cbi8vIGZcdTAwRkNsbGVuXCIgZlx1MDBGQ3IgaW1tZXIgbGllZ2VuLlxuZnVuY3Rpb24gc3BsaXRDaGFuZ2VzKGNoYW5nZXMsIGZyb250bWF0dGVyKSB7XG4gIGNvbnN0IHBsYWluID0gW107XG4gIGNvbnN0IGNvbmZsaWN0cyA9IFtdO1xuICBmb3IgKGNvbnN0IGNoYW5nZSBvZiBjaGFuZ2VzKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBmcm9udG1hdHRlcltjaGFuZ2Uua2V5XTtcbiAgICBjb25zdCBpc0VtcHR5ID0gZXhpc3RpbmcgPT09IHVuZGVmaW5lZCB8fCBleGlzdGluZyA9PT0gbnVsbCB8fCBleGlzdGluZyA9PT0gXCJcIiB8fCB0b0FycmF5KGV4aXN0aW5nKS5sZW5ndGggPT09IDA7XG4gICAgY29uc3Qgc2FtZVZhbHVlID0gY2Fub25pY2FsVmFsdWUoY2hhbmdlLmtleSwgZXhpc3RpbmcpID09PSBjYW5vbmljYWxWYWx1ZShjaGFuZ2Uua2V5LCBjaGFuZ2UudG8pO1xuICAgIGlmIChpc0VtcHR5IHx8IHNhbWVWYWx1ZSB8fCBjaGFuZ2Uua2V5ID09PSBcInRhZ3NcIikgcGxhaW4ucHVzaChjaGFuZ2UpO1xuICAgIGVsc2UgY29uZmxpY3RzLnB1c2goY2hhbmdlKTtcbiAgfVxuICByZXR1cm4geyBjaGFuZ2VzOiBwbGFpbiwgY29uZmxpY3RzIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1aWxkUGxhbihwbHVnaW4pIHtcbiAgY29uc3QgeyBhcHAsIHNldHRpbmdzIH0gPSBwbHVnaW47XG4gIGNvbnN0IHsgYWRhcHRlciB9ID0gYXBwLnZhdWx0O1xuICBjb25zdCBjc3ZQYXRoID0gc2V0dGluZ3MuY29udGFjdHNDc3ZQYXRoO1xuICBjb25zdCBjb25maWd1cmVkRGlyID0gc2V0dGluZ3MuY29udGFjdHNCYXNlRGlyLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgY29uc3QgdHlwID0gc2V0dGluZ3MuY29udGFjdHNUeXAgfHwgXCJLT05UQUtUXCI7XG5cbiAgaWYgKCEoYXdhaXQgYWRhcHRlci5leGlzdHMoY3N2UGF0aCkpKSB0aHJvdyBuZXcgRXJyb3IoYERhdGVpIG5pY2h0IGdlZnVuZGVuOiAke2NzdlBhdGh9YCk7XG4gIGlmICghKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGNvbmZpZ3VyZWREaXIpKSkgdGhyb3cgbmV3IEVycm9yKGBCYXNpc3ZlcnplaWNobmlzIG5pY2h0IGdlZnVuZGVuOiAke2NvbmZpZ3VyZWREaXJ9YCk7XG5cbiAgY29uc3QgYmFzZURpciA9IHJlc29sdmVGb2xkZXJQYXRoKGFwcCwgY29uZmlndXJlZERpcik7XG4gIGNvbnN0IHRyYXNoRGlyID0gam9pblZhdWx0UGF0aChiYXNlRGlyLCBzZXR0aW5ncy5jb250YWN0c1RyYXNoU3ViZGlyIHx8IFwiX1RyYXNoXCIpO1xuXG4gIGNvbnN0IGNvcnJlY3Rpb25zID0gW107XG4gIGNvbnN0IHNraXBwZWQgPSBbXTtcbiAgY29uc3Qgbm9ybWFsaXplID0gc2V0dGluZ3MuY29udGFjdHNOb3JtYWxpemVFbmFibGVkICE9PSBmYWxzZTtcbiAgY29uc3Qgcm93cyA9IGNzdlRvT2JqZWN0cyhhd2FpdCBhZGFwdGVyLnJlYWQoY3N2UGF0aCkpO1xuXG4gIGxldCBjb250YWN0cyA9IFtdO1xuICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgY29uc3QgY29udGFjdCA9IGJ1aWxkQ29udGFjdChyb3csIGNvcnJlY3Rpb25zLCBub3JtYWxpemUpO1xuICAgIGlmICghY29udGFjdC5iYXNlTmFtZSkge1xuICAgICAgc2tpcHBlZC5wdXNoKHsgbmFtZTogXCIob2huZSBOYW1lbilcIiwgcmVhc29uOiBcIndlZGVyIFZvci0gbm9jaCBOYWNobmFtZVwiIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChzZXR0aW5ncy5jb250YWN0c0ZpbHRlclJlbGV2YW50ICYmICFpc1JlbGV2YW50KGNvbnRhY3QpKSBjb250aW51ZTtcbiAgICBjb250YWN0cy5wdXNoKGNvbnRhY3QpO1xuICB9XG4gIGNvbnRhY3RzID0gYXNzaWduRmlsZU5hbWVzKGNvbnRhY3RzLCBza2lwcGVkKTtcblxuICBjb25zdCBpbmRleCA9IGJ1aWxkTm90ZUluZGV4KGFwcCwgYmFzZURpciwgdHlwKTtcbiAgY29uc3QgdHlwS2V5cyA9IGNvbnRhY3RQcm9wZXJ0eUtleXMoYXBwLCB0eXApO1xuICBjb25zdCBvd25lZEtleXMgPSBuZXcgU2V0KElNUE9SVF9PV05FRF9LRVlTLmZpbHRlcigoa2V5KSA9PiBrZXkgPT09IFwidGFnc1wiIHx8IHR5cEtleXMuaW5jbHVkZXMoa2V5KSkpO1xuXG4gIC8vIE51ciBQcm9wZXJ0aWVzLCBkZXJlbiBRdWVsbHNwYWx0ZSBkaWVzZXIgRXhwb3J0IFx1MDBGQ2JlcmhhdXB0IG1pdGJyaW5ndCxcbiAgLy8gZFx1MDBGQ3JmZW4gZ2VsZWVydCB3ZXJkZW4gLSBzb25zdCByXHUwMEU0dW10IGVpbiBrbmFwcGVyZXIgRXhwb3J0IEZlbGRlciBhYixcbiAgLy8gXHUwMEZDYmVyIGRpZSBlciBnYXIga2VpbmUgQXVzc2FnZSB0cmlmZnQuXG4gIGNvbnN0IGhlYWRlciA9IG5ldyBTZXQocm93cy5sZW5ndGggPiAwID8gT2JqZWN0LmtleXMocm93c1swXSkgOiBbXSk7XG4gIGNvbnN0IHJlbW92YWJsZUtleXMgPSBuZXcgU2V0KFxuICAgIFsuLi5vd25lZEtleXNdLmZpbHRlcigoa2V5KSA9PiBrZXkgIT09IFwidGFnc1wiICYmIChTT1VSQ0VfQ09MVU1OU1trZXldID8/IFtdKS5zb21lKChjb2x1bW4pID0+IGhlYWRlci5oYXMoY29sdW1uKSkpXG4gICk7XG5cbiAgY29uc3QgYWN0aW9ucyA9IFtdO1xuICBjb25zdCB0YWtlbiA9IG5ldyBTZXQoKTtcblxuICBmb3IgKGNvbnN0IGNvbnRhY3Qgb2YgY29udGFjdHMpIHtcbiAgICBjb25zdCBtYXRjaCA9IG1hdGNoTm90ZShpbmRleCwgY29udGFjdCwgdGFrZW4pO1xuICAgIGNvbnN0IHRhcmdldFBhdGggPSBqb2luVmF1bHRQYXRoKGJhc2VEaXIsIGAke2NvbnRhY3QuZmlsZU5hbWV9Lm1kYCk7XG5cbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICBpZiAoc2V0dGluZ3MuY29udGFjdHNFZGl0T25seSkge1xuICAgICAgICBza2lwcGVkLnB1c2goeyBuYW1lOiBjb250YWN0LmJhc2VOYW1lLCByZWFzb246IFwibmV1LCBhYmVyIFx1MjAxRU51ciBiZXN0ZWhlbmRlIGFrdHVhbGlzaWVyZW5cdTIwMUMgaXN0IGFrdGl2XCIgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYWN0aW9ucy5wdXNoKHtcbiAgICAgICAga2luZDogXCJjcmVhdGVcIixcbiAgICAgICAgY29udGFjdCxcbiAgICAgICAgdGFyZ2V0UGF0aCxcbiAgICAgICAgY2hhbmdlczogYnVpbGRDaGFuZ2VzKGNvbnRhY3QsIHt9LCBvd25lZEtleXMsIHJlbW92YWJsZUtleXMpLFxuICAgICAgICBjb25mbGljdHM6IFtdLFxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0YWtlbi5hZGQobWF0Y2guZW50cnkuZmlsZS5wYXRoKTtcbiAgICBjb25zdCBzcGxpdCA9IHNwbGl0Q2hhbmdlcyhcbiAgICAgIGJ1aWxkQ2hhbmdlcyhjb250YWN0LCBtYXRjaC5lbnRyeS5mcm9udG1hdHRlciwgb3duZWRLZXlzLCByZW1vdmFibGVLZXlzKSxcbiAgICAgIG1hdGNoLmVudHJ5LmZyb250bWF0dGVyXG4gICAgKTtcbiAgICBjb25zdCByZW5hbWUgPSBtYXRjaC5lbnRyeS5maWxlLnBhdGggIT09IHRhcmdldFBhdGggPyB0YXJnZXRQYXRoIDogbnVsbDtcbiAgICBpZiAoc3BsaXQuY2hhbmdlcy5sZW5ndGggPT09IDAgJiYgc3BsaXQuY29uZmxpY3RzLmxlbmd0aCA9PT0gMCAmJiAhcmVuYW1lKSBjb250aW51ZTtcblxuICAgIGFjdGlvbnMucHVzaCh7XG4gICAgICBraW5kOiBcInVwZGF0ZVwiLFxuICAgICAgY29udGFjdCxcbiAgICAgIGZpbGU6IG1hdGNoLmVudHJ5LmZpbGUsXG4gICAgICB2aWE6IG1hdGNoLnZpYSxcbiAgICAgIHRhcmdldFBhdGgsXG4gICAgICByZW5hbWUsXG4gICAgICBjaGFuZ2VzOiBzcGxpdC5jaGFuZ2VzLFxuICAgICAgY29uZmxpY3RzOiBzcGxpdC5jb25mbGljdHMsXG4gICAgfSk7XG4gIH1cblxuICAvLyBOb3RpemVuLCB6dSBkZW5lbiBrZWluZSBDU1YtWmVpbGUgbWVociBwYXNzdDogaW4gR29vZ2xlIGdlbFx1MDBGNnNjaHQgb2RlclxuICAvLyBkdXJjaCBkZW4gUmVsZXZhbnpmaWx0ZXIgZ2VmYWxsZW4uXG4gIGNvbnN0IG9ycGhhbnMgPSBpbmRleC5ub3Rlcy5maWx0ZXIoKGVudHJ5KSA9PiAhdGFrZW4uaGFzKGVudHJ5LmZpbGUucGF0aCkgJiYgIWlzSW5Gb2xkZXIoZW50cnkuZmlsZS5wYXRoLCB0cmFzaERpcikpO1xuXG4gIHJldHVybiB7IHR5cCwgYmFzZURpciwgdHJhc2hEaXIsIGNvbnRhY3RzLCBhY3Rpb25zLCBvcnBoYW5zLCBjb3JyZWN0aW9ucywgc2tpcHBlZCwgb3duZWRLZXlzIH07XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyogS29uZmxpa3QtTW9kYWwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSBcIlwiKSByZXR1cm4gXCJcdTIwMTRcIjtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUuam9pbihcIiwgXCIpIDogU3RyaW5nKHZhbHVlKTtcbn1cblxuLy8gRWluIERpYWxvZyBqZSBiZXRyb2ZmZW5lbSBLb250YWt0LiBcIlJlc3QgYXV0b21hdGlzY2hcIiBicmljaHQgZGllIEtldHRlXG4vLyBhYiwgZGFtaXQgZWluIExhdWYgbWl0IHZpZWxlbiBBYndlaWNodW5nZW4gbmljaHQgenVtIEtsaWNrbWFyYXRob24gd2lyZC5cbmNsYXNzIENvbmZsaWN0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgYWN0aW9uLCByZXNvbHZlKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbiAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIHRoaXMuYWNjZXB0ZWQgPSBuZXcgU2V0KGFjdGlvbi5jb25mbGljdHMubWFwKChjKSA9PiBjLmtleSkpO1xuICAgIHRoaXMuYW5zd2VyZWQgPSBmYWxzZTtcbiAgfVxuXG4gIG9uT3BlbigpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCwgYWN0aW9uIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcImZyZWQta29udGFrdC1jb25mbGljdFwiKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IGFjdGlvbi5jb250YWN0LmJhc2VOYW1lIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgY2xzOiBcInNldHRpbmctaXRlbS1kZXNjcmlwdGlvblwiLFxuICAgICAgdGV4dDogYCR7YWN0aW9uLmNvbmZsaWN0cy5sZW5ndGh9IGFid2VpY2hlbmRlICR7XG4gICAgICAgIGFjdGlvbi5jb25mbGljdHMubGVuZ3RoID09PSAxID8gXCJQcm9wZXJ0eVwiIDogXCJQcm9wZXJ0aWVzXCJcbiAgICAgIH0uIEFuZ2VoYWt0IHdpcmQgZGVyIENTVi1XZXJ0IFx1MDBGQ2Jlcm5vbW1lbi5gLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBjb25mbGljdCBvZiBhY3Rpb24uY29uZmxpY3RzKSB7XG4gICAgICBjb25zdCBpc1JlbW92YWwgPSBjb25mbGljdC50byA9PT0gdW5kZWZpbmVkO1xuICAgICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgICAuc2V0TmFtZShjb25mbGljdC5rZXkgKyAoaXNSZW1vdmFsID8gXCIgIChpbiBHb29nbGUgZ2VsXHUwMEY2c2NodClcIiA6IFwiXCIpKVxuICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICBpc1JlbW92YWxcbiAgICAgICAgICAgID8gYE5vdGl6OiAke2Zvcm1hdFZhbHVlKGNvbmZsaWN0LmZyb20pfSAgIFx1MjE5MiAgIGF1cyBkZXIgTm90aXogZW50ZmVybmVuYFxuICAgICAgICAgICAgOiBgTm90aXo6ICR7Zm9ybWF0VmFsdWUoY29uZmxpY3QuZnJvbSl9ICAgXHUyMTkyICAgQ1NWOiAke2Zvcm1hdFZhbHVlKGNvbmZsaWN0LnRvKX1gXG4gICAgICAgIClcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0cnVlKS5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSkgdGhpcy5hY2NlcHRlZC5hZGQoY29uZmxpY3Qua2V5KTtcbiAgICAgICAgICAgIGVsc2UgdGhpcy5hY2NlcHRlZC5kZWxldGUoY29uZmxpY3Qua2V5KTtcbiAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8vIE5pY2h0IGFscyBTZXR0aW5nLVplaWxlOiB2aWVyIEtuXHUwMEY2cGZlIG5lYmVuZWluYW5kZXIgc3ByZW5nZW4gZGVyZW5cbiAgICAvLyBuaWNodCB1bWJyZWNoZW5kZSBDb250cm9sLVNwYWx0ZSB1bmQgZXJ6d2luZ2VuIGhvcml6b250YWxlcyBTY3JvbGxlbi5cbiAgICAvLyBPYnNpZGlhbnMgbW9kYWwtYnV0dG9uLWNvbnRhaW5lciBkYXJmIGRhZ2VnZW4gdW1icmVjaGVuLlxuICAgIGNvbnN0IGZvb3RlciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwibW9kYWwtYnV0dG9uLWNvbnRhaW5lciBmcmVkLWtvbnRha3QtY29uZmxpY3QtYnV0dG9uc1wiIH0pO1xuICAgIGNvbnN0IGJ1dHRvbiA9ICh0ZXh0LCBjdGEsIG9uQ2xpY2spID0+IHtcbiAgICAgIGNvbnN0IGJ0biA9IG5ldyBCdXR0b25Db21wb25lbnQoZm9vdGVyKS5zZXRCdXR0b25UZXh0KHRleHQpLm9uQ2xpY2sob25DbGljayk7XG4gICAgICBpZiAoY3RhKSBidG4uc2V0Q3RhKCk7XG4gICAgICByZXR1cm4gYnRuO1xuICAgIH07XG4gICAgYnV0dG9uKFwiXHUwMERDYmVybmVobWVuXCIsIHRydWUsICgpID0+IHRoaXMuZmluaXNoKHsgYWNjZXB0ZWQ6IHRoaXMuYWNjZXB0ZWQgfSkpO1xuICAgIGJ1dHRvbihcIk5vdGl6IGJlaGFsdGVuXCIsIGZhbHNlLCAoKSA9PiB0aGlzLmZpbmlzaCh7IGFjY2VwdGVkOiBuZXcgU2V0KCkgfSkpO1xuICAgIGJ1dHRvbihcIlJlc3Q6IENTVlwiLCBmYWxzZSwgKCkgPT4gdGhpcy5maW5pc2goeyBhY2NlcHRlZDogdGhpcy5hY2NlcHRlZCwgcmVzdE1vZGU6IFwiY3N2XCIgfSkpO1xuICAgIGJ1dHRvbihcIlJlc3Q6IE5vdGl6XCIsIGZhbHNlLCAoKSA9PiB0aGlzLmZpbmlzaCh7IGFjY2VwdGVkOiBuZXcgU2V0KCksIHJlc3RNb2RlOiBcImdhcHNcIiB9KSk7XG4gIH1cblxuICBmaW5pc2gocmVzdWx0KSB7XG4gICAgdGhpcy5hbnN3ZXJlZCA9IHRydWU7XG4gICAgdGhpcy5yZXNvbHZlKHJlc3VsdCk7XG4gICAgdGhpcy5jbG9zZSgpO1xuICB9XG5cbiAgb25DbG9zZSgpIHtcbiAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGlmICghdGhpcy5hbnN3ZXJlZCkgdGhpcy5yZXNvbHZlKHsgYWNjZXB0ZWQ6IG5ldyBTZXQoKSB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc2tDb25mbGljdHMoYXBwLCBhY3Rpb24pIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBuZXcgQ29uZmxpY3RNb2RhbChhcHAsIGFjdGlvbiwgcmVzb2x2ZSkub3BlbigpKTtcbn1cblxuLy8gS29uZmxpa3RlIGdlbVx1MDBFNFx1MDBERiBNb2R1cyBhdWZsXHUwMEY2c2VuIHVuZCBpbiBkaWUgbm9ybWFsZSBcdTAwQzRuZGVydW5nc2xpc3RlXG4vLyBcdTAwRkNiZXJmXHUwMEZDaHJlbiwgZGFtaXQgYXBwbHlQbGFuIG51ciBub2NoIGVpbmUgU29ydGUgXHUwMEM0bmRlcnVuZyBrZW5udC5cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVDb25mbGljdHMocGx1Z2luLCBhY3Rpb25zKSB7XG4gIGxldCBtb2RlID0gcGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzQ29uZmxpY3RNb2RlIHx8IFwiY3N2XCI7XG4gIGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcbiAgICBpZiAoYWN0aW9uLmNvbmZsaWN0cy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuICAgIGlmIChtb2RlID09PSBcImNzdlwiKSB7XG4gICAgICBhY3Rpb24uY2hhbmdlcy5wdXNoKC4uLmFjdGlvbi5jb25mbGljdHMpO1xuICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJhc2tcIikge1xuICAgICAgY29uc3QgeyBhY2NlcHRlZCwgcmVzdE1vZGUgfSA9IGF3YWl0IGFza0NvbmZsaWN0cyhwbHVnaW4uYXBwLCBhY3Rpb24pO1xuICAgICAgYWN0aW9uLmNoYW5nZXMucHVzaCguLi5hY3Rpb24uY29uZmxpY3RzLmZpbHRlcigoYykgPT4gYWNjZXB0ZWQuaGFzKGMua2V5KSkpO1xuICAgICAgaWYgKHJlc3RNb2RlKSBtb2RlID0gcmVzdE1vZGU7XG4gICAgfVxuICAgIGFjdGlvbi5jb25mbGljdHMgPSBbXTtcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbi8qIEZvcnRzY2hyaXR0IGluIGRlciBTdGF0dXNsZWlzdGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG4vLyBCZXd1c3N0IGRpZSBTdGF0dXNsZWlzdGUgc3RhdHQgZWluZXIgTm90aWNlOiBzbyBibGVpYnQgZGVyIE5vdGljZS1CZXJlaWNoXG4vLyBmcmVpIGZcdTAwRkNyIGRpZSBNZWxkdW5nZW4gXHUwMEZDYmVyIE5vcm1hbGlzaWVydW5nZW4gdW5kIFx1MDBEQ2JlcnNwcnVuZ2VuZXMuXG5mdW5jdGlvbiBjcmVhdGVQcm9ncmVzcyhwbHVnaW4sIHRvdGFsKSB7XG4gIGNvbnN0IGVsID0gcGx1Z2luLmFkZFN0YXR1c0Jhckl0ZW0oKTtcbiAgZWwuYWRkQ2xhc3MoXCJmcmVkLWtvbnRha3QtcHJvZ3Jlc3NcIik7XG4gIGNvbnN0IGxhYmVsID0gZWwuY3JlYXRlU3Bhbih7IGNsczogXCJmcmVkLWtvbnRha3QtcHJvZ3Jlc3MtbGFiZWxcIiB9KTtcbiAgY29uc3QgY2FuY2VsQnRuID0gZWwuY3JlYXRlRWwoXCJzcGFuXCIsIHsgY2xzOiBcImZyZWQta29udGFrdC1wcm9ncmVzcy1jYW5jZWxcIiwgdGV4dDogXCJBYmJyZWNoZW5cIiB9KTtcblxuICBjb25zdCBzdGF0ZSA9IHtcbiAgICBjYW5jZWxsZWQ6IGZhbHNlLFxuICAgIHVwZGF0ZShkb25lLCBuYW1lKSB7XG4gICAgICBjb25zdCB3aWR0aCA9IDEyO1xuICAgICAgY29uc3QgZmlsbGVkID0gdG90YWwgPiAwID8gTWF0aC5yb3VuZCgod2lkdGggKiBkb25lKSAvIHRvdGFsKSA6IHdpZHRoO1xuICAgICAgY29uc3QgYmFyID0gXCJcdTI1ODhcIi5yZXBlYXQoZmlsbGVkKSArIFwiXHUyNTkxXCIucmVwZWF0KE1hdGgubWF4KDAsIHdpZHRoIC0gZmlsbGVkKSk7XG4gICAgICBsYWJlbC5zZXRUZXh0KGBLb250YWt0ZSAke2Jhcn0gJHtkb25lfS8ke3RvdGFsfSR7bmFtZSA/IFwiICBcdTAwQjcgIFwiICsgbmFtZSA6IFwiXCJ9YCk7XG4gICAgfSxcbiAgICBmaW5pc2goKSB7XG4gICAgICBlbC5yZW1vdmUoKTtcbiAgICB9LFxuICB9O1xuXG4gIGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgIHN0YXRlLmNhbmNlbGxlZCA9IHRydWU7XG4gICAgY2FuY2VsQnRuLnNldFRleHQoXCJ3aXJkIGFiZ2Vicm9jaGVuIFx1MjAyNlwiKTtcbiAgfSk7XG5cbiAgc3RhdGUudXBkYXRlKDAsIFwiXCIpO1xuICByZXR1cm4gc3RhdGU7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyogU2NocmVpYmVuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbi8vIERlciBTVUJUWVAgZ2VoXHUwMEY2cnQgZGVyIE5vdGl6LCBuaWNodCBkZW0gSW1wb3J0OiBlciBrb21tdCBhdXMgZGVtIFRZUC1TeXN0ZW1cbi8vIG9kZXIgdm9uIEhhbmQsIHN0ZWh0IGluIGtlaW5lciBDU1YtU3BhbHRlIHVuZCBkYXJmIGVpbmVuIEltcG9ydCB1bnZlclx1MDBFNG5kZXJ0XG4vLyBcdTAwRkNiZXJzdGVoZW4uIEdlbGVzZW4gd2lyZCBlciBvaG5lIEJlYWNodHVuZyBkZXIgR3JvXHUwMERGLS9LbGVpbnNjaHJlaWJ1bmcsIHdlaWxcbi8vIE9ic2lkaWFuIFByb3BlcnR5LU5hbWVuIHNvIGJlaGFuZGVsdCAoXCJTdWJ0eXBcIiB1bmQgXCJTVUJUWVBcIiBzaW5kIGRpZXNlbGJlXG4vLyBQcm9wZXJ0eSkgLSBnZW5hdSB3aWUgZGFzIFRZUC1TeXN0ZW0gZXMgYmVpbSBTY2hyZWliZW4gdHV0LlxuZnVuY3Rpb24gZXhpc3RpbmdTdWJ0eXAoZnJvbnRtYXR0ZXIpIHtcbiAgY29uc3Qga2V5ID0gT2JqZWN0LmtleXMoZnJvbnRtYXR0ZXIpLmZpbmQoKG5hbWUpID0+IG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJzdWJ0eXBcIik7XG4gIGNvbnN0IHZhbHVlID0ga2V5ID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBmcm9udG1hdHRlcltrZXldO1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiICYmIHZhbHVlLnRyaW0oKSAhPT0gXCJcIiA/IHZhbHVlIDogbnVsbDtcbn1cblxuLy8gQWxsZXMgZ2VodCBkdXJjaCBwcm9jZXNzRnJvbnRNYXR0ZXIgdW5kIHNvcnRGcm9udG1hdHRlciAtIGRlciBJbXBvcnRcbi8vIGJyaW5ndCBkYW1pdCBrZWluZSBlaWdlbmUgUmVpaGVuZm9sZ2UgbWVociBtaXQsIHNvbmRlcm4gXHUwMEZDYmVybmltbXQgZGllXG4vLyBkZXMgVFlQLVN5c3RlbXMuIFZvcmhlciBmcmFcdTAwREZlbiBzaWNoIGJlaWRlIGdlZ2Vuc2VpdGlnIGF1ZjogZGVyIEltcG9ydFxuLy8gem9nIHRhZ3MgbmFjaCB2b3JuLCBkaWUgRnJvbnRtYXR0ZXItU29ydGllcnVuZyB3aWVkZXIgbmFjaCBoaW50ZW4uXG4vL1xuLy8gRGVyIFN1YnR5cCBtdXNzIGRhYmVpIGR1cmNoZ2VyZWljaHQgd2VyZGVuOiBhcHBseVR5cGVQcm9wZXJ0aWVzKGZtLCB0eXAsXG4vLyBudWxsKSBMXHUwMEQ2U0NIVCBlaW5lbiB2b3JoYW5kZW5lbiBTVUJUWVAgKHNpZWhlIHR5cC1zeXN0ZW0vc3JjL21haW4uanMpLCB1bmRcbi8vIHNvcnRGcm9udG1hdHRlciBvaG5lIFN1YnR5cCBrZW5udCBkZXNzZW4gUHJvcGVydHktQmxvY2sgbmljaHQgdW5kIHNjaFx1MDBGNmJlXG4vLyBkaWUgU3VidHlwLVByb3BlcnRpZXMgYW5zIEVuZGUuIEVpbiBmZXN0IFx1MDBGQ2JlcmdlYmVuZXMgbnVsbCBoXHUwMEU0dHRlIGRlc2hhbGIsXG4vLyBzb2JhbGQgS09OVEFLVCBTdWJ0eXBlbiBiZWtvbW10LCBiZWkgamVkZW0gVXBkYXRlIGRpZSBLbGFzc2lmaXppZXJ1bmcgZGVyXG4vLyBOb3RpeiBzdGlsbHNjaHdlaWdlbmQgbWl0Z2VsXHUwMEY2c2NodC5cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlRnJvbnRtYXR0ZXIoYXBwLCBmaWxlLCBjaGFuZ2VzLCB0eXApIHtcbiAgY29uc3QgdHlwU3lzdGVtID0gZ2V0VHlwU3lzdGVtKGFwcCk7XG4gIGF3YWl0IGFwcC5maWxlTWFuYWdlci5wcm9jZXNzRnJvbnRNYXR0ZXIoZmlsZSwgKGZyb250bWF0dGVyKSA9PiB7XG4gICAgY29uc3Qgc3VidHlwID0gZXhpc3RpbmdTdWJ0eXAoZnJvbnRtYXR0ZXIpO1xuXG4gICAgaWYgKHR5cFN5c3RlbT8uYXBwbHlUeXBlUHJvcGVydGllcykgdHlwU3lzdGVtLmFwcGx5VHlwZVByb3BlcnRpZXMoZnJvbnRtYXR0ZXIsIHR5cCwgc3VidHlwKTtcbiAgICBlbHNlIGZyb250bWF0dGVyLlRZUCA9IHR5cDtcblxuICAgIGZvciAoY29uc3QgY2hhbmdlIG9mIGNoYW5nZXMpIHtcbiAgICAgIGlmIChjaGFuZ2UudG8gPT09IHVuZGVmaW5lZCB8fCBjaGFuZ2UudG8gPT09IG51bGwgfHwgY2hhbmdlLnRvID09PSBcIlwiKSBkZWxldGUgZnJvbnRtYXR0ZXJbY2hhbmdlLmtleV07XG4gICAgICBlbHNlIGZyb250bWF0dGVyW2NoYW5nZS5rZXldID0gY2hhbmdlLnRvO1xuICAgIH1cblxuICAgIHR5cFN5c3RlbT8uc29ydEZyb250bWF0dGVyPy4oZnJvbnRtYXR0ZXIsIHR5cCwgc3VidHlwKTtcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUZvbGRlcihhcHAsIHBhdGgpIHtcbiAgaWYgKCFwYXRoKSByZXR1cm47XG4gIGlmICghKGF3YWl0IGFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhwYXRoKSkpIGF3YWl0IGFwcC52YXVsdC5jcmVhdGVGb2xkZXIocGF0aCkuY2F0Y2goKCkgPT4ge30pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhcHBseVBsYW4ocGx1Z2luLCBwbGFuLCBwcm9ncmVzcykge1xuICBjb25zdCB7IGFwcCB9ID0gcGx1Z2luO1xuICBjb25zdCBzdGF0cyA9IHsgY3JlYXRlZDogMCwgdXBkYXRlZDogMCwgcmVuYW1lZDogMCwgdHJhc2hlZDogMCwgZXJyb3JzOiAwIH07XG4gIGNvbnN0IHRvdGFsID0gcGxhbi5hY3Rpb25zLmxlbmd0aCArIHBsYW4ub3JwaGFucy5sZW5ndGg7XG4gIGxldCBkb25lID0gMDtcblxuICBmb3IgKGNvbnN0IGFjdGlvbiBvZiBwbGFuLmFjdGlvbnMpIHtcbiAgICBpZiAocHJvZ3Jlc3M/LmNhbmNlbGxlZCkgYnJlYWs7XG4gICAgZG9uZSsrO1xuICAgIHByb2dyZXNzPy51cGRhdGUoZG9uZSwgYWN0aW9uLmNvbnRhY3QuYmFzZU5hbWUpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGlmIChhY3Rpb24ua2luZCA9PT0gXCJjcmVhdGVcIikge1xuICAgICAgICBhd2FpdCBlbnN1cmVGb2xkZXIoYXBwLCBwbGFuLmJhc2VEaXIpO1xuICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgYXBwLnZhdWx0LmNyZWF0ZShhY3Rpb24udGFyZ2V0UGF0aCwgYWN0aW9uLmNvbnRhY3QuYm9keSA/IGFjdGlvbi5jb250YWN0LmJvZHkgKyBcIlxcblwiIDogXCJcIik7XG4gICAgICAgIGF3YWl0IHdyaXRlRnJvbnRtYXR0ZXIoYXBwLCBmaWxlLCBhY3Rpb24uY2hhbmdlcywgcGxhbi50eXApO1xuICAgICAgICBzdGF0cy5jcmVhdGVkKys7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWN0aW9uLmNoYW5nZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBhd2FpdCB3cml0ZUZyb250bWF0dGVyKGFwcCwgYWN0aW9uLmZpbGUsIGFjdGlvbi5jaGFuZ2VzLCBwbGFuLnR5cCk7XG4gICAgICAgIHN0YXRzLnVwZGF0ZWQrKztcbiAgICAgIH1cbiAgICAgIC8vIFVtYmVuZW5udW5nIHp1bGV0enQgdW5kIFx1MDBGQ2JlciBmaWxlTWFuYWdlciwgZGFtaXQgT2JzaWRpYW4gZGllXG4gICAgICAvLyBlaW5nZWhlbmRlbiBGYW1pbGllLS9GcmV1bmRlLUxpbmtzIG1pdHppZWh0LlxuICAgICAgaWYgKGFjdGlvbi5yZW5hbWUpIHtcbiAgICAgICAgYXdhaXQgYXBwLmZpbGVNYW5hZ2VyLnJlbmFtZUZpbGUoYWN0aW9uLmZpbGUsIGFjdGlvbi5yZW5hbWUpO1xuICAgICAgICBzdGF0cy5yZW5hbWVkKys7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc3RhdHMuZXJyb3JzKys7XG4gICAgICBjb25zb2xlLmVycm9yKFwiW0tvbnRha3QtSW1wb3J0XSBGZWhsZXIgYmVpXCIsIGFjdGlvbi5jb250YWN0LmJhc2VOYW1lLCBlKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IG9ycGhhbiBvZiBwbGFuLm9ycGhhbnMpIHtcbiAgICBpZiAocHJvZ3Jlc3M/LmNhbmNlbGxlZCkgYnJlYWs7XG4gICAgZG9uZSsrO1xuICAgIHByb2dyZXNzPy51cGRhdGUoZG9uZSwgb3JwaGFuLmZpbGUuYmFzZW5hbWUpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBlbnN1cmVGb2xkZXIoYXBwLCBwbGFuLnRyYXNoRGlyKTtcbiAgICAgIGF3YWl0IGFwcC5maWxlTWFuYWdlci5yZW5hbWVGaWxlKG9ycGhhbi5maWxlLCBqb2luVmF1bHRQYXRoKHBsYW4udHJhc2hEaXIsIG9ycGhhbi5maWxlLm5hbWUpKTtcbiAgICAgIHN0YXRzLnRyYXNoZWQrKztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzdGF0cy5lcnJvcnMrKztcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbS29udGFrdC1JbXBvcnRdIEZlaGxlciBiZWltIFZlcnNjaGllYmVuIG5hY2ggX1RyYXNoOlwiLCBvcnBoYW4uZmlsZS5wYXRoLCBlKTtcbiAgICB9XG4gIH1cblxuICBwcm9ncmVzcz8udXBkYXRlKHRvdGFsLCBcIlwiKTtcbiAgcmV0dXJuIHN0YXRzO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbi8qIEJlcmljaHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG5mdW5jdGlvbiBsb2dHcm91cCh0aXRsZSwgbGluZXMpIHtcbiAgaWYgKGxpbmVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICBjb25zb2xlLmdyb3VwQ29sbGFwc2VkKGBbS29udGFrdC1JbXBvcnRdICR7dGl0bGV9YCk7XG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykgY29uc29sZS5sb2cobGluZSk7XG4gIGNvbnNvbGUuZ3JvdXBFbmQoKTtcbn1cblxuZnVuY3Rpb24gcmVwb3J0UGxhbihwbGFuLCBzdGF0cywgZHJ5UnVuKSB7XG4gIC8vIE5hY2ggRmVsZCBncnVwcGllcnQ6IGJlaSBkcmVpc3RlbGxpZ2VuIFphaGxlbiBpc3QgZWluZSBmbGFjaGUgTGlzdGVcbiAgLy8gbmljaHQgbWVociBsZXNiYXIsIHVuZCBkaWUgQXVmc2NobFx1MDBGQ3NzZWx1bmcgc2FndCBhdWYgZWluZW4gQmxpY2ssIG9iXG4gIC8vIG51ciBUZWxlZm9uZm9ybWF0ZSBvZGVyIGF1Y2ggQWRyZXNzZW4gYW5nZWZhc3N0IHd1cmRlbi5cbiAgY29uc3QgYnlGaWVsZCA9IG5ldyBNYXAoKTtcbiAgZm9yIChjb25zdCBjIG9mIHBsYW4uY29ycmVjdGlvbnMpIHtcbiAgICBpZiAoIWJ5RmllbGQuaGFzKGMuZmllbGQpKSBieUZpZWxkLnNldChjLmZpZWxkLCBbXSk7XG4gICAgYnlGaWVsZC5nZXQoYy5maWVsZCkucHVzaChjKTtcbiAgfVxuICBjb25zdCBicmVha2Rvd24gPSBbLi4uYnlGaWVsZC5lbnRyaWVzKCldLm1hcCgoW2ZpZWxkLCBsaXN0XSkgPT4gYCR7bGlzdC5sZW5ndGh9XHUwMEQ3ICR7ZmllbGR9YCk7XG4gIGxvZ0dyb3VwKFxuICAgIGAke3BsYW4uY29ycmVjdGlvbnMubGVuZ3RofSBOb3JtYWxpc2llcnVuZ2VuICgke2JyZWFrZG93bi5qb2luKFwiLCBcIil9KWAsXG4gICAgWy4uLmJ5RmllbGQuZW50cmllcygpXS5mbGF0TWFwKChbZmllbGQsIGxpc3RdKSA9PiBbXG4gICAgICBgXHUyNTAwXHUyNTAwICR7ZmllbGR9ICgke2xpc3QubGVuZ3RofSlgLFxuICAgICAgLi4ubGlzdC5tYXAoKGMpID0+IGAgICAke2MubmFtZX06IFwiJHtjLmZyb219XCIgXHUyMTkyIFwiJHtjLnRvfVwiYCksXG4gICAgXSlcbiAgKTtcbiAgbG9nR3JvdXAoXG4gICAgYCR7cGxhbi5za2lwcGVkLmxlbmd0aH0gXHUwMEZDYmVyc3BydW5nZW5gLFxuICAgIHBsYW4uc2tpcHBlZC5tYXAoKHMpID0+IGAke3MubmFtZX06ICR7cy5yZWFzb259YClcbiAgKTtcbiAgY29uc3QgcmVuYW1lcyA9IHBsYW4uYWN0aW9ucy5maWx0ZXIoKGEpID0+IGEucmVuYW1lKTtcbiAgbG9nR3JvdXAoXG4gICAgYCR7cmVuYW1lcy5sZW5ndGh9IFVtYmVuZW5udW5nZW5gLFxuICAgIHJlbmFtZXMubWFwKChhKSA9PiBgJHthLmZpbGU/LnBhdGggPz8gXCIobmV1KVwifSBcdTIxOTIgJHthLnJlbmFtZX0gKGVya2FubnQgXHUwMEZDYmVyICR7YS52aWF9KWApXG4gICk7XG4gIGxvZ0dyb3VwKFxuICAgIGAke3BsYW4ub3JwaGFucy5sZW5ndGh9IG5pY2h0IG1laHIgaW4gZGVyIENTVmAsXG4gICAgcGxhbi5vcnBoYW5zLm1hcCgobykgPT4gby5maWxlLnBhdGgpXG4gICk7XG4gIC8vIEdlbGVlcnRlIFByb3BlcnRpZXMgZ2Vzb25kZXJ0IGF1c3dlaXNlbjogZGFzIGlzdCBkZXIgZWluemlnZSBGYWxsLCBpblxuICAvLyBkZW0gZGVyIEltcG9ydCBEYXRlbiBhdXMgZWluZXIgTm90aXogZW50ZmVybnQuXG4gIGNvbnN0IGNsZWFyZWQgPSBwbGFuLmFjdGlvbnMuZmxhdE1hcCgoYSkgPT5cbiAgICBhLmNoYW5nZXMuZmlsdGVyKChjKSA9PiBjLnRvID09PSB1bmRlZmluZWQpLm1hcCgoYykgPT4gYCR7YS5jb250YWN0LmJhc2VOYW1lfSBcdTIwMTMgJHtjLmtleX06IFwiJHtmb3JtYXRWYWx1ZShjLmZyb20pfVwiIGVudGZlcm50YClcbiAgKTtcbiAgbG9nR3JvdXAoYCR7Y2xlYXJlZC5sZW5ndGh9IFByb3BlcnRpZXMgZ2VsZWVydCAoaW4gR29vZ2xlIGdlbFx1MDBGNnNjaHQpYCwgY2xlYXJlZCk7XG5cbiAgY29uc3QgcGFydHMgPSBbXG4gICAgYCR7c3RhdHMuY3JlYXRlZH0gbmV1YCxcbiAgICBgJHtzdGF0cy51cGRhdGVkfSBha3R1YWxpc2llcnRgLFxuICAgIGAke3N0YXRzLnJlbmFtZWR9IHVtYmVuYW5udGAsXG4gICAgYCR7c3RhdHMudHJhc2hlZH0gbmFjaCBfVHJhc2hgLFxuICBdO1xuICBpZiAoY2xlYXJlZC5sZW5ndGgpIHBhcnRzLnB1c2goYCR7Y2xlYXJlZC5sZW5ndGh9IGdlbGVlcnRgKTtcbiAgaWYgKHBsYW4uY29ycmVjdGlvbnMubGVuZ3RoKSBwYXJ0cy5wdXNoKGAke3BsYW4uY29ycmVjdGlvbnMubGVuZ3RofSBub3JtYWxpc2llcnRgKTtcbiAgaWYgKHBsYW4uc2tpcHBlZC5sZW5ndGgpIHBhcnRzLnB1c2goYCR7cGxhbi5za2lwcGVkLmxlbmd0aH0gXHUwMEZDYmVyc3BydW5nZW5gKTtcbiAgaWYgKHN0YXRzLmVycm9ycykgcGFydHMucHVzaChgJHtzdGF0cy5lcnJvcnN9IEZlaGxlcmApO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBgJHtkcnlSdW4gPyBcIltQcm9iZWxhdWZdIFwiIDogXCJcIn1Lb250YWt0LUltcG9ydDogJHtwYXJ0cy5qb2luKFwiLCBcIil9LiBEZXRhaWxzIGluIGRlciBLb25zb2xlLmA7XG4gIGNvbnNvbGUubG9nKFwiW0tvbnRha3QtSW1wb3J0XVwiLCBzdW1tYXJ5KTtcbiAgbmV3IE5vdGljZShzdW1tYXJ5LCAxMDAwMCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyogQmVmZWhsZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbmFzeW5jIGZ1bmN0aW9uIGltcG9ydENvbnRhY3RzRnJvbUNzdihwbHVnaW4pIHtcbiAgbGV0IHBsYW47XG4gIHRyeSB7XG4gICAgcGxhbiA9IGF3YWl0IGJ1aWxkUGxhbihwbHVnaW4pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgbmV3IE5vdGljZShgS29udGFrdC1JbXBvcnQ6ICR7ZS5tZXNzYWdlfWApO1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbS29udGFrdC1JbXBvcnRdXCIsIGUpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGF3YWl0IHJlc29sdmVDb25mbGljdHMocGx1Z2luLCBwbGFuLmFjdGlvbnMpO1xuXG4gIGlmIChwbHVnaW4uc2V0dGluZ3MuY29udGFjdHNEcnlSdW4pIHtcbiAgICByZXBvcnRQbGFuKFxuICAgICAgcGxhbixcbiAgICAgIHtcbiAgICAgICAgY3JlYXRlZDogcGxhbi5hY3Rpb25zLmZpbHRlcigoYSkgPT4gYS5raW5kID09PSBcImNyZWF0ZVwiKS5sZW5ndGgsXG4gICAgICAgIHVwZGF0ZWQ6IHBsYW4uYWN0aW9ucy5maWx0ZXIoKGEpID0+IGEua2luZCA9PT0gXCJ1cGRhdGVcIiAmJiBhLmNoYW5nZXMubGVuZ3RoID4gMCkubGVuZ3RoLFxuICAgICAgICByZW5hbWVkOiBwbGFuLmFjdGlvbnMuZmlsdGVyKChhKSA9PiBhLnJlbmFtZSkubGVuZ3RoLFxuICAgICAgICB0cmFzaGVkOiBwbGFuLm9ycGhhbnMubGVuZ3RoLFxuICAgICAgICBlcnJvcnM6IDAsXG4gICAgICB9LFxuICAgICAgdHJ1ZVxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRGFzIExpdmUtUHJvcGVydHktQmFja2xpbmtpbmcgd1x1MDBGQ3JkZSBiZWkgamVkZXIgZ2VzY2hyaWViZW5lbiBOb3RpeiBlaW5lblxuICAvLyBMYXVmIFx1MDBGQ2JlciBkZW4gZ2VzYW10ZW4gVmF1bHQgYXVzbFx1MDBGNnNlbi4gRWlubWFsIGFtIEVuZGUgcmVpY2h0LlxuICBjb25zdCBwcm9ncmVzcyA9IGNyZWF0ZVByb2dyZXNzKHBsdWdpbiwgcGxhbi5hY3Rpb25zLmxlbmd0aCArIHBsYW4ub3JwaGFucy5sZW5ndGgpO1xuICBwbHVnaW4uc3VzcGVuZFByb3BlcnR5QmFja2xpbmtzID0gdHJ1ZTtcbiAgbGV0IHN0YXRzO1xuICB0cnkge1xuICAgIHN0YXRzID0gYXdhaXQgYXBwbHlQbGFuKHBsdWdpbiwgcGxhbiwgcHJvZ3Jlc3MpO1xuICB9IGZpbmFsbHkge1xuICAgIHBsdWdpbi5zdXNwZW5kUHJvcGVydHlCYWNrbGlua3MgPSBmYWxzZTtcbiAgICBwcm9ncmVzcy5maW5pc2goKTtcbiAgfVxuXG4gIGlmIChwcm9ncmVzcy5jYW5jZWxsZWQpIG5ldyBOb3RpY2UoXCJLb250YWt0LUltcG9ydDogYWJnZWJyb2NoZW4uXCIpO1xuICByZXBvcnRQbGFuKHBsYW4sIHN0YXRzLCBmYWxzZSk7XG4gIGF3YWl0IHBsdWdpbi5ydW5Qcm9wZXJ0eUJhY2tsaW5rU3luYz8uKCk7XG59XG5cbi8vIERlYnVnZ2luZy1IaWxmZTogbFx1MDBGNnNjaHQgS29udGFrdGUsIGRpZSBleGFrdCBzbyBhdXNzZWhlbiwgd2llIGRlciBJbXBvcnRcbi8vIHNpZSBnZXJhZGUgYW5sZWdlbiB3XHUwMEZDcmRlIC0gYWxzbyBuYWNod2Vpc2xpY2ggdm9uIG5pZW1hbmRlbSBhbmdlZmFzc3Rcbi8vIHd1cmRlbi4gRGllIGFsdGUgRmFzc3VuZyBwclx1MDBGQ2Z0ZSBudXIsIG9iIGF1c3NjaGxpZVx1MDBERmxpY2ggYmVrYW5udGVcbi8vIFByb3BlcnR5LU5BTUVOIHZvcmthbWVuLCB1bmQgaFx1MDBFNHR0ZSBkYW1pdCBmYXN0IGRlbiBnYW56ZW4gT3JkbmVyIGVyd2lzY2h0O1xuLy8gZ2VyZXR0ZXQgaGF0IHNpZSBudXIgZWluIFNjaHJlaWJmZWhsZXIgaW0gT3JkbmVybmFtZW4sIGR1cmNoIGRlbiBzaWVcbi8vIFx1MDBGQ2JlcmhhdXB0IGtlaW5lIERhdGVpIGZhbmQuXG5hc3luYyBmdW5jdGlvbiBkZWxldGVVbnRvdWNoZWRDb250YWN0cyhwbHVnaW4pIHtcbiAgY29uc3QgeyBhcHAgfSA9IHBsdWdpbjtcbiAgbGV0IHBsYW47XG4gIHRyeSB7XG4gICAgcGxhbiA9IGF3YWl0IGJ1aWxkUGxhbihwbHVnaW4pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgbmV3IE5vdGljZShgS29udGFrdC1JbXBvcnQ6ICR7ZS5tZXNzYWdlfWApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHNvbGxCeVBhdGggPSBuZXcgTWFwKCk7XG4gIGZvciAoY29uc3QgY29udGFjdCBvZiBwbGFuLmNvbnRhY3RzKSB7XG4gICAgc29sbEJ5UGF0aC5zZXQoam9pblZhdWx0UGF0aChwbGFuLmJhc2VEaXIsIGAke2NvbnRhY3QuZmlsZU5hbWV9Lm1kYCkudG9Mb3dlckNhc2UoKSwgY29udGFjdCk7XG4gIH1cblxuICBjb25zdCBpbmRleCA9IGJ1aWxkTm90ZUluZGV4KGFwcCwgcGxhbi5iYXNlRGlyLCBwbGFuLnR5cCk7XG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXTtcblxuICBmb3IgKGNvbnN0IGVudHJ5IG9mIGluZGV4Lm5vdGVzKSB7XG4gICAgaWYgKGlzSW5Gb2xkZXIoZW50cnkuZmlsZS5wYXRoLCBwbGFuLnRyYXNoRGlyKSkgY29udGludWU7XG4gICAgY29uc3QgY29udGFjdCA9IHNvbGxCeVBhdGguZ2V0KGVudHJ5LmZpbGUucGF0aC50b0xvd2VyQ2FzZSgpKTtcbiAgICBpZiAoIWNvbnRhY3QpIGNvbnRpbnVlO1xuXG4gICAgLy8gRnJlbWRlIFByb3BlcnRpZXMgKEZhbWlsaWUvRnJldW5kZSwgZWlnZW5lIEVyZ1x1MDBFNG56dW5nZW4pIHpcdTAwRTRobGVuIGFsc1xuICAgIC8vIFwiYW5nZWZhc3N0XCIgLSBlYmVuc28gamVkZXIgYWJ3ZWljaGVuZGUgV2VydCB1bmQgamVkZXIgRmxpZVx1MDBERnRleHQsIGRlblxuICAgIC8vIGRlciBJbXBvcnQgbmljaHQgc2VsYnN0IGdlc2NocmllYmVuIGhhdC5cbiAgICAvL1xuICAgIC8vIEF1c2dlbm9tbWVuIGlzdCBhbGxlaW4gVFlQOiBkZW4gc2V0enQgZGVyIEltcG9ydCBzZWxic3QsIGVyIHN0ZWh0IGFiZXJcbiAgICAvLyBuaWNodCBpbiBvd25lZEtleXMuIFNVQlRZUCBnZWhcdTAwRjZydCBiZXd1c3N0IE5JQ0hUIGluIGRpZXNlIEF1c25haG1lIC0gZXJcbiAgICAvLyBpc3QgZWluZSBLbGFzc2lmaXppZXJ1bmcgdm9uIEhhbmQgdW5kIGRhbWl0IGdlcmFkZSBkYXMgR2VnZW50ZWlsIHZvblxuICAgIC8vIFwidW52ZXJcdTAwRTRuZGVydFwiLiBFaW5lIE5vdGl6IG1pdCBTVUJUWVAgZlx1MDBFNGxsdCBoaWVyIGFsc28gZHVyY2ggdW5kIGJsZWlidFxuICAgIC8vIHN0ZWhlbjsgZGFzIGlzdCBkaWUgZ2V3b2xsdGUgUmljaHR1bmcsIHdlaWwgaGllciBnZWxcdTAwRjZzY2h0IHdpcmQuXG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGVudHJ5LmZyb250bWF0dGVyKS5maWx0ZXIoKGtleSkgPT4ga2V5ICE9PSBcIlRZUFwiKTtcbiAgICBpZiAoa2V5cy5zb21lKChrZXkpID0+ICFwbGFuLm93bmVkS2V5cy5oYXMoa2V5KSkpIGNvbnRpbnVlO1xuICAgIGlmIChrZXlzLnNvbWUoKGtleSkgPT4gIXZhbHVlc0VxdWFsKGVudHJ5LmZyb250bWF0dGVyW2tleV0sIGNvbnRhY3QuZGF0YVtrZXldKSkpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgcmF3ID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQoZW50cnkuZmlsZSk7XG4gICAgY29uc3QgYm9keSA9IHJhdy5yZXBsYWNlKC9eLS0tXFxyP1xcbltcXHNcXFNdKj9cXHI/XFxuLS0tXFxyP1xcbj8vLCBcIlwiKS50cmltKCk7XG4gICAgaWYgKGJvZHkgIT09IChjb250YWN0LmJvZHkgfHwgXCJcIikudHJpbSgpKSBjb250aW51ZTtcblxuICAgIGNhbmRpZGF0ZXMucHVzaChlbnRyeS5maWxlKTtcbiAgfVxuXG4gIGlmIChwbHVnaW4uc2V0dGluZ3MuY29udGFjdHNEcnlSdW4pIHtcbiAgICBsb2dHcm91cChcbiAgICAgIGBQcm9iZWxhdWY6ICR7Y2FuZGlkYXRlcy5sZW5ndGh9IHVudmVyXHUwMEU0bmRlcnRgLFxuICAgICAgY2FuZGlkYXRlcy5tYXAoKGYpID0+IGYucGF0aClcbiAgICApO1xuICAgIG5ldyBOb3RpY2UoYFtQcm9iZWxhdWZdICR7aW5kZXgubm90ZXMubGVuZ3RofSBnZXByXHUwMEZDZnQsICR7Y2FuZGlkYXRlcy5sZW5ndGh9IHVudmVyXHUwMEU0bmRlcnQuYCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IGRlbGV0ZWQgPSAwO1xuICBsZXQgZXJyb3JzID0gMDtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXBwLmZpbGVNYW5hZ2VyLnRyYXNoRmlsZShmaWxlKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbS29udGFrdC1JbXBvcnRdIFVudmVyXHUwMEU0bmRlcnRlciBLb250YWt0IGdlbFx1MDBGNnNjaHQ6ICR7ZmlsZS5wYXRofWApO1xuICAgICAgZGVsZXRlZCsrO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9ycysrO1xuICAgICAgY29uc29sZS5lcnJvcihcIltLb250YWt0LUltcG9ydF0gRmVobGVyIGJlaW0gTFx1MDBGNnNjaGVuOlwiLCBmaWxlLnBhdGgsIGUpO1xuICAgIH1cbiAgfVxuXG4gIG5ldyBOb3RpY2UoXG4gICAgYEtvbnRha3QtSW1wb3J0OiAke2luZGV4Lm5vdGVzLmxlbmd0aH0gZ2Vwclx1MDBGQ2Z0LCAke2RlbGV0ZWR9IHVudmVyXHUwMEU0bmRlcnRlIGdlbFx1MDBGNnNjaHQke2Vycm9ycyA/IGAsICR7ZXJyb3JzfSBGZWhsZXJgIDogXCJcIn0uYFxuICApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgaW1wb3J0Q29udGFjdHNGcm9tQ3N2LCBkZWxldGVVbnRvdWNoZWRDb250YWN0cyB9O1xuXG4vLyBOdXIgZlx1MDBGQ3IgVGVzdHMgYXVcdTAwREZlcmhhbGIgdm9uIE9ic2lkaWFuIC0gZGllIHJlaW5lIFJlY2hlbmxvZ2lrIGxcdTAwRTRzc3Qgc2ljaFxuLy8gc28gZ2VnZW4gZGllIGVjaHRlIENTViBwclx1MDBGQ2Zlbiwgb2huZSBkZW4gVmF1bHQgYW56dWZhc3Nlbi5cbm1vZHVsZS5leHBvcnRzLl9fdGVzdCA9IHsgYnVpbGRQbGFuLCBub3JtYWxpemVQaG9uZSwgbm9ybWFsaXplU3RyZWV0LCBub3JtYWxpemVDb3VudHJ5LCBub3JtYWxpemVCaXJ0aGRheSB9O1xuIiwgImNvbnN0IHsgVEZpbGUgfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBQcm9wZXJ0eS1CYWNrbGlua2luZ1xuICogQmVsaWViaWdlIE5vdGl6ZW4gKG5pY2h0IGF1ZiBlaW5lbiBUWVAgYmVzY2hyXHUwMEU0bmt0KSBtaXQgZWluZXJcbiAqIExpc3Rlbi1Qcm9wZXJ0eSAoei4gQi4gXCJGYW1pbGllXCIsIFwiRnJldW5kZVwiKSBhdXMgTGlua3MgenVcbiAqIGFuZGVyZW4gTm90aXplbiBiZWtvbW1lbiBkZW4gUHJvcGVydHktQmFja2xpbmsgYXV0b21hdGlzY2ggYmVpXG4gKiBkZXIgamV3ZWlscyBhbmRlcmVuIE5vdGl6IGVyZ1x1MDBFNG56dCAtIHVuZCB3aWVkZXIgZW50ZmVybnQsIHNvYmFsZFxuICogZGllIHVyc3ByXHUwMEZDbmdsaWNoZSBWZXJsaW5rdW5nIHdlZ2ZcdTAwRTRsbHQuIERpZSBrb25maWd1cmllcnRlXG4gKiBQcm9wZXJ0eS1MaXN0ZSBzZWxic3QgaXN0IGRlciBlaW56aWdlIEZpbHRlci5cbiAqXG4gKiBFcmtlbm51bmcgcGVyIFZlcmdsZWljaCBtaXQgZGVtIGdlc3BlaWNoZXJ0ZW4gU3RhbmQgZGVzIGxldHp0ZW5cbiAqIExhdWZzIChuaWNodCBwZXIgSGVya3VuZnRzLVRyYWNraW5nIGVpbnplbG5lciBMaW5rcyk6IHdhcyBuZXVcbiAqIGRhenVnZWtvbW1lbiBpc3QsIHdpcmQgZ2VzcGllZ2VsdCBlcmdcdTAwRTRuenQ7IHdhcyB3ZWdnZWZhbGxlbiBpc3QsXG4gKiB3aXJkIGJlaW0gYW5kZXJlbiBlYmVuZmFsbHMgZW50ZmVybnQgLSB1bmFiaFx1MDBFNG5naWcgZGF2b24sIHdlciBkaWVcbiAqIFZlcmxpbmt1bmcgdXJzcHJcdTAwRkNuZ2xpY2ggZ2VzZXR6dCBoYXR0ZS5cbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5mdW5jdGlvbiBwYXJzZUxpbmtUZXh0KGVudHJ5KSB7XG4gIGNvbnN0IG1hdGNoID0gZW50cnkubWF0Y2goL15cXFtcXFsoW15cXF18XSspKD86XFx8W15cXF1dKik/XFxdXFxdJC8pO1xuICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IGVudHJ5O1xufVxuXG5mdW5jdGlvbiB0b0FycmF5KHZhbHVlKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gXCJcIikgcmV0dXJuIFtdO1xuICByZXR1cm4gW3ZhbHVlXTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUxpbmtUYXJnZXRzKGFwcCwgb3duZXJGaWxlLCBwcm9wZXJ0eVZhbHVlKSB7XG4gIGNvbnN0IHRhcmdldHMgPSBbXTtcbiAgZm9yIChjb25zdCBlbnRyeSBvZiB0b0FycmF5KHByb3BlcnR5VmFsdWUpKSB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSAhPT0gXCJzdHJpbmdcIikgY29udGludWU7XG4gICAgY29uc3QgZGVzdCA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KHBhcnNlTGlua1RleHQoZW50cnkpLCBvd25lckZpbGUucGF0aCk7XG4gICAgaWYgKCFkZXN0KSB7XG4gICAgICBjb25zb2xlLndhcm4oYFtQcm9wZXJ0eS1CYWNrbGlua2luZ10gTGluayBrb25udGUgbmljaHQgYXVmZ2VsXHUwMEY2c3Qgd2VyZGVuOiBcIiR7ZW50cnl9XCIgaW4gJHtvd25lckZpbGUucGF0aH1gKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoZGVzdC5wYXRoICE9PSBvd25lckZpbGUucGF0aCkgdGFyZ2V0cy5wdXNoKGRlc3QpO1xuICB9XG4gIHJldHVybiB0YXJnZXRzO1xufVxuXG4vLyB7IFtwcm9wZXJ0eV06IHsgW3NvdXJjZVBhdGhdOiBbdGFyZ2V0UGF0aCwgLi4uXSB9IH0gLSByZWluZSBKU09OLXRhdWdsaWNoZSBTdHJ1a3R1cixcbi8vIGRhbWl0IHNpZSAxOjEgaW4gZGVuIFBsdWdpbi1TZXR0aW5ncyBnZXNwZWljaGVydCB3ZXJkZW4ga2Fubi5cbmZ1bmN0aW9uIGNvbXB1dGVEZWNsYXJlZFBhaXJzKGFwcCwgcHJvcGVydHlOYW1lcywgZmlsZXMpIHtcbiAgY29uc3QgcGFpcnMgPSB7fTtcbiAgZm9yIChjb25zdCBwcm9wZXJ0eU5hbWUgb2YgcHJvcGVydHlOYW1lcykge1xuICAgIGNvbnN0IGJ5U291cmNlID0ge307XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBmcm9udG1hdHRlciA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI7XG4gICAgICBpZiAoIWZyb250bWF0dGVyPy5bcHJvcGVydHlOYW1lXSkgY29udGludWU7XG4gICAgICBjb25zdCB0YXJnZXRzID0gcmVzb2x2ZUxpbmtUYXJnZXRzKGFwcCwgZmlsZSwgZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSk7XG4gICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPiAwKSBieVNvdXJjZVtmaWxlLnBhdGhdID0gdGFyZ2V0cy5tYXAoKHQpID0+IHQucGF0aCk7XG4gICAgfVxuICAgIHBhaXJzW3Byb3BlcnR5TmFtZV0gPSBieVNvdXJjZTtcbiAgfVxuICByZXR1cm4gcGFpcnM7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldFNldChwYWlycywgcHJvcGVydHlOYW1lLCBzb3VyY2VQYXRoKSB7XG4gIHJldHVybiBuZXcgU2V0KHBhaXJzPy5bcHJvcGVydHlOYW1lXT8uW3NvdXJjZVBhdGhdID8/IFtdKTtcbn1cblxuLy8gdHlwT3JkZXI6IGVpbmUgZGFiZWkgTkVVIGFuZ2VsZWd0ZSBQcm9wZXJ0eSBwZXIgVFlQLVN5c3RlbSAocGxhY2VQcm9wZXJ0eSlcbi8vIGFuIGlocmVuIFBsYXR6IGxhdXQgZGVzc2VuIEZyb250bWF0dGVyLVNvcnRpZXJ1bmcgc2V0emVuLCBzdGF0dCBzaWUgYW0gRW5kZVxuLy8gYW56dWhcdTAwRTRuZ2VuIC0gbnVyIGRpZXNlIGVpbmUsIGRlciBSZXN0IGJsZWlidCB1bnZlclx1MDBFNG5kZXJ0LiBPaG5lIFRZUC1TeXN0ZW1cbi8vIChvZGVyIGluIGVpbmVyIFZlcnNpb24gb2huZSBwbGFjZVByb3BlcnR5KSBibGVpYnQgZXMgYmVpbSBBbmhcdTAwRTRuZ2VuLlxuYXN5bmMgZnVuY3Rpb24gYWRkTGlua1RvUHJvcGVydHkoYXBwLCBwcm9wZXJ0eU5hbWUsIG93bmVyRmlsZSwgdGFyZ2V0RmlsZSwgdHlwT3JkZXIpIHtcbiAgYXdhaXQgYXBwLmZpbGVNYW5hZ2VyLnByb2Nlc3NGcm9udE1hdHRlcihvd25lckZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0b0FycmF5KGZyb250bWF0dGVyW3Byb3BlcnR5TmFtZV0pO1xuICAgIGNvbnN0IGFscmVhZHlUaGVyZSA9IHJlc29sdmVMaW5rVGFyZ2V0cyhhcHAsIG93bmVyRmlsZSwgY3VycmVudCkuc29tZSgoZikgPT4gZi5wYXRoID09PSB0YXJnZXRGaWxlLnBhdGgpO1xuICAgIGlmIChhbHJlYWR5VGhlcmUpIHJldHVybjtcbiAgICBjb25zdCBpc05ldyA9ICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZnJvbnRtYXR0ZXIsIHByb3BlcnR5TmFtZSk7XG4gICAgY29uc3QgbGluayA9IGFwcC5maWxlTWFuYWdlci5nZW5lcmF0ZU1hcmtkb3duTGluayh0YXJnZXRGaWxlLCBvd25lckZpbGUucGF0aCk7XG4gICAgZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSA9IFsuLi5jdXJyZW50LCBsaW5rXTtcbiAgICBpZiAoaXNOZXcgJiYgdHlwT3JkZXIpIGFwcC5wbHVnaW5zLnBsdWdpbnNbXCJ0eXAtc3lzdGVtXCJdPy5wbGFjZVByb3BlcnR5Py4oZnJvbnRtYXR0ZXIsIHByb3BlcnR5TmFtZSk7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZW1vdmVMaW5rRnJvbVByb3BlcnR5KGFwcCwgcHJvcGVydHlOYW1lLCBvd25lckZpbGUsIHRhcmdldFBhdGgpIHtcbiAgYXdhaXQgYXBwLmZpbGVNYW5hZ2VyLnByb2Nlc3NGcm9udE1hdHRlcihvd25lckZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0b0FycmF5KGZyb250bWF0dGVyW3Byb3BlcnR5TmFtZV0pO1xuICAgIGNvbnN0IGZpbHRlcmVkID0gY3VycmVudC5maWx0ZXIoKGVudHJ5KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGVudHJ5ICE9PSBcInN0cmluZ1wiKSByZXR1cm4gdHJ1ZTtcbiAgICAgIGNvbnN0IGRlc3QgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChwYXJzZUxpbmtUZXh0KGVudHJ5KSwgb3duZXJGaWxlLnBhdGgpO1xuICAgICAgcmV0dXJuICEoZGVzdCAmJiBkZXN0LnBhdGggPT09IHRhcmdldFBhdGgpO1xuICAgIH0pO1xuICAgIGlmIChmaWx0ZXJlZC5sZW5ndGggPT09IGN1cnJlbnQubGVuZ3RoKSByZXR1cm47XG4gICAgaWYgKGZpbHRlcmVkLmxlbmd0aCA9PT0gMCkgZGVsZXRlIGZyb250bWF0dGVyW3Byb3BlcnR5TmFtZV07XG4gICAgZWxzZSBmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdID0gZmlsdGVyZWQ7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhcHBseUNoYW5nZXMoYXBwLCBwcm9wZXJ0eU5hbWVzLCBwcmV2aW91c1BhaXJzLCBjdXJyZW50UGFpcnMsIHR5cE9yZGVyKSB7XG4gIGxldCBhZGRlZCA9IDA7XG4gIGxldCByZW1vdmVkID0gMDtcblxuICBmb3IgKGNvbnN0IHByb3BlcnR5TmFtZSBvZiBwcm9wZXJ0eU5hbWVzKSB7XG4gICAgY29uc3Qgc291cmNlUGF0aHMgPSBuZXcgU2V0KFtcbiAgICAgIC4uLk9iamVjdC5rZXlzKHByZXZpb3VzUGFpcnM/Lltwcm9wZXJ0eU5hbWVdID8/IHt9KSxcbiAgICAgIC4uLk9iamVjdC5rZXlzKGN1cnJlbnRQYWlycz8uW3Byb3BlcnR5TmFtZV0gPz8ge30pLFxuICAgIF0pO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VQYXRoIG9mIHNvdXJjZVBhdGhzKSB7XG4gICAgICBjb25zdCBwcmV2VGFyZ2V0cyA9IGdldFRhcmdldFNldChwcmV2aW91c1BhaXJzLCBwcm9wZXJ0eU5hbWUsIHNvdXJjZVBhdGgpO1xuICAgICAgY29uc3QgY3VyclRhcmdldHMgPSBnZXRUYXJnZXRTZXQoY3VycmVudFBhaXJzLCBwcm9wZXJ0eU5hbWUsIHNvdXJjZVBhdGgpO1xuXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBhdGggb2YgY3VyclRhcmdldHMpIHtcbiAgICAgICAgaWYgKHByZXZUYXJnZXRzLmhhcyh0YXJnZXRQYXRoKSkgY29udGludWU7IC8vIHVudmVyXHUwMEU0bmRlcnRcblxuICAgICAgICBjb25zdCBzb3VyY2VGaWxlID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChzb3VyY2VQYXRoKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0RmlsZSA9IGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGFyZ2V0UGF0aCk7XG4gICAgICAgIGlmICghKHNvdXJjZUZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgISh0YXJnZXRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSBjb250aW51ZTtcblxuICAgICAgICBhd2FpdCBhZGRMaW5rVG9Qcm9wZXJ0eShhcHAsIHByb3BlcnR5TmFtZSwgdGFyZ2V0RmlsZSwgc291cmNlRmlsZSwgdHlwT3JkZXIpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1Byb3BlcnR5LUJhY2tsaW5raW5nXSBcIiR7cHJvcGVydHlOYW1lfVwiOiAke3RhcmdldEZpbGUucGF0aH0gPC0gJHtzb3VyY2VGaWxlLnBhdGh9IGVyZ1x1MDBFNG56dGApO1xuICAgICAgICBhZGRlZCsrO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBhdGggb2YgcHJldlRhcmdldHMpIHtcbiAgICAgICAgaWYgKGN1cnJUYXJnZXRzLmhhcyh0YXJnZXRQYXRoKSkgY29udGludWU7IC8vIHdlaXRlcmhpbiB2b3JoYW5kZW5cblxuICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0YXJnZXRQYXRoKTtcbiAgICAgICAgaWYgKCEodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG5cbiAgICAgICAgYXdhaXQgcmVtb3ZlTGlua0Zyb21Qcm9wZXJ0eShhcHAsIHByb3BlcnR5TmFtZSwgdGFyZ2V0RmlsZSwgc291cmNlUGF0aCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUHJvcGVydHktQmFja2xpbmtpbmddIFwiJHtwcm9wZXJ0eU5hbWV9XCI6ICR7dGFyZ2V0RmlsZS5wYXRofSA8LSAke3NvdXJjZVBhdGh9IGVudGZlcm50YCk7XG4gICAgICAgIHJlbW92ZWQrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBhZGRlZCwgcmVtb3ZlZCB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzeW5jQWxsTGlua3MoYXBwLCBwcm9wZXJ0eU5hbWVzLCBwcmV2aW91c1BhaXJzLCB7IHR5cE9yZGVyID0gZmFsc2UgfSA9IHt9KSB7XG4gIGNvbnN0IGZpbGVzID0gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgY29uc29sZS5sb2coYFtQcm9wZXJ0eS1CYWNrbGlua2luZ10gUHJcdTAwRkNmZSAke2ZpbGVzLmxlbmd0aH0gTm90aXplbiBmXHUwMEZDciBQcm9wZXJ0aWVzOiAke3Byb3BlcnR5TmFtZXMuam9pbihcIiwgXCIpfWApO1xuXG4gIGNvbnN0IGN1cnJlbnRQYWlycyA9IGNvbXB1dGVEZWNsYXJlZFBhaXJzKGFwcCwgcHJvcGVydHlOYW1lcywgZmlsZXMpO1xuICBjb25zdCB7IGFkZGVkLCByZW1vdmVkIH0gPSBhd2FpdCBhcHBseUNoYW5nZXMoYXBwLCBwcm9wZXJ0eU5hbWVzLCBwcmV2aW91c1BhaXJzLCBjdXJyZW50UGFpcnMsIHR5cE9yZGVyKTtcblxuICByZXR1cm4ge1xuICAgIGNoZWNrZWQ6IGZpbGVzLmxlbmd0aCxcbiAgICBhZGRlZCxcbiAgICByZW1vdmVkLFxuICAgIGRlY2xhcmVkUGFpcnM6IGN1cnJlbnRQYWlycyxcbiAgfTtcbn1cblxuLy8gTGl2ZS1Nb2R1czogbFx1MDBGNnN0IGJlaSBqZWRlciBNZXRhZGF0ZW4tXHUwMEM0bmRlcnVuZyBlaW5lbiB2b2xsc3RcdTAwRTRuZGlnZW4gQWJnbGVpY2ggYXVzLlxuLy8gRWluIGVpbmZhY2hlcyBMb2NrIHZlcmhpbmRlcnQgXHUwMEZDYmVybGFwcGVuZGUgTFx1MDBFNHVmZSBiZWkgc2NobmVsbCBhdWZlaW5hbmRlcmZvbGdlbmRlblxuLy8gU3BlaWNoZXJ1bmdlbjsgd1x1MDBFNGhyZW5kIGVpbiBMYXVmIGFrdGl2IGlzdCwgd2lyZCBoXHUwMEY2Y2hzdGVucyBlaW4gd2VpdGVyZXIgbmFjaGdlaG9sdC5cbmZ1bmN0aW9uIHJlZ2lzdGVyUHJvcGVydHlCYWNrbGlua3NMaXZlKHBsdWdpbikge1xuICBsZXQgcnVubmluZyA9IGZhbHNlO1xuICBsZXQgcGVuZGluZyA9IGZhbHNlO1xuXG4gIGNvbnN0IHJ1blN5bmMgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKHJ1bm5pbmcpIHtcbiAgICAgIHBlbmRpbmcgPSB0cnVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBydW5uaW5nID0gdHJ1ZTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3luY0FsbExpbmtzKHBsdWdpbi5hcHAsIHBsdWdpbi5zZXR0aW5ncy5yZWNpcHJvY2FsTGlua1Byb3BlcnRpZXMsIHBsdWdpbi5zZXR0aW5ncy5kZWNsYXJlZExpbmtQYWlycywge1xuICAgICAgICB0eXBPcmRlcjogcGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzVHlwT3JkZXIsXG4gICAgICB9KTtcbiAgICAgIHBsdWdpbi5zZXR0aW5ncy5kZWNsYXJlZExpbmtQYWlycyA9IHJlc3VsdC5kZWNsYXJlZFBhaXJzO1xuICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbUHJvcGVydHktQmFja2xpbmtpbmddIEZlaGxlcjpcIiwgZSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIGlmIChwZW5kaW5nKSB7XG4gICAgICAgIHBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgcnVuU3luYygpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBvbk1ldGFkYXRhQ2hhbmdlZCA9IChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MucHJvcGVydHlCYWNrbGlua3NMaXZlRW5hYmxlZCkgcmV0dXJuO1xuICAgIC8vIERlciBLb250YWt0LUltcG9ydCBzY2hyZWlidCBiaXMgenUgMTUyIE5vdGl6ZW4gYW0gU3RcdTAwRkNjazsgamVkZSBkYXZvblxuICAgIC8vIGxcdTAwRjZzdGUgaGllciBzb25zdCBlaW5lbiBlaWdlbmVuIExhdWYgXHUwMEZDYmVyIGRlbiBnZXNhbXRlbiBWYXVsdCBhdXMuIEVyXG4gICAgLy8gcGF1c2llcnQgZGVzaGFsYiB1bmQgc3RcdTAwRjZcdTAwREZ0IHp1bSBTY2hsdXNzIGdlbmF1IGVpbmVuIEFiZ2xlaWNoIGFuLlxuICAgIGlmIChwbHVnaW4uc3VzcGVuZFByb3BlcnR5QmFja2xpbmtzKSByZXR1cm47XG4gICAgaWYgKGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybjtcbiAgICBydW5TeW5jKCk7XG4gIH07XG5cbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9uKFwiY2hhbmdlZFwiLCBvbk1ldGFkYXRhQ2hhbmdlZCkpO1xuXG4gIC8vIERhbWl0IGFuZGVyZSBUZWlsZSBkZXMgUGx1Z2lucyAoei4gQi4gZGVyIEtvbnRha3QtSW1wb3J0KSBlaW5lblxuICAvLyB2b2xsc3RcdTAwRTRuZGlnZW4gQWJnbGVpY2ggYW5zdG9cdTAwREZlbiBrXHUwMEY2bm5lbiwgb2huZSBkZW4gTGl2ZS1Nb2R1cyB6dSBicmF1Y2hlbi5cbiAgcmV0dXJuIHJ1blN5bmM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBzeW5jQWxsTGlua3MsIHJlZ2lzdGVyUHJvcGVydHlCYWNrbGlua3NMaXZlIH07XG4iLCAiY29uc3QgeyBOb3RpY2UgfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcbmNvbnN0IHsgaW1wb3J0Q29udGFjdHNGcm9tQ3N2LCBkZWxldGVVbnRvdWNoZWRDb250YWN0cyB9ID0gcmVxdWlyZShcIi4va29udGFrdC1pbXBvcnRcIik7XG5jb25zdCB7IHN5bmNBbGxMaW5rcyB9ID0gcmVxdWlyZShcIi4vcHJvcGVydHktc3luY1wiKTtcbmNvbnN0IHsgb3BlbkltcG9ydGFudFBsdWdpblNldHRpbmdzUGlja2VyIH0gPSByZXF1aXJlKFwiLi9pbXBvcnRhbnQtcGx1Z2luc1wiKTtcblxuZnVuY3Rpb24gcmVnaXN0ZXJDb21tYW5kcyhwbHVnaW4pIHtcblxuICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgaWQ6IFwia29udGFrdGUtY3N2LWltcG9ydFwiLFxuICAgIG5hbWU6IFwiS09OVEFLVEUgLSBLb250YWt0ZSBhdXMgQ1NWIGFrdHVhbGlzaWVyZW5cIixcbiAgICBjYWxsYmFjazogKCkgPT4gaW1wb3J0Q29udGFjdHNGcm9tQ3N2KHBsdWdpbiksXG4gIH0pO1xuXG4gIHBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICBpZDogXCJrb250YWt0ZS11bnZlcmFlbmRlcnQtbG9lc2NoZW5cIixcbiAgICBuYW1lOiBcIktPTlRBS1RFIC0gVW52ZXJcdTAwRTRuZGVydGUgS29udGFrdGUgbFx1MDBGNnNjaGVuXCIsXG4gICAgY2FsbGJhY2s6ICgpID0+IGRlbGV0ZVVudG91Y2hlZENvbnRhY3RzKHBsdWdpbiksXG4gIH0pO1xuXG4gIHBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICBpZDogXCJwcm9wZXJ0eS1zeW5jXCIsXG4gICAgbmFtZTogXCJQcm9wZXJ0eS1CYWNrbGlua2luZyAtIEFrdHVhbGlzaWVyZW5cIixcbiAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3luY0FsbExpbmtzKHBsdWdpbi5hcHAsIHBsdWdpbi5zZXR0aW5ncy5yZWNpcHJvY2FsTGlua1Byb3BlcnRpZXMsIHBsdWdpbi5zZXR0aW5ncy5kZWNsYXJlZExpbmtQYWlycywge1xuICAgICAgICB0eXBPcmRlcjogcGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzVHlwT3JkZXIsXG4gICAgICB9KTtcbiAgICAgIHBsdWdpbi5zZXR0aW5ncy5kZWNsYXJlZExpbmtQYWlycyA9IHJlc3VsdC5kZWNsYXJlZFBhaXJzO1xuICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgbmV3IE5vdGljZShgUHJvcGVydHktQmFja2xpbmtpbmc6ICR7cmVzdWx0LmNoZWNrZWR9IE5vdGl6ZW4gZ2Vwclx1MDBGQ2Z0LCAke3Jlc3VsdC5hZGRlZH0gZXJnXHUwMEU0bnp0LCAke3Jlc3VsdC5yZW1vdmVkfSBlbnRmZXJudC5gKTtcbiAgICB9LFxuICB9KTtcblxuICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgaWQ6IFwib3Blbi1pbXBvcnRhbnQtcGx1Z2luLXNldHRpbmdzXCIsXG4gICAgbmFtZTogXCJPcGVuIEltcG9ydGFudCBQbHVnaW4gU2V0dGluZ3MgKFBpY2tlcilcIixcbiAgICBjYWxsYmFjazogKCkgPT4gb3BlbkltcG9ydGFudFBsdWdpblNldHRpbmdzUGlja2VyKHBsdWdpbiksXG4gIH0pO1xuXG4gIHBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICBpZDogXCJkYXRlbmJhbmstb3JkbmVyLW9lZmZuZW4tc2NobGllc3NlblwiLFxuICAgIG5hbWU6IFwiRGF0ZW5iYW5rIC0gT3JkbmVyIFx1MDBGNmZmbmVuL3NjaGxpZVx1MDBERmVuXCIsXG4gICAgY2FsbGJhY2s6ICgpID0+IHBsdWdpbi50b2dnbGVEYXRhYmFzZUZvbGRlcj8uKCksXG4gIH0pO1xuXG59XG5cbm1vZHVsZS5leHBvcnRzID0geyByZWdpc3RlckNvbW1hbmRzIH07XG4iLCAiY29uc3QgeyBURmlsZSwgVEZvbGRlciwgRnV6enlTdWdnZXN0TW9kYWwsIE5vdGljZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIERhdGVuYmFuay1PcmRuZXJcbiAqIE9yZG5lciBtaXQga29uZmlndXJpZXJiYXJlbSBQclx1MDBFNGZpeCAoU3RhbmRhcmQgXCJ+XCIpIHdlcmRlbiBpbVxuICogRmlsZS1FeHBsb3JlciBuaWNodCBtZWhyIGF1Zi0venVrbGFwcGJhciBkYXJnZXN0ZWxsdCB1bmQgemVpZ2VuXG4gKiBzdGF0dCBkZXMgUGZlaWxzIGRpZSBBbnphaGwgZW50aGFsdGVuZXIgLm1kLURhdGVpZW4uXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLy8gQ1NTIHppZWx0IGJld3Vzc3QgYXVmIGRpZSBLbGFzc2UgXCIuZnJlZC1kYi1mb2xkZXJcIiBzdGF0dCBhdWYgZWluXG4vLyBbZGF0YS1wYXRoXj0uLi5dL1tkYXRhLXBhdGgqPS4uLl0tQXR0cmlidXRzZWxla3RvcjogRWluIEF0dHJpYnV0c2VsZWt0b3Jcbi8vIG1hdGNodCBkZW4gR0VTQU1URU4gUGZhZC1TdHJpbmcsIG5pY2h0IG51ciBkZW4gT3JkbmVybmFtZW4gLSBlaW5cbi8vIFVudGVyb3JkbmVyIE9ITkUgUHJcdTAwRTRmaXggaW5uZXJoYWxiIGVpbmVzIERhdGVuYmFuay1PcmRuZXJzICh6LiBCLlxuLy8gXCJ+REIvU3ViXCIpIGhcdTAwRTR0dGUgZWluZW4gZGF0YS1wYXRoLCBkZXIgZWJlbmZhbGxzIG1pdCBkZW0gUHJcdTAwRTRmaXggYmVnaW5udCxcbi8vIHVuZCB3XHUwMEZDcmRlIGZhZWxzY2hsaWNoIGRpZSBQZmVpbC1BdXNibGVuZC1SZWdlbCBlcmJlbi4gRGllIEtsYXNzZSB3aXJkIGluXG4vLyByZWZyZXNoV2F0Y2hlZEZvbGRlcnMoKSBhdXNzY2hsaWVzc2xpY2ggXHUwMEZDYmVyIGlzRGF0YWJhc2VQYXRoKCkgKHByXHUwMEZDZnQgbnVyXG4vLyBkZW4gZWlnZW5lbiBPcmRuZXJuYW1lbikgZ2VzZXR6dCwgZGllc2VsYmUgUXVlbGxlIHdpZSBmXHUwMEZDciBkaWUgQmFkZ2UtTG9naWtcbi8vIC0gZGFtaXQga1x1MDBGNm5uZW4gQ1NTIHVuZCBKUyBuaWUgYXVzZWluYW5kZXJsYXVmZW4uXG5mdW5jdGlvbiBidWlsZFN0eWxlKHByZWZpeCwgc3VwcHJlc3NVbmRlcmxpbmUsIGNvdW50QXRFbmQpIHtcbiAgaWYgKCFwcmVmaXgpIHJldHVybiBcIlwiO1xuICBsZXQgY3NzID0gXCJcIjtcblxuICBpZiAoY291bnRBdEVuZCkge1xuICAgIGNzcyArPSBgXG4ubmF2LWZvbGRlci10aXRsZS5mcmVkLWRiLWZvbGRlciAuY29sbGFwc2UtaWNvbiB7XG4gIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbn1cbmA7XG4gIH0gZWxzZSB7XG4gICAgY3NzICs9IGBcbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5jb2xsYXBzZS1pY29uIHN2ZyB7XG4gIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbn1cbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5jb2xsYXBzZS1pY29uIHtcbiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbn1cbi5mcmVkLWRiLWNvdW50IHtcbiAgZm9udC1zaXplOiB2YXIoLS1mb250LXVpLXNtYWxsZXIpO1xuICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XG59XG5gO1xuICB9XG5cbiAgaWYgKHN1cHByZXNzVW5kZXJsaW5lKSB7XG4gICAgY3NzICs9IGBcbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5uYXYtZm9sZGVyLXRpdGxlLWNvbnRlbnQge1xuICB0ZXh0LWRlY29yYXRpb24tbGluZTogbm9uZSAhaW1wb3J0YW50O1xufVxuYDtcbiAgfVxuICByZXR1cm4gY3NzO1xufVxuXG5mdW5jdGlvbiBpc0RhdGFiYXNlUGF0aChwYXRoLCBwcmVmaXgpIHtcbiAgaWYgKCFwYXRoIHx8ICFwcmVmaXgpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgbmFtZSA9IHBhdGguc3BsaXQoXCIvXCIpLnBvcCgpO1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKHByZWZpeCk7XG59XG5cbmZ1bmN0aW9uIGlzRGF0YWJhc2VGb2xkZXJUaXRsZSh0aXRsZUVsLCBwcmVmaXgpIHtcbiAgaWYgKCF0aXRsZUVsKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBpc0RhdGFiYXNlUGF0aCh0aXRsZUVsLmdldEF0dHJpYnV0ZShcImRhdGEtcGF0aFwiKSwgcHJlZml4KTtcbn1cblxuLy8gXHUwMEM0dVx1MDBERmVyc3RlciBEYXRlbmJhbmstT3JkbmVyIGF1ZiBkZW0gUGZhZCBlaW5lciBEYXRlaSAobmljaHQgZGllIERhdGVpIHNlbGJzdCkgLVxuLy8gYmVpIHZlcnNjaGFjaHRlbHRlbiBEYXRlbmJhbmstT3JkbmVybiBkZXIgb2JlcnN0ZSwgd2VpbCBlaW4gd2VpdGVyIGlubmVuXG4vLyBsaWVnZW5kZXIgVHJlZmZlciBvaG5laGluIHVuc2ljaHRiYXIgd1x1MDBFNHJlLCBzb2xhbmdlIGRlciBcdTAwRTR1XHUwMERGZXJlIHp1Z2VrbGFwcHQgaXN0LlxuZnVuY3Rpb24gZmluZERhdGFiYXNlQW5jZXN0b3JGb2xkZXIoYXBwLCBmaWxlUGF0aCwgcHJlZml4KSB7XG4gIGlmICghcHJlZml4KSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc2VnbWVudHMgPSBmaWxlUGF0aC5zcGxpdChcIi9cIik7XG4gIHNlZ21lbnRzLnBvcCgpO1xuICBmb3IgKGxldCBpID0gMTsgaSA8PSBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNhbmRpZGF0ZVBhdGggPSBzZWdtZW50cy5zbGljZSgwLCBpKS5qb2luKFwiL1wiKTtcbiAgICBpZiAoaXNEYXRhYmFzZVBhdGgoY2FuZGlkYXRlUGF0aCwgcHJlZml4KSkge1xuICAgICAgY29uc3QgZm9sZGVyID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjYW5kaWRhdGVQYXRoKTtcbiAgICAgIGlmIChmb2xkZXIgaW5zdGFuY2VvZiBURm9sZGVyKSByZXR1cm4gZm9sZGVyO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY291bnRNYXJrZG93bkZpbGVzKGFwcCwgZm9sZGVyUGF0aCkge1xuICBjb25zdCBjaGlsZFByZWZpeCA9IGZvbGRlclBhdGggKyBcIi9cIjtcbiAgbGV0IGNvdW50ID0gMDtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkpIHtcbiAgICBpZiAoZmlsZS5wYXRoLnN0YXJ0c1dpdGgoY2hpbGRQcmVmaXgpKSBjb3VudCsrO1xuICB9XG4gIHJldHVybiBjb3VudDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRm9sZGVyQmFkZ2UoYXBwLCBuYXZGb2xkZXIsIGZvbGRlclBhdGgsIGF0RW5kKSB7XG4gIGNvbnN0IHRpdGxlRWwgPSBuYXZGb2xkZXIucXVlcnlTZWxlY3RvcihcIjpzY29wZSA+IC5uYXYtZm9sZGVyLXRpdGxlXCIpO1xuICBpZiAoIXRpdGxlRWwpIHJldHVybjtcbiAgY29uc3QgY29sbGFwc2VJY29uID0gdGl0bGVFbC5xdWVyeVNlbGVjdG9yKFwiOnNjb3BlID4gLmNvbGxhcHNlLWljb25cIik7XG5cbiAgLy8gQmFkZ2UgYXVzIGRlciBqZXdlaWxzIGFuZGVyZW4gUG9zaXRpb24gZW50ZmVybmVuLCBmYWxscyBkaWUgRWluc3RlbGx1bmdcbiAgLy8gc2VpdCBkZW0gbGV0enRlbiBVcGRhdGUgZ2V3ZWNoc2VsdCBoYXQuXG4gIGlmIChhdEVuZCAmJiBjb2xsYXBzZUljb24pIHtcbiAgICBjb25zdCBzdGFsZSA9IGNvbGxhcHNlSWNvbi5xdWVyeVNlbGVjdG9yKFwiLmZyZWQtZGItY291bnRcIik7XG4gICAgaWYgKHN0YWxlKSBzdGFsZS5yZW1vdmUoKTtcbiAgfVxuICBpZiAoIWF0RW5kKSB7XG4gICAgY29uc3Qgc3RhbGUgPSB0aXRsZUVsLnF1ZXJ5U2VsZWN0b3IoXCI6c2NvcGUgPiAuZnJlZC1kYi1jb3VudFwiKTtcbiAgICBpZiAoc3RhbGUpIHN0YWxlLnJlbW92ZSgpO1xuICB9XG5cbiAgY29uc3QgcGFyZW50ID0gYXRFbmQgPyB0aXRsZUVsIDogY29sbGFwc2VJY29uO1xuICBpZiAoIXBhcmVudCkgcmV0dXJuO1xuXG4gIGxldCBiYWRnZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKFwiOnNjb3BlID4gLmZyZWQtZGItY291bnRcIik7XG4gIGlmICghYmFkZ2UpIHtcbiAgICBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgYmFkZ2UuY2xhc3NOYW1lID0gYXRFbmQgPyBcIm5hdi1maWxlLXRhZyBmcmVkLWRiLWNvdW50XCIgOiBcImZyZWQtZGItY291bnRcIjtcbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoYmFkZ2UpO1xuICB9XG4gIGJhZGdlLnRleHRDb250ZW50ID0gU3RyaW5nKGNvdW50TWFya2Rvd25GaWxlcyhhcHAsIGZvbGRlclBhdGgpKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRm9sZGVyQmFkZ2UobmF2Rm9sZGVyKSB7XG4gIG5hdkZvbGRlci5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyZWQtZGItY291bnRcIikuZm9yRWFjaCgoZWwpID0+IGVsLnJlbW92ZSgpKTtcbn1cblxuZnVuY3Rpb24gc2V0RGF0YWJhc2VGb2xkZXJDbGFzcyh0aXRsZUVsLCBpc0RiRm9sZGVyKSB7XG4gIHRpdGxlRWwuY2xhc3NMaXN0LnRvZ2dsZShcImZyZWQtZGItZm9sZGVyXCIsIGlzRGJGb2xkZXIpO1xufVxuXG5mdW5jdGlvbiBjb2xsZWN0RGF0YWJhc2VGb2xkZXJzKGFwcCwgcHJlZml4KSB7XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBjb25zdCB3YWxrID0gKGZvbGRlcikgPT4ge1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZm9sZGVyLmNoaWxkcmVuKSB7XG4gICAgICBpZiAoIShjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpKSBjb250aW51ZTtcbiAgICAgIGlmIChpc0RhdGFiYXNlUGF0aChjaGlsZC5wYXRoLCBwcmVmaXgpKSByZXN1bHQucHVzaChjaGlsZCk7XG4gICAgICB3YWxrKGNoaWxkKTtcbiAgICB9XG4gIH07XG4gIHdhbGsoYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gIHJldHVybiByZXN1bHQuc29ydCgoYSwgYikgPT4gYS5wYXRoLmxvY2FsZUNvbXBhcmUoYi5wYXRoKSk7XG59XG5cbi8vIEZcdTAwRkNyIGRlbiBCZWZlaGwgXCJEYXRlbmJhbmstT3JkbmVyIFx1MDBGNmZmbmVuL3NjaGxpZVx1MDBERmVuXCI6IEZ1enp5LUF1c3dhaGwgXHUwMEZDYmVyIGFsbGVcbi8vIHZvcmhhbmRlbmVuIERhdGVuYmFuay1PcmRuZXIsIG1pdCBBbnplaWdlLCBvYiBzaWUgYWt0dWVsbCBtYW51ZWxsIG9mZmVuIHNpbmQuXG5jbGFzcyBEYXRhYmFzZUZvbGRlclBpY2tlck1vZGFsIGV4dGVuZHMgRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIGZvbGRlcnMsIG1hbnVhbGx5T3BlblBhdGhzLCByZXNvbHZlKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmZvbGRlcnMgPSBmb2xkZXJzO1xuICAgIHRoaXMubWFudWFsbHlPcGVuUGF0aHMgPSBtYW51YWxseU9wZW5QYXRocztcbiAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIHRoaXMuY2hvc2VuID0gZmFsc2U7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIkRhdGVuYmFuay1PcmRuZXIgenVtIFx1MDBENmZmbmVuL1NjaGxpZVx1MDBERmVuIHdcdTAwRTRobGVuIC0gRVNDIGZcdTAwRkNyIEFiYnJ1Y2hcIik7XG4gIH1cblxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5mb2xkZXJzO1xuICB9XG5cbiAgZ2V0SXRlbVRleHQoZm9sZGVyKSB7XG4gICAgcmV0dXJuIGZvbGRlci5wYXRoO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihtYXRjaCwgZWwpIHtcbiAgICBjb25zdCBmb2xkZXIgPSBtYXRjaC5pdGVtO1xuICAgIGNvbnN0IGlzT3BlbiA9IHRoaXMubWFudWFsbHlPcGVuUGF0aHMuaGFzKGZvbGRlci5wYXRoKTtcbiAgICBlbC5jcmVhdGVTcGFuKHsgdGV4dDogZm9sZGVyLnBhdGggfSk7XG4gICAgY29uc3Qgc3RhdGUgPSBlbC5jcmVhdGVTcGFuKHsgdGV4dDogaXNPcGVuID8gXCJnZVx1MDBGNmZmbmV0XCIgOiBcImdlc2NobG9zc2VuXCIgfSk7XG4gICAgc3RhdGUuc3R5bGUuZmxvYXQgPSBcInJpZ2h0XCI7XG4gICAgc3RhdGUuc3R5bGUuY29sb3IgPSBcInZhcigtLXRleHQtbXV0ZWQpXCI7XG4gIH1cblxuICBzZWxlY3RTdWdnZXN0aW9uKGl0ZW0sIGV2dCkge1xuICAgIHRoaXMuY2hvc2VuID0gdHJ1ZTtcbiAgICBzdXBlci5zZWxlY3RTdWdnZXN0aW9uKGl0ZW0sIGV2dCk7XG4gIH1cblxuICBvbkNob29zZUl0ZW0oZm9sZGVyKSB7XG4gICAgdGhpcy5yZXNvbHZlKGZvbGRlcik7XG4gIH1cblxuICBvbkNsb3NlKCkge1xuICAgIHN1cGVyLm9uQ2xvc2UoKTtcbiAgICBpZiAoIXRoaXMuY2hvc2VuKSB0aGlzLnJlc29sdmUobnVsbCk7XG4gIH1cbn1cblxuLy8gRXJzZXR6dCBpbiBkZXIgRGF0ZWktRXhwbG9yZXItQW5zaWNodCBkYXMgWmllbCB2b24gcmV2ZWFsSW5Gb2xkZXIoKSBmXHUwMEZDciBlaW5lXG4vLyBEYXRlaSBpbm5lcmhhbGIgZWluZXMgRGF0ZW5iYW5rLU9yZG5lcnM6IHN0YXR0IHp1ciAodW5zaWNodGJhcmVuLCB3ZWlsIGRlclxuLy8gcGF0Y2hGb2xkZXJJdGVtLVBhdGNoIHVudGVuIGRhcyBBdWZrbGFwcGVuIG9obmVoaW4gdmVyaGluZGVydCkgRGF0ZWkgc2VsYnN0XG4vLyB6dSBzcHJpbmdlbiwgd2lyZCBkZXIgRGF0ZW5iYW5rLU9yZG5lciBzZWxic3QgZ2V6ZWlndC4gUmVpbiBrb3NtZXRpc2NoIC1cbi8vIGRhc3MgZGVyIE9yZG5lciB6dSBibGVpYnQsIGdhcmFudGllcnQgYmVyZWl0cyBwYXRjaEZvbGRlckl0ZW0gdW50ZW4sXG4vLyB1bmFiaFx1MDBFNG5naWcgZGF2b24sIHdlbGNoZXMgWmllbCBoaWVyIGdld1x1MDBFNGhsdCB3aXJkLlxuZnVuY3Rpb24gcGF0Y2hSZXZlYWxJbkZvbGRlcihwbHVnaW4sIHZpZXcsIHBhdGNoZWRWaWV3cykge1xuICBpZiAoIXZpZXcgfHwgdHlwZW9mIHZpZXcucmV2ZWFsSW5Gb2xkZXIgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuICBpZiAodmlldy5fX2ZyZWRSZXZlYWxPcmlnaW5hbCkge1xuICAgIHBhdGNoZWRWaWV3cy5hZGQodmlldyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IG9yaWdpbmFsID0gdmlldy5yZXZlYWxJbkZvbGRlci5iaW5kKHZpZXcpO1xuICB2aWV3Ll9fZnJlZFJldmVhbE9yaWdpbmFsID0gb3JpZ2luYWw7XG4gIHZpZXcucmV2ZWFsSW5Gb2xkZXIgPSAoaXRlbSkgPT4ge1xuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCAmJiBpdGVtIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIGNvbnN0IGRiRm9sZGVyID0gZmluZERhdGFiYXNlQW5jZXN0b3JGb2xkZXIocGx1Z2luLmFwcCwgaXRlbS5wYXRoLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpO1xuICAgICAgaWYgKGRiRm9sZGVyKSByZXR1cm4gb3JpZ2luYWwoZGJGb2xkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWwoaXRlbSk7XG4gIH07XG4gIHBhdGNoZWRWaWV3cy5hZGQodmlldyk7XG59XG5cbi8vIEVyc2V0enQgdmlldy5yZXZlYWxBY3RpdmVGaWxlKCkgLSBsXHUwMEU0dWZ0IGJlaSBqZWRlbSBEYXRlaXdlY2hzZWwsIHdlbm4gaW1cbi8vIERhdGVpLUV4cGxvcmVyIFwiQWt0dWVsbGUgRGF0ZWkgYXV0b21hdGlzY2ggYW56ZWlnZW5cIiBha3RpdiBpc3QuIE9ic2lkaWFuc1xuLy8gZWlnZW5lIEltcGxlbWVudGllcnVuZyBleHBhbmRpZXJ0IHp3YXIgZGllIEFobmVua2V0dGUgKHdpcmt1bmdzbG9zIGZcdTAwRkNyIGRlblxuLy8gRGF0ZW5iYW5rLU9yZG5lciBzZWxic3QgZGFuayBwYXRjaEZvbGRlckl0ZW0gdW50ZW4pLCBzY3JvbGx0IGRhbmFjaCBhYmVyIHp1clxuLy8gLSBkYW5uIHVuc2ljaHRiYXIgYmxlaWJlbmRlbiAtIERhdGVpIHVuZCB6ZWlndCBkYWJlaSBLRUlORSBNYXJraWVydW5nIGFuXG4vLyAoZGFzIG5hdGl2ZSBcIkF1ZmJsaXR6ZW5cIiBnaWJ0IGVzIG51ciBiZWkgcmV2ZWFsSW5Gb2xkZXIoKSwgbmljaHQgaGllcikuXG4vLyBMaWVndCBkaWUgYWt0aXZlIERhdGVpIGluIGVpbmVtIERhdGVuYmFuay1PcmRuZXIsIHdpcmQgZGVzaGFsYiBzdGF0dGRlc3NlblxuLy8gdmlldy5yZXZlYWxJbkZvbGRlcihkYkZvbGRlcikgYXVmZ2VydWZlbjogZGllc2VsYmUgTWV0aG9kZSwgZGllIGF1Y2ggZGVyXG4vLyBCZWZlaGwgXCJEYXRlaSBpbSBOYXZpZ2F0b3IgYW56ZWlnZW5cIiBudXR6dCAtIGtsYXBwdCBBaG5lbm9yZG5lciBhdWYsIHNjcm9sbHRcbi8vIHp1bSBPcmRuZXIgdW5kIGxcdTAwRTRzc3QgaWhuIGt1cnogYXVmYmxpdHplbi5cbi8vXG4vLyBJc3QgZGVyIERhdGVpLUV4cGxvcmVyIGdlcmFkZSBnYXIgbmljaHQgc2ljaHRiYXIsIHdpcmQgdW52ZXJcdTAwRTRuZGVydCBhblxuLy8gb3JpZ2luYWwoKSBkZWxlZ2llcnQ6IE9ic2lkaWFuIG1lcmt0IHNpY2ggZGFzIGRhbm4gc2VsYnN0IHZvciB1bmQgcnVmdCBiZWlcbi8vIGVybmV1dGVyIFNpY2h0YmFya2VpdCB2aWV3LnJldmVhbEFjdGl2ZUZpbGUoKSAoenUgZGVtIFplaXRwdW5rdCBiZXJlaXRzXG4vLyB3aWVkZXIgZGllc2UgZ2VwYXRjaHRlIFZlcnNpb24pIGF1dG9tYXRpc2NoIGVybmV1dCBhdWYgLSBnZW5hdSBkZXIgRmFsbCwgaW5cbi8vIGRlbSBkYXMgZXJuZXV0ZSBGb2t1c3NpZXJlbiBkZXMgRGF0ZWktRXhwbG9yZXJzIHp1dm9yIG5pY2h0IHNhdWJlciBlcmZhc3N0XG4vLyB3dXJkZS5cbmZ1bmN0aW9uIHBhdGNoUmV2ZWFsQWN0aXZlRmlsZShwbHVnaW4sIHZpZXcsIHBhdGNoZWRWaWV3cykge1xuICBpZiAoIXZpZXcgfHwgdHlwZW9mIHZpZXcucmV2ZWFsQWN0aXZlRmlsZSAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm47XG4gIGlmICh2aWV3Ll9fZnJlZFJldmVhbEFjdGl2ZU9yaWdpbmFsKSB7XG4gICAgcGF0Y2hlZFZpZXdzLmFkZCh2aWV3KTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3Qgb3JpZ2luYWwgPSB2aWV3LnJldmVhbEFjdGl2ZUZpbGUuYmluZCh2aWV3KTtcbiAgdmlldy5fX2ZyZWRSZXZlYWxBY3RpdmVPcmlnaW5hbCA9IG9yaWdpbmFsO1xuICB2aWV3LnJldmVhbEFjdGl2ZUZpbGUgPSAoKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuIG9yaWdpbmFsKCk7XG4gICAgaWYgKCF2aWV3LmNvbnRhaW5lckVsLmlzU2hvd24oKSkgcmV0dXJuIG9yaWdpbmFsKCk7XG5cbiAgICBjb25zdCBmaWxlUGF0aCA9IHZpZXcuYWN0aXZlRG9tPy5maWxlPy5wYXRoO1xuICAgIGNvbnN0IGRiRm9sZGVyID0gZmlsZVBhdGhcbiAgICAgID8gZmluZERhdGFiYXNlQW5jZXN0b3JGb2xkZXIocGx1Z2luLmFwcCwgZmlsZVBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeClcbiAgICAgIDogbnVsbDtcbiAgICBpZiAoIWRiRm9sZGVyKSByZXR1cm4gb3JpZ2luYWwoKTtcblxuICAgIHJldHVybiB2aWV3LnJldmVhbEluRm9sZGVyKGRiRm9sZGVyKTtcbiAgfTtcbiAgcGF0Y2hlZFZpZXdzLmFkZCh2aWV3KTtcbn1cblxuLy8gRlx1MDBFNG5ndCBBdWYtL1p1a2xhcHAtVmVyc3VjaGUgZGlyZWt0IGFuIGRlciBRdWVsbGUgYWIsIHN0YXR0IHNpZSByZWFrdGl2IHBlclxuLy8gTXV0YXRpb25PYnNlcnZlciByXHUwMEZDY2tnXHUwMEU0bmdpZyB6dSBtYWNoZW4gKGRlciB2b3JoZXJpZ2UgQW5zYXR6IC0gbGllXHUwMERGIHNpY2hcbi8vIGR1cmNoIE9ic2lkaWFucyB2aXJ0dWFsaXNpZXJ0ZSBCYXVtZGFyc3RlbGx1bmcgdW1nZWhlbiwgei4gQi4gYmVpbSBlcm5ldXRlblxuLy8gRm9rdXNzaWVyZW4gZGVzIERhdGVpLUV4cGxvcmVycywgd2VubiBkZXNzZW4gXCJpbmZpbml0eVNjcm9sbFwiIGZcdTAwRkNyIHdpZWRlclxuLy8gc2ljaHRiYXJlIFplaWxlbiBmcmlzY2hlIERPTS1FbGVtZW50ZSBlcnpldWd0LCBkaWUgZGVyIE9ic2VydmVyIG5pY2h0IG1laHJcbi8vIGtlbm50KS5cbi8vXG4vLyB2aWV3LmZpbGVJdGVtc1twYXRoXSBzaW5kIE9ic2lkaWFucyBlaWdlbmUgT3JkbmVyLUl0ZW0tT2JqZWt0ZS4gSkVERVIgV2VnLFxuLy8gZWluZW4gT3JkbmVyIGF1Znp1a2xhcHBlbiAtIG5hdGl2ZXIgUGZlaWwtS2xpY2ssIFwiQWxsZSBhdWZrbGFwcGVuXCIsXG4vLyBcIkFrdHVlbGxlIERhdGVpIGF1dG9tYXRpc2NoIGFuemVpZ2VuXCIsIHJldmVhbEluRm9sZGVyKCkgZlx1MDBGQ3IgZWluZSBEYXRlaVxuLy8gZGFyaW4sIGplZGUga1x1MDBGQ25mdGlnZSBPYnNpZGlhbi1GdW5rdGlvbiAtIGxcdTAwRTR1ZnQgbGV0enRsaWNoIFx1MDBGQ2JlciBnZW5hdSBlaW5lXG4vLyBNZXRob2RlIGFuIGRpZXNlbSBPYmpla3Q6IGl0ZW0uc2V0Q29sbGFwc2VkKCkuICh0b2dnbGVDb2xsYXBzZWQoKSBydWZ0XG4vLyBpbnRlcm4gdGhpcy5zZXRDb2xsYXBzZWQoKSBhdWYsIFwiQWxsZSBhdWZrbGFwcGVuXCIgcnVmdCB0b2dnbGVDb2xsYXBzZWQoKSBqZVxuLy8gT3JkbmVyLUl0ZW0gYXVmIC0gYmVpZGVzIGxhbmRldCBhbHNvIGViZW5mYWxscyBoaWVyLikgRWluIGVpbm1hbGlnZXIgUGF0Y2hcbi8vIGRpZXNlciBlaW5lbiBNZXRob2RlIGRlY2t0IHNvbWl0IGF1c25haG1zbG9zIGplZGVuIEF1c2xcdTAwRjZzZXIgYWIuXG5mdW5jdGlvbiBwYXRjaEZvbGRlckl0ZW0ocGx1Z2luLCBpdGVtLCBtYW51YWxseU9wZW5QYXRocywgcGF0Y2hlZEl0ZW1zKSB7XG4gIGlmICghaXRlbSB8fCB0eXBlb2YgaXRlbS5zZXRDb2xsYXBzZWQgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuICBpZiAoaXRlbS5fX2ZyZWRTZXRDb2xsYXBzZWRPcmlnaW5hbCkge1xuICAgIHBhdGNoZWRJdGVtcy5hZGQoaXRlbSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgb3JpZ2luYWwgPSBpdGVtLnNldENvbGxhcHNlZC5iaW5kKGl0ZW0pO1xuICBpdGVtLl9fZnJlZFNldENvbGxhcHNlZE9yaWdpbmFsID0gb3JpZ2luYWw7XG4gIGl0ZW0uc2V0Q29sbGFwc2VkID0gKGNvbGxhcHNlZCwgaW5zdGFudCkgPT4ge1xuICAgIGNvbnN0IHBhdGggPSBpdGVtLmZpbGU/LnBhdGg7XG4gICAgY29uc3QgaXNEYkZvbGRlciA9IHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkICYmIGlzRGF0YWJhc2VQYXRoKHBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCk7XG4gICAgaWYgKGlzRGJGb2xkZXIgJiYgIWNvbGxhcHNlZCAmJiAhbWFudWFsbHlPcGVuUGF0aHMuaGFzKHBhdGgpKSB7XG4gICAgICAvLyBFeHBhbmQtVmVyc3VjaCBhYmdlZmFuZ2VuIC0gRGF0ZW5iYW5rLU9yZG5lciBibGVpYnQgenVnZWtsYXBwdC5cbiAgICAgIC8vIHNldENvbGxhcHNlZCBsaWVmZXJ0IG5vcm1hbGVyd2Vpc2UgZWluIFByb21pc2U7IGVpbiBhdWZnZWxcdTAwRjZzdGVzXG4gICAgICAvLyBQcm9taXNlIHN0YXR0IHVuZGVmaW5lZCB6dXJcdTAwRkNja3p1Z2ViZW4gaFx1MDBFNGx0IGRlbiBWZXJ0cmFnIGZcdTAwRkNyIEF1ZnJ1ZmVyXG4gICAgICAvLyBlaW4sIGRpZSAod2llIHJldmVhbEluRm9sZGVyIGludGVybikgZGFyYXVmIHZlcmtldHRlbi5cbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsKGNvbGxhcHNlZCwgaW5zdGFudCk7XG4gIH07XG4gIHBhdGNoZWRJdGVtcy5hZGQoaXRlbSk7XG5cbiAgLy8gRWlubWFsaWcgYmVpbSBQYXRjaGVuIHNpY2hlcnN0ZWxsZW4sIGRhc3MgZGVyIE9yZG5lciB0YXRzXHUwMEU0Y2hsaWNoXG4gIC8vIHp1Z2VrbGFwcHQgaXN0ICh6LiBCLiBmYWxscyBPYnNpZGlhbiBpaG4gYXVzIGRlbSBsZXR6dGVuIFNpdHp1bmdzc3RhbmRcbiAgLy8gYmVyZWl0cyBhdWZnZWtsYXBwdCB3aWVkZXJoZXJnZXN0ZWxsdCBoYXQpLlxuICBjb25zdCBwYXRoID0gaXRlbS5maWxlPy5wYXRoO1xuICBpZiAoXG4gICAgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQgJiZcbiAgICBpc0RhdGFiYXNlUGF0aChwYXRoLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpICYmXG4gICAgIW1hbnVhbGx5T3BlblBhdGhzLmhhcyhwYXRoKSAmJlxuICAgIGl0ZW0uY29sbGFwc2VkICE9PSB0cnVlXG4gICkge1xuICAgIG9yaWdpbmFsKHRydWUsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzKHBsdWdpbikge1xuICBjb25zdCBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICBzdHlsZUVsLmlkID0gXCJmcmVkLWRhdGFiYXNlLWZvbGRlcnMtc3R5bGVcIjtcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZUVsKTtcblxuICBjb25zdCB3YXRjaGVkRm9sZGVycyA9IG5ldyBNYXAoKTsgLy8gcGF0aCAtPiBuYXZGb2xkZXIgKG51ciBmXHUwMEZDciBkaWUgQmFkZ2UtQW56ZWlnZSlcbiAgY29uc3QgcGF0Y2hlZEl0ZW1zID0gbmV3IFNldCgpO1xuICBjb25zdCBwYXRjaGVkVmlld3MgPSBuZXcgU2V0KCk7XG4gIC8vIEVpbiBNdXRhdGlvbk9ic2VydmVyIHBybyBEYXRlaS1FeHBsb3Jlci1WaWV3ICh2aWV3LmNvbnRhaW5lckVsIHNlbGJzdFxuICAvLyB3aXJkIHZvbiBPYnNpZGlhbnMgdmlydHVhbGlzaWVydGVtIEJhdW0gbmllIHplcnN0XHUwMEY2cnQgLSBzaWVoZSB1bnRlbiAtXG4gIC8vIG51ciBlaW56ZWxuZSBaZWlsZW4gd2VyZGVuIGF1cyBkZW0gRE9NIGVudGZlcm50L3dpZWRlciBlaW5nZWZcdTAwRkNndCkuXG4gIGNvbnN0IGNvbnRhaW5lck9ic2VydmVycyA9IG5ldyBNYXAoKTsgLy8gdmlldyAtPiBNdXRhdGlvbk9ic2VydmVyXG4gIGxldCByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG4gIC8vIFBmYWRlIHZvbiBEYXRlbmJhbmstT3JkbmVybiwgZGllIFx1MDBGQ2JlciBkZW4gQmVmZWhsIFwiRGF0ZW5iYW5rLU9yZG5lclxuICAvLyBcdTAwRjZmZm5lbi9zY2hsaWVcdTAwREZlblwiIG1hbnVlbGwgYXVmZ2VrbGFwcHQgd3VyZGVuIC0gZ2lsdCBudXIgZlx1MDBGQ3IgZGllIGxhdWZlbmRlXG4gIC8vIFNpdHp1bmcgKGJld3Vzc3QgbmljaHQgcGVyc2lzdGllcnQpLCBzaWVoZSB0b2dnbGVEYXRhYmFzZUZvbGRlciB1bnRlbi5cbiAgY29uc3QgbWFudWFsbHlPcGVuUGF0aHMgPSBuZXcgU2V0KCk7XG5cbiAgLy8gT2JzaWRpYW5zIERhdGVpLUJhdW0gaXN0IHZpcnR1YWxpc2llcnQgKHZpZXcudHJlZS5pbmZpbml0eVNjcm9sbCk6IFplaWxlblxuICAvLyBhdVx1MDBERmVyaGFsYiBkZXMgc2ljaHRiYXJlbiBCZXJlaWNocyB3ZXJkZW4gcGVyIGVsLmRldGFjaCgpIGF1cyBkZW0gRE9NXG4gIC8vIGVudGZlcm50IHVuZCBiZWltIFp1clx1MDBGQ2Nrc2Nyb2xsZW4gd2llZGVyIGVpbmdlZlx1MDBGQ2d0IC0gT0hORSBkYXNzIGRhYmVpIGVpblxuICAvLyBcImxheW91dC1jaGFuZ2VcIi1FdmVudCBmZXVlcnQgKHZlcmlmaXppZXJ0IGltIGVudHBhY2t0ZW4gT2JzaWRpYW4tQnVuZGxlLFxuICAvLyBzLiBJbmZpbml0eVNjcm9sbC51cGRhdGUoKSkuIEVpbiByZWluZXIgRE9NLVNjYW4gYmVpIFwibGF5b3V0LWNoYW5nZVwiICtcbiAgLy8gVmF1bHQtRXZlbnRzIHZlcnBhc3N0IGRlc2hhbGIgT3JkbmVyLCBkZXJlbiBaZWlsZSBnZXJhZGUgdW5zaWNodGJhciBpc3QgLVxuICAvLyBpaHIgQmFkZ2UgYmxlaWJ0IGRhbm4gZmVobGVuZCBvZGVyIHZlcmFsdGV0LCBiaXMgaXJnZW5kZWluIGFuZGVyZXIgR3J1bmRcbiAgLy8genVmXHUwMEU0bGxpZyBlaW5lbiBSZXNjYW4gYXVzbFx1MDBGNnN0LCB3XHUwMEU0aHJlbmQgZGllIFplaWxlIHNpY2h0YmFyIGlzdCAoei4gQi5cbiAgLy8gQW5rbGlja2VuL0Zva3Vzc2llcmVuKS4gdmlldy5jb250YWluZXJFbCBzZWxic3Qgd2lyZCBkYWJlaSBuaWUgZXJzZXR6dCxcbiAgLy8gbnVyIGVpbnplbG5lIFplaWxlbi1FbGVtZW50ZSB3ZXJkZW4gYW4tL2FiZ2VoXHUwMEU0bmd0IC0gZWluIGRhcmF1ZiBsYXVzY2hlbmRlclxuICAvLyBNdXRhdGlvbk9ic2VydmVyIGJla29tbXQgZGFoZXIgamVkZSBaZWlsZW4tXHUwMEM0bmRlcnVuZyB6dXZlcmxcdTAwRTRzc2lnIG1pdC5cbiAgY29uc3QgcmVmcmVzaFdhdGNoZWRGb2xkZXJzID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgbmF2Rm9sZGVyIG9mIHdhdGNoZWRGb2xkZXJzLnZhbHVlcygpKSB7XG4gICAgICByZW1vdmVGb2xkZXJCYWRnZShuYXZGb2xkZXIpO1xuICAgIH1cbiAgICB3YXRjaGVkRm9sZGVycy5jbGVhcigpO1xuXG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcmVkLWRiLWZvbGRlclwiKS5mb3JFYWNoKChlbCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyZWQtZGItZm9sZGVyXCIpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVmaXggPSBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXg7XG4gICAgZm9yIChjb25zdCBsZWFmIG9mIHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImZpbGUtZXhwbG9yZXJcIikpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XG4gICAgICBwYXRjaFJldmVhbEluRm9sZGVyKHBsdWdpbiwgdmlldywgcGF0Y2hlZFZpZXdzKTtcbiAgICAgIHBhdGNoUmV2ZWFsQWN0aXZlRmlsZShwbHVnaW4sIHZpZXcsIHBhdGNoZWRWaWV3cyk7XG4gICAgICBlbnN1cmVDb250YWluZXJPYnNlcnZlcih2aWV3KTtcblxuICAgICAgLy8gUGF0Y2h0IGF1c25haG1zbG9zIGFsbGUgRGF0ZW5iYW5rLU9yZG5lci1JdGVtcywgdW5hYmhcdTAwRTRuZ2lnIGRhdm9uLCBvYlxuICAgICAgLy8gaWhyZSBaZWlsZSBha3R1ZWxsIGltICh2aXJ0dWFsaXNpZXJ0ZW4pIERPTSBnZXJlbmRlcnQgaXN0IC0gYW5kZXJzIGFsc1xuICAgICAgLy8gZGVyIERPTS1TY2FuIHVudGVuLCBkZXIgZGFzIGZcdTAwRkNyIGRpZSBCYWRnZS1BbnplaWdlIGJyYXVjaHQuXG4gICAgICBmb3IgKGNvbnN0IHBhdGggaW4gdmlldy5maWxlSXRlbXMgPz8ge30pIHtcbiAgICAgICAgaWYgKCFpc0RhdGFiYXNlUGF0aChwYXRoLCBwcmVmaXgpKSBjb250aW51ZTtcbiAgICAgICAgcGF0Y2hGb2xkZXJJdGVtKHBsdWdpbiwgdmlldy5maWxlSXRlbXNbcGF0aF0sIG1hbnVhbGx5T3BlblBhdGhzLCBwYXRjaGVkSXRlbXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBTZXR6dCBkaWUgS2xhc3NlIGZcdTAwRkNyIEpFREUgYWt0dWVsbCBnZXJlbmRlcnRlIE9yZG5lci1UaXRlbHplaWxlIChuaWNodFxuICAgICAgLy8gbnVyIGZcdTAwRkNyIFRyZWZmZXIpIC0gc29uc3Qgd1x1MDBGQ3JkZSBlaW4gT3JkbmVyLCBkZXIgc2VpbiBQclx1MDBFNGZpeCBwZXJcbiAgICAgIC8vIFVtYmVuZW5udW5nIHZlcmxpZXJ0LCBkaWUgS2xhc3NlICh1bmQgZGFtaXQgZGllIGF1c2dlYmxlbmRldGVcbiAgICAgIC8vIFBmZWlsLURhcnN0ZWxsdW5nKSBmXHUwMEU0bHNjaGxpY2ggYmVoYWx0ZW4uXG4gICAgICB2aWV3LmNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2LWZvbGRlci10aXRsZVtkYXRhLXBhdGhdXCIpLmZvckVhY2goKHRpdGxlRWwpID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHRpdGxlRWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wYXRoXCIpO1xuICAgICAgICBjb25zdCBpc0RiRm9sZGVyID0gaXNEYXRhYmFzZVBhdGgocGF0aCwgcHJlZml4KTtcbiAgICAgICAgc2V0RGF0YWJhc2VGb2xkZXJDbGFzcyh0aXRsZUVsLCBpc0RiRm9sZGVyKTtcbiAgICAgICAgaWYgKCFpc0RiRm9sZGVyKSByZXR1cm47XG4gICAgICAgIGNvbnN0IG5hdkZvbGRlciA9IHRpdGxlRWwucGFyZW50RWxlbWVudDtcbiAgICAgICAgaWYgKCFuYXZGb2xkZXIgfHwgIW5hdkZvbGRlci5jbGFzc0xpc3QuY29udGFpbnMoXCJuYXYtZm9sZGVyXCIpKSByZXR1cm47XG5cbiAgICAgICAgd2F0Y2hlZEZvbGRlcnMuc2V0KHBhdGgsIG5hdkZvbGRlcik7XG4gICAgICAgIHVwZGF0ZUZvbGRlckJhZGdlKHBsdWdpbi5hcHAsIG5hdkZvbGRlciwgcGF0aCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gQlx1MDBGQ25kZWx0IG1laHJlcmUgc2NobmVsbCBhdWZlaW5hbmRlcmZvbGdlbmRlIE11dGF0aW9uZW4gKHouIEIuIHdcdTAwRTRocmVuZFxuICAvLyBlaW5lcyBTY3JvbGxzKSB6dSBlaW5lbSBSZXNjYW4gcHJvIEZyYW1lLiBEaWUgZWlnZW5lbiBNdXRhdGlvbmVuIHZvblxuICAvLyByZWZyZXNoV2F0Y2hlZEZvbGRlcnMgKEJhZGdlLUVsZW1lbnRlLCBLbGFzc2VuKSB3ZXJkZW4gZGFmXHUwMEZDciBwZXJcbiAgLy8gZGlzY29ubmVjdCgpL29ic2VydmUoKSBydW5kIHVtIGRlbiBBdWZydWYgYXVzZ2VibGVuZGV0IC0gc29uc3Qgd1x1MDBGQ3JkZSBkZXJcbiAgLy8gT2JzZXJ2ZXIgc2ljaCBzZWxic3QgbGF1ZmVuZCBlcm5ldXQgYXVzbFx1MDBGNnNlbi5cbiAgY29uc3Qgc2NoZWR1bGVSZWZyZXNoID0gKCkgPT4ge1xuICAgIGlmIChyZWZyZXNoU2NoZWR1bGVkKSByZXR1cm47XG4gICAgcmVmcmVzaFNjaGVkdWxlZCA9IHRydWU7XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgIHJlZnJlc2hTY2hlZHVsZWQgPSBmYWxzZTtcbiAgICAgIGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgY29udGFpbmVyT2JzZXJ2ZXJzLnZhbHVlcygpKSBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICByZWZyZXNoV2F0Y2hlZEZvbGRlcnMoKTtcbiAgICAgIGZvciAoY29uc3QgW3ZpZXcsIG9ic2VydmVyXSBvZiBjb250YWluZXJPYnNlcnZlcnMpIHtcbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh2aWV3LmNvbnRhaW5lckVsLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBlbnN1cmVDb250YWluZXJPYnNlcnZlciA9ICh2aWV3KSA9PiB7XG4gICAgaWYgKGNvbnRhaW5lck9ic2VydmVycy5oYXModmlldykpIHJldHVybjtcbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHNjaGVkdWxlUmVmcmVzaCk7XG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZSh2aWV3LmNvbnRhaW5lckVsLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgICBjb250YWluZXJPYnNlcnZlcnMuc2V0KHZpZXcsIG9ic2VydmVyKTtcbiAgfTtcblxuICBwbHVnaW4uYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHJlZnJlc2hXYXRjaGVkRm9sZGVycyk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFwibGF5b3V0LWNoYW5nZVwiLCByZWZyZXNoV2F0Y2hlZEZvbGRlcnMpKTtcblxuICAvLyBIXHUwMEU0bHQgZGllIFpcdTAwRTRobGVyIGFrdHVlbGwsIHdlbm4gTWFya2Rvd24tRGF0ZWllbiBpbiBlaW5lbSBiZW9iYWNodGV0ZW4gT3JkbmVyXG4gIC8vIChvZGVyIGVpbmVtIFVudGVyb3JkbmVyIGRhdm9uKSBhbmdlbGVndC9nZWxcdTAwRjZzY2h0L3ZlcnNjaG9iZW4gd2VyZGVuLlxuICBjb25zdCByZWZyZXNoQmFkZ2VGb3JQYXRoID0gKHBhdGgpID0+IHtcbiAgICBpZiAoIXBhdGgpIHJldHVybjtcbiAgICBmb3IgKGNvbnN0IFtmb2xkZXJQYXRoLCBuYXZGb2xkZXJdIG9mIHdhdGNoZWRGb2xkZXJzKSB7XG4gICAgICBpZiAocGF0aCA9PT0gZm9sZGVyUGF0aCB8fCBwYXRoLnN0YXJ0c1dpdGgoZm9sZGVyUGF0aCArIFwiL1wiKSkge1xuICAgICAgICB1cGRhdGVGb2xkZXJCYWRnZShwbHVnaW4uYXBwLCBuYXZGb2xkZXIsIGZvbGRlclBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlckNvdW50QXRFbmQpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgY29uc3Qgb25WYXVsdEZpbGVDaGFuZ2UgPSAoZmlsZSwgb2xkUGF0aCkgPT4ge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQpIHJldHVybjtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybjtcbiAgICByZWZyZXNoQmFkZ2VGb3JQYXRoKGZpbGUucGF0aCk7XG4gICAgaWYgKG9sZFBhdGgpIHJlZnJlc2hCYWRnZUZvclBhdGgob2xkUGF0aCk7XG4gIH07XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgb25WYXVsdEZpbGVDaGFuZ2UpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcImRlbGV0ZVwiLCBvblZhdWx0RmlsZUNoYW5nZSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIG9uVmF1bHRGaWxlQ2hhbmdlKSk7XG5cbiAgLy8gRWluIG5ldSBhbmdlbGVndGVyIG9kZXIgdW1iZW5hbm50ZXIgT3JkbmVyIGthbm4gc29mb3J0IGF1ZiBkZW4gUHJcdTAwRTRmaXhcbiAgLy8gcGFzc2VuIC0gaGllciBkaXJla3QgcGF0Y2hlbiwgc3RhdHQgYXVmIGRlbiBuXHUwMEU0Y2hzdGVuIExheW91dC1XZWNoc2VsIHp1XG4gIC8vIHdhcnRlbi5cbiAgY29uc3Qgb25WYXVsdEZvbGRlckNoYW5nZSA9IChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuO1xuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikgcmVmcmVzaFdhdGNoZWRGb2xkZXJzKCk7XG4gIH07XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgb25WYXVsdEZvbGRlckNoYW5nZSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIG9uVmF1bHRGb2xkZXJDaGFuZ2UpKTtcblxuICAvLyBLbGljayBhdWYgZGVuIE5hbWVuIHNlbGJzdCBibGVpYnQgdW5hbmdldGFzdGV0ICh6LiBCLiBGb2xkZXIgTm90ZXMgXHUwMEY2ZmZuZXQgZG9ydFxuICAvLyB3aWUgZ2V3b2hudCBkaWUgenVnZWhcdTAwRjZyaWdlIE5vdGl6KS4gS2xpY2sgZGFuZWJlbiAoTGVlcnJhdW0gZGVyIFRpdGVsemVpbGUpXG4gIC8vIHVudGVyZHJcdTAwRkNja3QgbnVyIGRhcyBBdWYtL1p1a2xhcHBlbjsgY2FwdHVyZTp0cnVlIHJlaWNodCBkYWZcdTAwRkNyLCB3ZWlsIGRpZVxuICAvLyBDYXB0dXJlLVBoYXNlIE9ic2lkaWFucyBlaWdlbmVtIFRvZ2dsZS1IYW5kbGVyIGFtIEVsZW1lbnQgaW1tZXIgdm9yYXVzZ2VodC5cbiAgY29uc3Qgb25DbGlja0NhcHR1cmUgPSAoZXZ0KSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHRpdGxlRWwgPSBldnQudGFyZ2V0LmNsb3Nlc3QoXCIubmF2LWZvbGRlci10aXRsZVwiKTtcbiAgICBpZiAoIWlzRGF0YWJhc2VGb2xkZXJUaXRsZSh0aXRsZUVsLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpKSByZXR1cm47XG5cbiAgICBjb25zdCBuYW1lRWwgPSB0aXRsZUVsLnF1ZXJ5U2VsZWN0b3IoXCIubmF2LWZvbGRlci10aXRsZS1jb250ZW50XCIpO1xuICAgIGlmIChuYW1lRWwgJiYgbmFtZUVsLmNvbnRhaW5zKGV2dC50YXJnZXQpKSByZXR1cm47XG5cbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICBpZiAocGx1Z2luLnNldHRpbmdzLmZvbGRlck5vdGVDbGlja0V4dGVuc2lvbkVuYWJsZWQgJiYgbmFtZUVsKSB7XG4gICAgICBuYW1lRWwuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgbmV3IE1vdXNlRXZlbnQoXCJjbGlja1wiLCB7XG4gICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICBjYW5jZWxhYmxlOiB0cnVlLFxuICAgICAgICAgIGN0cmxLZXk6IGV2dC5jdHJsS2V5LFxuICAgICAgICAgIG1ldGFLZXk6IGV2dC5tZXRhS2V5LFxuICAgICAgICAgIHNoaWZ0S2V5OiBldnQuc2hpZnRLZXksXG4gICAgICAgICAgYWx0S2V5OiBldnQuYWx0S2V5LFxuICAgICAgICAgIGJ1dHRvbjogZXZ0LmJ1dHRvbixcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICB9O1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgb25DbGlja0NhcHR1cmUsIHRydWUpO1xuXG4gIHBsdWdpbi5yZWdpc3RlcigoKSA9PiB7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIG9uQ2xpY2tDYXB0dXJlLCB0cnVlKTtcbiAgICBmb3IgKGNvbnN0IG5hdkZvbGRlciBvZiB3YXRjaGVkRm9sZGVycy52YWx1ZXMoKSkge1xuICAgICAgcmVtb3ZlRm9sZGVyQmFkZ2UobmF2Rm9sZGVyKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHBhdGNoZWRJdGVtcykge1xuICAgICAgaWYgKGl0ZW0uX19mcmVkU2V0Q29sbGFwc2VkT3JpZ2luYWwpIHtcbiAgICAgICAgaXRlbS5zZXRDb2xsYXBzZWQgPSBpdGVtLl9fZnJlZFNldENvbGxhcHNlZE9yaWdpbmFsO1xuICAgICAgICBkZWxldGUgaXRlbS5fX2ZyZWRTZXRDb2xsYXBzZWRPcmlnaW5hbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcGF0Y2hlZEl0ZW1zLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCB2aWV3IG9mIHBhdGNoZWRWaWV3cykge1xuICAgICAgaWYgKHZpZXcuX19mcmVkUmV2ZWFsT3JpZ2luYWwpIHtcbiAgICAgICAgdmlldy5yZXZlYWxJbkZvbGRlciA9IHZpZXcuX19mcmVkUmV2ZWFsT3JpZ2luYWw7XG4gICAgICAgIGRlbGV0ZSB2aWV3Ll9fZnJlZFJldmVhbE9yaWdpbmFsO1xuICAgICAgfVxuICAgICAgaWYgKHZpZXcuX19mcmVkUmV2ZWFsQWN0aXZlT3JpZ2luYWwpIHtcbiAgICAgICAgdmlldy5yZXZlYWxBY3RpdmVGaWxlID0gdmlldy5fX2ZyZWRSZXZlYWxBY3RpdmVPcmlnaW5hbDtcbiAgICAgICAgZGVsZXRlIHZpZXcuX19mcmVkUmV2ZWFsQWN0aXZlT3JpZ2luYWw7XG4gICAgICB9XG4gICAgfVxuICAgIHBhdGNoZWRWaWV3cy5jbGVhcigpO1xuICAgIGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgY29udGFpbmVyT2JzZXJ2ZXJzLnZhbHVlcygpKSBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgY29udGFpbmVyT2JzZXJ2ZXJzLmNsZWFyKCk7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcmVkLWRiLWZvbGRlclwiKS5mb3JFYWNoKChlbCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyZWQtZGItZm9sZGVyXCIpKTtcbiAgICBzdHlsZUVsLnJlbW92ZSgpO1xuICB9KTtcblxuICBjb25zdCB1cGRhdGVTdHlsZSA9ICgpID0+IHtcbiAgICBzdHlsZUVsLnRleHRDb250ZW50ID0gcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWRcbiAgICAgID8gYnVpbGRTdHlsZShcbiAgICAgICAgICBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgsXG4gICAgICAgICAgcGx1Z2luLnNldHRpbmdzLmZvbGRlck5vdGVDbGlja0V4dGVuc2lvbkVuYWJsZWQsXG4gICAgICAgICAgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZFxuICAgICAgICApXG4gICAgICA6IFwiXCI7XG4gICAgcmVmcmVzaFdhdGNoZWRGb2xkZXJzKCk7XG4gIH07XG5cbiAgLy8gU2V0enQgZGVuIEF1Zi0vWnVnZWtsYXBwdC1adXN0YW5kIGVpbmVzIGVpbnplbG5lbiBEYXRlbmJhbmstT3JkbmVycyAtIGZcdTAwRkNyXG4gIC8vIHRvZ2dsZURhdGFiYXNlRm9sZGVyIHVudGVuLiBtYW51YWxseU9wZW5QYXRocyB3aXJkIFZPUiBkZW0gZWlnZW50bGljaGVuXG4gIC8vIEF1ZnJ1ZiBha3R1YWxpc2llcnQsIHdlaWwgcGF0Y2hGb2xkZXJJdGVtKCkgb2JlbiBnZW5hdSBkb3J0IG5hY2hzaWVodCwgb2JcbiAgLy8gZWluIEV4cGFuZC1WZXJzdWNoIGVybGF1YnQgaXN0LlxuICBjb25zdCBzZXRGb2xkZXJPcGVuID0gKHBhdGgsIG9wZW4pID0+IHtcbiAgICBpZiAob3BlbikgbWFudWFsbHlPcGVuUGF0aHMuYWRkKHBhdGgpO1xuICAgIGVsc2UgbWFudWFsbHlPcGVuUGF0aHMuZGVsZXRlKHBhdGgpO1xuXG4gICAgY29uc3QgdmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImZpbGUtZXhwbG9yZXJcIilbMF0/LnZpZXc7XG4gICAgdmlldz8uZmlsZUl0ZW1zPy5bcGF0aF0/LnNldENvbGxhcHNlZCghb3BlbiwgdHJ1ZSk7XG4gIH07XG5cbiAgLy8gRlx1MDBGQ3IgZGVuIEJlZmVobDogRGF0ZWktRXhwbG9yZXIgenVtIGdld1x1MDBFNGhsdGVuIE9yZG5lciBzY3JvbGxlbiAoa2xhcHB0IGRhZlx1MDBGQ3JcbiAgLy8gZGVzc2VuIEVsdGVybm9yZG5lciBhdWYsIHNvZmVybiBuXHUwMEY2dGlnKSAtIHVudmVyXHUwMEU0bmRlcnRlcyBuYXRpdmVzXG4gIC8vIHJldmVhbEluRm9sZGVyLCBiZXRyaWZmdCBudXIgZGllIEFobmVub3JkbmVyLCBuaWNodCBkZW4gT3JkbmVyIHNlbGJzdC5cbiAgY29uc3QgcmV2ZWFsRGF0YWJhc2VGb2xkZXIgPSAoZm9sZGVyKSA9PiB7XG4gICAgY29uc3QgbGVhZiA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImZpbGUtZXhwbG9yZXJcIilbMF07XG4gICAgbGVhZj8udmlldz8ucmV2ZWFsSW5Gb2xkZXI/Lihmb2xkZXIpO1xuICB9O1xuXG4gIC8vIEJlZmVobCBcIkRhdGVuYmFuay1PcmRuZXIgXHUwMEY2ZmZuZW4vc2NobGllXHUwMERGZW5cIjogbFx1MDBFNHNzdCBlaW5lbiBEYXRlbmJhbmstT3JkbmVyXG4gIC8vIGF1cyBlaW5lciBGdXp6eS1MaXN0ZSB3XHUwMEU0aGxlbiB1bmQga2VocnQgZGVzc2VuIFp1c3RhbmQgdW0uIERlciByZWd1bFx1MDBFNHJlXG4gIC8vIEtsaWNrIGF1ZiBlaW5lbiBEYXRlbmJhbmstT3JkbmVyIGJsZWlidCBiZXd1c3N0IHdlaXRlciBibG9ja2llcnQgKHNpZWhlXG4gIC8vIG9uQ2xpY2tDYXB0dXJlIG9iZW4pIC0gZGllc2VyIEJlZmVobCBpc3QgZGVyIGVpbnppZ2UgV2VnLCBlaW5lbiBlaW56ZWxuZW5cbiAgLy8gRGF0ZW5iYW5rLU9yZG5lciBnZXppZWx0IGF1Zi0venV6dWtsYXBwZW4uXG4gIHBsdWdpbi50b2dnbGVEYXRhYmFzZUZvbGRlciA9ICgpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKSB7XG4gICAgICBuZXcgTm90aWNlKFwiRGF0ZW5iYW5rLU9yZG5lciBzaW5kIGRlYWt0aXZpZXJ0LlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZm9sZGVycyA9IGNvbGxlY3REYXRhYmFzZUZvbGRlcnMocGx1Z2luLmFwcCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KTtcbiAgICBpZiAoZm9sZGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJLZWluZSBEYXRlbmJhbmstT3JkbmVyIHZvcmhhbmRlbi5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIG5ldyBEYXRhYmFzZUZvbGRlclBpY2tlck1vZGFsKHBsdWdpbi5hcHAsIGZvbGRlcnMsIG1hbnVhbGx5T3BlblBhdGhzLCAoZm9sZGVyKSA9PiB7XG4gICAgICBpZiAoIWZvbGRlcikgcmV0dXJuO1xuICAgICAgY29uc3Qgd2FzT3BlbiA9IG1hbnVhbGx5T3BlblBhdGhzLmhhcyhmb2xkZXIucGF0aCk7XG4gICAgICBzZXRGb2xkZXJPcGVuKGZvbGRlci5wYXRoLCAhd2FzT3Blbik7XG4gICAgICBpZiAoIXdhc09wZW4pIHJldmVhbERhdGFiYXNlRm9sZGVyKGZvbGRlcik7XG4gICAgfSkub3BlbigpO1xuICB9O1xuXG4gIHVwZGF0ZVN0eWxlKCk7XG4gIHJldHVybiB1cGRhdGVTdHlsZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzIH07XG4iLCAiY29uc3QgeyBURmlsZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFZlcnNjaGFjaHRlbHRlIENoZWNrYm94ZW5cbiAqIEJlaW0gKEVudClIYWtlbiBlaW5lciBDaGVja2JveCB3ZXJkZW4gYXV0b21hdGlzY2ggYWxsZSBkYXJ1bnRlclxuICogdmVyc2NoYWNodGVsdGVuIENoZWNrYm94ZW4gbWl0IChlbnQpaGFrdCAoS2Fza2FkZSBuYWNoIHVudGVuKSAtXG4gKiB1bmQgdW1nZWtlaHJ0OiBzb2JhbGQgYWxsZSBkaXJla3RlbiBDaGVja2JveC1LaW5kZXIgZWluZXNcbiAqIEVsdGVybi1FbGVtZW50cyBhbmdlaGFrdCBzaW5kLCB3aXJkIGF1Y2ggZGFzIEVsdGVybi1FbGVtZW50XG4gKiBhbmdlaGFrdCwgdW5kIHdpZWRlciBlbnRmZXJudCwgc29iYWxkIGVpbmVzIHNlaW5lciBLaW5kZXIgd2llZGVyXG4gKiBhYmdlaGFrdCB3aXJkIChCdWJibGUtdXAsIHJla3Vyc2l2IGJpcyB6dXIgV3VyemVsKS5cbiAqXG4gKiBFcmtlbm51bmcgcGVyIERpZmYgZ2VnZW4gZGVuIHp1bGV0enQgZ2VzZWhlbmVuIEluaGFsdCBkZXIgRGF0ZWlcbiAqIChuaWNodCBwZXIgS2xpY2stSW50ZXJjZXB0aW9uKTogZnVua3Rpb25pZXJ0IGRhZHVyY2ggdW5hYmhcdTAwRTRuZ2lnXG4gKiBkYXZvbiwgb2IgZGllIENoZWNrYm94IGluIGRlciBSZWFkaW5nIFZpZXcgb2RlciBpbiBkZXIgTGl2ZVxuICogUHJldmlldyBhbmdla2xpY2t0IHd1cmRlLCBvaG5lIGF1ZiBPYnNpZGlhbnMgdW5kb2t1bWVudGllcnRlXG4gKiBSZW5kZXItSW50ZXJuYSBhbmdld2llc2VuIHp1IHNlaW4uIEF1c2dlbFx1MDBGNnN0IHdpcmQgbnVyLCB3ZW5uIHNpY2hcbiAqIGR1cmNoIGRpZSBcdTAwQzRuZGVydW5nIGdlbmF1IGVpbmUgWmVpbGUgdW50ZXJzY2hlaWRldCB1bmQgZGllc2UgZWluZVxuICogQ2hlY2tib3ggbWl0IHVudmVyXHUwMEU0bmRlcnRlciBFaW5yXHUwMEZDY2t1bmcgaXN0LCBkZXJlbiBIYWtlbi1adXN0YW5kXG4gKiBzaWNoIGdlXHUwMEU0bmRlcnQgaGF0IC0gYWxsZXMgYW5kZXJlIChNZWhyZmFjaFx1MDBFNG5kZXJ1bmdlbiwgVGlwcGVuLFxuICogRWluLS9BdXNyXHUwMEZDY2tlbiwgZXRjLikgYmxlaWJ0IHVuYW5nZXRhc3RldC5cbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jb25zdCBDSEVDS0JPWF9MSU5FX1JFID0gL14oXFxzKikoPzpbLSorXXxcXGQrWy4pXSlcXHMrXFxbKC4pXFxdLztcblxuZnVuY3Rpb24gcGFyc2VDaGVja2JveExpbmUobGluZSkge1xuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goQ0hFQ0tCT1hfTElORV9SRSk7XG4gIHJldHVybiBtYXRjaCA/IHsgaW5kZW50OiBtYXRjaFsxXS5sZW5ndGgsIGNoYXI6IG1hdGNoWzJdIH0gOiBudWxsO1xufVxuXG4vLyBudWxsIGZcdTAwRkNyIGxlZXJlL251ci1MZWVyemVpY2hlbi1aZWlsZW4sIGRhIHNpZSBmXHUwMEZDciBkaWUgVmVyc2NoYWNodGVsdW5nc3RpZWZlIG5pY2h0IHpcdTAwRTRobGVuLlxuZnVuY3Rpb24gaW5kZW50T2YobGluZSkge1xuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL14oXFxzKilcXFMvKTtcbiAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0ubGVuZ3RoIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNDaGVja2VkKGNoYXIpIHtcbiAgcmV0dXJuIGNoYXIgIT09IFwiIFwiO1xufVxuXG5mdW5jdGlvbiBzZXRDaGVja2JveENoYXIobGluZSwgbmV3Q2hhcikge1xuICByZXR1cm4gbGluZS5yZXBsYWNlKENIRUNLQk9YX0xJTkVfUkUsICh3aG9sZSkgPT4gd2hvbGUuc2xpY2UoMCwgLTIpICsgbmV3Q2hhciArIFwiXVwiKTtcbn1cblxuLy8gTGllZmVydCBkaWUgWmVpbGVuIG1pdCBhbmdld2VuZGV0ZXIgS2Fza2FkZSwgb2RlciBudWxsLCB3ZW5uIHNpY2ggbmljaHRzIFx1MDBFNG5kZXJ0LlxuZnVuY3Rpb24gY29tcHV0ZUNhc2NhZGUobGluZXMsIHRvZ2dsZWRJbmRleCkge1xuICBjb25zdCB0b2dnbGVkID0gcGFyc2VDaGVja2JveExpbmUobGluZXNbdG9nZ2xlZEluZGV4XSk7XG4gIGlmICghdG9nZ2xlZCkgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgcmVzdWx0ID0gbGluZXMuc2xpY2UoKTtcbiAgbGV0IHRvdWNoZWQgPSBmYWxzZTtcbiAgY29uc3Qgbm93Q2hlY2tlZCA9IGlzQ2hlY2tlZCh0b2dnbGVkLmNoYXIpO1xuICBjb25zdCBuZXdDaGFyID0gbm93Q2hlY2tlZCA/IFwieFwiIDogXCIgXCI7XG5cbiAgLy8gTmFjaCB1bnRlbjogYWxsZSB2ZXJzY2hhY2h0ZWx0ZW4gQ2hlY2tib3hlbiBhdWYgZGVuc2VsYmVuIFp1c3RhbmQgYnJpbmdlbi5cbiAgZm9yIChsZXQgaSA9IHRvZ2dsZWRJbmRleCArIDE7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpbmQgPSBpbmRlbnRPZihyZXN1bHRbaV0pO1xuICAgIGlmIChpbmQgIT09IG51bGwgJiYgaW5kIDw9IHRvZ2dsZWQuaW5kZW50KSBicmVhaztcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUNoZWNrYm94TGluZShyZXN1bHRbaV0pO1xuICAgIGlmIChwYXJzZWQgJiYgaXNDaGVja2VkKHBhcnNlZC5jaGFyKSAhPT0gbm93Q2hlY2tlZCkge1xuICAgICAgcmVzdWx0W2ldID0gc2V0Q2hlY2tib3hDaGFyKHJlc3VsdFtpXSwgbmV3Q2hhcik7XG4gICAgICB0b3VjaGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBOYWNoIG9iZW46IEVsdGVybi1DaGVja2JveGVuIGFuaGFuZCBpaHJlciBkaXJla3RlbiBLaW5kZXIgbmV1IGJld2VydGVuLFxuICAvLyByZWt1cnNpdiB3ZWl0ZXIgbmFjaCBvYmVuLCBzb2xhbmdlIHNpY2ggZGFkdXJjaCB0YXRzXHUwMEU0Y2hsaWNoIGV0d2FzIFx1MDBFNG5kZXJ0LlxuICBsZXQgY2hpbGRJbmRlbnQgPSB0b2dnbGVkLmluZGVudDtcbiAgbGV0IGN1cnNvciA9IHRvZ2dsZWRJbmRleDtcbiAgZm9yICg7Oykge1xuICAgIGxldCBwYXJlbnRJbmRleCA9IC0xO1xuICAgIGZvciAobGV0IGkgPSBjdXJzb3IgLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgaW5kID0gaW5kZW50T2YocmVzdWx0W2ldKTtcbiAgICAgIGlmIChpbmQgPT09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgaWYgKGluZCA8IGNoaWxkSW5kZW50KSB7XG4gICAgICAgIHBhcmVudEluZGV4ID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwYXJlbnRJbmRleCA9PT0gLTEpIGJyZWFrO1xuXG4gICAgY29uc3QgcGFyZW50ID0gcGFyc2VDaGVja2JveExpbmUocmVzdWx0W3BhcmVudEluZGV4XSk7XG4gICAgaWYgKCFwYXJlbnQpIGJyZWFrOyAvLyBFbHRlcm4tRWxlbWVudCBpc3Qga2VpbmUgQ2hlY2tib3ggLT4gaGllciBlbmRldCBkYXMgSG9jaGJsdWJiZXJuLlxuXG4gICAgbGV0IGRpcmVjdENoaWxkSW5kZW50ID0gbnVsbDtcbiAgICBsZXQgaGFzQ2hlY2tib3hDaGlsZCA9IGZhbHNlO1xuICAgIGxldCBhbGxDaGVja2VkID0gdHJ1ZTtcbiAgICBmb3IgKGxldCBpID0gcGFyZW50SW5kZXggKyAxOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmQgPSBpbmRlbnRPZihyZXN1bHRbaV0pO1xuICAgICAgaWYgKGluZCA9PT0gbnVsbCkgY29udGludWU7XG4gICAgICBpZiAoaW5kIDw9IHBhcmVudC5pbmRlbnQpIGJyZWFrO1xuICAgICAgaWYgKGRpcmVjdENoaWxkSW5kZW50ID09PSBudWxsKSBkaXJlY3RDaGlsZEluZGVudCA9IGluZDtcbiAgICAgIGlmIChpbmQgIT09IGRpcmVjdENoaWxkSW5kZW50KSBjb250aW51ZTsgLy8gdGllZmVyIHZlcnNjaGFjaHRlbHRlcyBFbmtlbGtpbmQsIGhpZXIgaXJyZWxldmFudC5cbiAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQ2hlY2tib3hMaW5lKHJlc3VsdFtpXSk7XG4gICAgICBpZiAoIXBhcnNlZCkgY29udGludWU7XG4gICAgICBoYXNDaGVja2JveENoaWxkID0gdHJ1ZTtcbiAgICAgIGlmICghaXNDaGVja2VkKHBhcnNlZC5jaGFyKSkgYWxsQ2hlY2tlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICghaGFzQ2hlY2tib3hDaGlsZCkgYnJlYWs7XG4gICAgaWYgKGlzQ2hlY2tlZChwYXJlbnQuY2hhcikgPT09IGFsbENoZWNrZWQpIGJyZWFrOyAvLyBzY2hvbiBpbSByaWNodGlnZW4gWnVzdGFuZCAtPiB3ZWl0ZXIgb2JlbiBcdTAwRTRuZGVydCBzaWNoIG5pY2h0cyBtZWhyLlxuXG4gICAgcmVzdWx0W3BhcmVudEluZGV4XSA9IHNldENoZWNrYm94Q2hhcihyZXN1bHRbcGFyZW50SW5kZXhdLCBhbGxDaGVja2VkID8gXCJ4XCIgOiBcIiBcIik7XG4gICAgdG91Y2hlZCA9IHRydWU7XG4gICAgY2hpbGRJbmRlbnQgPSBwYXJlbnQuaW5kZW50O1xuICAgIGN1cnNvciA9IHBhcmVudEluZGV4O1xuICB9XG5cbiAgcmV0dXJuIHRvdWNoZWQgPyByZXN1bHQgOiBudWxsO1xufVxuXG4vLyBFcmtlbm50IGVpbiBlaW5mYWNoZXMgVW1zY2hhbHRlbiAoZ2VuYXUgZWluZSBDaGVja2JveC1aZWlsZSBtaXQgdW52ZXJcdTAwRTRuZGVydGVyXG4vLyBFaW5yXHUwMEZDY2t1bmcsIGRlcmVuIEhha2VuLVp1c3RhbmQgc2ljaCBnZVx1MDBFNG5kZXJ0IGhhdCkgendpc2NoZW4gendlaSBUZXh0c3RcdTAwRTRuZGVuXG4vLyBnbGVpY2hlciBaZWlsZW56YWhsLCBzb25zdCAtMSAoTWVocmZhY2hcdTAwRTRuZGVydW5nLCBUaXBwZW4sIEVpbi0vQXVzclx1MDBGQ2NrZW4gZXRjLikuXG5mdW5jdGlvbiBkZXRlY3RUb2dnbGUocHJldlRleHQsIG5ld1RleHQpIHtcbiAgaWYgKHByZXZUZXh0ID09PSB1bmRlZmluZWQgfHwgcHJldlRleHQgPT09IG5ld1RleHQpIHJldHVybiAtMTtcbiAgY29uc3Qgb2xkTGluZXMgPSBwcmV2VGV4dC5zcGxpdChcIlxcblwiKTtcbiAgY29uc3QgbmV3TGluZXMgPSBuZXdUZXh0LnNwbGl0KFwiXFxuXCIpO1xuICBpZiAob2xkTGluZXMubGVuZ3RoICE9PSBuZXdMaW5lcy5sZW5ndGgpIHJldHVybiAtMTtcblxuICBsZXQgY2hhbmdlZEluZGV4ID0gLTE7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkTGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAob2xkTGluZXNbaV0gIT09IG5ld0xpbmVzW2ldKSB7XG4gICAgICBpZiAoY2hhbmdlZEluZGV4ICE9PSAtMSkgcmV0dXJuIC0xO1xuICAgICAgY2hhbmdlZEluZGV4ID0gaTtcbiAgICB9XG4gIH1cbiAgaWYgKGNoYW5nZWRJbmRleCA9PT0gLTEpIHJldHVybiAtMTtcblxuICBjb25zdCBiZWZvcmUgPSBwYXJzZUNoZWNrYm94TGluZShvbGRMaW5lc1tjaGFuZ2VkSW5kZXhdKTtcbiAgY29uc3QgYWZ0ZXIgPSBwYXJzZUNoZWNrYm94TGluZShuZXdMaW5lc1tjaGFuZ2VkSW5kZXhdKTtcbiAgaWYgKCFiZWZvcmUgfHwgIWFmdGVyIHx8IGJlZm9yZS5pbmRlbnQgIT09IGFmdGVyLmluZGVudCkgcmV0dXJuIC0xO1xuICBpZiAoaXNDaGVja2VkKGJlZm9yZS5jaGFyKSA9PT0gaXNDaGVja2VkKGFmdGVyLmNoYXIpKSByZXR1cm4gLTE7XG4gIHJldHVybiBjaGFuZ2VkSW5kZXg7XG59XG5cbi8vIFp3ZWkgdW5hYmhcdTAwRTRuZ2lnZSBFcmtlbm51bmdzd2VnZSwgZGEgT2JzaWRpYW4gQ2hlY2tib3gtS2xpY2tzIGplIG5hY2ggQW5zaWNodFxuLy8gdW50ZXJzY2hpZWRsaWNoIHBlcnNpc3RpZXJ0OlxuLy8gLSBSZWFkaW5nIFZpZXcgc3BlaWNoZXJ0IHNvZm9ydCAobFx1MDBGNnN0IFwidmF1bHQgbW9kaWZ5XCIgZGlyZWt0IGF1cykuXG4vLyAtIExpdmUgUHJldmlldy9Tb3VyY2UtTW9kdXMgXHUwMEU0bmRlcnQgenVuXHUwMEU0Y2hzdCBudXIgZGVuIEVkaXRvci1QdWZmZXI7IGRhc1xuLy8gICB0YXRzXHUwMEU0Y2hsaWNoZSBTY2hyZWliZW4gYXVmIGRpZSBGZXN0cGxhdHRlICh1bmQgZGFtaXQgXCJ2YXVsdCBtb2RpZnlcIikgaXN0XG4vLyAgIHVtIDJzIGRlYm91bmNlZCAoT2JzaWRpYW5zIGVpZ2VuZXIgQXV0b3NhdmUpIC0gdmllbCB6dSBzcFx1MDBFNHQgZlx1MDBGQ3IgZWluZVxuLy8gICBLYXNrYWRlLCBkaWUgc2ljaCB3aWUgZWluIGVpbnplbG5lciwgdW51bnRlcmJyb2NoZW5lciBLbGljayBhbmZcdTAwRkNobGVuIHNvbGwuXG4vLyAgIERhZlx1MDBGQ3IgZmV1ZXJ0IFwiZWRpdG9yLWNoYW5nZVwiIHN5bmNocm9uIGJlaSBqZWRlciBFZGl0b3ItXHUwMEM0bmRlcnVuZyB1bmQgbGllc3Rcbi8vICAgZGlyZWt0IGF1cyBkZW0gRWRpdG9yLVB1ZmZlciBzdGF0dCB2b24gZGVyIEZlc3RwbGF0dGUuXG4vLyBCZWlkZSBXZWdlIHRlaWxlbiBzaWNoIGRlbnNlbGJlbiBsYXN0Q29udGVudC1DYWNoZSwgZGFtaXQgZGVyIGpld2VpbHMgYW5kZXJlXG4vLyBXZWcgZWluZSBiZXJlaXRzIHZlcmFyYmVpdGV0ZSBcdTAwQzRuZGVydW5nIG5pY2h0IGVpbiB6d2VpdGVzIE1hbCBhdWZncmVpZnQuXG4vLyBFaW4gQ2hlY2tib3gtS2xpY2sga2FubiBudXIgaW4gZWluZXIgZ2VyYWRlIG9mZmVuZW4gQW5zaWNodCBwYXNzaWVyZW4gLVxuLy8gSGludGVyZ3J1bmQtU3BlaWNoZXJ1bmdlbiBuaWNodCBhbmdlemVpZ3RlciBOb3RpemVuICh6LiBCLiBkdXJjaCBhbmRlcmVcbi8vIFBsdWdpbnMpIG1cdTAwRkNzc2VuIHdpciBkYWhlciB3ZWRlciB2ZXJmb2xnZW4gbm9jaCBjYWNoZW4uXG5mdW5jdGlvbiBpc0ZpbGVPcGVuKHBsdWdpbiwgcGF0aCkge1xuICByZXR1cm4gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikuc29tZSgobGVhZikgPT4gbGVhZi52aWV3Py5maWxlPy5wYXRoID09PSBwYXRoKTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmMocGx1Z2luKSB7XG4gIGNvbnN0IGxhc3RDb250ZW50ID0gbmV3IE1hcCgpOyAvLyBQZmFkIC0+IHp1bGV0enQgZ2VzZWhlbmVyIEluaGFsdCwgbnVyIGZcdTAwRkNyIGdlcmFkZSBvZmZlbmUgTm90aXplblxuICBjb25zdCBhcHBseWluZyA9IG5ldyBTZXQoKTsgLy8gUGZhZGUsIGZcdTAwRkNyIGRpZSBnZXJhZGUgc2VsYnN0IGVpbmUgS2Fza2FkZSBnZXNjaHJpZWJlbiB3aXJkIChFY2hvL1JlZW50cmFueiBpZ25vcmllcmVuKVxuXG4gIGNvbnN0IGZvcmdldCA9IChwYXRoKSA9PiB7XG4gICAgbGFzdENvbnRlbnQuZGVsZXRlKHBhdGgpO1xuICAgIGFwcGx5aW5nLmRlbGV0ZShwYXRoKTtcbiAgfTtcblxuICAvLyBSXHUwMEU0dW10IGJlaW0gXHUwMEQ2ZmZuZW4gZWluZXIgTm90aXogbmViZW5iZWkgRWludHJcdTAwRTRnZSBmXHUwMEZDciBpbnp3aXNjaGVuIGdlc2NobG9zc2VuZVxuICAvLyBUYWJzIHdlZywgc3RhdHQgbGFzdENvbnRlbnQgXHUwMEZDYmVyIGRpZSBnYW56ZSBTZXNzaW9uIHVuYmVncmVuenQgd2FjaHNlbiB6dSBsYXNzZW4uXG4gIGNvbnN0IHBydW5lQ2xvc2VkRmlsZXMgPSAoKSA9PiB7XG4gICAgaWYgKGxhc3RDb250ZW50LnNpemUgPT09IDApIHJldHVybjtcbiAgICBjb25zdCBvcGVuUGF0aHMgPSBuZXcgU2V0KFxuICAgICAgcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikubWFwKChsZWFmKSA9PiBsZWFmLnZpZXc/LmZpbGU/LnBhdGgpLmZpbHRlcihCb29sZWFuKVxuICAgICk7XG4gICAgZm9yIChjb25zdCBwYXRoIG9mIGxhc3RDb250ZW50LmtleXMoKSkge1xuICAgICAgaWYgKCFvcGVuUGF0aHMuaGFzKHBhdGgpKSBsYXN0Q29udGVudC5kZWxldGUocGF0aCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHNlZWQgPSBhc3luYyAoZmlsZSkgPT4ge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQpIHJldHVybjtcbiAgICBwcnVuZUNsb3NlZEZpbGVzKCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgaWYgKGxhc3RDb250ZW50LmhhcyhmaWxlLnBhdGgpKSByZXR1cm47XG4gICAgbGFzdENvbnRlbnQuc2V0KGZpbGUucGF0aCwgYXdhaXQgcGx1Z2luLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVWYXVsdE1vZGlmeSA9IGFzeW5jIChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MubmVzdGVkQ2hlY2tib3hTeW5jRW5hYmxlZCkgcmV0dXJuO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikgcmV0dXJuO1xuICAgIGlmIChhcHBseWluZy5oYXMoZmlsZS5wYXRoKSkgcmV0dXJuO1xuICAgIGlmICghaXNGaWxlT3BlbihwbHVnaW4sIGZpbGUucGF0aCkpIHJldHVybjsgLy8ga2VpbiBDaGVja2JveC1LbGljayBtXHUwMEY2Z2xpY2ggLT4gbmljaHRzIHp1IHR1blxuXG4gICAgY29uc3QgbmV3VGV4dCA9IGF3YWl0IHBsdWdpbi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcbiAgICBjb25zdCBwcmV2VGV4dCA9IGxhc3RDb250ZW50LmdldChmaWxlLnBhdGgpO1xuICAgIGxhc3RDb250ZW50LnNldChmaWxlLnBhdGgsIG5ld1RleHQpO1xuXG4gICAgY29uc3QgaWR4ID0gZGV0ZWN0VG9nZ2xlKHByZXZUZXh0LCBuZXdUZXh0KTtcbiAgICBpZiAoaWR4ID09PSAtMSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3TGluZXMgPSBuZXdUZXh0LnNwbGl0KFwiXFxuXCIpO1xuICAgIGNvbnN0IGNhc2NhZGVkID0gY29tcHV0ZUNhc2NhZGUobmV3TGluZXMsIGlkeCk7XG4gICAgaWYgKCFjYXNjYWRlZCkgcmV0dXJuO1xuICAgIGNvbnN0IGZpbmFsVGV4dCA9IGNhc2NhZGVkLmpvaW4oXCJcXG5cIik7XG5cbiAgICBhcHBseWluZy5hZGQoZmlsZS5wYXRoKTtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBmaW5hbFRleHQpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBwbHVnaW4uYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKCkgPT4gZmluYWxUZXh0KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgYXBwbHlpbmcuZGVsZXRlKGZpbGUucGF0aCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUVkaXRvckNoYW5nZSA9IChlZGl0b3IsIGluZm8pID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5uZXN0ZWRDaGVja2JveFN5bmNFbmFibGVkKSByZXR1cm47XG4gICAgY29uc3QgZmlsZSA9IGluZm8/LmZpbGU7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgaWYgKGFwcGx5aW5nLmhhcyhmaWxlLnBhdGgpKSByZXR1cm47XG5cbiAgICBjb25zdCBuZXdUZXh0ID0gZWRpdG9yLmdldFZhbHVlKCk7XG4gICAgY29uc3QgcHJldlRleHQgPSBsYXN0Q29udGVudC5nZXQoZmlsZS5wYXRoKTtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBuZXdUZXh0KTtcblxuICAgIGNvbnN0IGlkeCA9IGRldGVjdFRvZ2dsZShwcmV2VGV4dCwgbmV3VGV4dCk7XG4gICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0xpbmVzID0gbmV3VGV4dC5zcGxpdChcIlxcblwiKTtcbiAgICBjb25zdCBjYXNjYWRlZCA9IGNvbXB1dGVDYXNjYWRlKG5ld0xpbmVzLCBpZHgpO1xuICAgIGlmICghY2FzY2FkZWQpIHJldHVybjtcblxuICAgIC8vIE51ciBkaWUgdGF0c1x1MDBFNGNobGljaCBhYndlaWNoZW5kZW4gWmVpbGVuIGVyc2V0emVuIChkaWUgdW1nZXNjaGFsdGV0ZSBaZWlsZVxuICAgIC8vIHNlbGJzdCBpc3QgYmVyZWl0cyBhbmdld2VuZGV0KSAtIGFscyBlaW5lIGdlbWVpbnNhbWUgVHJhbnNha3Rpb24sIGRhbWl0XG4gICAgLy8gQ3Vyc29yL1VuZG8tSGlzdG9yaWUgc2F1YmVyIGJsZWliZW4gdW5kIG5pY2h0IG1laHJmYWNoIHJlZW50cmFudCBnZWZldWVydCB3aXJkLlxuICAgIGNvbnN0IGNoYW5nZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhc2NhZGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoaSA9PT0gaWR4IHx8IGNhc2NhZGVkW2ldID09PSBuZXdMaW5lc1tpXSkgY29udGludWU7XG4gICAgICBjaGFuZ2VzLnB1c2goeyBmcm9tOiB7IGxpbmU6IGksIGNoOiAwIH0sIHRvOiB7IGxpbmU6IGksIGNoOiBuZXdMaW5lc1tpXS5sZW5ndGggfSwgdGV4dDogY2FzY2FkZWRbaV0gfSk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZmluYWxUZXh0ID0gY2FzY2FkZWQuam9pbihcIlxcblwiKTtcbiAgICBhcHBseWluZy5hZGQoZmlsZS5wYXRoKTtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBmaW5hbFRleHQpO1xuICAgIHRyeSB7XG4gICAgICBlZGl0b3IudHJhbnNhY3Rpb24oeyBjaGFuZ2VzIH0pO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBhcHBseWluZy5kZWxldGUoZmlsZS5wYXRoKTtcbiAgICB9XG4gIH07XG5cbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcIm1vZGlmeVwiLCBoYW5kbGVWYXVsdE1vZGlmeSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLndvcmtzcGFjZS5vbihcImVkaXRvci1jaGFuZ2VcIiwgaGFuZGxlRWRpdG9yQ2hhbmdlKSk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHNlZWQpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcImRlbGV0ZVwiLCAoZmlsZSkgPT4gZm9yZ2V0KGZpbGUucGF0aCkpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCAoX2ZpbGUsIG9sZFBhdGgpID0+IGZvcmdldChvbGRQYXRoKSkpO1xuICBwbHVnaW4uYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICBjb25zdCBhY3RpdmUgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgaWYgKGFjdGl2ZSkgc2VlZChhY3RpdmUpO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVyTmVzdGVkQ2hlY2tib3hTeW5jLCBjb21wdXRlQ2FzY2FkZSwgcGFyc2VDaGVja2JveExpbmUgfTtcbiIsICJjb25zdCBDT01NQU5EX0lEID0gXCJlZGl0b3I6dG9nZ2xlLWl0YWxpY3NcIjtcblxuLy8gT2JzaWRpYW5zIGVpZ2VuZXIgXCJLdXJzaXZcIi1CZWZlaGwgZlx1MDBGQ2d0IGJlaW0gRWluZlx1MDBGQ2dlbiBuZXVlciBGb3JtYXRpZXJ1bmcgZmVzdFxuLy8gXCIqLi4uKlwiIGVpbiAodWYuaXRhbGljLnN1cnJvdW5kaW5nQ2hhcnMgaW4gT2JzaWRpYW5zIEVkaXRvci1CdW5kbGUpIC0gXCJfXCJcbi8vIHdpcmQgZG9ydCBudXIgYWxzIGFsdFN1cnJvdW5kaW5nQ2hhcnMgenVyIEVSS0VOTlVORy9FTlRGRVJOVU5HIGJlcmVpdHNcbi8vIHZvcmhhbmRlbmVyIEt1cnNpdmZvcm1hdGllcnVuZyBha3plcHRpZXJ0LCBuaWUgYmVpbSBFaW5mXHUwMEZDZ2VuIHZlcndlbmRldC4gdWZcbi8vIHNlbGJzdCBpc3QgVGVpbCBlaW5lcyBwcml2YXRlbiBDbG9zdXJlLU9iamVrdHMgb2huZSBcdTAwRjZmZmVudGxpY2hlbiBadWdyaWZmLFxuLy8gdG9nZ2xlTWFya2Rvd25Gb3JtYXR0aW5nKCkgKEVkaXRvci5wcm90b3R5cGUsIGF1ZmdlcnVmZW4gXHUwMEZDYmVyIGRlbiBuYXRpdmVuXG4vLyBCZWZlaGwpIGFiZXIgZ2VuYXVzbyB3ZW5pZyBcdTAwRkNiZXJzY2hyZWliYmFyLCBvaG5lIE9ic2lkaWFucyBlaWdlbmUgTGlzdGVuLS9cbi8vIFRhYmVsbGVuLS9NZWhyZmFjaGF1c3dhaGwtTG9naWsgbmFjaHp1YmF1ZW4uXG4vL1xuLy8gRGVyIHNjaG1hbHN0ZSBFaW5ncmlmZnNwdW5rdCBsaWVndCBlaW5lIEViZW5lIHRpZWZlcjogdG9nZ2xlTWFya2Rvd25Gb3JtYXR0aW5nXG4vLyBiYXV0IGFsbGUgXHUwMEM0bmRlcnVuZ2VuIGluIGVpbiBBcnJheSBhdXMge2Zyb20sdG8saW5zZXJ0fS1PYmpla3RlbiB1bmQgcnVmdCBhbVxuLy8gRW5kZSBHRU5BVSBFSU5NQUwgdGhpcy5jbS5kaXNwYXRjaCh7Y2hhbmdlczouLi59KSBhdWYgKHRoaXMuY20gPSBlZGl0b3IuY20sXG4vLyBkaWUgcm9oZSBDb2RlTWlycm9yLUVkaXRvclZpZXcgLSBlaW5lIHN0YWJpbGUgSW5zdGFuei1Qcm9wZXJ0eSwgc2llaGVcbi8vIEVkaXRvci1Lb25zdHJ1a3RvciBpbSBCdW5kbGU6IFwidGhpcy5jbT1lXCIpLiBKZWRlIGZyaXNjaCBlaW5nZWZcdTAwRkNndGVcbi8vIEt1cnNpdi1NYXJraWVydW5nIGVyc2NoZWludCBkYXJpbiBhbHMgZWlnZW5lciBDaGFuZ2UgbWl0IGluc2VydD09PVwiKlwiXG4vLyAodWYuaXRhbGljLnN1cnJvdW5kaW5nQ2hhcnMpIC0gRW50ZmVybnVuZ2VuIGJlc3RlaGVuZGVyIE1hcmtlciAoZWdhbCBvYiBcIipcIlxuLy8gb2RlciBcIl9cIikgbGF1ZmVuIGRhZ2VnZW4gaW1tZXIgYWxzIGluc2VydDpcIlwiLiBEaXNwYXRjaCBmXHUwMEZDciBkaWUgRGF1ZXIgZGllc2VzXG4vLyBlaW5lbiBBdWZydWZzIGFienVmYW5nZW4gdW5kIGluc2VydD09PVwiKlwiIGF1ZiBpbnNlcnQ6XCJfXCIgdW16dXNjaHJlaWJlbixcbi8vIGxcdTAwRTRzc3QgT2JzaWRpYW5zIGtvbXBsZXR0ZSBTZWxlY3Rpb24tL1dvcnQtL0xpc3Rlbi0vVGFiZWxsZW4tTG9naWtcbi8vIHVuYW5nZXRhc3RldCAtIGlua2x1c2l2ZSBkZXIgRlx1MDBFNGxsZSwgaW4gZGVuZW4gc2llIGVpbmUgbWVocnplaWxpZ2UgQXVzd2FobFxuLy8gKHouIEIuIG1laHJlcmUgTGlzdGVuZWludHJcdTAwRTRnZSkgaW4gbWVocmVyZSBzZXBhcmF0ZSBcIiouLi4qXCItUGFhcmUgcHJvIFplaWxlXG4vLyBhdWZ0ZWlsdC5cbi8vXG4vLyBHcmVuemZhbGwgdmVyc2NoYWNodGVsdGUgRm9ybWF0aWVydW5nICh6LiBCLiBLdXJzaXYgYXVmIG51ciBkYXMgV29ydCBpblxuLy8gXCIqKnxmZXR0fCoqXCIsIG9kZXIgYXVmIGRlbiBnYW56ZW4gRmV0dC1CbG9jayBpbmtsLiBTdGVybmNoZW4gXCJ8KipmZXR0Kip8XCJcbi8vIGFuZ2V3ZW5kZXQpOiBlaW4gZnJpc2NoIGVpbmdlZlx1MDBGQ2d0ZXIgXCJfXCIgbGFuZGV0IGRhYmVpIGRpcmVrdCBuZWJlblxuLy8gYmVzdGVoZW5kZW0gXCIqKlwiIChcIioqX2ZldHRfKipcIiBiencuIFwiXyoqZmV0dCoqX1wiKS4gVXJzcHJcdTAwRkNuZ2xpY2ggd3VyZGUgZGllc2Vcbi8vIFVtd2FuZGx1bmcgZGVzaGFsYiBibG9ja2llcnQgKEZhbGxiYWNrIGF1ZiB1bnNjaFx1MDBGNm5lcywgYWJlciBcInNpY2hlcmVzXCJcbi8vIFwiKioqZmV0dCoqKlwiKSwgd2VpbCBPYnNpZGlhbnMgZWlnZW5lIEVya2VubnVuZyBnZW5hdSBkaWVzZW4gRmFsbCBiZWltXG4vLyBlcm5ldXRlbiBBdXNzY2hhbHRlbiB2b24gS3Vyc2l2IGZhbHNjaCBiZWhhbmRlbHQgaFx1MDBFNHR0ZSB1bmQgZGFiZWkgZWluZW5cbi8vIEJvbGQtU3Rlcm4gamUgU2VpdGUgbWl0Z2VmcmVzc2VuIGhcdTAwRTR0dGUuIGRyb3BTcHVyaW91c0JvbGRTdGFyUmVtb3ZhbHMoKVxuLy8gdW50ZW4gcmVwYXJpZXJ0IGdlbmF1IGRhcyBqZXR6dCBkaXJla3QgYW4gZGVyIFF1ZWxsZSAodW5hYmhcdTAwRTRuZ2lnIGRhdm9uLCB3aWVcbi8vIGRpZSBWZXJzY2hhY2h0ZWx1bmcgZW50c3RhbmRlbiBpc3QpIC0gZGllIFVtd2FuZGx1bmcgc2VsYnN0IGJyYXVjaHQgZGFoZXJcbi8vIGtlaW5lIFNvbmRlcmJlaGFuZGx1bmcgbWVociB1bmQgbFx1MDBFNHVmdCBmXHUwMEZDciBqZWRlcyBmcmlzY2ggZWluZ2VmXHUwMEZDZ3RlIFwiKlwiXG4vLyBnbGVpY2guXG5cbi8vIFNwaWVnZWxiaWxkbGljaGVzIFByb2JsZW0gYmVpbSBFTlRGRVJORU46IGxpZWd0IGJlcmVpdHMgdm9yaGFuZGVuZXIgVGV4dCB3aWVcbi8vIFwiXyoqd29ydCoqX1wiIHZvciAoS3Vyc2l2IGF1XHUwMERGZW4gbWl0IFwiX1wiLCBGZXR0IGlubmVuIG1pdCBcIioqXCIgLSB6LiBCLiB3ZWlsXG4vLyBqZW1hbmQgZGFzIHZvbiBIYW5kIHNvIGdldGlwcHQgaGF0KSwgZmluZGV0IE9ic2lkaWFucyBlaWdlbmUgU3VjaC0vXG4vLyBFbnRmZXJudW5nc2xvZ2lrICh5ZigpL2dmKCkpIGJlaW0gQXVzc2NoYWx0ZW4gdm9uIEt1cnNpdiB6d2FyIGtvcnJla3QgYmVpZGVcbi8vIFwiX1wiLU1hcmtlciwgZW50ZmVybnQgZGFiZWkgYWJlciBaVVNcdTAwQzRUWkxJQ0ggamUgZWluIFwiKlwiIGF1cyBkZW0gdmVyc2NoYWNodGVsdGVuXG4vLyBcIioqXCIgLSB3ZWlsIGRlc3NlbiBNYXJrZXIgKGRhIGlubmVyaGFsYiBkZXIgS3Vyc2l2c3Bhbm5lIGxpZWdlbmQpIGViZW5mYWxsc1xuLy8gZGFzIFwiZW1cIi1UYWcgdHJhZ2VuIHVuZCBnZigpJ3MgVGFnLUNoZWNrIGtlaW5lbiBVbnRlcnNjaGllZCB6d2lzY2hlbiBlaW5lbVxuLy8gYWxsZWluc3RlaGVuZGVuIEt1cnNpdi1cIipcIiB1bmQgZGVtIGVyc3RlbiBaZWljaGVuIGVpbmVzIGxcdTAwRTRuZ2VyZW4gXCIqKlwiLUxhdWZzXG4vLyBtYWNodCAoXCJfKip3b3J0KipfXCIgLT4gXCIqd29ydCpcIiBzdGF0dCBcIioqd29ydCoqXCIpLiBCZXRyaWZmdCBudXIgXCIqXCItXG4vLyBFbnRmZXJudW5nZW4gKHVmLml0YWxpYy5zdXJyb3VuZGluZ0NoYXJzKSwgXCJfXCItRW50ZmVybnVuZ2VuIChhbHRTdXJyb3VuZGluZy1cbi8vIENoYXJzKSBzaW5kIGRhdm9uIG5pZSBiZXRyb2ZmZW4sIGRhIFwiX1wiIG5pZSBUZWlsIGVpbmVzIFwiKipcIi1MYXVmcyBpc3QuXG4vLyBKZWRlIExcdTAwRjZzY2h1bmcsIGRlcmVuIGVpbnplbG5lcyBaZWljaGVuIGltIChub2NoIHVudmVyXHUwMEU0bmRlcnRlbikgRG9rdW1lbnRcbi8vIGRpcmVrdCBuZWJlbiBlaW5lbSB3ZWl0ZXJlbiBcIipcIiBsaWVndCwga2FubiBkYWhlciBnZWZhaHJsb3MgdmVyd29yZmVuXG4vLyB3ZXJkZW4gLSBkaWUgZWNodGVuIFwiX1wiLUxcdTAwRjZzY2h1bmdlbiBibGVpYmVuIHVuYW5nZXRhc3RldCBzdGVoZW4uXG5mdW5jdGlvbiBkcm9wU3B1cmlvdXNCb2xkU3RhclJlbW92YWxzKGRvYywgY2hhbmdlcykge1xuICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICBjb25zdCBrZXB0ID0gY2hhbmdlcy5maWx0ZXIoKGNoYW5nZSkgPT4ge1xuICAgIGlmIChjaGFuZ2UuaW5zZXJ0ICE9PSBcIlwiIHx8IGNoYW5nZS50byAtIGNoYW5nZS5mcm9tICE9PSAxKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoZG9jLnNsaWNlU3RyaW5nKGNoYW5nZS5mcm9tLCBjaGFuZ2UudG8pICE9PSBcIipcIikgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgYmVmb3JlID0gY2hhbmdlLmZyb20gPiAwID8gZG9jLnNsaWNlU3RyaW5nKGNoYW5nZS5mcm9tIC0gMSwgY2hhbmdlLmZyb20pIDogXCJcIjtcbiAgICBjb25zdCBhZnRlciA9IGNoYW5nZS50byA8IGRvYy5sZW5ndGggPyBkb2Muc2xpY2VTdHJpbmcoY2hhbmdlLnRvLCBjaGFuZ2UudG8gKyAxKSA6IFwiXCI7XG4gICAgaWYgKGJlZm9yZSAhPT0gXCIqXCIgJiYgYWZ0ZXIgIT09IFwiKlwiKSByZXR1cm4gdHJ1ZTtcbiAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xuICByZXR1cm4gY2hhbmdlZCA/IGtlcHQgOiBjaGFuZ2VzO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlckl0YWxpY1VuZGVyc2NvcmUocGx1Z2luKSB7XG4gIGNvbnN0IHBhdGNoID0gKCkgPT4ge1xuICAgIGNvbnN0IGNtZCA9IHBsdWdpbi5hcHAuY29tbWFuZHMuY29tbWFuZHNbQ09NTUFORF9JRF07XG4gICAgaWYgKCFjbWQgfHwgY21kLl9fZnJlZEl0YWxpY1BhdGNoZWQpIHJldHVybjtcbiAgICBjbWQuX19mcmVkSXRhbGljUGF0Y2hlZCA9IHRydWU7XG5cbiAgICBjb25zdCBvcmlnaW5hbCA9IGNtZC5lZGl0b3JDYWxsYmFjaztcbiAgICBjbWQuZWRpdG9yQ2FsbGJhY2sgPSBmdW5jdGlvbiAoZWRpdG9yLCBjdHgpIHtcbiAgICAgIGlmICghcGx1Z2luLnNldHRpbmdzLml0YWxpY1VuZGVyc2NvcmVFbmFibGVkKSByZXR1cm4gb3JpZ2luYWwuY2FsbCh0aGlzLCBlZGl0b3IsIGN0eCk7XG5cbiAgICAgIGNvbnN0IGNtID0gZWRpdG9yLmNtO1xuICAgICAgY29uc3Qgb3JpZ2luYWxEaXNwYXRjaCA9IGNtLmRpc3BhdGNoLmJpbmQoY20pO1xuICAgICAgY20uZGlzcGF0Y2ggPSBmdW5jdGlvbiAoc3BlYykge1xuICAgICAgICBpZiAoc3BlYyAmJiBBcnJheS5pc0FycmF5KHNwZWMuY2hhbmdlcykpIHtcbiAgICAgICAgICBjb25zdCBkb2MgPSBjbS5zdGF0ZS5kb2M7XG4gICAgICAgICAgZm9yIChjb25zdCBjaGFuZ2Ugb2Ygc3BlYy5jaGFuZ2VzKSB7XG4gICAgICAgICAgICBpZiAoY2hhbmdlLmluc2VydCA9PT0gXCIqXCIpIGNoYW5nZS5pbnNlcnQgPSBcIl9cIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcmVwYWlyZWQgPSBkcm9wU3B1cmlvdXNCb2xkU3RhclJlbW92YWxzKGRvYywgc3BlYy5jaGFuZ2VzKTtcbiAgICAgICAgICBpZiAocmVwYWlyZWQgIT09IHNwZWMuY2hhbmdlcykge1xuICAgICAgICAgICAgLy8gQW56YWhsL0xcdTAwRTRuZ2UgZGVyIENoYW5nZXMgaGF0IHNpY2ggZ2VcdTAwRTRuZGVydCAtIE9ic2lkaWFucyBlaWdlbmUsXG4gICAgICAgICAgICAvLyBhdWYgZGVtIE9SSUdJTkFMLUNoYW5nZXNldCBiZXJlY2huZXRlIFNlbGVjdGlvbiB3XHUwMEU0cmUgamV0enQgYW5cbiAgICAgICAgICAgIC8vIGZhbHNjaGVyIFBvc2l0aW9uLiBzZWxlY3Rpb24gd2VnbGFzc2VuIHVuZCBDTTYgZGllIChTdGFuZGFyZC0pXG4gICAgICAgICAgICAvLyBBYmJpbGR1bmcgZGVyIGJpc2hlcmlnZW4gU2VsZWN0aW9uIGR1cmNoIGRpZSBDaGFuZ2VzIHNlbGJzdFxuICAgICAgICAgICAgLy8gXHUwMEZDYmVybmVobWVuIGxhc3Nlbiwgc3RhdHQgc2llIGhpZXIgdm9uIEhhbmQgbmFjaHp1cmVjaG5lbi5cbiAgICAgICAgICAgIGNvbnN0IHsgc2VsZWN0aW9uLCAuLi5yZXN0IH0gPSBzcGVjO1xuICAgICAgICAgICAgc3BlYyA9IHsgLi4ucmVzdCwgY2hhbmdlczogcmVwYWlyZWQgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsRGlzcGF0Y2goc3BlYyk7XG4gICAgICB9O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLmNhbGwodGhpcywgZWRpdG9yLCBjdHgpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgY20uZGlzcGF0Y2ggPSBvcmlnaW5hbERpc3BhdGNoO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBwbHVnaW4ucmVnaXN0ZXIoKCkgPT4ge1xuICAgICAgY21kLmVkaXRvckNhbGxiYWNrID0gb3JpZ2luYWw7XG4gICAgICBkZWxldGUgY21kLl9fZnJlZEl0YWxpY1BhdGNoZWQ7XG4gICAgfSk7XG4gIH07XG5cbiAgcGx1Z2luLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeShwYXRjaCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyByZWdpc3Rlckl0YWxpY1VuZGVyc2NvcmUgfTtcbiIsICJjb25zdCB7IEZpbGVWYWx1ZSwgQmFzZXNFbnRyeSwgQm9vbGVhblZhbHVlIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQmFzZXM6IGltcGxpeml0ZSBQcm9wZXJ0eSBcImZpbGUuaGFzTm90ZVwiXG4gKiBaZWlndCBhbiwgb2IgZWluZSBOb3RpeiBhdVx1MDBERmVyaGFsYiBkZXMgRnJvbnRtYXR0ZXJzIEluaGFsdCBoYXQgLVxuICogYWJmcmFnYmFyIHdpZSBqZWRlIGVpbmdlYmF1dGUgRGF0ZWktUHJvcGVydHkgKGZpbGUuZW1iZWRzLCBmaWxlLnRhZ3MsIC4uLiksXG4gKiBvaG5lIGRhc3MgZGFmXHUwMEZDciBldHdhcyBpbnMgRnJvbnRtYXR0ZXIgZ2VzY2hyaWViZW4gd2lyZC5cbiAqXG4gKiBPYnNpZGlhbiBoYXQgZGFmXHUwMEZDciBrZWluZSBcdTAwRjZmZmVudGxpY2hlIFJlZ2lzdHJpZXJ1bmcgKG51clxuICogcmVnaXN0ZXJCYXNlc1ZpZXcvcmVnaXN0ZXJHbG9iYWxGdW5jL3JlZ2lzdGVySW5zdGFuY2VGdW5jKSwgZGllXG4gKiBiZW5cdTAwRjZ0aWd0ZW4gQmF1c3RlaW5lIHNpbmQgYWJlciBhdXMgXCJvYnNpZGlhblwiIGV4cG9ydGllcnQ6XG4gKiAgIC0gRmlsZVZhbHVlICAtIGRlciBXZXJ0IGhpbnRlciBcImZpbGUuKlwiOyBkZXNzZW4gb2JqZWN0QWNjZXNzKClcbiAqICAgICAgICAgICAgICAgICAgbFx1MDBGNnN0IGRpZSBlaW56ZWxuZW4gUHJvcGVydHktTmFtZW4gYXVmLCBrZXlzKCkgbGlzdGV0IHNpZVxuICogICAtIEJhc2VzRW50cnkuRklMRV9QUk9QRVJUSUVTIC0gZGllIExpc3RlLCBhdXMgZGVyIEJhc2VzIGRpZVxuICogICAgICAgICAgICAgICAgICBhdXN3XHUwMEU0aGxiYXJlbiBmaWxlLiotUHJvcGVydGllcyBpbiBkZXIgVUkgYXVmYmF1dFxuICogQmVpZGVzIHdpcmQgaGllciBlcmdcdTAwRTRuenQgc3RhdHQgZXJzZXR6dCB1bmQgYmVpbSBEZWFrdGl2aWVyZW4vRW50bGFkZW5cbiAqIHdpZWRlciB6dXJcdTAwRkNja2dlbm9tbWVuLlxuICpcbiAqIERlciBJbmhhbHQgd2lyZCByZWluIGF1cyBkZW0gTWV0YWRhdGVuLUNhY2hlIGJlc3RpbW10LCB3ZWlsIG9iamVjdEFjY2VzcygpXG4gKiBzeW5jaHJvbiBhbnR3b3J0ZW4gbXVzcyAoZWluIHZhdWx0LmNhY2hlZFJlYWQoKSBnaW5nZSBuaWNodCk6IGRlciBDYWNoZVxuICoga2VubnQgZlx1MDBGQ3IgamVkZSBOb3RpeiBpaHJlIHNlY3Rpb25zLCB1bmQgZGVyIEZyb250bWF0dGVyLUJsb2NrIGlzdCBkYXJpblxuICogZ2VuYXUgZGllIFNlY3Rpb24gdm9tIFR5cCBcInlhbWxcIi4gR2lidCBlcyBrZWluZSB3ZWl0ZXJlIFNlY3Rpb24sIHN0ZWh0XG4gKiBhdVx1MDBERmVyaGFsYiBkZXMgRnJvbnRtYXR0ZXJzIG5pY2h0cyAoTGVlcnplaWxlbiBlcnpldWdlbiBrZWluZSBTZWN0aW9uKS5cbiAqIERhIEJhc2VzIGJlaSBtZXRhZGF0YUNhY2hlIFwiY2hhbmdlZFwiIG5ldSBhdXN3ZXJ0ZXQsIGFrdHVhbGlzaWVydCBzaWNoXG4gKiBkaWUgUHJvcGVydHkgYmVpbSBCZWFyYmVpdGVuIGRlciBOb3RpeiB2b24gc2VsYnN0LlxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmNvbnN0IFBST1BFUlRZX05BTUUgPSBcImhhc05vdGVcIjtcbmNvbnN0IFBST1BFUlRZX0tFWSA9IFBST1BFUlRZX05BTUUudG9Mb3dlckNhc2UoKTtcbmNvbnN0IFBST1BFUlRZX0lEID0gXCJmaWxlLlwiICsgUFJPUEVSVFlfTkFNRTtcblxuLy8gQXVjaCBkaXJla3QgYWxzIHBsdWdpbi5oYXNOb3RlQ29udGVudChmaWxlKSBudXR6YmFyIChzaWVoZSBtYWluLmpzKSwgZGVzaGFsYlxuLy8gd2lyZCBuZWJlbiBlaW5lbSBURmlsZSBhdWNoIGVpbiBQZmFkIGFremVwdGllcnQgLSBPcmRuZXIgdW5kIFVuYmVrYW5udGVzXG4vLyBlcmdlYmVuIGZhbHNlIHN0YXR0IGVpbmVzIEZlaGxlcnMuXG5mdW5jdGlvbiBoYXNOb3RlQ29udGVudChhcHAsIGZpbGVPclBhdGgpIHtcbiAgY29uc3QgZmlsZSA9IHR5cGVvZiBmaWxlT3JQYXRoID09PSBcInN0cmluZ1wiID8gYXBwLnZhdWx0LmdldEZpbGVCeVBhdGgoZmlsZU9yUGF0aCkgOiBmaWxlT3JQYXRoO1xuICBpZiAoIWZpbGU/LnN0YXQpIHJldHVybiBmYWxzZTtcbiAgLy8gTmljaHQtTWFya2Rvd24gKEJpbGRlciwgUERGcywgLi4uKSBoYWJlbiBrZWluZSBzZWN0aW9ucyAtIGRvcnQgaXN0IGRpZVxuICAvLyBEYXRlaWdyXHUwMEY2XHUwMERGZSBkYXMgZWluemlnIHNpbm52b2xsZSBLcml0ZXJpdW0uXG4gIGlmIChmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm4gZmlsZS5zdGF0LnNpemUgPiAwO1xuICBjb25zdCBjYWNoZSA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgLy8gTm9jaCBuaWNodCBpbmRleGllcnQ6IEdyXHUwMEY2XHUwMERGZSBhbHMgTm90YmVoZWxmLCBzdGF0dCBcImxlZXJcIiB6dSBiZWhhdXB0ZW4uXG4gIGlmICghY2FjaGUpIHJldHVybiBmaWxlLnN0YXQuc2l6ZSA+IDA7XG4gIGNvbnN0IHNlY3Rpb25zID0gY2FjaGUuc2VjdGlvbnM7XG4gIGlmICghc2VjdGlvbnMgfHwgc2VjdGlvbnMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBzZWN0aW9ucy5zb21lKChzZWN0aW9uKSA9PiBzZWN0aW9uLnR5cGUgIT09IFwieWFtbFwiKTtcbn1cblxuZnVuY3Rpb24gaW5zdGFsbCgpIHtcbiAgaWYgKCFGaWxlVmFsdWU/LnByb3RvdHlwZSB8fCAhQm9vbGVhblZhbHVlKSB7XG4gICAgY29uc29sZS53YXJuKFwiW0ZyZWRdIEJhc2VzLVByb3BlcnR5IFxcXCJmaWxlLmhhc05vdGVcXFwiOiBGaWxlVmFsdWUvQm9vbGVhblZhbHVlIG5pY2h0IHZlcmZcdTAwRkNnYmFyLCBcdTAwRkNiZXJzcHJ1bmdlbi5cIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBvcmlnaW5hbE9iamVjdEFjY2VzcyA9IEZpbGVWYWx1ZS5wcm90b3R5cGUub2JqZWN0QWNjZXNzO1xuICBjb25zdCBvcmlnaW5hbEtleXMgPSBGaWxlVmFsdWUucHJvdG90eXBlLmtleXM7XG5cbiAgLy8gQmFzZXMgcnVmdCBvYmplY3RBY2Nlc3MoKSBpbW1lciBrbGVpbmdlc2NocmllYmVuIGF1ZiwgZGVyIFByb3BlcnR5LU5hbWVcbiAgLy8gZGFyZiBpbiBkZXIgVUkgZGVzaGFsYiB0cm90emRlbSBjYW1lbENhc2UgYmxlaWJlbi5cbiAgRmlsZVZhbHVlLnByb3RvdHlwZS5vYmplY3RBY2Nlc3MgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzdHJpbmdcIiAmJiBuYW1lLnRvTG93ZXJDYXNlKCkgPT09IFBST1BFUlRZX0tFWSkge1xuICAgICAgcmV0dXJuIG5ldyBCb29sZWFuVmFsdWUoaGFzTm90ZUNvbnRlbnQodGhpcy5hcHAsIHRoaXMuZmlsZSkpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWxPYmplY3RBY2Nlc3MuY2FsbCh0aGlzLCBuYW1lKTtcbiAgfTtcblxuICBGaWxlVmFsdWUucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG9yaWdpbmFsS2V5cy5jYWxsKHRoaXMpLmNvbmNhdChbUFJPUEVSVFlfTkFNRV0pO1xuICB9O1xuXG4gIGNvbnN0IHByb3BlcnR5TGlzdCA9IEFycmF5LmlzQXJyYXkoQmFzZXNFbnRyeT8uRklMRV9QUk9QRVJUSUVTKSA/IEJhc2VzRW50cnkuRklMRV9QUk9QRVJUSUVTIDogbnVsbDtcbiAgY29uc3QgbGlzdGVkID0gcHJvcGVydHlMaXN0ICYmICFwcm9wZXJ0eUxpc3QuaW5jbHVkZXMoUFJPUEVSVFlfSUQpO1xuICBpZiAobGlzdGVkKSBwcm9wZXJ0eUxpc3QucHVzaChQUk9QRVJUWV9JRCk7XG5cbiAgcmV0dXJuICgpID0+IHtcbiAgICBGaWxlVmFsdWUucHJvdG90eXBlLm9iamVjdEFjY2VzcyA9IG9yaWdpbmFsT2JqZWN0QWNjZXNzO1xuICAgIEZpbGVWYWx1ZS5wcm90b3R5cGUua2V5cyA9IG9yaWdpbmFsS2V5cztcbiAgICBpZiAobGlzdGVkKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHByb3BlcnR5TGlzdC5pbmRleE9mKFBST1BFUlRZX0lEKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHByb3BlcnR5TGlzdC5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJCYXNlc0hhc05vdGUocGx1Z2luKSB7XG4gIGxldCB1bmluc3RhbGwgPSBudWxsO1xuXG4gIGNvbnN0IHVwZGF0ZSA9ICgpID0+IHtcbiAgICBjb25zdCBlbmFibGVkID0gcGx1Z2luLnNldHRpbmdzLmJhc2VzSGFzTm90ZUVuYWJsZWQ7XG4gICAgaWYgKGVuYWJsZWQgJiYgIXVuaW5zdGFsbCkgdW5pbnN0YWxsID0gaW5zdGFsbCgpO1xuICAgIGVsc2UgaWYgKCFlbmFibGVkICYmIHVuaW5zdGFsbCkge1xuICAgICAgdW5pbnN0YWxsKCk7XG4gICAgICB1bmluc3RhbGwgPSBudWxsO1xuICAgIH1cbiAgfTtcblxuICB1cGRhdGUoKTtcbiAgcGx1Z2luLnJlZ2lzdGVyKCgpID0+IHtcbiAgICB1bmluc3RhbGw/LigpO1xuICAgIHVuaW5zdGFsbCA9IG51bGw7XG4gIH0pO1xuXG4gIHJldHVybiB1cGRhdGU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyByZWdpc3RlckJhc2VzSGFzTm90ZSwgaGFzTm90ZUNvbnRlbnQsIFBST1BFUlRZX0lEIH07XG4iLCAiY29uc3QgeyBOb3RpY2UgfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTdHlsZSBTZXR0aW5nczogXCJNb2RpZmllZFwiLUZpbHRlclxuICogRXJnXHUwMEU0bnp0IGltIEVpbnN0ZWxsdW5ncy1UYWIgZGVzIFBsdWdpbnMgXCJTdHlsZSBTZXR0aW5nc1wiIGxpbmtzIG5lYmVuXG4gKiBJbXBvcnQvRXhwb3J0IGVpbmVuIEtub3BmLCBkZXIgZGllIExpc3RlIGF1ZiBkaWUgRWluc3RlbGx1bmdlbiBmaWx0ZXJ0LFxuICogZGllIG5pY2h0IG1laHIgaWhyZW0gU3RhbmRhcmR3ZXJ0IGVudHNwcmVjaGVuLlxuICpcbiAqIFN0eWxlIFNldHRpbmdzIGJyaW5ndCBzZWxic3QgbnVyIGVpbmUgVGV4dHN1Y2hlIG1pdC4gRGVyZW4gTWVjaGFuaWsgd2lyZFxuICogaGllciB3ZWl0ZXJ2ZXJ3ZW5kZXQsIG51ciBtaXQgZWluZW0gYW5kZXJlbiBLcml0ZXJpdW06IGplZGUgU2VrdGlvbiBpc3RcbiAqIGVpbmUgQmF1bWtvbXBvbmVudGUgbWl0IGNoaWxkcmVuL2ZpbHRlcmVkQ2hpbGRyZW4vZmlsdGVyTW9kZSwgdW5kXG4gKiByZW5kZXJDaGlsZHJlbigpIHplaWd0IGltIGZpbHRlck1vZGUgYXVzc2NobGllXHUwMERGbGljaCBkaWUgZ2VmaWx0ZXJ0ZW5cbiAqIEtpbmRlci4gSGllciBlbnRzY2hlaWRldCBzdGF0dCBlaW5lcyBGdXp6eS1UcmVmZmVycyBcIldlcnQgIT0gU3RhbmRhcmRcIiAtXG4gKiB1bmQgYW5kZXJzIGFscyBkb3J0IGJsZWlidCBkZXIgQXVmLS9adWtsYXBwLVp1c3RhbmQgdW5iZXJcdTAwRkNocnQuXG4gKlxuICogQW5nZWZhc3N0IHdpcmQgZGFiZWkgbmljaHRzIGFuIFN0eWxlIFNldHRpbmdzJyBQcm90b3R5cGVuLCBzb25kZXJuIG51clxuICogamUgZWluZSBNZXRob2RlIGF1ZiBkZW4ga29ua3JldGVuIE9iamVrdGVuIChTZXR0aW5ncy1UYWIgdW5kIGRlc3NlblxuICogTWFya3VwLUluc3RhbnopLCBkYW1pdCBkZXIgS25vcGYgYXVjaCBkaWUgcGx1Z2luLWVpZ2VuZW4gTmV1YXVmYmF1dGVuXG4gKiAoSW1wb3J0LCBcIlJlc2V0IGFsbCBzZXR0aW5nc1wiKSBcdTAwRkNiZXJzdGVodC4gRGVyIEVpbnN0aWVnIGxcdTAwRTR1ZnQgXHUwMEZDYmVyXG4gKiBhcHAuc2V0dGluZy5vcGVuVGFiLCB3ZWlsIFN0eWxlIFNldHRpbmdzIGVyc3Qgc3BcdTAwRTR0ZXIgZ2VsYWRlbiBzZWluIGthbm5cbiAqIChMYXp5IExvYWRpbmcpIC0gZG9ydCBnaWJ0IGVzIGtlaW4gRXJlaWduaXMsIGF1ZiBkYXMgbWFuIHdhcnRlbiBrXHUwMEY2bm50ZS5cbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jb25zdCBTVFlMRV9TRVRUSU5HU19JRCA9IFwib2JzaWRpYW4tc3R5bGUtc2V0dGluZ3NcIjtcblxuLy8gVHlwLUJlemVpY2huZXIgYXVzIFN0eWxlIFNldHRpbmdzJyBTZXR0aW5nVHlwZS1FbnVtLlxuY29uc3QgVFlQRV9IRUFESU5HID0gXCJoZWFkaW5nXCI7XG5jb25zdCBUWVBFX0lORk9fVEVYVCA9IFwiaW5mby10ZXh0XCI7XG5jb25zdCBUWVBFX0NPTE9SID0gXCJ2YXJpYWJsZS1jb2xvclwiO1xuY29uc3QgVFlQRV9USEVNRURfQ09MT1IgPSBcInZhcmlhYmxlLXRoZW1lZC1jb2xvclwiO1xuXG4vLyBCZXNjaHJpZnR1bmcgZW5nbGlzY2gsIHdlaWwgZGVyIEtub3BmIHp3aXNjaGVuIFN0eWxlIFNldHRpbmdzJyBlaWdlbmVuXG4vLyBCZXNjaHJpZnR1bmdlbiBzaXR6dCAoXCJJbXBvcnRcIiwgXCJFeHBvcnRcIiwgXCJTZWFyY2ggU3R5bGUgU2V0dGluZ3MuLi5cIikuXG5jb25zdCBCVVRUT05fQ0xBU1MgPSBcImZyZWQtc3R5bGUtc2V0dGluZ3MtbW9kaWZpZWRcIjtcbmNvbnN0IEJVVFRPTl9MQUJFTCA9IFwiTW9kaWZpZWRcIjtcbmNvbnN0IEJVVFRPTl9UT09MVElQID0gXCJOdXIgRWluc3RlbGx1bmdlbiB6ZWlnZW4sIGRpZSB2b20gU3RhbmRhcmQgYWJ3ZWljaGVuXCI7XG5cbi8qIC0tLSBXZXJ0IHZzLiBTdGFuZGFyZCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cblxuLy8gRmFyYmVuIGRcdTAwRkNyZmVuIGluIGJlbGllYmlnZXIgQ1NTLU5vdGF0aW9uIGltIFRoZW1lIHN0ZWhlbiwgZ2VzcGVpY2hlcnQgd2lyZFxuLy8gZGFnZWdlbiBpbW1lciBIRVggdm9tIEZhcmJ3XHUwMEU0aGxlci4gRGllIENTU09NIG5vcm1hbGlzaWVydCBiZWltIFp1clx1MDBGQ2NrbGVzZW5cbi8vIGF1ZiByZ2IoKS9yZ2JhKCk7IGVpbiB1bmdcdTAwRkNsdGlnZXIgV2VydCAoZXMgZ2lidCBUaGVtZXMgbWl0IGRlbSBQbGF0emhhbHRlclxuLy8gXCIjXCIgYWxzIFN0YW5kYXJkKSB3aXJkIHZlcndvcmZlbiAtIGRhbm4gYmxlaWJ0IGVzIGJlaW0gVGV4dHZlcmdsZWljaC5cbmxldCBjb2xvclByb2JlID0gbnVsbDtcbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbG9yKHZhbHVlKSB7XG4gIGlmICghY29sb3JQcm9iZSkgY29sb3JQcm9iZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICBjb2xvclByb2JlLnN0eWxlLmNvbG9yID0gXCJcIjtcbiAgY29sb3JQcm9iZS5zdHlsZS5jb2xvciA9IHZhbHVlO1xuICByZXR1cm4gY29sb3JQcm9iZS5zdHlsZS5jb2xvciB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiB2YWx1ZXNFcXVhbCh2YWx1ZSwgZmFsbGJhY2ssIGlzQ29sb3IpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIgfHwgdHlwZW9mIGZhbGxiYWNrID09PSBcImJvb2xlYW5cIikgcmV0dXJuICEhdmFsdWUgPT09ICEhZmFsbGJhY2s7XG5cbiAgY29uc3QgYSA9IHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwgPyBcIlwiIDogU3RyaW5nKHZhbHVlKS50cmltKCk7XG4gIGNvbnN0IGIgPSBmYWxsYmFjayA9PT0gdW5kZWZpbmVkIHx8IGZhbGxiYWNrID09PSBudWxsID8gXCJcIiA6IFN0cmluZyhmYWxsYmFjaykudHJpbSgpO1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIC8vIFwibm9uZVwiIGlzdCBiZWkgY2xhc3Mtc2VsZWN0L3ZhcmlhYmxlLXNlbGVjdCBkZXIgUGxhdHpoYWx0ZXIgZlx1MDBGQ3IgXCJuaWNodHNcbiAgLy8gZ2VzZXR6dFwiIC0gZ2VnZW5cdTAwRkNiZXIgZWluZW0gZmVobGVuZGVuIFN0YW5kYXJkIGFsc28ga2VpbiBVbnRlcnNjaGllZC5cbiAgaWYgKChhID09PSBcIlwiIHx8IGEgPT09IFwibm9uZVwiKSAmJiAoYiA9PT0gXCJcIiB8fCBiID09PSBcIm5vbmVcIikpIHJldHVybiB0cnVlO1xuXG4gIGlmIChpc0NvbG9yKSB7XG4gICAgY29uc3Qgbm9ybUEgPSBub3JtYWxpemVDb2xvcihhKTtcbiAgICBjb25zdCBub3JtQiA9IG5vcm1hbGl6ZUNvbG9yKGIpO1xuICAgIGlmIChub3JtQSAmJiBub3JtQikgcmV0dXJuIG5vcm1BID09PSBub3JtQjtcbiAgfVxuXG4gIC8vIFphaGxlbiAodmFyaWFibGUtbnVtYmVyLCBTbGlkZXIpIGxpZWdlbiBhbHMgWmFobCBvZGVyIGFscyBUZXh0IHZvci5cbiAgY29uc3QgbnVtQSA9IE51bWJlcihhKTtcbiAgY29uc3QgbnVtQiA9IE51bWJlcihiKTtcbiAgaWYgKGEgIT09IFwiXCIgJiYgYiAhPT0gXCJcIiAmJiAhTnVtYmVyLmlzTmFOKG51bUEpICYmICFOdW1iZXIuaXNOYU4obnVtQikpIHJldHVybiBudW1BID09PSBudW1CO1xuXG4gIHJldHVybiBhLnRvTG93ZXJDYXNlKCkgPT09IGIudG9Mb3dlckNhc2UoKTtcbn1cblxuLy8gQmVpIHZhcmlhYmxlLWNvbG9yIGRhcmYgZGVyIFN0YW5kYXJkIGltIENTUyBmZWhsZW47IFN0eWxlIFNldHRpbmdzIGhvbHQgaWhuXG4vLyBkYW5uIGF1cyBkZXIgQ1NTLVZhcmlhYmxlbiAtIGFsbGVyZGluZ3MgZXJzdCBiZWltIFJlbmRlcm4gZGVyIFplaWxlLCB1bmRcbi8vIGVpbmdla2xhcHB0ZSBTZWt0aW9uZW4gc2luZCBub2NoIG5pY2h0IGdlcmVuZGVydC4gRGVzaGFsYiBoaWVyIGRlcnNlbGJlXG4vLyBSXHUwMEZDY2tncmlmZi5cbmZ1bmN0aW9uIGRlZmF1bHRWYWx1ZU9mKGNvbXBvbmVudCwgbWFuYWdlcikge1xuICBjb25zdCBzZXR0aW5nID0gY29tcG9uZW50LnNldHRpbmc7XG4gIGlmIChzZXR0aW5nLnR5cGUgPT09IFRZUEVfQ09MT1IgJiYgdHlwZW9mIHNldHRpbmcuZGVmYXVsdCAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gbWFuYWdlci5wbHVnaW4uZ2V0Q1NTVmFyKHNldHRpbmcuaWQpPy5jdXJyZW50Py50cmltKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBzZXR0aW5nLmRlZmF1bHQ7XG59XG5cbmZ1bmN0aW9uIGlzTW9kaWZpZWQoY29tcG9uZW50LCBtYW5hZ2VyKSB7XG4gIGNvbnN0IHNldHRpbmcgPSBjb21wb25lbnQuc2V0dGluZztcbiAgY29uc3QgdHlwZSA9IHNldHRpbmc/LnR5cGU7XG4gIC8vIGluZm8tdGV4dCBpc3QgcmVpbmVyIFRleHQsIGhlYWRpbmcgd2lyZCByZWt1cnNpdiBiZWhhbmRlbHQuXG4gIGlmICghdHlwZSB8fCB0eXBlID09PSBUWVBFX0hFQURJTkcgfHwgdHlwZSA9PT0gVFlQRV9JTkZPX1RFWFQpIHJldHVybiBmYWxzZTtcblxuICAvLyBUaGVtZW5hYmhcdTAwRTRuZ2lnZSBGYXJiZW4gc2luZCB6d2VpIFdlcnRlIHVudGVyIFwiPGlkPkBAbGlnaHRcIi9cIjxpZD5AQGRhcmtcIlxuICAvLyBtaXQgamUgZWlnZW5lbSBTdGFuZGFyZCAoXCJkZWZhdWx0LWxpZ2h0XCIvXCJkZWZhdWx0LWRhcmtcIikuXG4gIGlmICh0eXBlID09PSBUWVBFX1RIRU1FRF9DT0xPUikge1xuICAgIHJldHVybiBbXCJsaWdodFwiLCBcImRhcmtcIl0uc29tZSgoc2NoZW1lKSA9PiB7XG4gICAgICBjb25zdCBzdG9yZWQgPSBtYW5hZ2VyLmdldFNldHRpbmcoY29tcG9uZW50LnNlY3Rpb25JZCwgc2V0dGluZy5pZCArIFwiQEBcIiArIHNjaGVtZSk7XG4gICAgICByZXR1cm4gc3RvcmVkICE9PSB1bmRlZmluZWQgJiYgIXZhbHVlc0VxdWFsKHN0b3JlZCwgc2V0dGluZ1tcImRlZmF1bHQtXCIgKyBzY2hlbWVdLCB0cnVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHN0b3JlZCA9IG1hbmFnZXIuZ2V0U2V0dGluZyhjb21wb25lbnQuc2VjdGlvbklkLCBzZXR0aW5nLmlkKTtcbiAgLy8gTmllIGFuZ2VmYXNzdCAtIFN0eWxlIFNldHRpbmdzIHNwZWljaGVydCBudXIsIHdhcyBnZXNldHp0IHd1cmRlLlxuICBpZiAoc3RvcmVkID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgLy8gR2VzcGVpY2hlcnQgaGVpXHUwMERGdCBhYmVyIG5pY2h0IGFid2VpY2hlbmQ6IHdlciBlaW5lbiBTY2hhbHRlciB6d2VpbWFsXG4gIC8vIHVtbGVndCwgaGludGVybFx1MDBFNHNzdCBlaW5lbiBFaW50cmFnIG1pdCBkZW0gU3RhbmRhcmR3ZXJ0IGRhcmluLlxuICByZXR1cm4gIXZhbHVlc0VxdWFsKHN0b3JlZCwgZGVmYXVsdFZhbHVlT2YoY29tcG9uZW50LCBtYW5hZ2VyKSwgdHlwZSA9PT0gVFlQRV9DT0xPUik7XG59XG5cbi8qIC0tLSBGaWx0ZXJuIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG4vKiBXaWUgU3R5bGUgU2V0dGluZ3MnIGVpZ2VuZXMgZmlsdGVyKHN1Y2hiZWdyaWZmKSAtIG1pdCBlaW5lbSBVbnRlcnNjaGllZDpcbiAqIGRvcnQga2xhcHB0IGplZGUgU2VrdGlvbiBtaXQgVHJlZmZlcm4gYXVmIHVuZCBqZWRlIG9obmUgenUgKHVuZFxuICogY2xlYXJGaWx0ZXIoKSBrbGFwcHQgYW5zY2hsaWVcdTAwREZlbmQgYWxsZXMgenUpLiBIaWVyIGJsZWlidCBkZXIgQXVmLS9adWtsYXBwLVxuICogWnVzdGFuZCB1bmJlclx1MDBGQ2hydCwgZ2VmaWx0ZXJ0IHdpcmQgbnVyIGRlciBJbmhhbHQuXG4gKlxuICogRGVzaGFsYiBpbiB6d2VpIFNjaHJpdHRlbjogZXJzdCByZWNobmVuIChzZXR6dCBudXIgZmlsdGVyTW9kZS9cbiAqIGZpbHRlcmVkQ2hpbGRyZW4sIGF1Y2ggaW4gZWluZ2VrbGFwcHRlbiBTZWt0aW9uZW4gLSBkaWUgemVpZ2VuIGJlaW1cbiAqIHNwXHUwMEU0dGVyZW4gQXVma2xhcHBlbiBkYW5uIHZvbiBzZWxic3QgZGllIGdlZmlsdGVydGUgQXVzd2FobCksIGRhbm4gbmV1XG4gKiB6ZWljaG5lbi4gVW5kIHp3YXIgbnVyIGRpZSBhdWZnZWtsYXBwdGVuIG9iZXJzdGVuIFNla3Rpb25lbjogZGVyZW5cbiAqIHJlbmRlckNoaWxkcmVuKCkgYmF1dCBkaWUgVW50ZXJiXHUwMEU0dW1lIG9obmVoaW4gbmV1IGF1ZiwgdW5kIGplZGVcbiAqIFVudGVyLVx1MDBEQ2JlcnNjaHJpZnQgc3RlbGx0IGluIGlocmVtIHJlbmRlcigpIGlocmVuIGVpZ2VuZW4gWnVzdGFuZCB3aWVkZXJcbiAqIGhlci4gRWluZ2VrbGFwcHRlIFNla3Rpb25lbiBoYWJlbiBnYXIga2VpbmUgZ2V6ZWljaG5ldGVuIEtpbmRlciAtIGRvcnRcbiAqIHdcdTAwRkNyZGUgWmVpY2huZW4gc2llIGZcdTAwRTRsc2NobGljaCBhbmxlZ2VuLlxuICovXG5mdW5jdGlvbiBjb21wdXRlRmlsdGVyKGNvbXBvbmVudCwgbWFuYWdlcikge1xuICBjb21wb25lbnQuZmlsdGVyZWRDaGlsZHJlbiA9IFtdO1xuICBjb21wb25lbnQuZmlsdGVyUmVzdWx0Q291bnQgPSAwO1xuXG4gIGZvciAoY29uc3QgY2hpbGQgb2YgY29tcG9uZW50LmNoaWxkcmVuKSB7XG4gICAgaWYgKGNoaWxkLnNldHRpbmcudHlwZSA9PT0gVFlQRV9IRUFESU5HKSB7XG4gICAgICBjb25zdCBjb3VudCA9IGNvbXB1dGVGaWx0ZXIoY2hpbGQsIG1hbmFnZXIpO1xuICAgICAgaWYgKGNvdW50ID4gMCkge1xuICAgICAgICBjb21wb25lbnQuZmlsdGVyUmVzdWx0Q291bnQgKz0gY291bnQ7XG4gICAgICAgIGNvbXBvbmVudC5maWx0ZXJlZENoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNNb2RpZmllZChjaGlsZCwgbWFuYWdlcikpIHtcbiAgICAgIGNvbXBvbmVudC5maWx0ZXJlZENoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgY29tcG9uZW50LmZpbHRlclJlc3VsdENvdW50ICs9IDE7XG4gICAgfVxuICB9XG5cbiAgY29tcG9uZW50LmZpbHRlck1vZGUgPSB0cnVlO1xuICBjb21wb25lbnQucmVzdWx0c0VsPy5zZXRUZXh0KGNvbXBvbmVudC5maWx0ZXJSZXN1bHRDb3VudCArIFwiIFJlc3VsdHNcIik7XG4gIHJldHVybiBjb21wb25lbnQuZmlsdGVyUmVzdWx0Q291bnQ7XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVDbGVhcihjb21wb25lbnQpIHtcbiAgY29tcG9uZW50LmZpbHRlcmVkQ2hpbGRyZW4gPSBbXTtcbiAgY29tcG9uZW50LmZpbHRlck1vZGUgPSBmYWxzZTtcbiAgY29tcG9uZW50LnJlc3VsdHNFbD8uZW1wdHkoKTtcbiAgZm9yIChjb25zdCBjaGlsZCBvZiBjb21wb25lbnQuY2hpbGRyZW4pIHtcbiAgICBpZiAoY2hpbGQuc2V0dGluZy50eXBlID09PSBUWVBFX0hFQURJTkcpIGNvbXB1dGVDbGVhcihjaGlsZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVkcmF3KG1hcmt1cCkge1xuICBmb3IgKGNvbnN0IHRyZWUgb2YgbWFya3VwLnNldHRpbmdzQ29tcG9uZW50VHJlZXMpIHtcbiAgICBpZiAoIXRyZWUuc2V0dGluZy5jb2xsYXBzZWQpIHRyZWUucmVuZGVyQ2hpbGRyZW4oKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBseU1vZGlmaWVkRmlsdGVyKG1hcmt1cCwgbWFuYWdlcikge1xuICBsZXQgY291bnQgPSAwO1xuICBmb3IgKGNvbnN0IHRyZWUgb2YgbWFya3VwLnNldHRpbmdzQ29tcG9uZW50VHJlZXMpIGNvdW50ICs9IGNvbXB1dGVGaWx0ZXIodHJlZSwgbWFuYWdlcik7XG4gIHJlZHJhdyhtYXJrdXApO1xuICByZXR1cm4gY291bnQ7XG59XG5cbmZ1bmN0aW9uIGNsZWFyTW9kaWZpZWRGaWx0ZXIobWFya3VwKSB7XG4gIGZvciAoY29uc3QgdHJlZSBvZiBtYXJrdXAuc2V0dGluZ3NDb21wb25lbnRUcmVlcykgY29tcHV0ZUNsZWFyKHRyZWUpO1xuICByZWRyYXcobWFya3VwKTtcbn1cblxuLyogLS0tIEtub3BmIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbmZ1bmN0aW9uIGZpbmRTZWFyY2hJbnB1dChtYXJrdXApIHtcbiAgcmV0dXJuIG1hcmt1cC5jb250YWluZXJFbD8ucXVlcnlTZWxlY3RvcihcImlucHV0W3R5cGU9c2VhcmNoXVwiKSA/PyBudWxsO1xufVxuXG5mdW5jdGlvbiBzZXRGaWx0ZXJBY3RpdmUobWFya3VwLCBsaW5rLCBhY3RpdmUpIHtcbiAgbWFya3VwLmZyZWRNb2RpZmllZEZpbHRlckFjdGl2ZSA9IGFjdGl2ZTtcbiAgbGluay5jbGFzc0xpc3QudG9nZ2xlKFwiaXMtYWN0aXZlXCIsIGFjdGl2ZSk7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUZpbHRlcihtYXJrdXAsIGxpbmssIG1hbmFnZXIpIHtcbiAgaWYgKG1hcmt1cC5mcmVkTW9kaWZpZWRGaWx0ZXJBY3RpdmUpIHtcbiAgICBzZXRGaWx0ZXJBY3RpdmUobWFya3VwLCBsaW5rLCBmYWxzZSk7XG4gICAgLy8gQmV3dXNzdCBuaWNodCBtYXJrdXAuY2xlYXJGaWx0ZXIoKSAtIGRhcyBrbGFwcHQgYWxsZSBTZWt0aW9uZW4genUuXG4gICAgY2xlYXJNb2RpZmllZEZpbHRlcihtYXJrdXApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFp3ZWkgRmlsdGVyIGdsZWljaHplaXRpZyBlcmdcdTAwRTRiZW4gbnVyIFZlcndpcnJ1bmcsIGRlc2hhbGIgd2lyZCBkaWVcbiAgLy8gVGV4dHN1Y2hlIGdlbGVlcnQgKFN0eWxlIFNldHRpbmdzIHNlbGJzdCByXHUwMEU0dW10IGZpbHRlclN0cmluZyBuaWNodCBhdWYpLlxuICBjb25zdCBzZWFyY2ggPSBmaW5kU2VhcmNoSW5wdXQobWFya3VwKTtcbiAgaWYgKHNlYXJjaCkgc2VhcmNoLnZhbHVlID0gXCJcIjtcbiAgbWFya3VwLmZpbHRlclN0cmluZyA9IFwiXCI7XG5cbiAgc2V0RmlsdGVyQWN0aXZlKG1hcmt1cCwgbGluaywgdHJ1ZSk7XG4gIGNvbnN0IGNvdW50ID0gYXBwbHlNb2RpZmllZEZpbHRlcihtYXJrdXAsIG1hbmFnZXIpO1xuICBpZiAoY291bnQgPT09IDApIG5ldyBOb3RpY2UoXCJLZWluZSBTdHlsZSBTZXR0aW5ncyB3ZWljaGVuIHZvbSBTdGFuZGFyZCBhYi5cIik7XG59XG5cbmZ1bmN0aW9uIGluamVjdEJ1dHRvbihtYXJrdXAsIG1hbmFnZXIpIHtcbiAgY29uc3QgY29udGFpbmVyID0gbWFya3VwLmNvbnRhaW5lckVsO1xuICAvLyBPaG5lIEltcG9ydC1MaW5rIHplaWd0IFN0eWxlIFNldHRpbmdzIGdlcmFkZSBrZWluZSBMaXN0ZSAoa2VpbmVcbiAgLy8gS29uZmlndXJhdGlvbiBnZWZ1bmRlbiBvZGVyIG51ciBGZWhsZXJtZWxkdW5nZW4pLlxuICBjb25zdCBpbXBvcnRFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcihcIi5zdHlsZS1zZXR0aW5ncy1pbXBvcnRcIik7XG4gIGlmICghaW1wb3J0RWwpIHJldHVybjtcbiAgY29uc3Qgcm93ID0gaW1wb3J0RWwucGFyZW50RWxlbWVudDtcbiAgaWYgKCFyb3cgfHwgcm93LnF1ZXJ5U2VsZWN0b3IoXCIuXCIgKyBCVVRUT05fQ0xBU1MpKSByZXR1cm47XG5cbiAgLy8gRGVyIEVpbnN0ZWxsdW5ncy1EaWFsb2cgbGVidCBpbiBlaW5lbSBlaWdlbmVuIEZlbnN0ZXIsIGRlc2hhbGIgYmV3dXNzdFxuICAvLyBcdTAwRkNiZXIgZGVzc2VuIGRvY3VtZW50IHN0YXR0IFx1MDBGQ2JlciBPYnNpZGlhbnMgZ2xvYmFsZSBIZWxmZXIgKGNyZWF0ZUVsICYgQ28uXG4gIC8vIGhcdTAwRTRuZ2VuIGFtIEhhdXB0ZmVuc3RlcikuXG4gIGNvbnN0IGxpbmsgPSByb3cub3duZXJEb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcbiAgbGluay5jbGFzc05hbWUgPSBCVVRUT05fQ0xBU1M7XG4gIGxpbmsuaHJlZiA9IFwiI1wiO1xuICBsaW5rLnRleHRDb250ZW50ID0gQlVUVE9OX0xBQkVMO1xuICBsaW5rLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgQlVUVE9OX1RPT0xUSVApO1xuICByb3cuaW5zZXJ0QmVmb3JlKGxpbmssIGltcG9ydEVsKTtcblxuICAvLyBGcmlzY2ggYXVmZ2ViYXV0ZSBMaXN0ZSBpc3QgdW5nZWZpbHRlcnQuXG4gIG1hcmt1cC5mcmVkTW9kaWZpZWRGaWx0ZXJBY3RpdmUgPSBmYWxzZTtcblxuICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZ0KSA9PiB7XG4gICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgdG9nZ2xlRmlsdGVyKG1hcmt1cCwgbGluaywgbWFuYWdlcik7XG4gIH0pO1xuXG4gIC8vIFRpcHB0IGplbWFuZCBpbiBkaWUgU3VjaGUsIFx1MDBGQ2Jlcm5pbW10IHdpZWRlciBTdHlsZSBTZXR0aW5ncycgVGV4dGZpbHRlci5cbiAgZmluZFNlYXJjaElucHV0KG1hcmt1cCk/LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgaWYgKG1hcmt1cC5mcmVkTW9kaWZpZWRGaWx0ZXJBY3RpdmUpIHNldEZpbHRlckFjdGl2ZShtYXJrdXAsIGxpbmssIGZhbHNlKTtcbiAgfSk7XG59XG5cbi8qIC0tLSBFaW5oXHUwMEU0bmdlbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbmZ1bmN0aW9uIGF0dGFjaFRvTWFya3VwKHRhYiwgbWFuYWdlcikge1xuICBjb25zdCBtYXJrdXAgPSB0YWIuc2V0dGluZ3NNYXJrdXA7XG4gIGlmICghbWFya3VwKSByZXR1cm47XG4gIC8vIGdlbmVyYXRlKCkgaXN0IGRlciBlaW5lIFB1bmt0LCBkdXJjaCBkZW4gamVkZXIgQXVmYmF1IGRlciBMaXN0ZSBsXHUwMEU0dWZ0OlxuICAvLyBlcnN0ZXMgQW56ZWlnZW4sIHNldFNldHRpbmdzKCkgdW5kIHJlcmVuZGVyKCkgbmFjaCBJbXBvcnQvUmVzZXQuXG4gIGlmICghbWFya3VwLmZyZWRPcmlnaW5hbEdlbmVyYXRlKSB7XG4gICAgY29uc3Qgb3JpZ2luYWwgPSBtYXJrdXAuZ2VuZXJhdGU7XG4gICAgbWFya3VwLmZyZWRPcmlnaW5hbEdlbmVyYXRlID0gb3JpZ2luYWw7XG4gICAgbWFya3VwLmdlbmVyYXRlID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG9yaWdpbmFsLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgaW5qZWN0QnV0dG9uKHRoaXMsIG1hbmFnZXIpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltGcmVkXSBTdHlsZS1TZXR0aW5ncy1GaWx0ZXI6IEtub3BmIGtvbm50ZSBuaWNodCBlaW5nZWZcdTAwRkNndCB3ZXJkZW5cIiwgZXJyb3IpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9XG4gIGluamVjdEJ1dHRvbihtYXJrdXAsIG1hbmFnZXIpO1xufVxuXG5mdW5jdGlvbiBpbnN0YWxsKHBsdWdpbikge1xuICBjb25zdCBzZXR0aW5nID0gcGx1Z2luLmFwcC5zZXR0aW5nO1xuICBpZiAodHlwZW9mIHNldHRpbmc/Lm9wZW5UYWIgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNvbnNvbGUud2FybihcIltGcmVkXSBTdHlsZS1TZXR0aW5ncy1GaWx0ZXI6IGFwcC5zZXR0aW5nLm9wZW5UYWIgbmljaHQgdmVyZlx1MDBGQ2diYXIsIFx1MDBGQ2JlcnNwcnVuZ2VuLlwiKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IG9yaWdpbmFsT3BlblRhYiA9IHNldHRpbmcub3BlblRhYjtcbiAgbGV0IHBhdGNoZWRUYWIgPSBudWxsO1xuXG4gIGNvbnN0IHBhdGNoZWRPcGVuVGFiID0gZnVuY3Rpb24gKHRhYikge1xuICAgIGNvbnN0IHJlc3VsdCA9IG9yaWdpbmFsT3BlblRhYi5jYWxsKHRoaXMsIHRhYik7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0YWI/LmlkID09PSBTVFlMRV9TRVRUSU5HU19JRCkge1xuICAgICAgICBjb25zdCBtYW5hZ2VyID0gcGx1Z2luLmFwcC5wbHVnaW5zLnBsdWdpbnNbU1RZTEVfU0VUVElOR1NfSURdPy5zZXR0aW5nc01hbmFnZXI7XG4gICAgICAgIGlmIChtYW5hZ2VyKSB7XG4gICAgICAgICAgLy8gb3BlblRhYigpIGhhdCBkaWUgTGlzdGUgXHUwMEZDYmVyIHJlbmRlclRhYigpIHNjaG9uIGF1ZmdlYmF1dCAtIGFsc29cbiAgICAgICAgICAvLyBlcnN0IGRlbiBUYWIgZlx1MDBGQ3Iga1x1MDBGQ25mdGlnZSBkaXNwbGF5KCktQXVmcnVmZSBlcndlaXRlcm4sIGRhbm5cbiAgICAgICAgICAvLyBlaW5tYWwgZGlyZWt0IGVpbmhcdTAwRTRuZ2VuLlxuICAgICAgICAgIGlmICghcGF0Y2hlZFRhYikge1xuICAgICAgICAgICAgcGF0Y2hlZFRhYiA9IHRhYjtcbiAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsRGlzcGxheSA9IHRhYi5kaXNwbGF5O1xuICAgICAgICAgICAgdGFiLmZyZWRPcmlnaW5hbERpc3BsYXkgPSBvcmlnaW5hbERpc3BsYXk7XG4gICAgICAgICAgICB0YWIuZGlzcGxheSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IG9yaWdpbmFsRGlzcGxheS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhdHRhY2hUb01hcmt1cCh0aGlzLCBtYW5hZ2VyKTtcbiAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0ZyZWRdIFN0eWxlLVNldHRpbmdzLUZpbHRlcjogRWluaFx1MDBFNG5nZW4gZmVobGdlc2NobGFnZW5cIiwgZXJyb3IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBkaXNwbGF5ZWQ7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBhdHRhY2hUb01hcmt1cCh0YWIsIG1hbmFnZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbRnJlZF0gU3R5bGUtU2V0dGluZ3MtRmlsdGVyOiBFaW5oXHUwMEU0bmdlbiBmZWhsZ2VzY2hsYWdlblwiLCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG4gIHNldHRpbmcub3BlblRhYiA9IHBhdGNoZWRPcGVuVGFiO1xuXG4gIHJldHVybiAoKSA9PiB7XG4gICAgLy8gTnVyIHp1clx1MDBGQ2NrbmVobWVuLCB3ZW5uIGluIGRlciBad2lzY2hlbnplaXQgbmllbWFuZCBhbmRlcnMgZ2VwYXRjaHQgaGF0LlxuICAgIGlmIChzZXR0aW5nLm9wZW5UYWIgPT09IHBhdGNoZWRPcGVuVGFiKSBzZXR0aW5nLm9wZW5UYWIgPSBvcmlnaW5hbE9wZW5UYWI7XG5cbiAgICBjb25zdCB0YWIgPSBwYXRjaGVkVGFiO1xuICAgIHBhdGNoZWRUYWIgPSBudWxsO1xuICAgIGlmICghdGFiKSByZXR1cm47XG4gICAgaWYgKHRhYi5mcmVkT3JpZ2luYWxEaXNwbGF5KSB7XG4gICAgICB0YWIuZGlzcGxheSA9IHRhYi5mcmVkT3JpZ2luYWxEaXNwbGF5O1xuICAgICAgZGVsZXRlIHRhYi5mcmVkT3JpZ2luYWxEaXNwbGF5O1xuICAgIH1cbiAgICBjb25zdCBtYXJrdXAgPSB0YWIuc2V0dGluZ3NNYXJrdXA7XG4gICAgaWYgKCFtYXJrdXApIHJldHVybjtcbiAgICBpZiAobWFya3VwLmZyZWRPcmlnaW5hbEdlbmVyYXRlKSB7XG4gICAgICBtYXJrdXAuZ2VuZXJhdGUgPSBtYXJrdXAuZnJlZE9yaWdpbmFsR2VuZXJhdGU7XG4gICAgICBkZWxldGUgbWFya3VwLmZyZWRPcmlnaW5hbEdlbmVyYXRlO1xuICAgIH1cbiAgICBtYXJrdXAuY29udGFpbmVyRWw/LnF1ZXJ5U2VsZWN0b3IoXCIuXCIgKyBCVVRUT05fQ0xBU1MpPy5yZW1vdmUoKTtcbiAgICBpZiAobWFya3VwLmZyZWRNb2RpZmllZEZpbHRlckFjdGl2ZSkge1xuICAgICAgbWFya3VwLmZyZWRNb2RpZmllZEZpbHRlckFjdGl2ZSA9IGZhbHNlO1xuICAgICAgY2xlYXJNb2RpZmllZEZpbHRlcihtYXJrdXApO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJTdHlsZVNldHRpbmdzRmlsdGVyKHBsdWdpbikge1xuICBsZXQgdW5pbnN0YWxsID0gbnVsbDtcblxuICBjb25zdCB1cGRhdGUgPSAoKSA9PiB7XG4gICAgY29uc3QgZW5hYmxlZCA9IHBsdWdpbi5zZXR0aW5ncy5zdHlsZVNldHRpbmdzTW9kaWZpZWRGaWx0ZXJFbmFibGVkO1xuICAgIGlmIChlbmFibGVkICYmICF1bmluc3RhbGwpIHVuaW5zdGFsbCA9IGluc3RhbGwocGx1Z2luKTtcbiAgICBlbHNlIGlmICghZW5hYmxlZCAmJiB1bmluc3RhbGwpIHtcbiAgICAgIHVuaW5zdGFsbCgpO1xuICAgICAgdW5pbnN0YWxsID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgdXBkYXRlKCk7XG4gIHBsdWdpbi5yZWdpc3RlcigoKSA9PiB7XG4gICAgdW5pbnN0YWxsPy4oKTtcbiAgICB1bmluc3RhbGwgPSBudWxsO1xuICB9KTtcblxuICByZXR1cm4gdXBkYXRlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgcmVnaXN0ZXJTdHlsZVNldHRpbmdzRmlsdGVyIH07XG4iLCAiY29uc3QgeyBQbHVnaW4gfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcbmNvbnN0IHsgREVGQVVMVF9TRVRUSU5HUywgRnJlZFNldHRpbmdUYWIgfSA9IHJlcXVpcmUoXCIuL3NldHRpbmdzXCIpO1xuY29uc3QgeyByZWdpc3RlckNvbW1hbmRzIH0gPSByZXF1aXJlKFwiLi9jb21tYW5kc1wiKTtcbmNvbnN0IHsgcmVnaXN0ZXJEYXRhYmFzZUZvbGRlcnMgfSA9IHJlcXVpcmUoXCIuL2RhdGFiYXNlLWZvbGRlcnNcIik7XG5jb25zdCB7IHJlZ2lzdGVyUHJvcGVydHlCYWNrbGlua3NMaXZlIH0gPSByZXF1aXJlKFwiLi9wcm9wZXJ0eS1zeW5jXCIpO1xuY29uc3QgeyByZWdpc3Rlck5lc3RlZENoZWNrYm94U3luYyB9ID0gcmVxdWlyZShcIi4vbmVzdGVkLWNoZWNrYm94ZXNcIik7XG5jb25zdCB7IHJlZ2lzdGVySW1wb3J0YW50UGx1Z2lucyB9ID0gcmVxdWlyZShcIi4vaW1wb3J0YW50LXBsdWdpbnNcIik7XG5jb25zdCB7IHJlZ2lzdGVySXRhbGljVW5kZXJzY29yZSB9ID0gcmVxdWlyZShcIi4vaXRhbGljLXVuZGVyc2NvcmVcIik7XG5jb25zdCB7IHJlZ2lzdGVyQmFzZXNIYXNOb3RlLCBoYXNOb3RlQ29udGVudCB9ID0gcmVxdWlyZShcIi4vYmFzZXMtaGFzLW5vdGVcIik7XG5jb25zdCB7IHJlZ2lzdGVyU3R5bGVTZXR0aW5nc0ZpbHRlciB9ID0gcmVxdWlyZShcIi4vc3R5bGUtc2V0dGluZ3MtZmlsdGVyXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIEZyZWRQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICByZWdpc3RlckNvbW1hbmRzKHRoaXMpO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRnJlZFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB0aGlzLnVwZGF0ZURhdGFiYXNlRm9sZGVyU3R5bGUgPSByZWdpc3RlckRhdGFiYXNlRm9sZGVycyh0aGlzKTtcbiAgICB0aGlzLnJ1blByb3BlcnR5QmFja2xpbmtTeW5jID0gcmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUodGhpcyk7XG4gICAgcmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmModGhpcyk7XG4gICAgdGhpcy5yZWZyZXNoSW1wb3J0YW50UGx1Z2luQ29tbWFuZHMgPSByZWdpc3RlckltcG9ydGFudFBsdWdpbnModGhpcyk7XG4gICAgcmVnaXN0ZXJJdGFsaWNVbmRlcnNjb3JlKHRoaXMpO1xuICAgIHRoaXMudXBkYXRlQmFzZXNIYXNOb3RlID0gcmVnaXN0ZXJCYXNlc0hhc05vdGUodGhpcyk7XG4gICAgdGhpcy51cGRhdGVTdHlsZVNldHRpbmdzRmlsdGVyID0gcmVnaXN0ZXJTdHlsZVNldHRpbmdzRmlsdGVyKHRoaXMpO1xuICAgIC8vIEZcdTAwRkNyIGFuZGVyZSBQbHVnaW5zL1NrcmlwdGUgKFRlbXBsYXRlciwgUXVpY2tBZGQsIC4uLik6XG4gICAgLy8gYXBwLnBsdWdpbnMucGx1Z2lucy5mcmVkLmhhc05vdGVDb250ZW50KGZpbGVPZGVyUGZhZCkuIEJld3Vzc3QgdW5hYmhcdTAwRTRuZ2lnXG4gICAgLy8gdm9tIEJhc2VzLVRvZ2dsZSAtIGRlciBzY2hhbHRldCBudXIgZGllIFByb3BlcnR5IGluIEJhc2VzLCBuaWNodCBkaWUgTG9naWsuXG4gICAgdGhpcy5oYXNOb3RlQ29udGVudCA9IChmaWxlT3JQYXRoKSA9PiBoYXNOb3RlQ29udGVudCh0aGlzLmFwcCwgZmlsZU9yUGF0aCk7XG4gIH1cblxuICBvbnVubG9hZCgpIHt9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7QUFBQTtBQUFBLDZCQUFBQSxVQUFBQyxTQUFBO0FBQUEsUUFBTSxFQUFFLG1CQUFtQixPQUFPLElBQUksUUFBUSxVQUFVO0FBVXhELFFBQU0sb0JBQU4sY0FBZ0Msa0JBQWtCO0FBQUEsTUFDaEQsWUFBWSxLQUFLLFdBQVcsU0FBUztBQUNuQyxjQUFNLEdBQUc7QUFDVCxhQUFLLFlBQVk7QUFDakIsYUFBSyxVQUFVO0FBQ2YsYUFBSyxTQUFTO0FBQ2QsYUFBSyxlQUFlLG9CQUFpQjtBQUFBLE1BQ3ZDO0FBQUEsTUFFQSxXQUFXO0FBQ1QsZUFBTyxLQUFLO0FBQUEsTUFDZDtBQUFBLE1BRUEsWUFBWSxVQUFVO0FBQ3BCLGVBQU8sU0FBUztBQUFBLE1BQ2xCO0FB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cnRzIiwgIm1vZHVsZSIsICJyZWdpc3RlckltcG9ydGFudFBsdWdpbnMiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAiREVGQVVMVF9TRVRUSU5HUyIsICJGcmVkU2V0dGluZ1RhYiIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJoaXQiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJDb21tYW5kcyIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJwYXRoIiwgInJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgInJlZ2lzdGVyTmVzdGVkQ2hlY2tib3hTeW5jIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgInJlZ2lzdGVySXRhbGljVW5kZXJzY29yZSIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJoYXNOb3RlQ29udGVudCIsICJyZWdpc3RlckJhc2VzSGFzTm90ZSIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJzdG9yZWQiLCAicmVnaXN0ZXJTdHlsZVNldHRpbmdzRmlsdGVyIl0KfQo=
