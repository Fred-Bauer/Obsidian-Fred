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
      contactsBaseDir: "~KONTAKTE",
      contactsEditOnly: false,
      contactsFilterRelevant: true,
      databaseFoldersEnabled: true,
      databaseFolderPrefix: "~",
      folderNoteClickExtensionEnabled: true,
      databaseFolderCountAtEnd: false,
      reciprocalLinkProperties: ["Familie"],
      propertyBacklinksLiveEnabled: true,
      nestedCheckboxSyncEnabled: false,
      italicUnderscoreEnabled: false,
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
          setting.setDesc("Eigener Befehl je Plugin, um dessen Einstellungen direkt zu \xF6ffnen.");
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
          for (const id of enabledIds) {
            const row = listEl.createDiv({ cls: "fred-important-plugins-row" });
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
          }
        };
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
            "Alle Kontakte landen flach direkt in diesem Ordner (relativ zum Vault-Root). Bestehende Notizen in direkten Unterordnern werden beim Import hierher zusammengef\xFChrt."
          ).addText(
            (text) => text.setValue(this.plugin.settings.contactsBaseDir).onChange(async (value) => {
              this.plugin.settings.contactsBaseDir = value;
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
    var { Notice, parseYaml, stringifyYaml } = require("obsidian");
    var CONTACTS_COLUMNS = [
      "Labels",
      "First Name",
      "Middle Name",
      "Last Name",
      "Birthday",
      "E-mail 1 - Value",
      "Phone 1 - Value",
      "Address 1 - Street",
      "Address 1 - City",
      "Address 1 - Postal Code",
      "Address 1 - Country"
    ];
    var CONTACTS_FIELD_MAPPING = {
      "Labels": "tags",
      "First Name": "Vorname",
      "Middle Name": "Zweitname",
      "Last Name": "Nachname",
      "Birthday": "Geburtstag",
      "Phone 1 - Value": "Handynummer",
      "E-mail 1 - Value": "E-Mail",
      "E-mail 2 - Value": "E-Mail-Alt",
      "Address 1 - Street": "Strasse",
      "Address 1 - Postal Code": "Plz",
      "Address 1 - City": "Stadt",
      "Address 1 - Country": "Nation"
    };
    function joinVaultPath(...parts) {
      return parts.filter((part) => part !== void 0 && part !== "").join("/").replace(/\/+/g, "/").replace(/\/$/, "");
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
      const rows = parseCsv(text);
      if (rows.length === 0) return [];
      const header = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        header.forEach((key, idx) => obj[key] = row[idx] ?? "");
        return obj;
      });
    }
    function processContactRow(row, firstNameColumn = "First Name", lastNameColumn = "Last Name") {
      const firstName = (row[firstNameColumn] || "").trim();
      const lastName = (row[lastNameColumn] || "").trim();
      let baseName;
      if (firstName && lastName) baseName = `${firstName} ${lastName}`;
      else if (firstName || lastName) baseName = firstName || lastName;
      else baseName = "_noname";
      const data = {};
      for (const [key, value] of Object.entries(row)) {
        if (CONTACTS_COLUMNS.includes(key) && value.trim()) {
          data[CONTACTS_FIELD_MAPPING[key] || key] = value.trim();
        }
      }
      return { baseName, data };
    }
    function transformContactFields(data, existingTags, starred) {
      const transformed = { ...data };
      try {
        if ("Geburtstag" in transformed) {
          const geburtstag = transformed.Geburtstag;
          if (geburtstag.startsWith("--")) {
            transformed.Geburtstag = "0001" + geburtstag.slice(1);
          }
        }
        if ("Handynummer" in transformed) {
          let phone = transformed.Handynummer.trim();
          if (phone.includes(" ::: ")) phone = phone.split(" ::: ")[0];
          transformed.Handynummer = phone.replace(/ /g, "").replace(/-/g, "");
        }
        let normalizedExisting = existingTags;
        if (typeof normalizedExisting === "string") normalizedExisting = [normalizedExisting];
        if (!Array.isArray(normalizedExisting)) normalizedExisting = [];
        const hasExisting = normalizedExisting.length > 0;
        if ("tags" in transformed || starred) {
          const newTags = (transformed.tags || "").split(" ::: ").filter((tag) => tag && tag !== "* myContacts" && tag !== "* starred").map((tag) => tag.toLowerCase().replace(/ /g, "_"));
          if (starred) newTags.push("favorit");
          const hasNew = newTags.length > 0;
          if (hasExisting && hasNew) {
            transformed.tags = [.../* @__PURE__ */ new Set([...newTags, ...normalizedExisting])];
          } else if (hasExisting) {
            transformed.tags = [...new Set(normalizedExisting)];
          } else if (hasNew) {
            transformed.tags = newTags;
          } else {
            delete transformed.tags;
          }
        }
      } catch (e) {
        console.error("[Kontakt-Import] Fehler bei der Daten-Transformation:", e);
      }
      return transformed;
    }
    function isStarredContact(rawTags) {
      if (!rawTags) return false;
      return rawTags.split(" ::: ").map((tag) => tag.trim()).includes("* starred");
    }
    async function findExistingContactFile(adapter, baseName, searchDirs) {
      for (const dir of searchDirs) {
        const path = joinVaultPath(dir, `${baseName}.md`);
        if (await adapter.exists(path)) return path;
      }
      return null;
    }
    async function readContactFrontmatter(adapter, path) {
      const raw = await adapter.read(path);
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
      if (!match) return { frontmatter: {}, content: raw };
      return { frontmatter: parseYaml(match[1]) || {}, content: raw.slice(match[0].length) };
    }
    async function writeContactFile(adapter, path, frontmatter, content) {
      const ordered = { TYP: "KONTAKT" };
      if ("aliases" in frontmatter) ordered.aliases = frontmatter.aliases;
      if ("tags" in frontmatter) ordered.tags = frontmatter.tags;
      for (const [key, value] of Object.entries(frontmatter)) {
        if (!(key in ordered)) ordered[key] = value;
      }
      const fileContent = `---
${stringifyYaml(ordered)}---
${content}`;
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir && !await adapter.exists(dir)) await adapter.mkdir(dir);
      await adapter.write(path, fileContent);
    }
    var AUTO_MANAGED_FRONTMATTER_KEYS = /* @__PURE__ */ new Set([
      "cssclasses",
      "TYP",
      "aliases",
      "tags",
      ...Object.values(CONTACTS_FIELD_MAPPING)
    ]);
    function isUntouchedContact(frontmatter, content) {
      if (content.trim().length > 0) return false;
      return Object.keys(frontmatter).every((key) => AUTO_MANAGED_FRONTMATTER_KEYS.has(key));
    }
    async function safeRemoveContactFile(adapter, path) {
      try {
        const trashedToSystem = await adapter.trashSystem(path);
        if (!trashedToSystem) await adapter.trashLocal(path);
      } catch (e) {
        await adapter.remove(path);
      }
    }
    async function importContactsFromCsv(app, settings) {
      const { adapter } = app.vault;
      const csvPath = settings.contactsCsvPath;
      const basisVerzeichnis = settings.contactsBaseDir.replace(/\/$/, "");
      if (!await adapter.exists(csvPath)) {
        new Notice(`Kontakt-Import: Datei nicht gefunden: ${csvPath}`);
        return;
      }
      if (!await adapter.exists(basisVerzeichnis)) {
        new Notice(`Kontakt-Import: Basisverzeichnis nicht gefunden: ${basisVerzeichnis}`);
        return;
      }
      const { folders } = await adapter.list(basisVerzeichnis);
      const searchDirs = [basisVerzeichnis, ...folders.sort()];
      const rows = csvToObjects(await adapter.read(csvPath));
      let created = 0;
      let updated = 0;
      let moved = 0;
      let skipped = 0;
      let errors = 0;
      for (const row of rows) {
        try {
          const { baseName, data: rawData } = processContactRow(row);
          const starred = isStarredContact(rawData.tags);
          const existingFile = await findExistingContactFile(adapter, baseName, searchDirs);
          if (existingFile) {
            const { frontmatter: existingFrontmatter, content } = await readContactFrontmatter(adapter, existingFile);
            const newData = transformContactFields(rawData, existingFrontmatter.tags, starred);
            if (settings.contactsFilterRelevant && !newData.Geburtstag && (!newData.tags || newData.tags.length < 1)) {
              skipped++;
              continue;
            }
            const updatedFrontmatter = { ...existingFrontmatter, ...newData };
            const targetPath = joinVaultPath(basisVerzeichnis, `${baseName}.md`);
            await writeContactFile(adapter, targetPath, updatedFrontmatter, content);
            if (targetPath !== existingFile) {
              await safeRemoveContactFile(adapter, existingFile);
              moved++;
            } else {
              updated++;
            }
          } else if (!settings.contactsEditOnly) {
            const newData = transformContactFields(rawData, void 0, starred);
            if (settings.contactsFilterRelevant && !newData.Geburtstag && (!newData.tags || newData.tags.length < 1)) {
              skipped++;
              continue;
            }
            const newPath = joinVaultPath(basisVerzeichnis, `${baseName}.md`);
            await writeContactFile(adapter, newPath, newData, "");
            created++;
          }
        } catch (e) {
          errors++;
          console.error("[Kontakt-Import] Fehler bei Kontakt-Zeile:", row, e);
        }
      }
      const summary = `Kontakt-Import: ${created} neu, ${updated} aktualisiert, ${moved} aus Unterordnern zusammengef\xFChrt, ${skipped} \xFCbersprungen${errors ? `, ${errors} Fehler (siehe Konsole)` : ""}.`;
      console.log("[Kontakt-Import]", summary);
      new Notice(summary);
    }
    async function deleteUntouchedContacts(app, settings) {
      const { adapter } = app.vault;
      const basisVerzeichnis = settings.contactsBaseDir.replace(/\/$/, "");
      if (!await adapter.exists(basisVerzeichnis)) {
        new Notice(`Kontakt-Import: Basisverzeichnis nicht gefunden: ${basisVerzeichnis}`);
        return;
      }
      const contactFiles = app.vault.getMarkdownFiles().filter((file) => file.path === basisVerzeichnis || file.path.startsWith(basisVerzeichnis + "/")).filter((file) => app.metadataCache.getFileCache(file)?.frontmatter?.TYP === "KONTAKT");
      let deleted = 0;
      let errors = 0;
      for (const file of contactFiles) {
        try {
          const { frontmatter, content } = await readContactFrontmatter(adapter, file.path);
          if (!isUntouchedContact(frontmatter, content)) continue;
          await safeRemoveContactFile(adapter, file.path);
          console.log(`[Kontakt-Import] Unver\xE4nderter Kontakt gel\xF6scht: ${file.path}`);
          deleted++;
        } catch (e) {
          errors++;
          console.error("[Kontakt-Import] Fehler beim Pr\xFCfen/L\xF6schen:", file.path, e);
        }
      }
      const summary = `Kontakt-Import: ${contactFiles.length} gepr\xFCft, ${deleted} unver\xE4nderte gel\xF6scht${errors ? `, ${errors} Fehler (siehe Konsole)` : ""}.`;
      console.log("[Kontakt-Import]", summary);
      new Notice(summary);
    }
    module2.exports = { importContactsFromCsv, deleteUntouchedContacts };
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
            await addLinkToProperty(app, propertyName, targetFile, sourceFile);
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
    async function syncAllLinks(app, propertyNames, previousPairs) {
      const files = app.vault.getMarkdownFiles();
      console.log(`[Property-Backlinking] Pr\xFCfe ${files.length} Notizen f\xFCr Properties: ${propertyNames.join(", ")}`);
      const currentPairs = computeDeclaredPairs(app, propertyNames, files);
      const { added, removed } = await applyChanges(app, propertyNames, previousPairs, currentPairs);
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
        callback: () => importContactsFromCsv(plugin.app, plugin.settings)
      });
      plugin.addCommand({
        id: "kontakte-unveraendert-loeschen",
        name: "KONTAKTE - Unver\xE4nderte Kontakte l\xF6schen",
        callback: () => deleteUntouchedContacts(plugin.app, plugin.settings)
      });
      plugin.addCommand({
        id: "property-sync",
        name: "Property-Backlinking - Aktualisieren",
        callback: async () => {
          const result = await syncAllLinks(plugin.app, plugin.settings.reciprocalLinkProperties, plugin.settings.declaredLinkPairs);
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

// src/main.js
var { Plugin } = require("obsidian");
var { DEFAULT_SETTINGS, FredSettingTab } = require_settings();
var { registerCommands } = require_commands();
var { registerDatabaseFolders } = require_database_folders();
var { registerPropertyBacklinksLive } = require_property_sync();
var { registerNestedCheckboxSync } = require_nested_checkboxes();
var { registerImportantPlugins } = require_important_plugins();
var { registerItalicUnderscore } = require_italic_underscore();
module.exports = class FredPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.addSettingTab(new FredSettingTab(this.app, this));
    this.updateDatabaseFolderStyle = registerDatabaseFolders(this);
    registerPropertyBacklinksLive(this);
    registerNestedCheckboxSync(this);
    this.refreshImportantPluginCommands = registerImportantPlugins(this);
    registerItalicUnderscore(this);
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
