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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL2ltcG9ydGFudC1wbHVnaW5zLmpzIiwgInNyYy9zZXR0aW5ncy5qcyIsICJzcmMva29udGFrdC1pbXBvcnQuanMiLCAic3JjL3Byb3BlcnR5LXN5bmMuanMiLCAic3JjL2NvbW1hbmRzLmpzIiwgInNyYy9kYXRhYmFzZS1mb2xkZXJzLmpzIiwgInNyYy9uZXN0ZWQtY2hlY2tib3hlcy5qcyIsICJzcmMvaXRhbGljLXVuZGVyc2NvcmUuanMiLCAic3JjL21haW4uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IHsgRnV6enlTdWdnZXN0TW9kYWwsIE5vdGljZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vLyBHZW5lcmlzY2hlciBQaWNrZXI6IHdcdTAwRTRobHQgYXVzIGVpbmVyIE1hbmlmZXN0LUxpc3RlIGVpbnMgYXVzLCBsXHUwMEY2c3QgbWl0XG4vLyBkZXNzZW4gSUQgb2RlciBudWxsIChBYmJydWNoKSBhdWYgLSBnZW51dHp0IHNvd29obCB6dW0gSGluenVmXHUwMEZDZ2VuIGVpbmVzXG4vLyBQbHVnaW5zIGluIGRlbiBFaW5zdGVsbHVuZ2VuIChzZXR0aW5ncy5qcykgYWxzIGF1Y2ggdm9tIFNhbW1lbGJlZmVobCB1bnRlbi5cbi8vIEdsZWljaGVyIEF1ZmJhdSB3aWUgVHlwUGlja2VyTW9kYWwgKHR5cGUtcGlja2VyLmpzKSwgaW5rbC4gZGVzc2VsYmVuXG4vLyBzZWxlY3RTdWdnZXN0aW9uKCkvb25DaG9vc2VJdGVtKCktS29tbWVudGFycyBkb3J0OiBPYnNpZGlhbnMgU3VnZ2VzdE1vZGFsXG4vLyBydWZ0IGludGVybiBlcnN0IGNsb3NlKCkgdW5kIGRhbmFjaCBlcnN0IG9uQ2hvb3NlSXRlbSgpIGF1ZiAtIFwiY2hvc2VuXCJcbi8vIG11c3MgZGVzaGFsYiBzY2hvbiBpbiBzZWxlY3RTdWdnZXN0aW9uKCkgZ2VzZXR6dCB3ZXJkZW4sIHNvbnN0IGxcdTAwRjZzdCBkYXMgdm9uXG4vLyBjbG9zZSgpIGF1c2dlbFx1MDBGNnN0ZSBvbkNsb3NlKCkgZGFzIFByb21pc2UgZlx1MDBFNGxzY2hsaWNoIHp1ZXJzdCBtaXQgbnVsbCBhdWYuXG5jbGFzcyBQbHVnaW5QaWNrZXJNb2RhbCBleHRlbmRzIEZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCBtYW5pZmVzdHMsIHJlc29sdmUpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMubWFuaWZlc3RzID0gbWFuaWZlc3RzO1xuICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgdGhpcy5jaG9zZW4gPSBmYWxzZTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiRVNDIGZcdTAwRkNyIEFiYnJ1Y2hcIik7XG4gIH1cblxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5tYW5pZmVzdHM7XG4gIH1cblxuICBnZXRJdGVtVGV4dChtYW5pZmVzdCkge1xuICAgIHJldHVybiBtYW5pZmVzdC5uYW1lO1xuICB9XG5cbiAgc2VsZWN0U3VnZ2VzdGlvbihpdGVtLCBldnQpIHtcbiAgICB0aGlzLmNob3NlbiA9IHRydWU7XG4gICAgc3VwZXIuc2VsZWN0U3VnZ2VzdGlvbihpdGVtLCBldnQpO1xuICB9XG5cbiAgb25DaG9vc2VJdGVtKG1hbmlmZXN0KSB7XG4gICAgdGhpcy5yZXNvbHZlKG1hbmlmZXN0LmlkKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKSB7XG4gICAgc3VwZXIub25DbG9zZSgpO1xuICAgIGlmICghdGhpcy5jaG9zZW4pIHRoaXMucmVzb2x2ZShudWxsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0VuYWJsZWQoYXBwLCBpZCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFwcC5wbHVnaW5zLnBsdWdpbnMsIGlkKTtcbn1cblxuLy8gQWxzIFwid2ljaHRpZ1wiIG1hcmtpZXJ0ZSBQbHVnaW5zIChzZXR0aW5ncy5qcywgR2VuZXJlbGwgLT4gSW1wb3J0YW50IFBsdWdpblxuLy8gU2V0dGluZ3MpLCBnZWZpbHRlcnQgYXVmIGFrdHVlbGwgYWt0aXZpZXJ0ZSAtIEdydW5kbGFnZSBzb3dvaGwgZlx1MDBGQ3IgZGllXG4vLyBFaW56ZWxiZWZlaGxlIGFscyBhdWNoIGRlbiBTYW1tZWxiZWZlaGwuIEVpbiBkZWFrdGl2aWVydGVzIFBsdWdpbiBoYXQga2VpbmVcbi8vIG9mZmVuZSBTZXR0aW5ncy1UYWIgKE9ic2lkaWFuIGVudGxcdTAwRTRkdCBzaWUgbWl0IGRlbSBQbHVnaW4pLCBlaW4gQmVmZWhsIGRhZlx1MDBGQ3Jcbi8vIHdcdTAwRTRyZSBhbHNvIG9obmVoaW4gd2lya3VuZ3Nsb3MuXG5mdW5jdGlvbiBlbmFibGVkSW1wb3J0YW50TWFuaWZlc3RzKHBsdWdpbikge1xuICByZXR1cm4gcGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnNcbiAgICAuZmlsdGVyKChpZCkgPT4gaXNFbmFibGVkKHBsdWdpbi5hcHAsIGlkKSlcbiAgICAubWFwKChpZCkgPT4gcGx1Z2luLmFwcC5wbHVnaW5zLm1hbmlmZXN0c1tpZF0pXG4gICAgLmZpbHRlcihCb29sZWFuKTtcbn1cblxuZnVuY3Rpb24gb3BlblBsdWdpblNldHRpbmdzKGFwcCwgaWQpIHtcbiAgYXBwLnNldHRpbmcub3BlbigpO1xuICBpZiAoIWFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKGlkKSkgbmV3IE5vdGljZShcIkRpZXNlcyBQbHVnaW4gaGF0IGtlaW5lIGVpZ2VuZW4gRWluc3RlbGx1bmdlbi5cIik7XG59XG5cbi8vIFNhbW1lbGJlZmVobCBcIldpY2h0aWdlcyBQbHVnaW4gLSBFaW5zdGVsbHVuZ2VuIFx1MDBGNmZmbmVuXCI6IGJlaSBnZW5hdSBlaW5lbVxuLy8gbWFya2llcnRlbiAoYWt0aXZpZXJ0ZW4pIFBsdWdpbiBvaG5lIFp3aXNjaGVuc2Nocml0dCwgc29uc3QgXHUwMEZDYmVyIGRlbnNlbGJlblxuLy8gUGlja2VyIHdpZSBiZWltIEhpbnp1Zlx1MDBGQ2dlbiBpbiBkZW4gRWluc3RlbGx1bmdlbi4gRXJnXHUwMEU0bnp0IGRpZSBFaW56ZWxiZWZlaGxlXG4vLyB1bnRlbiwgZXJzZXR6dCBzaWUgbmljaHQgLSBwcmFrdGlzY2gsIHdlbm4gbWFuIGRlbiBOYW1lbiBkZXMgRWluemVsYmVmZWhsc1xuLy8gbmljaHQgaW0gS29wZiBoYXQuXG5hc3luYyBmdW5jdGlvbiBvcGVuSW1wb3J0YW50UGx1Z2luU2V0dGluZ3NQaWNrZXIocGx1Z2luKSB7XG4gIGNvbnN0IG1hbmlmZXN0cyA9IGVuYWJsZWRJbXBvcnRhbnRNYW5pZmVzdHMocGx1Z2luKTtcblxuICBpZiAobWFuaWZlc3RzLmxlbmd0aCA9PT0gMCkge1xuICAgIG5ldyBOb3RpY2UoJ0tlaW5lIHdpY2h0aWdlbiBQbHVnaW5zIGVpbmdldHJhZ2VuIChFaW5zdGVsbHVuZ2VuIC0+IEdlbmVyZWxsIC0+IFwiSW1wb3J0YW50IFBsdWdpbiBTZXR0aW5nc1wiKS4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG1hbmlmZXN0cy5sZW5ndGggPT09IDEpIHtcbiAgICBvcGVuUGx1Z2luU2V0dGluZ3MocGx1Z2luLmFwcCwgbWFuaWZlc3RzWzBdLmlkKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBpZCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBuZXcgUGx1Z2luUGlja2VyTW9kYWwocGx1Z2luLmFwcCwgbWFuaWZlc3RzLCByZXNvbHZlKS5vcGVuKCkpO1xuICBpZiAoaWQpIG9wZW5QbHVnaW5TZXR0aW5ncyhwbHVnaW4uYXBwLCBpZCk7XG59XG5cbi8vIEVpbiBlaWdlbmVyIEJlZmVobCBqZSBtYXJraWVydGVtIChha3RpdmllcnRlbSkgUGx1Z2luLiBPYnNpZGlhbnMgQ29tbWFuZHMtXG4vLyBSZWdpc3RyeSBlcmxhdWJ0IGFkZENvbW1hbmQoKS9yZW1vdmVDb21tYW5kKCkgamVkZXJ6ZWl0LCBuaWNodCBudXIgYmVpbVxuLy8gUGx1Z2luLVN0YXJ0IC0gaGllciBkZXNoYWxiIGJlaSBqZWRlciBcdTAwQzRuZGVydW5nIGRlciBMaXN0ZSAoRWluc3RlbGx1bmdlbilcbi8vIHNvd2llIGJlaSBqZWRlciBQbHVnaW4tQWt0aXZpZXJ1bmcvLURlYWt0aXZpZXJ1bmcgbmV1IG1pdCBkZW0gSXN0LVp1c3RhbmRcbi8vIGFiZ2VnbGljaGVuLCBzdGF0dCBkaWUgQmVmZWhsZSBlaW5tYWxpZyBmaXggenUgcmVnaXN0cmllcmVuLlxuY29uc3QgcmVnaXN0ZXJlZENvbW1hbmRJZHMgPSBuZXcgU2V0KCk7XG5cbmZ1bmN0aW9uIGNvbW1hbmRJZEZvcihwbHVnaW5JZCkge1xuICByZXR1cm4gYG9wZW4tJHtwbHVnaW5JZH0tc2V0dGluZ3NgO1xufVxuXG5mdW5jdGlvbiByZWZyZXNoUGVyUGx1Z2luQ29tbWFuZHMocGx1Z2luKSB7XG4gIGNvbnN0IGRlc2lyZWQgPSBuZXcgTWFwKGVuYWJsZWRJbXBvcnRhbnRNYW5pZmVzdHMocGx1Z2luKS5tYXAoKG1hbmlmZXN0KSA9PiBbY29tbWFuZElkRm9yKG1hbmlmZXN0LmlkKSwgbWFuaWZlc3RdKSk7XG5cbiAgZm9yIChjb25zdCBpZCBvZiByZWdpc3RlcmVkQ29tbWFuZElkcykge1xuICAgIGlmIChkZXNpcmVkLmhhcyhpZCkpIGNvbnRpbnVlO1xuICAgIHBsdWdpbi5hcHAuY29tbWFuZHMucmVtb3ZlQ29tbWFuZChgJHtwbHVnaW4ubWFuaWZlc3QuaWR9OiR7aWR9YCk7XG4gICAgcmVnaXN0ZXJlZENvbW1hbmRJZHMuZGVsZXRlKGlkKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgW2lkLCBtYW5pZmVzdF0gb2YgZGVzaXJlZCkge1xuICAgIGlmIChyZWdpc3RlcmVkQ29tbWFuZElkcy5oYXMoaWQpKSBjb250aW51ZTtcbiAgICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZCxcbiAgICAgIG5hbWU6IGBPcGVuICR7bWFuaWZlc3QubmFtZX0gU2V0dGluZ3NgLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IG9wZW5QbHVnaW5TZXR0aW5ncyhwbHVnaW4uYXBwLCBtYW5pZmVzdC5pZCksXG4gICAgfSk7XG4gICAgcmVnaXN0ZXJlZENvbW1hbmRJZHMuYWRkKGlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3RlckltcG9ydGFudFBsdWdpbnMocGx1Z2luKSB7XG4gIGNvbnN0IHJlZnJlc2ggPSAoKSA9PiByZWZyZXNoUGVyUGx1Z2luQ29tbWFuZHMocGx1Z2luKTtcblxuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnBsdWdpbnMub24oXCJjaGFuZ2VkXCIsIHJlZnJlc2gpKTtcbiAgcGx1Z2luLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeShyZWZyZXNoKTtcblxuICByZXR1cm4gcmVmcmVzaDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVySW1wb3J0YW50UGx1Z2lucywgb3BlbkltcG9ydGFudFBsdWdpblNldHRpbmdzUGlja2VyLCBQbHVnaW5QaWNrZXJNb2RhbCwgZW5hYmxlZEltcG9ydGFudE1hbmlmZXN0cyB9O1xuIiwgImNvbnN0IHsgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZ0dyb3VwLCBOb3RpY2UsIHNldEljb24gfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcbmNvbnN0IHsgUGx1Z2luUGlja2VyTW9kYWwgfSA9IHJlcXVpcmUoXCIuL2ltcG9ydGFudC1wbHVnaW5zXCIpO1xuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTID0ge1xuICBjb250YWN0c0NzdlBhdGg6IFwiX29ic2lkaWFuL2RhdGEvY29udGFjdHMuY3N2XCIsXG4gIGNvbnRhY3RzQmFzZURpcjogXCJ+S09OVEFLVEVcIixcbiAgY29udGFjdHNFZGl0T25seTogZmFsc2UsXG4gIGNvbnRhY3RzRmlsdGVyUmVsZXZhbnQ6IHRydWUsXG4gIGRhdGFiYXNlRm9sZGVyc0VuYWJsZWQ6IHRydWUsXG4gIGRhdGFiYXNlRm9sZGVyUHJlZml4OiBcIn5cIixcbiAgZm9sZGVyTm90ZUNsaWNrRXh0ZW5zaW9uRW5hYmxlZDogdHJ1ZSxcbiAgZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kOiBmYWxzZSxcbiAgcmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzOiBbXCJGYW1pbGllXCJdLFxuICBwcm9wZXJ0eUJhY2tsaW5rc0xpdmVFbmFibGVkOiB0cnVlLFxuICBuZXN0ZWRDaGVja2JveFN5bmNFbmFibGVkOiBmYWxzZSxcbiAgaXRhbGljVW5kZXJzY29yZUVuYWJsZWQ6IGZhbHNlLFxuICBkZWNsYXJlZExpbmtQYWlyczoge30sXG4gIC8vIFNpZWhlIGltcG9ydGFudC1wbHVnaW5zLmpzOiBha3RpdmllcnRlIFBsdWdpbi1JRHMsIGZcdTAwRkNyIGRpZSBhdXRvbWF0aXNjaFxuICAvLyBqZSBlaW4gZWlnZW5lciBcIkVpbnN0ZWxsdW5nZW4gXHUwMEY2ZmZuZW5cIi1CZWZlaGwgZW50c3RlaHQuXG4gIGltcG9ydGFudFBsdWdpbnM6IFtdLFxufTtcblxuY29uc3QgVEFCUyA9IFtcbiAgeyBpZDogXCJnZW5lcmFsXCIsIGxhYmVsOiBcIkdlbmVyZWxsXCIgfSxcbiAgeyBpZDogXCJrb250YWt0ZVwiLCBsYWJlbDogXCJLT05UQUtURVwiIH0sXG4gIHsgaWQ6IFwibWVkaWFcIiwgbGFiZWw6IFwiTUVESUFcIiB9LFxuXTtcblxuY2xhc3MgRnJlZFNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgdGhpcy5hY3RpdmVUYWIgPSBUQUJTWzBdLmlkO1xuICB9XG5cbiAgZGlzcGxheSgpIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBjb25zdCB0YWJCYXIgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZnJlZC1zZXR0aW5ncy10YWJzXCIgfSk7XG4gICAgZm9yIChjb25zdCB0YWIgb2YgVEFCUykge1xuICAgICAgY29uc3QgYnRuID0gdGFiQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgdGV4dDogdGFiLmxhYmVsLFxuICAgICAgICBjbHM6IFwiZnJlZC1zZXR0aW5ncy10YWJcIiArICh0aGlzLmFjdGl2ZVRhYiA9PT0gdGFiLmlkID8gXCIgaXMtYWN0aXZlXCIgOiBcIlwiKSxcbiAgICAgIH0pO1xuICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuYWN0aXZlVGFiID0gdGFiLmlkO1xuICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnQgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZnJlZC1zZXR0aW5ncy1jb250ZW50XCIgfSk7XG4gICAgaWYgKHRoaXMuYWN0aXZlVGFiID09PSBcImdlbmVyYWxcIikgdGhpcy5kaXNwbGF5R2VuZXJhbFRhYihjb250ZW50KTtcbiAgICBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCJrb250YWt0ZVwiKSB0aGlzLmRpc3BsYXlLb250YWt0ZVRhYihjb250ZW50KTtcbiAgICBlbHNlIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCJtZWRpYVwiKSB0aGlzLmRpc3BsYXlNZWRpYVRhYihjb250ZW50KTtcbiAgfVxuXG4gIC8vIEplZGVyIEFic2Nobml0dCBpc3QgZWluZSBTZXR0aW5nR3JvdXAgLSBPYnNpZGlhbnMgZWlnZW5lIEdydXBwaWVydW5nXG4gIC8vIChcdTAwRENiZXJzY2hyaWZ0ICsgZWluZSBCb3gsIEVpbnRyXHUwMEU0Z2UgZGFyaW4gZHVyY2ggVHJlbm5saW5pZW4gZ2V0cmVubnQpLCB3aWVcbiAgLy8gaW4gZGVuIENvcmUtRWluc3RlbGx1bmdlbi4gRWluemVsbiBwZXIgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpIGFuZ2VsZWd0ZVxuICAvLyBFaW50clx1MDBFNGdlIHdcdTAwRkNyZGVuIHN0YXR0ZGVzc2VuIGplIGFscyBlaWdlbmUga2xlaW5lIEJveCBnZXJlbmRlcnQuXG4gIGRpc3BsYXlHZW5lcmFsVGFiKGNvbnRhaW5lckVsKSB7XG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiRGF0ZW5iYW5rLU9yZG5lclwiKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIlByXHUwMEU0Zml4LU9yZG5lciBhbHMgRGF0ZW5iYW5rIGJlaGFuZGVsblwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiT3JkbmVyLCBkZXJlbiBOYW1lIG1pdCBkZW0gUHJcdTAwRTRmaXggYmVnaW5udCwgc2luZCBpbSBEYXRlaWJhdW0gbmljaHQgbWVociBhdWYtL3p1a2xhcHBiYXIuXCIpXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi51cGRhdGVEYXRhYmFzZUZvbGRlclN0eWxlPy4oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIlByXHUwMEU0Zml4XCIpXG4gICAgICAgICAgLnNldERlc2MoXCJPcmRuZXJuYW1lbiwgZGllIG1pdCBkaWVzZW0gWmVpY2hlbi9UZXh0IGJlZ2lubmVuLCBnZWx0ZW4gYWxzIERhdGVuYmFuay1PcmRuZXIuXCIpXG4gICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXggPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnVwZGF0ZURhdGFiYXNlRm9sZGVyU3R5bGU/LigpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiRm9sZGVyLU5vdGVzLUVyd2VpdGVydW5nOiBnZXNhbXRlIFplaWxlIGtsaWNrYmFyXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIkJlaSBEYXRlbmJhbmstT3JkbmVybiBcdTAwRjZmZm5ldCBlaW4gS2xpY2sgaXJnZW5kd28gaW4gZGVyIFRpdGVsemVpbGUgKG5pY2h0IG51ciBhdWYgZGVtIE5hbWVuKSBkaWUgenVnZWhcdTAwRjZyaWdlIEZvbGRlci1Ob3RlLCBzb2Zlcm4gZGFzIEZvbGRlci1Ob3Rlcy1QbHVnaW4gZ2VudXR6dCB3aXJkLlwiXG4gICAgICAgICAgKVxuICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJOb3RlQ2xpY2tFeHRlbnNpb25FbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9sZGVyTm90ZUNsaWNrRXh0ZW5zaW9uRW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4udXBkYXRlRGF0YWJhc2VGb2xkZXJTdHlsZT8uKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJBbnphaGwgYW0gWmVpbGVuZW5kZSBhbnplaWdlblwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiWmVpZ3QgZGllIC5tZC1EYXRlaS1BbnphaGwgc3RhdHQgYW4gU3RlbGxlIGRlcyBQZmVpbHMgYW0gWmVpbGVuZW5kZSBhbiwgd2llIHNvbnN0IGRpZSBEYXRlaWVuZHVuZy5cIilcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi51cGRhdGVEYXRhYmFzZUZvbGRlclN0eWxlPy4oKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nR3JvdXAoY29udGFpbmVyRWwpXG4gICAgICAuc2V0SGVhZGluZyhcIlByb3BlcnR5LUJhY2tsaW5raW5nXCIpXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiUHJvcGVydGllc1wiKVxuICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgXCJLb21tYWdldHJlbm50ZSBMaXN0ZSB2b24gRnJvbnRtYXR0ZXItUHJvcGVydGllcyBtaXQgTGlua3MgenUgYW5kZXJlbiBOb3RpemVuICh6LiBCLiBGYW1pbGllLCBGcmV1bmRlKSAtIGdpbHQgZlx1MDBGQ3IgYWxsZSBOb3RpemVuLCB1bmFiaFx1MDBFNG5naWcgdm9tIFRZUC4gVmVybGlua3QgZWluZSBOb3RpeiBoaWVyIGVpbmUgYW5kZXJlLCBiZWtvbW10IGRpZSBhbmRlcmUgYXV0b21hdGlzY2ggZGVuIEJhY2tsaW5rIGluIGRlcnNlbGJlbiBQcm9wZXJ0eSBlcmdcdTAwRTRuenQgLSB1bmQgd2llZGVyIGVudGZlcm50LCBzb2JhbGQgZGllIFZlcmxpbmt1bmcgd2VnZlx1MDBFNGxsdC4gR3JvXHUwMERGLS9LbGVpbnNjaHJlaWJ1bmcgbXVzcyBleGFrdCB6dW0gUHJvcGVydHktTmFtZW4gcGFzc2VuLlwiXG4gICAgICAgICAgKVxuICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzLmpvaW4oXCIsIFwiKSlcbiAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnJlY2lwcm9jYWxMaW5rUHJvcGVydGllcyA9IHZhbHVlXG4gICAgICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAgICAgICAgICAgICAubWFwKChuYW1lKSA9PiBuYW1lLnRyaW0oKSlcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKG5hbWUpID0+IG5hbWUubGVuZ3RoID4gMCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIkxpdmUgYWt0dWFsaXNpZXJlblwiKVxuICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgXCJQcm9wZXJ0eS1CYWNrbGlua2luZyBzb2ZvcnQgYmVpbSBTcGVpY2hlcm4gYWJnbGVpY2hlbiwgc3RhdHQgbnVyIGF1ZiBCZWZlaGwgKFxcXCJQcm9wZXJ0eS1CYWNrbGlua2luZyBha3R1YWxpc2llcmVuXFxcIikuXCJcbiAgICAgICAgICApXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzTGl2ZUVuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm9wZXJ0eUJhY2tsaW5rc0xpdmVFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiQ2hlY2tsaXN0ZW5cIilcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJWZXJzY2hhY2h0ZWx0ZSBDaGVja2JveGVuIG1pdCB1bXNjaGFsdGVuXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIkJlaW0gKEVudClIYWtlbiBlaW5lciBDaGVja2JveCB3ZXJkZW4gYWxsZSBkYXJ1bnRlciB2ZXJzY2hhY2h0ZWx0ZW4gQ2hlY2tib3hlbiBhdXRvbWF0aXNjaCBtaXQgKGVudCloYWt0IC0gdW5kIHVtZ2VrZWhydDogc2luZCBhbGxlIENoZWNrYm94ZW4gZWluZXIgVW50ZXJsaXN0ZSBhbmdlaGFrdCwgd2lyZCBkaWUgXHUwMEZDYmVyZ2VvcmRuZXRlIENoZWNrYm94IGF1dG9tYXRpc2NoIG1pdCBhbmdlaGFrdCwgdW5kIHdpZWRlciBlbnRmZXJudCwgc29iYWxkIGVpbmUgZGF2b24gd2llZGVyIGFiZ2VoYWt0IHdpcmQuXCJcbiAgICAgICAgICApXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5uZXN0ZWRDaGVja2JveFN5bmNFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiRm9ybWF0aWVydW5nXCIpXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiS3Vyc2l2IG1pdCBVbnRlcnN0cmljaGVuXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICAnRGVyIEJlZmVobCBcIkt1cnNpdiB1bXNjaGFsdGVuXCIgc2V0enQgYmVpbSBFaW5mXHUwMEZDZ2VuIFVudGVyc3RyaWNoZSAoX1RleHRfKSBzdGF0dCBTdGVybmNoZW4gKCpUZXh0KikgdW0gZGllIEF1c3dhaGwuIEJlcmVpdHMgdm9yaGFuZGVuZSBLdXJzaXZmb3JtYXRpZXJ1bmcgKG1pdCAqIG9kZXIgXykgd2lyZCBiZWltIGVybmV1dGVuIFVtc2NoYWx0ZW4gd2VpdGVyaGluIGtvcnJla3QgZXJrYW5udCB1bmQgZW50ZmVybnQuJ1xuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaXRhbGljVW5kZXJzY29yZUVuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGFsaWNVbmRlcnNjb3JlRW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKTtcblxuICAgIC8vIFwiK1wiLUJ1dHRvbiBhbHMgRXh0cmEtQnV0dG9uIGltIEdydXBwZW4tSGVhZGVyICh3aWUgei4gQi4gYmVpIE9ic2lkaWFuc1xuICAgIC8vIEhvdGtleS1HcnVwcGUpLCBkaWUgTGlzdGUgc2VsYnN0IGluIGVpbmVtIGVpbnppZ2VuIEVpbnRyYWcgZGVyIEdydXBwZVxuICAgIC8vIHVudGVyIGRlc3NlbiBCZXNjaHJlaWJ1bmcuXG4gICAgbGV0IGxpc3RFbDtcbiAgICBuZXcgU2V0dGluZ0dyb3VwKGNvbnRhaW5lckVsKVxuICAgICAgLnNldEhlYWRpbmcoXCJJbXBvcnRhbnQgUGx1Z2luIFNldHRpbmdzXCIpXG4gICAgICAuYWRkRXh0cmFCdXR0b24oKGJ1dHRvbikgPT5cbiAgICAgICAgYnV0dG9uXG4gICAgICAgICAgLnNldEljb24oXCJwbHVzXCIpXG4gICAgICAgICAgLnNldFRvb2x0aXAoXCJQbHVnaW4gaGluenVmXHUwMEZDZ2VuXCIpXG4gICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWFuaWZlc3RzID0gdGhpcy5wbHVnaW4uYXBwLnBsdWdpbnMubWFuaWZlc3RzO1xuICAgICAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IE9iamVjdC5rZXlzKHRoaXMucGx1Z2luLmFwcC5wbHVnaW5zLnBsdWdpbnMpXG4gICAgICAgICAgICAgIC5maWx0ZXIoKGlkKSA9PiBtYW5pZmVzdHNbaWRdICYmICF0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbXBvcnRhbnRQbHVnaW5zLmluY2x1ZGVzKGlkKSlcbiAgICAgICAgICAgICAgLm1hcCgoaWQpID0+IG1hbmlmZXN0c1tpZF0pXG4gICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcblxuICAgICAgICAgICAgaWYgKGNhbmRpZGF0ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJLZWluZSB3ZWl0ZXJlbiBha3RpdmllcnRlbiBQbHVnaW5zIHZlcmZcdTAwRkNnYmFyLlwiKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXcgUGx1Z2luUGlja2VyTW9kYWwodGhpcy5wbHVnaW4uYXBwLCBjYW5kaWRhdGVzLCBhc3luYyAoaWQpID0+IHtcbiAgICAgICAgICAgICAgaWYgKCFpZCkgcmV0dXJuO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbXBvcnRhbnRQbHVnaW5zLnB1c2goaWQpO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEltcG9ydGFudFBsdWdpbkNvbW1hbmRzPy4oKTtcbiAgICAgICAgICAgICAgcmVuZGVySW1wb3J0YW50UGx1Z2luc0xpc3QoKTtcbiAgICAgICAgICAgIH0pLm9wZW4oKTtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+IHtcbiAgICAgICAgc2V0dGluZy5zZXREZXNjKFwiRWlnZW5lciBCZWZlaGwgamUgUGx1Z2luLCB1bSBkZXNzZW4gRWluc3RlbGx1bmdlbiBkaXJla3QgenUgXHUwMEY2ZmZuZW4uXCIpO1xuICAgICAgICBsaXN0RWwgPSBzZXR0aW5nLmluZm9FbC5jcmVhdGVEaXYoeyBjbHM6IFwiZnJlZC1pbXBvcnRhbnQtcGx1Z2lucy1saXN0XCIgfSk7XG4gICAgICB9KTtcblxuICAgIGNvbnN0IHJlbmRlckltcG9ydGFudFBsdWdpbnNMaXN0ID0gKCkgPT4ge1xuICAgICAgbGlzdEVsLmVtcHR5KCk7XG4gICAgICBjb25zdCBtYW5pZmVzdHMgPSB0aGlzLnBsdWdpbi5hcHAucGx1Z2lucy5tYW5pZmVzdHM7XG4gICAgICAvLyBOdXIgYWt0aXZpZXJ0ZSBFaW50clx1MDBFNGdlIC0gZWluIGRlYWt0aXZpZXJ0ZXMgUGx1Z2luIGhhdCBrZWluZSBlaWdlbmVcbiAgICAgIC8vIFNldHRpbmdzLVRhYiwgZWluIEJlZmVobCBkYWZcdTAwRkNyIHdcdTAwRTRyZSB3aXJrdW5nc2xvcyAoc2llaGUgaW1wb3J0YW50LXBsdWdpbnMuanMpLlxuICAgICAgY29uc3QgZW5hYmxlZElkcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnMuZmlsdGVyKFxuICAgICAgICAoaWQpID0+IG1hbmlmZXN0c1tpZF0gJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMucGx1Z2luLmFwcC5wbHVnaW5zLnBsdWdpbnMsIGlkKVxuICAgICAgKTtcblxuICAgICAgaWYgKGVuYWJsZWRJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwic2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uXCIsIHRleHQ6IFwiS2VpbmUgd2ljaHRpZ2VuIFBsdWdpbnMgZWluZ2V0cmFnZW4uXCIgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gQmV3dXNzdCBrZWluIGVpZ2VuZXIgU2V0dGluZy1FaW50cmFnIGplIFplaWxlIC0gZGVzc2VuIHJlZ3VsXHUwMEU0cmVzXG4gICAgICAvLyBQYWRkaW5nL1NjaHJpZnRnclx1MDBGNlx1MDBERmUgd2lya3QgZlx1MDBGQ3IgZWluZSByZWluZSBOYW1lK0VudGZlcm5lbi1MaXN0ZSB6dVxuICAgICAgLy8gd3VjaHRpZy4gU2NobGljaHRlIGVpZ2VuZSBaZWlsZSBzdGF0dGRlc3Nlbi5cbiAgICAgIGZvciAoY29uc3QgaWQgb2YgZW5hYmxlZElkcykge1xuICAgICAgICBjb25zdCByb3cgPSBsaXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImZyZWQtaW1wb3J0YW50LXBsdWdpbnMtcm93XCIgfSk7XG4gICAgICAgIHJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImZyZWQtaW1wb3J0YW50LXBsdWdpbnMtbmFtZVwiLCB0ZXh0OiBtYW5pZmVzdHNbaWRdLm5hbWUgfSk7XG4gICAgICAgIGNvbnN0IHJlbW92ZUJ0biA9IHJvdy5jcmVhdGVEaXYoe1xuICAgICAgICAgIGNsczogXCJjbGlja2FibGUtaWNvbiBmcmVkLWltcG9ydGFudC1wbHVnaW5zLXJlbW92ZVwiLFxuICAgICAgICAgIGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwiRW50ZmVybmVuXCIgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHNldEljb24ocmVtb3ZlQnRuLCBcInhcIik7XG4gICAgICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbXBvcnRhbnRQbHVnaW5zLmZpbHRlcigoeCkgPT4geCAhPT0gaWQpO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hJbXBvcnRhbnRQbHVnaW5Db21tYW5kcz8uKCk7XG4gICAgICAgICAgcmVuZGVySW1wb3J0YW50UGx1Z2luc0xpc3QoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZW5kZXJJbXBvcnRhbnRQbHVnaW5zTGlzdCgpO1xuICB9XG5cbiAgZGlzcGxheUtvbnRha3RlVGFiKGNvbnRhaW5lckVsKSB7XG4gICAgbmV3IFNldHRpbmdHcm91cChjb250YWluZXJFbClcbiAgICAgIC5zZXRIZWFkaW5nKFwiS29udGFrdGltcG9ydFwiKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIkNTVi1EYXRlaVwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiUGZhZCB6dXIgS29udGFrdGUtQ1NWLCByZWxhdGl2IHp1bSBWYXVsdC1Sb290LlwiKVxuICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0NzdlBhdGgpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0NzdlBhdGggPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRTZXR0aW5nKChzZXR0aW5nKSA9PlxuICAgICAgICBzZXR0aW5nXG4gICAgICAgICAgLnNldE5hbWUoXCJLb250YWt0ZS1CYXNpc3ZlcnplaWNobmlzXCIpXG4gICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICBcIkFsbGUgS29udGFrdGUgbGFuZGVuIGZsYWNoIGRpcmVrdCBpbiBkaWVzZW0gT3JkbmVyIChyZWxhdGl2IHp1bSBWYXVsdC1Sb290KS4gQmVzdGVoZW5kZSBOb3RpemVuIGluIGRpcmVrdGVuIFVudGVyb3JkbmVybiB3ZXJkZW4gYmVpbSBJbXBvcnQgaGllcmhlciB6dXNhbW1lbmdlZlx1MDBGQ2hydC5cIlxuICAgICAgICAgIClcbiAgICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNCYXNlRGlyKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNCYXNlRGlyID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkU2V0dGluZygoc2V0dGluZykgPT5cbiAgICAgICAgc2V0dGluZ1xuICAgICAgICAgIC5zZXROYW1lKFwiTnVyIGJlc3RlaGVuZGUgS29udGFrdGUgYWt0dWFsaXNpZXJlblwiKVxuICAgICAgICAgIC5zZXREZXNjKFwiV2VubiBha3Rpdiwgd2VyZGVuIGtlaW5lIG5ldWVuIEtvbnRha3QtTm90aXplbiBhbmdlbGVndCwgbnVyIGJlc3RlaGVuZGUgYWt0dWFsaXNpZXJ0LlwiKVxuICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0VkaXRPbmx5KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNFZGl0T25seSA9IHZhbHVlO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFNldHRpbmcoKHNldHRpbmcpID0+XG4gICAgICAgIHNldHRpbmdcbiAgICAgICAgICAuc2V0TmFtZShcIklycmVsZXZhbnRlIEtvbnRha3RlIFx1MDBGQ2JlcnNwcmluZ2VuXCIpXG4gICAgICAgICAgLnNldERlc2MoXCJLb250YWt0ZSBvaG5lIEdlYnVydHN0YWcgdW5kIG9obmUgVGFncyB3ZXJkZW4gXHUwMEZDYmVyc3BydW5nZW4uXCIpXG4gICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzRmlsdGVyUmVsZXZhbnQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0ZpbHRlclJlbGV2YW50ID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICApO1xuICB9XG5cbiAgZGlzcGxheU1lZGlhVGFiKGNvbnRhaW5lckVsKSB7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJOb2NoIGtlaW5lIEVpbnN0ZWxsdW5nZW4uXCIgfSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IERFRkFVTFRfU0VUVElOR1MsIEZyZWRTZXR0aW5nVGFiIH07XG4iLCAiY29uc3QgeyBOb3RpY2UsIHBhcnNlWWFtbCwgc3RyaW5naWZ5WWFtbCB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEtvbnRha3RlLUNTVi1JbXBvcnRcbiAqIChQb3J0aWVydW5nIHZvbiBrb250YWt0LXVwZGF0ZS1jc3YucHkpXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuY29uc3QgQ09OVEFDVFNfQ09MVU1OUyA9IFtcbiAgXCJMYWJlbHNcIixcbiAgXCJGaXJzdCBOYW1lXCIsXG4gIFwiTWlkZGxlIE5hbWVcIixcbiAgXCJMYXN0IE5hbWVcIixcbiAgXCJCaXJ0aGRheVwiLFxuICBcIkUtbWFpbCAxIC0gVmFsdWVcIixcbiAgXCJQaG9uZSAxIC0gVmFsdWVcIixcbiAgXCJBZGRyZXNzIDEgLSBTdHJlZXRcIixcbiAgXCJBZGRyZXNzIDEgLSBDaXR5XCIsXG4gIFwiQWRkcmVzcyAxIC0gUG9zdGFsIENvZGVcIixcbiAgXCJBZGRyZXNzIDEgLSBDb3VudHJ5XCIsXG5dO1xuXG5jb25zdCBDT05UQUNUU19GSUVMRF9NQVBQSU5HID0ge1xuICBcIkxhYmVsc1wiOiBcInRhZ3NcIixcbiAgXCJGaXJzdCBOYW1lXCI6IFwiVm9ybmFtZVwiLFxuICBcIk1pZGRsZSBOYW1lXCI6IFwiWndlaXRuYW1lXCIsXG4gIFwiTGFzdCBOYW1lXCI6IFwiTmFjaG5hbWVcIixcbiAgXCJCaXJ0aGRheVwiOiBcIkdlYnVydHN0YWdcIixcbiAgXCJQaG9uZSAxIC0gVmFsdWVcIjogXCJIYW5keW51bW1lclwiLFxuICBcIkUtbWFpbCAxIC0gVmFsdWVcIjogXCJFLU1haWxcIixcbiAgXCJFLW1haWwgMiAtIFZhbHVlXCI6IFwiRS1NYWlsLUFsdFwiLFxuICBcIkFkZHJlc3MgMSAtIFN0cmVldFwiOiBcIlN0cmFzc2VcIixcbiAgXCJBZGRyZXNzIDEgLSBQb3N0YWwgQ29kZVwiOiBcIlBselwiLFxuICBcIkFkZHJlc3MgMSAtIENpdHlcIjogXCJTdGFkdFwiLFxuICBcIkFkZHJlc3MgMSAtIENvdW50cnlcIjogXCJOYXRpb25cIixcbn07XG5cbmZ1bmN0aW9uIGpvaW5WYXVsdFBhdGgoLi4ucGFydHMpIHtcbiAgcmV0dXJuIHBhcnRzXG4gICAgLmZpbHRlcigocGFydCkgPT4gcGFydCAhPT0gdW5kZWZpbmVkICYmIHBhcnQgIT09IFwiXCIpXG4gICAgLmpvaW4oXCIvXCIpXG4gICAgLnJlcGxhY2UoL1xcLysvZywgXCIvXCIpXG4gICAgLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VDc3YodGV4dCkge1xuICBjb25zdCByb3dzID0gW107XG4gIGxldCByb3cgPSBbXTtcbiAgbGV0IGZpZWxkID0gXCJcIjtcbiAgbGV0IGluUXVvdGVzID0gZmFsc2U7XG4gIGxldCBpID0gMDtcblxuICB3aGlsZSAoaSA8IHRleHQubGVuZ3RoKSB7XG4gICAgY29uc3QgY2hhciA9IHRleHRbaV07XG5cbiAgICBpZiAoaW5RdW90ZXMpIHtcbiAgICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICAgIGlmICh0ZXh0W2kgKyAxXSA9PT0gJ1wiJykge1xuICAgICAgICAgIGZpZWxkICs9ICdcIic7XG4gICAgICAgICAgaSArPSAyO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGluUXVvdGVzID0gZmFsc2U7XG4gICAgICAgIGkrKztcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBmaWVsZCArPSBjaGFyO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgIGluUXVvdGVzID0gdHJ1ZTtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY2hhciA9PT0gXCIsXCIpIHtcbiAgICAgIHJvdy5wdXNoKGZpZWxkKTtcbiAgICAgIGZpZWxkID0gXCJcIjtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY2hhciA9PT0gXCJcXHJcIikge1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChjaGFyID09PSBcIlxcblwiKSB7XG4gICAgICByb3cucHVzaChmaWVsZCk7XG4gICAgICByb3dzLnB1c2gocm93KTtcbiAgICAgIHJvdyA9IFtdO1xuICAgICAgZmllbGQgPSBcIlwiO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGZpZWxkICs9IGNoYXI7XG4gICAgaSsrO1xuICB9XG5cbiAgaWYgKGZpZWxkLmxlbmd0aCA+IDAgfHwgcm93Lmxlbmd0aCA+IDApIHtcbiAgICByb3cucHVzaChmaWVsZCk7XG4gICAgcm93cy5wdXNoKHJvdyk7XG4gIH1cblxuICByZXR1cm4gcm93cy5maWx0ZXIoKHIpID0+ICEoci5sZW5ndGggPT09IDEgJiYgclswXSA9PT0gXCJcIikpO1xufVxuXG5mdW5jdGlvbiBjc3ZUb09iamVjdHModGV4dCkge1xuICBjb25zdCByb3dzID0gcGFyc2VDc3YodGV4dCk7XG4gIGlmIChyb3dzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICBjb25zdCBoZWFkZXIgPSByb3dzWzBdO1xuICByZXR1cm4gcm93cy5zbGljZSgxKS5tYXAoKHJvdykgPT4ge1xuICAgIGNvbnN0IG9iaiA9IHt9O1xuICAgIGhlYWRlci5mb3JFYWNoKChrZXksIGlkeCkgPT4gKG9ialtrZXldID0gcm93W2lkeF0gPz8gXCJcIikpO1xuICAgIHJldHVybiBvYmo7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzQ29udGFjdFJvdyhyb3csIGZpcnN0TmFtZUNvbHVtbiA9IFwiRmlyc3QgTmFtZVwiLCBsYXN0TmFtZUNvbHVtbiA9IFwiTGFzdCBOYW1lXCIpIHtcbiAgY29uc3QgZmlyc3ROYW1lID0gKHJvd1tmaXJzdE5hbWVDb2x1bW5dIHx8IFwiXCIpLnRyaW0oKTtcbiAgY29uc3QgbGFzdE5hbWUgPSAocm93W2xhc3ROYW1lQ29sdW1uXSB8fCBcIlwiKS50cmltKCk7XG5cbiAgbGV0IGJhc2VOYW1lO1xuICBpZiAoZmlyc3ROYW1lICYmIGxhc3ROYW1lKSBiYXNlTmFtZSA9IGAke2ZpcnN0TmFtZX0gJHtsYXN0TmFtZX1gO1xuICBlbHNlIGlmIChmaXJzdE5hbWUgfHwgbGFzdE5hbWUpIGJhc2VOYW1lID0gZmlyc3ROYW1lIHx8IGxhc3ROYW1lO1xuICBlbHNlIGJhc2VOYW1lID0gXCJfbm9uYW1lXCI7XG5cbiAgY29uc3QgZGF0YSA9IHt9O1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhyb3cpKSB7XG4gICAgaWYgKENPTlRBQ1RTX0NPTFVNTlMuaW5jbHVkZXMoa2V5KSAmJiB2YWx1ZS50cmltKCkpIHtcbiAgICAgIGRhdGFbQ09OVEFDVFNfRklFTERfTUFQUElOR1trZXldIHx8IGtleV0gPSB2YWx1ZS50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgYmFzZU5hbWUsIGRhdGEgfTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtQ29udGFjdEZpZWxkcyhkYXRhLCBleGlzdGluZ1RhZ3MsIHN0YXJyZWQpIHtcbiAgY29uc3QgdHJhbnNmb3JtZWQgPSB7IC4uLmRhdGEgfTtcblxuICB0cnkge1xuICAgIGlmIChcIkdlYnVydHN0YWdcIiBpbiB0cmFuc2Zvcm1lZCkge1xuICAgICAgY29uc3QgZ2VidXJ0c3RhZyA9IHRyYW5zZm9ybWVkLkdlYnVydHN0YWc7XG4gICAgICBpZiAoZ2VidXJ0c3RhZy5zdGFydHNXaXRoKFwiLS1cIikpIHtcbiAgICAgICAgdHJhbnNmb3JtZWQuR2VidXJ0c3RhZyA9IFwiMDAwMVwiICsgZ2VidXJ0c3RhZy5zbGljZSgxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoXCJIYW5keW51bW1lclwiIGluIHRyYW5zZm9ybWVkKSB7XG4gICAgICBsZXQgcGhvbmUgPSB0cmFuc2Zvcm1lZC5IYW5keW51bW1lci50cmltKCk7XG4gICAgICBpZiAocGhvbmUuaW5jbHVkZXMoXCIgOjo6IFwiKSkgcGhvbmUgPSBwaG9uZS5zcGxpdChcIiA6OjogXCIpWzBdO1xuICAgICAgdHJhbnNmb3JtZWQuSGFuZHludW1tZXIgPSBwaG9uZS5yZXBsYWNlKC8gL2csIFwiXCIpLnJlcGxhY2UoLy0vZywgXCJcIik7XG4gICAgfVxuXG4gICAgbGV0IG5vcm1hbGl6ZWRFeGlzdGluZyA9IGV4aXN0aW5nVGFncztcbiAgICBpZiAodHlwZW9mIG5vcm1hbGl6ZWRFeGlzdGluZyA9PT0gXCJzdHJpbmdcIikgbm9ybWFsaXplZEV4aXN0aW5nID0gW25vcm1hbGl6ZWRFeGlzdGluZ107XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG5vcm1hbGl6ZWRFeGlzdGluZykpIG5vcm1hbGl6ZWRFeGlzdGluZyA9IFtdO1xuICAgIGNvbnN0IGhhc0V4aXN0aW5nID0gbm9ybWFsaXplZEV4aXN0aW5nLmxlbmd0aCA+IDA7XG5cbiAgICBpZiAoXCJ0YWdzXCIgaW4gdHJhbnNmb3JtZWQgfHwgc3RhcnJlZCkge1xuICAgICAgY29uc3QgbmV3VGFncyA9ICh0cmFuc2Zvcm1lZC50YWdzIHx8IFwiXCIpXG4gICAgICAgIC5zcGxpdChcIiA6OjogXCIpXG4gICAgICAgIC5maWx0ZXIoKHRhZykgPT4gdGFnICYmIHRhZyAhPT0gXCIqIG15Q29udGFjdHNcIiAmJiB0YWcgIT09IFwiKiBzdGFycmVkXCIpXG4gICAgICAgIC5tYXAoKHRhZykgPT4gdGFnLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvIC9nLCBcIl9cIikpO1xuICAgICAgaWYgKHN0YXJyZWQpIG5ld1RhZ3MucHVzaChcImZhdm9yaXRcIik7XG4gICAgICBjb25zdCBoYXNOZXcgPSBuZXdUYWdzLmxlbmd0aCA+IDA7XG5cbiAgICAgIGlmIChoYXNFeGlzdGluZyAmJiBoYXNOZXcpIHtcbiAgICAgICAgdHJhbnNmb3JtZWQudGFncyA9IFsuLi5uZXcgU2V0KFsuLi5uZXdUYWdzLCAuLi5ub3JtYWxpemVkRXhpc3RpbmddKV07XG4gICAgICB9IGVsc2UgaWYgKGhhc0V4aXN0aW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybWVkLnRhZ3MgPSBbLi4ubmV3IFNldChub3JtYWxpemVkRXhpc3RpbmcpXTtcbiAgICAgIH0gZWxzZSBpZiAoaGFzTmV3KSB7XG4gICAgICAgIHRyYW5zZm9ybWVkLnRhZ3MgPSBuZXdUYWdzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIHRyYW5zZm9ybWVkLnRhZ3M7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltLb250YWt0LUltcG9ydF0gRmVobGVyIGJlaSBkZXIgRGF0ZW4tVHJhbnNmb3JtYXRpb246XCIsIGUpO1xuICB9XG5cbiAgcmV0dXJuIHRyYW5zZm9ybWVkO1xufVxuXG5mdW5jdGlvbiBpc1N0YXJyZWRDb250YWN0KHJhd1RhZ3MpIHtcbiAgaWYgKCFyYXdUYWdzKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiByYXdUYWdzXG4gICAgLnNwbGl0KFwiIDo6OiBcIilcbiAgICAubWFwKCh0YWcpID0+IHRhZy50cmltKCkpXG4gICAgLmluY2x1ZGVzKFwiKiBzdGFycmVkXCIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBmaW5kRXhpc3RpbmdDb250YWN0RmlsZShhZGFwdGVyLCBiYXNlTmFtZSwgc2VhcmNoRGlycykge1xuICBmb3IgKGNvbnN0IGRpciBvZiBzZWFyY2hEaXJzKSB7XG4gICAgY29uc3QgcGF0aCA9IGpvaW5WYXVsdFBhdGgoZGlyLCBgJHtiYXNlTmFtZX0ubWRgKTtcbiAgICBpZiAoYXdhaXQgYWRhcHRlci5leGlzdHMocGF0aCkpIHJldHVybiBwYXRoO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkQ29udGFjdEZyb250bWF0dGVyKGFkYXB0ZXIsIHBhdGgpIHtcbiAgY29uc3QgcmF3ID0gYXdhaXQgYWRhcHRlci5yZWFkKHBhdGgpO1xuICBjb25zdCBtYXRjaCA9IHJhdy5tYXRjaCgvXi0tLVxccj9cXG4oW1xcc1xcU10qPylcXHI/XFxuLS0tXFxyP1xcbj8vKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIHsgZnJvbnRtYXR0ZXI6IHt9LCBjb250ZW50OiByYXcgfTtcbiAgcmV0dXJuIHsgZnJvbnRtYXR0ZXI6IHBhcnNlWWFtbChtYXRjaFsxXSkgfHwge30sIGNvbnRlbnQ6IHJhdy5zbGljZShtYXRjaFswXS5sZW5ndGgpIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlQ29udGFjdEZpbGUoYWRhcHRlciwgcGF0aCwgZnJvbnRtYXR0ZXIsIGNvbnRlbnQpIHtcbiAgY29uc3Qgb3JkZXJlZCA9IHsgVFlQOiBcIktPTlRBS1RcIiB9O1xuICBpZiAoXCJhbGlhc2VzXCIgaW4gZnJvbnRtYXR0ZXIpIG9yZGVyZWQuYWxpYXNlcyA9IGZyb250bWF0dGVyLmFsaWFzZXM7XG4gIGlmIChcInRhZ3NcIiBpbiBmcm9udG1hdHRlcikgb3JkZXJlZC50YWdzID0gZnJvbnRtYXR0ZXIudGFncztcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZnJvbnRtYXR0ZXIpKSB7XG4gICAgaWYgKCEoa2V5IGluIG9yZGVyZWQpKSBvcmRlcmVkW2tleV0gPSB2YWx1ZTtcbiAgfVxuICBjb25zdCBmaWxlQ29udGVudCA9IGAtLS1cXG4ke3N0cmluZ2lmeVlhbWwob3JkZXJlZCl9LS0tXFxuJHtjb250ZW50fWA7XG5cbiAgY29uc3QgZGlyID0gcGF0aC5zcGxpdChcIi9cIikuc2xpY2UoMCwgLTEpLmpvaW4oXCIvXCIpO1xuICBpZiAoZGlyICYmICEoYXdhaXQgYWRhcHRlci5leGlzdHMoZGlyKSkpIGF3YWl0IGFkYXB0ZXIubWtkaXIoZGlyKTtcbiAgYXdhaXQgYWRhcHRlci53cml0ZShwYXRoLCBmaWxlQ29udGVudCk7XG59XG5cbmNvbnN0IEFVVE9fTUFOQUdFRF9GUk9OVE1BVFRFUl9LRVlTID0gbmV3IFNldChbXG4gIFwiY3NzY2xhc3Nlc1wiLFxuICBcIlRZUFwiLFxuICBcImFsaWFzZXNcIixcbiAgXCJ0YWdzXCIsXG4gIC4uLk9iamVjdC52YWx1ZXMoQ09OVEFDVFNfRklFTERfTUFQUElORyksXG5dKTtcblxuZnVuY3Rpb24gaXNVbnRvdWNoZWRDb250YWN0KGZyb250bWF0dGVyLCBjb250ZW50KSB7XG4gIGlmIChjb250ZW50LnRyaW0oKS5sZW5ndGggPiAwKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBPYmplY3Qua2V5cyhmcm9udG1hdHRlcikuZXZlcnkoKGtleSkgPT4gQVVUT19NQU5BR0VEX0ZST05UTUFUVEVSX0tFWVMuaGFzKGtleSkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzYWZlUmVtb3ZlQ29udGFjdEZpbGUoYWRhcHRlciwgcGF0aCkge1xuICAvLyBQYXBpZXJrb3JiIHN0YXR0IHBlcm1hbmVudGVtIExcdTAwRjZzY2hlbiwgZmFsbHMgYmVpbSBadXNhbW1lbmZcdTAwRkNocmVuIGRlclxuICAvLyBVbnRlcm9yZG5lciBtYWwgZXR3YXMgc2NoaWVmZ2VodC5cbiAgdHJ5IHtcbiAgICBjb25zdCB0cmFzaGVkVG9TeXN0ZW0gPSBhd2FpdCBhZGFwdGVyLnRyYXNoU3lzdGVtKHBhdGgpO1xuICAgIGlmICghdHJhc2hlZFRvU3lzdGVtKSBhd2FpdCBhZGFwdGVyLnRyYXNoTG9jYWwocGF0aCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhd2FpdCBhZGFwdGVyLnJlbW92ZShwYXRoKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpbXBvcnRDb250YWN0c0Zyb21Dc3YoYXBwLCBzZXR0aW5ncykge1xuICBjb25zdCB7IGFkYXB0ZXIgfSA9IGFwcC52YXVsdDtcbiAgY29uc3QgY3N2UGF0aCA9IHNldHRpbmdzLmNvbnRhY3RzQ3N2UGF0aDtcbiAgY29uc3QgYmFzaXNWZXJ6ZWljaG5pcyA9IHNldHRpbmdzLmNvbnRhY3RzQmFzZURpci5yZXBsYWNlKC9cXC8kLywgXCJcIik7XG5cbiAgaWYgKCEoYXdhaXQgYWRhcHRlci5leGlzdHMoY3N2UGF0aCkpKSB7XG4gICAgbmV3IE5vdGljZShgS29udGFrdC1JbXBvcnQ6IERhdGVpIG5pY2h0IGdlZnVuZGVuOiAke2NzdlBhdGh9YCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGJhc2lzVmVyemVpY2huaXMpKSkge1xuICAgIG5ldyBOb3RpY2UoYEtvbnRha3QtSW1wb3J0OiBCYXNpc3ZlcnplaWNobmlzIG5pY2h0IGdlZnVuZGVuOiAke2Jhc2lzVmVyemVpY2huaXN9YCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgeyBmb2xkZXJzIH0gPSBhd2FpdCBhZGFwdGVyLmxpc3QoYmFzaXNWZXJ6ZWljaG5pcyk7XG4gIGNvbnN0IHNlYXJjaERpcnMgPSBbYmFzaXNWZXJ6ZWljaG5pcywgLi4uZm9sZGVycy5zb3J0KCldO1xuXG4gIGNvbnN0IHJvd3MgPSBjc3ZUb09iamVjdHMoYXdhaXQgYWRhcHRlci5yZWFkKGNzdlBhdGgpKTtcblxuICBsZXQgY3JlYXRlZCA9IDA7XG4gIGxldCB1cGRhdGVkID0gMDtcbiAgbGV0IG1vdmVkID0gMDtcbiAgbGV0IHNraXBwZWQgPSAwO1xuICBsZXQgZXJyb3JzID0gMDtcblxuICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgYmFzZU5hbWUsIGRhdGE6IHJhd0RhdGEgfSA9IHByb2Nlc3NDb250YWN0Um93KHJvdyk7XG4gICAgICBjb25zdCBzdGFycmVkID0gaXNTdGFycmVkQ29udGFjdChyYXdEYXRhLnRhZ3MpO1xuICAgICAgY29uc3QgZXhpc3RpbmdGaWxlID0gYXdhaXQgZmluZEV4aXN0aW5nQ29udGFjdEZpbGUoYWRhcHRlciwgYmFzZU5hbWUsIHNlYXJjaERpcnMpO1xuXG4gICAgICBpZiAoZXhpc3RpbmdGaWxlKSB7XG4gICAgICAgIGNvbnN0IHsgZnJvbnRtYXR0ZXI6IGV4aXN0aW5nRnJvbnRtYXR0ZXIsIGNvbnRlbnQgfSA9IGF3YWl0IHJlYWRDb250YWN0RnJvbnRtYXR0ZXIoYWRhcHRlciwgZXhpc3RpbmdGaWxlKTtcbiAgICAgICAgY29uc3QgbmV3RGF0YSA9IHRyYW5zZm9ybUNvbnRhY3RGaWVsZHMocmF3RGF0YSwgZXhpc3RpbmdGcm9udG1hdHRlci50YWdzLCBzdGFycmVkKTtcblxuICAgICAgICBpZiAoc2V0dGluZ3MuY29udGFjdHNGaWx0ZXJSZWxldmFudCAmJiAhbmV3RGF0YS5HZWJ1cnRzdGFnICYmICghbmV3RGF0YS50YWdzIHx8IG5ld0RhdGEudGFncy5sZW5ndGggPCAxKSkge1xuICAgICAgICAgIHNraXBwZWQrKztcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVwZGF0ZWRGcm9udG1hdHRlciA9IHsgLi4uZXhpc3RpbmdGcm9udG1hdHRlciwgLi4ubmV3RGF0YSB9O1xuICAgICAgICAvLyBBbGxlcyBsYW5kZXQgZmxhY2ggZGlyZWt0IGltIEJhc2lzdmVyemVpY2huaXMsIGtlaW5lIFVudGVyb3JkbmVyIG1laHIuXG4gICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBqb2luVmF1bHRQYXRoKGJhc2lzVmVyemVpY2huaXMsIGAke2Jhc2VOYW1lfS5tZGApO1xuICAgICAgICBhd2FpdCB3cml0ZUNvbnRhY3RGaWxlKGFkYXB0ZXIsIHRhcmdldFBhdGgsIHVwZGF0ZWRGcm9udG1hdHRlciwgY29udGVudCk7XG5cbiAgICAgICAgaWYgKHRhcmdldFBhdGggIT09IGV4aXN0aW5nRmlsZSkge1xuICAgICAgICAgIGF3YWl0IHNhZmVSZW1vdmVDb250YWN0RmlsZShhZGFwdGVyLCBleGlzdGluZ0ZpbGUpO1xuICAgICAgICAgIG1vdmVkKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXBkYXRlZCsrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFzZXR0aW5ncy5jb250YWN0c0VkaXRPbmx5KSB7XG4gICAgICAgIGNvbnN0IG5ld0RhdGEgPSB0cmFuc2Zvcm1Db250YWN0RmllbGRzKHJhd0RhdGEsIHVuZGVmaW5lZCwgc3RhcnJlZCk7XG5cbiAgICAgICAgaWYgKHNldHRpbmdzLmNvbnRhY3RzRmlsdGVyUmVsZXZhbnQgJiYgIW5ld0RhdGEuR2VidXJ0c3RhZyAmJiAoIW5ld0RhdGEudGFncyB8fCBuZXdEYXRhLnRhZ3MubGVuZ3RoIDwgMSkpIHtcbiAgICAgICAgICBza2lwcGVkKys7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBuZXdQYXRoID0gam9pblZhdWx0UGF0aChiYXNpc1ZlcnplaWNobmlzLCBgJHtiYXNlTmFtZX0ubWRgKTtcbiAgICAgICAgYXdhaXQgd3JpdGVDb250YWN0RmlsZShhZGFwdGVyLCBuZXdQYXRoLCBuZXdEYXRhLCBcIlwiKTtcbiAgICAgICAgY3JlYXRlZCsrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9ycysrO1xuICAgICAgY29uc29sZS5lcnJvcihcIltLb250YWt0LUltcG9ydF0gRmVobGVyIGJlaSBLb250YWt0LVplaWxlOlwiLCByb3csIGUpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHN1bW1hcnkgPSBgS29udGFrdC1JbXBvcnQ6ICR7Y3JlYXRlZH0gbmV1LCAke3VwZGF0ZWR9IGFrdHVhbGlzaWVydCwgJHttb3ZlZH0gYXVzIFVudGVyb3JkbmVybiB6dXNhbW1lbmdlZlx1MDBGQ2hydCwgJHtza2lwcGVkfSBcdTAwRkNiZXJzcHJ1bmdlbiR7XG4gICAgZXJyb3JzID8gYCwgJHtlcnJvcnN9IEZlaGxlciAoc2llaGUgS29uc29sZSlgIDogXCJcIlxuICB9LmA7XG4gIGNvbnNvbGUubG9nKFwiW0tvbnRha3QtSW1wb3J0XVwiLCBzdW1tYXJ5KTtcbiAgbmV3IE5vdGljZShzdW1tYXJ5KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVsZXRlVW50b3VjaGVkQ29udGFjdHMoYXBwLCBzZXR0aW5ncykge1xuICBjb25zdCB7IGFkYXB0ZXIgfSA9IGFwcC52YXVsdDtcbiAgY29uc3QgYmFzaXNWZXJ6ZWljaG5pcyA9IHNldHRpbmdzLmNvbnRhY3RzQmFzZURpci5yZXBsYWNlKC9cXC8kLywgXCJcIik7XG5cbiAgaWYgKCEoYXdhaXQgYWRhcHRlci5leGlzdHMoYmFzaXNWZXJ6ZWljaG5pcykpKSB7XG4gICAgbmV3IE5vdGljZShgS29udGFrdC1JbXBvcnQ6IEJhc2lzdmVyemVpY2huaXMgbmljaHQgZ2VmdW5kZW46ICR7YmFzaXNWZXJ6ZWljaG5pc31gKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjb250YWN0RmlsZXMgPSBhcHAudmF1bHRcbiAgICAuZ2V0TWFya2Rvd25GaWxlcygpXG4gICAgLmZpbHRlcigoZmlsZSkgPT4gZmlsZS5wYXRoID09PSBiYXNpc1ZlcnplaWNobmlzIHx8IGZpbGUucGF0aC5zdGFydHNXaXRoKGJhc2lzVmVyemVpY2huaXMgKyBcIi9cIikpXG4gICAgLmZpbHRlcigoZmlsZSkgPT4gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcj8uVFlQID09PSBcIktPTlRBS1RcIik7XG5cbiAgbGV0IGRlbGV0ZWQgPSAwO1xuICBsZXQgZXJyb3JzID0gMDtcblxuICBmb3IgKGNvbnN0IGZpbGUgb2YgY29udGFjdEZpbGVzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgZnJvbnRtYXR0ZXIsIGNvbnRlbnQgfSA9IGF3YWl0IHJlYWRDb250YWN0RnJvbnRtYXR0ZXIoYWRhcHRlciwgZmlsZS5wYXRoKTtcbiAgICAgIGlmICghaXNVbnRvdWNoZWRDb250YWN0KGZyb250bWF0dGVyLCBjb250ZW50KSkgY29udGludWU7XG5cbiAgICAgIGF3YWl0IHNhZmVSZW1vdmVDb250YWN0RmlsZShhZGFwdGVyLCBmaWxlLnBhdGgpO1xuICAgICAgY29uc29sZS5sb2coYFtLb250YWt0LUltcG9ydF0gVW52ZXJcdTAwRTRuZGVydGVyIEtvbnRha3QgZ2VsXHUwMEY2c2NodDogJHtmaWxlLnBhdGh9YCk7XG4gICAgICBkZWxldGVkKys7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXJyb3JzKys7XG4gICAgICBjb25zb2xlLmVycm9yKFwiW0tvbnRha3QtSW1wb3J0XSBGZWhsZXIgYmVpbSBQclx1MDBGQ2Zlbi9MXHUwMEY2c2NoZW46XCIsIGZpbGUucGF0aCwgZSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc3VtbWFyeSA9IGBLb250YWt0LUltcG9ydDogJHtjb250YWN0RmlsZXMubGVuZ3RofSBnZXByXHUwMEZDZnQsICR7ZGVsZXRlZH0gdW52ZXJcdTAwRTRuZGVydGUgZ2VsXHUwMEY2c2NodCR7XG4gICAgZXJyb3JzID8gYCwgJHtlcnJvcnN9IEZlaGxlciAoc2llaGUgS29uc29sZSlgIDogXCJcIlxuICB9LmA7XG4gIGNvbnNvbGUubG9nKFwiW0tvbnRha3QtSW1wb3J0XVwiLCBzdW1tYXJ5KTtcbiAgbmV3IE5vdGljZShzdW1tYXJ5KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGltcG9ydENvbnRhY3RzRnJvbUNzdiwgZGVsZXRlVW50b3VjaGVkQ29udGFjdHMgfTtcbiIsICJjb25zdCB7IFRGaWxlIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogUHJvcGVydHktQmFja2xpbmtpbmdcbiAqIEJlbGllYmlnZSBOb3RpemVuIChuaWNodCBhdWYgZWluZW4gVFlQIGJlc2Noclx1MDBFNG5rdCkgbWl0IGVpbmVyXG4gKiBMaXN0ZW4tUHJvcGVydHkgKHouIEIuIFwiRmFtaWxpZVwiLCBcIkZyZXVuZGVcIikgYXVzIExpbmtzIHp1XG4gKiBhbmRlcmVuIE5vdGl6ZW4gYmVrb21tZW4gZGVuIFByb3BlcnR5LUJhY2tsaW5rIGF1dG9tYXRpc2NoIGJlaVxuICogZGVyIGpld2VpbHMgYW5kZXJlbiBOb3RpeiBlcmdcdTAwRTRuenQgLSB1bmQgd2llZGVyIGVudGZlcm50LCBzb2JhbGRcbiAqIGRpZSB1cnNwclx1MDBGQ25nbGljaGUgVmVybGlua3VuZyB3ZWdmXHUwMEU0bGx0LiBEaWUga29uZmlndXJpZXJ0ZVxuICogUHJvcGVydHktTGlzdGUgc2VsYnN0IGlzdCBkZXIgZWluemlnZSBGaWx0ZXIuXG4gKlxuICogRXJrZW5udW5nIHBlciBWZXJnbGVpY2ggbWl0IGRlbSBnZXNwZWljaGVydGVuIFN0YW5kIGRlcyBsZXR6dGVuXG4gKiBMYXVmcyAobmljaHQgcGVyIEhlcmt1bmZ0cy1UcmFja2luZyBlaW56ZWxuZXIgTGlua3MpOiB3YXMgbmV1XG4gKiBkYXp1Z2Vrb21tZW4gaXN0LCB3aXJkIGdlc3BpZWdlbHQgZXJnXHUwMEU0bnp0OyB3YXMgd2VnZ2VmYWxsZW4gaXN0LFxuICogd2lyZCBiZWltIGFuZGVyZW4gZWJlbmZhbGxzIGVudGZlcm50IC0gdW5hYmhcdTAwRTRuZ2lnIGRhdm9uLCB3ZXIgZGllXG4gKiBWZXJsaW5rdW5nIHVyc3ByXHUwMEZDbmdsaWNoIGdlc2V0enQgaGF0dGUuXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuZnVuY3Rpb24gcGFyc2VMaW5rVGV4dChlbnRyeSkge1xuICBjb25zdCBtYXRjaCA9IGVudHJ5Lm1hdGNoKC9eXFxbXFxbKFteXFxdfF0rKSg/OlxcfFteXFxdXSopP1xcXVxcXSQvKTtcbiAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBlbnRyeTtcbn1cblxuZnVuY3Rpb24gdG9BcnJheSh2YWx1ZSkge1xuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZTtcbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IFwiXCIpIHJldHVybiBbXTtcbiAgcmV0dXJuIFt2YWx1ZV07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVMaW5rVGFyZ2V0cyhhcHAsIG93bmVyRmlsZSwgcHJvcGVydHlWYWx1ZSkge1xuICBjb25zdCB0YXJnZXRzID0gW107XG4gIGZvciAoY29uc3QgZW50cnkgb2YgdG9BcnJheShwcm9wZXJ0eVZhbHVlKSkge1xuICAgIGlmICh0eXBlb2YgZW50cnkgIT09IFwic3RyaW5nXCIpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGRlc3QgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChwYXJzZUxpbmtUZXh0KGVudHJ5KSwgb3duZXJGaWxlLnBhdGgpO1xuICAgIGlmICghZGVzdCkge1xuICAgICAgY29uc29sZS53YXJuKGBbUHJvcGVydHktQmFja2xpbmtpbmddIExpbmsga29ubnRlIG5pY2h0IGF1ZmdlbFx1MDBGNnN0IHdlcmRlbjogXCIke2VudHJ5fVwiIGluICR7b3duZXJGaWxlLnBhdGh9YCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGRlc3QucGF0aCAhPT0gb3duZXJGaWxlLnBhdGgpIHRhcmdldHMucHVzaChkZXN0KTtcbiAgfVxuICByZXR1cm4gdGFyZ2V0cztcbn1cblxuLy8geyBbcHJvcGVydHldOiB7IFtzb3VyY2VQYXRoXTogW3RhcmdldFBhdGgsIC4uLl0gfSB9IC0gcmVpbmUgSlNPTi10YXVnbGljaGUgU3RydWt0dXIsXG4vLyBkYW1pdCBzaWUgMToxIGluIGRlbiBQbHVnaW4tU2V0dGluZ3MgZ2VzcGVpY2hlcnQgd2VyZGVuIGthbm4uXG5mdW5jdGlvbiBjb21wdXRlRGVjbGFyZWRQYWlycyhhcHAsIHByb3BlcnR5TmFtZXMsIGZpbGVzKSB7XG4gIGNvbnN0IHBhaXJzID0ge307XG4gIGZvciAoY29uc3QgcHJvcGVydHlOYW1lIG9mIHByb3BlcnR5TmFtZXMpIHtcbiAgICBjb25zdCBieVNvdXJjZSA9IHt9O1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgY29uc3QgZnJvbnRtYXR0ZXIgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyO1xuICAgICAgaWYgKCFmcm9udG1hdHRlcj8uW3Byb3BlcnR5TmFtZV0pIGNvbnRpbnVlO1xuICAgICAgY29uc3QgdGFyZ2V0cyA9IHJlc29sdmVMaW5rVGFyZ2V0cyhhcHAsIGZpbGUsIGZyb250bWF0dGVyW3Byb3BlcnR5TmFtZV0pO1xuICAgICAgaWYgKHRhcmdldHMubGVuZ3RoID4gMCkgYnlTb3VyY2VbZmlsZS5wYXRoXSA9IHRhcmdldHMubWFwKCh0KSA9PiB0LnBhdGgpO1xuICAgIH1cbiAgICBwYWlyc1twcm9wZXJ0eU5hbWVdID0gYnlTb3VyY2U7XG4gIH1cbiAgcmV0dXJuIHBhaXJzO1xufVxuXG5mdW5jdGlvbiBnZXRUYXJnZXRTZXQocGFpcnMsIHByb3BlcnR5TmFtZSwgc291cmNlUGF0aCkge1xuICByZXR1cm4gbmV3IFNldChwYWlycz8uW3Byb3BlcnR5TmFtZV0/Lltzb3VyY2VQYXRoXSA/PyBbXSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFkZExpbmtUb1Byb3BlcnR5KGFwcCwgcHJvcGVydHlOYW1lLCBvd25lckZpbGUsIHRhcmdldEZpbGUpIHtcbiAgYXdhaXQgYXBwLmZpbGVNYW5hZ2VyLnByb2Nlc3NGcm9udE1hdHRlcihvd25lckZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0b0FycmF5KGZyb250bWF0dGVyW3Byb3BlcnR5TmFtZV0pO1xuICAgIGNvbnN0IGFscmVhZHlUaGVyZSA9IHJlc29sdmVMaW5rVGFyZ2V0cyhhcHAsIG93bmVyRmlsZSwgY3VycmVudCkuc29tZSgoZikgPT4gZi5wYXRoID09PSB0YXJnZXRGaWxlLnBhdGgpO1xuICAgIGlmIChhbHJlYWR5VGhlcmUpIHJldHVybjtcbiAgICBjb25zdCBsaW5rID0gYXBwLmZpbGVNYW5hZ2VyLmdlbmVyYXRlTWFya2Rvd25MaW5rKHRhcmdldEZpbGUsIG93bmVyRmlsZS5wYXRoKTtcbiAgICBmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdID0gWy4uLmN1cnJlbnQsIGxpbmtdO1xuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVtb3ZlTGlua0Zyb21Qcm9wZXJ0eShhcHAsIHByb3BlcnR5TmFtZSwgb3duZXJGaWxlLCB0YXJnZXRQYXRoKSB7XG4gIGF3YWl0IGFwcC5maWxlTWFuYWdlci5wcm9jZXNzRnJvbnRNYXR0ZXIob3duZXJGaWxlLCAoZnJvbnRtYXR0ZXIpID0+IHtcbiAgICBjb25zdCBjdXJyZW50ID0gdG9BcnJheShmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdKTtcbiAgICBjb25zdCBmaWx0ZXJlZCA9IGN1cnJlbnQuZmlsdGVyKChlbnRyeSkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBlbnRyeSAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIHRydWU7XG4gICAgICBjb25zdCBkZXN0ID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QocGFyc2VMaW5rVGV4dChlbnRyeSksIG93bmVyRmlsZS5wYXRoKTtcbiAgICAgIHJldHVybiAhKGRlc3QgJiYgZGVzdC5wYXRoID09PSB0YXJnZXRQYXRoKTtcbiAgICB9KTtcbiAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSBjdXJyZW50Lmxlbmd0aCkgcmV0dXJuO1xuICAgIGlmIChmaWx0ZXJlZC5sZW5ndGggPT09IDApIGRlbGV0ZSBmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdO1xuICAgIGVsc2UgZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSA9IGZpbHRlcmVkO1xuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlDaGFuZ2VzKGFwcCwgcHJvcGVydHlOYW1lcywgcHJldmlvdXNQYWlycywgY3VycmVudFBhaXJzKSB7XG4gIGxldCBhZGRlZCA9IDA7XG4gIGxldCByZW1vdmVkID0gMDtcblxuICBmb3IgKGNvbnN0IHByb3BlcnR5TmFtZSBvZiBwcm9wZXJ0eU5hbWVzKSB7XG4gICAgY29uc3Qgc291cmNlUGF0aHMgPSBuZXcgU2V0KFtcbiAgICAgIC4uLk9iamVjdC5rZXlzKHByZXZpb3VzUGFpcnM/Lltwcm9wZXJ0eU5hbWVdID8/IHt9KSxcbiAgICAgIC4uLk9iamVjdC5rZXlzKGN1cnJlbnRQYWlycz8uW3Byb3BlcnR5TmFtZV0gPz8ge30pLFxuICAgIF0pO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VQYXRoIG9mIHNvdXJjZVBhdGhzKSB7XG4gICAgICBjb25zdCBwcmV2VGFyZ2V0cyA9IGdldFRhcmdldFNldChwcmV2aW91c1BhaXJzLCBwcm9wZXJ0eU5hbWUsIHNvdXJjZVBhdGgpO1xuICAgICAgY29uc3QgY3VyclRhcmdldHMgPSBnZXRUYXJnZXRTZXQoY3VycmVudFBhaXJzLCBwcm9wZXJ0eU5hbWUsIHNvdXJjZVBhdGgpO1xuXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBhdGggb2YgY3VyclRhcmdldHMpIHtcbiAgICAgICAgaWYgKHByZXZUYXJnZXRzLmhhcyh0YXJnZXRQYXRoKSkgY29udGludWU7IC8vIHVudmVyXHUwMEU0bmRlcnRcblxuICAgICAgICBjb25zdCBzb3VyY2VGaWxlID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChzb3VyY2VQYXRoKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0RmlsZSA9IGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGFyZ2V0UGF0aCk7XG4gICAgICAgIGlmICghKHNvdXJjZUZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgISh0YXJnZXRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSBjb250aW51ZTtcblxuICAgICAgICBhd2FpdCBhZGRMaW5rVG9Qcm9wZXJ0eShhcHAsIHByb3BlcnR5TmFtZSwgdGFyZ2V0RmlsZSwgc291cmNlRmlsZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUHJvcGVydHktQmFja2xpbmtpbmddIFwiJHtwcm9wZXJ0eU5hbWV9XCI6ICR7dGFyZ2V0RmlsZS5wYXRofSA8LSAke3NvdXJjZUZpbGUucGF0aH0gZXJnXHUwMEU0bnp0YCk7XG4gICAgICAgIGFkZGVkKys7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGF0aCBvZiBwcmV2VGFyZ2V0cykge1xuICAgICAgICBpZiAoY3VyclRhcmdldHMuaGFzKHRhcmdldFBhdGgpKSBjb250aW51ZTsgLy8gd2VpdGVyaGluIHZvcmhhbmRlblxuXG4gICAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRhcmdldFBhdGgpO1xuICAgICAgICBpZiAoISh0YXJnZXRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSBjb250aW51ZTtcblxuICAgICAgICBhd2FpdCByZW1vdmVMaW5rRnJvbVByb3BlcnR5KGFwcCwgcHJvcGVydHlOYW1lLCB0YXJnZXRGaWxlLCBzb3VyY2VQYXRoKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtQcm9wZXJ0eS1CYWNrbGlua2luZ10gXCIke3Byb3BlcnR5TmFtZX1cIjogJHt0YXJnZXRGaWxlLnBhdGh9IDwtICR7c291cmNlUGF0aH0gZW50ZmVybnRgKTtcbiAgICAgICAgcmVtb3ZlZCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IGFkZGVkLCByZW1vdmVkIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHN5bmNBbGxMaW5rcyhhcHAsIHByb3BlcnR5TmFtZXMsIHByZXZpb3VzUGFpcnMpIHtcbiAgY29uc3QgZmlsZXMgPSBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICBjb25zb2xlLmxvZyhgW1Byb3BlcnR5LUJhY2tsaW5raW5nXSBQclx1MDBGQ2ZlICR7ZmlsZXMubGVuZ3RofSBOb3RpemVuIGZcdTAwRkNyIFByb3BlcnRpZXM6ICR7cHJvcGVydHlOYW1lcy5qb2luKFwiLCBcIil9YCk7XG5cbiAgY29uc3QgY3VycmVudFBhaXJzID0gY29tcHV0ZURlY2xhcmVkUGFpcnMoYXBwLCBwcm9wZXJ0eU5hbWVzLCBmaWxlcyk7XG4gIGNvbnN0IHsgYWRkZWQsIHJlbW92ZWQgfSA9IGF3YWl0IGFwcGx5Q2hhbmdlcyhhcHAsIHByb3BlcnR5TmFtZXMsIHByZXZpb3VzUGFpcnMsIGN1cnJlbnRQYWlycyk7XG5cbiAgcmV0dXJuIHtcbiAgICBjaGVja2VkOiBmaWxlcy5sZW5ndGgsXG4gICAgYWRkZWQsXG4gICAgcmVtb3ZlZCxcbiAgICBkZWNsYXJlZFBhaXJzOiBjdXJyZW50UGFpcnMsXG4gIH07XG59XG5cbi8vIExpdmUtTW9kdXM6IGxcdTAwRjZzdCBiZWkgamVkZXIgTWV0YWRhdGVuLVx1MDBDNG5kZXJ1bmcgZWluZW4gdm9sbHN0XHUwMEU0bmRpZ2VuIEFiZ2xlaWNoIGF1cy5cbi8vIEVpbiBlaW5mYWNoZXMgTG9jayB2ZXJoaW5kZXJ0IFx1MDBGQ2JlcmxhcHBlbmRlIExcdTAwRTR1ZmUgYmVpIHNjaG5lbGwgYXVmZWluYW5kZXJmb2xnZW5kZW5cbi8vIFNwZWljaGVydW5nZW47IHdcdTAwRTRocmVuZCBlaW4gTGF1ZiBha3RpdiBpc3QsIHdpcmQgaFx1MDBGNmNoc3RlbnMgZWluIHdlaXRlcmVyIG5hY2hnZWhvbHQuXG5mdW5jdGlvbiByZWdpc3RlclByb3BlcnR5QmFja2xpbmtzTGl2ZShwbHVnaW4pIHtcbiAgbGV0IHJ1bm5pbmcgPSBmYWxzZTtcbiAgbGV0IHBlbmRpbmcgPSBmYWxzZTtcblxuICBjb25zdCBydW5TeW5jID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChydW5uaW5nKSB7XG4gICAgICBwZW5kaW5nID0gdHJ1ZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcnVubmluZyA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHN5bmNBbGxMaW5rcyhwbHVnaW4uYXBwLCBwbHVnaW4uc2V0dGluZ3MucmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzLCBwbHVnaW4uc2V0dGluZ3MuZGVjbGFyZWRMaW5rUGFpcnMpO1xuICAgICAgcGx1Z2luLnNldHRpbmdzLmRlY2xhcmVkTGlua1BhaXJzID0gcmVzdWx0LmRlY2xhcmVkUGFpcnM7XG4gICAgICBhd2FpdCBwbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihcIltQcm9wZXJ0eS1CYWNrbGlua2luZ10gRmVobGVyOlwiLCBlKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgaWYgKHBlbmRpbmcpIHtcbiAgICAgICAgcGVuZGluZyA9IGZhbHNlO1xuICAgICAgICBydW5TeW5jKCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IG9uTWV0YWRhdGFDaGFuZ2VkID0gKGZpbGUpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5wcm9wZXJ0eUJhY2tsaW5rc0xpdmVFbmFibGVkKSByZXR1cm47XG4gICAgaWYgKGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybjtcbiAgICBydW5TeW5jKCk7XG4gIH07XG5cbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLm9uKFwiY2hhbmdlZFwiLCBvbk1ldGFkYXRhQ2hhbmdlZCkpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgc3luY0FsbExpbmtzLCByZWdpc3RlclByb3BlcnR5QmFja2xpbmtzTGl2ZSB9O1xuIiwgImNvbnN0IHsgTm90aWNlIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5jb25zdCB7IGltcG9ydENvbnRhY3RzRnJvbUNzdiwgZGVsZXRlVW50b3VjaGVkQ29udGFjdHMgfSA9IHJlcXVpcmUoXCIuL2tvbnRha3QtaW1wb3J0XCIpO1xuY29uc3QgeyBzeW5jQWxsTGlua3MgfSA9IHJlcXVpcmUoXCIuL3Byb3BlcnR5LXN5bmNcIik7XG5jb25zdCB7IG9wZW5JbXBvcnRhbnRQbHVnaW5TZXR0aW5nc1BpY2tlciB9ID0gcmVxdWlyZShcIi4vaW1wb3J0YW50LXBsdWdpbnNcIik7XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ29tbWFuZHMocGx1Z2luKSB7XG5cbiAgcGx1Z2luLmFkZENvbW1hbmQoe1xuICAgIGlkOiBcImtvbnRha3RlLWNzdi1pbXBvcnRcIixcbiAgICBuYW1lOiBcIktPTlRBS1RFIC0gS29udGFrdGUgYXVzIENTViBha3R1YWxpc2llcmVuXCIsXG4gICAgY2FsbGJhY2s6ICgpID0+IGltcG9ydENvbnRhY3RzRnJvbUNzdihwbHVnaW4uYXBwLCBwbHVnaW4uc2V0dGluZ3MpLFxuICB9KTtcblxuICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgaWQ6IFwia29udGFrdGUtdW52ZXJhZW5kZXJ0LWxvZXNjaGVuXCIsXG4gICAgbmFtZTogXCJLT05UQUtURSAtIFVudmVyXHUwMEU0bmRlcnRlIEtvbnRha3RlIGxcdTAwRjZzY2hlblwiLFxuICAgIGNhbGxiYWNrOiAoKSA9PiBkZWxldGVVbnRvdWNoZWRDb250YWN0cyhwbHVnaW4uYXBwLCBwbHVnaW4uc2V0dGluZ3MpLFxuICB9KTtcblxuICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgaWQ6IFwicHJvcGVydHktc3luY1wiLFxuICAgIG5hbWU6IFwiUHJvcGVydHktQmFja2xpbmtpbmcgLSBBa3R1YWxpc2llcmVuXCIsXG4gICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHN5bmNBbGxMaW5rcyhwbHVnaW4uYXBwLCBwbHVnaW4uc2V0dGluZ3MucmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzLCBwbHVnaW4uc2V0dGluZ3MuZGVjbGFyZWRMaW5rUGFpcnMpO1xuICAgICAgcGx1Z2luLnNldHRpbmdzLmRlY2xhcmVkTGlua1BhaXJzID0gcmVzdWx0LmRlY2xhcmVkUGFpcnM7XG4gICAgICBhd2FpdCBwbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICBuZXcgTm90aWNlKGBQcm9wZXJ0eS1CYWNrbGlua2luZzogJHtyZXN1bHQuY2hlY2tlZH0gTm90aXplbiBnZXByXHUwMEZDZnQsICR7cmVzdWx0LmFkZGVkfSBlcmdcdTAwRTRuenQsICR7cmVzdWx0LnJlbW92ZWR9IGVudGZlcm50LmApO1xuICAgIH0sXG4gIH0pO1xuXG4gIHBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICBpZDogXCJvcGVuLWltcG9ydGFudC1wbHVnaW4tc2V0dGluZ3NcIixcbiAgICBuYW1lOiBcIk9wZW4gSW1wb3J0YW50IFBsdWdpbiBTZXR0aW5ncyAoUGlja2VyKVwiLFxuICAgIGNhbGxiYWNrOiAoKSA9PiBvcGVuSW1wb3J0YW50UGx1Z2luU2V0dGluZ3NQaWNrZXIocGx1Z2luKSxcbiAgfSk7XG5cbiAgcGx1Z2luLmFkZENvbW1hbmQoe1xuICAgIGlkOiBcImRhdGVuYmFuay1vcmRuZXItb2VmZm5lbi1zY2hsaWVzc2VuXCIsXG4gICAgbmFtZTogXCJEYXRlbmJhbmsgLSBPcmRuZXIgXHUwMEY2ZmZuZW4vc2NobGllXHUwMERGZW5cIixcbiAgICBjYWxsYmFjazogKCkgPT4gcGx1Z2luLnRvZ2dsZURhdGFiYXNlRm9sZGVyPy4oKSxcbiAgfSk7XG5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVyQ29tbWFuZHMgfTtcbiIsICJjb25zdCB7IFRGaWxlLCBURm9sZGVyLCBGdXp6eVN1Z2dlc3RNb2RhbCwgTm90aWNlIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRGF0ZW5iYW5rLU9yZG5lclxuICogT3JkbmVyIG1pdCBrb25maWd1cmllcmJhcmVtIFByXHUwMEU0Zml4IChTdGFuZGFyZCBcIn5cIikgd2VyZGVuIGltXG4gKiBGaWxlLUV4cGxvcmVyIG5pY2h0IG1laHIgYXVmLS96dWtsYXBwYmFyIGRhcmdlc3RlbGx0IHVuZCB6ZWlnZW5cbiAqIHN0YXR0IGRlcyBQZmVpbHMgZGllIEFuemFobCBlbnRoYWx0ZW5lciAubWQtRGF0ZWllbi5cbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4vLyBDU1MgemllbHQgYmV3dXNzdCBhdWYgZGllIEtsYXNzZSBcIi5mcmVkLWRiLWZvbGRlclwiIHN0YXR0IGF1ZiBlaW5cbi8vIFtkYXRhLXBhdGhePS4uLl0vW2RhdGEtcGF0aCo9Li4uXS1BdHRyaWJ1dHNlbGVrdG9yOiBFaW4gQXR0cmlidXRzZWxla3RvclxuLy8gbWF0Y2h0IGRlbiBHRVNBTVRFTiBQZmFkLVN0cmluZywgbmljaHQgbnVyIGRlbiBPcmRuZXJuYW1lbiAtIGVpblxuLy8gVW50ZXJvcmRuZXIgT0hORSBQclx1MDBFNGZpeCBpbm5lcmhhbGIgZWluZXMgRGF0ZW5iYW5rLU9yZG5lcnMgKHouIEIuXG4vLyBcIn5EQi9TdWJcIikgaFx1MDBFNHR0ZSBlaW5lbiBkYXRhLXBhdGgsIGRlciBlYmVuZmFsbHMgbWl0IGRlbSBQclx1MDBFNGZpeCBiZWdpbm50LFxuLy8gdW5kIHdcdTAwRkNyZGUgZmFlbHNjaGxpY2ggZGllIFBmZWlsLUF1c2JsZW5kLVJlZ2VsIGVyYmVuLiBEaWUgS2xhc3NlIHdpcmQgaW5cbi8vIHJlZnJlc2hXYXRjaGVkRm9sZGVycygpIGF1c3NjaGxpZXNzbGljaCBcdTAwRkNiZXIgaXNEYXRhYmFzZVBhdGgoKSAocHJcdTAwRkNmdCBudXJcbi8vIGRlbiBlaWdlbmVuIE9yZG5lcm5hbWVuKSBnZXNldHp0LCBkaWVzZWxiZSBRdWVsbGUgd2llIGZcdTAwRkNyIGRpZSBCYWRnZS1Mb2dpa1xuLy8gLSBkYW1pdCBrXHUwMEY2bm5lbiBDU1MgdW5kIEpTIG5pZSBhdXNlaW5hbmRlcmxhdWZlbi5cbmZ1bmN0aW9uIGJ1aWxkU3R5bGUocHJlZml4LCBzdXBwcmVzc1VuZGVybGluZSwgY291bnRBdEVuZCkge1xuICBpZiAoIXByZWZpeCkgcmV0dXJuIFwiXCI7XG4gIGxldCBjc3MgPSBcIlwiO1xuXG4gIGlmIChjb3VudEF0RW5kKSB7XG4gICAgY3NzICs9IGBcbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5jb2xsYXBzZS1pY29uIHtcbiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50O1xufVxuYDtcbiAgfSBlbHNlIHtcbiAgICBjc3MgKz0gYFxuLm5hdi1mb2xkZXItdGl0bGUuZnJlZC1kYi1mb2xkZXIgLmNvbGxhcHNlLWljb24gc3ZnIHtcbiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50O1xufVxuLm5hdi1mb2xkZXItdGl0bGUuZnJlZC1kYi1mb2xkZXIgLmNvbGxhcHNlLWljb24ge1xuICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xufVxuLmZyZWQtZGItY291bnQge1xuICBmb250LXNpemU6IHZhcigtLWZvbnQtdWktc21hbGxlcik7XG4gIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcbn1cbmA7XG4gIH1cblxuICBpZiAoc3VwcHJlc3NVbmRlcmxpbmUpIHtcbiAgICBjc3MgKz0gYFxuLm5hdi1mb2xkZXItdGl0bGUuZnJlZC1kYi1mb2xkZXIgLm5hdi1mb2xkZXItdGl0bGUtY29udGVudCB7XG4gIHRleHQtZGVjb3JhdGlvbi1saW5lOiBub25lICFpbXBvcnRhbnQ7XG59XG5gO1xuICB9XG4gIHJldHVybiBjc3M7XG59XG5cbmZ1bmN0aW9uIGlzRGF0YWJhc2VQYXRoKHBhdGgsIHByZWZpeCkge1xuICBpZiAoIXBhdGggfHwgIXByZWZpeCkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBuYW1lID0gcGF0aC5zcGxpdChcIi9cIikucG9wKCk7XG4gIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgocHJlZml4KTtcbn1cblxuZnVuY3Rpb24gaXNEYXRhYmFzZUZvbGRlclRpdGxlKHRpdGxlRWwsIHByZWZpeCkge1xuICBpZiAoIXRpdGxlRWwpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIGlzRGF0YWJhc2VQYXRoKHRpdGxlRWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wYXRoXCIpLCBwcmVmaXgpO1xufVxuXG4vLyBcdTAwQzR1XHUwMERGZXJzdGVyIERhdGVuYmFuay1PcmRuZXIgYXVmIGRlbSBQZmFkIGVpbmVyIERhdGVpIChuaWNodCBkaWUgRGF0ZWkgc2VsYnN0KSAtXG4vLyBiZWkgdmVyc2NoYWNodGVsdGVuIERhdGVuYmFuay1PcmRuZXJuIGRlciBvYmVyc3RlLCB3ZWlsIGVpbiB3ZWl0ZXIgaW5uZW5cbi8vIGxpZWdlbmRlciBUcmVmZmVyIG9obmVoaW4gdW5zaWNodGJhciB3XHUwMEU0cmUsIHNvbGFuZ2UgZGVyIFx1MDBFNHVcdTAwREZlcmUgenVnZWtsYXBwdCBpc3QuXG5mdW5jdGlvbiBmaW5kRGF0YWJhc2VBbmNlc3RvckZvbGRlcihhcHAsIGZpbGVQYXRoLCBwcmVmaXgpIHtcbiAgaWYgKCFwcmVmaXgpIHJldHVybiBudWxsO1xuICBjb25zdCBzZWdtZW50cyA9IGZpbGVQYXRoLnNwbGl0KFwiL1wiKTtcbiAgc2VnbWVudHMucG9wKCk7XG4gIGZvciAobGV0IGkgPSAxOyBpIDw9IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2FuZGlkYXRlUGF0aCA9IHNlZ21lbnRzLnNsaWNlKDAsIGkpLmpvaW4oXCIvXCIpO1xuICAgIGlmIChpc0RhdGFiYXNlUGF0aChjYW5kaWRhdGVQYXRoLCBwcmVmaXgpKSB7XG4gICAgICBjb25zdCBmb2xkZXIgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNhbmRpZGF0ZVBhdGgpO1xuICAgICAgaWYgKGZvbGRlciBpbnN0YW5jZW9mIFRGb2xkZXIpIHJldHVybiBmb2xkZXI7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBjb3VudE1hcmtkb3duRmlsZXMoYXBwLCBmb2xkZXJQYXRoKSB7XG4gIGNvbnN0IGNoaWxkUHJlZml4ID0gZm9sZGVyUGF0aCArIFwiL1wiO1xuICBsZXQgY291bnQgPSAwO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKSkge1xuICAgIGlmIChmaWxlLnBhdGguc3RhcnRzV2l0aChjaGlsZFByZWZpeCkpIGNvdW50Kys7XG4gIH1cbiAgcmV0dXJuIGNvdW50O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVGb2xkZXJCYWRnZShhcHAsIG5hdkZvbGRlciwgZm9sZGVyUGF0aCwgYXRFbmQpIHtcbiAgY29uc3QgdGl0bGVFbCA9IG5hdkZvbGRlci5xdWVyeVNlbGVjdG9yKFwiOnNjb3BlID4gLm5hdi1mb2xkZXItdGl0bGVcIik7XG4gIGlmICghdGl0bGVFbCkgcmV0dXJuO1xuICBjb25zdCBjb2xsYXBzZUljb24gPSB0aXRsZUVsLnF1ZXJ5U2VsZWN0b3IoXCI6c2NvcGUgPiAuY29sbGFwc2UtaWNvblwiKTtcblxuICAvLyBCYWRnZSBhdXMgZGVyIGpld2VpbHMgYW5kZXJlbiBQb3NpdGlvbiBlbnRmZXJuZW4sIGZhbGxzIGRpZSBFaW5zdGVsbHVuZ1xuICAvLyBzZWl0IGRlbSBsZXR6dGVuIFVwZGF0ZSBnZXdlY2hzZWx0IGhhdC5cbiAgaWYgKGF0RW5kICYmIGNvbGxhcHNlSWNvbikge1xuICAgIGNvbnN0IHN0YWxlID0gY29sbGFwc2VJY29uLnF1ZXJ5U2VsZWN0b3IoXCIuZnJlZC1kYi1jb3VudFwiKTtcbiAgICBpZiAoc3RhbGUpIHN0YWxlLnJlbW92ZSgpO1xuICB9XG4gIGlmICghYXRFbmQpIHtcbiAgICBjb25zdCBzdGFsZSA9IHRpdGxlRWwucXVlcnlTZWxlY3RvcihcIjpzY29wZSA+IC5mcmVkLWRiLWNvdW50XCIpO1xuICAgIGlmIChzdGFsZSkgc3RhbGUucmVtb3ZlKCk7XG4gIH1cblxuICBjb25zdCBwYXJlbnQgPSBhdEVuZCA/IHRpdGxlRWwgOiBjb2xsYXBzZUljb247XG4gIGlmICghcGFyZW50KSByZXR1cm47XG5cbiAgbGV0IGJhZGdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoXCI6c2NvcGUgPiAuZnJlZC1kYi1jb3VudFwiKTtcbiAgaWYgKCFiYWRnZSkge1xuICAgIGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBiYWRnZS5jbGFzc05hbWUgPSBhdEVuZCA/IFwibmF2LWZpbGUtdGFnIGZyZWQtZGItY291bnRcIiA6IFwiZnJlZC1kYi1jb3VudFwiO1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZChiYWRnZSk7XG4gIH1cbiAgYmFkZ2UudGV4dENvbnRlbnQgPSBTdHJpbmcoY291bnRNYXJrZG93bkZpbGVzKGFwcCwgZm9sZGVyUGF0aCkpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVGb2xkZXJCYWRnZShuYXZGb2xkZXIpIHtcbiAgbmF2Rm9sZGVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuZnJlZC1kYi1jb3VudFwiKS5mb3JFYWNoKChlbCkgPT4gZWwucmVtb3ZlKCkpO1xufVxuXG5mdW5jdGlvbiBzZXREYXRhYmFzZUZvbGRlckNsYXNzKHRpdGxlRWwsIGlzRGJGb2xkZXIpIHtcbiAgdGl0bGVFbC5jbGFzc0xpc3QudG9nZ2xlKFwiZnJlZC1kYi1mb2xkZXJcIiwgaXNEYkZvbGRlcik7XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3REYXRhYmFzZUZvbGRlcnMoYXBwLCBwcmVmaXgpIHtcbiAgY29uc3QgcmVzdWx0ID0gW107XG4gIGNvbnN0IHdhbGsgPSAoZm9sZGVyKSA9PiB7XG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiBmb2xkZXIuY2hpbGRyZW4pIHtcbiAgICAgIGlmICghKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikpIGNvbnRpbnVlO1xuICAgICAgaWYgKGlzRGF0YWJhc2VQYXRoKGNoaWxkLnBhdGgsIHByZWZpeCkpIHJlc3VsdC5wdXNoKGNoaWxkKTtcbiAgICAgIHdhbGsoY2hpbGQpO1xuICAgIH1cbiAgfTtcbiAgd2FsayhhcHAudmF1bHQuZ2V0Um9vdCgpKTtcbiAgcmV0dXJuIHJlc3VsdC5zb3J0KChhLCBiKSA9PiBhLnBhdGgubG9jYWxlQ29tcGFyZShiLnBhdGgpKTtcbn1cblxuLy8gRlx1MDBGQ3IgZGVuIEJlZmVobCBcIkRhdGVuYmFuay1PcmRuZXIgXHUwMEY2ZmZuZW4vc2NobGllXHUwMERGZW5cIjogRnV6enktQXVzd2FobCBcdTAwRkNiZXIgYWxsZVxuLy8gdm9yaGFuZGVuZW4gRGF0ZW5iYW5rLU9yZG5lciwgbWl0IEFuemVpZ2UsIG9iIHNpZSBha3R1ZWxsIG1hbnVlbGwgb2ZmZW4gc2luZC5cbmNsYXNzIERhdGFiYXNlRm9sZGVyUGlja2VyTW9kYWwgZXh0ZW5kcyBGdXp6eVN1Z2dlc3RNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgZm9sZGVycywgbWFudWFsbHlPcGVuUGF0aHMsIHJlc29sdmUpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuZm9sZGVycyA9IGZvbGRlcnM7XG4gICAgdGhpcy5tYW51YWxseU9wZW5QYXRocyA9IG1hbnVhbGx5T3BlblBhdGhzO1xuICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgdGhpcy5jaG9zZW4gPSBmYWxzZTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiRGF0ZW5iYW5rLU9yZG5lciB6dW0gXHUwMEQ2ZmZuZW4vU2NobGllXHUwMERGZW4gd1x1MDBFNGhsZW4gLSBFU0MgZlx1MDBGQ3IgQWJicnVjaFwiKTtcbiAgfVxuXG4gIGdldEl0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLmZvbGRlcnM7XG4gIH1cblxuICBnZXRJdGVtVGV4dChmb2xkZXIpIHtcbiAgICByZXR1cm4gZm9sZGVyLnBhdGg7XG4gIH1cblxuICByZW5kZXJTdWdnZXN0aW9uKG1hdGNoLCBlbCkge1xuICAgIGNvbnN0IGZvbGRlciA9IG1hdGNoLml0ZW07XG4gICAgY29uc3QgaXNPcGVuID0gdGhpcy5tYW51YWxseU9wZW5QYXRocy5oYXMoZm9sZGVyLnBhdGgpO1xuICAgIGVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmb2xkZXIucGF0aCB9KTtcbiAgICBjb25zdCBzdGF0ZSA9IGVsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpc09wZW4gPyBcImdlXHUwMEY2ZmZuZXRcIiA6IFwiZ2VzY2hsb3NzZW5cIiB9KTtcbiAgICBzdGF0ZS5zdHlsZS5mbG9hdCA9IFwicmlnaHRcIjtcbiAgICBzdGF0ZS5zdHlsZS5jb2xvciA9IFwidmFyKC0tdGV4dC1tdXRlZClcIjtcbiAgfVxuXG4gIHNlbGVjdFN1Z2dlc3Rpb24oaXRlbSwgZXZ0KSB7XG4gICAgdGhpcy5jaG9zZW4gPSB0cnVlO1xuICAgIHN1cGVyLnNlbGVjdFN1Z2dlc3Rpb24oaXRlbSwgZXZ0KTtcbiAgfVxuXG4gIG9uQ2hvb3NlSXRlbShmb2xkZXIpIHtcbiAgICB0aGlzLnJlc29sdmUoZm9sZGVyKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKSB7XG4gICAgc3VwZXIub25DbG9zZSgpO1xuICAgIGlmICghdGhpcy5jaG9zZW4pIHRoaXMucmVzb2x2ZShudWxsKTtcbiAgfVxufVxuXG4vLyBFcnNldHp0IGluIGRlciBEYXRlaS1FeHBsb3Jlci1BbnNpY2h0IGRhcyBaaWVsIHZvbiByZXZlYWxJbkZvbGRlcigpIGZcdTAwRkNyIGVpbmVcbi8vIERhdGVpIGlubmVyaGFsYiBlaW5lcyBEYXRlbmJhbmstT3JkbmVyczogc3RhdHQgenVyICh1bnNpY2h0YmFyZW4sIHdlaWwgZGVyXG4vLyBwYXRjaEZvbGRlckl0ZW0tUGF0Y2ggdW50ZW4gZGFzIEF1ZmtsYXBwZW4gb2huZWhpbiB2ZXJoaW5kZXJ0KSBEYXRlaSBzZWxic3Rcbi8vIHp1IHNwcmluZ2VuLCB3aXJkIGRlciBEYXRlbmJhbmstT3JkbmVyIHNlbGJzdCBnZXplaWd0LiBSZWluIGtvc21ldGlzY2ggLVxuLy8gZGFzcyBkZXIgT3JkbmVyIHp1IGJsZWlidCwgZ2FyYW50aWVydCBiZXJlaXRzIHBhdGNoRm9sZGVySXRlbSB1bnRlbixcbi8vIHVuYWJoXHUwMEU0bmdpZyBkYXZvbiwgd2VsY2hlcyBaaWVsIGhpZXIgZ2V3XHUwMEU0aGx0IHdpcmQuXG5mdW5jdGlvbiBwYXRjaFJldmVhbEluRm9sZGVyKHBsdWdpbiwgdmlldywgcGF0Y2hlZFZpZXdzKSB7XG4gIGlmICghdmlldyB8fCB0eXBlb2Ygdmlldy5yZXZlYWxJbkZvbGRlciAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm47XG4gIGlmICh2aWV3Ll9fZnJlZFJldmVhbE9yaWdpbmFsKSB7XG4gICAgcGF0Y2hlZFZpZXdzLmFkZCh2aWV3KTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3Qgb3JpZ2luYWwgPSB2aWV3LnJldmVhbEluRm9sZGVyLmJpbmQodmlldyk7XG4gIHZpZXcuX19mcmVkUmV2ZWFsT3JpZ2luYWwgPSBvcmlnaW5hbDtcbiAgdmlldy5yZXZlYWxJbkZvbGRlciA9IChpdGVtKSA9PiB7XG4gICAgaWYgKHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkICYmIGl0ZW0gaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgY29uc3QgZGJGb2xkZXIgPSBmaW5kRGF0YWJhc2VBbmNlc3RvckZvbGRlcihwbHVnaW4uYXBwLCBpdGVtLnBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCk7XG4gICAgICBpZiAoZGJGb2xkZXIpIHJldHVybiBvcmlnaW5hbChkYkZvbGRlcik7XG4gICAgfVxuICAgIHJldHVybiBvcmlnaW5hbChpdGVtKTtcbiAgfTtcbiAgcGF0Y2hlZFZpZXdzLmFkZCh2aWV3KTtcbn1cblxuLy8gRXJzZXR6dCB2aWV3LnJldmVhbEFjdGl2ZUZpbGUoKSAtIGxcdTAwRTR1ZnQgYmVpIGplZGVtIERhdGVpd2VjaHNlbCwgd2VubiBpbVxuLy8gRGF0ZWktRXhwbG9yZXIgXCJBa3R1ZWxsZSBEYXRlaSBhdXRvbWF0aXNjaCBhbnplaWdlblwiIGFrdGl2IGlzdC4gT2JzaWRpYW5zXG4vLyBlaWdlbmUgSW1wbGVtZW50aWVydW5nIGV4cGFuZGllcnQgendhciBkaWUgQWhuZW5rZXR0ZSAod2lya3VuZ3Nsb3MgZlx1MDBGQ3IgZGVuXG4vLyBEYXRlbmJhbmstT3JkbmVyIHNlbGJzdCBkYW5rIHBhdGNoRm9sZGVySXRlbSB1bnRlbiksIHNjcm9sbHQgZGFuYWNoIGFiZXIgenVyXG4vLyAtIGRhbm4gdW5zaWNodGJhciBibGVpYmVuZGVuIC0gRGF0ZWkgdW5kIHplaWd0IGRhYmVpIEtFSU5FIE1hcmtpZXJ1bmcgYW5cbi8vIChkYXMgbmF0aXZlIFwiQXVmYmxpdHplblwiIGdpYnQgZXMgbnVyIGJlaSByZXZlYWxJbkZvbGRlcigpLCBuaWNodCBoaWVyKS5cbi8vIExpZWd0IGRpZSBha3RpdmUgRGF0ZWkgaW4gZWluZW0gRGF0ZW5iYW5rLU9yZG5lciwgd2lyZCBkZXNoYWxiIHN0YXR0ZGVzc2VuXG4vLyB2aWV3LnJldmVhbEluRm9sZGVyKGRiRm9sZGVyKSBhdWZnZXJ1ZmVuOiBkaWVzZWxiZSBNZXRob2RlLCBkaWUgYXVjaCBkZXJcbi8vIEJlZmVobCBcIkRhdGVpIGltIE5hdmlnYXRvciBhbnplaWdlblwiIG51dHp0IC0ga2xhcHB0IEFobmVub3JkbmVyIGF1Ziwgc2Nyb2xsdFxuLy8genVtIE9yZG5lciB1bmQgbFx1MDBFNHNzdCBpaG4ga3VyeiBhdWZibGl0emVuLlxuLy9cbi8vIElzdCBkZXIgRGF0ZWktRXhwbG9yZXIgZ2VyYWRlIGdhciBuaWNodCBzaWNodGJhciwgd2lyZCB1bnZlclx1MDBFNG5kZXJ0IGFuXG4vLyBvcmlnaW5hbCgpIGRlbGVnaWVydDogT2JzaWRpYW4gbWVya3Qgc2ljaCBkYXMgZGFubiBzZWxic3Qgdm9yIHVuZCBydWZ0IGJlaVxuLy8gZXJuZXV0ZXIgU2ljaHRiYXJrZWl0IHZpZXcucmV2ZWFsQWN0aXZlRmlsZSgpICh6dSBkZW0gWmVpdHB1bmt0IGJlcmVpdHNcbi8vIHdpZWRlciBkaWVzZSBnZXBhdGNodGUgVmVyc2lvbikgYXV0b21hdGlzY2ggZXJuZXV0IGF1ZiAtIGdlbmF1IGRlciBGYWxsLCBpblxuLy8gZGVtIGRhcyBlcm5ldXRlIEZva3Vzc2llcmVuIGRlcyBEYXRlaS1FeHBsb3JlcnMgenV2b3IgbmljaHQgc2F1YmVyIGVyZmFzc3Rcbi8vIHd1cmRlLlxuZnVuY3Rpb24gcGF0Y2hSZXZlYWxBY3RpdmVGaWxlKHBsdWdpbiwgdmlldywgcGF0Y2hlZFZpZXdzKSB7XG4gIGlmICghdmlldyB8fCB0eXBlb2Ygdmlldy5yZXZlYWxBY3RpdmVGaWxlICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHZpZXcuX19mcmVkUmV2ZWFsQWN0aXZlT3JpZ2luYWwpIHtcbiAgICBwYXRjaGVkVmlld3MuYWRkKHZpZXcpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBvcmlnaW5hbCA9IHZpZXcucmV2ZWFsQWN0aXZlRmlsZS5iaW5kKHZpZXcpO1xuICB2aWV3Ll9fZnJlZFJldmVhbEFjdGl2ZU9yaWdpbmFsID0gb3JpZ2luYWw7XG4gIHZpZXcucmV2ZWFsQWN0aXZlRmlsZSA9ICgpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKSByZXR1cm4gb3JpZ2luYWwoKTtcbiAgICBpZiAoIXZpZXcuY29udGFpbmVyRWwuaXNTaG93bigpKSByZXR1cm4gb3JpZ2luYWwoKTtcblxuICAgIGNvbnN0IGZpbGVQYXRoID0gdmlldy5hY3RpdmVEb20/LmZpbGU/LnBhdGg7XG4gICAgY29uc3QgZGJGb2xkZXIgPSBmaWxlUGF0aFxuICAgICAgPyBmaW5kRGF0YWJhc2VBbmNlc3RvckZvbGRlcihwbHVnaW4uYXBwLCBmaWxlUGF0aCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KVxuICAgICAgOiBudWxsO1xuICAgIGlmICghZGJGb2xkZXIpIHJldHVybiBvcmlnaW5hbCgpO1xuXG4gICAgcmV0dXJuIHZpZXcucmV2ZWFsSW5Gb2xkZXIoZGJGb2xkZXIpO1xuICB9O1xuICBwYXRjaGVkVmlld3MuYWRkKHZpZXcpO1xufVxuXG4vLyBGXHUwMEU0bmd0IEF1Zi0vWnVrbGFwcC1WZXJzdWNoZSBkaXJla3QgYW4gZGVyIFF1ZWxsZSBhYiwgc3RhdHQgc2llIHJlYWt0aXYgcGVyXG4vLyBNdXRhdGlvbk9ic2VydmVyIHJcdTAwRkNja2dcdTAwRTRuZ2lnIHp1IG1hY2hlbiAoZGVyIHZvcmhlcmlnZSBBbnNhdHogLSBsaWVcdTAwREYgc2ljaFxuLy8gZHVyY2ggT2JzaWRpYW5zIHZpcnR1YWxpc2llcnRlIEJhdW1kYXJzdGVsbHVuZyB1bWdlaGVuLCB6LiBCLiBiZWltIGVybmV1dGVuXG4vLyBGb2t1c3NpZXJlbiBkZXMgRGF0ZWktRXhwbG9yZXJzLCB3ZW5uIGRlc3NlbiBcImluZmluaXR5U2Nyb2xsXCIgZlx1MDBGQ3Igd2llZGVyXG4vLyBzaWNodGJhcmUgWmVpbGVuIGZyaXNjaGUgRE9NLUVsZW1lbnRlIGVyemV1Z3QsIGRpZSBkZXIgT2JzZXJ2ZXIgbmljaHQgbWVoclxuLy8ga2VubnQpLlxuLy9cbi8vIHZpZXcuZmlsZUl0ZW1zW3BhdGhdIHNpbmQgT2JzaWRpYW5zIGVpZ2VuZSBPcmRuZXItSXRlbS1PYmpla3RlLiBKRURFUiBXZWcsXG4vLyBlaW5lbiBPcmRuZXIgYXVmenVrbGFwcGVuIC0gbmF0aXZlciBQZmVpbC1LbGljaywgXCJBbGxlIGF1ZmtsYXBwZW5cIixcbi8vIFwiQWt0dWVsbGUgRGF0ZWkgYXV0b21hdGlzY2ggYW56ZWlnZW5cIiwgcmV2ZWFsSW5Gb2xkZXIoKSBmXHUwMEZDciBlaW5lIERhdGVpXG4vLyBkYXJpbiwgamVkZSBrXHUwMEZDbmZ0aWdlIE9ic2lkaWFuLUZ1bmt0aW9uIC0gbFx1MDBFNHVmdCBsZXR6dGxpY2ggXHUwMEZDYmVyIGdlbmF1IGVpbmVcbi8vIE1ldGhvZGUgYW4gZGllc2VtIE9iamVrdDogaXRlbS5zZXRDb2xsYXBzZWQoKS4gKHRvZ2dsZUNvbGxhcHNlZCgpIHJ1ZnRcbi8vIGludGVybiB0aGlzLnNldENvbGxhcHNlZCgpIGF1ZiwgXCJBbGxlIGF1ZmtsYXBwZW5cIiBydWZ0IHRvZ2dsZUNvbGxhcHNlZCgpIGplXG4vLyBPcmRuZXItSXRlbSBhdWYgLSBiZWlkZXMgbGFuZGV0IGFsc28gZWJlbmZhbGxzIGhpZXIuKSBFaW4gZWlubWFsaWdlciBQYXRjaFxuLy8gZGllc2VyIGVpbmVuIE1ldGhvZGUgZGVja3Qgc29taXQgYXVzbmFobXNsb3MgamVkZW4gQXVzbFx1MDBGNnNlciBhYi5cbmZ1bmN0aW9uIHBhdGNoRm9sZGVySXRlbShwbHVnaW4sIGl0ZW0sIG1hbnVhbGx5T3BlblBhdGhzLCBwYXRjaGVkSXRlbXMpIHtcbiAgaWYgKCFpdGVtIHx8IHR5cGVvZiBpdGVtLnNldENvbGxhcHNlZCAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm47XG4gIGlmIChpdGVtLl9fZnJlZFNldENvbGxhcHNlZE9yaWdpbmFsKSB7XG4gICAgcGF0Y2hlZEl0ZW1zLmFkZChpdGVtKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBvcmlnaW5hbCA9IGl0ZW0uc2V0Q29sbGFwc2VkLmJpbmQoaXRlbSk7XG4gIGl0ZW0uX19mcmVkU2V0Q29sbGFwc2VkT3JpZ2luYWwgPSBvcmlnaW5hbDtcbiAgaXRlbS5zZXRDb2xsYXBzZWQgPSAoY29sbGFwc2VkLCBpbnN0YW50KSA9PiB7XG4gICAgY29uc3QgcGF0aCA9IGl0ZW0uZmlsZT8ucGF0aDtcbiAgICBjb25zdCBpc0RiRm9sZGVyID0gcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQgJiYgaXNEYXRhYmFzZVBhdGgocGF0aCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KTtcbiAgICBpZiAoaXNEYkZvbGRlciAmJiAhY29sbGFwc2VkICYmICFtYW51YWxseU9wZW5QYXRocy5oYXMocGF0aCkpIHtcbiAgICAgIC8vIEV4cGFuZC1WZXJzdWNoIGFiZ2VmYW5nZW4gLSBEYXRlbmJhbmstT3JkbmVyIGJsZWlidCB6dWdla2xhcHB0LlxuICAgICAgLy8gc2V0Q29sbGFwc2VkIGxpZWZlcnQgbm9ybWFsZXJ3ZWlzZSBlaW4gUHJvbWlzZTsgZWluIGF1ZmdlbFx1MDBGNnN0ZXNcbiAgICAgIC8vIFByb21pc2Ugc3RhdHQgdW5kZWZpbmVkIHp1clx1MDBGQ2NrenVnZWJlbiBoXHUwMEU0bHQgZGVuIFZlcnRyYWcgZlx1MDBGQ3IgQXVmcnVmZXJcbiAgICAgIC8vIGVpbiwgZGllICh3aWUgcmV2ZWFsSW5Gb2xkZXIgaW50ZXJuKSBkYXJhdWYgdmVya2V0dGVuLlxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWwoY29sbGFwc2VkLCBpbnN0YW50KTtcbiAgfTtcbiAgcGF0Y2hlZEl0ZW1zLmFkZChpdGVtKTtcblxuICAvLyBFaW5tYWxpZyBiZWltIFBhdGNoZW4gc2ljaGVyc3RlbGxlbiwgZGFzcyBkZXIgT3JkbmVyIHRhdHNcdTAwRTRjaGxpY2hcbiAgLy8genVnZWtsYXBwdCBpc3QgKHouIEIuIGZhbGxzIE9ic2lkaWFuIGlobiBhdXMgZGVtIGxldHp0ZW4gU2l0enVuZ3NzdGFuZFxuICAvLyBiZXJlaXRzIGF1Zmdla2xhcHB0IHdpZWRlcmhlcmdlc3RlbGx0IGhhdCkuXG4gIGNvbnN0IHBhdGggPSBpdGVtLmZpbGU/LnBhdGg7XG4gIGlmIChcbiAgICBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCAmJlxuICAgIGlzRGF0YWJhc2VQYXRoKHBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCkgJiZcbiAgICAhbWFudWFsbHlPcGVuUGF0aHMuaGFzKHBhdGgpICYmXG4gICAgaXRlbS5jb2xsYXBzZWQgIT09IHRydWVcbiAgKSB7XG4gICAgb3JpZ2luYWwodHJ1ZSwgdHJ1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJEYXRhYmFzZUZvbGRlcnMocGx1Z2luKSB7XG4gIGNvbnN0IHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gIHN0eWxlRWwuaWQgPSBcImZyZWQtZGF0YWJhc2UtZm9sZGVycy1zdHlsZVwiO1xuICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlRWwpO1xuXG4gIGNvbnN0IHdhdGNoZWRGb2xkZXJzID0gbmV3IE1hcCgpOyAvLyBwYXRoIC0+IG5hdkZvbGRlciAobnVyIGZcdTAwRkNyIGRpZSBCYWRnZS1BbnplaWdlKVxuICBjb25zdCBwYXRjaGVkSXRlbXMgPSBuZXcgU2V0KCk7XG4gIGNvbnN0IHBhdGNoZWRWaWV3cyA9IG5ldyBTZXQoKTtcbiAgLy8gRWluIE11dGF0aW9uT2JzZXJ2ZXIgcHJvIERhdGVpLUV4cGxvcmVyLVZpZXcgKHZpZXcuY29udGFpbmVyRWwgc2VsYnN0XG4gIC8vIHdpcmQgdm9uIE9ic2lkaWFucyB2aXJ0dWFsaXNpZXJ0ZW0gQmF1bSBuaWUgemVyc3RcdTAwRjZydCAtIHNpZWhlIHVudGVuIC1cbiAgLy8gbnVyIGVpbnplbG5lIFplaWxlbiB3ZXJkZW4gYXVzIGRlbSBET00gZW50ZmVybnQvd2llZGVyIGVpbmdlZlx1MDBGQ2d0KS5cbiAgY29uc3QgY29udGFpbmVyT2JzZXJ2ZXJzID0gbmV3IE1hcCgpOyAvLyB2aWV3IC0+IE11dGF0aW9uT2JzZXJ2ZXJcbiAgbGV0IHJlZnJlc2hTY2hlZHVsZWQgPSBmYWxzZTtcbiAgLy8gUGZhZGUgdm9uIERhdGVuYmFuay1PcmRuZXJuLCBkaWUgXHUwMEZDYmVyIGRlbiBCZWZlaGwgXCJEYXRlbmJhbmstT3JkbmVyXG4gIC8vIFx1MDBGNmZmbmVuL3NjaGxpZVx1MDBERmVuXCIgbWFudWVsbCBhdWZnZWtsYXBwdCB3dXJkZW4gLSBnaWx0IG51ciBmXHUwMEZDciBkaWUgbGF1ZmVuZGVcbiAgLy8gU2l0enVuZyAoYmV3dXNzdCBuaWNodCBwZXJzaXN0aWVydCksIHNpZWhlIHRvZ2dsZURhdGFiYXNlRm9sZGVyIHVudGVuLlxuICBjb25zdCBtYW51YWxseU9wZW5QYXRocyA9IG5ldyBTZXQoKTtcblxuICAvLyBPYnNpZGlhbnMgRGF0ZWktQmF1bSBpc3QgdmlydHVhbGlzaWVydCAodmlldy50cmVlLmluZmluaXR5U2Nyb2xsKTogWmVpbGVuXG4gIC8vIGF1XHUwMERGZXJoYWxiIGRlcyBzaWNodGJhcmVuIEJlcmVpY2hzIHdlcmRlbiBwZXIgZWwuZGV0YWNoKCkgYXVzIGRlbSBET01cbiAgLy8gZW50ZmVybnQgdW5kIGJlaW0gWnVyXHUwMEZDY2tzY3JvbGxlbiB3aWVkZXIgZWluZ2VmXHUwMEZDZ3QgLSBPSE5FIGRhc3MgZGFiZWkgZWluXG4gIC8vIFwibGF5b3V0LWNoYW5nZVwiLUV2ZW50IGZldWVydCAodmVyaWZpemllcnQgaW0gZW50cGFja3RlbiBPYnNpZGlhbi1CdW5kbGUsXG4gIC8vIHMuIEluZmluaXR5U2Nyb2xsLnVwZGF0ZSgpKS4gRWluIHJlaW5lciBET00tU2NhbiBiZWkgXCJsYXlvdXQtY2hhbmdlXCIgK1xuICAvLyBWYXVsdC1FdmVudHMgdmVycGFzc3QgZGVzaGFsYiBPcmRuZXIsIGRlcmVuIFplaWxlIGdlcmFkZSB1bnNpY2h0YmFyIGlzdCAtXG4gIC8vIGlociBCYWRnZSBibGVpYnQgZGFubiBmZWhsZW5kIG9kZXIgdmVyYWx0ZXQsIGJpcyBpcmdlbmRlaW4gYW5kZXJlciBHcnVuZFxuICAvLyB6dWZcdTAwRTRsbGlnIGVpbmVuIFJlc2NhbiBhdXNsXHUwMEY2c3QsIHdcdTAwRTRocmVuZCBkaWUgWmVpbGUgc2ljaHRiYXIgaXN0ICh6LiBCLlxuICAvLyBBbmtsaWNrZW4vRm9rdXNzaWVyZW4pLiB2aWV3LmNvbnRhaW5lckVsIHNlbGJzdCB3aXJkIGRhYmVpIG5pZSBlcnNldHp0LFxuICAvLyBudXIgZWluemVsbmUgWmVpbGVuLUVsZW1lbnRlIHdlcmRlbiBhbi0vYWJnZWhcdTAwRTRuZ3QgLSBlaW4gZGFyYXVmIGxhdXNjaGVuZGVyXG4gIC8vIE11dGF0aW9uT2JzZXJ2ZXIgYmVrb21tdCBkYWhlciBqZWRlIFplaWxlbi1cdTAwQzRuZGVydW5nIHp1dmVybFx1MDBFNHNzaWcgbWl0LlxuICBjb25zdCByZWZyZXNoV2F0Y2hlZEZvbGRlcnMgPSAoKSA9PiB7XG4gICAgZm9yIChjb25zdCBuYXZGb2xkZXIgb2Ygd2F0Y2hlZEZvbGRlcnMudmFsdWVzKCkpIHtcbiAgICAgIHJlbW92ZUZvbGRlckJhZGdlKG5hdkZvbGRlcik7XG4gICAgfVxuICAgIHdhdGNoZWRGb2xkZXJzLmNsZWFyKCk7XG5cbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKSB7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyZWQtZGItZm9sZGVyXCIpLmZvckVhY2goKGVsKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKFwiZnJlZC1kYi1mb2xkZXJcIikpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZWZpeCA9IHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeDtcbiAgICBmb3IgKGNvbnN0IGxlYWYgb2YgcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwiZmlsZS1leHBsb3JlclwiKSkge1xuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldztcbiAgICAgIHBhdGNoUmV2ZWFsSW5Gb2xkZXIocGx1Z2luLCB2aWV3LCBwYXRjaGVkVmlld3MpO1xuICAgICAgcGF0Y2hSZXZlYWxBY3RpdmVGaWxlKHBsdWdpbiwgdmlldywgcGF0Y2hlZFZpZXdzKTtcbiAgICAgIGVuc3VyZUNvbnRhaW5lck9ic2VydmVyKHZpZXcpO1xuXG4gICAgICAvLyBQYXRjaHQgYXVzbmFobXNsb3MgYWxsZSBEYXRlbmJhbmstT3JkbmVyLUl0ZW1zLCB1bmFiaFx1MDBFNG5naWcgZGF2b24sIG9iXG4gICAgICAvLyBpaHJlIFplaWxlIGFrdHVlbGwgaW0gKHZpcnR1YWxpc2llcnRlbikgRE9NIGdlcmVuZGVydCBpc3QgLSBhbmRlcnMgYWxzXG4gICAgICAvLyBkZXIgRE9NLVNjYW4gdW50ZW4sIGRlciBkYXMgZlx1MDBGQ3IgZGllIEJhZGdlLUFuemVpZ2UgYnJhdWNodC5cbiAgICAgIGZvciAoY29uc3QgcGF0aCBpbiB2aWV3LmZpbGVJdGVtcyA/PyB7fSkge1xuICAgICAgICBpZiAoIWlzRGF0YWJhc2VQYXRoKHBhdGgsIHByZWZpeCkpIGNvbnRpbnVlO1xuICAgICAgICBwYXRjaEZvbGRlckl0ZW0ocGx1Z2luLCB2aWV3LmZpbGVJdGVtc1twYXRoXSwgbWFudWFsbHlPcGVuUGF0aHMsIHBhdGNoZWRJdGVtcyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNldHp0IGRpZSBLbGFzc2UgZlx1MDBGQ3IgSkVERSBha3R1ZWxsIGdlcmVuZGVydGUgT3JkbmVyLVRpdGVsemVpbGUgKG5pY2h0XG4gICAgICAvLyBudXIgZlx1MDBGQ3IgVHJlZmZlcikgLSBzb25zdCB3XHUwMEZDcmRlIGVpbiBPcmRuZXIsIGRlciBzZWluIFByXHUwMEU0Zml4IHBlclxuICAgICAgLy8gVW1iZW5lbm51bmcgdmVybGllcnQsIGRpZSBLbGFzc2UgKHVuZCBkYW1pdCBkaWUgYXVzZ2VibGVuZGV0ZVxuICAgICAgLy8gUGZlaWwtRGFyc3RlbGx1bmcpIGZcdTAwRTRsc2NobGljaCBiZWhhbHRlbi5cbiAgICAgIHZpZXcuY29udGFpbmVyRWwucXVlcnlTZWxlY3RvckFsbChcIi5uYXYtZm9sZGVyLXRpdGxlW2RhdGEtcGF0aF1cIikuZm9yRWFjaCgodGl0bGVFbCkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gdGl0bGVFbC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXBhdGhcIik7XG4gICAgICAgIGNvbnN0IGlzRGJGb2xkZXIgPSBpc0RhdGFiYXNlUGF0aChwYXRoLCBwcmVmaXgpO1xuICAgICAgICBzZXREYXRhYmFzZUZvbGRlckNsYXNzKHRpdGxlRWwsIGlzRGJGb2xkZXIpO1xuICAgICAgICBpZiAoIWlzRGJGb2xkZXIpIHJldHVybjtcbiAgICAgICAgY29uc3QgbmF2Rm9sZGVyID0gdGl0bGVFbC5wYXJlbnRFbGVtZW50O1xuICAgICAgICBpZiAoIW5hdkZvbGRlciB8fCAhbmF2Rm9sZGVyLmNsYXNzTGlzdC5jb250YWlucyhcIm5hdi1mb2xkZXJcIikpIHJldHVybjtcblxuICAgICAgICB3YXRjaGVkRm9sZGVycy5zZXQocGF0aCwgbmF2Rm9sZGVyKTtcbiAgICAgICAgdXBkYXRlRm9sZGVyQmFkZ2UocGx1Z2luLmFwcCwgbmF2Rm9sZGVyLCBwYXRoLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICAvLyBCXHUwMEZDbmRlbHQgbWVocmVyZSBzY2huZWxsIGF1ZmVpbmFuZGVyZm9sZ2VuZGUgTXV0YXRpb25lbiAoei4gQi4gd1x1MDBFNGhyZW5kXG4gIC8vIGVpbmVzIFNjcm9sbHMpIHp1IGVpbmVtIFJlc2NhbiBwcm8gRnJhbWUuIERpZSBlaWdlbmVuIE11dGF0aW9uZW4gdm9uXG4gIC8vIHJlZnJlc2hXYXRjaGVkRm9sZGVycyAoQmFkZ2UtRWxlbWVudGUsIEtsYXNzZW4pIHdlcmRlbiBkYWZcdTAwRkNyIHBlclxuICAvLyBkaXNjb25uZWN0KCkvb2JzZXJ2ZSgpIHJ1bmQgdW0gZGVuIEF1ZnJ1ZiBhdXNnZWJsZW5kZXQgLSBzb25zdCB3XHUwMEZDcmRlIGRlclxuICAvLyBPYnNlcnZlciBzaWNoIHNlbGJzdCBsYXVmZW5kIGVybmV1dCBhdXNsXHUwMEY2c2VuLlxuICBjb25zdCBzY2hlZHVsZVJlZnJlc2ggPSAoKSA9PiB7XG4gICAgaWYgKHJlZnJlc2hTY2hlZHVsZWQpIHJldHVybjtcbiAgICByZWZyZXNoU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgcmVmcmVzaFNjaGVkdWxlZCA9IGZhbHNlO1xuICAgICAgZm9yIChjb25zdCBvYnNlcnZlciBvZiBjb250YWluZXJPYnNlcnZlcnMudmFsdWVzKCkpIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHJlZnJlc2hXYXRjaGVkRm9sZGVycygpO1xuICAgICAgZm9yIChjb25zdCBbdmlldywgb2JzZXJ2ZXJdIG9mIGNvbnRhaW5lck9ic2VydmVycykge1xuICAgICAgICBvYnNlcnZlci5vYnNlcnZlKHZpZXcuY29udGFpbmVyRWwsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGVuc3VyZUNvbnRhaW5lck9ic2VydmVyID0gKHZpZXcpID0+IHtcbiAgICBpZiAoY29udGFpbmVyT2JzZXJ2ZXJzLmhhcyh2aWV3KSkgcmV0dXJuO1xuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoc2NoZWR1bGVSZWZyZXNoKTtcbiAgICBvYnNlcnZlci5vYnNlcnZlKHZpZXcuY29udGFpbmVyRWwsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuICAgIGNvbnRhaW5lck9ic2VydmVycy5zZXQodmlldywgb2JzZXJ2ZXIpO1xuICB9O1xuXG4gIHBsdWdpbi5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkocmVmcmVzaFdhdGNoZWRGb2xkZXJzKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC53b3Jrc3BhY2Uub24oXCJsYXlvdXQtY2hhbmdlXCIsIHJlZnJlc2hXYXRjaGVkRm9sZGVycykpO1xuXG4gIC8vIEhcdTAwRTRsdCBkaWUgWlx1MDBFNGhsZXIgYWt0dWVsbCwgd2VubiBNYXJrZG93bi1EYXRlaWVuIGluIGVpbmVtIGJlb2JhY2h0ZXRlbiBPcmRuZXJcbiAgLy8gKG9kZXIgZWluZW0gVW50ZXJvcmRuZXIgZGF2b24pIGFuZ2VsZWd0L2dlbFx1MDBGNnNjaHQvdmVyc2Nob2JlbiB3ZXJkZW4uXG4gIGNvbnN0IHJlZnJlc2hCYWRnZUZvclBhdGggPSAocGF0aCkgPT4ge1xuICAgIGlmICghcGF0aCkgcmV0dXJuO1xuICAgIGZvciAoY29uc3QgW2ZvbGRlclBhdGgsIG5hdkZvbGRlcl0gb2Ygd2F0Y2hlZEZvbGRlcnMpIHtcbiAgICAgIGlmIChwYXRoID09PSBmb2xkZXJQYXRoIHx8IHBhdGguc3RhcnRzV2l0aChmb2xkZXJQYXRoICsgXCIvXCIpKSB7XG4gICAgICAgIHVwZGF0ZUZvbGRlckJhZGdlKHBsdWdpbi5hcHAsIG5hdkZvbGRlciwgZm9sZGVyUGF0aCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBjb25zdCBvblZhdWx0RmlsZUNoYW5nZSA9IChmaWxlLCBvbGRQYXRoKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikgcmV0dXJuO1xuICAgIHJlZnJlc2hCYWRnZUZvclBhdGgoZmlsZS5wYXRoKTtcbiAgICBpZiAob2xkUGF0aCkgcmVmcmVzaEJhZGdlRm9yUGF0aChvbGRQYXRoKTtcbiAgfTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCBvblZhdWx0RmlsZUNoYW5nZSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwiZGVsZXRlXCIsIG9uVmF1bHRGaWxlQ2hhbmdlKSk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAudmF1bHQub24oXCJyZW5hbWVcIiwgb25WYXVsdEZpbGVDaGFuZ2UpKTtcblxuICAvLyBFaW4gbmV1IGFuZ2VsZWd0ZXIgb2RlciB1bWJlbmFubnRlciBPcmRuZXIga2FubiBzb2ZvcnQgYXVmIGRlbiBQclx1MDBFNGZpeFxuICAvLyBwYXNzZW4gLSBoaWVyIGRpcmVrdCBwYXRjaGVuLCBzdGF0dCBhdWYgZGVuIG5cdTAwRTRjaHN0ZW4gTGF5b3V0LVdlY2hzZWwgenVcbiAgLy8gd2FydGVuLlxuICBjb25zdCBvblZhdWx0Rm9sZGVyQ2hhbmdlID0gKGZpbGUpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKSByZXR1cm47XG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSByZWZyZXNoV2F0Y2hlZEZvbGRlcnMoKTtcbiAgfTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCBvblZhdWx0Rm9sZGVyQ2hhbmdlKSk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAudmF1bHQub24oXCJyZW5hbWVcIiwgb25WYXVsdEZvbGRlckNoYW5nZSkpO1xuXG4gIC8vIEtsaWNrIGF1ZiBkZW4gTmFtZW4gc2VsYnN0IGJsZWlidCB1bmFuZ2V0YXN0ZXQgKHouIEIuIEZvbGRlciBOb3RlcyBcdTAwRjZmZm5ldCBkb3J0XG4gIC8vIHdpZSBnZXdvaG50IGRpZSB6dWdlaFx1MDBGNnJpZ2UgTm90aXopLiBLbGljayBkYW5lYmVuIChMZWVycmF1bSBkZXIgVGl0ZWx6ZWlsZSlcbiAgLy8gdW50ZXJkclx1MDBGQ2NrdCBudXIgZGFzIEF1Zi0vWnVrbGFwcGVuOyBjYXB0dXJlOnRydWUgcmVpY2h0IGRhZlx1MDBGQ3IsIHdlaWwgZGllXG4gIC8vIENhcHR1cmUtUGhhc2UgT2JzaWRpYW5zIGVpZ2VuZW0gVG9nZ2xlLUhhbmRsZXIgYW0gRWxlbWVudCBpbW1lciB2b3JhdXNnZWh0LlxuICBjb25zdCBvbkNsaWNrQ2FwdHVyZSA9IChldnQpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKSByZXR1cm47XG4gICAgY29uc3QgdGl0bGVFbCA9IGV2dC50YXJnZXQuY2xvc2VzdChcIi5uYXYtZm9sZGVyLXRpdGxlXCIpO1xuICAgIGlmICghaXNEYXRhYmFzZUZvbGRlclRpdGxlKHRpdGxlRWwsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCkpIHJldHVybjtcblxuICAgIGNvbnN0IG5hbWVFbCA9IHRpdGxlRWwucXVlcnlTZWxlY3RvcihcIi5uYXYtZm9sZGVyLXRpdGxlLWNvbnRlbnRcIik7XG4gICAgaWYgKG5hbWVFbCAmJiBuYW1lRWwuY29udGFpbnMoZXZ0LnRhcmdldCkpIHJldHVybjtcblxuICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZm9sZGVyTm90ZUNsaWNrRXh0ZW5zaW9uRW5hYmxlZCAmJiBuYW1lRWwpIHtcbiAgICAgIG5hbWVFbC5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBuZXcgTW91c2VFdmVudChcImNsaWNrXCIsIHtcbiAgICAgICAgICBidWJibGVzOiB0cnVlLFxuICAgICAgICAgIGNhbmNlbGFibGU6IHRydWUsXG4gICAgICAgICAgY3RybEtleTogZXZ0LmN0cmxLZXksXG4gICAgICAgICAgbWV0YUtleTogZXZ0Lm1ldGFLZXksXG4gICAgICAgICAgc2hpZnRLZXk6IGV2dC5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGV2dC5hbHRLZXksXG4gICAgICAgICAgYnV0dG9uOiBldnQuYnV0dG9uLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG4gIH07XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvbkNsaWNrQ2FwdHVyZSwgdHJ1ZSk7XG5cbiAgcGx1Z2luLnJlZ2lzdGVyKCgpID0+IHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgb25DbGlja0NhcHR1cmUsIHRydWUpO1xuICAgIGZvciAoY29uc3QgbmF2Rm9sZGVyIG9mIHdhdGNoZWRGb2xkZXJzLnZhbHVlcygpKSB7XG4gICAgICByZW1vdmVGb2xkZXJCYWRnZShuYXZGb2xkZXIpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcGF0Y2hlZEl0ZW1zKSB7XG4gICAgICBpZiAoaXRlbS5fX2ZyZWRTZXRDb2xsYXBzZWRPcmlnaW5hbCkge1xuICAgICAgICBpdGVtLnNldENvbGxhcHNlZCA9IGl0ZW0uX19mcmVkU2V0Q29sbGFwc2VkT3JpZ2luYWw7XG4gICAgICAgIGRlbGV0ZSBpdGVtLl9fZnJlZFNldENvbGxhcHNlZE9yaWdpbmFsO1xuICAgICAgfVxuICAgIH1cbiAgICBwYXRjaGVkSXRlbXMuY2xlYXIoKTtcbiAgICBmb3IgKGNvbnN0IHZpZXcgb2YgcGF0Y2hlZFZpZXdzKSB7XG4gICAgICBpZiAodmlldy5fX2ZyZWRSZXZlYWxPcmlnaW5hbCkge1xuICAgICAgICB2aWV3LnJldmVhbEluRm9sZGVyID0gdmlldy5fX2ZyZWRSZXZlYWxPcmlnaW5hbDtcbiAgICAgICAgZGVsZXRlIHZpZXcuX19mcmVkUmV2ZWFsT3JpZ2luYWw7XG4gICAgICB9XG4gICAgICBpZiAodmlldy5fX2ZyZWRSZXZlYWxBY3RpdmVPcmlnaW5hbCkge1xuICAgICAgICB2aWV3LnJldmVhbEFjdGl2ZUZpbGUgPSB2aWV3Ll9fZnJlZFJldmVhbEFjdGl2ZU9yaWdpbmFsO1xuICAgICAgICBkZWxldGUgdmlldy5fX2ZyZWRSZXZlYWxBY3RpdmVPcmlnaW5hbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcGF0Y2hlZFZpZXdzLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCBvYnNlcnZlciBvZiBjb250YWluZXJPYnNlcnZlcnMudmFsdWVzKCkpIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICBjb250YWluZXJPYnNlcnZlcnMuY2xlYXIoKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyZWQtZGItZm9sZGVyXCIpLmZvckVhY2goKGVsKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKFwiZnJlZC1kYi1mb2xkZXJcIikpO1xuICAgIHN0eWxlRWwucmVtb3ZlKCk7XG4gIH0pO1xuXG4gIGNvbnN0IHVwZGF0ZVN0eWxlID0gKCkgPT4ge1xuICAgIHN0eWxlRWwudGV4dENvbnRlbnQgPSBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZFxuICAgICAgPyBidWlsZFN0eWxlKFxuICAgICAgICAgIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCxcbiAgICAgICAgICBwbHVnaW4uc2V0dGluZ3MuZm9sZGVyTm90ZUNsaWNrRXh0ZW5zaW9uRW5hYmxlZCxcbiAgICAgICAgICBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJDb3VudEF0RW5kXG4gICAgICAgIClcbiAgICAgIDogXCJcIjtcbiAgICByZWZyZXNoV2F0Y2hlZEZvbGRlcnMoKTtcbiAgfTtcblxuICAvLyBTZXR6dCBkZW4gQXVmLS9adWdla2xhcHB0LVp1c3RhbmQgZWluZXMgZWluemVsbmVuIERhdGVuYmFuay1PcmRuZXJzIC0gZlx1MDBGQ3JcbiAgLy8gdG9nZ2xlRGF0YWJhc2VGb2xkZXIgdW50ZW4uIG1hbnVhbGx5T3BlblBhdGhzIHdpcmQgVk9SIGRlbSBlaWdlbnRsaWNoZW5cbiAgLy8gQXVmcnVmIGFrdHVhbGlzaWVydCwgd2VpbCBwYXRjaEZvbGRlckl0ZW0oKSBvYmVuIGdlbmF1IGRvcnQgbmFjaHNpZWh0LCBvYlxuICAvLyBlaW4gRXhwYW5kLVZlcnN1Y2ggZXJsYXVidCBpc3QuXG4gIGNvbnN0IHNldEZvbGRlck9wZW4gPSAocGF0aCwgb3BlbikgPT4ge1xuICAgIGlmIChvcGVuKSBtYW51YWxseU9wZW5QYXRocy5hZGQocGF0aCk7XG4gICAgZWxzZSBtYW51YWxseU9wZW5QYXRocy5kZWxldGUocGF0aCk7XG5cbiAgICBjb25zdCB2aWV3ID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwiZmlsZS1leHBsb3JlclwiKVswXT8udmlldztcbiAgICB2aWV3Py5maWxlSXRlbXM/LltwYXRoXT8uc2V0Q29sbGFwc2VkKCFvcGVuLCB0cnVlKTtcbiAgfTtcblxuICAvLyBGXHUwMEZDciBkZW4gQmVmZWhsOiBEYXRlaS1FeHBsb3JlciB6dW0gZ2V3XHUwMEU0aGx0ZW4gT3JkbmVyIHNjcm9sbGVuIChrbGFwcHQgZGFmXHUwMEZDclxuICAvLyBkZXNzZW4gRWx0ZXJub3JkbmVyIGF1Ziwgc29mZXJuIG5cdTAwRjZ0aWcpIC0gdW52ZXJcdTAwRTRuZGVydGVzIG5hdGl2ZXNcbiAgLy8gcmV2ZWFsSW5Gb2xkZXIsIGJldHJpZmZ0IG51ciBkaWUgQWhuZW5vcmRuZXIsIG5pY2h0IGRlbiBPcmRuZXIgc2VsYnN0LlxuICBjb25zdCByZXZlYWxEYXRhYmFzZUZvbGRlciA9IChmb2xkZXIpID0+IHtcbiAgICBjb25zdCBsZWFmID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwiZmlsZS1leHBsb3JlclwiKVswXTtcbiAgICBsZWFmPy52aWV3Py5yZXZlYWxJbkZvbGRlcj8uKGZvbGRlcik7XG4gIH07XG5cbiAgLy8gQmVmZWhsIFwiRGF0ZW5iYW5rLU9yZG5lciBcdTAwRjZmZm5lbi9zY2hsaWVcdTAwREZlblwiOiBsXHUwMEU0c3N0IGVpbmVuIERhdGVuYmFuay1PcmRuZXJcbiAgLy8gYXVzIGVpbmVyIEZ1enp5LUxpc3RlIHdcdTAwRTRobGVuIHVuZCBrZWhydCBkZXNzZW4gWnVzdGFuZCB1bS4gRGVyIHJlZ3VsXHUwMEU0cmVcbiAgLy8gS2xpY2sgYXVmIGVpbmVuIERhdGVuYmFuay1PcmRuZXIgYmxlaWJ0IGJld3Vzc3Qgd2VpdGVyIGJsb2NraWVydCAoc2llaGVcbiAgLy8gb25DbGlja0NhcHR1cmUgb2JlbikgLSBkaWVzZXIgQmVmZWhsIGlzdCBkZXIgZWluemlnZSBXZWcsIGVpbmVuIGVpbnplbG5lblxuICAvLyBEYXRlbmJhbmstT3JkbmVyIGdlemllbHQgYXVmLS96dXp1a2xhcHBlbi5cbiAgcGx1Z2luLnRvZ2dsZURhdGFiYXNlRm9sZGVyID0gKCkgPT4ge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQpIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJEYXRlbmJhbmstT3JkbmVyIHNpbmQgZGVha3RpdmllcnQuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBmb2xkZXJzID0gY29sbGVjdERhdGFiYXNlRm9sZGVycyhwbHVnaW4uYXBwLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpO1xuICAgIGlmIChmb2xkZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZShcIktlaW5lIERhdGVuYmFuay1PcmRuZXIgdm9yaGFuZGVuLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbmV3IERhdGFiYXNlRm9sZGVyUGlja2VyTW9kYWwocGx1Z2luLmFwcCwgZm9sZGVycywgbWFudWFsbHlPcGVuUGF0aHMsIChmb2xkZXIpID0+IHtcbiAgICAgIGlmICghZm9sZGVyKSByZXR1cm47XG4gICAgICBjb25zdCB3YXNPcGVuID0gbWFudWFsbHlPcGVuUGF0aHMuaGFzKGZvbGRlci5wYXRoKTtcbiAgICAgIHNldEZvbGRlck9wZW4oZm9sZGVyLnBhdGgsICF3YXNPcGVuKTtcbiAgICAgIGlmICghd2FzT3BlbikgcmV2ZWFsRGF0YWJhc2VGb2xkZXIoZm9sZGVyKTtcbiAgICB9KS5vcGVuKCk7XG4gIH07XG5cbiAgdXBkYXRlU3R5bGUoKTtcbiAgcmV0dXJuIHVwZGF0ZVN0eWxlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgcmVnaXN0ZXJEYXRhYmFzZUZvbGRlcnMgfTtcbiIsICJjb25zdCB7IFRGaWxlIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogVmVyc2NoYWNodGVsdGUgQ2hlY2tib3hlblxuICogQmVpbSAoRW50KUhha2VuIGVpbmVyIENoZWNrYm94IHdlcmRlbiBhdXRvbWF0aXNjaCBhbGxlIGRhcnVudGVyXG4gKiB2ZXJzY2hhY2h0ZWx0ZW4gQ2hlY2tib3hlbiBtaXQgKGVudCloYWt0IChLYXNrYWRlIG5hY2ggdW50ZW4pIC1cbiAqIHVuZCB1bWdla2VocnQ6IHNvYmFsZCBhbGxlIGRpcmVrdGVuIENoZWNrYm94LUtpbmRlciBlaW5lc1xuICogRWx0ZXJuLUVsZW1lbnRzIGFuZ2VoYWt0IHNpbmQsIHdpcmQgYXVjaCBkYXMgRWx0ZXJuLUVsZW1lbnRcbiAqIGFuZ2VoYWt0LCB1bmQgd2llZGVyIGVudGZlcm50LCBzb2JhbGQgZWluZXMgc2VpbmVyIEtpbmRlciB3aWVkZXJcbiAqIGFiZ2VoYWt0IHdpcmQgKEJ1YmJsZS11cCwgcmVrdXJzaXYgYmlzIHp1ciBXdXJ6ZWwpLlxuICpcbiAqIEVya2VubnVuZyBwZXIgRGlmZiBnZWdlbiBkZW4genVsZXR6dCBnZXNlaGVuZW4gSW5oYWx0IGRlciBEYXRlaVxuICogKG5pY2h0IHBlciBLbGljay1JbnRlcmNlcHRpb24pOiBmdW5rdGlvbmllcnQgZGFkdXJjaCB1bmFiaFx1MDBFNG5naWdcbiAqIGRhdm9uLCBvYiBkaWUgQ2hlY2tib3ggaW4gZGVyIFJlYWRpbmcgVmlldyBvZGVyIGluIGRlciBMaXZlXG4gKiBQcmV2aWV3IGFuZ2VrbGlja3Qgd3VyZGUsIG9obmUgYXVmIE9ic2lkaWFucyB1bmRva3VtZW50aWVydGVcbiAqIFJlbmRlci1JbnRlcm5hIGFuZ2V3aWVzZW4genUgc2Vpbi4gQXVzZ2VsXHUwMEY2c3Qgd2lyZCBudXIsIHdlbm4gc2ljaFxuICogZHVyY2ggZGllIFx1MDBDNG5kZXJ1bmcgZ2VuYXUgZWluZSBaZWlsZSB1bnRlcnNjaGVpZGV0IHVuZCBkaWVzZSBlaW5lXG4gKiBDaGVja2JveCBtaXQgdW52ZXJcdTAwRTRuZGVydGVyIEVpbnJcdTAwRkNja3VuZyBpc3QsIGRlcmVuIEhha2VuLVp1c3RhbmRcbiAqIHNpY2ggZ2VcdTAwRTRuZGVydCBoYXQgLSBhbGxlcyBhbmRlcmUgKE1laHJmYWNoXHUwMEU0bmRlcnVuZ2VuLCBUaXBwZW4sXG4gKiBFaW4tL0F1c3JcdTAwRkNja2VuLCBldGMuKSBibGVpYnQgdW5hbmdldGFzdGV0LlxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmNvbnN0IENIRUNLQk9YX0xJTkVfUkUgPSAvXihcXHMqKSg/OlstKitdfFxcZCtbLildKVxccytcXFsoLilcXF0vO1xuXG5mdW5jdGlvbiBwYXJzZUNoZWNrYm94TGluZShsaW5lKSB7XG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaChDSEVDS0JPWF9MSU5FX1JFKTtcbiAgcmV0dXJuIG1hdGNoID8geyBpbmRlbnQ6IG1hdGNoWzFdLmxlbmd0aCwgY2hhcjogbWF0Y2hbMl0gfSA6IG51bGw7XG59XG5cbi8vIG51bGwgZlx1MDBGQ3IgbGVlcmUvbnVyLUxlZXJ6ZWljaGVuLVplaWxlbiwgZGEgc2llIGZcdTAwRkNyIGRpZSBWZXJzY2hhY2h0ZWx1bmdzdGllZmUgbmljaHQgelx1MDBFNGhsZW4uXG5mdW5jdGlvbiBpbmRlbnRPZihsaW5lKSB7XG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXihcXHMqKVxcUy8pO1xuICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXS5sZW5ndGggOiBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0NoZWNrZWQoY2hhcikge1xuICByZXR1cm4gY2hhciAhPT0gXCIgXCI7XG59XG5cbmZ1bmN0aW9uIHNldENoZWNrYm94Q2hhcihsaW5lLCBuZXdDaGFyKSB7XG4gIHJldHVybiBsaW5lLnJlcGxhY2UoQ0hFQ0tCT1hfTElORV9SRSwgKHdob2xlKSA9PiB3aG9sZS5zbGljZSgwLCAtMikgKyBuZXdDaGFyICsgXCJdXCIpO1xufVxuXG4vLyBMaWVmZXJ0IGRpZSBaZWlsZW4gbWl0IGFuZ2V3ZW5kZXRlciBLYXNrYWRlLCBvZGVyIG51bGwsIHdlbm4gc2ljaCBuaWNodHMgXHUwMEU0bmRlcnQuXG5mdW5jdGlvbiBjb21wdXRlQ2FzY2FkZShsaW5lcywgdG9nZ2xlZEluZGV4KSB7XG4gIGNvbnN0IHRvZ2dsZWQgPSBwYXJzZUNoZWNrYm94TGluZShsaW5lc1t0b2dnbGVkSW5kZXhdKTtcbiAgaWYgKCF0b2dnbGVkKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCByZXN1bHQgPSBsaW5lcy5zbGljZSgpO1xuICBsZXQgdG91Y2hlZCA9IGZhbHNlO1xuICBjb25zdCBub3dDaGVja2VkID0gaXNDaGVja2VkKHRvZ2dsZWQuY2hhcik7XG4gIGNvbnN0IG5ld0NoYXIgPSBub3dDaGVja2VkID8gXCJ4XCIgOiBcIiBcIjtcblxuICAvLyBOYWNoIHVudGVuOiBhbGxlIHZlcnNjaGFjaHRlbHRlbiBDaGVja2JveGVuIGF1ZiBkZW5zZWxiZW4gWnVzdGFuZCBicmluZ2VuLlxuICBmb3IgKGxldCBpID0gdG9nZ2xlZEluZGV4ICsgMTsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGluZCA9IGluZGVudE9mKHJlc3VsdFtpXSk7XG4gICAgaWYgKGluZCAhPT0gbnVsbCAmJiBpbmQgPD0gdG9nZ2xlZC5pbmRlbnQpIGJyZWFrO1xuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQ2hlY2tib3hMaW5lKHJlc3VsdFtpXSk7XG4gICAgaWYgKHBhcnNlZCAmJiBpc0NoZWNrZWQocGFyc2VkLmNoYXIpICE9PSBub3dDaGVja2VkKSB7XG4gICAgICByZXN1bHRbaV0gPSBzZXRDaGVja2JveENoYXIocmVzdWx0W2ldLCBuZXdDaGFyKTtcbiAgICAgIHRvdWNoZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8vIE5hY2ggb2JlbjogRWx0ZXJuLUNoZWNrYm94ZW4gYW5oYW5kIGlocmVyIGRpcmVrdGVuIEtpbmRlciBuZXUgYmV3ZXJ0ZW4sXG4gIC8vIHJla3Vyc2l2IHdlaXRlciBuYWNoIG9iZW4sIHNvbGFuZ2Ugc2ljaCBkYWR1cmNoIHRhdHNcdTAwRTRjaGxpY2ggZXR3YXMgXHUwMEU0bmRlcnQuXG4gIGxldCBjaGlsZEluZGVudCA9IHRvZ2dsZWQuaW5kZW50O1xuICBsZXQgY3Vyc29yID0gdG9nZ2xlZEluZGV4O1xuICBmb3IgKDs7KSB7XG4gICAgbGV0IHBhcmVudEluZGV4ID0gLTE7XG4gICAgZm9yIChsZXQgaSA9IGN1cnNvciAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBpbmQgPSBpbmRlbnRPZihyZXN1bHRbaV0pO1xuICAgICAgaWYgKGluZCA9PT0gbnVsbCkgY29udGludWU7XG4gICAgICBpZiAoaW5kIDwgY2hpbGRJbmRlbnQpIHtcbiAgICAgICAgcGFyZW50SW5kZXggPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBhcmVudEluZGV4ID09PSAtMSkgYnJlYWs7XG5cbiAgICBjb25zdCBwYXJlbnQgPSBwYXJzZUNoZWNrYm94TGluZShyZXN1bHRbcGFyZW50SW5kZXhdKTtcbiAgICBpZiAoIXBhcmVudCkgYnJlYWs7IC8vIEVsdGVybi1FbGVtZW50IGlzdCBrZWluZSBDaGVja2JveCAtPiBoaWVyIGVuZGV0IGRhcyBIb2NoYmx1YmJlcm4uXG5cbiAgICBsZXQgZGlyZWN0Q2hpbGRJbmRlbnQgPSBudWxsO1xuICAgIGxldCBoYXNDaGVja2JveENoaWxkID0gZmFsc2U7XG4gICAgbGV0IGFsbENoZWNrZWQgPSB0cnVlO1xuICAgIGZvciAobGV0IGkgPSBwYXJlbnRJbmRleCArIDE7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGluZCA9IGluZGVudE9mKHJlc3VsdFtpXSk7XG4gICAgICBpZiAoaW5kID09PSBudWxsKSBjb250aW51ZTtcbiAgICAgIGlmIChpbmQgPD0gcGFyZW50LmluZGVudCkgYnJlYWs7XG4gICAgICBpZiAoZGlyZWN0Q2hpbGRJbmRlbnQgPT09IG51bGwpIGRpcmVjdENoaWxkSW5kZW50ID0gaW5kO1xuICAgICAgaWYgKGluZCAhPT0gZGlyZWN0Q2hpbGRJbmRlbnQpIGNvbnRpbnVlOyAvLyB0aWVmZXIgdmVyc2NoYWNodGVsdGVzIEVua2Vsa2luZCwgaGllciBpcnJlbGV2YW50LlxuICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VDaGVja2JveExpbmUocmVzdWx0W2ldKTtcbiAgICAgIGlmICghcGFyc2VkKSBjb250aW51ZTtcbiAgICAgIGhhc0NoZWNrYm94Q2hpbGQgPSB0cnVlO1xuICAgICAgaWYgKCFpc0NoZWNrZWQocGFyc2VkLmNoYXIpKSBhbGxDaGVja2VkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCFoYXNDaGVja2JveENoaWxkKSBicmVhaztcbiAgICBpZiAoaXNDaGVja2VkKHBhcmVudC5jaGFyKSA9PT0gYWxsQ2hlY2tlZCkgYnJlYWs7IC8vIHNjaG9uIGltIHJpY2h0aWdlbiBadXN0YW5kIC0+IHdlaXRlciBvYmVuIFx1MDBFNG5kZXJ0IHNpY2ggbmljaHRzIG1laHIuXG5cbiAgICByZXN1bHRbcGFyZW50SW5kZXhdID0gc2V0Q2hlY2tib3hDaGFyKHJlc3VsdFtwYXJlbnRJbmRleF0sIGFsbENoZWNrZWQgPyBcInhcIiA6IFwiIFwiKTtcbiAgICB0b3VjaGVkID0gdHJ1ZTtcbiAgICBjaGlsZEluZGVudCA9IHBhcmVudC5pbmRlbnQ7XG4gICAgY3Vyc29yID0gcGFyZW50SW5kZXg7XG4gIH1cblxuICByZXR1cm4gdG91Y2hlZCA/IHJlc3VsdCA6IG51bGw7XG59XG5cbi8vIEVya2VubnQgZWluIGVpbmZhY2hlcyBVbXNjaGFsdGVuIChnZW5hdSBlaW5lIENoZWNrYm94LVplaWxlIG1pdCB1bnZlclx1MDBFNG5kZXJ0ZXJcbi8vIEVpbnJcdTAwRkNja3VuZywgZGVyZW4gSGFrZW4tWnVzdGFuZCBzaWNoIGdlXHUwMEU0bmRlcnQgaGF0KSB6d2lzY2hlbiB6d2VpIFRleHRzdFx1MDBFNG5kZW5cbi8vIGdsZWljaGVyIFplaWxlbnphaGwsIHNvbnN0IC0xIChNZWhyZmFjaFx1MDBFNG5kZXJ1bmcsIFRpcHBlbiwgRWluLS9BdXNyXHUwMEZDY2tlbiBldGMuKS5cbmZ1bmN0aW9uIGRldGVjdFRvZ2dsZShwcmV2VGV4dCwgbmV3VGV4dCkge1xuICBpZiAocHJldlRleHQgPT09IHVuZGVmaW5lZCB8fCBwcmV2VGV4dCA9PT0gbmV3VGV4dCkgcmV0dXJuIC0xO1xuICBjb25zdCBvbGRMaW5lcyA9IHByZXZUZXh0LnNwbGl0KFwiXFxuXCIpO1xuICBjb25zdCBuZXdMaW5lcyA9IG5ld1RleHQuc3BsaXQoXCJcXG5cIik7XG4gIGlmIChvbGRMaW5lcy5sZW5ndGggIT09IG5ld0xpbmVzLmxlbmd0aCkgcmV0dXJuIC0xO1xuXG4gIGxldCBjaGFuZ2VkSW5kZXggPSAtMTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRMaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChvbGRMaW5lc1tpXSAhPT0gbmV3TGluZXNbaV0pIHtcbiAgICAgIGlmIChjaGFuZ2VkSW5kZXggIT09IC0xKSByZXR1cm4gLTE7XG4gICAgICBjaGFuZ2VkSW5kZXggPSBpO1xuICAgIH1cbiAgfVxuICBpZiAoY2hhbmdlZEluZGV4ID09PSAtMSkgcmV0dXJuIC0xO1xuXG4gIGNvbnN0IGJlZm9yZSA9IHBhcnNlQ2hlY2tib3hMaW5lKG9sZExpbmVzW2NoYW5nZWRJbmRleF0pO1xuICBjb25zdCBhZnRlciA9IHBhcnNlQ2hlY2tib3hMaW5lKG5ld0xpbmVzW2NoYW5nZWRJbmRleF0pO1xuICBpZiAoIWJlZm9yZSB8fCAhYWZ0ZXIgfHwgYmVmb3JlLmluZGVudCAhPT0gYWZ0ZXIuaW5kZW50KSByZXR1cm4gLTE7XG4gIGlmIChpc0NoZWNrZWQoYmVmb3JlLmNoYXIpID09PSBpc0NoZWNrZWQoYWZ0ZXIuY2hhcikpIHJldHVybiAtMTtcbiAgcmV0dXJuIGNoYW5nZWRJbmRleDtcbn1cblxuLy8gWndlaSB1bmFiaFx1MDBFNG5naWdlIEVya2VubnVuZ3N3ZWdlLCBkYSBPYnNpZGlhbiBDaGVja2JveC1LbGlja3MgamUgbmFjaCBBbnNpY2h0XG4vLyB1bnRlcnNjaGllZGxpY2ggcGVyc2lzdGllcnQ6XG4vLyAtIFJlYWRpbmcgVmlldyBzcGVpY2hlcnQgc29mb3J0IChsXHUwMEY2c3QgXCJ2YXVsdCBtb2RpZnlcIiBkaXJla3QgYXVzKS5cbi8vIC0gTGl2ZSBQcmV2aWV3L1NvdXJjZS1Nb2R1cyBcdTAwRTRuZGVydCB6dW5cdTAwRTRjaHN0IG51ciBkZW4gRWRpdG9yLVB1ZmZlcjsgZGFzXG4vLyAgIHRhdHNcdTAwRTRjaGxpY2hlIFNjaHJlaWJlbiBhdWYgZGllIEZlc3RwbGF0dGUgKHVuZCBkYW1pdCBcInZhdWx0IG1vZGlmeVwiKSBpc3Rcbi8vICAgdW0gMnMgZGVib3VuY2VkIChPYnNpZGlhbnMgZWlnZW5lciBBdXRvc2F2ZSkgLSB2aWVsIHp1IHNwXHUwMEU0dCBmXHUwMEZDciBlaW5lXG4vLyAgIEthc2thZGUsIGRpZSBzaWNoIHdpZSBlaW4gZWluemVsbmVyLCB1bnVudGVyYnJvY2hlbmVyIEtsaWNrIGFuZlx1MDBGQ2hsZW4gc29sbC5cbi8vICAgRGFmXHUwMEZDciBmZXVlcnQgXCJlZGl0b3ItY2hhbmdlXCIgc3luY2hyb24gYmVpIGplZGVyIEVkaXRvci1cdTAwQzRuZGVydW5nIHVuZCBsaWVzdFxuLy8gICBkaXJla3QgYXVzIGRlbSBFZGl0b3ItUHVmZmVyIHN0YXR0IHZvbiBkZXIgRmVzdHBsYXR0ZS5cbi8vIEJlaWRlIFdlZ2UgdGVpbGVuIHNpY2ggZGVuc2VsYmVuIGxhc3RDb250ZW50LUNhY2hlLCBkYW1pdCBkZXIgamV3ZWlscyBhbmRlcmVcbi8vIFdlZyBlaW5lIGJlcmVpdHMgdmVyYXJiZWl0ZXRlIFx1MDBDNG5kZXJ1bmcgbmljaHQgZWluIHp3ZWl0ZXMgTWFsIGF1ZmdyZWlmdC5cbi8vIEVpbiBDaGVja2JveC1LbGljayBrYW5uIG51ciBpbiBlaW5lciBnZXJhZGUgb2ZmZW5lbiBBbnNpY2h0IHBhc3NpZXJlbiAtXG4vLyBIaW50ZXJncnVuZC1TcGVpY2hlcnVuZ2VuIG5pY2h0IGFuZ2V6ZWlndGVyIE5vdGl6ZW4gKHouIEIuIGR1cmNoIGFuZGVyZVxuLy8gUGx1Z2lucykgbVx1MDBGQ3NzZW4gd2lyIGRhaGVyIHdlZGVyIHZlcmZvbGdlbiBub2NoIGNhY2hlbi5cbmZ1bmN0aW9uIGlzRmlsZU9wZW4ocGx1Z2luLCBwYXRoKSB7XG4gIHJldHVybiBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5zb21lKChsZWFmKSA9PiBsZWFmLnZpZXc/LmZpbGU/LnBhdGggPT09IHBhdGgpO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlck5lc3RlZENoZWNrYm94U3luYyhwbHVnaW4pIHtcbiAgY29uc3QgbGFzdENvbnRlbnQgPSBuZXcgTWFwKCk7IC8vIFBmYWQgLT4genVsZXR6dCBnZXNlaGVuZXIgSW5oYWx0LCBudXIgZlx1MDBGQ3IgZ2VyYWRlIG9mZmVuZSBOb3RpemVuXG4gIGNvbnN0IGFwcGx5aW5nID0gbmV3IFNldCgpOyAvLyBQZmFkZSwgZlx1MDBGQ3IgZGllIGdlcmFkZSBzZWxic3QgZWluZSBLYXNrYWRlIGdlc2NocmllYmVuIHdpcmQgKEVjaG8vUmVlbnRyYW56IGlnbm9yaWVyZW4pXG5cbiAgY29uc3QgZm9yZ2V0ID0gKHBhdGgpID0+IHtcbiAgICBsYXN0Q29udGVudC5kZWxldGUocGF0aCk7XG4gICAgYXBwbHlpbmcuZGVsZXRlKHBhdGgpO1xuICB9O1xuXG4gIC8vIFJcdTAwRTR1bXQgYmVpbSBcdTAwRDZmZm5lbiBlaW5lciBOb3RpeiBuZWJlbmJlaSBFaW50clx1MDBFNGdlIGZcdTAwRkNyIGluendpc2NoZW4gZ2VzY2hsb3NzZW5lXG4gIC8vIFRhYnMgd2VnLCBzdGF0dCBsYXN0Q29udGVudCBcdTAwRkNiZXIgZGllIGdhbnplIFNlc3Npb24gdW5iZWdyZW56dCB3YWNoc2VuIHp1IGxhc3Nlbi5cbiAgY29uc3QgcHJ1bmVDbG9zZWRGaWxlcyA9ICgpID0+IHtcbiAgICBpZiAobGFzdENvbnRlbnQuc2l6ZSA9PT0gMCkgcmV0dXJuO1xuICAgIGNvbnN0IG9wZW5QYXRocyA9IG5ldyBTZXQoXG4gICAgICBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXCJtYXJrZG93blwiKS5tYXAoKGxlYWYpID0+IGxlYWYudmlldz8uZmlsZT8ucGF0aCkuZmlsdGVyKEJvb2xlYW4pXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IHBhdGggb2YgbGFzdENvbnRlbnQua2V5cygpKSB7XG4gICAgICBpZiAoIW9wZW5QYXRocy5oYXMocGF0aCkpIGxhc3RDb250ZW50LmRlbGV0ZShwYXRoKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3Qgc2VlZCA9IGFzeW5jIChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MubmVzdGVkQ2hlY2tib3hTeW5jRW5hYmxlZCkgcmV0dXJuO1xuICAgIHBydW5lQ2xvc2VkRmlsZXMoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybjtcbiAgICBpZiAobGFzdENvbnRlbnQuaGFzKGZpbGUucGF0aCkpIHJldHVybjtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBhd2FpdCBwbHVnaW4uYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSkpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVZhdWx0TW9kaWZ5ID0gYXN5bmMgKGZpbGUpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5uZXN0ZWRDaGVja2JveFN5bmNFbmFibGVkKSByZXR1cm47XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgaWYgKGFwcGx5aW5nLmhhcyhmaWxlLnBhdGgpKSByZXR1cm47XG4gICAgaWYgKCFpc0ZpbGVPcGVuKHBsdWdpbiwgZmlsZS5wYXRoKSkgcmV0dXJuOyAvLyBrZWluIENoZWNrYm94LUtsaWNrIG1cdTAwRjZnbGljaCAtPiBuaWNodHMgenUgdHVuXG5cbiAgICBjb25zdCBuZXdUZXh0ID0gYXdhaXQgcGx1Z2luLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xuICAgIGNvbnN0IHByZXZUZXh0ID0gbGFzdENvbnRlbnQuZ2V0KGZpbGUucGF0aCk7XG4gICAgbGFzdENvbnRlbnQuc2V0KGZpbGUucGF0aCwgbmV3VGV4dCk7XG5cbiAgICBjb25zdCBpZHggPSBkZXRlY3RUb2dnbGUocHJldlRleHQsIG5ld1RleHQpO1xuICAgIGlmIChpZHggPT09IC0xKSByZXR1cm47XG5cbiAgICBjb25zdCBuZXdMaW5lcyA9IG5ld1RleHQuc3BsaXQoXCJcXG5cIik7XG4gICAgY29uc3QgY2FzY2FkZWQgPSBjb21wdXRlQ2FzY2FkZShuZXdMaW5lcywgaWR4KTtcbiAgICBpZiAoIWNhc2NhZGVkKSByZXR1cm47XG4gICAgY29uc3QgZmluYWxUZXh0ID0gY2FzY2FkZWQuam9pbihcIlxcblwiKTtcblxuICAgIGFwcGx5aW5nLmFkZChmaWxlLnBhdGgpO1xuICAgIGxhc3RDb250ZW50LnNldChmaWxlLnBhdGgsIGZpbmFsVGV4dCk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHBsdWdpbi5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoKSA9PiBmaW5hbFRleHQpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBhcHBseWluZy5kZWxldGUoZmlsZS5wYXRoKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRWRpdG9yQ2hhbmdlID0gKGVkaXRvciwgaW5mbykgPT4ge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQpIHJldHVybjtcbiAgICBjb25zdCBmaWxlID0gaW5mbz8uZmlsZTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybjtcbiAgICBpZiAoYXBwbHlpbmcuaGFzKGZpbGUucGF0aCkpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld1RleHQgPSBlZGl0b3IuZ2V0VmFsdWUoKTtcbiAgICBjb25zdCBwcmV2VGV4dCA9IGxhc3RDb250ZW50LmdldChmaWxlLnBhdGgpO1xuICAgIGxhc3RDb250ZW50LnNldChmaWxlLnBhdGgsIG5ld1RleHQpO1xuXG4gICAgY29uc3QgaWR4ID0gZGV0ZWN0VG9nZ2xlKHByZXZUZXh0LCBuZXdUZXh0KTtcbiAgICBpZiAoaWR4ID09PSAtMSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3TGluZXMgPSBuZXdUZXh0LnNwbGl0KFwiXFxuXCIpO1xuICAgIGNvbnN0IGNhc2NhZGVkID0gY29tcHV0ZUNhc2NhZGUobmV3TGluZXMsIGlkeCk7XG4gICAgaWYgKCFjYXNjYWRlZCkgcmV0dXJuO1xuXG4gICAgLy8gTnVyIGRpZSB0YXRzXHUwMEU0Y2hsaWNoIGFid2VpY2hlbmRlbiBaZWlsZW4gZXJzZXR6ZW4gKGRpZSB1bWdlc2NoYWx0ZXRlIFplaWxlXG4gICAgLy8gc2VsYnN0IGlzdCBiZXJlaXRzIGFuZ2V3ZW5kZXQpIC0gYWxzIGVpbmUgZ2VtZWluc2FtZSBUcmFuc2FrdGlvbiwgZGFtaXRcbiAgICAvLyBDdXJzb3IvVW5kby1IaXN0b3JpZSBzYXViZXIgYmxlaWJlbiB1bmQgbmljaHQgbWVocmZhY2ggcmVlbnRyYW50IGdlZmV1ZXJ0IHdpcmQuXG4gICAgY29uc3QgY2hhbmdlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FzY2FkZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpID09PSBpZHggfHwgY2FzY2FkZWRbaV0gPT09IG5ld0xpbmVzW2ldKSBjb250aW51ZTtcbiAgICAgIGNoYW5nZXMucHVzaCh7IGZyb206IHsgbGluZTogaSwgY2g6IDAgfSwgdG86IHsgbGluZTogaSwgY2g6IG5ld0xpbmVzW2ldLmxlbmd0aCB9LCB0ZXh0OiBjYXNjYWRlZFtpXSB9KTtcbiAgICB9XG4gICAgaWYgKGNoYW5nZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBjb25zdCBmaW5hbFRleHQgPSBjYXNjYWRlZC5qb2luKFwiXFxuXCIpO1xuICAgIGFwcGx5aW5nLmFkZChmaWxlLnBhdGgpO1xuICAgIGxhc3RDb250ZW50LnNldChmaWxlLnBhdGgsIGZpbmFsVGV4dCk7XG4gICAgdHJ5IHtcbiAgICAgIGVkaXRvci50cmFuc2FjdGlvbih7IGNoYW5nZXMgfSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGFwcGx5aW5nLmRlbGV0ZShmaWxlLnBhdGgpO1xuICAgIH1cbiAgfTtcblxuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwibW9kaWZ5XCIsIGhhbmRsZVZhdWx0TW9kaWZ5KSk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFwiZWRpdG9yLWNoYW5nZVwiLCBoYW5kbGVFZGl0b3JDaGFuZ2UpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW9wZW5cIiwgc2VlZCkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwiZGVsZXRlXCIsIChmaWxlKSA9PiBmb3JnZXQoZmlsZS5wYXRoKSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIChfZmlsZSwgb2xkUGF0aCkgPT4gZm9yZ2V0KG9sZFBhdGgpKSk7XG4gIHBsdWdpbi5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgIGNvbnN0IGFjdGl2ZSA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBpZiAoYWN0aXZlKSBzZWVkKGFjdGl2ZSk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgcmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmMsIGNvbXB1dGVDYXNjYWRlLCBwYXJzZUNoZWNrYm94TGluZSB9O1xuIiwgImNvbnN0IENPTU1BTkRfSUQgPSBcImVkaXRvcjp0b2dnbGUtaXRhbGljc1wiO1xuXG4vLyBPYnNpZGlhbnMgZWlnZW5lciBcIkt1cnNpdlwiLUJlZmVobCBmXHUwMEZDZ3QgYmVpbSBFaW5mXHUwMEZDZ2VuIG5ldWVyIEZvcm1hdGllcnVuZyBmZXN0XG4vLyBcIiouLi4qXCIgZWluICh1Zi5pdGFsaWMuc3Vycm91bmRpbmdDaGFycyBpbiBPYnNpZGlhbnMgRWRpdG9yLUJ1bmRsZSkgLSBcIl9cIlxuLy8gd2lyZCBkb3J0IG51ciBhbHMgYWx0U3Vycm91bmRpbmdDaGFycyB6dXIgRVJLRU5OVU5HL0VOVEZFUk5VTkcgYmVyZWl0c1xuLy8gdm9yaGFuZGVuZXIgS3Vyc2l2Zm9ybWF0aWVydW5nIGFremVwdGllcnQsIG5pZSBiZWltIEVpbmZcdTAwRkNnZW4gdmVyd2VuZGV0LiB1ZlxuLy8gc2VsYnN0IGlzdCBUZWlsIGVpbmVzIHByaXZhdGVuIENsb3N1cmUtT2JqZWt0cyBvaG5lIFx1MDBGNmZmZW50bGljaGVuIFp1Z3JpZmYsXG4vLyB0b2dnbGVNYXJrZG93bkZvcm1hdHRpbmcoKSAoRWRpdG9yLnByb3RvdHlwZSwgYXVmZ2VydWZlbiBcdTAwRkNiZXIgZGVuIG5hdGl2ZW5cbi8vIEJlZmVobCkgYWJlciBnZW5hdXNvIHdlbmlnIFx1MDBGQ2JlcnNjaHJlaWJiYXIsIG9obmUgT2JzaWRpYW5zIGVpZ2VuZSBMaXN0ZW4tL1xuLy8gVGFiZWxsZW4tL01laHJmYWNoYXVzd2FobC1Mb2dpayBuYWNoenViYXVlbi5cbi8vXG4vLyBEZXIgc2NobWFsc3RlIEVpbmdyaWZmc3B1bmt0IGxpZWd0IGVpbmUgRWJlbmUgdGllZmVyOiB0b2dnbGVNYXJrZG93bkZvcm1hdHRpbmdcbi8vIGJhdXQgYWxsZSBcdTAwQzRuZGVydW5nZW4gaW4gZWluIEFycmF5IGF1cyB7ZnJvbSx0byxpbnNlcnR9LU9iamVrdGVuIHVuZCBydWZ0IGFtXG4vLyBFbmRlIEdFTkFVIEVJTk1BTCB0aGlzLmNtLmRpc3BhdGNoKHtjaGFuZ2VzOi4uLn0pIGF1ZiAodGhpcy5jbSA9IGVkaXRvci5jbSxcbi8vIGRpZSByb2hlIENvZGVNaXJyb3ItRWRpdG9yVmlldyAtIGVpbmUgc3RhYmlsZSBJbnN0YW56LVByb3BlcnR5LCBzaWVoZVxuLy8gRWRpdG9yLUtvbnN0cnVrdG9yIGltIEJ1bmRsZTogXCJ0aGlzLmNtPWVcIikuIEplZGUgZnJpc2NoIGVpbmdlZlx1MDBGQ2d0ZVxuLy8gS3Vyc2l2LU1hcmtpZXJ1bmcgZXJzY2hlaW50IGRhcmluIGFscyBlaWdlbmVyIENoYW5nZSBtaXQgaW5zZXJ0PT09XCIqXCJcbi8vICh1Zi5pdGFsaWMuc3Vycm91bmRpbmdDaGFycykgLSBFbnRmZXJudW5nZW4gYmVzdGVoZW5kZXIgTWFya2VyIChlZ2FsIG9iIFwiKlwiXG4vLyBvZGVyIFwiX1wiKSBsYXVmZW4gZGFnZWdlbiBpbW1lciBhbHMgaW5zZXJ0OlwiXCIuIERpc3BhdGNoIGZcdTAwRkNyIGRpZSBEYXVlciBkaWVzZXNcbi8vIGVpbmVuIEF1ZnJ1ZnMgYWJ6dWZhbmdlbiB1bmQgaW5zZXJ0PT09XCIqXCIgYXVmIGluc2VydDpcIl9cIiB1bXp1c2NocmVpYmVuLFxuLy8gbFx1MDBFNHNzdCBPYnNpZGlhbnMga29tcGxldHRlIFNlbGVjdGlvbi0vV29ydC0vTGlzdGVuLS9UYWJlbGxlbi1Mb2dpa1xuLy8gdW5hbmdldGFzdGV0IC0gaW5rbHVzaXZlIGRlciBGXHUwMEU0bGxlLCBpbiBkZW5lbiBzaWUgZWluZSBtZWhyemVpbGlnZSBBdXN3YWhsXG4vLyAoei4gQi4gbWVocmVyZSBMaXN0ZW5laW50clx1MDBFNGdlKSBpbiBtZWhyZXJlIHNlcGFyYXRlIFwiKi4uLipcIi1QYWFyZSBwcm8gWmVpbGVcbi8vIGF1ZnRlaWx0LlxuLy9cbi8vIEdyZW56ZmFsbCB2ZXJzY2hhY2h0ZWx0ZSBGb3JtYXRpZXJ1bmcgKHouIEIuIEt1cnNpdiBhdWYgbnVyIGRhcyBXb3J0IGluXG4vLyBcIioqfGZldHR8KipcIiwgb2RlciBhdWYgZGVuIGdhbnplbiBGZXR0LUJsb2NrIGlua2wuIFN0ZXJuY2hlbiBcInwqKmZldHQqKnxcIlxuLy8gYW5nZXdlbmRldCk6IGVpbiBmcmlzY2ggZWluZ2VmXHUwMEZDZ3RlciBcIl9cIiBsYW5kZXQgZGFiZWkgZGlyZWt0IG5lYmVuXG4vLyBiZXN0ZWhlbmRlbSBcIioqXCIgKFwiKipfZmV0dF8qKlwiIGJ6dy4gXCJfKipmZXR0KipfXCIpLiBVcnNwclx1MDBGQ25nbGljaCB3dXJkZSBkaWVzZVxuLy8gVW13YW5kbHVuZyBkZXNoYWxiIGJsb2NraWVydCAoRmFsbGJhY2sgYXVmIHVuc2NoXHUwMEY2bmVzLCBhYmVyIFwic2ljaGVyZXNcIlxuLy8gXCIqKipmZXR0KioqXCIpLCB3ZWlsIE9ic2lkaWFucyBlaWdlbmUgRXJrZW5udW5nIGdlbmF1IGRpZXNlbiBGYWxsIGJlaW1cbi8vIGVybmV1dGVuIEF1c3NjaGFsdGVuIHZvbiBLdXJzaXYgZmFsc2NoIGJlaGFuZGVsdCBoXHUwMEU0dHRlIHVuZCBkYWJlaSBlaW5lblxuLy8gQm9sZC1TdGVybiBqZSBTZWl0ZSBtaXRnZWZyZXNzZW4gaFx1MDBFNHR0ZS4gZHJvcFNwdXJpb3VzQm9sZFN0YXJSZW1vdmFscygpXG4vLyB1bnRlbiByZXBhcmllcnQgZ2VuYXUgZGFzIGpldHp0IGRpcmVrdCBhbiBkZXIgUXVlbGxlICh1bmFiaFx1MDBFNG5naWcgZGF2b24sIHdpZVxuLy8gZGllIFZlcnNjaGFjaHRlbHVuZyBlbnRzdGFuZGVuIGlzdCkgLSBkaWUgVW13YW5kbHVuZyBzZWxic3QgYnJhdWNodCBkYWhlclxuLy8ga2VpbmUgU29uZGVyYmVoYW5kbHVuZyBtZWhyIHVuZCBsXHUwMEU0dWZ0IGZcdTAwRkNyIGplZGVzIGZyaXNjaCBlaW5nZWZcdTAwRkNndGUgXCIqXCJcbi8vIGdsZWljaC5cblxuLy8gU3BpZWdlbGJpbGRsaWNoZXMgUHJvYmxlbSBiZWltIEVOVEZFUk5FTjogbGllZ3QgYmVyZWl0cyB2b3JoYW5kZW5lciBUZXh0IHdpZVxuLy8gXCJfKip3b3J0KipfXCIgdm9yIChLdXJzaXYgYXVcdTAwREZlbiBtaXQgXCJfXCIsIEZldHQgaW5uZW4gbWl0IFwiKipcIiAtIHouIEIuIHdlaWxcbi8vIGplbWFuZCBkYXMgdm9uIEhhbmQgc28gZ2V0aXBwdCBoYXQpLCBmaW5kZXQgT2JzaWRpYW5zIGVpZ2VuZSBTdWNoLS9cbi8vIEVudGZlcm51bmdzbG9naWsgKHlmKCkvZ2YoKSkgYmVpbSBBdXNzY2hhbHRlbiB2b24gS3Vyc2l2IHp3YXIga29ycmVrdCBiZWlkZVxuLy8gXCJfXCItTWFya2VyLCBlbnRmZXJudCBkYWJlaSBhYmVyIFpVU1x1MDBDNFRaTElDSCBqZSBlaW4gXCIqXCIgYXVzIGRlbSB2ZXJzY2hhY2h0ZWx0ZW5cbi8vIFwiKipcIiAtIHdlaWwgZGVzc2VuIE1hcmtlciAoZGEgaW5uZXJoYWxiIGRlciBLdXJzaXZzcGFubmUgbGllZ2VuZCkgZWJlbmZhbGxzXG4vLyBkYXMgXCJlbVwiLVRhZyB0cmFnZW4gdW5kIGdmKCkncyBUYWctQ2hlY2sga2VpbmVuIFVudGVyc2NoaWVkIHp3aXNjaGVuIGVpbmVtXG4vLyBhbGxlaW5zdGVoZW5kZW4gS3Vyc2l2LVwiKlwiIHVuZCBkZW0gZXJzdGVuIFplaWNoZW4gZWluZXMgbFx1MDBFNG5nZXJlbiBcIioqXCItTGF1ZnNcbi8vIG1hY2h0IChcIl8qKndvcnQqKl9cIiAtPiBcIip3b3J0KlwiIHN0YXR0IFwiKip3b3J0KipcIikuIEJldHJpZmZ0IG51ciBcIipcIi1cbi8vIEVudGZlcm51bmdlbiAodWYuaXRhbGljLnN1cnJvdW5kaW5nQ2hhcnMpLCBcIl9cIi1FbnRmZXJudW5nZW4gKGFsdFN1cnJvdW5kaW5nLVxuLy8gQ2hhcnMpIHNpbmQgZGF2b24gbmllIGJldHJvZmZlbiwgZGEgXCJfXCIgbmllIFRlaWwgZWluZXMgXCIqKlwiLUxhdWZzIGlzdC5cbi8vIEplZGUgTFx1MDBGNnNjaHVuZywgZGVyZW4gZWluemVsbmVzIFplaWNoZW4gaW0gKG5vY2ggdW52ZXJcdTAwRTRuZGVydGVuKSBEb2t1bWVudFxuLy8gZGlyZWt0IG5lYmVuIGVpbmVtIHdlaXRlcmVuIFwiKlwiIGxpZWd0LCBrYW5uIGRhaGVyIGdlZmFocmxvcyB2ZXJ3b3JmZW5cbi8vIHdlcmRlbiAtIGRpZSBlY2h0ZW4gXCJfXCItTFx1MDBGNnNjaHVuZ2VuIGJsZWliZW4gdW5hbmdldGFzdGV0IHN0ZWhlbi5cbmZ1bmN0aW9uIGRyb3BTcHVyaW91c0JvbGRTdGFyUmVtb3ZhbHMoZG9jLCBjaGFuZ2VzKSB7XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGNvbnN0IGtlcHQgPSBjaGFuZ2VzLmZpbHRlcigoY2hhbmdlKSA9PiB7XG4gICAgaWYgKGNoYW5nZS5pbnNlcnQgIT09IFwiXCIgfHwgY2hhbmdlLnRvIC0gY2hhbmdlLmZyb20gIT09IDEpIHJldHVybiB0cnVlO1xuICAgIGlmIChkb2Muc2xpY2VTdHJpbmcoY2hhbmdlLmZyb20sIGNoYW5nZS50bykgIT09IFwiKlwiKSByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCBiZWZvcmUgPSBjaGFuZ2UuZnJvbSA+IDAgPyBkb2Muc2xpY2VTdHJpbmcoY2hhbmdlLmZyb20gLSAxLCBjaGFuZ2UuZnJvbSkgOiBcIlwiO1xuICAgIGNvbnN0IGFmdGVyID0gY2hhbmdlLnRvIDwgZG9jLmxlbmd0aCA/IGRvYy5zbGljZVN0cmluZyhjaGFuZ2UudG8sIGNoYW5nZS50byArIDEpIDogXCJcIjtcbiAgICBpZiAoYmVmb3JlICE9PSBcIipcIiAmJiBhZnRlciAhPT0gXCIqXCIpIHJldHVybiB0cnVlO1xuICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSk7XG4gIHJldHVybiBjaGFuZ2VkID8ga2VwdCA6IGNoYW5nZXM7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVySXRhbGljVW5kZXJzY29yZShwbHVnaW4pIHtcbiAgY29uc3QgcGF0Y2ggPSAoKSA9PiB7XG4gICAgY29uc3QgY21kID0gcGx1Z2luLmFwcC5jb21tYW5kcy5jb21tYW5kc1tDT01NQU5EX0lEXTtcbiAgICBpZiAoIWNtZCB8fCBjbWQuX19mcmVkSXRhbGljUGF0Y2hlZCkgcmV0dXJuO1xuICAgIGNtZC5fX2ZyZWRJdGFsaWNQYXRjaGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IG9yaWdpbmFsID0gY21kLmVkaXRvckNhbGxiYWNrO1xuICAgIGNtZC5lZGl0b3JDYWxsYmFjayA9IGZ1bmN0aW9uIChlZGl0b3IsIGN0eCkge1xuICAgICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuaXRhbGljVW5kZXJzY29yZUVuYWJsZWQpIHJldHVybiBvcmlnaW5hbC5jYWxsKHRoaXMsIGVkaXRvciwgY3R4KTtcblxuICAgICAgY29uc3QgY20gPSBlZGl0b3IuY207XG4gICAgICBjb25zdCBvcmlnaW5hbERpc3BhdGNoID0gY20uZGlzcGF0Y2guYmluZChjbSk7XG4gICAgICBjbS5kaXNwYXRjaCA9IGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICAgIGlmIChzcGVjICYmIEFycmF5LmlzQXJyYXkoc3BlYy5jaGFuZ2VzKSkge1xuICAgICAgICAgIGNvbnN0IGRvYyA9IGNtLnN0YXRlLmRvYztcbiAgICAgICAgICBmb3IgKGNvbnN0IGNoYW5nZSBvZiBzcGVjLmNoYW5nZXMpIHtcbiAgICAgICAgICAgIGlmIChjaGFuZ2UuaW5zZXJ0ID09PSBcIipcIikgY2hhbmdlLmluc2VydCA9IFwiX1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCByZXBhaXJlZCA9IGRyb3BTcHVyaW91c0JvbGRTdGFyUmVtb3ZhbHMoZG9jLCBzcGVjLmNoYW5nZXMpO1xuICAgICAgICAgIGlmIChyZXBhaXJlZCAhPT0gc3BlYy5jaGFuZ2VzKSB7XG4gICAgICAgICAgICAvLyBBbnphaGwvTFx1MDBFNG5nZSBkZXIgQ2hhbmdlcyBoYXQgc2ljaCBnZVx1MDBFNG5kZXJ0IC0gT2JzaWRpYW5zIGVpZ2VuZSxcbiAgICAgICAgICAgIC8vIGF1ZiBkZW0gT1JJR0lOQUwtQ2hhbmdlc2V0IGJlcmVjaG5ldGUgU2VsZWN0aW9uIHdcdTAwRTRyZSBqZXR6dCBhblxuICAgICAgICAgICAgLy8gZmFsc2NoZXIgUG9zaXRpb24uIHNlbGVjdGlvbiB3ZWdsYXNzZW4gdW5kIENNNiBkaWUgKFN0YW5kYXJkLSlcbiAgICAgICAgICAgIC8vIEFiYmlsZHVuZyBkZXIgYmlzaGVyaWdlbiBTZWxlY3Rpb24gZHVyY2ggZGllIENoYW5nZXMgc2VsYnN0XG4gICAgICAgICAgICAvLyBcdTAwRkNiZXJuZWhtZW4gbGFzc2VuLCBzdGF0dCBzaWUgaGllciB2b24gSGFuZCBuYWNoenVyZWNobmVuLlxuICAgICAgICAgICAgY29uc3QgeyBzZWxlY3Rpb24sIC4uLnJlc3QgfSA9IHNwZWM7XG4gICAgICAgICAgICBzcGVjID0geyAuLi5yZXN0LCBjaGFuZ2VzOiByZXBhaXJlZCB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JpZ2luYWxEaXNwYXRjaChzcGVjKTtcbiAgICAgIH07XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gb3JpZ2luYWwuY2FsbCh0aGlzLCBlZGl0b3IsIGN0eCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBjbS5kaXNwYXRjaCA9IG9yaWdpbmFsRGlzcGF0Y2g7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHBsdWdpbi5yZWdpc3RlcigoKSA9PiB7XG4gICAgICBjbWQuZWRpdG9yQ2FsbGJhY2sgPSBvcmlnaW5hbDtcbiAgICAgIGRlbGV0ZSBjbWQuX19mcmVkSXRhbGljUGF0Y2hlZDtcbiAgICB9KTtcbiAgfTtcblxuICBwbHVnaW4uYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHBhdGNoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVySXRhbGljVW5kZXJzY29yZSB9O1xuIiwgImNvbnN0IHsgUGx1Z2luIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5jb25zdCB7IERFRkFVTFRfU0VUVElOR1MsIEZyZWRTZXR0aW5nVGFiIH0gPSByZXF1aXJlKFwiLi9zZXR0aW5nc1wiKTtcbmNvbnN0IHsgcmVnaXN0ZXJDb21tYW5kcyB9ID0gcmVxdWlyZShcIi4vY29tbWFuZHNcIik7XG5jb25zdCB7IHJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzIH0gPSByZXF1aXJlKFwiLi9kYXRhYmFzZS1mb2xkZXJzXCIpO1xuY29uc3QgeyByZWdpc3RlclByb3BlcnR5QmFja2xpbmtzTGl2ZSB9ID0gcmVxdWlyZShcIi4vcHJvcGVydHktc3luY1wiKTtcbmNvbnN0IHsgcmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmMgfSA9IHJlcXVpcmUoXCIuL25lc3RlZC1jaGVja2JveGVzXCIpO1xuY29uc3QgeyByZWdpc3RlckltcG9ydGFudFBsdWdpbnMgfSA9IHJlcXVpcmUoXCIuL2ltcG9ydGFudC1wbHVnaW5zXCIpO1xuY29uc3QgeyByZWdpc3Rlckl0YWxpY1VuZGVyc2NvcmUgfSA9IHJlcXVpcmUoXCIuL2l0YWxpYy11bmRlcnNjb3JlXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIEZyZWRQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICByZWdpc3RlckNvbW1hbmRzKHRoaXMpO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRnJlZFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB0aGlzLnVwZGF0ZURhdGFiYXNlRm9sZGVyU3R5bGUgPSByZWdpc3RlckRhdGFiYXNlRm9sZGVycyh0aGlzKTtcbiAgICByZWdpc3RlclByb3BlcnR5QmFja2xpbmtzTGl2ZSh0aGlzKTtcbiAgICByZWdpc3Rlck5lc3RlZENoZWNrYm94U3luYyh0aGlzKTtcbiAgICB0aGlzLnJlZnJlc2hJbXBvcnRhbnRQbHVnaW5Db21tYW5kcyA9IHJlZ2lzdGVySW1wb3J0YW50UGx1Z2lucyh0aGlzKTtcbiAgICByZWdpc3Rlckl0YWxpY1VuZGVyc2NvcmUodGhpcyk7XG4gIH1cblxuICBvbnVubG9hZCgpIHt9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7QUFBQTtBQUFBLDZCQUFBQSxVQUFBQyxTQUFBO0FBQUEsUUFBTSxFQUFFLG1CQUFtQixPQUFPLElBQUksUUFBUSxVQUFVO0FBVXhELFFBQU0sb0JBQU4sY0FBZ0Msa0JBQWtCO0FBQUEsTUFDaEQsWUFBWSxLQUFLLFdBQVcsU0FBUztBQUNuQyxjQUFNLEdBQUc7QUFDVCxhQUFLLFlBQVk7QUFDakIsYUFBSyxVQUFVO0FBQ2YsYUFBSyxTQUFTO0FBQ2QsYUFBSyxlQUFlLG9CQUFpQjtBQUFBLE1BQ3ZDO0FBQUEsTUFFQSxXQUFXO0FBQ1QsZUFBTyxLQUFLO0FBQUEsTUFDZDtBQUFBLE1BRUEsWUFBWSxVQUFVO0FBQ3BCLGVBQU8sU0FBUztBQUFBLE1BQ2xCO0FBQUEsTUFFQSxpQkFBaUIsTUFBTSxLQUFLO0FBQzFCLGFBQUssU0FBUztBQUNkLGNBQU0saUJBQWlCLE1BQU0sR0FBRztBQUFBLE1BQ2xDO0FBQUEsTUFFQSxhQUFhLFVBQVU7QUFDckIsYUFBSyxRQUFRLFNBQVMsRUFBRTtBQUFBLE1BQzFCO0FBQUEsTUFFQSxVQUFVO0FBQ1IsY0FBTSxRQUFRO0FBQ2QsWUFBSSxDQUFDLEtBQUssT0FBUSxNQUFLLFFBQVEsSUFBSTtBQUFBLE1BQ3JDO0FBQUEsSUFDRjtBQUVBLGFBQVMsVUFBVSxLQUFLLElBQUk7QUFDMUIsYUFBTyxPQUFPLFVBQVUsZUFBZSxLQUFLLElBQUksUUFBUSxTQUFTLEVBQUU7QUFBQSxJQUNyRTtBQU9BLGFBQVMsMEJBQTBCLFFBQVE7QUFDekMsYUFBTyxPQUFPLFNBQVMsaUJBQ3BCLE9BQU8sQ0FBQyxPQUFPLFVBQVUsT0FBTyxLQUFLLEVBQUUsQ0FBQyxFQUN4QyxJQUFJLENBQUMsT0FBTyxPQUFPLElBQUksUUFBUSxVQUFVLEVBQUUsQ0FBQyxFQUM1QyxPQUFPLE9BQU87QUFBQSxJQUNuQjtBQUVBLGFBQVMsbUJBQW1CLEtBQUssSUFBSTtBQUNuQyxVQUFJLFFBQVEsS0FBSztBQUNqQixVQUFJLENBQUMsSUFBSSxRQUFRLFlBQVksRUFBRSxFQUFHLEtBQUksT0FBTyxnREFBZ0Q7QUFBQSxJQUMvRjtBQU9BLG1CQUFlLGtDQUFrQyxRQUFRO0FBQ3ZELFlBQU0sWUFBWSwwQkFBMEIsTUFBTTtBQUVsRCxVQUFJLFVBQVUsV0FBVyxHQUFHO0FBQzFCLFlBQUksT0FBTyxpR0FBaUc7QUFDNUc7QUFBQSxNQUNGO0FBQ0EsVUFBSSxVQUFVLFdBQVcsR0FBRztBQUMxQiwyQkFBbUIsT0FBTyxLQUFLLFVBQVUsQ0FBQyxFQUFFLEVBQUU7QUFDOUM7QUFBQSxNQUNGO0FBRUEsWUFBTSxLQUFLLE1BQU0sSUFBSSxRQUFRLENBQUMsWUFBWSxJQUFJLGtCQUFrQixPQUFPLEtBQUssV0FBVyxPQUFPLEVBQUUsS0FBSyxDQUFDO0FBQ3RHLFVBQUksR0FBSSxvQkFBbUIsT0FBTyxLQUFLLEVBQUU7QUFBQSxJQUMzQztBQU9BLFFBQU0sdUJBQXVCLG9CQUFJLElBQUk7QUFFckMsYUFBUyxhQUFhLFVBQVU7QUFDOUIsYUFBTyxRQUFRLFFBQVE7QUFBQSxJQUN6QjtBQUVBLGFBQVMseUJBQXlCLFFBQVE7QUFDeEMsWUFBTSxVQUFVLElBQUksSUFBSSwwQkFBMEIsTUFBTSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxTQUFTLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztBQUVsSCxpQkFBVyxNQUFNLHNCQUFzQjtBQUNyQyxZQUFJLFFBQVEsSUFBSSxFQUFFLEVBQUc7QUFDckIsZUFBTyxJQUFJLFNBQVMsY0FBYyxHQUFHLE9BQU8sU0FBUyxFQUFFLElBQUksRUFBRSxFQUFFO0FBQy9ELDZCQUFxQixPQUFPLEVBQUU7QUFBQSxNQUNoQztBQUVBLGlCQUFXLENBQUMsSUFBSSxRQUFRLEtBQUssU0FBUztBQUNwQyxZQUFJLHFCQUFxQixJQUFJLEVBQUUsRUFBRztBQUNsQyxlQUFPLFdBQVc7QUFBQSxVQUNoQjtBQUFBLFVBQ0EsTUFBTSxRQUFRLFNBQVMsSUFBSTtBQUFBLFVBQzNCLFVBQVUsTUFBTSxtQkFBbUIsT0FBTyxLQUFLLFNBQVMsRUFBRTtBQUFBLFFBQzVELENBQUM7QUFDRCw2QkFBcUIsSUFBSSxFQUFFO0FBQUEsTUFDN0I7QUFBQSxJQUNGO0FBRUEsYUFBU0MsMEJBQXlCLFFBQVE7QUFDeEMsWUFBTSxVQUFVLE1BQU0seUJBQXlCLE1BQU07QUFFckQsYUFBTyxjQUFjLE9BQU8sSUFBSSxRQUFRLEdBQUcsV0FBVyxPQUFPLENBQUM7QUFDOUQsYUFBTyxJQUFJLFVBQVUsY0FBYyxPQUFPO0FBRTFDLGFBQU87QUFBQSxJQUNUO0FBRUEsSUFBQUQsUUFBTyxVQUFVLEVBQUUsMEJBQUFDLDJCQUEwQixtQ0FBbUMsbUJBQW1CLDBCQUEwQjtBQUFBO0FBQUE7OztBQzVIN0g7QUFBQSxvQkFBQUMsVUFBQUMsU0FBQTtBQUFBLFFBQU0sRUFBRSxrQkFBa0IsY0FBYyxRQUFRLFFBQVEsSUFBSSxRQUFRLFVBQVU7QUFDOUUsUUFBTSxFQUFFLGtCQUFrQixJQUFJO0FBRTlCLFFBQU1DLG9CQUFtQjtBQUFBLE1BQ3ZCLGlCQUFpQjtBQUFBLE1BQ2pCLGlCQUFpQjtBQUFBLE1BQ2pCLGtCQUFrQjtBQUFBLE1BQ2xCLHdCQUF3QjtBQUFBLE1BQ3hCLHdCQUF3QjtBQUFBLE1BQ3hCLHNCQUFzQjtBQUFBLE1BQ3RCLGlDQUFpQztBQUFBLE1BQ2pDLDBCQUEwQjtBQUFBLE1BQzFCLDBCQUEwQixDQUFDLFNBQVM7QUFBQSxNQUNwQyw4QkFBOEI7QUFBQSxNQUM5QiwyQkFBMkI7QUFBQSxNQUMzQix5QkFBeUI7QUFBQSxNQUN6QixtQkFBbUIsQ0FBQztBQUFBO0FBQUE7QUFBQSxNQUdwQixrQkFBa0IsQ0FBQztBQUFBLElBQ3JCO0FBRUEsUUFBTSxPQUFPO0FBQUEsTUFDWCxFQUFFLElBQUksV0FBVyxPQUFPLFdBQVc7QUFBQSxNQUNuQyxFQUFFLElBQUksWUFBWSxPQUFPLFdBQVc7QUFBQSxNQUNwQyxFQUFFLElBQUksU0FBUyxPQUFPLFFBQVE7QUFBQSxJQUNoQztBQUVBLFFBQU1DLGtCQUFOLGNBQTZCLGlCQUFpQjtBQUFBLE1BQzVDLFlBQVksS0FBSyxRQUFRO0FBQ3ZCLGNBQU0sS0FBSyxNQUFNO0FBQ2pCLGFBQUssU0FBUztBQUNkLGFBQUssWUFBWSxLQUFLLENBQUMsRUFBRTtBQUFBLE1BQzNCO0FBQUEsTUFFQSxVQUFVO0FBQ1IsY0FBTSxFQUFFLFlBQVksSUFBSTtBQUN4QixvQkFBWSxNQUFNO0FBRWxCLGNBQU0sU0FBUyxZQUFZLFVBQVUsRUFBRSxLQUFLLHFCQUFxQixDQUFDO0FBQ2xFLG1CQUFXLE9BQU8sTUFBTTtBQUN0QixnQkFBTSxNQUFNLE9BQU8sU0FBUyxVQUFVO0FBQUEsWUFDcEMsTUFBTSxJQUFJO0FBQUEsWUFDVixLQUFLLHVCQUF1QixLQUFLLGNBQWMsSUFBSSxLQUFLLGVBQWU7QUFBQSxVQUN6RSxDQUFDO0FBQ0QsY0FBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLGlCQUFLLFlBQVksSUFBSTtBQUNyQixpQkFBSyxRQUFRO0FBQUEsVUFDZixDQUFDO0FBQUEsUUFDSDtBQUVBLGNBQU0sVUFBVSxZQUFZLFVBQVUsRUFBRSxLQUFLLHdCQUF3QixDQUFDO0FBQ3RFLFlBQUksS0FBSyxjQUFjLFVBQVcsTUFBSyxrQkFBa0IsT0FBTztBQUFBLGlCQUN2RCxLQUFLLGNBQWMsV0FBWSxNQUFLLG1CQUFtQixPQUFPO0FBQUEsaUJBQzlELEtBQUssY0FBYyxRQUFTLE1BQUssZ0JBQWdCLE9BQU87QUFBQSxNQUNuRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFNQSxrQkFBa0IsYUFBYTtBQUM3QixZQUFJLGFBQWEsV0FBVyxFQUN6QixXQUFXLGtCQUFrQixFQUM3QjtBQUFBLFVBQVcsQ0FBQyxZQUNYLFFBQ0csUUFBUSwwQ0FBdUMsRUFDL0MsUUFBUSw2RkFBMEYsRUFDbEc7QUFBQSxZQUFVLENBQUMsV0FDVixPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsc0JBQXNCLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDckYsbUJBQUssT0FBTyxTQUFTLHlCQUF5QjtBQUM5QyxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixtQkFBSyxPQUFPLDRCQUE0QjtBQUFBLFlBQzFDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDSixFQUNDO0FBQUEsVUFBVyxDQUFDLFlBQ1gsUUFDRyxRQUFRLFdBQVEsRUFDaEIsUUFBUSxpRkFBaUYsRUFDekY7QUFBQSxZQUFRLENBQUMsU0FDUixLQUFLLFNBQVMsS0FBSyxPQUFPLFNBQVMsb0JBQW9CLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDakYsbUJBQUssT0FBTyxTQUFTLHVCQUF1QjtBQUM1QyxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixtQkFBSyxPQUFPLDRCQUE0QjtBQUFBLFlBQzFDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDSixFQUNDO0FBQUEsVUFBVyxDQUFDLFlBQ1gsUUFDRyxRQUFRLGtEQUFrRCxFQUMxRDtBQUFBLFlBQ0M7QUFBQSxVQUNGLEVBQ0M7QUFBQSxZQUFVLENBQUMsV0FDVixPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsK0JBQStCLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDOUYsbUJBQUssT0FBTyxTQUFTLGtDQUFrQztBQUN2RCxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixtQkFBSyxPQUFPLDRCQUE0QjtBQUFBLFlBQzFDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDSixFQUNDO0FBQUEsVUFBVyxDQUFDLFlBQ1gsUUFDRyxRQUFRLCtCQUErQixFQUN2QyxRQUFRLG9HQUFvRyxFQUM1RztBQUFBLFlBQVUsQ0FBQyxXQUNWLE9BQU8sU0FBUyxLQUFLLE9BQU8sU0FBUyx3QkFBd0IsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUN2RixtQkFBSyxPQUFPLFNBQVMsMkJBQTJCO0FBQ2hELG9CQUFNLEtBQUssT0FBTyxhQUFhO0FBQy9CLG1CQUFLLE9BQU8sNEJBQTRCO0FBQUEsWUFDMUMsQ0FBQztBQUFBLFVBQ0g7QUFBQSxRQUNKO0FBRUYsWUFBSSxhQUFhLFdBQVcsRUFDekIsV0FBVyxzQkFBc0IsRUFDakM7QUFBQSxVQUFXLENBQUMsWUFDWCxRQUNHLFFBQVEsWUFBWSxFQUNwQjtBQUFBLFlBQ0M7QUFBQSxVQUNGLEVBQ0M7QUFBQSxZQUFRLENBQUMsU0FDUixLQUNHLFNBQVMsS0FBSyxPQUFPLFNBQVMseUJBQXlCLEtBQUssSUFBSSxDQUFDLEVBQ2pFLFNBQVMsT0FBTyxVQUFVO0FBQ3pCLG1CQUFLLE9BQU8sU0FBUywyQkFBMkIsTUFDN0MsTUFBTSxHQUFHLEVBQ1QsSUFBSSxDQUFDLFNBQVMsS0FBSyxLQUFLLENBQUMsRUFDekIsT0FBTyxDQUFDLFNBQVMsS0FBSyxTQUFTLENBQUM7QUFDbkMsb0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxZQUNqQyxDQUFDO0FBQUEsVUFDTDtBQUFBLFFBQ0osRUFDQztBQUFBLFVBQVcsQ0FBQyxZQUNYLFFBQ0csUUFBUSxvQkFBb0IsRUFDNUI7QUFBQSxZQUNDO0FBQUEsVUFDRixFQUNDO0FBQUEsWUFBVSxDQUFDLFdBQ1YsT0FBTyxTQUFTLEtBQUssT0FBTyxTQUFTLDRCQUE0QixFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQzNGLG1CQUFLLE9BQU8sU0FBUywrQkFBK0I7QUFDcEQsb0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxZQUNqQyxDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0o7QUFFRixZQUFJLGFBQWEsV0FBVyxFQUN6QixXQUFXLGFBQWEsRUFDeEI7QUFBQSxVQUFXLENBQUMsWUFDWCxRQUNHLFFBQVEsMENBQTBDLEVBQ2xEO0FBQUEsWUFDQztBQUFBLFVBQ0YsRUFDQztBQUFBLFlBQVUsQ0FBQyxXQUNWLE9BQU8sU0FBUyxLQUFLLE9BQU8sU0FBUyx5QkFBeUIsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUN4RixtQkFBSyxPQUFPLFNBQVMsNEJBQTRCO0FBQ2pELG9CQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsWUFDakMsQ0FBQztBQUFBLFVBQ0g7QUFBQSxRQUNKO0FBRUYsWUFBSSxhQUFhLFdBQVcsRUFDekIsV0FBVyxjQUFjLEVBQ3pCO0FBQUEsVUFBVyxDQUFDLFlBQ1gsUUFDRyxRQUFRLDBCQUEwQixFQUNsQztBQUFBLFlBQ0M7QUFBQSxVQUNGLEVBQ0M7QUFBQSxZQUFVLENBQUMsV0FDVixPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsdUJBQXVCLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDdEYsbUJBQUssT0FBTyxTQUFTLDBCQUEwQjtBQUMvQyxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLFlBQ2pDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDSjtBQUtGLFlBQUk7QUFDSixZQUFJLGFBQWEsV0FBVyxFQUN6QixXQUFXLDJCQUEyQixFQUN0QztBQUFBLFVBQWUsQ0FBQyxXQUNmLE9BQ0csUUFBUSxNQUFNLEVBQ2QsV0FBVyxzQkFBbUIsRUFDOUIsUUFBUSxNQUFNO0FBQ2Isa0JBQU0sWUFBWSxLQUFLLE9BQU8sSUFBSSxRQUFRO0FBQzFDLGtCQUFNLGFBQWEsT0FBTyxLQUFLLEtBQUssT0FBTyxJQUFJLFFBQVEsT0FBTyxFQUMzRCxPQUFPLENBQUMsT0FBTyxVQUFVLEVBQUUsS0FBSyxDQUFDLEtBQUssT0FBTyxTQUFTLGlCQUFpQixTQUFTLEVBQUUsQ0FBQyxFQUNuRixJQUFJLENBQUMsT0FBTyxVQUFVLEVBQUUsQ0FBQyxFQUN6QixLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsS0FBSyxjQUFjLEVBQUUsSUFBSSxDQUFDO0FBRTlDLGdCQUFJLFdBQVcsV0FBVyxHQUFHO0FBQzNCLGtCQUFJLE9BQU8sa0RBQStDO0FBQzFEO0FBQUEsWUFDRjtBQUVBLGdCQUFJLGtCQUFrQixLQUFLLE9BQU8sS0FBSyxZQUFZLE9BQU8sT0FBTztBQUMvRCxrQkFBSSxDQUFDLEdBQUk7QUFDVCxtQkFBSyxPQUFPLFNBQVMsaUJBQWlCLEtBQUssRUFBRTtBQUM3QyxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixtQkFBSyxPQUFPLGlDQUFpQztBQUM3Qyx5Q0FBMkI7QUFBQSxZQUM3QixDQUFDLEVBQUUsS0FBSztBQUFBLFVBQ1YsQ0FBQztBQUFBLFFBQ0wsRUFDQyxXQUFXLENBQUMsWUFBWTtBQUN2QixrQkFBUSxRQUFRLHdFQUFxRTtBQUNyRixtQkFBUyxRQUFRLE9BQU8sVUFBVSxFQUFFLEtBQUssOEJBQThCLENBQUM7QUFBQSxRQUMxRSxDQUFDO0FBRUgsY0FBTSw2QkFBNkIsTUFBTTtBQUN2QyxpQkFBTyxNQUFNO0FBQ2IsZ0JBQU0sWUFBWSxLQUFLLE9BQU8sSUFBSSxRQUFRO0FBRzFDLGdCQUFNLGFBQWEsS0FBSyxPQUFPLFNBQVMsaUJBQWlCO0FBQUEsWUFDdkQsQ0FBQyxPQUFPLFVBQVUsRUFBRSxLQUFLLE9BQU8sVUFBVSxlQUFlLEtBQUssS0FBSyxPQUFPLElBQUksUUFBUSxTQUFTLEVBQUU7QUFBQSxVQUNuRztBQUVBLGNBQUksV0FBVyxXQUFXLEdBQUc7QUFDM0IsbUJBQU8sVUFBVSxFQUFFLEtBQUssNEJBQTRCLE1BQU0sdUNBQXVDLENBQUM7QUFDbEc7QUFBQSxVQUNGO0FBS0EscUJBQVcsTUFBTSxZQUFZO0FBQzNCLGtCQUFNLE1BQU0sT0FBTyxVQUFVLEVBQUUsS0FBSyw2QkFBNkIsQ0FBQztBQUNsRSxnQkFBSSxXQUFXLEVBQUUsS0FBSywrQkFBK0IsTUFBTSxVQUFVLEVBQUUsRUFBRSxLQUFLLENBQUM7QUFDL0Usa0JBQU0sWUFBWSxJQUFJLFVBQVU7QUFBQSxjQUM5QixLQUFLO0FBQUEsY0FDTCxNQUFNLEVBQUUsY0FBYyxZQUFZO0FBQUEsWUFDcEMsQ0FBQztBQUNELG9CQUFRLFdBQVcsR0FBRztBQUN0QixzQkFBVSxpQkFBaUIsU0FBUyxZQUFZO0FBQzlDLG1CQUFLLE9BQU8sU0FBUyxtQkFBbUIsS0FBSyxPQUFPLFNBQVMsaUJBQWlCLE9BQU8sQ0FBQyxNQUFNLE1BQU0sRUFBRTtBQUNwRyxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixtQkFBSyxPQUFPLGlDQUFpQztBQUM3Qyx5Q0FBMkI7QUFBQSxZQUM3QixDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0Y7QUFDQSxtQ0FBMkI7QUFBQSxNQUM3QjtBQUFBLE1BRUEsbUJBQW1CLGFBQWE7QUFDOUIsWUFBSSxhQUFhLFdBQVcsRUFDekIsV0FBVyxlQUFlLEVBQzFCO0FBQUEsVUFBVyxDQUFDLFlBQ1gsUUFDRyxRQUFRLFdBQVcsRUFDbkIsUUFBUSxnREFBZ0QsRUFDeEQ7QUFBQSxZQUFRLENBQUMsU0FDUixLQUFLLFNBQVMsS0FBSyxPQUFPLFNBQVMsZUFBZSxFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQzVFLG1CQUFLLE9BQU8sU0FBUyxrQkFBa0I7QUFDdkMsb0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxZQUNqQyxDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0osRUFDQztBQUFBLFVBQVcsQ0FBQyxZQUNYLFFBQ0csUUFBUSwyQkFBMkIsRUFDbkM7QUFBQSxZQUNDO0FBQUEsVUFDRixFQUNDO0FBQUEsWUFBUSxDQUFDLFNBQ1IsS0FBSyxTQUFTLEtBQUssT0FBTyxTQUFTLGVBQWUsRUFBRSxTQUFTLE9BQU8sVUFBVTtBQUM1RSxtQkFBSyxPQUFPLFNBQVMsa0JBQWtCO0FBQ3ZDLG9CQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsWUFDakMsQ0FBQztBQUFBLFVBQ0g7QUFBQSxRQUNKLEVBQ0M7QUFBQSxVQUFXLENBQUMsWUFDWCxRQUNHLFFBQVEsdUNBQXVDLEVBQy9DLFFBQVEsdUZBQXVGLEVBQy9GO0FBQUEsWUFBVSxDQUFDLFdBQ1YsT0FBTyxTQUFTLEtBQUssT0FBTyxTQUFTLGdCQUFnQixFQUFFLFNBQVMsT0FBTyxVQUFVO0FBQy9FLG1CQUFLLE9BQU8sU0FBUyxtQkFBbUI7QUFDeEMsb0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxZQUNqQyxDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0osRUFDQztBQUFBLFVBQVcsQ0FBQyxZQUNYLFFBQ0csUUFBUSxzQ0FBbUMsRUFDM0MsUUFBUSxnRUFBNkQsRUFDckU7QUFBQSxZQUFVLENBQUMsV0FDVixPQUFPLFNBQVMsS0FBSyxPQUFPLFNBQVMsc0JBQXNCLEVBQUUsU0FBUyxPQUFPLFVBQVU7QUFDckYsbUJBQUssT0FBTyxTQUFTLHlCQUF5QjtBQUM5QyxvQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLFlBQ2pDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxNQUVBLGdCQUFnQixhQUFhO0FBQzNCLG9CQUFZLFNBQVMsS0FBSyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFBQSxNQUNqRTtBQUFBLElBQ0Y7QUFFQSxJQUFBRixRQUFPLFVBQVUsRUFBRSxrQkFBQUMsbUJBQWtCLGdCQUFBQyxnQkFBZTtBQUFBO0FBQUE7OztBQ3JUcEQ7QUFBQSwwQkFBQUMsVUFBQUMsU0FBQTtBQUFBLFFBQU0sRUFBRSxRQUFRLFdBQVcsY0FBYyxJQUFJLFFBQVEsVUFBVTtBQU8vRCxRQUFNLG1CQUFtQjtBQUFBLE1BQ3ZCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFFQSxRQUFNLHlCQUF5QjtBQUFBLE1BQzdCLFVBQVU7QUFBQSxNQUNWLGNBQWM7QUFBQSxNQUNkLGVBQWU7QUFBQSxNQUNmLGFBQWE7QUFBQSxNQUNiLFlBQVk7QUFBQSxNQUNaLG1CQUFtQjtBQUFBLE1BQ25CLG9CQUFvQjtBQUFBLE1BQ3BCLG9CQUFvQjtBQUFBLE1BQ3BCLHNCQUFzQjtBQUFBLE1BQ3RCLDJCQUEyQjtBQUFBLE1BQzNCLG9CQUFvQjtBQUFBLE1BQ3BCLHVCQUF1QjtBQUFBLElBQ3pCO0FBRUEsYUFBUyxpQkFBaUIsT0FBTztBQUMvQixhQUFPLE1BQ0osT0FBTyxDQUFDLFNBQVMsU0FBUyxVQUFhLFNBQVMsRUFBRSxFQUNsRCxLQUFLLEdBQUcsRUFDUixRQUFRLFFBQVEsR0FBRyxFQUNuQixRQUFRLE9BQU8sRUFBRTtBQUFBLElBQ3RCO0FBRUEsYUFBUyxTQUFTLE1BQU07QUFDdEIsWUFBTSxPQUFPLENBQUM7QUFDZCxVQUFJLE1BQU0sQ0FBQztBQUNYLFVBQUksUUFBUTtBQUNaLFVBQUksV0FBVztBQUNmLFVBQUksSUFBSTtBQUVSLGFBQU8sSUFBSSxLQUFLLFFBQVE7QUFDdEIsY0FBTSxPQUFPLEtBQUssQ0FBQztBQUVuQixZQUFJLFVBQVU7QUFDWixjQUFJLFNBQVMsS0FBSztBQUNoQixnQkFBSSxLQUFLLElBQUksQ0FBQyxNQUFNLEtBQUs7QUFDdkIsdUJBQVM7QUFDVCxtQkFBSztBQUNMO0FBQUEsWUFDRjtBQUNBLHVCQUFXO0FBQ1g7QUFDQTtBQUFBLFVBQ0Y7QUFDQSxtQkFBUztBQUNUO0FBQ0E7QUFBQSxRQUNGO0FBRUEsWUFBSSxTQUFTLEtBQUs7QUFDaEIscUJBQVc7QUFDWDtBQUNBO0FBQUEsUUFDRjtBQUNBLFlBQUksU0FBUyxLQUFLO0FBQ2hCLGNBQUksS0FBSyxLQUFLO0FBQ2Qsa0JBQVE7QUFDUjtBQUNBO0FBQUEsUUFDRjtBQUNBLFlBQUksU0FBUyxNQUFNO0FBQ2pCO0FBQ0E7QUFBQSxRQUNGO0FBQ0EsWUFBSSxTQUFTLE1BQU07QUFDakIsY0FBSSxLQUFLLEtBQUs7QUFDZCxlQUFLLEtBQUssR0FBRztBQUNiLGdCQUFNLENBQUM7QUFDUCxrQkFBUTtBQUNSO0FBQ0E7QUFBQSxRQUNGO0FBQ0EsaUJBQVM7QUFDVDtBQUFBLE1BQ0Y7QUFFQSxVQUFJLE1BQU0sU0FBUyxLQUFLLElBQUksU0FBUyxHQUFHO0FBQ3RDLFlBQUksS0FBSyxLQUFLO0FBQ2QsYUFBSyxLQUFLLEdBQUc7QUFBQSxNQUNmO0FBRUEsYUFBTyxLQUFLLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxXQUFXLEtBQUssRUFBRSxDQUFDLE1BQU0sR0FBRztBQUFBLElBQzVEO0FBRUEsYUFBUyxhQUFhLE1BQU07QUFDMUIsWUFBTSxPQUFPLFNBQVMsSUFBSTtBQUMxQixVQUFJLEtBQUssV0FBVyxFQUFHLFFBQU8sQ0FBQztBQUMvQixZQUFNLFNBQVMsS0FBSyxDQUFDO0FBQ3JCLGFBQU8sS0FBSyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNoQyxjQUFNLE1BQU0sQ0FBQztBQUNiLGVBQU8sUUFBUSxDQUFDLEtBQUssUUFBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLEdBQUcsS0FBSyxFQUFHO0FBQ3hELGVBQU87QUFBQSxNQUNULENBQUM7QUFBQSxJQUNIO0FBRUEsYUFBUyxrQkFBa0IsS0FBSyxrQkFBa0IsY0FBYyxpQkFBaUIsYUFBYTtBQUM1RixZQUFNLGFBQWEsSUFBSSxlQUFlLEtBQUssSUFBSSxLQUFLO0FBQ3BELFlBQU0sWUFBWSxJQUFJLGNBQWMsS0FBSyxJQUFJLEtBQUs7QUFFbEQsVUFBSTtBQUNKLFVBQUksYUFBYSxTQUFVLFlBQVcsR0FBRyxTQUFTLElBQUksUUFBUTtBQUFBLGVBQ3JELGFBQWEsU0FBVSxZQUFXLGFBQWE7QUFBQSxVQUNuRCxZQUFXO0FBRWhCLFlBQU0sT0FBTyxDQUFDO0FBQ2QsaUJBQVcsQ0FBQyxLQUFLLEtBQUssS0FBSyxPQUFPLFFBQVEsR0FBRyxHQUFHO0FBQzlDLFlBQUksaUJBQWlCLFNBQVMsR0FBRyxLQUFLLE1BQU0sS0FBSyxHQUFHO0FBQ2xELGVBQUssdUJBQXVCLEdBQUcsS0FBSyxHQUFHLElBQUksTUFBTSxLQUFLO0FBQUEsUUFDeEQ7QUFBQSxNQUNGO0FBRUEsYUFBTyxFQUFFLFVBQVUsS0FBSztBQUFBLElBQzFCO0FBRUEsYUFBUyx1QkFBdUIsTUFBTSxjQUFjLFNBQVM7QUFDM0QsWUFBTSxjQUFjLEVBQUUsR0FBRyxLQUFLO0FBRTlCLFVBQUk7QUFDRixZQUFJLGdCQUFnQixhQUFhO0FBQy9CLGdCQUFNLGFBQWEsWUFBWTtBQUMvQixjQUFJLFdBQVcsV0FBVyxJQUFJLEdBQUc7QUFDL0Isd0JBQVksYUFBYSxTQUFTLFdBQVcsTUFBTSxDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNGO0FBRUEsWUFBSSxpQkFBaUIsYUFBYTtBQUNoQyxjQUFJLFFBQVEsWUFBWSxZQUFZLEtBQUs7QUFDekMsY0FBSSxNQUFNLFNBQVMsT0FBTyxFQUFHLFNBQVEsTUFBTSxNQUFNLE9BQU8sRUFBRSxDQUFDO0FBQzNELHNCQUFZLGNBQWMsTUFBTSxRQUFRLE1BQU0sRUFBRSxFQUFFLFFBQVEsTUFBTSxFQUFFO0FBQUEsUUFDcEU7QUFFQSxZQUFJLHFCQUFxQjtBQUN6QixZQUFJLE9BQU8sdUJBQXVCLFNBQVUsc0JBQXFCLENBQUMsa0JBQWtCO0FBQ3BGLFlBQUksQ0FBQyxNQUFNLFFBQVEsa0JBQWtCLEVBQUcsc0JBQXFCLENBQUM7QUFDOUQsY0FBTSxjQUFjLG1CQUFtQixTQUFTO0FBRWhELFlBQUksVUFBVSxlQUFlLFNBQVM7QUFDcEMsZ0JBQU0sV0FBVyxZQUFZLFFBQVEsSUFDbEMsTUFBTSxPQUFPLEVBQ2IsT0FBTyxDQUFDLFFBQVEsT0FBTyxRQUFRLGtCQUFrQixRQUFRLFdBQVcsRUFDcEUsSUFBSSxDQUFDLFFBQVEsSUFBSSxZQUFZLEVBQUUsUUFBUSxNQUFNLEdBQUcsQ0FBQztBQUNwRCxjQUFJLFFBQVMsU0FBUSxLQUFLLFNBQVM7QUFDbkMsZ0JBQU0sU0FBUyxRQUFRLFNBQVM7QUFFaEMsY0FBSSxlQUFlLFFBQVE7QUFDekIsd0JBQVksT0FBTyxDQUFDLEdBQUcsb0JBQUksSUFBSSxDQUFDLEdBQUcsU0FBUyxHQUFHLGtCQUFrQixDQUFDLENBQUM7QUFBQSxVQUNyRSxXQUFXLGFBQWE7QUFDdEIsd0JBQVksT0FBTyxDQUFDLEdBQUcsSUFBSSxJQUFJLGtCQUFrQixDQUFDO0FBQUEsVUFDcEQsV0FBVyxRQUFRO0FBQ2pCLHdCQUFZLE9BQU87QUFBQSxVQUNyQixPQUFPO0FBQ0wsbUJBQU8sWUFBWTtBQUFBLFVBQ3JCO0FBQUEsUUFDRjtBQUFBLE1BQ0YsU0FBUyxHQUFHO0FBQ1YsZ0JBQVEsTUFBTSx5REFBeUQsQ0FBQztBQUFBLE1BQzFFO0FBRUEsYUFBTztBQUFBLElBQ1Q7QUFFQSxhQUFTLGlCQUFpQixTQUFTO0FBQ2pDLFVBQUksQ0FBQyxRQUFTLFFBQU87QUFDckIsYUFBTyxRQUNKLE1BQU0sT0FBTyxFQUNiLElBQUksQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLEVBQ3ZCLFNBQVMsV0FBVztBQUFBLElBQ3pCO0FBRUEsbUJBQWUsd0JBQXdCLFNBQVMsVUFBVSxZQUFZO0FBQ3BFLGlCQUFXLE9BQU8sWUFBWTtBQUM1QixjQUFNLE9BQU8sY0FBYyxLQUFLLEdBQUcsUUFBUSxLQUFLO0FBQ2hELFlBQUksTUFBTSxRQUFRLE9BQU8sSUFBSSxFQUFHLFFBQU87QUFBQSxNQUN6QztBQUNBLGFBQU87QUFBQSxJQUNUO0FBRUEsbUJBQWUsdUJBQXVCLFNBQVMsTUFBTTtBQUNuRCxZQUFNLE1BQU0sTUFBTSxRQUFRLEtBQUssSUFBSTtBQUNuQyxZQUFNLFFBQVEsSUFBSSxNQUFNLG1DQUFtQztBQUMzRCxVQUFJLENBQUMsTUFBTyxRQUFPLEVBQUUsYUFBYSxDQUFDLEdBQUcsU0FBUyxJQUFJO0FBQ25ELGFBQU8sRUFBRSxhQUFhLFVBQVUsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsU0FBUyxJQUFJLE1BQU0sTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFO0FBQUEsSUFDdkY7QUFFQSxtQkFBZSxpQkFBaUIsU0FBUyxNQUFNLGFBQWEsU0FBUztBQUNuRSxZQUFNLFVBQVUsRUFBRSxLQUFLLFVBQVU7QUFDakMsVUFBSSxhQUFhLFlBQWEsU0FBUSxVQUFVLFlBQVk7QUFDNUQsVUFBSSxVQUFVLFlBQWEsU0FBUSxPQUFPLFlBQVk7QUFDdEQsaUJBQVcsQ0FBQyxLQUFLLEtBQUssS0FBSyxPQUFPLFFBQVEsV0FBVyxHQUFHO0FBQ3RELFlBQUksRUFBRSxPQUFPLFNBQVUsU0FBUSxHQUFHLElBQUk7QUFBQSxNQUN4QztBQUNBLFlBQU0sY0FBYztBQUFBLEVBQVEsY0FBYyxPQUFPLENBQUM7QUFBQSxFQUFRLE9BQU87QUFFakUsWUFBTSxNQUFNLEtBQUssTUFBTSxHQUFHLEVBQUUsTUFBTSxHQUFHLEVBQUUsRUFBRSxLQUFLLEdBQUc7QUFDakQsVUFBSSxPQUFPLENBQUUsTUFBTSxRQUFRLE9BQU8sR0FBRyxFQUFJLE9BQU0sUUFBUSxNQUFNLEdBQUc7QUFDaEUsWUFBTSxRQUFRLE1BQU0sTUFBTSxXQUFXO0FBQUEsSUFDdkM7QUFFQSxRQUFNLGdDQUFnQyxvQkFBSSxJQUFJO0FBQUEsTUFDNUM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLEdBQUcsT0FBTyxPQUFPLHNCQUFzQjtBQUFBLElBQ3pDLENBQUM7QUFFRCxhQUFTLG1CQUFtQixhQUFhLFNBQVM7QUFDaEQsVUFBSSxRQUFRLEtBQUssRUFBRSxTQUFTLEVBQUcsUUFBTztBQUN0QyxhQUFPLE9BQU8sS0FBSyxXQUFXLEVBQUUsTUFBTSxDQUFDLFFBQVEsOEJBQThCLElBQUksR0FBRyxDQUFDO0FBQUEsSUFDdkY7QUFFQSxtQkFBZSxzQkFBc0IsU0FBUyxNQUFNO0FBR2xELFVBQUk7QUFDRixjQUFNLGtCQUFrQixNQUFNLFFBQVEsWUFBWSxJQUFJO0FBQ3RELFlBQUksQ0FBQyxnQkFBaUIsT0FBTSxRQUFRLFdBQVcsSUFBSTtBQUFBLE1BQ3JELFNBQVMsR0FBRztBQUNWLGNBQU0sUUFBUSxPQUFPLElBQUk7QUFBQSxNQUMzQjtBQUFBLElBQ0Y7QUFFQSxtQkFBZSxzQkFBc0IsS0FBSyxVQUFVO0FBQ2xELFlBQU0sRUFBRSxRQUFRLElBQUksSUFBSTtBQUN4QixZQUFNLFVBQVUsU0FBUztBQUN6QixZQUFNLG1CQUFtQixTQUFTLGdCQUFnQixRQUFRLE9BQU8sRUFBRTtBQUVuRSxVQUFJLENBQUUsTUFBTSxRQUFRLE9BQU8sT0FBTyxHQUFJO0FBQ3BDLFlBQUksT0FBTyx5Q0FBeUMsT0FBTyxFQUFFO0FBQzdEO0FBQUEsTUFDRjtBQUNBLFVBQUksQ0FBRSxNQUFNLFFBQVEsT0FBTyxnQkFBZ0IsR0FBSTtBQUM3QyxZQUFJLE9BQU8sb0RBQW9ELGdCQUFnQixFQUFFO0FBQ2pGO0FBQUEsTUFDRjtBQUVBLFlBQU0sRUFBRSxRQUFRLElBQUksTUFBTSxRQUFRLEtBQUssZ0JBQWdCO0FBQ3ZELFlBQU0sYUFBYSxDQUFDLGtCQUFrQixHQUFHLFFBQVEsS0FBSyxDQUFDO0FBRXZELFlBQU0sT0FBTyxhQUFhLE1BQU0sUUFBUSxLQUFLLE9BQU8sQ0FBQztBQUVyRCxVQUFJLFVBQVU7QUFDZCxVQUFJLFVBQVU7QUFDZCxVQUFJLFFBQVE7QUFDWixVQUFJLFVBQVU7QUFDZCxVQUFJLFNBQVM7QUFFYixpQkFBVyxPQUFPLE1BQU07QUFDdEIsWUFBSTtBQUNGLGdCQUFNLEVBQUUsVUFBVSxNQUFNLFFBQVEsSUFBSSxrQkFBa0IsR0FBRztBQUN6RCxnQkFBTSxVQUFVLGlCQUFpQixRQUFRLElBQUk7QUFDN0MsZ0JBQU0sZUFBZSxNQUFNLHdCQUF3QixTQUFTLFVBQVUsVUFBVTtBQUVoRixjQUFJLGNBQWM7QUFDaEIsa0JBQU0sRUFBRSxhQUFhLHFCQUFxQixRQUFRLElBQUksTUFBTSx1QkFBdUIsU0FBUyxZQUFZO0FBQ3hHLGtCQUFNLFVBQVUsdUJBQXVCLFNBQVMsb0JBQW9CLE1BQU0sT0FBTztBQUVqRixnQkFBSSxTQUFTLDBCQUEwQixDQUFDLFFBQVEsZUFBZSxDQUFDLFFBQVEsUUFBUSxRQUFRLEtBQUssU0FBUyxJQUFJO0FBQ3hHO0FBQ0E7QUFBQSxZQUNGO0FBRUEsa0JBQU0scUJBQXFCLEVBQUUsR0FBRyxxQkFBcUIsR0FBRyxRQUFRO0FBRWhFLGtCQUFNLGFBQWEsY0FBYyxrQkFBa0IsR0FBRyxRQUFRLEtBQUs7QUFDbkUsa0JBQU0saUJBQWlCLFNBQVMsWUFBWSxvQkFBb0IsT0FBTztBQUV2RSxnQkFBSSxlQUFlLGNBQWM7QUFDL0Isb0JBQU0sc0JBQXNCLFNBQVMsWUFBWTtBQUNqRDtBQUFBLFlBQ0YsT0FBTztBQUNMO0FBQUEsWUFDRjtBQUFBLFVBQ0YsV0FBVyxDQUFDLFNBQVMsa0JBQWtCO0FBQ3JDLGtCQUFNLFVBQVUsdUJBQXVCLFNBQVMsUUFBVyxPQUFPO0FBRWxFLGdCQUFJLFNBQVMsMEJBQTBCLENBQUMsUUFBUSxlQUFlLENBQUMsUUFBUSxRQUFRLFFBQVEsS0FBSyxTQUFTLElBQUk7QUFDeEc7QUFDQTtBQUFBLFlBQ0Y7QUFFQSxrQkFBTSxVQUFVLGNBQWMsa0JBQWtCLEdBQUcsUUFBUSxLQUFLO0FBQ2hFLGtCQUFNLGlCQUFpQixTQUFTLFNBQVMsU0FBUyxFQUFFO0FBQ3BEO0FBQUEsVUFDRjtBQUFBLFFBQ0YsU0FBUyxHQUFHO0FBQ1Y7QUFDQSxrQkFBUSxNQUFNLDhDQUE4QyxLQUFLLENBQUM7QUFBQSxRQUNwRTtBQUFBLE1BQ0Y7QUFFQSxZQUFNLFVBQVUsbUJBQW1CLE9BQU8sU0FBUyxPQUFPLGtCQUFrQixLQUFLLHlDQUFzQyxPQUFPLG1CQUM1SCxTQUFTLEtBQUssTUFBTSw0QkFBNEIsRUFDbEQ7QUFDQSxjQUFRLElBQUksb0JBQW9CLE9BQU87QUFDdkMsVUFBSSxPQUFPLE9BQU87QUFBQSxJQUNwQjtBQUVBLG1CQUFlLHdCQUF3QixLQUFLLFVBQVU7QUFDcEQsWUFBTSxFQUFFLFFBQVEsSUFBSSxJQUFJO0FBQ3hCLFlBQU0sbUJBQW1CLFNBQVMsZ0JBQWdCLFFBQVEsT0FBTyxFQUFFO0FBRW5FLFVBQUksQ0FBRSxNQUFNLFFBQVEsT0FBTyxnQkFBZ0IsR0FBSTtBQUM3QyxZQUFJLE9BQU8sb0RBQW9ELGdCQUFnQixFQUFFO0FBQ2pGO0FBQUEsTUFDRjtBQUVBLFlBQU0sZUFBZSxJQUFJLE1BQ3RCLGlCQUFpQixFQUNqQixPQUFPLENBQUMsU0FBUyxLQUFLLFNBQVMsb0JBQW9CLEtBQUssS0FBSyxXQUFXLG1CQUFtQixHQUFHLENBQUMsRUFDL0YsT0FBTyxDQUFDLFNBQVMsSUFBSSxjQUFjLGFBQWEsSUFBSSxHQUFHLGFBQWEsUUFBUSxTQUFTO0FBRXhGLFVBQUksVUFBVTtBQUNkLFVBQUksU0FBUztBQUViLGlCQUFXLFFBQVEsY0FBYztBQUMvQixZQUFJO0FBQ0YsZ0JBQU0sRUFBRSxhQUFhLFFBQVEsSUFBSSxNQUFNLHVCQUF1QixTQUFTLEtBQUssSUFBSTtBQUNoRixjQUFJLENBQUMsbUJBQW1CLGFBQWEsT0FBTyxFQUFHO0FBRS9DLGdCQUFNLHNCQUFzQixTQUFTLEtBQUssSUFBSTtBQUM5QyxrQkFBUSxJQUFJLDBEQUFvRCxLQUFLLElBQUksRUFBRTtBQUMzRTtBQUFBLFFBQ0YsU0FBUyxHQUFHO0FBQ1Y7QUFDQSxrQkFBUSxNQUFNLHNEQUFnRCxLQUFLLE1BQU0sQ0FBQztBQUFBLFFBQzVFO0FBQUEsTUFDRjtBQUVBLFlBQU0sVUFBVSxtQkFBbUIsYUFBYSxNQUFNLGdCQUFhLE9BQU8sK0JBQ3hFLFNBQVMsS0FBSyxNQUFNLDRCQUE0QixFQUNsRDtBQUNBLGNBQVEsSUFBSSxvQkFBb0IsT0FBTztBQUN2QyxVQUFJLE9BQU8sT0FBTztBQUFBLElBQ3BCO0FBRUEsSUFBQUEsUUFBTyxVQUFVLEVBQUUsdUJBQXVCLHdCQUF3QjtBQUFBO0FBQUE7OztBQ3JXbEU7QUFBQSx5QkFBQUMsVUFBQUMsU0FBQTtBQUFBLFFBQU0sRUFBRSxNQUFNLElBQUksUUFBUSxVQUFVO0FBa0JwQyxhQUFTLGNBQWMsT0FBTztBQUM1QixZQUFNLFFBQVEsTUFBTSxNQUFNLGtDQUFrQztBQUM1RCxhQUFPLFFBQVEsTUFBTSxDQUFDLElBQUk7QUFBQSxJQUM1QjtBQUVBLGFBQVMsUUFBUSxPQUFPO0FBQ3RCLFVBQUksTUFBTSxRQUFRLEtBQUssRUFBRyxRQUFPO0FBQ2pDLFVBQUksVUFBVSxVQUFhLFVBQVUsUUFBUSxVQUFVLEdBQUksUUFBTyxDQUFDO0FBQ25FLGFBQU8sQ0FBQyxLQUFLO0FBQUEsSUFDZjtBQUVBLGFBQVMsbUJBQW1CLEtBQUssV0FBVyxlQUFlO0FBQ3pELFlBQU0sVUFBVSxDQUFDO0FBQ2pCLGlCQUFXLFNBQVMsUUFBUSxhQUFhLEdBQUc7QUFDMUMsWUFBSSxPQUFPLFVBQVUsU0FBVTtBQUMvQixjQUFNLE9BQU8sSUFBSSxjQUFjLHFCQUFxQixjQUFjLEtBQUssR0FBRyxVQUFVLElBQUk7QUFDeEYsWUFBSSxDQUFDLE1BQU07QUFDVCxrQkFBUSxLQUFLLGtFQUErRCxLQUFLLFFBQVEsVUFBVSxJQUFJLEVBQUU7QUFDekc7QUFBQSxRQUNGO0FBQ0EsWUFBSSxLQUFLLFNBQVMsVUFBVSxLQUFNLFNBQVEsS0FBSyxJQUFJO0FBQUEsTUFDckQ7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUlBLGFBQVMscUJBQXFCLEtBQUssZUFBZSxPQUFPO0FBQ3ZELFlBQU0sUUFBUSxDQUFDO0FBQ2YsaUJBQVcsZ0JBQWdCLGVBQWU7QUFDeEMsY0FBTSxXQUFXLENBQUM7QUFDbEIsbUJBQVcsUUFBUSxPQUFPO0FBQ3hCLGdCQUFNLGNBQWMsSUFBSSxjQUFjLGFBQWEsSUFBSSxHQUFHO0FBQzFELGNBQUksQ0FBQyxjQUFjLFlBQVksRUFBRztBQUNsQyxnQkFBTSxVQUFVLG1CQUFtQixLQUFLLE1BQU0sWUFBWSxZQUFZLENBQUM7QUFDdkUsY0FBSSxRQUFRLFNBQVMsRUFBRyxVQUFTLEtBQUssSUFBSSxJQUFJLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJO0FBQUEsUUFDekU7QUFDQSxjQUFNLFlBQVksSUFBSTtBQUFBLE1BQ3hCO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUFFQSxhQUFTLGFBQWEsT0FBTyxjQUFjLFlBQVk7QUFDckQsYUFBTyxJQUFJLElBQUksUUFBUSxZQUFZLElBQUksVUFBVSxLQUFLLENBQUMsQ0FBQztBQUFBLElBQzFEO0FBRUEsbUJBQWUsa0JBQWtCLEtBQUssY0FBYyxXQUFXLFlBQVk7QUFDekUsWUFBTSxJQUFJLFlBQVksbUJBQW1CLFdBQVcsQ0FBQyxnQkFBZ0I7QUFDbkUsY0FBTSxVQUFVLFFBQVEsWUFBWSxZQUFZLENBQUM7QUFDakQsY0FBTSxlQUFlLG1CQUFtQixLQUFLLFdBQVcsT0FBTyxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsU0FBUyxXQUFXLElBQUk7QUFDdkcsWUFBSSxhQUFjO0FBQ2xCLGNBQU0sT0FBTyxJQUFJLFlBQVkscUJBQXFCLFlBQVksVUFBVSxJQUFJO0FBQzVFLG9CQUFZLFlBQVksSUFBSSxDQUFDLEdBQUcsU0FBUyxJQUFJO0FBQUEsTUFDL0MsQ0FBQztBQUFBLElBQ0g7QUFFQSxtQkFBZSx1QkFBdUIsS0FBSyxjQUFjLFdBQVcsWUFBWTtBQUM5RSxZQUFNLElBQUksWUFBWSxtQkFBbUIsV0FBVyxDQUFDLGdCQUFnQjtBQUNuRSxjQUFNLFVBQVUsUUFBUSxZQUFZLFlBQVksQ0FBQztBQUNqRCxjQUFNLFdBQVcsUUFBUSxPQUFPLENBQUMsVUFBVTtBQUN6QyxjQUFJLE9BQU8sVUFBVSxTQUFVLFFBQU87QUFDdEMsZ0JBQU0sT0FBTyxJQUFJLGNBQWMscUJBQXFCLGNBQWMsS0FBSyxHQUFHLFVBQVUsSUFBSTtBQUN4RixpQkFBTyxFQUFFLFFBQVEsS0FBSyxTQUFTO0FBQUEsUUFDakMsQ0FBQztBQUNELFlBQUksU0FBUyxXQUFXLFFBQVEsT0FBUTtBQUN4QyxZQUFJLFNBQVMsV0FBVyxFQUFHLFFBQU8sWUFBWSxZQUFZO0FBQUEsWUFDckQsYUFBWSxZQUFZLElBQUk7QUFBQSxNQUNuQyxDQUFDO0FBQUEsSUFDSDtBQUVBLG1CQUFlLGFBQWEsS0FBSyxlQUFlLGVBQWUsY0FBYztBQUMzRSxVQUFJLFFBQVE7QUFDWixVQUFJLFVBQVU7QUFFZCxpQkFBVyxnQkFBZ0IsZUFBZTtBQUN4QyxjQUFNLGNBQWMsb0JBQUksSUFBSTtBQUFBLFVBQzFCLEdBQUcsT0FBTyxLQUFLLGdCQUFnQixZQUFZLEtBQUssQ0FBQyxDQUFDO0FBQUEsVUFDbEQsR0FBRyxPQUFPLEtBQUssZUFBZSxZQUFZLEtBQUssQ0FBQyxDQUFDO0FBQUEsUUFDbkQsQ0FBQztBQUVELG1CQUFXLGNBQWMsYUFBYTtBQUNwQyxnQkFBTSxjQUFjLGFBQWEsZUFBZSxjQUFjLFVBQVU7QUFDeEUsZ0JBQU0sY0FBYyxhQUFhLGNBQWMsY0FBYyxVQUFVO0FBRXZFLHFCQUFXLGNBQWMsYUFBYTtBQUNwQyxnQkFBSSxZQUFZLElBQUksVUFBVSxFQUFHO0FBRWpDLGtCQUFNLGFBQWEsSUFBSSxNQUFNLHNCQUFzQixVQUFVO0FBQzdELGtCQUFNLGFBQWEsSUFBSSxNQUFNLHNCQUFzQixVQUFVO0FBQzdELGdCQUFJLEVBQUUsc0JBQXNCLFVBQVUsRUFBRSxzQkFBc0IsT0FBUTtBQUV0RSxrQkFBTSxrQkFBa0IsS0FBSyxjQUFjLFlBQVksVUFBVTtBQUNqRSxvQkFBUSxJQUFJLDJCQUEyQixZQUFZLE1BQU0sV0FBVyxJQUFJLE9BQU8sV0FBVyxJQUFJLGFBQVU7QUFDeEc7QUFBQSxVQUNGO0FBRUEscUJBQVcsY0FBYyxhQUFhO0FBQ3BDLGdCQUFJLFlBQVksSUFBSSxVQUFVLEVBQUc7QUFFakMsa0JBQU0sYUFBYSxJQUFJLE1BQU0sc0JBQXNCLFVBQVU7QUFDN0QsZ0JBQUksRUFBRSxzQkFBc0IsT0FBUTtBQUVwQyxrQkFBTSx1QkFBdUIsS0FBSyxjQUFjLFlBQVksVUFBVTtBQUN0RSxvQkFBUSxJQUFJLDJCQUEyQixZQUFZLE1BQU0sV0FBVyxJQUFJLE9BQU8sVUFBVSxXQUFXO0FBQ3BHO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBRUEsYUFBTyxFQUFFLE9BQU8sUUFBUTtBQUFBLElBQzFCO0FBRUEsbUJBQWUsYUFBYSxLQUFLLGVBQWUsZUFBZTtBQUM3RCxZQUFNLFFBQVEsSUFBSSxNQUFNLGlCQUFpQjtBQUN6QyxjQUFRLElBQUksbUNBQWdDLE1BQU0sTUFBTSwrQkFBNEIsY0FBYyxLQUFLLElBQUksQ0FBQyxFQUFFO0FBRTlHLFlBQU0sZUFBZSxxQkFBcUIsS0FBSyxlQUFlLEtBQUs7QUFDbkUsWUFBTSxFQUFFLE9BQU8sUUFBUSxJQUFJLE1BQU0sYUFBYSxLQUFLLGVBQWUsZUFBZSxZQUFZO0FBRTdGLGFBQU87QUFBQSxRQUNMLFNBQVMsTUFBTTtBQUFBLFFBQ2Y7QUFBQSxRQUNBO0FBQUEsUUFDQSxlQUFlO0FBQUEsTUFDakI7QUFBQSxJQUNGO0FBS0EsYUFBU0MsK0JBQThCLFFBQVE7QUFDN0MsVUFBSSxVQUFVO0FBQ2QsVUFBSSxVQUFVO0FBRWQsWUFBTSxVQUFVLFlBQVk7QUFDMUIsWUFBSSxTQUFTO0FBQ1gsb0JBQVU7QUFDVjtBQUFBLFFBQ0Y7QUFDQSxrQkFBVTtBQUNWLFlBQUk7QUFDRixnQkFBTSxTQUFTLE1BQU0sYUFBYSxPQUFPLEtBQUssT0FBTyxTQUFTLDBCQUEwQixPQUFPLFNBQVMsaUJBQWlCO0FBQ3pILGlCQUFPLFNBQVMsb0JBQW9CLE9BQU87QUFDM0MsZ0JBQU0sT0FBTyxhQUFhO0FBQUEsUUFDNUIsU0FBUyxHQUFHO0FBQ1Ysa0JBQVEsTUFBTSxrQ0FBa0MsQ0FBQztBQUFBLFFBQ25ELFVBQUU7QUFDQSxvQkFBVTtBQUNWLGNBQUksU0FBUztBQUNYLHNCQUFVO0FBQ1Ysb0JBQVE7QUFBQSxVQUNWO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLG9CQUFvQixDQUFDLFNBQVM7QUFDbEMsWUFBSSxDQUFDLE9BQU8sU0FBUyw2QkFBOEI7QUFDbkQsWUFBSSxLQUFLLGNBQWMsS0FBTTtBQUM3QixnQkFBUTtBQUFBLE1BQ1Y7QUFFQSxhQUFPLGNBQWMsT0FBTyxJQUFJLGNBQWMsR0FBRyxXQUFXLGlCQUFpQixDQUFDO0FBQUEsSUFDaEY7QUFFQSxJQUFBRCxRQUFPLFVBQVUsRUFBRSxjQUFjLCtCQUFBQywrQkFBOEI7QUFBQTtBQUFBOzs7QUN0TC9EO0FBQUEsb0JBQUFDLFVBQUFDLFNBQUE7QUFBQSxRQUFNLEVBQUUsT0FBTyxJQUFJLFFBQVEsVUFBVTtBQUNyQyxRQUFNLEVBQUUsdUJBQXVCLHdCQUF3QixJQUFJO0FBQzNELFFBQU0sRUFBRSxhQUFhLElBQUk7QUFDekIsUUFBTSxFQUFFLGtDQUFrQyxJQUFJO0FBRTlDLGFBQVNDLGtCQUFpQixRQUFRO0FBRWhDLGFBQU8sV0FBVztBQUFBLFFBQ2hCLElBQUk7QUFBQSxRQUNKLE1BQU07QUFBQSxRQUNOLFVBQVUsTUFBTSxzQkFBc0IsT0FBTyxLQUFLLE9BQU8sUUFBUTtBQUFBLE1BQ25FLENBQUM7QUFFRCxhQUFPLFdBQVc7QUFBQSxRQUNoQixJQUFJO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixVQUFVLE1BQU0sd0JBQXdCLE9BQU8sS0FBSyxPQUFPLFFBQVE7QUFBQSxNQUNyRSxDQUFDO0FBRUQsYUFBTyxXQUFXO0FBQUEsUUFDaEIsSUFBSTtBQUFBLFFBQ0osTUFBTTtBQUFBLFFBQ04sVUFBVSxZQUFZO0FBQ3BCLGdCQUFNLFNBQVMsTUFBTSxhQUFhLE9BQU8sS0FBSyxPQUFPLFNBQVMsMEJBQTBCLE9BQU8sU0FBUyxpQkFBaUI7QUFDekgsaUJBQU8sU0FBUyxvQkFBb0IsT0FBTztBQUMzQyxnQkFBTSxPQUFPLGFBQWE7QUFDMUIsY0FBSSxPQUFPLHlCQUF5QixPQUFPLE9BQU8sd0JBQXFCLE9BQU8sS0FBSyxnQkFBYSxPQUFPLE9BQU8sWUFBWTtBQUFBLFFBQzVIO0FBQUEsTUFDRixDQUFDO0FBRUQsYUFBTyxXQUFXO0FBQUEsUUFDaEIsSUFBSTtBQUFBLFFBQ0osTUFBTTtBQUFBLFFBQ04sVUFBVSxNQUFNLGtDQUFrQyxNQUFNO0FBQUEsTUFDMUQsQ0FBQztBQUVELGFBQU8sV0FBVztBQUFBLFFBQ2hCLElBQUk7QUFBQSxRQUNKLE1BQU07QUFBQSxRQUNOLFVBQVUsTUFBTSxPQUFPLHVCQUF1QjtBQUFBLE1BQ2hELENBQUM7QUFBQSxJQUVIO0FBRUEsSUFBQUQsUUFBTyxVQUFVLEVBQUUsa0JBQUFDLGtCQUFpQjtBQUFBO0FBQUE7OztBQzVDcEM7QUFBQSw0QkFBQUMsVUFBQUMsU0FBQTtBQUFBLFFBQU0sRUFBRSxPQUFPLFNBQVMsbUJBQW1CLE9BQU8sSUFBSSxRQUFRLFVBQVU7QUFrQnhFLGFBQVMsV0FBVyxRQUFRLG1CQUFtQixZQUFZO0FBQ3pELFVBQUksQ0FBQyxPQUFRLFFBQU87QUFDcEIsVUFBSSxNQUFNO0FBRVYsVUFBSSxZQUFZO0FBQ2QsZUFBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLVCxPQUFPO0FBQ0wsZUFBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFjVDtBQUVBLFVBQUksbUJBQW1CO0FBQ3JCLGVBQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BS1Q7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUVBLGFBQVMsZUFBZSxNQUFNLFFBQVE7QUFDcEMsVUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFRLFFBQU87QUFDN0IsWUFBTSxPQUFPLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSTtBQUNqQyxhQUFPLEtBQUssV0FBVyxNQUFNO0FBQUEsSUFDL0I7QUFFQSxhQUFTLHNCQUFzQixTQUFTLFFBQVE7QUFDOUMsVUFBSSxDQUFDLFFBQVMsUUFBTztBQUNyQixhQUFPLGVBQWUsUUFBUSxhQUFhLFdBQVcsR0FBRyxNQUFNO0FBQUEsSUFDakU7QUFLQSxhQUFTLDJCQUEyQixLQUFLLFVBQVUsUUFBUTtBQUN6RCxVQUFJLENBQUMsT0FBUSxRQUFPO0FBQ3BCLFlBQU0sV0FBVyxTQUFTLE1BQU0sR0FBRztBQUNuQyxlQUFTLElBQUk7QUFDYixlQUFTLElBQUksR0FBRyxLQUFLLFNBQVMsUUFBUSxLQUFLO0FBQ3pDLGNBQU0sZ0JBQWdCLFNBQVMsTUFBTSxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUc7QUFDbkQsWUFBSSxlQUFlLGVBQWUsTUFBTSxHQUFHO0FBQ3pDLGdCQUFNLFNBQVMsSUFBSSxNQUFNLHNCQUFzQixhQUFhO0FBQzVELGNBQUksa0JBQWtCLFFBQVMsUUFBTztBQUFBLFFBQ3hDO0FBQUEsTUFDRjtBQUNBLGFBQU87QUFBQSxJQUNUO0FBRUEsYUFBUyxtQkFBbUIsS0FBSyxZQUFZO0FBQzNDLFlBQU0sY0FBYyxhQUFhO0FBQ2pDLFVBQUksUUFBUTtBQUNaLGlCQUFXLFFBQVEsSUFBSSxNQUFNLGlCQUFpQixHQUFHO0FBQy9DLFlBQUksS0FBSyxLQUFLLFdBQVcsV0FBVyxFQUFHO0FBQUEsTUFDekM7QUFDQSxhQUFPO0FBQUEsSUFDVDtBQUVBLGFBQVMsa0JBQWtCLEtBQUssV0FBVyxZQUFZLE9BQU87QUFDNUQsWUFBTSxVQUFVLFVBQVUsY0FBYyw0QkFBNEI7QUFDcEUsVUFBSSxDQUFDLFFBQVM7QUFDZCxZQUFNLGVBQWUsUUFBUSxjQUFjLHlCQUF5QjtBQUlwRSxVQUFJLFNBQVMsY0FBYztBQUN6QixjQUFNLFFBQVEsYUFBYSxjQUFjLGdCQUFnQjtBQUN6RCxZQUFJLE1BQU8sT0FBTSxPQUFPO0FBQUEsTUFDMUI7QUFDQSxVQUFJLENBQUMsT0FBTztBQUNWLGNBQU0sUUFBUSxRQUFRLGNBQWMseUJBQXlCO0FBQzdELFlBQUksTUFBTyxPQUFNLE9BQU87QUFBQSxNQUMxQjtBQUVBLFlBQU0sU0FBUyxRQUFRLFVBQVU7QUFDakMsVUFBSSxDQUFDLE9BQVE7QUFFYixVQUFJLFFBQVEsT0FBTyxjQUFjLHlCQUF5QjtBQUMxRCxVQUFJLENBQUMsT0FBTztBQUNWLGdCQUFRLFNBQVMsY0FBYyxLQUFLO0FBQ3BDLGNBQU0sWUFBWSxRQUFRLCtCQUErQjtBQUN6RCxlQUFPLFlBQVksS0FBSztBQUFBLE1BQzFCO0FBQ0EsWUFBTSxjQUFjLE9BQU8sbUJBQW1CLEtBQUssVUFBVSxDQUFDO0FBQUEsSUFDaEU7QUFFQSxhQUFTLGtCQUFrQixXQUFXO0FBQ3BDLGdCQUFVLGlCQUFpQixnQkFBZ0IsRUFBRSxRQUFRLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUFBLElBQzFFO0FBRUEsYUFBUyx1QkFBdUIsU0FBUyxZQUFZO0FBQ25ELGNBQVEsVUFBVSxPQUFPLGtCQUFrQixVQUFVO0FBQUEsSUFDdkQ7QUFFQSxhQUFTLHVCQUF1QixLQUFLLFFBQVE7QUFDM0MsWUFBTSxTQUFTLENBQUM7QUFDaEIsWUFBTSxPQUFPLENBQUMsV0FBVztBQUN2QixtQkFBVyxTQUFTLE9BQU8sVUFBVTtBQUNuQyxjQUFJLEVBQUUsaUJBQWlCLFNBQVU7QUFDakMsY0FBSSxlQUFlLE1BQU0sTUFBTSxNQUFNLEVBQUcsUUFBTyxLQUFLLEtBQUs7QUFDekQsZUFBSyxLQUFLO0FBQUEsUUFDWjtBQUFBLE1BQ0Y7QUFDQSxXQUFLLElBQUksTUFBTSxRQUFRLENBQUM7QUFDeEIsYUFBTyxPQUFPLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxLQUFLLGNBQWMsRUFBRSxJQUFJLENBQUM7QUFBQSxJQUMzRDtBQUlBLFFBQU0sNEJBQU4sY0FBd0Msa0JBQWtCO0FBQUEsTUFDeEQsWUFBWSxLQUFLLFNBQVMsbUJBQW1CLFNBQVM7QUFDcEQsY0FBTSxHQUFHO0FBQ1QsYUFBSyxVQUFVO0FBQ2YsYUFBSyxvQkFBb0I7QUFDekIsYUFBSyxVQUFVO0FBQ2YsYUFBSyxTQUFTO0FBQ2QsYUFBSyxlQUFlLDRFQUFnRTtBQUFBLE1BQ3RGO0FBQUEsTUFFQSxXQUFXO0FBQ1QsZUFBTyxLQUFLO0FBQUEsTUFDZDtBQUFBLE1BRUEsWUFBWSxRQUFRO0FBQ2xCLGVBQU8sT0FBTztBQUFBLE1BQ2hCO0FBQUEsTUFFQSxpQkFBaUIsT0FBTyxJQUFJO0FBQzFCLGNBQU0sU0FBUyxNQUFNO0FBQ3JCLGNBQU0sU0FBUyxLQUFLLGtCQUFrQixJQUFJLE9BQU8sSUFBSTtBQUNyRCxXQUFHLFdBQVcsRUFBRSxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ25DLGNBQU0sUUFBUSxHQUFHLFdBQVcsRUFBRSxNQUFNLFNBQVMsZ0JBQWEsY0FBYyxDQUFDO0FBQ3pFLGNBQU0sTUFBTSxRQUFRO0FBQ3BCLGNBQU0sTUFBTSxRQUFRO0FBQUEsTUFDdEI7QUFBQSxNQUVBLGlCQUFpQixNQUFNLEtBQUs7QUFDMUIsYUFBSyxTQUFTO0FBQ2QsY0FBTSxpQkFBaUIsTUFBTSxHQUFHO0FBQUEsTUFDbEM7QUFBQSxNQUVBLGFBQWEsUUFBUTtBQUNuQixhQUFLLFFBQVEsTUFBTTtBQUFBLE1BQ3JCO0FBQUEsTUFFQSxVQUFVO0FBQ1IsY0FBTSxRQUFRO0FBQ2QsWUFBSSxDQUFDLEtBQUssT0FBUSxNQUFLLFFBQVEsSUFBSTtBQUFBLE1BQ3JDO0FBQUEsSUFDRjtBQVFBLGFBQVMsb0JBQW9CLFFBQVEsTUFBTSxjQUFjO0FBQ3ZELFVBQUksQ0FBQyxRQUFRLE9BQU8sS0FBSyxtQkFBbUIsV0FBWTtBQUN4RCxVQUFJLEtBQUssc0JBQXNCO0FBQzdCLHFCQUFhLElBQUksSUFBSTtBQUNyQjtBQUFBLE1BQ0Y7QUFDQSxZQUFNLFdBQVcsS0FBSyxlQUFlLEtBQUssSUFBSTtBQUM5QyxXQUFLLHVCQUF1QjtBQUM1QixXQUFLLGlCQUFpQixDQUFDLFNBQVM7QUFDOUIsWUFBSSxPQUFPLFNBQVMsMEJBQTBCLGdCQUFnQixPQUFPO0FBQ25FLGdCQUFNLFdBQVcsMkJBQTJCLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxTQUFTLG9CQUFvQjtBQUN2RyxjQUFJLFNBQVUsUUFBTyxTQUFTLFFBQVE7QUFBQSxRQUN4QztBQUNBLGVBQU8sU0FBUyxJQUFJO0FBQUEsTUFDdEI7QUFDQSxtQkFBYSxJQUFJLElBQUk7QUFBQSxJQUN2QjtBQW1CQSxhQUFTLHNCQUFzQixRQUFRLE1BQU0sY0FBYztBQUN6RCxVQUFJLENBQUMsUUFBUSxPQUFPLEtBQUsscUJBQXFCLFdBQVk7QUFDMUQsVUFBSSxLQUFLLDRCQUE0QjtBQUNuQyxxQkFBYSxJQUFJLElBQUk7QUFDckI7QUFBQSxNQUNGO0FBQ0EsWUFBTSxXQUFXLEtBQUssaUJBQWlCLEtBQUssSUFBSTtBQUNoRCxXQUFLLDZCQUE2QjtBQUNsQyxXQUFLLG1CQUFtQixNQUFNO0FBQzVCLFlBQUksQ0FBQyxPQUFPLFNBQVMsdUJBQXdCLFFBQU8sU0FBUztBQUM3RCxZQUFJLENBQUMsS0FBSyxZQUFZLFFBQVEsRUFBRyxRQUFPLFNBQVM7QUFFakQsY0FBTSxXQUFXLEtBQUssV0FBVyxNQUFNO0FBQ3ZDLGNBQU0sV0FBVyxXQUNiLDJCQUEyQixPQUFPLEtBQUssVUFBVSxPQUFPLFNBQVMsb0JBQW9CLElBQ3JGO0FBQ0osWUFBSSxDQUFDLFNBQVUsUUFBTyxTQUFTO0FBRS9CLGVBQU8sS0FBSyxlQUFlLFFBQVE7QUFBQSxNQUNyQztBQUNBLG1CQUFhLElBQUksSUFBSTtBQUFBLElBQ3ZCO0FBaUJBLGFBQVMsZ0JBQWdCLFFBQVEsTUFBTSxtQkFBbUIsY0FBYztBQUN0RSxVQUFJLENBQUMsUUFBUSxPQUFPLEtBQUssaUJBQWlCLFdBQVk7QUFDdEQsVUFBSSxLQUFLLDRCQUE0QjtBQUNuQyxxQkFBYSxJQUFJLElBQUk7QUFDckI7QUFBQSxNQUNGO0FBRUEsWUFBTSxXQUFXLEtBQUssYUFBYSxLQUFLLElBQUk7QUFDNUMsV0FBSyw2QkFBNkI7QUFDbEMsV0FBSyxlQUFlLENBQUMsV0FBVyxZQUFZO0FBQzFDLGNBQU1DLFFBQU8sS0FBSyxNQUFNO0FBQ3hCLGNBQU0sYUFBYSxPQUFPLFNBQVMsMEJBQTBCLGVBQWVBLE9BQU0sT0FBTyxTQUFTLG9CQUFvQjtBQUN0SCxZQUFJLGNBQWMsQ0FBQyxhQUFhLENBQUMsa0JBQWtCLElBQUlBLEtBQUksR0FBRztBQUs1RCxpQkFBTyxRQUFRLFFBQVE7QUFBQSxRQUN6QjtBQUNBLGVBQU8sU0FBUyxXQUFXLE9BQU87QUFBQSxNQUNwQztBQUNBLG1CQUFhLElBQUksSUFBSTtBQUtyQixZQUFNLE9BQU8sS0FBSyxNQUFNO0FBQ3hCLFVBQ0UsT0FBTyxTQUFTLDBCQUNoQixlQUFlLE1BQU0sT0FBTyxTQUFTLG9CQUFvQixLQUN6RCxDQUFDLGtCQUFrQixJQUFJLElBQUksS0FDM0IsS0FBSyxjQUFjLE1BQ25CO0FBQ0EsaUJBQVMsTUFBTSxJQUFJO0FBQUEsTUFDckI7QUFBQSxJQUNGO0FBRUEsYUFBU0MseUJBQXdCLFFBQVE7QUFDdkMsWUFBTSxVQUFVLFNBQVMsY0FBYyxPQUFPO0FBQzlDLGNBQVEsS0FBSztBQUNiLGVBQVMsS0FBSyxZQUFZLE9BQU87QUFFakMsWUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUMvQixZQUFNLGVBQWUsb0JBQUksSUFBSTtBQUM3QixZQUFNLGVBQWUsb0JBQUksSUFBSTtBQUk3QixZQUFNLHFCQUFxQixvQkFBSSxJQUFJO0FBQ25DLFVBQUksbUJBQW1CO0FBSXZCLFlBQU0sb0JBQW9CLG9CQUFJLElBQUk7QUFhbEMsWUFBTSx3QkFBd0IsTUFBTTtBQUNsQyxtQkFBVyxhQUFhLGVBQWUsT0FBTyxHQUFHO0FBQy9DLDRCQUFrQixTQUFTO0FBQUEsUUFDN0I7QUFDQSx1QkFBZSxNQUFNO0FBRXJCLFlBQUksQ0FBQyxPQUFPLFNBQVMsd0JBQXdCO0FBQzNDLG1CQUFTLGlCQUFpQixpQkFBaUIsRUFBRSxRQUFRLENBQUMsT0FBTyxHQUFHLFVBQVUsT0FBTyxnQkFBZ0IsQ0FBQztBQUNsRztBQUFBLFFBQ0Y7QUFFQSxjQUFNLFNBQVMsT0FBTyxTQUFTO0FBQy9CLG1CQUFXLFFBQVEsT0FBTyxJQUFJLFVBQVUsZ0JBQWdCLGVBQWUsR0FBRztBQUN4RSxnQkFBTSxPQUFPLEtBQUs7QUFDbEIsOEJBQW9CLFFBQVEsTUFBTSxZQUFZO0FBQzlDLGdDQUFzQixRQUFRLE1BQU0sWUFBWTtBQUNoRCxrQ0FBd0IsSUFBSTtBQUs1QixxQkFBVyxRQUFRLEtBQUssYUFBYSxDQUFDLEdBQUc7QUFDdkMsZ0JBQUksQ0FBQyxlQUFlLE1BQU0sTUFBTSxFQUFHO0FBQ25DLDRCQUFnQixRQUFRLEtBQUssVUFBVSxJQUFJLEdBQUcsbUJBQW1CLFlBQVk7QUFBQSxVQUMvRTtBQU1BLGVBQUssWUFBWSxpQkFBaUIsOEJBQThCLEVBQUUsUUFBUSxDQUFDLFlBQVk7QUFDckYsa0JBQU0sT0FBTyxRQUFRLGFBQWEsV0FBVztBQUM3QyxrQkFBTSxhQUFhLGVBQWUsTUFBTSxNQUFNO0FBQzlDLG1DQUF1QixTQUFTLFVBQVU7QUFDMUMsZ0JBQUksQ0FBQyxXQUFZO0FBQ2pCLGtCQUFNLFlBQVksUUFBUTtBQUMxQixnQkFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLFVBQVUsU0FBUyxZQUFZLEVBQUc7QUFFL0QsMkJBQWUsSUFBSSxNQUFNLFNBQVM7QUFDbEMsOEJBQWtCLE9BQU8sS0FBSyxXQUFXLE1BQU0sT0FBTyxTQUFTLHdCQUF3QjtBQUFBLFVBQ3pGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQU9BLFlBQU0sa0JBQWtCLE1BQU07QUFDNUIsWUFBSSxpQkFBa0I7QUFDdEIsMkJBQW1CO0FBQ25CLDhCQUFzQixNQUFNO0FBQzFCLDZCQUFtQjtBQUNuQixxQkFBVyxZQUFZLG1CQUFtQixPQUFPLEVBQUcsVUFBUyxXQUFXO0FBQ3hFLGdDQUFzQjtBQUN0QixxQkFBVyxDQUFDLE1BQU0sUUFBUSxLQUFLLG9CQUFvQjtBQUNqRCxxQkFBUyxRQUFRLEtBQUssYUFBYSxFQUFFLFdBQVcsTUFBTSxTQUFTLEtBQUssQ0FBQztBQUFBLFVBQ3ZFO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDSDtBQUVBLFlBQU0sMEJBQTBCLENBQUMsU0FBUztBQUN4QyxZQUFJLG1CQUFtQixJQUFJLElBQUksRUFBRztBQUNsQyxjQUFNLFdBQVcsSUFBSSxpQkFBaUIsZUFBZTtBQUNyRCxpQkFBUyxRQUFRLEtBQUssYUFBYSxFQUFFLFdBQVcsTUFBTSxTQUFTLEtBQUssQ0FBQztBQUNyRSwyQkFBbUIsSUFBSSxNQUFNLFFBQVE7QUFBQSxNQUN2QztBQUVBLGFBQU8sSUFBSSxVQUFVLGNBQWMscUJBQXFCO0FBQ3hELGFBQU8sY0FBYyxPQUFPLElBQUksVUFBVSxHQUFHLGlCQUFpQixxQkFBcUIsQ0FBQztBQUlwRixZQUFNLHNCQUFzQixDQUFDLFNBQVM7QUFDcEMsWUFBSSxDQUFDLEtBQU07QUFDWCxtQkFBVyxDQUFDLFlBQVksU0FBUyxLQUFLLGdCQUFnQjtBQUNwRCxjQUFJLFNBQVMsY0FBYyxLQUFLLFdBQVcsYUFBYSxHQUFHLEdBQUc7QUFDNUQsOEJBQWtCLE9BQU8sS0FBSyxXQUFXLFlBQVksT0FBTyxTQUFTLHdCQUF3QjtBQUFBLFVBQy9GO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxZQUFNLG9CQUFvQixDQUFDLE1BQU0sWUFBWTtBQUMzQyxZQUFJLENBQUMsT0FBTyxTQUFTLHVCQUF3QjtBQUM3QyxZQUFJLEVBQUUsZ0JBQWdCLFVBQVUsS0FBSyxjQUFjLEtBQU07QUFDekQsNEJBQW9CLEtBQUssSUFBSTtBQUM3QixZQUFJLFFBQVMscUJBQW9CLE9BQU87QUFBQSxNQUMxQztBQUNBLGFBQU8sY0FBYyxPQUFPLElBQUksTUFBTSxHQUFHLFVBQVUsaUJBQWlCLENBQUM7QUFDckUsYUFBTyxjQUFjLE9BQU8sSUFBSSxNQUFNLEdBQUcsVUFBVSxpQkFBaUIsQ0FBQztBQUNyRSxhQUFPLGNBQWMsT0FBTyxJQUFJLE1BQU0sR0FBRyxVQUFVLGlCQUFpQixDQUFDO0FBS3JFLFlBQU0sc0JBQXNCLENBQUMsU0FBUztBQUNwQyxZQUFJLENBQUMsT0FBTyxTQUFTLHVCQUF3QjtBQUM3QyxZQUFJLGdCQUFnQixRQUFTLHVCQUFzQjtBQUFBLE1BQ3JEO0FBQ0EsYUFBTyxjQUFjLE9BQU8sSUFBSSxNQUFNLEdBQUcsVUFBVSxtQkFBbUIsQ0FBQztBQUN2RSxhQUFPLGNBQWMsT0FBTyxJQUFJLE1BQU0sR0FBRyxVQUFVLG1CQUFtQixDQUFDO0FBTXZFLFlBQU0saUJBQWlCLENBQUMsUUFBUTtBQUM5QixZQUFJLENBQUMsT0FBTyxTQUFTLHVCQUF3QjtBQUM3QyxjQUFNLFVBQVUsSUFBSSxPQUFPLFFBQVEsbUJBQW1CO0FBQ3RELFlBQUksQ0FBQyxzQkFBc0IsU0FBUyxPQUFPLFNBQVMsb0JBQW9CLEVBQUc7QUFFM0UsY0FBTSxTQUFTLFFBQVEsY0FBYywyQkFBMkI7QUFDaEUsWUFBSSxVQUFVLE9BQU8sU0FBUyxJQUFJLE1BQU0sRUFBRztBQUUzQyxZQUFJLGVBQWU7QUFDbkIsWUFBSSxnQkFBZ0I7QUFFcEIsWUFBSSxPQUFPLFNBQVMsbUNBQW1DLFFBQVE7QUFDN0QsaUJBQU87QUFBQSxZQUNMLElBQUksV0FBVyxTQUFTO0FBQUEsY0FDdEIsU0FBUztBQUFBLGNBQ1QsWUFBWTtBQUFBLGNBQ1osU0FBUyxJQUFJO0FBQUEsY0FDYixTQUFTLElBQUk7QUFBQSxjQUNiLFVBQVUsSUFBSTtBQUFBLGNBQ2QsUUFBUSxJQUFJO0FBQUEsY0FDWixRQUFRLElBQUk7QUFBQSxZQUNkLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxlQUFTLGlCQUFpQixTQUFTLGdCQUFnQixJQUFJO0FBRXZELGFBQU8sU0FBUyxNQUFNO0FBQ3BCLGlCQUFTLG9CQUFvQixTQUFTLGdCQUFnQixJQUFJO0FBQzFELG1CQUFXLGFBQWEsZUFBZSxPQUFPLEdBQUc7QUFDL0MsNEJBQWtCLFNBQVM7QUFBQSxRQUM3QjtBQUNBLG1CQUFXLFFBQVEsY0FBYztBQUMvQixjQUFJLEtBQUssNEJBQTRCO0FBQ25DLGlCQUFLLGVBQWUsS0FBSztBQUN6QixtQkFBTyxLQUFLO0FBQUEsVUFDZDtBQUFBLFFBQ0Y7QUFDQSxxQkFBYSxNQUFNO0FBQ25CLG1CQUFXLFFBQVEsY0FBYztBQUMvQixjQUFJLEtBQUssc0JBQXNCO0FBQzdCLGlCQUFLLGlCQUFpQixLQUFLO0FBQzNCLG1CQUFPLEtBQUs7QUFBQSxVQUNkO0FBQ0EsY0FBSSxLQUFLLDRCQUE0QjtBQUNuQyxpQkFBSyxtQkFBbUIsS0FBSztBQUM3QixtQkFBTyxLQUFLO0FBQUEsVUFDZDtBQUFBLFFBQ0Y7QUFDQSxxQkFBYSxNQUFNO0FBQ25CLG1CQUFXLFlBQVksbUJBQW1CLE9BQU8sRUFBRyxVQUFTLFdBQVc7QUFDeEUsMkJBQW1CLE1BQU07QUFDekIsaUJBQVMsaUJBQWlCLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxPQUFPLEdBQUcsVUFBVSxPQUFPLGdCQUFnQixDQUFDO0FBQ2xHLGdCQUFRLE9BQU87QUFBQSxNQUNqQixDQUFDO0FBRUQsWUFBTSxjQUFjLE1BQU07QUFDeEIsZ0JBQVEsY0FBYyxPQUFPLFNBQVMseUJBQ2xDO0FBQUEsVUFDRSxPQUFPLFNBQVM7QUFBQSxVQUNoQixPQUFPLFNBQVM7QUFBQSxVQUNoQixPQUFPLFNBQVM7QUFBQSxRQUNsQixJQUNBO0FBQ0osOEJBQXNCO0FBQUEsTUFDeEI7QUFNQSxZQUFNLGdCQUFnQixDQUFDLE1BQU0sU0FBUztBQUNwQyxZQUFJLEtBQU0sbUJBQWtCLElBQUksSUFBSTtBQUFBLFlBQy9CLG1CQUFrQixPQUFPLElBQUk7QUFFbEMsY0FBTSxPQUFPLE9BQU8sSUFBSSxVQUFVLGdCQUFnQixlQUFlLEVBQUUsQ0FBQyxHQUFHO0FBQ3ZFLGNBQU0sWUFBWSxJQUFJLEdBQUcsYUFBYSxDQUFDLE1BQU0sSUFBSTtBQUFBLE1BQ25EO0FBS0EsWUFBTSx1QkFBdUIsQ0FBQyxXQUFXO0FBQ3ZDLGNBQU0sT0FBTyxPQUFPLElBQUksVUFBVSxnQkFBZ0IsZUFBZSxFQUFFLENBQUM7QUFDcEUsY0FBTSxNQUFNLGlCQUFpQixNQUFNO0FBQUEsTUFDckM7QUFPQSxhQUFPLHVCQUF1QixNQUFNO0FBQ2xDLFlBQUksQ0FBQyxPQUFPLFNBQVMsd0JBQXdCO0FBQzNDLGNBQUksT0FBTyxvQ0FBb0M7QUFDL0M7QUFBQSxRQUNGO0FBQ0EsY0FBTSxVQUFVLHVCQUF1QixPQUFPLEtBQUssT0FBTyxTQUFTLG9CQUFvQjtBQUN2RixZQUFJLFFBQVEsV0FBVyxHQUFHO0FBQ3hCLGNBQUksT0FBTyxtQ0FBbUM7QUFDOUM7QUFBQSxRQUNGO0FBQ0EsWUFBSSwwQkFBMEIsT0FBTyxLQUFLLFNBQVMsbUJBQW1CLENBQUMsV0FBVztBQUNoRixjQUFJLENBQUMsT0FBUTtBQUNiLGdCQUFNLFVBQVUsa0JBQWtCLElBQUksT0FBTyxJQUFJO0FBQ2pELHdCQUFjLE9BQU8sTUFBTSxDQUFDLE9BQU87QUFDbkMsY0FBSSxDQUFDLFFBQVMsc0JBQXFCLE1BQU07QUFBQSxRQUMzQyxDQUFDLEVBQUUsS0FBSztBQUFBLE1BQ1Y7QUFFQSxrQkFBWTtBQUNaLGFBQU87QUFBQSxJQUNUO0FBRUEsSUFBQUYsUUFBTyxVQUFVLEVBQUUseUJBQUFFLHlCQUF3QjtBQUFBO0FBQUE7OztBQ3RpQjNDO0FBQUEsNkJBQUFDLFVBQUFDLFNBQUE7QUFBQSxRQUFNLEVBQUUsTUFBTSxJQUFJLFFBQVEsVUFBVTtBQXNCcEMsUUFBTSxtQkFBbUI7QUFFekIsYUFBUyxrQkFBa0IsTUFBTTtBQUMvQixZQUFNLFFBQVEsS0FBSyxNQUFNLGdCQUFnQjtBQUN6QyxhQUFPLFFBQVEsRUFBRSxRQUFRLE1BQU0sQ0FBQyxFQUFFLFFBQVEsTUFBTSxNQUFNLENBQUMsRUFBRSxJQUFJO0FBQUEsSUFDL0Q7QUFHQSxhQUFTLFNBQVMsTUFBTTtBQUN0QixZQUFNLFFBQVEsS0FBSyxNQUFNLFVBQVU7QUFDbkMsYUFBTyxRQUFRLE1BQU0sQ0FBQyxFQUFFLFNBQVM7QUFBQSxJQUNuQztBQUVBLGFBQVMsVUFBVSxNQUFNO0FBQ3ZCLGFBQU8sU0FBUztBQUFBLElBQ2xCO0FBRUEsYUFBUyxnQkFBZ0IsTUFBTSxTQUFTO0FBQ3RDLGFBQU8sS0FBSyxRQUFRLGtCQUFrQixDQUFDLFVBQVUsTUFBTSxNQUFNLEdBQUcsRUFBRSxJQUFJLFVBQVUsR0FBRztBQUFBLElBQ3JGO0FBR0EsYUFBUyxlQUFlLE9BQU8sY0FBYztBQUMzQyxZQUFNLFVBQVUsa0JBQWtCLE1BQU0sWUFBWSxDQUFDO0FBQ3JELFVBQUksQ0FBQyxRQUFTLFFBQU87QUFFckIsWUFBTSxTQUFTLE1BQU0sTUFBTTtBQUMzQixVQUFJLFVBQVU7QUFDZCxZQUFNLGFBQWEsVUFBVSxRQUFRLElBQUk7QUFDekMsWUFBTSxVQUFVLGFBQWEsTUFBTTtBQUduQyxlQUFTLElBQUksZUFBZSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDckQsY0FBTSxNQUFNLFNBQVMsT0FBTyxDQUFDLENBQUM7QUFDOUIsWUFBSSxRQUFRLFFBQVEsT0FBTyxRQUFRLE9BQVE7QUFDM0MsY0FBTSxTQUFTLGtCQUFrQixPQUFPLENBQUMsQ0FBQztBQUMxQyxZQUFJLFVBQVUsVUFBVSxPQUFPLElBQUksTUFBTSxZQUFZO0FBQ25ELGlCQUFPLENBQUMsSUFBSSxnQkFBZ0IsT0FBTyxDQUFDLEdBQUcsT0FBTztBQUM5QyxvQkFBVTtBQUFBLFFBQ1o7QUFBQSxNQUNGO0FBSUEsVUFBSSxjQUFjLFFBQVE7QUFDMUIsVUFBSSxTQUFTO0FBQ2IsaUJBQVM7QUFDUCxZQUFJLGNBQWM7QUFDbEIsaUJBQVMsSUFBSSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDcEMsZ0JBQU0sTUFBTSxTQUFTLE9BQU8sQ0FBQyxDQUFDO0FBQzlCLGNBQUksUUFBUSxLQUFNO0FBQ2xCLGNBQUksTUFBTSxhQUFhO0FBQ3JCLDBCQUFjO0FBQ2Q7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUNBLFlBQUksZ0JBQWdCLEdBQUk7QUFFeEIsY0FBTSxTQUFTLGtCQUFrQixPQUFPLFdBQVcsQ0FBQztBQUNwRCxZQUFJLENBQUMsT0FBUTtBQUViLFlBQUksb0JBQW9CO0FBQ3hCLFlBQUksbUJBQW1CO0FBQ3ZCLFlBQUksYUFBYTtBQUNqQixpQkFBUyxJQUFJLGNBQWMsR0FBRyxJQUFJLE9BQU8sUUFBUSxLQUFLO0FBQ3BELGdCQUFNLE1BQU0sU0FBUyxPQUFPLENBQUMsQ0FBQztBQUM5QixjQUFJLFFBQVEsS0FBTTtBQUNsQixjQUFJLE9BQU8sT0FBTyxPQUFRO0FBQzFCLGNBQUksc0JBQXNCLEtBQU0scUJBQW9CO0FBQ3BELGNBQUksUUFBUSxrQkFBbUI7QUFDL0IsZ0JBQU0sU0FBUyxrQkFBa0IsT0FBTyxDQUFDLENBQUM7QUFDMUMsY0FBSSxDQUFDLE9BQVE7QUFDYiw2QkFBbUI7QUFDbkIsY0FBSSxDQUFDLFVBQVUsT0FBTyxJQUFJLEVBQUcsY0FBYTtBQUFBLFFBQzVDO0FBRUEsWUFBSSxDQUFDLGlCQUFrQjtBQUN2QixZQUFJLFVBQVUsT0FBTyxJQUFJLE1BQU0sV0FBWTtBQUUzQyxlQUFPLFdBQVcsSUFBSSxnQkFBZ0IsT0FBTyxXQUFXLEdBQUcsYUFBYSxNQUFNLEdBQUc7QUFDakYsa0JBQVU7QUFDVixzQkFBYyxPQUFPO0FBQ3JCLGlCQUFTO0FBQUEsTUFDWDtBQUVBLGFBQU8sVUFBVSxTQUFTO0FBQUEsSUFDNUI7QUFLQSxhQUFTLGFBQWEsVUFBVSxTQUFTO0FBQ3ZDLFVBQUksYUFBYSxVQUFhLGFBQWEsUUFBUyxRQUFPO0FBQzNELFlBQU0sV0FBVyxTQUFTLE1BQU0sSUFBSTtBQUNwQyxZQUFNLFdBQVcsUUFBUSxNQUFNLElBQUk7QUFDbkMsVUFBSSxTQUFTLFdBQVcsU0FBUyxPQUFRLFFBQU87QUFFaEQsVUFBSSxlQUFlO0FBQ25CLGVBQVMsSUFBSSxHQUFHLElBQUksU0FBUyxRQUFRLEtBQUs7QUFDeEMsWUFBSSxTQUFTLENBQUMsTUFBTSxTQUFTLENBQUMsR0FBRztBQUMvQixjQUFJLGlCQUFpQixHQUFJLFFBQU87QUFDaEMseUJBQWU7QUFBQSxRQUNqQjtBQUFBLE1BQ0Y7QUFDQSxVQUFJLGlCQUFpQixHQUFJLFFBQU87QUFFaEMsWUFBTSxTQUFTLGtCQUFrQixTQUFTLFlBQVksQ0FBQztBQUN2RCxZQUFNLFFBQVEsa0JBQWtCLFNBQVMsWUFBWSxDQUFDO0FBQ3RELFVBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLFdBQVcsTUFBTSxPQUFRLFFBQU87QUFDaEUsVUFBSSxVQUFVLE9BQU8sSUFBSSxNQUFNLFVBQVUsTUFBTSxJQUFJLEVBQUcsUUFBTztBQUM3RCxhQUFPO0FBQUEsSUFDVDtBQWdCQSxhQUFTLFdBQVcsUUFBUSxNQUFNO0FBQ2hDLGFBQU8sT0FBTyxJQUFJLFVBQVUsZ0JBQWdCLFVBQVUsRUFBRSxLQUFLLENBQUMsU0FBUyxLQUFLLE1BQU0sTUFBTSxTQUFTLElBQUk7QUFBQSxJQUN2RztBQUVBLGFBQVNDLDRCQUEyQixRQUFRO0FBQzFDLFlBQU0sY0FBYyxvQkFBSSxJQUFJO0FBQzVCLFlBQU0sV0FBVyxvQkFBSSxJQUFJO0FBRXpCLFlBQU0sU0FBUyxDQUFDLFNBQVM7QUFDdkIsb0JBQVksT0FBTyxJQUFJO0FBQ3ZCLGlCQUFTLE9BQU8sSUFBSTtBQUFBLE1BQ3RCO0FBSUEsWUFBTSxtQkFBbUIsTUFBTTtBQUM3QixZQUFJLFlBQVksU0FBUyxFQUFHO0FBQzVCLGNBQU0sWUFBWSxJQUFJO0FBQUEsVUFDcEIsT0FBTyxJQUFJLFVBQVUsZ0JBQWdCLFVBQVUsRUFBRSxJQUFJLENBQUMsU0FBUyxLQUFLLE1BQU0sTUFBTSxJQUFJLEVBQUUsT0FBTyxPQUFPO0FBQUEsUUFDdEc7QUFDQSxtQkFBVyxRQUFRLFlBQVksS0FBSyxHQUFHO0FBQ3JDLGNBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxFQUFHLGFBQVksT0FBTyxJQUFJO0FBQUEsUUFDbkQ7QUFBQSxNQUNGO0FBRUEsWUFBTSxPQUFPLE9BQU8sU0FBUztBQUMzQixZQUFJLENBQUMsT0FBTyxTQUFTLDBCQUEyQjtBQUNoRCx5QkFBaUI7QUFDakIsWUFBSSxFQUFFLGdCQUFnQixVQUFVLEtBQUssY0FBYyxLQUFNO0FBQ3pELFlBQUksWUFBWSxJQUFJLEtBQUssSUFBSSxFQUFHO0FBQ2hDLG9CQUFZLElBQUksS0FBSyxNQUFNLE1BQU0sT0FBTyxJQUFJLE1BQU0sV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNwRTtBQUVBLFlBQU0sb0JBQW9CLE9BQU8sU0FBUztBQUN4QyxZQUFJLENBQUMsT0FBTyxTQUFTLDBCQUEyQjtBQUNoRCxZQUFJLEVBQUUsZ0JBQWdCLFVBQVUsS0FBSyxjQUFjLEtBQU07QUFDekQsWUFBSSxTQUFTLElBQUksS0FBSyxJQUFJLEVBQUc7QUFDN0IsWUFBSSxDQUFDLFdBQVcsUUFBUSxLQUFLLElBQUksRUFBRztBQUVwQyxjQUFNLFVBQVUsTUFBTSxPQUFPLElBQUksTUFBTSxXQUFXLElBQUk7QUFDdEQsY0FBTSxXQUFXLFlBQVksSUFBSSxLQUFLLElBQUk7QUFDMUMsb0JBQVksSUFBSSxLQUFLLE1BQU0sT0FBTztBQUVsQyxjQUFNLE1BQU0sYUFBYSxVQUFVLE9BQU87QUFDMUMsWUFBSSxRQUFRLEdBQUk7QUFFaEIsY0FBTSxXQUFXLFFBQVEsTUFBTSxJQUFJO0FBQ25DLGNBQU0sV0FBVyxlQUFlLFVBQVUsR0FBRztBQUM3QyxZQUFJLENBQUMsU0FBVTtBQUNmLGNBQU0sWUFBWSxTQUFTLEtBQUssSUFBSTtBQUVwQyxpQkFBUyxJQUFJLEtBQUssSUFBSTtBQUN0QixvQkFBWSxJQUFJLEtBQUssTUFBTSxTQUFTO0FBQ3BDLFlBQUk7QUFDRixnQkFBTSxPQUFPLElBQUksTUFBTSxRQUFRLE1BQU0sTUFBTSxTQUFTO0FBQUEsUUFDdEQsVUFBRTtBQUNBLG1CQUFTLE9BQU8sS0FBSyxJQUFJO0FBQUEsUUFDM0I7QUFBQSxNQUNGO0FBRUEsWUFBTSxxQkFBcUIsQ0FBQyxRQUFRLFNBQVM7QUFDM0MsWUFBSSxDQUFDLE9BQU8sU0FBUywwQkFBMkI7QUFDaEQsY0FBTSxPQUFPLE1BQU07QUFDbkIsWUFBSSxFQUFFLGdCQUFnQixVQUFVLEtBQUssY0FBYyxLQUFNO0FBQ3pELFlBQUksU0FBUyxJQUFJLEtBQUssSUFBSSxFQUFHO0FBRTdCLGNBQU0sVUFBVSxPQUFPLFNBQVM7QUFDaEMsY0FBTSxXQUFXLFlBQVksSUFBSSxLQUFLLElBQUk7QUFDMUMsb0JBQVksSUFBSSxLQUFLLE1BQU0sT0FBTztBQUVsQyxjQUFNLE1BQU0sYUFBYSxVQUFVLE9BQU87QUFDMUMsWUFBSSxRQUFRLEdBQUk7QUFFaEIsY0FBTSxXQUFXLFFBQVEsTUFBTSxJQUFJO0FBQ25DLGNBQU0sV0FBVyxlQUFlLFVBQVUsR0FBRztBQUM3QyxZQUFJLENBQUMsU0FBVTtBQUtmLGNBQU0sVUFBVSxDQUFDO0FBQ2pCLGlCQUFTLElBQUksR0FBRyxJQUFJLFNBQVMsUUFBUSxLQUFLO0FBQ3hDLGNBQUksTUFBTSxPQUFPLFNBQVMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxFQUFHO0FBQzlDLGtCQUFRLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxHQUFHLElBQUksRUFBRSxHQUFHLElBQUksRUFBRSxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsRUFBRSxPQUFPLEdBQUcsTUFBTSxTQUFTLENBQUMsRUFBRSxDQUFDO0FBQUEsUUFDdkc7QUFDQSxZQUFJLFFBQVEsV0FBVyxFQUFHO0FBRTFCLGNBQU0sWUFBWSxTQUFTLEtBQUssSUFBSTtBQUNwQyxpQkFBUyxJQUFJLEtBQUssSUFBSTtBQUN0QixvQkFBWSxJQUFJLEtBQUssTUFBTSxTQUFTO0FBQ3BDLFlBQUk7QUFDRixpQkFBTyxZQUFZLEVBQUUsUUFBUSxDQUFDO0FBQUEsUUFDaEMsVUFBRTtBQUNBLG1CQUFTLE9BQU8sS0FBSyxJQUFJO0FBQUEsUUFDM0I7QUFBQSxNQUNGO0FBRUEsYUFBTyxjQUFjLE9BQU8sSUFBSSxNQUFNLEdBQUcsVUFBVSxpQkFBaUIsQ0FBQztBQUNyRSxhQUFPLGNBQWMsT0FBTyxJQUFJLFVBQVUsR0FBRyxpQkFBaUIsa0JBQWtCLENBQUM7QUFDakYsYUFBTyxjQUFjLE9BQU8sSUFBSSxVQUFVLEdBQUcsYUFBYSxJQUFJLENBQUM7QUFDL0QsYUFBTyxjQUFjLE9BQU8sSUFBSSxNQUFNLEdBQUcsVUFBVSxDQUFDLFNBQVMsT0FBTyxLQUFLLElBQUksQ0FBQyxDQUFDO0FBQy9FLGFBQU8sY0FBYyxPQUFPLElBQUksTUFBTSxHQUFHLFVBQVUsQ0FBQyxPQUFPLFlBQVksT0FBTyxPQUFPLENBQUMsQ0FBQztBQUN2RixhQUFPLElBQUksVUFBVSxjQUFjLE1BQU07QUFDdkMsY0FBTSxTQUFTLE9BQU8sSUFBSSxVQUFVLGNBQWM7QUFDbEQsWUFBSSxPQUFRLE1BQUssTUFBTTtBQUFBLE1BQ3pCLENBQUM7QUFBQSxJQUNIO0FBRUEsSUFBQUQsUUFBTyxVQUFVLEVBQUUsNEJBQUFDLDZCQUE0QixnQkFBZ0Isa0JBQWtCO0FBQUE7QUFBQTs7O0FDalFqRjtBQUFBLDZCQUFBQyxVQUFBQyxTQUFBO0FBQUEsUUFBTSxhQUFhO0FBb0RuQixhQUFTLDZCQUE2QixLQUFLLFNBQVM7QUFDbEQsVUFBSSxVQUFVO0FBQ2QsWUFBTSxPQUFPLFFBQVEsT0FBTyxDQUFDLFdBQVc7QUFDdEMsWUFBSSxPQUFPLFdBQVcsTUFBTSxPQUFPLEtBQUssT0FBTyxTQUFTLEVBQUcsUUFBTztBQUNsRSxZQUFJLElBQUksWUFBWSxPQUFPLE1BQU0sT0FBTyxFQUFFLE1BQU0sSUFBSyxRQUFPO0FBQzVELGNBQU0sU0FBUyxPQUFPLE9BQU8sSUFBSSxJQUFJLFlBQVksT0FBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUk7QUFDakYsY0FBTSxRQUFRLE9BQU8sS0FBSyxJQUFJLFNBQVMsSUFBSSxZQUFZLE9BQU8sSUFBSSxPQUFPLEtBQUssQ0FBQyxJQUFJO0FBQ25GLFlBQUksV0FBVyxPQUFPLFVBQVUsSUFBSyxRQUFPO0FBQzVDLGtCQUFVO0FBQ1YsZUFBTztBQUFBLE1BQ1QsQ0FBQztBQUNELGFBQU8sVUFBVSxPQUFPO0FBQUEsSUFDMUI7QUFFQSxhQUFTQywwQkFBeUIsUUFBUTtBQUN4QyxZQUFNLFFBQVEsTUFBTTtBQUNsQixjQUFNLE1BQU0sT0FBTyxJQUFJLFNBQVMsU0FBUyxVQUFVO0FBQ25ELFlBQUksQ0FBQyxPQUFPLElBQUksb0JBQXFCO0FBQ3JDLFlBQUksc0JBQXNCO0FBRTFCLGNBQU0sV0FBVyxJQUFJO0FBQ3JCLFlBQUksaUJBQWlCLFNBQVUsUUFBUSxLQUFLO0FBQzFDLGNBQUksQ0FBQyxPQUFPLFNBQVMsd0JBQXlCLFFBQU8sU0FBUyxLQUFLLE1BQU0sUUFBUSxHQUFHO0FBRXBGLGdCQUFNLEtBQUssT0FBTztBQUNsQixnQkFBTSxtQkFBbUIsR0FBRyxTQUFTLEtBQUssRUFBRTtBQUM1QyxhQUFHLFdBQVcsU0FBVSxNQUFNO0FBQzVCLGdCQUFJLFFBQVEsTUFBTSxRQUFRLEtBQUssT0FBTyxHQUFHO0FBQ3ZDLG9CQUFNLE1BQU0sR0FBRyxNQUFNO0FBQ3JCLHlCQUFXLFVBQVUsS0FBSyxTQUFTO0FBQ2pDLG9CQUFJLE9BQU8sV0FBVyxJQUFLLFFBQU8sU0FBUztBQUFBLGNBQzdDO0FBQ0Esb0JBQU0sV0FBVyw2QkFBNkIsS0FBSyxLQUFLLE9BQU87QUFDL0Qsa0JBQUksYUFBYSxLQUFLLFNBQVM7QUFNN0Isc0JBQU0sRUFBRSxXQUFXLEdBQUcsS0FBSyxJQUFJO0FBQy9CLHVCQUFPLEVBQUUsR0FBRyxNQUFNLFNBQVMsU0FBUztBQUFBLGNBQ3RDO0FBQUEsWUFDRjtBQUNBLG1CQUFPLGlCQUFpQixJQUFJO0FBQUEsVUFDOUI7QUFDQSxjQUFJO0FBQ0YsbUJBQU8sU0FBUyxLQUFLLE1BQU0sUUFBUSxHQUFHO0FBQUEsVUFDeEMsVUFBRTtBQUNBLGVBQUcsV0FBVztBQUFBLFVBQ2hCO0FBQUEsUUFDRjtBQUVBLGVBQU8sU0FBUyxNQUFNO0FBQ3BCLGNBQUksaUJBQWlCO0FBQ3JCLGlCQUFPLElBQUk7QUFBQSxRQUNiLENBQUM7QUFBQSxNQUNIO0FBRUEsYUFBTyxJQUFJLFVBQVUsY0FBYyxLQUFLO0FBQUEsSUFDMUM7QUFFQSxJQUFBRCxRQUFPLFVBQVUsRUFBRSwwQkFBQUMsMEJBQXlCO0FBQUE7QUFBQTs7O0FDakg1QyxJQUFNLEVBQUUsT0FBTyxJQUFJLFFBQVEsVUFBVTtBQUNyQyxJQUFNLEVBQUUsa0JBQWtCLGVBQWUsSUFBSTtBQUM3QyxJQUFNLEVBQUUsaUJBQWlCLElBQUk7QUFDN0IsSUFBTSxFQUFFLHdCQUF3QixJQUFJO0FBQ3BDLElBQU0sRUFBRSw4QkFBOEIsSUFBSTtBQUMxQyxJQUFNLEVBQUUsMkJBQTJCLElBQUk7QUFDdkMsSUFBTSxFQUFFLHlCQUF5QixJQUFJO0FBQ3JDLElBQU0sRUFBRSx5QkFBeUIsSUFBSTtBQUVyQyxPQUFPLFVBQVUsTUFBTSxtQkFBbUIsT0FBTztBQUFBLEVBQy9DLE1BQU0sU0FBUztBQUNiLFVBQU0sS0FBSyxhQUFhO0FBQ3hCLHFCQUFpQixJQUFJO0FBQ3JCLFNBQUssY0FBYyxJQUFJLGVBQWUsS0FBSyxLQUFLLElBQUksQ0FBQztBQUNyRCxTQUFLLDRCQUE0Qix3QkFBd0IsSUFBSTtBQUM3RCxrQ0FBOEIsSUFBSTtBQUNsQywrQkFBMkIsSUFBSTtBQUMvQixTQUFLLGlDQUFpQyx5QkFBeUIsSUFBSTtBQUNuRSw2QkFBeUIsSUFBSTtBQUFBLEVBQy9CO0FBQUEsRUFFQSxXQUFXO0FBQUEsRUFBQztBQUFBLEVBRVosTUFBTSxlQUFlO0FBQ25CLFNBQUssV0FBVyxPQUFPLE9BQU8sQ0FBQyxHQUFHLGtCQUFrQixNQUFNLEtBQUssU0FBUyxDQUFDO0FBQUEsRUFDM0U7QUFBQSxFQUVBLE1BQU0sZUFBZTtBQUNuQixVQUFNLEtBQUssU0FBUyxLQUFLLFFBQVE7QUFBQSxFQUNuQztBQUNGOyIsCiAgIm5hbWVzIjogWyJleHBvcnRzIiwgIm1vZHVsZSIsICJyZWdpc3RlckltcG9ydGFudFBsdWdpbnMiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAiREVGQVVMVF9TRVRUSU5HUyIsICJGcmVkU2V0dGluZ1RhYiIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJyZWdpc3RlclByb3BlcnR5QmFja2xpbmtzTGl2ZSIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJyZWdpc3RlckNvbW1hbmRzIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgInBhdGgiLCAicmVnaXN0ZXJEYXRhYmFzZUZvbGRlcnMiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmMiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJJdGFsaWNVbmRlcnNjb3JlIl0KfQo=
