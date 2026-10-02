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
  // Ruft Obsidian auf, wenn data.json von außen geändert wurde - in der Praxis
  // durch Obsidian Sync von einem anderen Gerät. Ohne das behielte dieses Gerät
  // seine alten Settings im Speicher und überschriebe die neuen beim nächsten
  // saveSettings(). Einen offenen Settings-Tab baut Obsidian danach selbst neu
  // auf (settingTab.update()).
  async onExternalSettingsChange() {
    const { declaredLinkPairs } = this.settings;
    await this.loadSettings();
    this.settings.declaredLinkPairs = declaredLinkPairs;
    this.updateDatabaseFolderStyle();
    this.updateBasesHasNote();
    this.updateStyleSettingsFilter();
    this.refreshImportantPluginCommands();
  }
};
