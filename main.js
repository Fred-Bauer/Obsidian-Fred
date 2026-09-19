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
    var { PluginSettingTab, Setting, Notice, setIcon } = require("obsidian");
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
      displayGeneralTab(containerEl) {
        containerEl.createEl("h4", { text: "Datenbank-Ordner" });
        new Setting(containerEl).setName("Pr\xE4fix-Ordner als Datenbank behandeln").setDesc("Ordner, deren Name mit dem Pr\xE4fix beginnt, sind im Dateibaum nicht mehr auf-/zuklappbar.").addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.databaseFoldersEnabled).onChange(async (value) => {
            this.plugin.settings.databaseFoldersEnabled = value;
            await this.plugin.saveSettings();
            this.plugin.updateDatabaseFolderStyle?.();
          })
        );
        new Setting(containerEl).setName("Pr\xE4fix").setDesc("Ordnernamen, die mit diesem Zeichen/Text beginnen, gelten als Datenbank-Ordner.").addText(
          (text) => text.setValue(this.plugin.settings.databaseFolderPrefix).onChange(async (value) => {
            this.plugin.settings.databaseFolderPrefix = value;
            await this.plugin.saveSettings();
            this.plugin.updateDatabaseFolderStyle?.();
          })
        );
        new Setting(containerEl).setName("Folder-Notes-Erweiterung: gesamte Zeile klickbar").setDesc(
          "Bei Datenbank-Ordnern \xF6ffnet ein Klick irgendwo in der Titelzeile (nicht nur auf dem Namen) die zugeh\xF6rige Folder-Note, sofern das Folder-Notes-Plugin genutzt wird."
        ).addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.folderNoteClickExtensionEnabled).onChange(async (value) => {
            this.plugin.settings.folderNoteClickExtensionEnabled = value;
            await this.plugin.saveSettings();
            this.plugin.updateDatabaseFolderStyle?.();
          })
        );
        new Setting(containerEl).setName("Anzahl am Zeilenende anzeigen").setDesc("Zeigt die .md-Datei-Anzahl statt an Stelle des Pfeils am Zeilenende an, wie sonst die Dateiendung.").addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.databaseFolderCountAtEnd).onChange(async (value) => {
            this.plugin.settings.databaseFolderCountAtEnd = value;
            await this.plugin.saveSettings();
            this.plugin.updateDatabaseFolderStyle?.();
          })
        );
        containerEl.createEl("h4", { text: "Property-Backlinking" });
        new Setting(containerEl).setName("Properties").setDesc(
          "Kommagetrennte Liste von Frontmatter-Properties mit Links zu anderen Notizen (z. B. Familie, Freunde) - gilt f\xFCr alle Notizen, unabh\xE4ngig vom TYP. Verlinkt eine Notiz hier eine andere, bekommt die andere automatisch den Backlink in derselben Property erg\xE4nzt - und wieder entfernt, sobald die Verlinkung wegf\xE4llt. Gro\xDF-/Kleinschreibung muss exakt zum Property-Namen passen."
        ).addText(
          (text) => text.setValue(this.plugin.settings.reciprocalLinkProperties.join(", ")).onChange(async (value) => {
            this.plugin.settings.reciprocalLinkProperties = value.split(",").map((name) => name.trim()).filter((name) => name.length > 0);
            await this.plugin.saveSettings();
          })
        );
        new Setting(containerEl).setName("Live aktualisieren").setDesc(
          'Property-Backlinking sofort beim Speichern abgleichen, statt nur auf Befehl ("Property-Backlinking aktualisieren").'
        ).addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.propertyBacklinksLiveEnabled).onChange(async (value) => {
            this.plugin.settings.propertyBacklinksLiveEnabled = value;
            await this.plugin.saveSettings();
          })
        );
        containerEl.createEl("h4", { text: "Checklisten" });
        new Setting(containerEl).setName("Verschachtelte Checkboxen mit umschalten").setDesc(
          "Beim (Ent)Haken einer Checkbox werden alle darunter verschachtelten Checkboxen automatisch mit (ent)hakt - und umgekehrt: sind alle Checkboxen einer Unterliste angehakt, wird die \xFCbergeordnete Checkbox automatisch mit angehakt, und wieder entfernt, sobald eine davon wieder abgehakt wird."
        ).addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.nestedCheckboxSyncEnabled).onChange(async (value) => {
            this.plugin.settings.nestedCheckboxSyncEnabled = value;
            await this.plugin.saveSettings();
          })
        );
        containerEl.createEl("h4", { text: "Formatierung" });
        new Setting(containerEl).setName("Kursiv mit Unterstrichen").setDesc(
          'Der Befehl "Kursiv umschalten" setzt beim Einf\xFCgen Unterstriche (_Text_) statt Sternchen (*Text*) um die Auswahl. Bereits vorhandene Kursivformatierung (mit * oder _) wird beim erneuten Umschalten weiterhin korrekt erkannt und entfernt.'
        ).addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.italicUnderscoreEnabled).onChange(async (value) => {
            this.plugin.settings.italicUnderscoreEnabled = value;
            await this.plugin.saveSettings();
          })
        );
        containerEl.createEl("h4", { text: "Important Plugin Settings" });
        const importantPluginsHeader = containerEl.createDiv({ cls: "fred-important-plugins-header" });
        importantPluginsHeader.createEl("p", {
          cls: "setting-item-description",
          text: "Eigener Befehl je Plugin, um dessen Einstellungen direkt zu \xF6ffnen."
        });
        const addImportantPluginBtn = importantPluginsHeader.createDiv({
          cls: "clickable-icon",
          attr: { "aria-label": "Plugin hinzuf\xFCgen" }
        });
        setIcon(addImportantPluginBtn, "plus");
        addImportantPluginBtn.addEventListener("click", () => {
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
        });
        const listEl = containerEl.createDiv({ cls: "fred-important-plugins-list" });
        const renderImportantPluginsList = () => {
          listEl.empty();
          const manifests = this.plugin.app.plugins.manifests;
          const enabledIds = this.plugin.settings.importantPlugins.filter(
            (id) => manifests[id] && Object.prototype.hasOwnProperty.call(this.plugin.app.plugins.plugins, id)
          );
          if (enabledIds.length === 0) {
            listEl.createEl("p", { cls: "setting-item-description", text: "Keine wichtigen Plugins eingetragen." });
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
        containerEl.createEl("h4", { text: "Kontaktimport" });
        new Setting(containerEl).setName("CSV-Datei").setDesc("Pfad zur Kontakte-CSV, relativ zum Vault-Root.").addText(
          (text) => text.setValue(this.plugin.settings.contactsCsvPath).onChange(async (value) => {
            this.plugin.settings.contactsCsvPath = value;
            await this.plugin.saveSettings();
          })
        );
        new Setting(containerEl).setName("Kontakte-Basisverzeichnis").setDesc(
          "Alle Kontakte landen flach direkt in diesem Ordner (relativ zum Vault-Root). Bestehende Notizen in direkten Unterordnern werden beim Import hierher zusammengef\xFChrt."
        ).addText(
          (text) => text.setValue(this.plugin.settings.contactsBaseDir).onChange(async (value) => {
            this.plugin.settings.contactsBaseDir = value;
            await this.plugin.saveSettings();
          })
        );
        new Setting(containerEl).setName("Nur bestehende Kontakte aktualisieren").setDesc("Wenn aktiv, werden keine neuen Kontakt-Notizen angelegt, nur bestehende aktualisiert.").addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.contactsEditOnly).onChange(async (value) => {
            this.plugin.settings.contactsEditOnly = value;
            await this.plugin.saveSettings();
          })
        );
        new Setting(containerEl).setName("Irrelevante Kontakte \xFCberspringen").setDesc("Kontakte ohne Geburtstag und ohne Tags werden \xFCbersprungen.").addToggle(
          (toggle) => toggle.setValue(this.plugin.settings.contactsFilterRelevant).onChange(async (value) => {
            this.plugin.settings.contactsFilterRelevant = value;
            await this.plugin.saveSettings();
          })
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL2ltcG9ydGFudC1wbHVnaW5zLmpzIiwgInNyYy9zZXR0aW5ncy5qcyIsICJzcmMva29udGFrdC1pbXBvcnQuanMiLCAic3JjL3Byb3BlcnR5LXN5bmMuanMiLCAic3JjL2NvbW1hbmRzLmpzIiwgInNyYy9kYXRhYmFzZS1mb2xkZXJzLmpzIiwgInNyYy9uZXN0ZWQtY2hlY2tib3hlcy5qcyIsICJzcmMvaXRhbGljLXVuZGVyc2NvcmUuanMiLCAic3JjL21haW4uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IHsgRnV6enlTdWdnZXN0TW9kYWwsIE5vdGljZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vLyBHZW5lcmlzY2hlciBQaWNrZXI6IHdcdTAwRTRobHQgYXVzIGVpbmVyIE1hbmlmZXN0LUxpc3RlIGVpbnMgYXVzLCBsXHUwMEY2c3QgbWl0XG4vLyBkZXNzZW4gSUQgb2RlciBudWxsIChBYmJydWNoKSBhdWYgLSBnZW51dHp0IHNvd29obCB6dW0gSGluenVmXHUwMEZDZ2VuIGVpbmVzXG4vLyBQbHVnaW5zIGluIGRlbiBFaW5zdGVsbHVuZ2VuIChzZXR0aW5ncy5qcykgYWxzIGF1Y2ggdm9tIFNhbW1lbGJlZmVobCB1bnRlbi5cbi8vIEdsZWljaGVyIEF1ZmJhdSB3aWUgVHlwUGlja2VyTW9kYWwgKHR5cGUtcGlja2VyLmpzKSwgaW5rbC4gZGVzc2VsYmVuXG4vLyBzZWxlY3RTdWdnZXN0aW9uKCkvb25DaG9vc2VJdGVtKCktS29tbWVudGFycyBkb3J0OiBPYnNpZGlhbnMgU3VnZ2VzdE1vZGFsXG4vLyBydWZ0IGludGVybiBlcnN0IGNsb3NlKCkgdW5kIGRhbmFjaCBlcnN0IG9uQ2hvb3NlSXRlbSgpIGF1ZiAtIFwiY2hvc2VuXCJcbi8vIG11c3MgZGVzaGFsYiBzY2hvbiBpbiBzZWxlY3RTdWdnZXN0aW9uKCkgZ2VzZXR6dCB3ZXJkZW4sIHNvbnN0IGxcdTAwRjZzdCBkYXMgdm9uXG4vLyBjbG9zZSgpIGF1c2dlbFx1MDBGNnN0ZSBvbkNsb3NlKCkgZGFzIFByb21pc2UgZlx1MDBFNGxzY2hsaWNoIHp1ZXJzdCBtaXQgbnVsbCBhdWYuXG5jbGFzcyBQbHVnaW5QaWNrZXJNb2RhbCBleHRlbmRzIEZ1enp5U3VnZ2VzdE1vZGFsIHtcbiAgY29uc3RydWN0b3IoYXBwLCBtYW5pZmVzdHMsIHJlc29sdmUpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMubWFuaWZlc3RzID0gbWFuaWZlc3RzO1xuICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgdGhpcy5jaG9zZW4gPSBmYWxzZTtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwiRVNDIGZcdTAwRkNyIEFiYnJ1Y2hcIik7XG4gIH1cblxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5tYW5pZmVzdHM7XG4gIH1cblxuICBnZXRJdGVtVGV4dChtYW5pZmVzdCkge1xuICAgIHJldHVybiBtYW5pZmVzdC5uYW1lO1xuICB9XG5cbiAgc2VsZWN0U3VnZ2VzdGlvbihpdGVtLCBldnQpIHtcbiAgICB0aGlzLmNob3NlbiA9IHRydWU7XG4gICAgc3VwZXIuc2VsZWN0U3VnZ2VzdGlvbihpdGVtLCBldnQpO1xuICB9XG5cbiAgb25DaG9vc2VJdGVtKG1hbmlmZXN0KSB7XG4gICAgdGhpcy5yZXNvbHZlKG1hbmlmZXN0LmlkKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKSB7XG4gICAgc3VwZXIub25DbG9zZSgpO1xuICAgIGlmICghdGhpcy5jaG9zZW4pIHRoaXMucmVzb2x2ZShudWxsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0VuYWJsZWQoYXBwLCBpZCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFwcC5wbHVnaW5zLnBsdWdpbnMsIGlkKTtcbn1cblxuLy8gQWxzIFwid2ljaHRpZ1wiIG1hcmtpZXJ0ZSBQbHVnaW5zIChzZXR0aW5ncy5qcywgR2VuZXJlbGwgLT4gSW1wb3J0YW50IFBsdWdpblxuLy8gU2V0dGluZ3MpLCBnZWZpbHRlcnQgYXVmIGFrdHVlbGwgYWt0aXZpZXJ0ZSAtIEdydW5kbGFnZSBzb3dvaGwgZlx1MDBGQ3IgZGllXG4vLyBFaW56ZWxiZWZlaGxlIGFscyBhdWNoIGRlbiBTYW1tZWxiZWZlaGwuIEVpbiBkZWFrdGl2aWVydGVzIFBsdWdpbiBoYXQga2VpbmVcbi8vIG9mZmVuZSBTZXR0aW5ncy1UYWIgKE9ic2lkaWFuIGVudGxcdTAwRTRkdCBzaWUgbWl0IGRlbSBQbHVnaW4pLCBlaW4gQmVmZWhsIGRhZlx1MDBGQ3Jcbi8vIHdcdTAwRTRyZSBhbHNvIG9obmVoaW4gd2lya3VuZ3Nsb3MuXG5mdW5jdGlvbiBlbmFibGVkSW1wb3J0YW50TWFuaWZlc3RzKHBsdWdpbikge1xuICByZXR1cm4gcGx1Z2luLnNldHRpbmdzLmltcG9ydGFudFBsdWdpbnNcbiAgICAuZmlsdGVyKChpZCkgPT4gaXNFbmFibGVkKHBsdWdpbi5hcHAsIGlkKSlcbiAgICAubWFwKChpZCkgPT4gcGx1Z2luLmFwcC5wbHVnaW5zLm1hbmlmZXN0c1tpZF0pXG4gICAgLmZpbHRlcihCb29sZWFuKTtcbn1cblxuZnVuY3Rpb24gb3BlblBsdWdpblNldHRpbmdzKGFwcCwgaWQpIHtcbiAgYXBwLnNldHRpbmcub3BlbigpO1xuICBpZiAoIWFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKGlkKSkgbmV3IE5vdGljZShcIkRpZXNlcyBQbHVnaW4gaGF0IGtlaW5lIGVpZ2VuZW4gRWluc3RlbGx1bmdlbi5cIik7XG59XG5cbi8vIFNhbW1lbGJlZmVobCBcIldpY2h0aWdlcyBQbHVnaW4gLSBFaW5zdGVsbHVuZ2VuIFx1MDBGNmZmbmVuXCI6IGJlaSBnZW5hdSBlaW5lbVxuLy8gbWFya2llcnRlbiAoYWt0aXZpZXJ0ZW4pIFBsdWdpbiBvaG5lIFp3aXNjaGVuc2Nocml0dCwgc29uc3QgXHUwMEZDYmVyIGRlbnNlbGJlblxuLy8gUGlja2VyIHdpZSBiZWltIEhpbnp1Zlx1MDBGQ2dlbiBpbiBkZW4gRWluc3RlbGx1bmdlbi4gRXJnXHUwMEU0bnp0IGRpZSBFaW56ZWxiZWZlaGxlXG4vLyB1bnRlbiwgZXJzZXR6dCBzaWUgbmljaHQgLSBwcmFrdGlzY2gsIHdlbm4gbWFuIGRlbiBOYW1lbiBkZXMgRWluemVsYmVmZWhsc1xuLy8gbmljaHQgaW0gS29wZiBoYXQuXG5hc3luYyBmdW5jdGlvbiBvcGVuSW1wb3J0YW50UGx1Z2luU2V0dGluZ3NQaWNrZXIocGx1Z2luKSB7XG4gIGNvbnN0IG1hbmlmZXN0cyA9IGVuYWJsZWRJbXBvcnRhbnRNYW5pZmVzdHMocGx1Z2luKTtcblxuICBpZiAobWFuaWZlc3RzLmxlbmd0aCA9PT0gMCkge1xuICAgIG5ldyBOb3RpY2UoJ0tlaW5lIHdpY2h0aWdlbiBQbHVnaW5zIGVpbmdldHJhZ2VuIChFaW5zdGVsbHVuZ2VuIC0+IEdlbmVyZWxsIC0+IFwiSW1wb3J0YW50IFBsdWdpbiBTZXR0aW5nc1wiKS4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG1hbmlmZXN0cy5sZW5ndGggPT09IDEpIHtcbiAgICBvcGVuUGx1Z2luU2V0dGluZ3MocGx1Z2luLmFwcCwgbWFuaWZlc3RzWzBdLmlkKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBpZCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBuZXcgUGx1Z2luUGlja2VyTW9kYWwocGx1Z2luLmFwcCwgbWFuaWZlc3RzLCByZXNvbHZlKS5vcGVuKCkpO1xuICBpZiAoaWQpIG9wZW5QbHVnaW5TZXR0aW5ncyhwbHVnaW4uYXBwLCBpZCk7XG59XG5cbi8vIEVpbiBlaWdlbmVyIEJlZmVobCBqZSBtYXJraWVydGVtIChha3RpdmllcnRlbSkgUGx1Z2luLiBPYnNpZGlhbnMgQ29tbWFuZHMtXG4vLyBSZWdpc3RyeSBlcmxhdWJ0IGFkZENvbW1hbmQoKS9yZW1vdmVDb21tYW5kKCkgamVkZXJ6ZWl0LCBuaWNodCBudXIgYmVpbVxuLy8gUGx1Z2luLVN0YXJ0IC0gaGllciBkZXNoYWxiIGJlaSBqZWRlciBcdTAwQzRuZGVydW5nIGRlciBMaXN0ZSAoRWluc3RlbGx1bmdlbilcbi8vIHNvd2llIGJlaSBqZWRlciBQbHVnaW4tQWt0aXZpZXJ1bmcvLURlYWt0aXZpZXJ1bmcgbmV1IG1pdCBkZW0gSXN0LVp1c3RhbmRcbi8vIGFiZ2VnbGljaGVuLCBzdGF0dCBkaWUgQmVmZWhsZSBlaW5tYWxpZyBmaXggenUgcmVnaXN0cmllcmVuLlxuY29uc3QgcmVnaXN0ZXJlZENvbW1hbmRJZHMgPSBuZXcgU2V0KCk7XG5cbmZ1bmN0aW9uIGNvbW1hbmRJZEZvcihwbHVnaW5JZCkge1xuICByZXR1cm4gYG9wZW4tJHtwbHVnaW5JZH0tc2V0dGluZ3NgO1xufVxuXG5mdW5jdGlvbiByZWZyZXNoUGVyUGx1Z2luQ29tbWFuZHMocGx1Z2luKSB7XG4gIGNvbnN0IGRlc2lyZWQgPSBuZXcgTWFwKGVuYWJsZWRJbXBvcnRhbnRNYW5pZmVzdHMocGx1Z2luKS5tYXAoKG1hbmlmZXN0KSA9PiBbY29tbWFuZElkRm9yKG1hbmlmZXN0LmlkKSwgbWFuaWZlc3RdKSk7XG5cbiAgZm9yIChjb25zdCBpZCBvZiByZWdpc3RlcmVkQ29tbWFuZElkcykge1xuICAgIGlmIChkZXNpcmVkLmhhcyhpZCkpIGNvbnRpbnVlO1xuICAgIHBsdWdpbi5hcHAuY29tbWFuZHMucmVtb3ZlQ29tbWFuZChgJHtwbHVnaW4ubWFuaWZlc3QuaWR9OiR7aWR9YCk7XG4gICAgcmVnaXN0ZXJlZENvbW1hbmRJZHMuZGVsZXRlKGlkKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgW2lkLCBtYW5pZmVzdF0gb2YgZGVzaXJlZCkge1xuICAgIGlmIChyZWdpc3RlcmVkQ29tbWFuZElkcy5oYXMoaWQpKSBjb250aW51ZTtcbiAgICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZCxcbiAgICAgIG5hbWU6IGBPcGVuICR7bWFuaWZlc3QubmFtZX0gU2V0dGluZ3NgLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IG9wZW5QbHVnaW5TZXR0aW5ncyhwbHVnaW4uYXBwLCBtYW5pZmVzdC5pZCksXG4gICAgfSk7XG4gICAgcmVnaXN0ZXJlZENvbW1hbmRJZHMuYWRkKGlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWdpc3RlckltcG9ydGFudFBsdWdpbnMocGx1Z2luKSB7XG4gIGNvbnN0IHJlZnJlc2ggPSAoKSA9PiByZWZyZXNoUGVyUGx1Z2luQ29tbWFuZHMocGx1Z2luKTtcblxuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnBsdWdpbnMub24oXCJjaGFuZ2VkXCIsIHJlZnJlc2gpKTtcbiAgcGx1Z2luLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeShyZWZyZXNoKTtcblxuICByZXR1cm4gcmVmcmVzaDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVySW1wb3J0YW50UGx1Z2lucywgb3BlbkltcG9ydGFudFBsdWdpblNldHRpbmdzUGlja2VyLCBQbHVnaW5QaWNrZXJNb2RhbCwgZW5hYmxlZEltcG9ydGFudE1hbmlmZXN0cyB9O1xuIiwgImNvbnN0IHsgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlLCBzZXRJY29uIH0gPSByZXF1aXJlKFwib2JzaWRpYW5cIik7XG5jb25zdCB7IFBsdWdpblBpY2tlck1vZGFsIH0gPSByZXF1aXJlKFwiLi9pbXBvcnRhbnQtcGx1Z2luc1wiKTtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUyA9IHtcbiAgY29udGFjdHNDc3ZQYXRoOiBcIl9vYnNpZGlhbi9kYXRhL2NvbnRhY3RzLmNzdlwiLFxuICBjb250YWN0c0Jhc2VEaXI6IFwifktPTlRBS1RFXCIsXG4gIGNvbnRhY3RzRWRpdE9ubHk6IGZhbHNlLFxuICBjb250YWN0c0ZpbHRlclJlbGV2YW50OiB0cnVlLFxuICBkYXRhYmFzZUZvbGRlcnNFbmFibGVkOiB0cnVlLFxuICBkYXRhYmFzZUZvbGRlclByZWZpeDogXCJ+XCIsXG4gIGZvbGRlck5vdGVDbGlja0V4dGVuc2lvbkVuYWJsZWQ6IHRydWUsXG4gIGRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZDogZmFsc2UsXG4gIHJlY2lwcm9jYWxMaW5rUHJvcGVydGllczogW1wiRmFtaWxpZVwiXSxcbiAgcHJvcGVydHlCYWNrbGlua3NMaXZlRW5hYmxlZDogdHJ1ZSxcbiAgbmVzdGVkQ2hlY2tib3hTeW5jRW5hYmxlZDogZmFsc2UsXG4gIGl0YWxpY1VuZGVyc2NvcmVFbmFibGVkOiBmYWxzZSxcbiAgZGVjbGFyZWRMaW5rUGFpcnM6IHt9LFxuICAvLyBTaWVoZSBpbXBvcnRhbnQtcGx1Z2lucy5qczogYWt0aXZpZXJ0ZSBQbHVnaW4tSURzLCBmXHUwMEZDciBkaWUgYXV0b21hdGlzY2hcbiAgLy8gamUgZWluIGVpZ2VuZXIgXCJFaW5zdGVsbHVuZ2VuIFx1MDBGNmZmbmVuXCItQmVmZWhsIGVudHN0ZWh0LlxuICBpbXBvcnRhbnRQbHVnaW5zOiBbXSxcbn07XG5cbmNvbnN0IFRBQlMgPSBbXG4gIHsgaWQ6IFwiZ2VuZXJhbFwiLCBsYWJlbDogXCJHZW5lcmVsbFwiIH0sXG4gIHsgaWQ6IFwia29udGFrdGVcIiwgbGFiZWw6IFwiS09OVEFLVEVcIiB9LFxuICB7IGlkOiBcIm1lZGlhXCIsIGxhYmVsOiBcIk1FRElBXCIgfSxcbl07XG5cbmNsYXNzIEZyZWRTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcCwgcGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMuYWN0aXZlVGFiID0gVEFCU1swXS5pZDtcbiAgfVxuXG4gIGRpc3BsYXkoKSB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29uc3QgdGFiQmFyID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImZyZWQtc2V0dGluZ3MtdGFic1wiIH0pO1xuICAgIGZvciAoY29uc3QgdGFiIG9mIFRBQlMpIHtcbiAgICAgIGNvbnN0IGJ0biA9IHRhYkJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIHRleHQ6IHRhYi5sYWJlbCxcbiAgICAgICAgY2xzOiBcImZyZWQtc2V0dGluZ3MtdGFiXCIgKyAodGhpcy5hY3RpdmVUYWIgPT09IHRhYi5pZCA/IFwiIGlzLWFjdGl2ZVwiIDogXCJcIiksXG4gICAgICB9KTtcbiAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLmFjdGl2ZVRhYiA9IHRhYi5pZDtcbiAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZW50ID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImZyZWQtc2V0dGluZ3MtY29udGVudFwiIH0pO1xuICAgIGlmICh0aGlzLmFjdGl2ZVRhYiA9PT0gXCJnZW5lcmFsXCIpIHRoaXMuZGlzcGxheUdlbmVyYWxUYWIoY29udGVudCk7XG4gICAgZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwia29udGFrdGVcIikgdGhpcy5kaXNwbGF5S29udGFrdGVUYWIoY29udGVudCk7XG4gICAgZWxzZSBpZiAodGhpcy5hY3RpdmVUYWIgPT09IFwibWVkaWFcIikgdGhpcy5kaXNwbGF5TWVkaWFUYWIoY29udGVudCk7XG4gIH1cblxuICBkaXNwbGF5R2VuZXJhbFRhYihjb250YWluZXJFbCkge1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDRcIiwgeyB0ZXh0OiBcIkRhdGVuYmFuay1PcmRuZXJcIiB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJQclx1MDBFNGZpeC1PcmRuZXIgYWxzIERhdGVuYmFuayBiZWhhbmRlbG5cIilcbiAgICAgIC5zZXREZXNjKFwiT3JkbmVyLCBkZXJlbiBOYW1lIG1pdCBkZW0gUHJcdTAwRTRmaXggYmVnaW5udCwgc2luZCBpbSBEYXRlaWJhdW0gbmljaHQgbWVociBhdWYtL3p1a2xhcHBiYXIuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5wbHVnaW4udXBkYXRlRGF0YWJhc2VGb2xkZXJTdHlsZT8uKCk7XG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlByXHUwMEU0Zml4XCIpXG4gICAgICAuc2V0RGVzYyhcIk9yZG5lcm5hbWVuLCBkaWUgbWl0IGRpZXNlbSBaZWljaGVuL1RleHQgYmVnaW5uZW4sIGdlbHRlbiBhbHMgRGF0ZW5iYW5rLU9yZG5lci5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIHRoaXMucGx1Z2luLnVwZGF0ZURhdGFiYXNlRm9sZGVyU3R5bGU/LigpO1xuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJGb2xkZXItTm90ZXMtRXJ3ZWl0ZXJ1bmc6IGdlc2FtdGUgWmVpbGUga2xpY2tiYXJcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIkJlaSBEYXRlbmJhbmstT3JkbmVybiBcdTAwRjZmZm5ldCBlaW4gS2xpY2sgaXJnZW5kd28gaW4gZGVyIFRpdGVsemVpbGUgKG5pY2h0IG51ciBhdWYgZGVtIE5hbWVuKSBkaWUgenVnZWhcdTAwRjZyaWdlIEZvbGRlci1Ob3RlLCBzb2Zlcm4gZGFzIEZvbGRlci1Ob3Rlcy1QbHVnaW4gZ2VudXR6dCB3aXJkLlwiXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJOb3RlQ2xpY2tFeHRlbnNpb25FbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb2xkZXJOb3RlQ2xpY2tFeHRlbnNpb25FbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5wbHVnaW4udXBkYXRlRGF0YWJhc2VGb2xkZXJTdHlsZT8uKCk7XG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkFuemFobCBhbSBaZWlsZW5lbmRlIGFuemVpZ2VuXCIpXG4gICAgICAuc2V0RGVzYyhcIlplaWd0IGRpZSAubWQtRGF0ZWktQW56YWhsIHN0YXR0IGFuIFN0ZWxsZSBkZXMgUGZlaWxzIGFtIFplaWxlbmVuZGUgYW4sIHdpZSBzb25zdCBkaWUgRGF0ZWllbmR1bmcuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlckNvdW50QXRFbmQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZCA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIHRoaXMucGx1Z2luLnVwZGF0ZURhdGFiYXNlRm9sZGVyU3R5bGU/LigpO1xuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDRcIiwgeyB0ZXh0OiBcIlByb3BlcnR5LUJhY2tsaW5raW5nXCIgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUHJvcGVydGllc1wiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgIFwiS29tbWFnZXRyZW5udGUgTGlzdGUgdm9uIEZyb250bWF0dGVyLVByb3BlcnRpZXMgbWl0IExpbmtzIHp1IGFuZGVyZW4gTm90aXplbiAoei4gQi4gRmFtaWxpZSwgRnJldW5kZSkgLSBnaWx0IGZcdTAwRkNyIGFsbGUgTm90aXplbiwgdW5hYmhcdTAwRTRuZ2lnIHZvbSBUWVAuIFZlcmxpbmt0IGVpbmUgTm90aXogaGllciBlaW5lIGFuZGVyZSwgYmVrb21tdCBkaWUgYW5kZXJlIGF1dG9tYXRpc2NoIGRlbiBCYWNrbGluayBpbiBkZXJzZWxiZW4gUHJvcGVydHkgZXJnXHUwMEU0bnp0IC0gdW5kIHdpZWRlciBlbnRmZXJudCwgc29iYWxkIGRpZSBWZXJsaW5rdW5nIHdlZ2ZcdTAwRTRsbHQuIEdyb1x1MDBERi0vS2xlaW5zY2hyZWlidW5nIG11c3MgZXhha3QgenVtIFByb3BlcnR5LU5hbWVuIHBhc3Nlbi5cIlxuICAgICAgKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVjaXByb2NhbExpbmtQcm9wZXJ0aWVzLmpvaW4oXCIsIFwiKSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZWNpcHJvY2FsTGlua1Byb3BlcnRpZXMgPSB2YWx1ZVxuICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAgICAgICAgIC5tYXAoKG5hbWUpID0+IG5hbWUudHJpbSgpKVxuICAgICAgICAgICAgICAuZmlsdGVyKChuYW1lKSA9PiBuYW1lLmxlbmd0aCA+IDApO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTGl2ZSBha3R1YWxpc2llcmVuXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgXCJQcm9wZXJ0eS1CYWNrbGlua2luZyBzb2ZvcnQgYmVpbSBTcGVpY2hlcm4gYWJnbGVpY2hlbiwgc3RhdHQgbnVyIGF1ZiBCZWZlaGwgKFxcXCJQcm9wZXJ0eS1CYWNrbGlua2luZyBha3R1YWxpc2llcmVuXFxcIikuXCJcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzTGl2ZUVuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnByb3BlcnR5QmFja2xpbmtzTGl2ZUVuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImg0XCIsIHsgdGV4dDogXCJDaGVja2xpc3RlblwiIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlZlcnNjaGFjaHRlbHRlIENoZWNrYm94ZW4gbWl0IHVtc2NoYWx0ZW5cIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIkJlaW0gKEVudClIYWtlbiBlaW5lciBDaGVja2JveCB3ZXJkZW4gYWxsZSBkYXJ1bnRlciB2ZXJzY2hhY2h0ZWx0ZW4gQ2hlY2tib3hlbiBhdXRvbWF0aXNjaCBtaXQgKGVudCloYWt0IC0gdW5kIHVtZ2VrZWhydDogc2luZCBhbGxlIENoZWNrYm94ZW4gZWluZXIgVW50ZXJsaXN0ZSBhbmdlaGFrdCwgd2lyZCBkaWUgXHUwMEZDYmVyZ2VvcmRuZXRlIENoZWNrYm94IGF1dG9tYXRpc2NoIG1pdCBhbmdlaGFrdCwgdW5kIHdpZWRlciBlbnRmZXJudCwgc29iYWxkIGVpbmUgZGF2b24gd2llZGVyIGFiZ2VoYWt0IHdpcmQuXCJcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImg0XCIsIHsgdGV4dDogXCJGb3JtYXRpZXJ1bmdcIiB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJLdXJzaXYgbWl0IFVudGVyc3RyaWNoZW5cIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICAnRGVyIEJlZmVobCBcIkt1cnNpdiB1bXNjaGFsdGVuXCIgc2V0enQgYmVpbSBFaW5mXHUwMEZDZ2VuIFVudGVyc3RyaWNoZSAoX1RleHRfKSBzdGF0dCBTdGVybmNoZW4gKCpUZXh0KikgdW0gZGllIEF1c3dhaGwuIEJlcmVpdHMgdm9yaGFuZGVuZSBLdXJzaXZmb3JtYXRpZXJ1bmcgKG1pdCAqIG9kZXIgXykgd2lyZCBiZWltIGVybmV1dGVuIFVtc2NoYWx0ZW4gd2VpdGVyaGluIGtvcnJla3QgZXJrYW5udCB1bmQgZW50ZmVybnQuJ1xuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaXRhbGljVW5kZXJzY29yZUVuYWJsZWQpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLml0YWxpY1VuZGVyc2NvcmVFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoNFwiLCB7IHRleHQ6IFwiSW1wb3J0YW50IFBsdWdpbiBTZXR0aW5nc1wiIH0pO1xuXG4gICAgLy8gSGVhZGVyIG1pdCBcIitcIi1CdXR0b24gbmViZW4gZGVyIEJlc2NocmVpYnVuZyBzdGF0dCBlaW5lciBlaWdlbmVuXG4gICAgLy8gU2V0dGluZy1aZWlsZSBkYXJ1bnRlciAtIGdsZWljaGVyIEF1ZmJhdSB3aWUgZGVyIEhlYWRlciBkZXIgZ2xvYmFsZW5cbiAgICAvLyBQcm9wZXJ0eS1SZWloZW5mb2xnZSBpbSBUWVAtU3lzdGVtLVBsdWdpbi5cbiAgICBjb25zdCBpbXBvcnRhbnRQbHVnaW5zSGVhZGVyID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImZyZWQtaW1wb3J0YW50LXBsdWdpbnMtaGVhZGVyXCIgfSk7XG4gICAgaW1wb3J0YW50UGx1Z2luc0hlYWRlci5jcmVhdGVFbChcInBcIiwge1xuICAgICAgY2xzOiBcInNldHRpbmctaXRlbS1kZXNjcmlwdGlvblwiLFxuICAgICAgdGV4dDogXCJFaWdlbmVyIEJlZmVobCBqZSBQbHVnaW4sIHVtIGRlc3NlbiBFaW5zdGVsbHVuZ2VuIGRpcmVrdCB6dSBcdTAwRjZmZm5lbi5cIixcbiAgICB9KTtcbiAgICBjb25zdCBhZGRJbXBvcnRhbnRQbHVnaW5CdG4gPSBpbXBvcnRhbnRQbHVnaW5zSGVhZGVyLmNyZWF0ZURpdih7XG4gICAgICBjbHM6IFwiY2xpY2thYmxlLWljb25cIixcbiAgICAgIGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwiUGx1Z2luIGhpbnp1Zlx1MDBGQ2dlblwiIH0sXG4gICAgfSk7XG4gICAgc2V0SWNvbihhZGRJbXBvcnRhbnRQbHVnaW5CdG4sIFwicGx1c1wiKTtcbiAgICBhZGRJbXBvcnRhbnRQbHVnaW5CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IG1hbmlmZXN0cyA9IHRoaXMucGx1Z2luLmFwcC5wbHVnaW5zLm1hbmlmZXN0cztcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBPYmplY3Qua2V5cyh0aGlzLnBsdWdpbi5hcHAucGx1Z2lucy5wbHVnaW5zKVxuICAgICAgICAuZmlsdGVyKChpZCkgPT4gbWFuaWZlc3RzW2lkXSAmJiAhdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1wb3J0YW50UGx1Z2lucy5pbmNsdWRlcyhpZCkpXG4gICAgICAgIC5tYXAoKGlkKSA9PiBtYW5pZmVzdHNbaWRdKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSk7XG5cbiAgICAgIGlmIChjYW5kaWRhdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBuZXcgTm90aWNlKFwiS2VpbmUgd2VpdGVyZW4gYWt0aXZpZXJ0ZW4gUGx1Z2lucyB2ZXJmXHUwMEZDZ2Jhci5cIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbmV3IFBsdWdpblBpY2tlck1vZGFsKHRoaXMucGx1Z2luLmFwcCwgY2FuZGlkYXRlcywgYXN5bmMgKGlkKSA9PiB7XG4gICAgICAgIGlmICghaWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1wb3J0YW50UGx1Z2lucy5wdXNoKGlkKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hJbXBvcnRhbnRQbHVnaW5Db21tYW5kcz8uKCk7XG4gICAgICAgIHJlbmRlckltcG9ydGFudFBsdWdpbnNMaXN0KCk7XG4gICAgICB9KS5vcGVuKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBsaXN0RWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwiZnJlZC1pbXBvcnRhbnQtcGx1Z2lucy1saXN0XCIgfSk7XG5cbiAgICBjb25zdCByZW5kZXJJbXBvcnRhbnRQbHVnaW5zTGlzdCA9ICgpID0+IHtcbiAgICAgIGxpc3RFbC5lbXB0eSgpO1xuICAgICAgY29uc3QgbWFuaWZlc3RzID0gdGhpcy5wbHVnaW4uYXBwLnBsdWdpbnMubWFuaWZlc3RzO1xuICAgICAgLy8gTnVyIGFrdGl2aWVydGUgRWludHJcdTAwRTRnZSAtIGVpbiBkZWFrdGl2aWVydGVzIFBsdWdpbiBoYXQga2VpbmUgZWlnZW5lXG4gICAgICAvLyBTZXR0aW5ncy1UYWIsIGVpbiBCZWZlaGwgZGFmXHUwMEZDciB3XHUwMEU0cmUgd2lya3VuZ3Nsb3MgKHNpZWhlIGltcG9ydGFudC1wbHVnaW5zLmpzKS5cbiAgICAgIGNvbnN0IGVuYWJsZWRJZHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbXBvcnRhbnRQbHVnaW5zLmZpbHRlcihcbiAgICAgICAgKGlkKSA9PiBtYW5pZmVzdHNbaWRdICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLnBsdWdpbi5hcHAucGx1Z2lucy5wbHVnaW5zLCBpZClcbiAgICAgICk7XG5cbiAgICAgIGlmIChlbmFibGVkSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBsaXN0RWwuY3JlYXRlRWwoXCJwXCIsIHsgY2xzOiBcInNldHRpbmctaXRlbS1kZXNjcmlwdGlvblwiLCB0ZXh0OiBcIktlaW5lIHdpY2h0aWdlbiBQbHVnaW5zIGVpbmdldHJhZ2VuLlwiIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIEJld3Vzc3Qga2VpbiBuZXcgU2V0dGluZygpIGplIFplaWxlIC0gZGVzc2VuIHJlZ3VsXHUwMEU0cmVzIFBhZGRpbmcvXG4gICAgICAvLyBTY2hyaWZ0Z3JcdTAwRjZcdTAwREZlIHdpcmt0IGZcdTAwRkNyIGVpbmUgcmVpbmUgTmFtZStFbnRmZXJuZW4tTGlzdGUgenUgd3VjaHRpZy5cbiAgICAgIC8vIFNjaGxpY2h0ZSBlaWdlbmUgWmVpbGUgc3RhdHRkZXNzZW4uXG4gICAgICBmb3IgKGNvbnN0IGlkIG9mIGVuYWJsZWRJZHMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0gbGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJmcmVkLWltcG9ydGFudC1wbHVnaW5zLXJvd1wiIH0pO1xuICAgICAgICByb3cuY3JlYXRlU3Bhbih7IGNsczogXCJmcmVkLWltcG9ydGFudC1wbHVnaW5zLW5hbWVcIiwgdGV4dDogbWFuaWZlc3RzW2lkXS5uYW1lIH0pO1xuICAgICAgICBjb25zdCByZW1vdmVCdG4gPSByb3cuY3JlYXRlRGl2KHtcbiAgICAgICAgICBjbHM6IFwiY2xpY2thYmxlLWljb24gZnJlZC1pbXBvcnRhbnQtcGx1Z2lucy1yZW1vdmVcIixcbiAgICAgICAgICBhdHRyOiB7IFwiYXJpYS1sYWJlbFwiOiBcIkVudGZlcm5lblwiIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBzZXRJY29uKHJlbW92ZUJ0biwgXCJ4XCIpO1xuICAgICAgICByZW1vdmVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbXBvcnRhbnRQbHVnaW5zID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1wb3J0YW50UGx1Z2lucy5maWx0ZXIoKHgpID0+IHggIT09IGlkKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoSW1wb3J0YW50UGx1Z2luQ29tbWFuZHM/LigpO1xuICAgICAgICAgIHJlbmRlckltcG9ydGFudFBsdWdpbnNMaXN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH07XG4gICAgcmVuZGVySW1wb3J0YW50UGx1Z2luc0xpc3QoKTtcbiAgfVxuXG4gIGRpc3BsYXlLb250YWt0ZVRhYihjb250YWluZXJFbCkge1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDRcIiwgeyB0ZXh0OiBcIktvbnRha3RpbXBvcnRcIiB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJDU1YtRGF0ZWlcIilcbiAgICAgIC5zZXREZXNjKFwiUGZhZCB6dXIgS29udGFrdGUtQ1NWLCByZWxhdGl2IHp1bSBWYXVsdC1Sb290LlwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNDc3ZQYXRoKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0NzdlBhdGggPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiS29udGFrdGUtQmFzaXN2ZXJ6ZWljaG5pc1wiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgIFwiQWxsZSBLb250YWt0ZSBsYW5kZW4gZmxhY2ggZGlyZWt0IGluIGRpZXNlbSBPcmRuZXIgKHJlbGF0aXYgenVtIFZhdWx0LVJvb3QpLiBCZXN0ZWhlbmRlIE5vdGl6ZW4gaW4gZGlyZWt0ZW4gVW50ZXJvcmRuZXJuIHdlcmRlbiBiZWltIEltcG9ydCBoaWVyaGVyIHp1c2FtbWVuZ2VmXHUwMEZDaHJ0LlwiXG4gICAgICApXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb250YWN0c0Jhc2VEaXIpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzQmFzZURpciA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJOdXIgYmVzdGVoZW5kZSBLb250YWt0ZSBha3R1YWxpc2llcmVuXCIpXG4gICAgICAuc2V0RGVzYyhcIldlbm4gYWt0aXYsIHdlcmRlbiBrZWluZSBuZXVlbiBLb250YWt0LU5vdGl6ZW4gYW5nZWxlZ3QsIG51ciBiZXN0ZWhlbmRlIGFrdHVhbGlzaWVydC5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzRWRpdE9ubHkpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnRhY3RzRWRpdE9ubHkgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiSXJyZWxldmFudGUgS29udGFrdGUgXHUwMEZDYmVyc3ByaW5nZW5cIilcbiAgICAgIC5zZXREZXNjKFwiS29udGFrdGUgb2huZSBHZWJ1cnRzdGFnIHVuZCBvaG5lIFRhZ3Mgd2VyZGVuIFx1MDBGQ2JlcnNwcnVuZ2VuLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNGaWx0ZXJSZWxldmFudCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udGFjdHNGaWx0ZXJSZWxldmFudCA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxuXG4gIGRpc3BsYXlNZWRpYVRhYihjb250YWluZXJFbCkge1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IFwiTm9jaCBrZWluZSBFaW5zdGVsbHVuZ2VuLlwiIH0pO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBERUZBVUxUX1NFVFRJTkdTLCBGcmVkU2V0dGluZ1RhYiB9O1xuIiwgImNvbnN0IHsgTm90aWNlLCBwYXJzZVlhbWwsIHN0cmluZ2lmeVlhbWwgfSA9IHJlcXVpcmUoXCJvYnNpZGlhblwiKTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBLb250YWt0ZS1DU1YtSW1wb3J0XG4gKiAoUG9ydGllcnVuZyB2b24ga29udGFrdC11cGRhdGUtY3N2LnB5KVxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmNvbnN0IENPTlRBQ1RTX0NPTFVNTlMgPSBbXG4gIFwiTGFiZWxzXCIsXG4gIFwiRmlyc3QgTmFtZVwiLFxuICBcIk1pZGRsZSBOYW1lXCIsXG4gIFwiTGFzdCBOYW1lXCIsXG4gIFwiQmlydGhkYXlcIixcbiAgXCJFLW1haWwgMSAtIFZhbHVlXCIsXG4gIFwiUGhvbmUgMSAtIFZhbHVlXCIsXG4gIFwiQWRkcmVzcyAxIC0gU3RyZWV0XCIsXG4gIFwiQWRkcmVzcyAxIC0gQ2l0eVwiLFxuICBcIkFkZHJlc3MgMSAtIFBvc3RhbCBDb2RlXCIsXG4gIFwiQWRkcmVzcyAxIC0gQ291bnRyeVwiLFxuXTtcblxuY29uc3QgQ09OVEFDVFNfRklFTERfTUFQUElORyA9IHtcbiAgXCJMYWJlbHNcIjogXCJ0YWdzXCIsXG4gIFwiRmlyc3QgTmFtZVwiOiBcIlZvcm5hbWVcIixcbiAgXCJNaWRkbGUgTmFtZVwiOiBcIlp3ZWl0bmFtZVwiLFxuICBcIkxhc3QgTmFtZVwiOiBcIk5hY2huYW1lXCIsXG4gIFwiQmlydGhkYXlcIjogXCJHZWJ1cnRzdGFnXCIsXG4gIFwiUGhvbmUgMSAtIFZhbHVlXCI6IFwiSGFuZHludW1tZXJcIixcbiAgXCJFLW1haWwgMSAtIFZhbHVlXCI6IFwiRS1NYWlsXCIsXG4gIFwiRS1tYWlsIDIgLSBWYWx1ZVwiOiBcIkUtTWFpbC1BbHRcIixcbiAgXCJBZGRyZXNzIDEgLSBTdHJlZXRcIjogXCJTdHJhc3NlXCIsXG4gIFwiQWRkcmVzcyAxIC0gUG9zdGFsIENvZGVcIjogXCJQbHpcIixcbiAgXCJBZGRyZXNzIDEgLSBDaXR5XCI6IFwiU3RhZHRcIixcbiAgXCJBZGRyZXNzIDEgLSBDb3VudHJ5XCI6IFwiTmF0aW9uXCIsXG59O1xuXG5mdW5jdGlvbiBqb2luVmF1bHRQYXRoKC4uLnBhcnRzKSB7XG4gIHJldHVybiBwYXJ0c1xuICAgIC5maWx0ZXIoKHBhcnQpID0+IHBhcnQgIT09IHVuZGVmaW5lZCAmJiBwYXJ0ICE9PSBcIlwiKVxuICAgIC5qb2luKFwiL1wiKVxuICAgIC5yZXBsYWNlKC9cXC8rL2csIFwiL1wiKVxuICAgIC5yZXBsYWNlKC9cXC8kLywgXCJcIik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ3N2KHRleHQpIHtcbiAgY29uc3Qgcm93cyA9IFtdO1xuICBsZXQgcm93ID0gW107XG4gIGxldCBmaWVsZCA9IFwiXCI7XG4gIGxldCBpblF1b3RlcyA9IGZhbHNlO1xuICBsZXQgaSA9IDA7XG5cbiAgd2hpbGUgKGkgPCB0ZXh0Lmxlbmd0aCkge1xuICAgIGNvbnN0IGNoYXIgPSB0ZXh0W2ldO1xuXG4gICAgaWYgKGluUXVvdGVzKSB7XG4gICAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgICBpZiAodGV4dFtpICsgMV0gPT09ICdcIicpIHtcbiAgICAgICAgICBmaWVsZCArPSAnXCInO1xuICAgICAgICAgIGkgKz0gMjtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpblF1b3RlcyA9IGZhbHNlO1xuICAgICAgICBpKys7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZmllbGQgKz0gY2hhcjtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICBpblF1b3RlcyA9IHRydWU7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGNoYXIgPT09IFwiLFwiKSB7XG4gICAgICByb3cucHVzaChmaWVsZCk7XG4gICAgICBmaWVsZCA9IFwiXCI7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGNoYXIgPT09IFwiXFxyXCIpIHtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoY2hhciA9PT0gXCJcXG5cIikge1xuICAgICAgcm93LnB1c2goZmllbGQpO1xuICAgICAgcm93cy5wdXNoKHJvdyk7XG4gICAgICByb3cgPSBbXTtcbiAgICAgIGZpZWxkID0gXCJcIjtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBmaWVsZCArPSBjaGFyO1xuICAgIGkrKztcbiAgfVxuXG4gIGlmIChmaWVsZC5sZW5ndGggPiAwIHx8IHJvdy5sZW5ndGggPiAwKSB7XG4gICAgcm93LnB1c2goZmllbGQpO1xuICAgIHJvd3MucHVzaChyb3cpO1xuICB9XG5cbiAgcmV0dXJuIHJvd3MuZmlsdGVyKChyKSA9PiAhKHIubGVuZ3RoID09PSAxICYmIHJbMF0gPT09IFwiXCIpKTtcbn1cblxuZnVuY3Rpb24gY3N2VG9PYmplY3RzKHRleHQpIHtcbiAgY29uc3Qgcm93cyA9IHBhcnNlQ3N2KHRleHQpO1xuICBpZiAocm93cy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgY29uc3QgaGVhZGVyID0gcm93c1swXTtcbiAgcmV0dXJuIHJvd3Muc2xpY2UoMSkubWFwKChyb3cpID0+IHtcbiAgICBjb25zdCBvYmogPSB7fTtcbiAgICBoZWFkZXIuZm9yRWFjaCgoa2V5LCBpZHgpID0+IChvYmpba2V5XSA9IHJvd1tpZHhdID8/IFwiXCIpKTtcbiAgICByZXR1cm4gb2JqO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0NvbnRhY3RSb3cocm93LCBmaXJzdE5hbWVDb2x1bW4gPSBcIkZpcnN0IE5hbWVcIiwgbGFzdE5hbWVDb2x1bW4gPSBcIkxhc3QgTmFtZVwiKSB7XG4gIGNvbnN0IGZpcnN0TmFtZSA9IChyb3dbZmlyc3ROYW1lQ29sdW1uXSB8fCBcIlwiKS50cmltKCk7XG4gIGNvbnN0IGxhc3ROYW1lID0gKHJvd1tsYXN0TmFtZUNvbHVtbl0gfHwgXCJcIikudHJpbSgpO1xuXG4gIGxldCBiYXNlTmFtZTtcbiAgaWYgKGZpcnN0TmFtZSAmJiBsYXN0TmFtZSkgYmFzZU5hbWUgPSBgJHtmaXJzdE5hbWV9ICR7bGFzdE5hbWV9YDtcbiAgZWxzZSBpZiAoZmlyc3ROYW1lIHx8IGxhc3ROYW1lKSBiYXNlTmFtZSA9IGZpcnN0TmFtZSB8fCBsYXN0TmFtZTtcbiAgZWxzZSBiYXNlTmFtZSA9IFwiX25vbmFtZVwiO1xuXG4gIGNvbnN0IGRhdGEgPSB7fTtcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocm93KSkge1xuICAgIGlmIChDT05UQUNUU19DT0xVTU5TLmluY2x1ZGVzKGtleSkgJiYgdmFsdWUudHJpbSgpKSB7XG4gICAgICBkYXRhW0NPTlRBQ1RTX0ZJRUxEX01BUFBJTkdba2V5XSB8fCBrZXldID0gdmFsdWUudHJpbSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IGJhc2VOYW1lLCBkYXRhIH07XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUNvbnRhY3RGaWVsZHMoZGF0YSwgZXhpc3RpbmdUYWdzLCBzdGFycmVkKSB7XG4gIGNvbnN0IHRyYW5zZm9ybWVkID0geyAuLi5kYXRhIH07XG5cbiAgdHJ5IHtcbiAgICBpZiAoXCJHZWJ1cnRzdGFnXCIgaW4gdHJhbnNmb3JtZWQpIHtcbiAgICAgIGNvbnN0IGdlYnVydHN0YWcgPSB0cmFuc2Zvcm1lZC5HZWJ1cnRzdGFnO1xuICAgICAgaWYgKGdlYnVydHN0YWcuc3RhcnRzV2l0aChcIi0tXCIpKSB7XG4gICAgICAgIHRyYW5zZm9ybWVkLkdlYnVydHN0YWcgPSBcIjAwMDFcIiArIGdlYnVydHN0YWcuc2xpY2UoMSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFwiSGFuZHludW1tZXJcIiBpbiB0cmFuc2Zvcm1lZCkge1xuICAgICAgbGV0IHBob25lID0gdHJhbnNmb3JtZWQuSGFuZHludW1tZXIudHJpbSgpO1xuICAgICAgaWYgKHBob25lLmluY2x1ZGVzKFwiIDo6OiBcIikpIHBob25lID0gcGhvbmUuc3BsaXQoXCIgOjo6IFwiKVswXTtcbiAgICAgIHRyYW5zZm9ybWVkLkhhbmR5bnVtbWVyID0gcGhvbmUucmVwbGFjZSgvIC9nLCBcIlwiKS5yZXBsYWNlKC8tL2csIFwiXCIpO1xuICAgIH1cblxuICAgIGxldCBub3JtYWxpemVkRXhpc3RpbmcgPSBleGlzdGluZ1RhZ3M7XG4gICAgaWYgKHR5cGVvZiBub3JtYWxpemVkRXhpc3RpbmcgPT09IFwic3RyaW5nXCIpIG5vcm1hbGl6ZWRFeGlzdGluZyA9IFtub3JtYWxpemVkRXhpc3RpbmddO1xuICAgIGlmICghQXJyYXkuaXNBcnJheShub3JtYWxpemVkRXhpc3RpbmcpKSBub3JtYWxpemVkRXhpc3RpbmcgPSBbXTtcbiAgICBjb25zdCBoYXNFeGlzdGluZyA9IG5vcm1hbGl6ZWRFeGlzdGluZy5sZW5ndGggPiAwO1xuXG4gICAgaWYgKFwidGFnc1wiIGluIHRyYW5zZm9ybWVkIHx8IHN0YXJyZWQpIHtcbiAgICAgIGNvbnN0IG5ld1RhZ3MgPSAodHJhbnNmb3JtZWQudGFncyB8fCBcIlwiKVxuICAgICAgICAuc3BsaXQoXCIgOjo6IFwiKVxuICAgICAgICAuZmlsdGVyKCh0YWcpID0+IHRhZyAmJiB0YWcgIT09IFwiKiBteUNvbnRhY3RzXCIgJiYgdGFnICE9PSBcIiogc3RhcnJlZFwiKVxuICAgICAgICAubWFwKCh0YWcpID0+IHRhZy50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoLyAvZywgXCJfXCIpKTtcbiAgICAgIGlmIChzdGFycmVkKSBuZXdUYWdzLnB1c2goXCJmYXZvcml0XCIpO1xuICAgICAgY29uc3QgaGFzTmV3ID0gbmV3VGFncy5sZW5ndGggPiAwO1xuXG4gICAgICBpZiAoaGFzRXhpc3RpbmcgJiYgaGFzTmV3KSB7XG4gICAgICAgIHRyYW5zZm9ybWVkLnRhZ3MgPSBbLi4ubmV3IFNldChbLi4ubmV3VGFncywgLi4ubm9ybWFsaXplZEV4aXN0aW5nXSldO1xuICAgICAgfSBlbHNlIGlmIChoYXNFeGlzdGluZykge1xuICAgICAgICB0cmFuc2Zvcm1lZC50YWdzID0gWy4uLm5ldyBTZXQobm9ybWFsaXplZEV4aXN0aW5nKV07XG4gICAgICB9IGVsc2UgaWYgKGhhc05ldykge1xuICAgICAgICB0cmFuc2Zvcm1lZC50YWdzID0gbmV3VGFncztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB0cmFuc2Zvcm1lZC50YWdzO1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbS29udGFrdC1JbXBvcnRdIEZlaGxlciBiZWkgZGVyIERhdGVuLVRyYW5zZm9ybWF0aW9uOlwiLCBlKTtcbiAgfVxuXG4gIHJldHVybiB0cmFuc2Zvcm1lZDtcbn1cblxuZnVuY3Rpb24gaXNTdGFycmVkQ29udGFjdChyYXdUYWdzKSB7XG4gIGlmICghcmF3VGFncykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gcmF3VGFnc1xuICAgIC5zcGxpdChcIiA6OjogXCIpXG4gICAgLm1hcCgodGFnKSA9PiB0YWcudHJpbSgpKVxuICAgIC5pbmNsdWRlcyhcIiogc3RhcnJlZFwiKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmluZEV4aXN0aW5nQ29udGFjdEZpbGUoYWRhcHRlciwgYmFzZU5hbWUsIHNlYXJjaERpcnMpIHtcbiAgZm9yIChjb25zdCBkaXIgb2Ygc2VhcmNoRGlycykge1xuICAgIGNvbnN0IHBhdGggPSBqb2luVmF1bHRQYXRoKGRpciwgYCR7YmFzZU5hbWV9Lm1kYCk7XG4gICAgaWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKHBhdGgpKSByZXR1cm4gcGF0aDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZENvbnRhY3RGcm9udG1hdHRlcihhZGFwdGVyLCBwYXRoKSB7XG4gIGNvbnN0IHJhdyA9IGF3YWl0IGFkYXB0ZXIucmVhZChwYXRoKTtcbiAgY29uc3QgbWF0Y2ggPSByYXcubWF0Y2goL14tLS1cXHI/XFxuKFtcXHNcXFNdKj8pXFxyP1xcbi0tLVxccj9cXG4/Lyk7XG4gIGlmICghbWF0Y2gpIHJldHVybiB7IGZyb250bWF0dGVyOiB7fSwgY29udGVudDogcmF3IH07XG4gIHJldHVybiB7IGZyb250bWF0dGVyOiBwYXJzZVlhbWwobWF0Y2hbMV0pIHx8IHt9LCBjb250ZW50OiByYXcuc2xpY2UobWF0Y2hbMF0ubGVuZ3RoKSB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB3cml0ZUNvbnRhY3RGaWxlKGFkYXB0ZXIsIHBhdGgsIGZyb250bWF0dGVyLCBjb250ZW50KSB7XG4gIGNvbnN0IG9yZGVyZWQgPSB7IFRZUDogXCJLT05UQUtUXCIgfTtcbiAgaWYgKFwiYWxpYXNlc1wiIGluIGZyb250bWF0dGVyKSBvcmRlcmVkLmFsaWFzZXMgPSBmcm9udG1hdHRlci5hbGlhc2VzO1xuICBpZiAoXCJ0YWdzXCIgaW4gZnJvbnRtYXR0ZXIpIG9yZGVyZWQudGFncyA9IGZyb250bWF0dGVyLnRhZ3M7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGZyb250bWF0dGVyKSkge1xuICAgIGlmICghKGtleSBpbiBvcmRlcmVkKSkgb3JkZXJlZFtrZXldID0gdmFsdWU7XG4gIH1cbiAgY29uc3QgZmlsZUNvbnRlbnQgPSBgLS0tXFxuJHtzdHJpbmdpZnlZYW1sKG9yZGVyZWQpfS0tLVxcbiR7Y29udGVudH1gO1xuXG4gIGNvbnN0IGRpciA9IHBhdGguc3BsaXQoXCIvXCIpLnNsaWNlKDAsIC0xKS5qb2luKFwiL1wiKTtcbiAgaWYgKGRpciAmJiAhKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGRpcikpKSBhd2FpdCBhZGFwdGVyLm1rZGlyKGRpcik7XG4gIGF3YWl0IGFkYXB0ZXIud3JpdGUocGF0aCwgZmlsZUNvbnRlbnQpO1xufVxuXG5jb25zdCBBVVRPX01BTkFHRURfRlJPTlRNQVRURVJfS0VZUyA9IG5ldyBTZXQoW1xuICBcImNzc2NsYXNzZXNcIixcbiAgXCJUWVBcIixcbiAgXCJhbGlhc2VzXCIsXG4gIFwidGFnc1wiLFxuICAuLi5PYmplY3QudmFsdWVzKENPTlRBQ1RTX0ZJRUxEX01BUFBJTkcpLFxuXSk7XG5cbmZ1bmN0aW9uIGlzVW50b3VjaGVkQ29udGFjdChmcm9udG1hdHRlciwgY29udGVudCkge1xuICBpZiAoY29udGVudC50cmltKCkubGVuZ3RoID4gMCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gT2JqZWN0LmtleXMoZnJvbnRtYXR0ZXIpLmV2ZXJ5KChrZXkpID0+IEFVVE9fTUFOQUdFRF9GUk9OVE1BVFRFUl9LRVlTLmhhcyhrZXkpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2FmZVJlbW92ZUNvbnRhY3RGaWxlKGFkYXB0ZXIsIHBhdGgpIHtcbiAgLy8gUGFwaWVya29yYiBzdGF0dCBwZXJtYW5lbnRlbSBMXHUwMEY2c2NoZW4sIGZhbGxzIGJlaW0gWnVzYW1tZW5mXHUwMEZDaHJlbiBkZXJcbiAgLy8gVW50ZXJvcmRuZXIgbWFsIGV0d2FzIHNjaGllZmdlaHQuXG4gIHRyeSB7XG4gICAgY29uc3QgdHJhc2hlZFRvU3lzdGVtID0gYXdhaXQgYWRhcHRlci50cmFzaFN5c3RlbShwYXRoKTtcbiAgICBpZiAoIXRyYXNoZWRUb1N5c3RlbSkgYXdhaXQgYWRhcHRlci50cmFzaExvY2FsKHBhdGgpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgYXdhaXQgYWRhcHRlci5yZW1vdmUocGF0aCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gaW1wb3J0Q29udGFjdHNGcm9tQ3N2KGFwcCwgc2V0dGluZ3MpIHtcbiAgY29uc3QgeyBhZGFwdGVyIH0gPSBhcHAudmF1bHQ7XG4gIGNvbnN0IGNzdlBhdGggPSBzZXR0aW5ncy5jb250YWN0c0NzdlBhdGg7XG4gIGNvbnN0IGJhc2lzVmVyemVpY2huaXMgPSBzZXR0aW5ncy5jb250YWN0c0Jhc2VEaXIucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xuXG4gIGlmICghKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGNzdlBhdGgpKSkge1xuICAgIG5ldyBOb3RpY2UoYEtvbnRha3QtSW1wb3J0OiBEYXRlaSBuaWNodCBnZWZ1bmRlbjogJHtjc3ZQYXRofWApO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIShhd2FpdCBhZGFwdGVyLmV4aXN0cyhiYXNpc1ZlcnplaWNobmlzKSkpIHtcbiAgICBuZXcgTm90aWNlKGBLb250YWt0LUltcG9ydDogQmFzaXN2ZXJ6ZWljaG5pcyBuaWNodCBnZWZ1bmRlbjogJHtiYXNpc1ZlcnplaWNobmlzfWApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHsgZm9sZGVycyB9ID0gYXdhaXQgYWRhcHRlci5saXN0KGJhc2lzVmVyemVpY2huaXMpO1xuICBjb25zdCBzZWFyY2hEaXJzID0gW2Jhc2lzVmVyemVpY2huaXMsIC4uLmZvbGRlcnMuc29ydCgpXTtcblxuICBjb25zdCByb3dzID0gY3N2VG9PYmplY3RzKGF3YWl0IGFkYXB0ZXIucmVhZChjc3ZQYXRoKSk7XG5cbiAgbGV0IGNyZWF0ZWQgPSAwO1xuICBsZXQgdXBkYXRlZCA9IDA7XG4gIGxldCBtb3ZlZCA9IDA7XG4gIGxldCBza2lwcGVkID0gMDtcbiAgbGV0IGVycm9ycyA9IDA7XG5cbiAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGJhc2VOYW1lLCBkYXRhOiByYXdEYXRhIH0gPSBwcm9jZXNzQ29udGFjdFJvdyhyb3cpO1xuICAgICAgY29uc3Qgc3RhcnJlZCA9IGlzU3RhcnJlZENvbnRhY3QocmF3RGF0YS50YWdzKTtcbiAgICAgIGNvbnN0IGV4aXN0aW5nRmlsZSA9IGF3YWl0IGZpbmRFeGlzdGluZ0NvbnRhY3RGaWxlKGFkYXB0ZXIsIGJhc2VOYW1lLCBzZWFyY2hEaXJzKTtcblxuICAgICAgaWYgKGV4aXN0aW5nRmlsZSkge1xuICAgICAgICBjb25zdCB7IGZyb250bWF0dGVyOiBleGlzdGluZ0Zyb250bWF0dGVyLCBjb250ZW50IH0gPSBhd2FpdCByZWFkQ29udGFjdEZyb250bWF0dGVyKGFkYXB0ZXIsIGV4aXN0aW5nRmlsZSk7XG4gICAgICAgIGNvbnN0IG5ld0RhdGEgPSB0cmFuc2Zvcm1Db250YWN0RmllbGRzKHJhd0RhdGEsIGV4aXN0aW5nRnJvbnRtYXR0ZXIudGFncywgc3RhcnJlZCk7XG5cbiAgICAgICAgaWYgKHNldHRpbmdzLmNvbnRhY3RzRmlsdGVyUmVsZXZhbnQgJiYgIW5ld0RhdGEuR2VidXJ0c3RhZyAmJiAoIW5ld0RhdGEudGFncyB8fCBuZXdEYXRhLnRhZ3MubGVuZ3RoIDwgMSkpIHtcbiAgICAgICAgICBza2lwcGVkKys7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1cGRhdGVkRnJvbnRtYXR0ZXIgPSB7IC4uLmV4aXN0aW5nRnJvbnRtYXR0ZXIsIC4uLm5ld0RhdGEgfTtcbiAgICAgICAgLy8gQWxsZXMgbGFuZGV0IGZsYWNoIGRpcmVrdCBpbSBCYXNpc3ZlcnplaWNobmlzLCBrZWluZSBVbnRlcm9yZG5lciBtZWhyLlxuICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gam9pblZhdWx0UGF0aChiYXNpc1ZlcnplaWNobmlzLCBgJHtiYXNlTmFtZX0ubWRgKTtcbiAgICAgICAgYXdhaXQgd3JpdGVDb250YWN0RmlsZShhZGFwdGVyLCB0YXJnZXRQYXRoLCB1cGRhdGVkRnJvbnRtYXR0ZXIsIGNvbnRlbnQpO1xuXG4gICAgICAgIGlmICh0YXJnZXRQYXRoICE9PSBleGlzdGluZ0ZpbGUpIHtcbiAgICAgICAgICBhd2FpdCBzYWZlUmVtb3ZlQ29udGFjdEZpbGUoYWRhcHRlciwgZXhpc3RpbmdGaWxlKTtcbiAgICAgICAgICBtb3ZlZCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVwZGF0ZWQrKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghc2V0dGluZ3MuY29udGFjdHNFZGl0T25seSkge1xuICAgICAgICBjb25zdCBuZXdEYXRhID0gdHJhbnNmb3JtQ29udGFjdEZpZWxkcyhyYXdEYXRhLCB1bmRlZmluZWQsIHN0YXJyZWQpO1xuXG4gICAgICAgIGlmIChzZXR0aW5ncy5jb250YWN0c0ZpbHRlclJlbGV2YW50ICYmICFuZXdEYXRhLkdlYnVydHN0YWcgJiYgKCFuZXdEYXRhLnRhZ3MgfHwgbmV3RGF0YS50YWdzLmxlbmd0aCA8IDEpKSB7XG4gICAgICAgICAgc2tpcHBlZCsrO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmV3UGF0aCA9IGpvaW5WYXVsdFBhdGgoYmFzaXNWZXJ6ZWljaG5pcywgYCR7YmFzZU5hbWV9Lm1kYCk7XG4gICAgICAgIGF3YWl0IHdyaXRlQ29udGFjdEZpbGUoYWRhcHRlciwgbmV3UGF0aCwgbmV3RGF0YSwgXCJcIik7XG4gICAgICAgIGNyZWF0ZWQrKztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlcnJvcnMrKztcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbS29udGFrdC1JbXBvcnRdIEZlaGxlciBiZWkgS29udGFrdC1aZWlsZTpcIiwgcm93LCBlKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBzdW1tYXJ5ID0gYEtvbnRha3QtSW1wb3J0OiAke2NyZWF0ZWR9IG5ldSwgJHt1cGRhdGVkfSBha3R1YWxpc2llcnQsICR7bW92ZWR9IGF1cyBVbnRlcm9yZG5lcm4genVzYW1tZW5nZWZcdTAwRkNocnQsICR7c2tpcHBlZH0gXHUwMEZDYmVyc3BydW5nZW4ke1xuICAgIGVycm9ycyA/IGAsICR7ZXJyb3JzfSBGZWhsZXIgKHNpZWhlIEtvbnNvbGUpYCA6IFwiXCJcbiAgfS5gO1xuICBjb25zb2xlLmxvZyhcIltLb250YWt0LUltcG9ydF1cIiwgc3VtbWFyeSk7XG4gIG5ldyBOb3RpY2Uoc3VtbWFyeSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZVVudG91Y2hlZENvbnRhY3RzKGFwcCwgc2V0dGluZ3MpIHtcbiAgY29uc3QgeyBhZGFwdGVyIH0gPSBhcHAudmF1bHQ7XG4gIGNvbnN0IGJhc2lzVmVyemVpY2huaXMgPSBzZXR0aW5ncy5jb250YWN0c0Jhc2VEaXIucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xuXG4gIGlmICghKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKGJhc2lzVmVyemVpY2huaXMpKSkge1xuICAgIG5ldyBOb3RpY2UoYEtvbnRha3QtSW1wb3J0OiBCYXNpc3ZlcnplaWNobmlzIG5pY2h0IGdlZnVuZGVuOiAke2Jhc2lzVmVyemVpY2huaXN9YCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY29udGFjdEZpbGVzID0gYXBwLnZhdWx0XG4gICAgLmdldE1hcmtkb3duRmlsZXMoKVxuICAgIC5maWx0ZXIoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gYmFzaXNWZXJ6ZWljaG5pcyB8fCBmaWxlLnBhdGguc3RhcnRzV2l0aChiYXNpc1ZlcnplaWNobmlzICsgXCIvXCIpKVxuICAgIC5maWx0ZXIoKGZpbGUpID0+IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKT8uZnJvbnRtYXR0ZXI/LlRZUCA9PT0gXCJLT05UQUtUXCIpO1xuXG4gIGxldCBkZWxldGVkID0gMDtcbiAgbGV0IGVycm9ycyA9IDA7XG5cbiAgZm9yIChjb25zdCBmaWxlIG9mIGNvbnRhY3RGaWxlcykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGZyb250bWF0dGVyLCBjb250ZW50IH0gPSBhd2FpdCByZWFkQ29udGFjdEZyb250bWF0dGVyKGFkYXB0ZXIsIGZpbGUucGF0aCk7XG4gICAgICBpZiAoIWlzVW50b3VjaGVkQ29udGFjdChmcm9udG1hdHRlciwgY29udGVudCkpIGNvbnRpbnVlO1xuXG4gICAgICBhd2FpdCBzYWZlUmVtb3ZlQ29udGFjdEZpbGUoYWRhcHRlciwgZmlsZS5wYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbS29udGFrdC1JbXBvcnRdIFVudmVyXHUwMEU0bmRlcnRlciBLb250YWt0IGdlbFx1MDBGNnNjaHQ6ICR7ZmlsZS5wYXRofWApO1xuICAgICAgZGVsZXRlZCsrO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGVycm9ycysrO1xuICAgICAgY29uc29sZS5lcnJvcihcIltLb250YWt0LUltcG9ydF0gRmVobGVyIGJlaW0gUHJcdTAwRkNmZW4vTFx1MDBGNnNjaGVuOlwiLCBmaWxlLnBhdGgsIGUpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHN1bW1hcnkgPSBgS29udGFrdC1JbXBvcnQ6ICR7Y29udGFjdEZpbGVzLmxlbmd0aH0gZ2Vwclx1MDBGQ2Z0LCAke2RlbGV0ZWR9IHVudmVyXHUwMEU0bmRlcnRlIGdlbFx1MDBGNnNjaHQke1xuICAgIGVycm9ycyA/IGAsICR7ZXJyb3JzfSBGZWhsZXIgKHNpZWhlIEtvbnNvbGUpYCA6IFwiXCJcbiAgfS5gO1xuICBjb25zb2xlLmxvZyhcIltLb250YWt0LUltcG9ydF1cIiwgc3VtbWFyeSk7XG4gIG5ldyBOb3RpY2Uoc3VtbWFyeSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBpbXBvcnRDb250YWN0c0Zyb21Dc3YsIGRlbGV0ZVVudG91Y2hlZENvbnRhY3RzIH07XG4iLCAiY29uc3QgeyBURmlsZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFByb3BlcnR5LUJhY2tsaW5raW5nXG4gKiBCZWxpZWJpZ2UgTm90aXplbiAobmljaHQgYXVmIGVpbmVuIFRZUCBiZXNjaHJcdTAwRTRua3QpIG1pdCBlaW5lclxuICogTGlzdGVuLVByb3BlcnR5ICh6LiBCLiBcIkZhbWlsaWVcIiwgXCJGcmV1bmRlXCIpIGF1cyBMaW5rcyB6dVxuICogYW5kZXJlbiBOb3RpemVuIGJla29tbWVuIGRlbiBQcm9wZXJ0eS1CYWNrbGluayBhdXRvbWF0aXNjaCBiZWlcbiAqIGRlciBqZXdlaWxzIGFuZGVyZW4gTm90aXogZXJnXHUwMEU0bnp0IC0gdW5kIHdpZWRlciBlbnRmZXJudCwgc29iYWxkXG4gKiBkaWUgdXJzcHJcdTAwRkNuZ2xpY2hlIFZlcmxpbmt1bmcgd2VnZlx1MDBFNGxsdC4gRGllIGtvbmZpZ3VyaWVydGVcbiAqIFByb3BlcnR5LUxpc3RlIHNlbGJzdCBpc3QgZGVyIGVpbnppZ2UgRmlsdGVyLlxuICpcbiAqIEVya2VubnVuZyBwZXIgVmVyZ2xlaWNoIG1pdCBkZW0gZ2VzcGVpY2hlcnRlbiBTdGFuZCBkZXMgbGV0enRlblxuICogTGF1ZnMgKG5pY2h0IHBlciBIZXJrdW5mdHMtVHJhY2tpbmcgZWluemVsbmVyIExpbmtzKTogd2FzIG5ldVxuICogZGF6dWdla29tbWVuIGlzdCwgd2lyZCBnZXNwaWVnZWx0IGVyZ1x1MDBFNG56dDsgd2FzIHdlZ2dlZmFsbGVuIGlzdCxcbiAqIHdpcmQgYmVpbSBhbmRlcmVuIGViZW5mYWxscyBlbnRmZXJudCAtIHVuYWJoXHUwMEU0bmdpZyBkYXZvbiwgd2VyIGRpZVxuICogVmVybGlua3VuZyB1cnNwclx1MDBGQ25nbGljaCBnZXNldHp0IGhhdHRlLlxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmZ1bmN0aW9uIHBhcnNlTGlua1RleHQoZW50cnkpIHtcbiAgY29uc3QgbWF0Y2ggPSBlbnRyeS5tYXRjaCgvXlxcW1xcWyhbXlxcXXxdKykoPzpcXHxbXlxcXV0qKT9cXF1cXF0kLyk7XG4gIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogZW50cnk7XG59XG5cbmZ1bmN0aW9uIHRvQXJyYXkodmFsdWUpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWU7XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSBcIlwiKSByZXR1cm4gW107XG4gIHJldHVybiBbdmFsdWVdO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlTGlua1RhcmdldHMoYXBwLCBvd25lckZpbGUsIHByb3BlcnR5VmFsdWUpIHtcbiAgY29uc3QgdGFyZ2V0cyA9IFtdO1xuICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRvQXJyYXkocHJvcGVydHlWYWx1ZSkpIHtcbiAgICBpZiAodHlwZW9mIGVudHJ5ICE9PSBcInN0cmluZ1wiKSBjb250aW51ZTtcbiAgICBjb25zdCBkZXN0ID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QocGFyc2VMaW5rVGV4dChlbnRyeSksIG93bmVyRmlsZS5wYXRoKTtcbiAgICBpZiAoIWRlc3QpIHtcbiAgICAgIGNvbnNvbGUud2FybihgW1Byb3BlcnR5LUJhY2tsaW5raW5nXSBMaW5rIGtvbm50ZSBuaWNodCBhdWZnZWxcdTAwRjZzdCB3ZXJkZW46IFwiJHtlbnRyeX1cIiBpbiAke293bmVyRmlsZS5wYXRofWApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChkZXN0LnBhdGggIT09IG93bmVyRmlsZS5wYXRoKSB0YXJnZXRzLnB1c2goZGVzdCk7XG4gIH1cbiAgcmV0dXJuIHRhcmdldHM7XG59XG5cbi8vIHsgW3Byb3BlcnR5XTogeyBbc291cmNlUGF0aF06IFt0YXJnZXRQYXRoLCAuLi5dIH0gfSAtIHJlaW5lIEpTT04tdGF1Z2xpY2hlIFN0cnVrdHVyLFxuLy8gZGFtaXQgc2llIDE6MSBpbiBkZW4gUGx1Z2luLVNldHRpbmdzIGdlc3BlaWNoZXJ0IHdlcmRlbiBrYW5uLlxuZnVuY3Rpb24gY29tcHV0ZURlY2xhcmVkUGFpcnMoYXBwLCBwcm9wZXJ0eU5hbWVzLCBmaWxlcykge1xuICBjb25zdCBwYWlycyA9IHt9O1xuICBmb3IgKGNvbnN0IHByb3BlcnR5TmFtZSBvZiBwcm9wZXJ0eU5hbWVzKSB7XG4gICAgY29uc3QgYnlTb3VyY2UgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IGZyb250bWF0dGVyID0gYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpPy5mcm9udG1hdHRlcjtcbiAgICAgIGlmICghZnJvbnRtYXR0ZXI/Lltwcm9wZXJ0eU5hbWVdKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHRhcmdldHMgPSByZXNvbHZlTGlua1RhcmdldHMoYXBwLCBmaWxlLCBmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdKTtcbiAgICAgIGlmICh0YXJnZXRzLmxlbmd0aCA+IDApIGJ5U291cmNlW2ZpbGUucGF0aF0gPSB0YXJnZXRzLm1hcCgodCkgPT4gdC5wYXRoKTtcbiAgICB9XG4gICAgcGFpcnNbcHJvcGVydHlOYW1lXSA9IGJ5U291cmNlO1xuICB9XG4gIHJldHVybiBwYWlycztcbn1cblxuZnVuY3Rpb24gZ2V0VGFyZ2V0U2V0KHBhaXJzLCBwcm9wZXJ0eU5hbWUsIHNvdXJjZVBhdGgpIHtcbiAgcmV0dXJuIG5ldyBTZXQocGFpcnM/Lltwcm9wZXJ0eU5hbWVdPy5bc291cmNlUGF0aF0gPz8gW10pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhZGRMaW5rVG9Qcm9wZXJ0eShhcHAsIHByb3BlcnR5TmFtZSwgb3duZXJGaWxlLCB0YXJnZXRGaWxlKSB7XG4gIGF3YWl0IGFwcC5maWxlTWFuYWdlci5wcm9jZXNzRnJvbnRNYXR0ZXIob3duZXJGaWxlLCAoZnJvbnRtYXR0ZXIpID0+IHtcbiAgICBjb25zdCBjdXJyZW50ID0gdG9BcnJheShmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdKTtcbiAgICBjb25zdCBhbHJlYWR5VGhlcmUgPSByZXNvbHZlTGlua1RhcmdldHMoYXBwLCBvd25lckZpbGUsIGN1cnJlbnQpLnNvbWUoKGYpID0+IGYucGF0aCA9PT0gdGFyZ2V0RmlsZS5wYXRoKTtcbiAgICBpZiAoYWxyZWFkeVRoZXJlKSByZXR1cm47XG4gICAgY29uc3QgbGluayA9IGFwcC5maWxlTWFuYWdlci5nZW5lcmF0ZU1hcmtkb3duTGluayh0YXJnZXRGaWxlLCBvd25lckZpbGUucGF0aCk7XG4gICAgZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSA9IFsuLi5jdXJyZW50LCBsaW5rXTtcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbW92ZUxpbmtGcm9tUHJvcGVydHkoYXBwLCBwcm9wZXJ0eU5hbWUsIG93bmVyRmlsZSwgdGFyZ2V0UGF0aCkge1xuICBhd2FpdCBhcHAuZmlsZU1hbmFnZXIucHJvY2Vzc0Zyb250TWF0dGVyKG93bmVyRmlsZSwgKGZyb250bWF0dGVyKSA9PiB7XG4gICAgY29uc3QgY3VycmVudCA9IHRvQXJyYXkoZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSk7XG4gICAgY29uc3QgZmlsdGVyZWQgPSBjdXJyZW50LmZpbHRlcigoZW50cnkpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZW50cnkgIT09IFwic3RyaW5nXCIpIHJldHVybiB0cnVlO1xuICAgICAgY29uc3QgZGVzdCA9IGFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KHBhcnNlTGlua1RleHQoZW50cnkpLCBvd25lckZpbGUucGF0aCk7XG4gICAgICByZXR1cm4gIShkZXN0ICYmIGRlc3QucGF0aCA9PT0gdGFyZ2V0UGF0aCk7XG4gICAgfSk7XG4gICAgaWYgKGZpbHRlcmVkLmxlbmd0aCA9PT0gY3VycmVudC5sZW5ndGgpIHJldHVybjtcbiAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSBkZWxldGUgZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXTtcbiAgICBlbHNlIGZyb250bWF0dGVyW3Byb3BlcnR5TmFtZV0gPSBmaWx0ZXJlZDtcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5Q2hhbmdlcyhhcHAsIHByb3BlcnR5TmFtZXMsIHByZXZpb3VzUGFpcnMsIGN1cnJlbnRQYWlycykge1xuICBsZXQgYWRkZWQgPSAwO1xuICBsZXQgcmVtb3ZlZCA9IDA7XG5cbiAgZm9yIChjb25zdCBwcm9wZXJ0eU5hbWUgb2YgcHJvcGVydHlOYW1lcykge1xuICAgIGNvbnN0IHNvdXJjZVBhdGhzID0gbmV3IFNldChbXG4gICAgICAuLi5PYmplY3Qua2V5cyhwcmV2aW91c1BhaXJzPy5bcHJvcGVydHlOYW1lXSA/PyB7fSksXG4gICAgICAuLi5PYmplY3Qua2V5cyhjdXJyZW50UGFpcnM/Lltwcm9wZXJ0eU5hbWVdID8/IHt9KSxcbiAgICBdKTtcblxuICAgIGZvciAoY29uc3Qgc291cmNlUGF0aCBvZiBzb3VyY2VQYXRocykge1xuICAgICAgY29uc3QgcHJldlRhcmdldHMgPSBnZXRUYXJnZXRTZXQocHJldmlvdXNQYWlycywgcHJvcGVydHlOYW1lLCBzb3VyY2VQYXRoKTtcbiAgICAgIGNvbnN0IGN1cnJUYXJnZXRzID0gZ2V0VGFyZ2V0U2V0KGN1cnJlbnRQYWlycywgcHJvcGVydHlOYW1lLCBzb3VyY2VQYXRoKTtcblxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQYXRoIG9mIGN1cnJUYXJnZXRzKSB7XG4gICAgICAgIGlmIChwcmV2VGFyZ2V0cy5oYXModGFyZ2V0UGF0aCkpIGNvbnRpbnVlOyAvLyB1bnZlclx1MDBFNG5kZXJ0XG5cbiAgICAgICAgY29uc3Qgc291cmNlRmlsZSA9IGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoc291cmNlUGF0aCk7XG4gICAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRhcmdldFBhdGgpO1xuICAgICAgICBpZiAoIShzb3VyY2VGaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8ICEodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG5cbiAgICAgICAgYXdhaXQgYWRkTGlua1RvUHJvcGVydHkoYXBwLCBwcm9wZXJ0eU5hbWUsIHRhcmdldEZpbGUsIHNvdXJjZUZpbGUpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1Byb3BlcnR5LUJhY2tsaW5raW5nXSBcIiR7cHJvcGVydHlOYW1lfVwiOiAke3RhcmdldEZpbGUucGF0aH0gPC0gJHtzb3VyY2VGaWxlLnBhdGh9IGVyZ1x1MDBFNG56dGApO1xuICAgICAgICBhZGRlZCsrO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBhdGggb2YgcHJldlRhcmdldHMpIHtcbiAgICAgICAgaWYgKGN1cnJUYXJnZXRzLmhhcyh0YXJnZXRQYXRoKSkgY29udGludWU7IC8vIHdlaXRlcmhpbiB2b3JoYW5kZW5cblxuICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0YXJnZXRQYXRoKTtcbiAgICAgICAgaWYgKCEodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgY29udGludWU7XG5cbiAgICAgICAgYXdhaXQgcmVtb3ZlTGlua0Zyb21Qcm9wZXJ0eShhcHAsIHByb3BlcnR5TmFtZSwgdGFyZ2V0RmlsZSwgc291cmNlUGF0aCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUHJvcGVydHktQmFja2xpbmtpbmddIFwiJHtwcm9wZXJ0eU5hbWV9XCI6ICR7dGFyZ2V0RmlsZS5wYXRofSA8LSAke3NvdXJjZVBhdGh9IGVudGZlcm50YCk7XG4gICAgICAgIHJlbW92ZWQrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBhZGRlZCwgcmVtb3ZlZCB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzeW5jQWxsTGlua3MoYXBwLCBwcm9wZXJ0eU5hbWVzLCBwcmV2aW91c1BhaXJzKSB7XG4gIGNvbnN0IGZpbGVzID0gYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgY29uc29sZS5sb2coYFtQcm9wZXJ0eS1CYWNrbGlua2luZ10gUHJcdTAwRkNmZSAke2ZpbGVzLmxlbmd0aH0gTm90aXplbiBmXHUwMEZDciBQcm9wZXJ0aWVzOiAke3Byb3BlcnR5TmFtZXMuam9pbihcIiwgXCIpfWApO1xuXG4gIGNvbnN0IGN1cnJlbnRQYWlycyA9IGNvbXB1dGVEZWNsYXJlZFBhaXJzKGFwcCwgcHJvcGVydHlOYW1lcywgZmlsZXMpO1xuICBjb25zdCB7IGFkZGVkLCByZW1vdmVkIH0gPSBhd2FpdCBhcHBseUNoYW5nZXMoYXBwLCBwcm9wZXJ0eU5hbWVzLCBwcmV2aW91c1BhaXJzLCBjdXJyZW50UGFpcnMpO1xuXG4gIHJldHVybiB7XG4gICAgY2hlY2tlZDogZmlsZXMubGVuZ3RoLFxuICAgIGFkZGVkLFxuICAgIHJlbW92ZWQsXG4gICAgZGVjbGFyZWRQYWlyczogY3VycmVudFBhaXJzLFxuICB9O1xufVxuXG4vLyBMaXZlLU1vZHVzOiBsXHUwMEY2c3QgYmVpIGplZGVyIE1ldGFkYXRlbi1cdTAwQzRuZGVydW5nIGVpbmVuIHZvbGxzdFx1MDBFNG5kaWdlbiBBYmdsZWljaCBhdXMuXG4vLyBFaW4gZWluZmFjaGVzIExvY2sgdmVyaGluZGVydCBcdTAwRkNiZXJsYXBwZW5kZSBMXHUwMEU0dWZlIGJlaSBzY2huZWxsIGF1ZmVpbmFuZGVyZm9sZ2VuZGVuXG4vLyBTcGVpY2hlcnVuZ2VuOyB3XHUwMEU0aHJlbmQgZWluIExhdWYgYWt0aXYgaXN0LCB3aXJkIGhcdTAwRjZjaHN0ZW5zIGVpbiB3ZWl0ZXJlciBuYWNoZ2Vob2x0LlxuZnVuY3Rpb24gcmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUocGx1Z2luKSB7XG4gIGxldCBydW5uaW5nID0gZmFsc2U7XG4gIGxldCBwZW5kaW5nID0gZmFsc2U7XG5cbiAgY29uc3QgcnVuU3luYyA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAocnVubmluZykge1xuICAgICAgcGVuZGluZyA9IHRydWU7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzeW5jQWxsTGlua3MocGx1Z2luLmFwcCwgcGx1Z2luLnNldHRpbmdzLnJlY2lwcm9jYWxMaW5rUHJvcGVydGllcywgcGx1Z2luLnNldHRpbmdzLmRlY2xhcmVkTGlua1BhaXJzKTtcbiAgICAgIHBsdWdpbi5zZXR0aW5ncy5kZWNsYXJlZExpbmtQYWlycyA9IHJlc3VsdC5kZWNsYXJlZFBhaXJzO1xuICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbUHJvcGVydHktQmFja2xpbmtpbmddIEZlaGxlcjpcIiwgZSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgIGlmIChwZW5kaW5nKSB7XG4gICAgICAgIHBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgcnVuU3luYygpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBvbk1ldGFkYXRhQ2hhbmdlZCA9IChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MucHJvcGVydHlCYWNrbGlua3NMaXZlRW5hYmxlZCkgcmV0dXJuO1xuICAgIGlmIChmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgcnVuU3luYygpO1xuICB9O1xuXG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5vbihcImNoYW5nZWRcIiwgb25NZXRhZGF0YUNoYW5nZWQpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHN5bmNBbGxMaW5rcywgcmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUgfTtcbiIsICJjb25zdCB7IE5vdGljZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuY29uc3QgeyBpbXBvcnRDb250YWN0c0Zyb21Dc3YsIGRlbGV0ZVVudG91Y2hlZENvbnRhY3RzIH0gPSByZXF1aXJlKFwiLi9rb250YWt0LWltcG9ydFwiKTtcbmNvbnN0IHsgc3luY0FsbExpbmtzIH0gPSByZXF1aXJlKFwiLi9wcm9wZXJ0eS1zeW5jXCIpO1xuY29uc3QgeyBvcGVuSW1wb3J0YW50UGx1Z2luU2V0dGluZ3NQaWNrZXIgfSA9IHJlcXVpcmUoXCIuL2ltcG9ydGFudC1wbHVnaW5zXCIpO1xuXG5mdW5jdGlvbiByZWdpc3RlckNvbW1hbmRzKHBsdWdpbikge1xuXG4gIHBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICBpZDogXCJrb250YWt0ZS1jc3YtaW1wb3J0XCIsXG4gICAgbmFtZTogXCJLT05UQUtURSAtIEtvbnRha3RlIGF1cyBDU1YgYWt0dWFsaXNpZXJlblwiLFxuICAgIGNhbGxiYWNrOiAoKSA9PiBpbXBvcnRDb250YWN0c0Zyb21Dc3YocGx1Z2luLmFwcCwgcGx1Z2luLnNldHRpbmdzKSxcbiAgfSk7XG5cbiAgcGx1Z2luLmFkZENvbW1hbmQoe1xuICAgIGlkOiBcImtvbnRha3RlLXVudmVyYWVuZGVydC1sb2VzY2hlblwiLFxuICAgIG5hbWU6IFwiS09OVEFLVEUgLSBVbnZlclx1MDBFNG5kZXJ0ZSBLb250YWt0ZSBsXHUwMEY2c2NoZW5cIixcbiAgICBjYWxsYmFjazogKCkgPT4gZGVsZXRlVW50b3VjaGVkQ29udGFjdHMocGx1Z2luLmFwcCwgcGx1Z2luLnNldHRpbmdzKSxcbiAgfSk7XG5cbiAgcGx1Z2luLmFkZENvbW1hbmQoe1xuICAgIGlkOiBcInByb3BlcnR5LXN5bmNcIixcbiAgICBuYW1lOiBcIlByb3BlcnR5LUJhY2tsaW5raW5nIC0gQWt0dWFsaXNpZXJlblwiLFxuICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzeW5jQWxsTGlua3MocGx1Z2luLmFwcCwgcGx1Z2luLnNldHRpbmdzLnJlY2lwcm9jYWxMaW5rUHJvcGVydGllcywgcGx1Z2luLnNldHRpbmdzLmRlY2xhcmVkTGlua1BhaXJzKTtcbiAgICAgIHBsdWdpbi5zZXR0aW5ncy5kZWNsYXJlZExpbmtQYWlycyA9IHJlc3VsdC5kZWNsYXJlZFBhaXJzO1xuICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgbmV3IE5vdGljZShgUHJvcGVydHktQmFja2xpbmtpbmc6ICR7cmVzdWx0LmNoZWNrZWR9IE5vdGl6ZW4gZ2Vwclx1MDBGQ2Z0LCAke3Jlc3VsdC5hZGRlZH0gZXJnXHUwMEU0bnp0LCAke3Jlc3VsdC5yZW1vdmVkfSBlbnRmZXJudC5gKTtcbiAgICB9LFxuICB9KTtcblxuICBwbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgaWQ6IFwib3Blbi1pbXBvcnRhbnQtcGx1Z2luLXNldHRpbmdzXCIsXG4gICAgbmFtZTogXCJPcGVuIEltcG9ydGFudCBQbHVnaW4gU2V0dGluZ3MgKFBpY2tlcilcIixcbiAgICBjYWxsYmFjazogKCkgPT4gb3BlbkltcG9ydGFudFBsdWdpblNldHRpbmdzUGlja2VyKHBsdWdpbiksXG4gIH0pO1xuXG4gIHBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICBpZDogXCJkYXRlbmJhbmstb3JkbmVyLW9lZmZuZW4tc2NobGllc3NlblwiLFxuICAgIG5hbWU6IFwiRGF0ZW5iYW5rIC0gT3JkbmVyIFx1MDBGNmZmbmVuL3NjaGxpZVx1MDBERmVuXCIsXG4gICAgY2FsbGJhY2s6ICgpID0+IHBsdWdpbi50b2dnbGVEYXRhYmFzZUZvbGRlcj8uKCksXG4gIH0pO1xuXG59XG5cbm1vZHVsZS5leHBvcnRzID0geyByZWdpc3RlckNvbW1hbmRzIH07XG4iLCAiY29uc3QgeyBURmlsZSwgVEZvbGRlciwgRnV6enlTdWdnZXN0TW9kYWwsIE5vdGljZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIERhdGVuYmFuay1PcmRuZXJcbiAqIE9yZG5lciBtaXQga29uZmlndXJpZXJiYXJlbSBQclx1MDBFNGZpeCAoU3RhbmRhcmQgXCJ+XCIpIHdlcmRlbiBpbVxuICogRmlsZS1FeHBsb3JlciBuaWNodCBtZWhyIGF1Zi0venVrbGFwcGJhciBkYXJnZXN0ZWxsdCB1bmQgemVpZ2VuXG4gKiBzdGF0dCBkZXMgUGZlaWxzIGRpZSBBbnphaGwgZW50aGFsdGVuZXIgLm1kLURhdGVpZW4uXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLy8gQ1NTIHppZWx0IGJld3Vzc3QgYXVmIGRpZSBLbGFzc2UgXCIuZnJlZC1kYi1mb2xkZXJcIiBzdGF0dCBhdWYgZWluXG4vLyBbZGF0YS1wYXRoXj0uLi5dL1tkYXRhLXBhdGgqPS4uLl0tQXR0cmlidXRzZWxla3RvcjogRWluIEF0dHJpYnV0c2VsZWt0b3Jcbi8vIG1hdGNodCBkZW4gR0VTQU1URU4gUGZhZC1TdHJpbmcsIG5pY2h0IG51ciBkZW4gT3JkbmVybmFtZW4gLSBlaW5cbi8vIFVudGVyb3JkbmVyIE9ITkUgUHJcdTAwRTRmaXggaW5uZXJoYWxiIGVpbmVzIERhdGVuYmFuay1PcmRuZXJzICh6LiBCLlxuLy8gXCJ+REIvU3ViXCIpIGhcdTAwRTR0dGUgZWluZW4gZGF0YS1wYXRoLCBkZXIgZWJlbmZhbGxzIG1pdCBkZW0gUHJcdTAwRTRmaXggYmVnaW5udCxcbi8vIHVuZCB3XHUwMEZDcmRlIGZhZWxzY2hsaWNoIGRpZSBQZmVpbC1BdXNibGVuZC1SZWdlbCBlcmJlbi4gRGllIEtsYXNzZSB3aXJkIGluXG4vLyByZWZyZXNoV2F0Y2hlZEZvbGRlcnMoKSBhdXNzY2hsaWVzc2xpY2ggXHUwMEZDYmVyIGlzRGF0YWJhc2VQYXRoKCkgKHByXHUwMEZDZnQgbnVyXG4vLyBkZW4gZWlnZW5lbiBPcmRuZXJuYW1lbikgZ2VzZXR6dCwgZGllc2VsYmUgUXVlbGxlIHdpZSBmXHUwMEZDciBkaWUgQmFkZ2UtTG9naWtcbi8vIC0gZGFtaXQga1x1MDBGNm5uZW4gQ1NTIHVuZCBKUyBuaWUgYXVzZWluYW5kZXJsYXVmZW4uXG5mdW5jdGlvbiBidWlsZFN0eWxlKHByZWZpeCwgc3VwcHJlc3NVbmRlcmxpbmUsIGNvdW50QXRFbmQpIHtcbiAgaWYgKCFwcmVmaXgpIHJldHVybiBcIlwiO1xuICBsZXQgY3NzID0gXCJcIjtcblxuICBpZiAoY291bnRBdEVuZCkge1xuICAgIGNzcyArPSBgXG4ubmF2LWZvbGRlci10aXRsZS5mcmVkLWRiLWZvbGRlciAuY29sbGFwc2UtaWNvbiB7XG4gIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbn1cbmA7XG4gIH0gZWxzZSB7XG4gICAgY3NzICs9IGBcbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5jb2xsYXBzZS1pY29uIHN2ZyB7XG4gIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbn1cbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5jb2xsYXBzZS1pY29uIHtcbiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbn1cbi5mcmVkLWRiLWNvdW50IHtcbiAgZm9udC1zaXplOiB2YXIoLS1mb250LXVpLXNtYWxsZXIpO1xuICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XG59XG5gO1xuICB9XG5cbiAgaWYgKHN1cHByZXNzVW5kZXJsaW5lKSB7XG4gICAgY3NzICs9IGBcbi5uYXYtZm9sZGVyLXRpdGxlLmZyZWQtZGItZm9sZGVyIC5uYXYtZm9sZGVyLXRpdGxlLWNvbnRlbnQge1xuICB0ZXh0LWRlY29yYXRpb24tbGluZTogbm9uZSAhaW1wb3J0YW50O1xufVxuYDtcbiAgfVxuICByZXR1cm4gY3NzO1xufVxuXG5mdW5jdGlvbiBpc0RhdGFiYXNlUGF0aChwYXRoLCBwcmVmaXgpIHtcbiAgaWYgKCFwYXRoIHx8ICFwcmVmaXgpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgbmFtZSA9IHBhdGguc3BsaXQoXCIvXCIpLnBvcCgpO1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKHByZWZpeCk7XG59XG5cbmZ1bmN0aW9uIGlzRGF0YWJhc2VGb2xkZXJUaXRsZSh0aXRsZUVsLCBwcmVmaXgpIHtcbiAgaWYgKCF0aXRsZUVsKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBpc0RhdGFiYXNlUGF0aCh0aXRsZUVsLmdldEF0dHJpYnV0ZShcImRhdGEtcGF0aFwiKSwgcHJlZml4KTtcbn1cblxuLy8gXHUwMEM0dVx1MDBERmVyc3RlciBEYXRlbmJhbmstT3JkbmVyIGF1ZiBkZW0gUGZhZCBlaW5lciBEYXRlaSAobmljaHQgZGllIERhdGVpIHNlbGJzdCkgLVxuLy8gYmVpIHZlcnNjaGFjaHRlbHRlbiBEYXRlbmJhbmstT3JkbmVybiBkZXIgb2JlcnN0ZSwgd2VpbCBlaW4gd2VpdGVyIGlubmVuXG4vLyBsaWVnZW5kZXIgVHJlZmZlciBvaG5laGluIHVuc2ljaHRiYXIgd1x1MDBFNHJlLCBzb2xhbmdlIGRlciBcdTAwRTR1XHUwMERGZXJlIHp1Z2VrbGFwcHQgaXN0LlxuZnVuY3Rpb24gZmluZERhdGFiYXNlQW5jZXN0b3JGb2xkZXIoYXBwLCBmaWxlUGF0aCwgcHJlZml4KSB7XG4gIGlmICghcHJlZml4KSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc2VnbWVudHMgPSBmaWxlUGF0aC5zcGxpdChcIi9cIik7XG4gIHNlZ21lbnRzLnBvcCgpO1xuICBmb3IgKGxldCBpID0gMTsgaSA8PSBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNhbmRpZGF0ZVBhdGggPSBzZWdtZW50cy5zbGljZSgwLCBpKS5qb2luKFwiL1wiKTtcbiAgICBpZiAoaXNEYXRhYmFzZVBhdGgoY2FuZGlkYXRlUGF0aCwgcHJlZml4KSkge1xuICAgICAgY29uc3QgZm9sZGVyID0gYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjYW5kaWRhdGVQYXRoKTtcbiAgICAgIGlmIChmb2xkZXIgaW5zdGFuY2VvZiBURm9sZGVyKSByZXR1cm4gZm9sZGVyO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY291bnRNYXJrZG93bkZpbGVzKGFwcCwgZm9sZGVyUGF0aCkge1xuICBjb25zdCBjaGlsZFByZWZpeCA9IGZvbGRlclBhdGggKyBcIi9cIjtcbiAgbGV0IGNvdW50ID0gMDtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkpIHtcbiAgICBpZiAoZmlsZS5wYXRoLnN0YXJ0c1dpdGgoY2hpbGRQcmVmaXgpKSBjb3VudCsrO1xuICB9XG4gIHJldHVybiBjb3VudDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRm9sZGVyQmFkZ2UoYXBwLCBuYXZGb2xkZXIsIGZvbGRlclBhdGgsIGF0RW5kKSB7XG4gIGNvbnN0IHRpdGxlRWwgPSBuYXZGb2xkZXIucXVlcnlTZWxlY3RvcihcIjpzY29wZSA+IC5uYXYtZm9sZGVyLXRpdGxlXCIpO1xuICBpZiAoIXRpdGxlRWwpIHJldHVybjtcbiAgY29uc3QgY29sbGFwc2VJY29uID0gdGl0bGVFbC5xdWVyeVNlbGVjdG9yKFwiOnNjb3BlID4gLmNvbGxhcHNlLWljb25cIik7XG5cbiAgLy8gQmFkZ2UgYXVzIGRlciBqZXdlaWxzIGFuZGVyZW4gUG9zaXRpb24gZW50ZmVybmVuLCBmYWxscyBkaWUgRWluc3RlbGx1bmdcbiAgLy8gc2VpdCBkZW0gbGV0enRlbiBVcGRhdGUgZ2V3ZWNoc2VsdCBoYXQuXG4gIGlmIChhdEVuZCAmJiBjb2xsYXBzZUljb24pIHtcbiAgICBjb25zdCBzdGFsZSA9IGNvbGxhcHNlSWNvbi5xdWVyeVNlbGVjdG9yKFwiLmZyZWQtZGItY291bnRcIik7XG4gICAgaWYgKHN0YWxlKSBzdGFsZS5yZW1vdmUoKTtcbiAgfVxuICBpZiAoIWF0RW5kKSB7XG4gICAgY29uc3Qgc3RhbGUgPSB0aXRsZUVsLnF1ZXJ5U2VsZWN0b3IoXCI6c2NvcGUgPiAuZnJlZC1kYi1jb3VudFwiKTtcbiAgICBpZiAoc3RhbGUpIHN0YWxlLnJlbW92ZSgpO1xuICB9XG5cbiAgY29uc3QgcGFyZW50ID0gYXRFbmQgPyB0aXRsZUVsIDogY29sbGFwc2VJY29uO1xuICBpZiAoIXBhcmVudCkgcmV0dXJuO1xuXG4gIGxldCBiYWRnZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKFwiOnNjb3BlID4gLmZyZWQtZGItY291bnRcIik7XG4gIGlmICghYmFkZ2UpIHtcbiAgICBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgYmFkZ2UuY2xhc3NOYW1lID0gYXRFbmQgPyBcIm5hdi1maWxlLXRhZyBmcmVkLWRiLWNvdW50XCIgOiBcImZyZWQtZGItY291bnRcIjtcbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoYmFkZ2UpO1xuICB9XG4gIGJhZGdlLnRleHRDb250ZW50ID0gU3RyaW5nKGNvdW50TWFya2Rvd25GaWxlcyhhcHAsIGZvbGRlclBhdGgpKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRm9sZGVyQmFkZ2UobmF2Rm9sZGVyKSB7XG4gIG5hdkZvbGRlci5xdWVyeVNlbGVjdG9yQWxsKFwiLmZyZWQtZGItY291bnRcIikuZm9yRWFjaCgoZWwpID0+IGVsLnJlbW92ZSgpKTtcbn1cblxuZnVuY3Rpb24gc2V0RGF0YWJhc2VGb2xkZXJDbGFzcyh0aXRsZUVsLCBpc0RiRm9sZGVyKSB7XG4gIHRpdGxlRWwuY2xhc3NMaXN0LnRvZ2dsZShcImZyZWQtZGItZm9sZGVyXCIsIGlzRGJGb2xkZXIpO1xufVxuXG5mdW5jdGlvbiBjb2xsZWN0RGF0YWJhc2VGb2xkZXJzKGFwcCwgcHJlZml4KSB7XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBjb25zdCB3YWxrID0gKGZvbGRlcikgPT4ge1xuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZm9sZGVyLmNoaWxkcmVuKSB7XG4gICAgICBpZiAoIShjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpKSBjb250aW51ZTtcbiAgICAgIGlmIChpc0RhdGFiYXNlUGF0aChjaGlsZC5wYXRoLCBwcmVmaXgpKSByZXN1bHQucHVzaChjaGlsZCk7XG4gICAgICB3YWxrKGNoaWxkKTtcbiAgICB9XG4gIH07XG4gIHdhbGsoYXBwLnZhdWx0LmdldFJvb3QoKSk7XG4gIHJldHVybiByZXN1bHQuc29ydCgoYSwgYikgPT4gYS5wYXRoLmxvY2FsZUNvbXBhcmUoYi5wYXRoKSk7XG59XG5cbi8vIEZcdTAwRkNyIGRlbiBCZWZlaGwgXCJEYXRlbmJhbmstT3JkbmVyIFx1MDBGNmZmbmVuL3NjaGxpZVx1MDBERmVuXCI6IEZ1enp5LUF1c3dhaGwgXHUwMEZDYmVyIGFsbGVcbi8vIHZvcmhhbmRlbmVuIERhdGVuYmFuay1PcmRuZXIsIG1pdCBBbnplaWdlLCBvYiBzaWUgYWt0dWVsbCBtYW51ZWxsIG9mZmVuIHNpbmQuXG5jbGFzcyBEYXRhYmFzZUZvbGRlclBpY2tlck1vZGFsIGV4dGVuZHMgRnV6enlTdWdnZXN0TW9kYWwge1xuICBjb25zdHJ1Y3RvcihhcHAsIGZvbGRlcnMsIG1hbnVhbGx5T3BlblBhdGhzLCByZXNvbHZlKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmZvbGRlcnMgPSBmb2xkZXJzO1xuICAgIHRoaXMubWFudWFsbHlPcGVuUGF0aHMgPSBtYW51YWxseU9wZW5QYXRocztcbiAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIHRoaXMuY2hvc2VuID0gZmFsc2U7XG4gICAgdGhpcy5zZXRQbGFjZWhvbGRlcihcIkRhdGVuYmFuay1PcmRuZXIgenVtIFx1MDBENmZmbmVuL1NjaGxpZVx1MDBERmVuIHdcdTAwRTRobGVuIC0gRVNDIGZcdTAwRkNyIEFiYnJ1Y2hcIik7XG4gIH1cblxuICBnZXRJdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5mb2xkZXJzO1xuICB9XG5cbiAgZ2V0SXRlbVRleHQoZm9sZGVyKSB7XG4gICAgcmV0dXJuIGZvbGRlci5wYXRoO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihtYXRjaCwgZWwpIHtcbiAgICBjb25zdCBmb2xkZXIgPSBtYXRjaC5pdGVtO1xuICAgIGNvbnN0IGlzT3BlbiA9IHRoaXMubWFudWFsbHlPcGVuUGF0aHMuaGFzKGZvbGRlci5wYXRoKTtcbiAgICBlbC5jcmVhdGVTcGFuKHsgdGV4dDogZm9sZGVyLnBhdGggfSk7XG4gICAgY29uc3Qgc3RhdGUgPSBlbC5jcmVhdGVTcGFuKHsgdGV4dDogaXNPcGVuID8gXCJnZVx1MDBGNmZmbmV0XCIgOiBcImdlc2NobG9zc2VuXCIgfSk7XG4gICAgc3RhdGUuc3R5bGUuZmxvYXQgPSBcInJpZ2h0XCI7XG4gICAgc3RhdGUuc3R5bGUuY29sb3IgPSBcInZhcigtLXRleHQtbXV0ZWQpXCI7XG4gIH1cblxuICBzZWxlY3RTdWdnZXN0aW9uKGl0ZW0sIGV2dCkge1xuICAgIHRoaXMuY2hvc2VuID0gdHJ1ZTtcbiAgICBzdXBlci5zZWxlY3RTdWdnZXN0aW9uKGl0ZW0sIGV2dCk7XG4gIH1cblxuICBvbkNob29zZUl0ZW0oZm9sZGVyKSB7XG4gICAgdGhpcy5yZXNvbHZlKGZvbGRlcik7XG4gIH1cblxuICBvbkNsb3NlKCkge1xuICAgIHN1cGVyLm9uQ2xvc2UoKTtcbiAgICBpZiAoIXRoaXMuY2hvc2VuKSB0aGlzLnJlc29sdmUobnVsbCk7XG4gIH1cbn1cblxuLy8gRXJzZXR6dCBpbiBkZXIgRGF0ZWktRXhwbG9yZXItQW5zaWNodCBkYXMgWmllbCB2b24gcmV2ZWFsSW5Gb2xkZXIoKSBmXHUwMEZDciBlaW5lXG4vLyBEYXRlaSBpbm5lcmhhbGIgZWluZXMgRGF0ZW5iYW5rLU9yZG5lcnM6IHN0YXR0IHp1ciAodW5zaWNodGJhcmVuLCB3ZWlsIGRlclxuLy8gcGF0Y2hGb2xkZXJJdGVtLVBhdGNoIHVudGVuIGRhcyBBdWZrbGFwcGVuIG9obmVoaW4gdmVyaGluZGVydCkgRGF0ZWkgc2VsYnN0XG4vLyB6dSBzcHJpbmdlbiwgd2lyZCBkZXIgRGF0ZW5iYW5rLU9yZG5lciBzZWxic3QgZ2V6ZWlndC4gUmVpbiBrb3NtZXRpc2NoIC1cbi8vIGRhc3MgZGVyIE9yZG5lciB6dSBibGVpYnQsIGdhcmFudGllcnQgYmVyZWl0cyBwYXRjaEZvbGRlckl0ZW0gdW50ZW4sXG4vLyB1bmFiaFx1MDBFNG5naWcgZGF2b24sIHdlbGNoZXMgWmllbCBoaWVyIGdld1x1MDBFNGhsdCB3aXJkLlxuZnVuY3Rpb24gcGF0Y2hSZXZlYWxJbkZvbGRlcihwbHVnaW4sIHZpZXcsIHBhdGNoZWRWaWV3cykge1xuICBpZiAoIXZpZXcgfHwgdHlwZW9mIHZpZXcucmV2ZWFsSW5Gb2xkZXIgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuICBpZiAodmlldy5fX2ZyZWRSZXZlYWxPcmlnaW5hbCkge1xuICAgIHBhdGNoZWRWaWV3cy5hZGQodmlldyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IG9yaWdpbmFsID0gdmlldy5yZXZlYWxJbkZvbGRlci5iaW5kKHZpZXcpO1xuICB2aWV3Ll9fZnJlZFJldmVhbE9yaWdpbmFsID0gb3JpZ2luYWw7XG4gIHZpZXcucmV2ZWFsSW5Gb2xkZXIgPSAoaXRlbSkgPT4ge1xuICAgIGlmIChwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCAmJiBpdGVtIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIGNvbnN0IGRiRm9sZGVyID0gZmluZERhdGFiYXNlQW5jZXN0b3JGb2xkZXIocGx1Z2luLmFwcCwgaXRlbS5wYXRoLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpO1xuICAgICAgaWYgKGRiRm9sZGVyKSByZXR1cm4gb3JpZ2luYWwoZGJGb2xkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3JpZ2luYWwoaXRlbSk7XG4gIH07XG4gIHBhdGNoZWRWaWV3cy5hZGQodmlldyk7XG59XG5cbi8vIEVyc2V0enQgdmlldy5yZXZlYWxBY3RpdmVGaWxlKCkgLSBsXHUwMEU0dWZ0IGJlaSBqZWRlbSBEYXRlaXdlY2hzZWwsIHdlbm4gaW1cbi8vIERhdGVpLUV4cGxvcmVyIFwiQWt0dWVsbGUgRGF0ZWkgYXV0b21hdGlzY2ggYW56ZWlnZW5cIiBha3RpdiBpc3QuIE9ic2lkaWFuc1xuLy8gZWlnZW5lIEltcGxlbWVudGllcnVuZyBleHBhbmRpZXJ0IHp3YXIgZGllIEFobmVua2V0dGUgKHdpcmt1bmdzbG9zIGZcdTAwRkNyIGRlblxuLy8gRGF0ZW5iYW5rLU9yZG5lciBzZWxic3QgZGFuayBwYXRjaEZvbGRlckl0ZW0gdW50ZW4pLCBzY3JvbGx0IGRhbmFjaCBhYmVyIHp1clxuLy8gLSBkYW5uIHVuc2ljaHRiYXIgYmxlaWJlbmRlbiAtIERhdGVpIHVuZCB6ZWlndCBkYWJlaSBLRUlORSBNYXJraWVydW5nIGFuXG4vLyAoZGFzIG5hdGl2ZSBcIkF1ZmJsaXR6ZW5cIiBnaWJ0IGVzIG51ciBiZWkgcmV2ZWFsSW5Gb2xkZXIoKSwgbmljaHQgaGllcikuXG4vLyBMaWVndCBkaWUgYWt0aXZlIERhdGVpIGluIGVpbmVtIERhdGVuYmFuay1PcmRuZXIsIHdpcmQgZGVzaGFsYiBzdGF0dGRlc3NlblxuLy8gdmlldy5yZXZlYWxJbkZvbGRlcihkYkZvbGRlcikgYXVmZ2VydWZlbjogZGllc2VsYmUgTWV0aG9kZSwgZGllIGF1Y2ggZGVyXG4vLyBCZWZlaGwgXCJEYXRlaSBpbSBOYXZpZ2F0b3IgYW56ZWlnZW5cIiBudXR6dCAtIGtsYXBwdCBBaG5lbm9yZG5lciBhdWYsIHNjcm9sbHRcbi8vIHp1bSBPcmRuZXIgdW5kIGxcdTAwRTRzc3QgaWhuIGt1cnogYXVmYmxpdHplbi5cbi8vXG4vLyBJc3QgZGVyIERhdGVpLUV4cGxvcmVyIGdlcmFkZSBnYXIgbmljaHQgc2ljaHRiYXIsIHdpcmQgdW52ZXJcdTAwRTRuZGVydCBhblxuLy8gb3JpZ2luYWwoKSBkZWxlZ2llcnQ6IE9ic2lkaWFuIG1lcmt0IHNpY2ggZGFzIGRhbm4gc2VsYnN0IHZvciB1bmQgcnVmdCBiZWlcbi8vIGVybmV1dGVyIFNpY2h0YmFya2VpdCB2aWV3LnJldmVhbEFjdGl2ZUZpbGUoKSAoenUgZGVtIFplaXRwdW5rdCBiZXJlaXRzXG4vLyB3aWVkZXIgZGllc2UgZ2VwYXRjaHRlIFZlcnNpb24pIGF1dG9tYXRpc2NoIGVybmV1dCBhdWYgLSBnZW5hdSBkZXIgRmFsbCwgaW5cbi8vIGRlbSBkYXMgZXJuZXV0ZSBGb2t1c3NpZXJlbiBkZXMgRGF0ZWktRXhwbG9yZXJzIHp1dm9yIG5pY2h0IHNhdWJlciBlcmZhc3N0XG4vLyB3dXJkZS5cbmZ1bmN0aW9uIHBhdGNoUmV2ZWFsQWN0aXZlRmlsZShwbHVnaW4sIHZpZXcsIHBhdGNoZWRWaWV3cykge1xuICBpZiAoIXZpZXcgfHwgdHlwZW9mIHZpZXcucmV2ZWFsQWN0aXZlRmlsZSAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm47XG4gIGlmICh2aWV3Ll9fZnJlZFJldmVhbEFjdGl2ZU9yaWdpbmFsKSB7XG4gICAgcGF0Y2hlZFZpZXdzLmFkZCh2aWV3KTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3Qgb3JpZ2luYWwgPSB2aWV3LnJldmVhbEFjdGl2ZUZpbGUuYmluZCh2aWV3KTtcbiAgdmlldy5fX2ZyZWRSZXZlYWxBY3RpdmVPcmlnaW5hbCA9IG9yaWdpbmFsO1xuICB2aWV3LnJldmVhbEFjdGl2ZUZpbGUgPSAoKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuIG9yaWdpbmFsKCk7XG4gICAgaWYgKCF2aWV3LmNvbnRhaW5lckVsLmlzU2hvd24oKSkgcmV0dXJuIG9yaWdpbmFsKCk7XG5cbiAgICBjb25zdCBmaWxlUGF0aCA9IHZpZXcuYWN0aXZlRG9tPy5maWxlPy5wYXRoO1xuICAgIGNvbnN0IGRiRm9sZGVyID0gZmlsZVBhdGhcbiAgICAgID8gZmluZERhdGFiYXNlQW5jZXN0b3JGb2xkZXIocGx1Z2luLmFwcCwgZmlsZVBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeClcbiAgICAgIDogbnVsbDtcbiAgICBpZiAoIWRiRm9sZGVyKSByZXR1cm4gb3JpZ2luYWwoKTtcblxuICAgIHJldHVybiB2aWV3LnJldmVhbEluRm9sZGVyKGRiRm9sZGVyKTtcbiAgfTtcbiAgcGF0Y2hlZFZpZXdzLmFkZCh2aWV3KTtcbn1cblxuLy8gRlx1MDBFNG5ndCBBdWYtL1p1a2xhcHAtVmVyc3VjaGUgZGlyZWt0IGFuIGRlciBRdWVsbGUgYWIsIHN0YXR0IHNpZSByZWFrdGl2IHBlclxuLy8gTXV0YXRpb25PYnNlcnZlciByXHUwMEZDY2tnXHUwMEU0bmdpZyB6dSBtYWNoZW4gKGRlciB2b3JoZXJpZ2UgQW5zYXR6IC0gbGllXHUwMERGIHNpY2hcbi8vIGR1cmNoIE9ic2lkaWFucyB2aXJ0dWFsaXNpZXJ0ZSBCYXVtZGFyc3RlbGx1bmcgdW1nZWhlbiwgei4gQi4gYmVpbSBlcm5ldXRlblxuLy8gRm9rdXNzaWVyZW4gZGVzIERhdGVpLUV4cGxvcmVycywgd2VubiBkZXNzZW4gXCJpbmZpbml0eVNjcm9sbFwiIGZcdTAwRkNyIHdpZWRlclxuLy8gc2ljaHRiYXJlIFplaWxlbiBmcmlzY2hlIERPTS1FbGVtZW50ZSBlcnpldWd0LCBkaWUgZGVyIE9ic2VydmVyIG5pY2h0IG1laHJcbi8vIGtlbm50KS5cbi8vXG4vLyB2aWV3LmZpbGVJdGVtc1twYXRoXSBzaW5kIE9ic2lkaWFucyBlaWdlbmUgT3JkbmVyLUl0ZW0tT2JqZWt0ZS4gSkVERVIgV2VnLFxuLy8gZWluZW4gT3JkbmVyIGF1Znp1a2xhcHBlbiAtIG5hdGl2ZXIgUGZlaWwtS2xpY2ssIFwiQWxsZSBhdWZrbGFwcGVuXCIsXG4vLyBcIkFrdHVlbGxlIERhdGVpIGF1dG9tYXRpc2NoIGFuemVpZ2VuXCIsIHJldmVhbEluRm9sZGVyKCkgZlx1MDBGQ3IgZWluZSBEYXRlaVxuLy8gZGFyaW4sIGplZGUga1x1MDBGQ25mdGlnZSBPYnNpZGlhbi1GdW5rdGlvbiAtIGxcdTAwRTR1ZnQgbGV0enRsaWNoIFx1MDBGQ2JlciBnZW5hdSBlaW5lXG4vLyBNZXRob2RlIGFuIGRpZXNlbSBPYmpla3Q6IGl0ZW0uc2V0Q29sbGFwc2VkKCkuICh0b2dnbGVDb2xsYXBzZWQoKSBydWZ0XG4vLyBpbnRlcm4gdGhpcy5zZXRDb2xsYXBzZWQoKSBhdWYsIFwiQWxsZSBhdWZrbGFwcGVuXCIgcnVmdCB0b2dnbGVDb2xsYXBzZWQoKSBqZVxuLy8gT3JkbmVyLUl0ZW0gYXVmIC0gYmVpZGVzIGxhbmRldCBhbHNvIGViZW5mYWxscyBoaWVyLikgRWluIGVpbm1hbGlnZXIgUGF0Y2hcbi8vIGRpZXNlciBlaW5lbiBNZXRob2RlIGRlY2t0IHNvbWl0IGF1c25haG1zbG9zIGplZGVuIEF1c2xcdTAwRjZzZXIgYWIuXG5mdW5jdGlvbiBwYXRjaEZvbGRlckl0ZW0ocGx1Z2luLCBpdGVtLCBtYW51YWxseU9wZW5QYXRocywgcGF0Y2hlZEl0ZW1zKSB7XG4gIGlmICghaXRlbSB8fCB0eXBlb2YgaXRlbS5zZXRDb2xsYXBzZWQgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuO1xuICBpZiAoaXRlbS5fX2ZyZWRTZXRDb2xsYXBzZWRPcmlnaW5hbCkge1xuICAgIHBhdGNoZWRJdGVtcy5hZGQoaXRlbSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgb3JpZ2luYWwgPSBpdGVtLnNldENvbGxhcHNlZC5iaW5kKGl0ZW0pO1xuICBpdGVtLl9fZnJlZFNldENvbGxhcHNlZE9yaWdpbmFsID0gb3JpZ2luYWw7XG4gIGl0ZW0uc2V0Q29sbGFwc2VkID0gKGNvbGxhcHNlZCwgaW5zdGFudCkgPT4ge1xuICAgIGNvbnN0IHBhdGggPSBpdGVtLmZpbGU/LnBhdGg7XG4gICAgY29uc3QgaXNEYkZvbGRlciA9IHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkICYmIGlzRGF0YWJhc2VQYXRoKHBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlclByZWZpeCk7XG4gICAgaWYgKGlzRGJGb2xkZXIgJiYgIWNvbGxhcHNlZCAmJiAhbWFudWFsbHlPcGVuUGF0aHMuaGFzKHBhdGgpKSB7XG4gICAgICAvLyBFeHBhbmQtVmVyc3VjaCBhYmdlZmFuZ2VuIC0gRGF0ZW5iYW5rLU9yZG5lciBibGVpYnQgenVnZWtsYXBwdC5cbiAgICAgIC8vIHNldENvbGxhcHNlZCBsaWVmZXJ0IG5vcm1hbGVyd2Vpc2UgZWluIFByb21pc2U7IGVpbiBhdWZnZWxcdTAwRjZzdGVzXG4gICAgICAvLyBQcm9taXNlIHN0YXR0IHVuZGVmaW5lZCB6dXJcdTAwRkNja3p1Z2ViZW4gaFx1MDBFNGx0IGRlbiBWZXJ0cmFnIGZcdTAwRkNyIEF1ZnJ1ZmVyXG4gICAgICAvLyBlaW4sIGRpZSAod2llIHJldmVhbEluRm9sZGVyIGludGVybikgZGFyYXVmIHZlcmtldHRlbi5cbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbmFsKGNvbGxhcHNlZCwgaW5zdGFudCk7XG4gIH07XG4gIHBhdGNoZWRJdGVtcy5hZGQoaXRlbSk7XG5cbiAgLy8gRWlubWFsaWcgYmVpbSBQYXRjaGVuIHNpY2hlcnN0ZWxsZW4sIGRhc3MgZGVyIE9yZG5lciB0YXRzXHUwMEU0Y2hsaWNoXG4gIC8vIHp1Z2VrbGFwcHQgaXN0ICh6LiBCLiBmYWxscyBPYnNpZGlhbiBpaG4gYXVzIGRlbSBsZXR6dGVuIFNpdHp1bmdzc3RhbmRcbiAgLy8gYmVyZWl0cyBhdWZnZWtsYXBwdCB3aWVkZXJoZXJnZXN0ZWxsdCBoYXQpLlxuICBjb25zdCBwYXRoID0gaXRlbS5maWxlPy5wYXRoO1xuICBpZiAoXG4gICAgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQgJiZcbiAgICBpc0RhdGFiYXNlUGF0aChwYXRoLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpICYmXG4gICAgIW1hbnVhbGx5T3BlblBhdGhzLmhhcyhwYXRoKSAmJlxuICAgIGl0ZW0uY29sbGFwc2VkICE9PSB0cnVlXG4gICkge1xuICAgIG9yaWdpbmFsKHRydWUsIHRydWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzKHBsdWdpbikge1xuICBjb25zdCBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xuICBzdHlsZUVsLmlkID0gXCJmcmVkLWRhdGFiYXNlLWZvbGRlcnMtc3R5bGVcIjtcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZUVsKTtcblxuICBjb25zdCB3YXRjaGVkRm9sZGVycyA9IG5ldyBNYXAoKTsgLy8gcGF0aCAtPiBuYXZGb2xkZXIgKG51ciBmXHUwMEZDciBkaWUgQmFkZ2UtQW56ZWlnZSlcbiAgY29uc3QgcGF0Y2hlZEl0ZW1zID0gbmV3IFNldCgpO1xuICBjb25zdCBwYXRjaGVkVmlld3MgPSBuZXcgU2V0KCk7XG4gIC8vIEVpbiBNdXRhdGlvbk9ic2VydmVyIHBybyBEYXRlaS1FeHBsb3Jlci1WaWV3ICh2aWV3LmNvbnRhaW5lckVsIHNlbGJzdFxuICAvLyB3aXJkIHZvbiBPYnNpZGlhbnMgdmlydHVhbGlzaWVydGVtIEJhdW0gbmllIHplcnN0XHUwMEY2cnQgLSBzaWVoZSB1bnRlbiAtXG4gIC8vIG51ciBlaW56ZWxuZSBaZWlsZW4gd2VyZGVuIGF1cyBkZW0gRE9NIGVudGZlcm50L3dpZWRlciBlaW5nZWZcdTAwRkNndCkuXG4gIGNvbnN0IGNvbnRhaW5lck9ic2VydmVycyA9IG5ldyBNYXAoKTsgLy8gdmlldyAtPiBNdXRhdGlvbk9ic2VydmVyXG4gIGxldCByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG4gIC8vIFBmYWRlIHZvbiBEYXRlbmJhbmstT3JkbmVybiwgZGllIFx1MDBGQ2JlciBkZW4gQmVmZWhsIFwiRGF0ZW5iYW5rLU9yZG5lclxuICAvLyBcdTAwRjZmZm5lbi9zY2hsaWVcdTAwREZlblwiIG1hbnVlbGwgYXVmZ2VrbGFwcHQgd3VyZGVuIC0gZ2lsdCBudXIgZlx1MDBGQ3IgZGllIGxhdWZlbmRlXG4gIC8vIFNpdHp1bmcgKGJld3Vzc3QgbmljaHQgcGVyc2lzdGllcnQpLCBzaWVoZSB0b2dnbGVEYXRhYmFzZUZvbGRlciB1bnRlbi5cbiAgY29uc3QgbWFudWFsbHlPcGVuUGF0aHMgPSBuZXcgU2V0KCk7XG5cbiAgLy8gT2JzaWRpYW5zIERhdGVpLUJhdW0gaXN0IHZpcnR1YWxpc2llcnQgKHZpZXcudHJlZS5pbmZpbml0eVNjcm9sbCk6IFplaWxlblxuICAvLyBhdVx1MDBERmVyaGFsYiBkZXMgc2ljaHRiYXJlbiBCZXJlaWNocyB3ZXJkZW4gcGVyIGVsLmRldGFjaCgpIGF1cyBkZW0gRE9NXG4gIC8vIGVudGZlcm50IHVuZCBiZWltIFp1clx1MDBGQ2Nrc2Nyb2xsZW4gd2llZGVyIGVpbmdlZlx1MDBGQ2d0IC0gT0hORSBkYXNzIGRhYmVpIGVpblxuICAvLyBcImxheW91dC1jaGFuZ2VcIi1FdmVudCBmZXVlcnQgKHZlcmlmaXppZXJ0IGltIGVudHBhY2t0ZW4gT2JzaWRpYW4tQnVuZGxlLFxuICAvLyBzLiBJbmZpbml0eVNjcm9sbC51cGRhdGUoKSkuIEVpbiByZWluZXIgRE9NLVNjYW4gYmVpIFwibGF5b3V0LWNoYW5nZVwiICtcbiAgLy8gVmF1bHQtRXZlbnRzIHZlcnBhc3N0IGRlc2hhbGIgT3JkbmVyLCBkZXJlbiBaZWlsZSBnZXJhZGUgdW5zaWNodGJhciBpc3QgLVxuICAvLyBpaHIgQmFkZ2UgYmxlaWJ0IGRhbm4gZmVobGVuZCBvZGVyIHZlcmFsdGV0LCBiaXMgaXJnZW5kZWluIGFuZGVyZXIgR3J1bmRcbiAgLy8genVmXHUwMEU0bGxpZyBlaW5lbiBSZXNjYW4gYXVzbFx1MDBGNnN0LCB3XHUwMEU0aHJlbmQgZGllIFplaWxlIHNpY2h0YmFyIGlzdCAoei4gQi5cbiAgLy8gQW5rbGlja2VuL0Zva3Vzc2llcmVuKS4gdmlldy5jb250YWluZXJFbCBzZWxic3Qgd2lyZCBkYWJlaSBuaWUgZXJzZXR6dCxcbiAgLy8gbnVyIGVpbnplbG5lIFplaWxlbi1FbGVtZW50ZSB3ZXJkZW4gYW4tL2FiZ2VoXHUwMEU0bmd0IC0gZWluIGRhcmF1ZiBsYXVzY2hlbmRlclxuICAvLyBNdXRhdGlvbk9ic2VydmVyIGJla29tbXQgZGFoZXIgamVkZSBaZWlsZW4tXHUwMEM0bmRlcnVuZyB6dXZlcmxcdTAwRTRzc2lnIG1pdC5cbiAgY29uc3QgcmVmcmVzaFdhdGNoZWRGb2xkZXJzID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgbmF2Rm9sZGVyIG9mIHdhdGNoZWRGb2xkZXJzLnZhbHVlcygpKSB7XG4gICAgICByZW1vdmVGb2xkZXJCYWRnZShuYXZGb2xkZXIpO1xuICAgIH1cbiAgICB3YXRjaGVkRm9sZGVycy5jbGVhcigpO1xuXG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcmVkLWRiLWZvbGRlclwiKS5mb3JFYWNoKChlbCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyZWQtZGItZm9sZGVyXCIpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVmaXggPSBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXg7XG4gICAgZm9yIChjb25zdCBsZWFmIG9mIHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImZpbGUtZXhwbG9yZXJcIikpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XG4gICAgICBwYXRjaFJldmVhbEluRm9sZGVyKHBsdWdpbiwgdmlldywgcGF0Y2hlZFZpZXdzKTtcbiAgICAgIHBhdGNoUmV2ZWFsQWN0aXZlRmlsZShwbHVnaW4sIHZpZXcsIHBhdGNoZWRWaWV3cyk7XG4gICAgICBlbnN1cmVDb250YWluZXJPYnNlcnZlcih2aWV3KTtcblxuICAgICAgLy8gUGF0Y2h0IGF1c25haG1zbG9zIGFsbGUgRGF0ZW5iYW5rLU9yZG5lci1JdGVtcywgdW5hYmhcdTAwRTRuZ2lnIGRhdm9uLCBvYlxuICAgICAgLy8gaWhyZSBaZWlsZSBha3R1ZWxsIGltICh2aXJ0dWFsaXNpZXJ0ZW4pIERPTSBnZXJlbmRlcnQgaXN0IC0gYW5kZXJzIGFsc1xuICAgICAgLy8gZGVyIERPTS1TY2FuIHVudGVuLCBkZXIgZGFzIGZcdTAwRkNyIGRpZSBCYWRnZS1BbnplaWdlIGJyYXVjaHQuXG4gICAgICBmb3IgKGNvbnN0IHBhdGggaW4gdmlldy5maWxlSXRlbXMgPz8ge30pIHtcbiAgICAgICAgaWYgKCFpc0RhdGFiYXNlUGF0aChwYXRoLCBwcmVmaXgpKSBjb250aW51ZTtcbiAgICAgICAgcGF0Y2hGb2xkZXJJdGVtKHBsdWdpbiwgdmlldy5maWxlSXRlbXNbcGF0aF0sIG1hbnVhbGx5T3BlblBhdGhzLCBwYXRjaGVkSXRlbXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBTZXR6dCBkaWUgS2xhc3NlIGZcdTAwRkNyIEpFREUgYWt0dWVsbCBnZXJlbmRlcnRlIE9yZG5lci1UaXRlbHplaWxlIChuaWNodFxuICAgICAgLy8gbnVyIGZcdTAwRkNyIFRyZWZmZXIpIC0gc29uc3Qgd1x1MDBGQ3JkZSBlaW4gT3JkbmVyLCBkZXIgc2VpbiBQclx1MDBFNGZpeCBwZXJcbiAgICAgIC8vIFVtYmVuZW5udW5nIHZlcmxpZXJ0LCBkaWUgS2xhc3NlICh1bmQgZGFtaXQgZGllIGF1c2dlYmxlbmRldGVcbiAgICAgIC8vIFBmZWlsLURhcnN0ZWxsdW5nKSBmXHUwMEU0bHNjaGxpY2ggYmVoYWx0ZW4uXG4gICAgICB2aWV3LmNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2LWZvbGRlci10aXRsZVtkYXRhLXBhdGhdXCIpLmZvckVhY2goKHRpdGxlRWwpID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHRpdGxlRWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wYXRoXCIpO1xuICAgICAgICBjb25zdCBpc0RiRm9sZGVyID0gaXNEYXRhYmFzZVBhdGgocGF0aCwgcHJlZml4KTtcbiAgICAgICAgc2V0RGF0YWJhc2VGb2xkZXJDbGFzcyh0aXRsZUVsLCBpc0RiRm9sZGVyKTtcbiAgICAgICAgaWYgKCFpc0RiRm9sZGVyKSByZXR1cm47XG4gICAgICAgIGNvbnN0IG5hdkZvbGRlciA9IHRpdGxlRWwucGFyZW50RWxlbWVudDtcbiAgICAgICAgaWYgKCFuYXZGb2xkZXIgfHwgIW5hdkZvbGRlci5jbGFzc0xpc3QuY29udGFpbnMoXCJuYXYtZm9sZGVyXCIpKSByZXR1cm47XG5cbiAgICAgICAgd2F0Y2hlZEZvbGRlcnMuc2V0KHBhdGgsIG5hdkZvbGRlcik7XG4gICAgICAgIHVwZGF0ZUZvbGRlckJhZGdlKHBsdWdpbi5hcHAsIG5hdkZvbGRlciwgcGF0aCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gQlx1MDBGQ25kZWx0IG1laHJlcmUgc2NobmVsbCBhdWZlaW5hbmRlcmZvbGdlbmRlIE11dGF0aW9uZW4gKHouIEIuIHdcdTAwRTRocmVuZFxuICAvLyBlaW5lcyBTY3JvbGxzKSB6dSBlaW5lbSBSZXNjYW4gcHJvIEZyYW1lLiBEaWUgZWlnZW5lbiBNdXRhdGlvbmVuIHZvblxuICAvLyByZWZyZXNoV2F0Y2hlZEZvbGRlcnMgKEJhZGdlLUVsZW1lbnRlLCBLbGFzc2VuKSB3ZXJkZW4gZGFmXHUwMEZDciBwZXJcbiAgLy8gZGlzY29ubmVjdCgpL29ic2VydmUoKSBydW5kIHVtIGRlbiBBdWZydWYgYXVzZ2VibGVuZGV0IC0gc29uc3Qgd1x1MDBGQ3JkZSBkZXJcbiAgLy8gT2JzZXJ2ZXIgc2ljaCBzZWxic3QgbGF1ZmVuZCBlcm5ldXQgYXVzbFx1MDBGNnNlbi5cbiAgY29uc3Qgc2NoZWR1bGVSZWZyZXNoID0gKCkgPT4ge1xuICAgIGlmIChyZWZyZXNoU2NoZWR1bGVkKSByZXR1cm47XG4gICAgcmVmcmVzaFNjaGVkdWxlZCA9IHRydWU7XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgIHJlZnJlc2hTY2hlZHVsZWQgPSBmYWxzZTtcbiAgICAgIGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgY29udGFpbmVyT2JzZXJ2ZXJzLnZhbHVlcygpKSBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgICByZWZyZXNoV2F0Y2hlZEZvbGRlcnMoKTtcbiAgICAgIGZvciAoY29uc3QgW3ZpZXcsIG9ic2VydmVyXSBvZiBjb250YWluZXJPYnNlcnZlcnMpIHtcbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZSh2aWV3LmNvbnRhaW5lckVsLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBlbnN1cmVDb250YWluZXJPYnNlcnZlciA9ICh2aWV3KSA9PiB7XG4gICAgaWYgKGNvbnRhaW5lck9ic2VydmVycy5oYXModmlldykpIHJldHVybjtcbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHNjaGVkdWxlUmVmcmVzaCk7XG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZSh2aWV3LmNvbnRhaW5lckVsLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcbiAgICBjb250YWluZXJPYnNlcnZlcnMuc2V0KHZpZXcsIG9ic2VydmVyKTtcbiAgfTtcblxuICBwbHVnaW4uYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KHJlZnJlc2hXYXRjaGVkRm9sZGVycyk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFwibGF5b3V0LWNoYW5nZVwiLCByZWZyZXNoV2F0Y2hlZEZvbGRlcnMpKTtcblxuICAvLyBIXHUwMEU0bHQgZGllIFpcdTAwRTRobGVyIGFrdHVlbGwsIHdlbm4gTWFya2Rvd24tRGF0ZWllbiBpbiBlaW5lbSBiZW9iYWNodGV0ZW4gT3JkbmVyXG4gIC8vIChvZGVyIGVpbmVtIFVudGVyb3JkbmVyIGRhdm9uKSBhbmdlbGVndC9nZWxcdTAwRjZzY2h0L3ZlcnNjaG9iZW4gd2VyZGVuLlxuICBjb25zdCByZWZyZXNoQmFkZ2VGb3JQYXRoID0gKHBhdGgpID0+IHtcbiAgICBpZiAoIXBhdGgpIHJldHVybjtcbiAgICBmb3IgKGNvbnN0IFtmb2xkZXJQYXRoLCBuYXZGb2xkZXJdIG9mIHdhdGNoZWRGb2xkZXJzKSB7XG4gICAgICBpZiAocGF0aCA9PT0gZm9sZGVyUGF0aCB8fCBwYXRoLnN0YXJ0c1dpdGgoZm9sZGVyUGF0aCArIFwiL1wiKSkge1xuICAgICAgICB1cGRhdGVGb2xkZXJCYWRnZShwbHVnaW4uYXBwLCBuYXZGb2xkZXIsIGZvbGRlclBhdGgsIHBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlckNvdW50QXRFbmQpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgY29uc3Qgb25WYXVsdEZpbGVDaGFuZ2UgPSAoZmlsZSwgb2xkUGF0aCkgPT4ge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWQpIHJldHVybjtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybjtcbiAgICByZWZyZXNoQmFkZ2VGb3JQYXRoKGZpbGUucGF0aCk7XG4gICAgaWYgKG9sZFBhdGgpIHJlZnJlc2hCYWRnZUZvclBhdGgob2xkUGF0aCk7XG4gIH07XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgb25WYXVsdEZpbGVDaGFuZ2UpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcImRlbGV0ZVwiLCBvblZhdWx0RmlsZUNoYW5nZSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIG9uVmF1bHRGaWxlQ2hhbmdlKSk7XG5cbiAgLy8gRWluIG5ldSBhbmdlbGVndGVyIG9kZXIgdW1iZW5hbm50ZXIgT3JkbmVyIGthbm4gc29mb3J0IGF1ZiBkZW4gUHJcdTAwRTRmaXhcbiAgLy8gcGFzc2VuIC0gaGllciBkaXJla3QgcGF0Y2hlbiwgc3RhdHQgYXVmIGRlbiBuXHUwMEU0Y2hzdGVuIExheW91dC1XZWNoc2VsIHp1XG4gIC8vIHdhcnRlbi5cbiAgY29uc3Qgb25WYXVsdEZvbGRlckNoYW5nZSA9IChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuO1xuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikgcmVmcmVzaFdhdGNoZWRGb2xkZXJzKCk7XG4gIH07XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgb25WYXVsdEZvbGRlckNoYW5nZSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIG9uVmF1bHRGb2xkZXJDaGFuZ2UpKTtcblxuICAvLyBLbGljayBhdWYgZGVuIE5hbWVuIHNlbGJzdCBibGVpYnQgdW5hbmdldGFzdGV0ICh6LiBCLiBGb2xkZXIgTm90ZXMgXHUwMEY2ZmZuZXQgZG9ydFxuICAvLyB3aWUgZ2V3b2hudCBkaWUgenVnZWhcdTAwRjZyaWdlIE5vdGl6KS4gS2xpY2sgZGFuZWJlbiAoTGVlcnJhdW0gZGVyIFRpdGVsemVpbGUpXG4gIC8vIHVudGVyZHJcdTAwRkNja3QgbnVyIGRhcyBBdWYtL1p1a2xhcHBlbjsgY2FwdHVyZTp0cnVlIHJlaWNodCBkYWZcdTAwRkNyLCB3ZWlsIGRpZVxuICAvLyBDYXB0dXJlLVBoYXNlIE9ic2lkaWFucyBlaWdlbmVtIFRvZ2dsZS1IYW5kbGVyIGFtIEVsZW1lbnQgaW1tZXIgdm9yYXVzZ2VodC5cbiAgY29uc3Qgb25DbGlja0NhcHR1cmUgPSAoZXZ0KSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJzRW5hYmxlZCkgcmV0dXJuO1xuICAgIGNvbnN0IHRpdGxlRWwgPSBldnQudGFyZ2V0LmNsb3Nlc3QoXCIubmF2LWZvbGRlci10aXRsZVwiKTtcbiAgICBpZiAoIWlzRGF0YWJhc2VGb2xkZXJUaXRsZSh0aXRsZUVsLCBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgpKSByZXR1cm47XG5cbiAgICBjb25zdCBuYW1lRWwgPSB0aXRsZUVsLnF1ZXJ5U2VsZWN0b3IoXCIubmF2LWZvbGRlci10aXRsZS1jb250ZW50XCIpO1xuICAgIGlmIChuYW1lRWwgJiYgbmFtZUVsLmNvbnRhaW5zKGV2dC50YXJnZXQpKSByZXR1cm47XG5cbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICBpZiAocGx1Z2luLnNldHRpbmdzLmZvbGRlck5vdGVDbGlja0V4dGVuc2lvbkVuYWJsZWQgJiYgbmFtZUVsKSB7XG4gICAgICBuYW1lRWwuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgbmV3IE1vdXNlRXZlbnQoXCJjbGlja1wiLCB7XG4gICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICBjYW5jZWxhYmxlOiB0cnVlLFxuICAgICAgICAgIGN0cmxLZXk6IGV2dC5jdHJsS2V5LFxuICAgICAgICAgIG1ldGFLZXk6IGV2dC5tZXRhS2V5LFxuICAgICAgICAgIHNoaWZ0S2V5OiBldnQuc2hpZnRLZXksXG4gICAgICAgICAgYWx0S2V5OiBldnQuYWx0S2V5LFxuICAgICAgICAgIGJ1dHRvbjogZXZ0LmJ1dHRvbixcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICB9O1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgb25DbGlja0NhcHR1cmUsIHRydWUpO1xuXG4gIHBsdWdpbi5yZWdpc3RlcigoKSA9PiB7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIG9uQ2xpY2tDYXB0dXJlLCB0cnVlKTtcbiAgICBmb3IgKGNvbnN0IG5hdkZvbGRlciBvZiB3YXRjaGVkRm9sZGVycy52YWx1ZXMoKSkge1xuICAgICAgcmVtb3ZlRm9sZGVyQmFkZ2UobmF2Rm9sZGVyKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHBhdGNoZWRJdGVtcykge1xuICAgICAgaWYgKGl0ZW0uX19mcmVkU2V0Q29sbGFwc2VkT3JpZ2luYWwpIHtcbiAgICAgICAgaXRlbS5zZXRDb2xsYXBzZWQgPSBpdGVtLl9fZnJlZFNldENvbGxhcHNlZE9yaWdpbmFsO1xuICAgICAgICBkZWxldGUgaXRlbS5fX2ZyZWRTZXRDb2xsYXBzZWRPcmlnaW5hbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcGF0Y2hlZEl0ZW1zLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCB2aWV3IG9mIHBhdGNoZWRWaWV3cykge1xuICAgICAgaWYgKHZpZXcuX19mcmVkUmV2ZWFsT3JpZ2luYWwpIHtcbiAgICAgICAgdmlldy5yZXZlYWxJbkZvbGRlciA9IHZpZXcuX19mcmVkUmV2ZWFsT3JpZ2luYWw7XG4gICAgICAgIGRlbGV0ZSB2aWV3Ll9fZnJlZFJldmVhbE9yaWdpbmFsO1xuICAgICAgfVxuICAgICAgaWYgKHZpZXcuX19mcmVkUmV2ZWFsQWN0aXZlT3JpZ2luYWwpIHtcbiAgICAgICAgdmlldy5yZXZlYWxBY3RpdmVGaWxlID0gdmlldy5fX2ZyZWRSZXZlYWxBY3RpdmVPcmlnaW5hbDtcbiAgICAgICAgZGVsZXRlIHZpZXcuX19mcmVkUmV2ZWFsQWN0aXZlT3JpZ2luYWw7XG4gICAgICB9XG4gICAgfVxuICAgIHBhdGNoZWRWaWV3cy5jbGVhcigpO1xuICAgIGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgY29udGFpbmVyT2JzZXJ2ZXJzLnZhbHVlcygpKSBvYnNlcnZlci5kaXNjb25uZWN0KCk7XG4gICAgY29udGFpbmVyT2JzZXJ2ZXJzLmNsZWFyKCk7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5mcmVkLWRiLWZvbGRlclwiKS5mb3JFYWNoKChlbCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZShcImZyZWQtZGItZm9sZGVyXCIpKTtcbiAgICBzdHlsZUVsLnJlbW92ZSgpO1xuICB9KTtcblxuICBjb25zdCB1cGRhdGVTdHlsZSA9ICgpID0+IHtcbiAgICBzdHlsZUVsLnRleHRDb250ZW50ID0gcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyc0VuYWJsZWRcbiAgICAgID8gYnVpbGRTdHlsZShcbiAgICAgICAgICBwbHVnaW4uc2V0dGluZ3MuZGF0YWJhc2VGb2xkZXJQcmVmaXgsXG4gICAgICAgICAgcGx1Z2luLnNldHRpbmdzLmZvbGRlck5vdGVDbGlja0V4dGVuc2lvbkVuYWJsZWQsXG4gICAgICAgICAgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyQ291bnRBdEVuZFxuICAgICAgICApXG4gICAgICA6IFwiXCI7XG4gICAgcmVmcmVzaFdhdGNoZWRGb2xkZXJzKCk7XG4gIH07XG5cbiAgLy8gU2V0enQgZGVuIEF1Zi0vWnVnZWtsYXBwdC1adXN0YW5kIGVpbmVzIGVpbnplbG5lbiBEYXRlbmJhbmstT3JkbmVycyAtIGZcdTAwRkNyXG4gIC8vIHRvZ2dsZURhdGFiYXNlRm9sZGVyIHVudGVuLiBtYW51YWxseU9wZW5QYXRocyB3aXJkIFZPUiBkZW0gZWlnZW50bGljaGVuXG4gIC8vIEF1ZnJ1ZiBha3R1YWxpc2llcnQsIHdlaWwgcGF0Y2hGb2xkZXJJdGVtKCkgb2JlbiBnZW5hdSBkb3J0IG5hY2hzaWVodCwgb2JcbiAgLy8gZWluIEV4cGFuZC1WZXJzdWNoIGVybGF1YnQgaXN0LlxuICBjb25zdCBzZXRGb2xkZXJPcGVuID0gKHBhdGgsIG9wZW4pID0+IHtcbiAgICBpZiAob3BlbikgbWFudWFsbHlPcGVuUGF0aHMuYWRkKHBhdGgpO1xuICAgIGVsc2UgbWFudWFsbHlPcGVuUGF0aHMuZGVsZXRlKHBhdGgpO1xuXG4gICAgY29uc3QgdmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImZpbGUtZXhwbG9yZXJcIilbMF0/LnZpZXc7XG4gICAgdmlldz8uZmlsZUl0ZW1zPy5bcGF0aF0/LnNldENvbGxhcHNlZCghb3BlbiwgdHJ1ZSk7XG4gIH07XG5cbiAgLy8gRlx1MDBGQ3IgZGVuIEJlZmVobDogRGF0ZWktRXhwbG9yZXIgenVtIGdld1x1MDBFNGhsdGVuIE9yZG5lciBzY3JvbGxlbiAoa2xhcHB0IGRhZlx1MDBGQ3JcbiAgLy8gZGVzc2VuIEVsdGVybm9yZG5lciBhdWYsIHNvZmVybiBuXHUwMEY2dGlnKSAtIHVudmVyXHUwMEU0bmRlcnRlcyBuYXRpdmVzXG4gIC8vIHJldmVhbEluRm9sZGVyLCBiZXRyaWZmdCBudXIgZGllIEFobmVub3JkbmVyLCBuaWNodCBkZW4gT3JkbmVyIHNlbGJzdC5cbiAgY29uc3QgcmV2ZWFsRGF0YWJhc2VGb2xkZXIgPSAoZm9sZGVyKSA9PiB7XG4gICAgY29uc3QgbGVhZiA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImZpbGUtZXhwbG9yZXJcIilbMF07XG4gICAgbGVhZj8udmlldz8ucmV2ZWFsSW5Gb2xkZXI/Lihmb2xkZXIpO1xuICB9O1xuXG4gIC8vIEJlZmVobCBcIkRhdGVuYmFuay1PcmRuZXIgXHUwMEY2ZmZuZW4vc2NobGllXHUwMERGZW5cIjogbFx1MDBFNHNzdCBlaW5lbiBEYXRlbmJhbmstT3JkbmVyXG4gIC8vIGF1cyBlaW5lciBGdXp6eS1MaXN0ZSB3XHUwMEU0aGxlbiB1bmQga2VocnQgZGVzc2VuIFp1c3RhbmQgdW0uIERlciByZWd1bFx1MDBFNHJlXG4gIC8vIEtsaWNrIGF1ZiBlaW5lbiBEYXRlbmJhbmstT3JkbmVyIGJsZWlidCBiZXd1c3N0IHdlaXRlciBibG9ja2llcnQgKHNpZWhlXG4gIC8vIG9uQ2xpY2tDYXB0dXJlIG9iZW4pIC0gZGllc2VyIEJlZmVobCBpc3QgZGVyIGVpbnppZ2UgV2VnLCBlaW5lbiBlaW56ZWxuZW5cbiAgLy8gRGF0ZW5iYW5rLU9yZG5lciBnZXppZWx0IGF1Zi0venV6dWtsYXBwZW4uXG4gIHBsdWdpbi50b2dnbGVEYXRhYmFzZUZvbGRlciA9ICgpID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5kYXRhYmFzZUZvbGRlcnNFbmFibGVkKSB7XG4gICAgICBuZXcgTm90aWNlKFwiRGF0ZW5iYW5rLU9yZG5lciBzaW5kIGRlYWt0aXZpZXJ0LlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZm9sZGVycyA9IGNvbGxlY3REYXRhYmFzZUZvbGRlcnMocGx1Z2luLmFwcCwgcGx1Z2luLnNldHRpbmdzLmRhdGFiYXNlRm9sZGVyUHJlZml4KTtcbiAgICBpZiAoZm9sZGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJLZWluZSBEYXRlbmJhbmstT3JkbmVyIHZvcmhhbmRlbi5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIG5ldyBEYXRhYmFzZUZvbGRlclBpY2tlck1vZGFsKHBsdWdpbi5hcHAsIGZvbGRlcnMsIG1hbnVhbGx5T3BlblBhdGhzLCAoZm9sZGVyKSA9PiB7XG4gICAgICBpZiAoIWZvbGRlcikgcmV0dXJuO1xuICAgICAgY29uc3Qgd2FzT3BlbiA9IG1hbnVhbGx5T3BlblBhdGhzLmhhcyhmb2xkZXIucGF0aCk7XG4gICAgICBzZXRGb2xkZXJPcGVuKGZvbGRlci5wYXRoLCAhd2FzT3Blbik7XG4gICAgICBpZiAoIXdhc09wZW4pIHJldmVhbERhdGFiYXNlRm9sZGVyKGZvbGRlcik7XG4gICAgfSkub3BlbigpO1xuICB9O1xuXG4gIHVwZGF0ZVN0eWxlKCk7XG4gIHJldHVybiB1cGRhdGVTdHlsZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzIH07XG4iLCAiY29uc3QgeyBURmlsZSB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFZlcnNjaGFjaHRlbHRlIENoZWNrYm94ZW5cbiAqIEJlaW0gKEVudClIYWtlbiBlaW5lciBDaGVja2JveCB3ZXJkZW4gYXV0b21hdGlzY2ggYWxsZSBkYXJ1bnRlclxuICogdmVyc2NoYWNodGVsdGVuIENoZWNrYm94ZW4gbWl0IChlbnQpaGFrdCAoS2Fza2FkZSBuYWNoIHVudGVuKSAtXG4gKiB1bmQgdW1nZWtlaHJ0OiBzb2JhbGQgYWxsZSBkaXJla3RlbiBDaGVja2JveC1LaW5kZXIgZWluZXNcbiAqIEVsdGVybi1FbGVtZW50cyBhbmdlaGFrdCBzaW5kLCB3aXJkIGF1Y2ggZGFzIEVsdGVybi1FbGVtZW50XG4gKiBhbmdlaGFrdCwgdW5kIHdpZWRlciBlbnRmZXJudCwgc29iYWxkIGVpbmVzIHNlaW5lciBLaW5kZXIgd2llZGVyXG4gKiBhYmdlaGFrdCB3aXJkIChCdWJibGUtdXAsIHJla3Vyc2l2IGJpcyB6dXIgV3VyemVsKS5cbiAqXG4gKiBFcmtlbm51bmcgcGVyIERpZmYgZ2VnZW4gZGVuIHp1bGV0enQgZ2VzZWhlbmVuIEluaGFsdCBkZXIgRGF0ZWlcbiAqIChuaWNodCBwZXIgS2xpY2stSW50ZXJjZXB0aW9uKTogZnVua3Rpb25pZXJ0IGRhZHVyY2ggdW5hYmhcdTAwRTRuZ2lnXG4gKiBkYXZvbiwgb2IgZGllIENoZWNrYm94IGluIGRlciBSZWFkaW5nIFZpZXcgb2RlciBpbiBkZXIgTGl2ZVxuICogUHJldmlldyBhbmdla2xpY2t0IHd1cmRlLCBvaG5lIGF1ZiBPYnNpZGlhbnMgdW5kb2t1bWVudGllcnRlXG4gKiBSZW5kZXItSW50ZXJuYSBhbmdld2llc2VuIHp1IHNlaW4uIEF1c2dlbFx1MDBGNnN0IHdpcmQgbnVyLCB3ZW5uIHNpY2hcbiAqIGR1cmNoIGRpZSBcdTAwQzRuZGVydW5nIGdlbmF1IGVpbmUgWmVpbGUgdW50ZXJzY2hlaWRldCB1bmQgZGllc2UgZWluZVxuICogQ2hlY2tib3ggbWl0IHVudmVyXHUwMEU0bmRlcnRlciBFaW5yXHUwMEZDY2t1bmcgaXN0LCBkZXJlbiBIYWtlbi1adXN0YW5kXG4gKiBzaWNoIGdlXHUwMEU0bmRlcnQgaGF0IC0gYWxsZXMgYW5kZXJlIChNZWhyZmFjaFx1MDBFNG5kZXJ1bmdlbiwgVGlwcGVuLFxuICogRWluLS9BdXNyXHUwMEZDY2tlbiwgZXRjLikgYmxlaWJ0IHVuYW5nZXRhc3RldC5cbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jb25zdCBDSEVDS0JPWF9MSU5FX1JFID0gL14oXFxzKikoPzpbLSorXXxcXGQrWy4pXSlcXHMrXFxbKC4pXFxdLztcblxuZnVuY3Rpb24gcGFyc2VDaGVja2JveExpbmUobGluZSkge1xuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goQ0hFQ0tCT1hfTElORV9SRSk7XG4gIHJldHVybiBtYXRjaCA/IHsgaW5kZW50OiBtYXRjaFsxXS5sZW5ndGgsIGNoYXI6IG1hdGNoWzJdIH0gOiBudWxsO1xufVxuXG4vLyBudWxsIGZcdTAwRkNyIGxlZXJlL251ci1MZWVyemVpY2hlbi1aZWlsZW4sIGRhIHNpZSBmXHUwMEZDciBkaWUgVmVyc2NoYWNodGVsdW5nc3RpZWZlIG5pY2h0IHpcdTAwRTRobGVuLlxuZnVuY3Rpb24gaW5kZW50T2YobGluZSkge1xuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL14oXFxzKilcXFMvKTtcbiAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0ubGVuZ3RoIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNDaGVja2VkKGNoYXIpIHtcbiAgcmV0dXJuIGNoYXIgIT09IFwiIFwiO1xufVxuXG5mdW5jdGlvbiBzZXRDaGVja2JveENoYXIobGluZSwgbmV3Q2hhcikge1xuICByZXR1cm4gbGluZS5yZXBsYWNlKENIRUNLQk9YX0xJTkVfUkUsICh3aG9sZSkgPT4gd2hvbGUuc2xpY2UoMCwgLTIpICsgbmV3Q2hhciArIFwiXVwiKTtcbn1cblxuLy8gTGllZmVydCBkaWUgWmVpbGVuIG1pdCBhbmdld2VuZGV0ZXIgS2Fza2FkZSwgb2RlciBudWxsLCB3ZW5uIHNpY2ggbmljaHRzIFx1MDBFNG5kZXJ0LlxuZnVuY3Rpb24gY29tcHV0ZUNhc2NhZGUobGluZXMsIHRvZ2dsZWRJbmRleCkge1xuICBjb25zdCB0b2dnbGVkID0gcGFyc2VDaGVja2JveExpbmUobGluZXNbdG9nZ2xlZEluZGV4XSk7XG4gIGlmICghdG9nZ2xlZCkgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgcmVzdWx0ID0gbGluZXMuc2xpY2UoKTtcbiAgbGV0IHRvdWNoZWQgPSBmYWxzZTtcbiAgY29uc3Qgbm93Q2hlY2tlZCA9IGlzQ2hlY2tlZCh0b2dnbGVkLmNoYXIpO1xuICBjb25zdCBuZXdDaGFyID0gbm93Q2hlY2tlZCA/IFwieFwiIDogXCIgXCI7XG5cbiAgLy8gTmFjaCB1bnRlbjogYWxsZSB2ZXJzY2hhY2h0ZWx0ZW4gQ2hlY2tib3hlbiBhdWYgZGVuc2VsYmVuIFp1c3RhbmQgYnJpbmdlbi5cbiAgZm9yIChsZXQgaSA9IHRvZ2dsZWRJbmRleCArIDE7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpbmQgPSBpbmRlbnRPZihyZXN1bHRbaV0pO1xuICAgIGlmIChpbmQgIT09IG51bGwgJiYgaW5kIDw9IHRvZ2dsZWQuaW5kZW50KSBicmVhaztcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUNoZWNrYm94TGluZShyZXN1bHRbaV0pO1xuICAgIGlmIChwYXJzZWQgJiYgaXNDaGVja2VkKHBhcnNlZC5jaGFyKSAhPT0gbm93Q2hlY2tlZCkge1xuICAgICAgcmVzdWx0W2ldID0gc2V0Q2hlY2tib3hDaGFyKHJlc3VsdFtpXSwgbmV3Q2hhcik7XG4gICAgICB0b3VjaGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBOYWNoIG9iZW46IEVsdGVybi1DaGVja2JveGVuIGFuaGFuZCBpaHJlciBkaXJla3RlbiBLaW5kZXIgbmV1IGJld2VydGVuLFxuICAvLyByZWt1cnNpdiB3ZWl0ZXIgbmFjaCBvYmVuLCBzb2xhbmdlIHNpY2ggZGFkdXJjaCB0YXRzXHUwMEU0Y2hsaWNoIGV0d2FzIFx1MDBFNG5kZXJ0LlxuICBsZXQgY2hpbGRJbmRlbnQgPSB0b2dnbGVkLmluZGVudDtcbiAgbGV0IGN1cnNvciA9IHRvZ2dsZWRJbmRleDtcbiAgZm9yICg7Oykge1xuICAgIGxldCBwYXJlbnRJbmRleCA9IC0xO1xuICAgIGZvciAobGV0IGkgPSBjdXJzb3IgLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgaW5kID0gaW5kZW50T2YocmVzdWx0W2ldKTtcbiAgICAgIGlmIChpbmQgPT09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgaWYgKGluZCA8IGNoaWxkSW5kZW50KSB7XG4gICAgICAgIHBhcmVudEluZGV4ID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwYXJlbnRJbmRleCA9PT0gLTEpIGJyZWFrO1xuXG4gICAgY29uc3QgcGFyZW50ID0gcGFyc2VDaGVja2JveExpbmUocmVzdWx0W3BhcmVudEluZGV4XSk7XG4gICAgaWYgKCFwYXJlbnQpIGJyZWFrOyAvLyBFbHRlcm4tRWxlbWVudCBpc3Qga2VpbmUgQ2hlY2tib3ggLT4gaGllciBlbmRldCBkYXMgSG9jaGJsdWJiZXJuLlxuXG4gICAgbGV0IGRpcmVjdENoaWxkSW5kZW50ID0gbnVsbDtcbiAgICBsZXQgaGFzQ2hlY2tib3hDaGlsZCA9IGZhbHNlO1xuICAgIGxldCBhbGxDaGVja2VkID0gdHJ1ZTtcbiAgICBmb3IgKGxldCBpID0gcGFyZW50SW5kZXggKyAxOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpbmQgPSBpbmRlbnRPZihyZXN1bHRbaV0pO1xuICAgICAgaWYgKGluZCA9PT0gbnVsbCkgY29udGludWU7XG4gICAgICBpZiAoaW5kIDw9IHBhcmVudC5pbmRlbnQpIGJyZWFrO1xuICAgICAgaWYgKGRpcmVjdENoaWxkSW5kZW50ID09PSBudWxsKSBkaXJlY3RDaGlsZEluZGVudCA9IGluZDtcbiAgICAgIGlmIChpbmQgIT09IGRpcmVjdENoaWxkSW5kZW50KSBjb250aW51ZTsgLy8gdGllZmVyIHZlcnNjaGFjaHRlbHRlcyBFbmtlbGtpbmQsIGhpZXIgaXJyZWxldmFudC5cbiAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQ2hlY2tib3hMaW5lKHJlc3VsdFtpXSk7XG4gICAgICBpZiAoIXBhcnNlZCkgY29udGludWU7XG4gICAgICBoYXNDaGVja2JveENoaWxkID0gdHJ1ZTtcbiAgICAgIGlmICghaXNDaGVja2VkKHBhcnNlZC5jaGFyKSkgYWxsQ2hlY2tlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICghaGFzQ2hlY2tib3hDaGlsZCkgYnJlYWs7XG4gICAgaWYgKGlzQ2hlY2tlZChwYXJlbnQuY2hhcikgPT09IGFsbENoZWNrZWQpIGJyZWFrOyAvLyBzY2hvbiBpbSByaWNodGlnZW4gWnVzdGFuZCAtPiB3ZWl0ZXIgb2JlbiBcdTAwRTRuZGVydCBzaWNoIG5pY2h0cyBtZWhyLlxuXG4gICAgcmVzdWx0W3BhcmVudEluZGV4XSA9IHNldENoZWNrYm94Q2hhcihyZXN1bHRbcGFyZW50SW5kZXhdLCBhbGxDaGVja2VkID8gXCJ4XCIgOiBcIiBcIik7XG4gICAgdG91Y2hlZCA9IHRydWU7XG4gICAgY2hpbGRJbmRlbnQgPSBwYXJlbnQuaW5kZW50O1xuICAgIGN1cnNvciA9IHBhcmVudEluZGV4O1xuICB9XG5cbiAgcmV0dXJuIHRvdWNoZWQgPyByZXN1bHQgOiBudWxsO1xufVxuXG4vLyBFcmtlbm50IGVpbiBlaW5mYWNoZXMgVW1zY2hhbHRlbiAoZ2VuYXUgZWluZSBDaGVja2JveC1aZWlsZSBtaXQgdW52ZXJcdTAwRTRuZGVydGVyXG4vLyBFaW5yXHUwMEZDY2t1bmcsIGRlcmVuIEhha2VuLVp1c3RhbmQgc2ljaCBnZVx1MDBFNG5kZXJ0IGhhdCkgendpc2NoZW4gendlaSBUZXh0c3RcdTAwRTRuZGVuXG4vLyBnbGVpY2hlciBaZWlsZW56YWhsLCBzb25zdCAtMSAoTWVocmZhY2hcdTAwRTRuZGVydW5nLCBUaXBwZW4sIEVpbi0vQXVzclx1MDBGQ2NrZW4gZXRjLikuXG5mdW5jdGlvbiBkZXRlY3RUb2dnbGUocHJldlRleHQsIG5ld1RleHQpIHtcbiAgaWYgKHByZXZUZXh0ID09PSB1bmRlZmluZWQgfHwgcHJldlRleHQgPT09IG5ld1RleHQpIHJldHVybiAtMTtcbiAgY29uc3Qgb2xkTGluZXMgPSBwcmV2VGV4dC5zcGxpdChcIlxcblwiKTtcbiAgY29uc3QgbmV3TGluZXMgPSBuZXdUZXh0LnNwbGl0KFwiXFxuXCIpO1xuICBpZiAob2xkTGluZXMubGVuZ3RoICE9PSBuZXdMaW5lcy5sZW5ndGgpIHJldHVybiAtMTtcblxuICBsZXQgY2hhbmdlZEluZGV4ID0gLTE7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkTGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAob2xkTGluZXNbaV0gIT09IG5ld0xpbmVzW2ldKSB7XG4gICAgICBpZiAoY2hhbmdlZEluZGV4ICE9PSAtMSkgcmV0dXJuIC0xO1xuICAgICAgY2hhbmdlZEluZGV4ID0gaTtcbiAgICB9XG4gIH1cbiAgaWYgKGNoYW5nZWRJbmRleCA9PT0gLTEpIHJldHVybiAtMTtcblxuICBjb25zdCBiZWZvcmUgPSBwYXJzZUNoZWNrYm94TGluZShvbGRMaW5lc1tjaGFuZ2VkSW5kZXhdKTtcbiAgY29uc3QgYWZ0ZXIgPSBwYXJzZUNoZWNrYm94TGluZShuZXdMaW5lc1tjaGFuZ2VkSW5kZXhdKTtcbiAgaWYgKCFiZWZvcmUgfHwgIWFmdGVyIHx8IGJlZm9yZS5pbmRlbnQgIT09IGFmdGVyLmluZGVudCkgcmV0dXJuIC0xO1xuICBpZiAoaXNDaGVja2VkKGJlZm9yZS5jaGFyKSA9PT0gaXNDaGVja2VkKGFmdGVyLmNoYXIpKSByZXR1cm4gLTE7XG4gIHJldHVybiBjaGFuZ2VkSW5kZXg7XG59XG5cbi8vIFp3ZWkgdW5hYmhcdTAwRTRuZ2lnZSBFcmtlbm51bmdzd2VnZSwgZGEgT2JzaWRpYW4gQ2hlY2tib3gtS2xpY2tzIGplIG5hY2ggQW5zaWNodFxuLy8gdW50ZXJzY2hpZWRsaWNoIHBlcnNpc3RpZXJ0OlxuLy8gLSBSZWFkaW5nIFZpZXcgc3BlaWNoZXJ0IHNvZm9ydCAobFx1MDBGNnN0IFwidmF1bHQgbW9kaWZ5XCIgZGlyZWt0IGF1cykuXG4vLyAtIExpdmUgUHJldmlldy9Tb3VyY2UtTW9kdXMgXHUwMEU0bmRlcnQgenVuXHUwMEU0Y2hzdCBudXIgZGVuIEVkaXRvci1QdWZmZXI7IGRhc1xuLy8gICB0YXRzXHUwMEU0Y2hsaWNoZSBTY2hyZWliZW4gYXVmIGRpZSBGZXN0cGxhdHRlICh1bmQgZGFtaXQgXCJ2YXVsdCBtb2RpZnlcIikgaXN0XG4vLyAgIHVtIDJzIGRlYm91bmNlZCAoT2JzaWRpYW5zIGVpZ2VuZXIgQXV0b3NhdmUpIC0gdmllbCB6dSBzcFx1MDBFNHQgZlx1MDBGQ3IgZWluZVxuLy8gICBLYXNrYWRlLCBkaWUgc2ljaCB3aWUgZWluIGVpbnplbG5lciwgdW51bnRlcmJyb2NoZW5lciBLbGljayBhbmZcdTAwRkNobGVuIHNvbGwuXG4vLyAgIERhZlx1MDBGQ3IgZmV1ZXJ0IFwiZWRpdG9yLWNoYW5nZVwiIHN5bmNocm9uIGJlaSBqZWRlciBFZGl0b3ItXHUwMEM0bmRlcnVuZyB1bmQgbGllc3Rcbi8vICAgZGlyZWt0IGF1cyBkZW0gRWRpdG9yLVB1ZmZlciBzdGF0dCB2b24gZGVyIEZlc3RwbGF0dGUuXG4vLyBCZWlkZSBXZWdlIHRlaWxlbiBzaWNoIGRlbnNlbGJlbiBsYXN0Q29udGVudC1DYWNoZSwgZGFtaXQgZGVyIGpld2VpbHMgYW5kZXJlXG4vLyBXZWcgZWluZSBiZXJlaXRzIHZlcmFyYmVpdGV0ZSBcdTAwQzRuZGVydW5nIG5pY2h0IGVpbiB6d2VpdGVzIE1hbCBhdWZncmVpZnQuXG4vLyBFaW4gQ2hlY2tib3gtS2xpY2sga2FubiBudXIgaW4gZWluZXIgZ2VyYWRlIG9mZmVuZW4gQW5zaWNodCBwYXNzaWVyZW4gLVxuLy8gSGludGVyZ3J1bmQtU3BlaWNoZXJ1bmdlbiBuaWNodCBhbmdlemVpZ3RlciBOb3RpemVuICh6LiBCLiBkdXJjaCBhbmRlcmVcbi8vIFBsdWdpbnMpIG1cdTAwRkNzc2VuIHdpciBkYWhlciB3ZWRlciB2ZXJmb2xnZW4gbm9jaCBjYWNoZW4uXG5mdW5jdGlvbiBpc0ZpbGVPcGVuKHBsdWdpbiwgcGF0aCkge1xuICByZXR1cm4gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikuc29tZSgobGVhZikgPT4gbGVhZi52aWV3Py5maWxlPy5wYXRoID09PSBwYXRoKTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmMocGx1Z2luKSB7XG4gIGNvbnN0IGxhc3RDb250ZW50ID0gbmV3IE1hcCgpOyAvLyBQZmFkIC0+IHp1bGV0enQgZ2VzZWhlbmVyIEluaGFsdCwgbnVyIGZcdTAwRkNyIGdlcmFkZSBvZmZlbmUgTm90aXplblxuICBjb25zdCBhcHBseWluZyA9IG5ldyBTZXQoKTsgLy8gUGZhZGUsIGZcdTAwRkNyIGRpZSBnZXJhZGUgc2VsYnN0IGVpbmUgS2Fza2FkZSBnZXNjaHJpZWJlbiB3aXJkIChFY2hvL1JlZW50cmFueiBpZ25vcmllcmVuKVxuXG4gIGNvbnN0IGZvcmdldCA9IChwYXRoKSA9PiB7XG4gICAgbGFzdENvbnRlbnQuZGVsZXRlKHBhdGgpO1xuICAgIGFwcGx5aW5nLmRlbGV0ZShwYXRoKTtcbiAgfTtcblxuICAvLyBSXHUwMEU0dW10IGJlaW0gXHUwMEQ2ZmZuZW4gZWluZXIgTm90aXogbmViZW5iZWkgRWludHJcdTAwRTRnZSBmXHUwMEZDciBpbnp3aXNjaGVuIGdlc2NobG9zc2VuZVxuICAvLyBUYWJzIHdlZywgc3RhdHQgbGFzdENvbnRlbnQgXHUwMEZDYmVyIGRpZSBnYW56ZSBTZXNzaW9uIHVuYmVncmVuenQgd2FjaHNlbiB6dSBsYXNzZW4uXG4gIGNvbnN0IHBydW5lQ2xvc2VkRmlsZXMgPSAoKSA9PiB7XG4gICAgaWYgKGxhc3RDb250ZW50LnNpemUgPT09IDApIHJldHVybjtcbiAgICBjb25zdCBvcGVuUGF0aHMgPSBuZXcgU2V0KFxuICAgICAgcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikubWFwKChsZWFmKSA9PiBsZWFmLnZpZXc/LmZpbGU/LnBhdGgpLmZpbHRlcihCb29sZWFuKVxuICAgICk7XG4gICAgZm9yIChjb25zdCBwYXRoIG9mIGxhc3RDb250ZW50LmtleXMoKSkge1xuICAgICAgaWYgKCFvcGVuUGF0aHMuaGFzKHBhdGgpKSBsYXN0Q29udGVudC5kZWxldGUocGF0aCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHNlZWQgPSBhc3luYyAoZmlsZSkgPT4ge1xuICAgIGlmICghcGx1Z2luLnNldHRpbmdzLm5lc3RlZENoZWNrYm94U3luY0VuYWJsZWQpIHJldHVybjtcbiAgICBwcnVuZUNsb3NlZEZpbGVzKCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgaWYgKGxhc3RDb250ZW50LmhhcyhmaWxlLnBhdGgpKSByZXR1cm47XG4gICAgbGFzdENvbnRlbnQuc2V0KGZpbGUucGF0aCwgYXdhaXQgcGx1Z2luLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVWYXVsdE1vZGlmeSA9IGFzeW5jIChmaWxlKSA9PiB7XG4gICAgaWYgKCFwbHVnaW4uc2V0dGluZ3MubmVzdGVkQ2hlY2tib3hTeW5jRW5hYmxlZCkgcmV0dXJuO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikgcmV0dXJuO1xuICAgIGlmIChhcHBseWluZy5oYXMoZmlsZS5wYXRoKSkgcmV0dXJuO1xuICAgIGlmICghaXNGaWxlT3BlbihwbHVnaW4sIGZpbGUucGF0aCkpIHJldHVybjsgLy8ga2VpbiBDaGVja2JveC1LbGljayBtXHUwMEY2Z2xpY2ggLT4gbmljaHRzIHp1IHR1blxuXG4gICAgY29uc3QgbmV3VGV4dCA9IGF3YWl0IHBsdWdpbi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcbiAgICBjb25zdCBwcmV2VGV4dCA9IGxhc3RDb250ZW50LmdldChmaWxlLnBhdGgpO1xuICAgIGxhc3RDb250ZW50LnNldChmaWxlLnBhdGgsIG5ld1RleHQpO1xuXG4gICAgY29uc3QgaWR4ID0gZGV0ZWN0VG9nZ2xlKHByZXZUZXh0LCBuZXdUZXh0KTtcbiAgICBpZiAoaWR4ID09PSAtMSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbmV3TGluZXMgPSBuZXdUZXh0LnNwbGl0KFwiXFxuXCIpO1xuICAgIGNvbnN0IGNhc2NhZGVkID0gY29tcHV0ZUNhc2NhZGUobmV3TGluZXMsIGlkeCk7XG4gICAgaWYgKCFjYXNjYWRlZCkgcmV0dXJuO1xuICAgIGNvbnN0IGZpbmFsVGV4dCA9IGNhc2NhZGVkLmpvaW4oXCJcXG5cIik7XG5cbiAgICBhcHBseWluZy5hZGQoZmlsZS5wYXRoKTtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBmaW5hbFRleHQpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBwbHVnaW4uYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKCkgPT4gZmluYWxUZXh0KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgYXBwbHlpbmcuZGVsZXRlKGZpbGUucGF0aCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUVkaXRvckNoYW5nZSA9IChlZGl0b3IsIGluZm8pID0+IHtcbiAgICBpZiAoIXBsdWdpbi5zZXR0aW5ncy5uZXN0ZWRDaGVja2JveFN5bmNFbmFibGVkKSByZXR1cm47XG4gICAgY29uc3QgZmlsZSA9IGluZm8/LmZpbGU7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm47XG4gICAgaWYgKGFwcGx5aW5nLmhhcyhmaWxlLnBhdGgpKSByZXR1cm47XG5cbiAgICBjb25zdCBuZXdUZXh0ID0gZWRpdG9yLmdldFZhbHVlKCk7XG4gICAgY29uc3QgcHJldlRleHQgPSBsYXN0Q29udGVudC5nZXQoZmlsZS5wYXRoKTtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBuZXdUZXh0KTtcblxuICAgIGNvbnN0IGlkeCA9IGRldGVjdFRvZ2dsZShwcmV2VGV4dCwgbmV3VGV4dCk7XG4gICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0xpbmVzID0gbmV3VGV4dC5zcGxpdChcIlxcblwiKTtcbiAgICBjb25zdCBjYXNjYWRlZCA9IGNvbXB1dGVDYXNjYWRlKG5ld0xpbmVzLCBpZHgpO1xuICAgIGlmICghY2FzY2FkZWQpIHJldHVybjtcblxuICAgIC8vIE51ciBkaWUgdGF0c1x1MDBFNGNobGljaCBhYndlaWNoZW5kZW4gWmVpbGVuIGVyc2V0emVuIChkaWUgdW1nZXNjaGFsdGV0ZSBaZWlsZVxuICAgIC8vIHNlbGJzdCBpc3QgYmVyZWl0cyBhbmdld2VuZGV0KSAtIGFscyBlaW5lIGdlbWVpbnNhbWUgVHJhbnNha3Rpb24sIGRhbWl0XG4gICAgLy8gQ3Vyc29yL1VuZG8tSGlzdG9yaWUgc2F1YmVyIGJsZWliZW4gdW5kIG5pY2h0IG1laHJmYWNoIHJlZW50cmFudCBnZWZldWVydCB3aXJkLlxuICAgIGNvbnN0IGNoYW5nZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhc2NhZGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoaSA9PT0gaWR4IHx8IGNhc2NhZGVkW2ldID09PSBuZXdMaW5lc1tpXSkgY29udGludWU7XG4gICAgICBjaGFuZ2VzLnB1c2goeyBmcm9tOiB7IGxpbmU6IGksIGNoOiAwIH0sIHRvOiB7IGxpbmU6IGksIGNoOiBuZXdMaW5lc1tpXS5sZW5ndGggfSwgdGV4dDogY2FzY2FkZWRbaV0gfSk7XG4gICAgfVxuICAgIGlmIChjaGFuZ2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZmluYWxUZXh0ID0gY2FzY2FkZWQuam9pbihcIlxcblwiKTtcbiAgICBhcHBseWluZy5hZGQoZmlsZS5wYXRoKTtcbiAgICBsYXN0Q29udGVudC5zZXQoZmlsZS5wYXRoLCBmaW5hbFRleHQpO1xuICAgIHRyeSB7XG4gICAgICBlZGl0b3IudHJhbnNhY3Rpb24oeyBjaGFuZ2VzIH0pO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBhcHBseWluZy5kZWxldGUoZmlsZS5wYXRoKTtcbiAgICB9XG4gIH07XG5cbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcIm1vZGlmeVwiLCBoYW5kbGVWYXVsdE1vZGlmeSkpO1xuICBwbHVnaW4ucmVnaXN0ZXJFdmVudChwbHVnaW4uYXBwLndvcmtzcGFjZS5vbihcImVkaXRvci1jaGFuZ2VcIiwgaGFuZGxlRWRpdG9yQ2hhbmdlKSk7XG4gIHBsdWdpbi5yZWdpc3RlckV2ZW50KHBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHNlZWQpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcImRlbGV0ZVwiLCAoZmlsZSkgPT4gZm9yZ2V0KGZpbGUucGF0aCkpKTtcbiAgcGx1Z2luLnJlZ2lzdGVyRXZlbnQocGx1Z2luLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCAoX2ZpbGUsIG9sZFBhdGgpID0+IGZvcmdldChvbGRQYXRoKSkpO1xuICBwbHVnaW4uYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICBjb25zdCBhY3RpdmUgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgaWYgKGFjdGl2ZSkgc2VlZChhY3RpdmUpO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IHJlZ2lzdGVyTmVzdGVkQ2hlY2tib3hTeW5jLCBjb21wdXRlQ2FzY2FkZSwgcGFyc2VDaGVja2JveExpbmUgfTtcbiIsICJjb25zdCBDT01NQU5EX0lEID0gXCJlZGl0b3I6dG9nZ2xlLWl0YWxpY3NcIjtcblxuLy8gT2JzaWRpYW5zIGVpZ2VuZXIgXCJLdXJzaXZcIi1CZWZlaGwgZlx1MDBGQ2d0IGJlaW0gRWluZlx1MDBGQ2dlbiBuZXVlciBGb3JtYXRpZXJ1bmcgZmVzdFxuLy8gXCIqLi4uKlwiIGVpbiAodWYuaXRhbGljLnN1cnJvdW5kaW5nQ2hhcnMgaW4gT2JzaWRpYW5zIEVkaXRvci1CdW5kbGUpIC0gXCJfXCJcbi8vIHdpcmQgZG9ydCBudXIgYWxzIGFsdFN1cnJvdW5kaW5nQ2hhcnMgenVyIEVSS0VOTlVORy9FTlRGRVJOVU5HIGJlcmVpdHNcbi8vIHZvcmhhbmRlbmVyIEt1cnNpdmZvcm1hdGllcnVuZyBha3plcHRpZXJ0LCBuaWUgYmVpbSBFaW5mXHUwMEZDZ2VuIHZlcndlbmRldC4gdWZcbi8vIHNlbGJzdCBpc3QgVGVpbCBlaW5lcyBwcml2YXRlbiBDbG9zdXJlLU9iamVrdHMgb2huZSBcdTAwRjZmZmVudGxpY2hlbiBadWdyaWZmLFxuLy8gdG9nZ2xlTWFya2Rvd25Gb3JtYXR0aW5nKCkgKEVkaXRvci5wcm90b3R5cGUsIGF1ZmdlcnVmZW4gXHUwMEZDYmVyIGRlbiBuYXRpdmVuXG4vLyBCZWZlaGwpIGFiZXIgZ2VuYXVzbyB3ZW5pZyBcdTAwRkNiZXJzY2hyZWliYmFyLCBvaG5lIE9ic2lkaWFucyBlaWdlbmUgTGlzdGVuLS9cbi8vIFRhYmVsbGVuLS9NZWhyZmFjaGF1c3dhaGwtTG9naWsgbmFjaHp1YmF1ZW4uXG4vL1xuLy8gRGVyIHNjaG1hbHN0ZSBFaW5ncmlmZnNwdW5rdCBsaWVndCBlaW5lIEViZW5lIHRpZWZlcjogdG9nZ2xlTWFya2Rvd25Gb3JtYXR0aW5nXG4vLyBiYXV0IGFsbGUgXHUwMEM0bmRlcnVuZ2VuIGluIGVpbiBBcnJheSBhdXMge2Zyb20sdG8saW5zZXJ0fS1PYmpla3RlbiB1bmQgcnVmdCBhbVxuLy8gRW5kZSBHRU5BVSBFSU5NQUwgdGhpcy5jbS5kaXNwYXRjaCh7Y2hhbmdlczouLi59KSBhdWYgKHRoaXMuY20gPSBlZGl0b3IuY20sXG4vLyBkaWUgcm9oZSBDb2RlTWlycm9yLUVkaXRvclZpZXcgLSBlaW5lIHN0YWJpbGUgSW5zdGFuei1Qcm9wZXJ0eSwgc2llaGVcbi8vIEVkaXRvci1Lb25zdHJ1a3RvciBpbSBCdW5kbGU6IFwidGhpcy5jbT1lXCIpLiBKZWRlIGZyaXNjaCBlaW5nZWZcdTAwRkNndGVcbi8vIEt1cnNpdi1NYXJraWVydW5nIGVyc2NoZWludCBkYXJpbiBhbHMgZWlnZW5lciBDaGFuZ2UgbWl0IGluc2VydD09PVwiKlwiXG4vLyAodWYuaXRhbGljLnN1cnJvdW5kaW5nQ2hhcnMpIC0gRW50ZmVybnVuZ2VuIGJlc3RlaGVuZGVyIE1hcmtlciAoZWdhbCBvYiBcIipcIlxuLy8gb2RlciBcIl9cIikgbGF1ZmVuIGRhZ2VnZW4gaW1tZXIgYWxzIGluc2VydDpcIlwiLiBEaXNwYXRjaCBmXHUwMEZDciBkaWUgRGF1ZXIgZGllc2VzXG4vLyBlaW5lbiBBdWZydWZzIGFienVmYW5nZW4gdW5kIGluc2VydD09PVwiKlwiIGF1ZiBpbnNlcnQ6XCJfXCIgdW16dXNjaHJlaWJlbixcbi8vIGxcdTAwRTRzc3QgT2JzaWRpYW5zIGtvbXBsZXR0ZSBTZWxlY3Rpb24tL1dvcnQtL0xpc3Rlbi0vVGFiZWxsZW4tTG9naWtcbi8vIHVuYW5nZXRhc3RldCAtIGlua2x1c2l2ZSBkZXIgRlx1MDBFNGxsZSwgaW4gZGVuZW4gc2llIGVpbmUgbWVocnplaWxpZ2UgQXVzd2FobFxuLy8gKHouIEIuIG1laHJlcmUgTGlzdGVuZWludHJcdTAwRTRnZSkgaW4gbWVocmVyZSBzZXBhcmF0ZSBcIiouLi4qXCItUGFhcmUgcHJvIFplaWxlXG4vLyBhdWZ0ZWlsdC5cbi8vXG4vLyBHcmVuemZhbGwgdmVyc2NoYWNodGVsdGUgRm9ybWF0aWVydW5nICh6LiBCLiBLdXJzaXYgYXVmIG51ciBkYXMgV29ydCBpblxuLy8gXCIqKnxmZXR0fCoqXCIsIG9kZXIgYXVmIGRlbiBnYW56ZW4gRmV0dC1CbG9jayBpbmtsLiBTdGVybmNoZW4gXCJ8KipmZXR0Kip8XCJcbi8vIGFuZ2V3ZW5kZXQpOiBlaW4gZnJpc2NoIGVpbmdlZlx1MDBGQ2d0ZXIgXCJfXCIgbGFuZGV0IGRhYmVpIGRpcmVrdCBuZWJlblxuLy8gYmVzdGVoZW5kZW0gXCIqKlwiIChcIioqX2ZldHRfKipcIiBiencuIFwiXyoqZmV0dCoqX1wiKS4gVXJzcHJcdTAwRkNuZ2xpY2ggd3VyZGUgZGllc2Vcbi8vIFVtd2FuZGx1bmcgZGVzaGFsYiBibG9ja2llcnQgKEZhbGxiYWNrIGF1ZiB1bnNjaFx1MDBGNm5lcywgYWJlciBcInNpY2hlcmVzXCJcbi8vIFwiKioqZmV0dCoqKlwiKSwgd2VpbCBPYnNpZGlhbnMgZWlnZW5lIEVya2VubnVuZyBnZW5hdSBkaWVzZW4gRmFsbCBiZWltXG4vLyBlcm5ldXRlbiBBdXNzY2hhbHRlbiB2b24gS3Vyc2l2IGZhbHNjaCBiZWhhbmRlbHQgaFx1MDBFNHR0ZSB1bmQgZGFiZWkgZWluZW5cbi8vIEJvbGQtU3Rlcm4gamUgU2VpdGUgbWl0Z2VmcmVzc2VuIGhcdTAwRTR0dGUuIGRyb3BTcHVyaW91c0JvbGRTdGFyUmVtb3ZhbHMoKVxuLy8gdW50ZW4gcmVwYXJpZXJ0IGdlbmF1IGRhcyBqZXR6dCBkaXJla3QgYW4gZGVyIFF1ZWxsZSAodW5hYmhcdTAwRTRuZ2lnIGRhdm9uLCB3aWVcbi8vIGRpZSBWZXJzY2hhY2h0ZWx1bmcgZW50c3RhbmRlbiBpc3QpIC0gZGllIFVtd2FuZGx1bmcgc2VsYnN0IGJyYXVjaHQgZGFoZXJcbi8vIGtlaW5lIFNvbmRlcmJlaGFuZGx1bmcgbWVociB1bmQgbFx1MDBFNHVmdCBmXHUwMEZDciBqZWRlcyBmcmlzY2ggZWluZ2VmXHUwMEZDZ3RlIFwiKlwiXG4vLyBnbGVpY2guXG5cbi8vIFNwaWVnZWxiaWxkbGljaGVzIFByb2JsZW0gYmVpbSBFTlRGRVJORU46IGxpZWd0IGJlcmVpdHMgdm9yaGFuZGVuZXIgVGV4dCB3aWVcbi8vIFwiXyoqd29ydCoqX1wiIHZvciAoS3Vyc2l2IGF1XHUwMERGZW4gbWl0IFwiX1wiLCBGZXR0IGlubmVuIG1pdCBcIioqXCIgLSB6LiBCLiB3ZWlsXG4vLyBqZW1hbmQgZGFzIHZvbiBIYW5kIHNvIGdldGlwcHQgaGF0KSwgZmluZGV0IE9ic2lkaWFucyBlaWdlbmUgU3VjaC0vXG4vLyBFbnRmZXJudW5nc2xvZ2lrICh5ZigpL2dmKCkpIGJlaW0gQXVzc2NoYWx0ZW4gdm9uIEt1cnNpdiB6d2FyIGtvcnJla3QgYmVpZGVcbi8vIFwiX1wiLU1hcmtlciwgZW50ZmVybnQgZGFiZWkgYWJlciBaVVNcdTAwQzRUWkxJQ0ggamUgZWluIFwiKlwiIGF1cyBkZW0gdmVyc2NoYWNodGVsdGVuXG4vLyBcIioqXCIgLSB3ZWlsIGRlc3NlbiBNYXJrZXIgKGRhIGlubmVyaGFsYiBkZXIgS3Vyc2l2c3Bhbm5lIGxpZWdlbmQpIGViZW5mYWxsc1xuLy8gZGFzIFwiZW1cIi1UYWcgdHJhZ2VuIHVuZCBnZigpJ3MgVGFnLUNoZWNrIGtlaW5lbiBVbnRlcnNjaGllZCB6d2lzY2hlbiBlaW5lbVxuLy8gYWxsZWluc3RlaGVuZGVuIEt1cnNpdi1cIipcIiB1bmQgZGVtIGVyc3RlbiBaZWljaGVuIGVpbmVzIGxcdTAwRTRuZ2VyZW4gXCIqKlwiLUxhdWZzXG4vLyBtYWNodCAoXCJfKip3b3J0KipfXCIgLT4gXCIqd29ydCpcIiBzdGF0dCBcIioqd29ydCoqXCIpLiBCZXRyaWZmdCBudXIgXCIqXCItXG4vLyBFbnRmZXJudW5nZW4gKHVmLml0YWxpYy5zdXJyb3VuZGluZ0NoYXJzKSwgXCJfXCItRW50ZmVybnVuZ2VuIChhbHRTdXJyb3VuZGluZy1cbi8vIENoYXJzKSBzaW5kIGRhdm9uIG5pZSBiZXRyb2ZmZW4sIGRhIFwiX1wiIG5pZSBUZWlsIGVpbmVzIFwiKipcIi1MYXVmcyBpc3QuXG4vLyBKZWRlIExcdTAwRjZzY2h1bmcsIGRlcmVuIGVpbnplbG5lcyBaZWljaGVuIGltIChub2NoIHVudmVyXHUwMEU0bmRlcnRlbikgRG9rdW1lbnRcbi8vIGRpcmVrdCBuZWJlbiBlaW5lbSB3ZWl0ZXJlbiBcIipcIiBsaWVndCwga2FubiBkYWhlciBnZWZhaHJsb3MgdmVyd29yZmVuXG4vLyB3ZXJkZW4gLSBkaWUgZWNodGVuIFwiX1wiLUxcdTAwRjZzY2h1bmdlbiBibGVpYmVuIHVuYW5nZXRhc3RldCBzdGVoZW4uXG5mdW5jdGlvbiBkcm9wU3B1cmlvdXNCb2xkU3RhclJlbW92YWxzKGRvYywgY2hhbmdlcykge1xuICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICBjb25zdCBrZXB0ID0gY2hhbmdlcy5maWx0ZXIoKGNoYW5nZSkgPT4ge1xuICAgIGlmIChjaGFuZ2UuaW5zZXJ0ICE9PSBcIlwiIHx8IGNoYW5nZS50byAtIGNoYW5nZS5mcm9tICE9PSAxKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoZG9jLnNsaWNlU3RyaW5nKGNoYW5nZS5mcm9tLCBjaGFuZ2UudG8pICE9PSBcIipcIikgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgYmVmb3JlID0gY2hhbmdlLmZyb20gPiAwID8gZG9jLnNsaWNlU3RyaW5nKGNoYW5nZS5mcm9tIC0gMSwgY2hhbmdlLmZyb20pIDogXCJcIjtcbiAgICBjb25zdCBhZnRlciA9IGNoYW5nZS50byA8IGRvYy5sZW5ndGggPyBkb2Muc2xpY2VTdHJpbmcoY2hhbmdlLnRvLCBjaGFuZ2UudG8gKyAxKSA6IFwiXCI7XG4gICAgaWYgKGJlZm9yZSAhPT0gXCIqXCIgJiYgYWZ0ZXIgIT09IFwiKlwiKSByZXR1cm4gdHJ1ZTtcbiAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xuICByZXR1cm4gY2hhbmdlZCA/IGtlcHQgOiBjaGFuZ2VzO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlckl0YWxpY1VuZGVyc2NvcmUocGx1Z2luKSB7XG4gIGNvbnN0IHBhdGNoID0gKCkgPT4ge1xuICAgIGNvbnN0IGNtZCA9IHBsdWdpbi5hcHAuY29tbWFuZHMuY29tbWFuZHNbQ09NTUFORF9JRF07XG4gICAgaWYgKCFjbWQgfHwgY21kLl9fZnJlZEl0YWxpY1BhdGNoZWQpIHJldHVybjtcbiAgICBjbWQuX19mcmVkSXRhbGljUGF0Y2hlZCA9IHRydWU7XG5cbiAgICBjb25zdCBvcmlnaW5hbCA9IGNtZC5lZGl0b3JDYWxsYmFjaztcbiAgICBjbWQuZWRpdG9yQ2FsbGJhY2sgPSBmdW5jdGlvbiAoZWRpdG9yLCBjdHgpIHtcbiAgICAgIGlmICghcGx1Z2luLnNldHRpbmdzLml0YWxpY1VuZGVyc2NvcmVFbmFibGVkKSByZXR1cm4gb3JpZ2luYWwuY2FsbCh0aGlzLCBlZGl0b3IsIGN0eCk7XG5cbiAgICAgIGNvbnN0IGNtID0gZWRpdG9yLmNtO1xuICAgICAgY29uc3Qgb3JpZ2luYWxEaXNwYXRjaCA9IGNtLmRpc3BhdGNoLmJpbmQoY20pO1xuICAgICAgY20uZGlzcGF0Y2ggPSBmdW5jdGlvbiAoc3BlYykge1xuICAgICAgICBpZiAoc3BlYyAmJiBBcnJheS5pc0FycmF5KHNwZWMuY2hhbmdlcykpIHtcbiAgICAgICAgICBjb25zdCBkb2MgPSBjbS5zdGF0ZS5kb2M7XG4gICAgICAgICAgZm9yIChjb25zdCBjaGFuZ2Ugb2Ygc3BlYy5jaGFuZ2VzKSB7XG4gICAgICAgICAgICBpZiAoY2hhbmdlLmluc2VydCA9PT0gXCIqXCIpIGNoYW5nZS5pbnNlcnQgPSBcIl9cIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcmVwYWlyZWQgPSBkcm9wU3B1cmlvdXNCb2xkU3RhclJlbW92YWxzKGRvYywgc3BlYy5jaGFuZ2VzKTtcbiAgICAgICAgICBpZiAocmVwYWlyZWQgIT09IHNwZWMuY2hhbmdlcykge1xuICAgICAgICAgICAgLy8gQW56YWhsL0xcdTAwRTRuZ2UgZGVyIENoYW5nZXMgaGF0IHNpY2ggZ2VcdTAwRTRuZGVydCAtIE9ic2lkaWFucyBlaWdlbmUsXG4gICAgICAgICAgICAvLyBhdWYgZGVtIE9SSUdJTkFMLUNoYW5nZXNldCBiZXJlY2huZXRlIFNlbGVjdGlvbiB3XHUwMEU0cmUgamV0enQgYW5cbiAgICAgICAgICAgIC8vIGZhbHNjaGVyIFBvc2l0aW9uLiBzZWxlY3Rpb24gd2VnbGFzc2VuIHVuZCBDTTYgZGllIChTdGFuZGFyZC0pXG4gICAgICAgICAgICAvLyBBYmJpbGR1bmcgZGVyIGJpc2hlcmlnZW4gU2VsZWN0aW9uIGR1cmNoIGRpZSBDaGFuZ2VzIHNlbGJzdFxuICAgICAgICAgICAgLy8gXHUwMEZDYmVybmVobWVuIGxhc3Nlbiwgc3RhdHQgc2llIGhpZXIgdm9uIEhhbmQgbmFjaHp1cmVjaG5lbi5cbiAgICAgICAgICAgIGNvbnN0IHsgc2VsZWN0aW9uLCAuLi5yZXN0IH0gPSBzcGVjO1xuICAgICAgICAgICAgc3BlYyA9IHsgLi4ucmVzdCwgY2hhbmdlczogcmVwYWlyZWQgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsRGlzcGF0Y2goc3BlYyk7XG4gICAgICB9O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsLmNhbGwodGhpcywgZWRpdG9yLCBjdHgpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgY20uZGlzcGF0Y2ggPSBvcmlnaW5hbERpc3BhdGNoO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBwbHVnaW4ucmVnaXN0ZXIoKCkgPT4ge1xuICAgICAgY21kLmVkaXRvckNhbGxiYWNrID0gb3JpZ2luYWw7XG4gICAgICBkZWxldGUgY21kLl9fZnJlZEl0YWxpY1BhdGNoZWQ7XG4gICAgfSk7XG4gIH07XG5cbiAgcGx1Z2luLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeShwYXRjaCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0geyByZWdpc3Rlckl0YWxpY1VuZGVyc2NvcmUgfTtcbiIsICJjb25zdCB7IFBsdWdpbiB9ID0gcmVxdWlyZShcIm9ic2lkaWFuXCIpO1xuY29uc3QgeyBERUZBVUxUX1NFVFRJTkdTLCBGcmVkU2V0dGluZ1RhYiB9ID0gcmVxdWlyZShcIi4vc2V0dGluZ3NcIik7XG5jb25zdCB7IHJlZ2lzdGVyQ29tbWFuZHMgfSA9IHJlcXVpcmUoXCIuL2NvbW1hbmRzXCIpO1xuY29uc3QgeyByZWdpc3RlckRhdGFiYXNlRm9sZGVycyB9ID0gcmVxdWlyZShcIi4vZGF0YWJhc2UtZm9sZGVyc1wiKTtcbmNvbnN0IHsgcmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUgfSA9IHJlcXVpcmUoXCIuL3Byb3BlcnR5LXN5bmNcIik7XG5jb25zdCB7IHJlZ2lzdGVyTmVzdGVkQ2hlY2tib3hTeW5jIH0gPSByZXF1aXJlKFwiLi9uZXN0ZWQtY2hlY2tib3hlc1wiKTtcbmNvbnN0IHsgcmVnaXN0ZXJJbXBvcnRhbnRQbHVnaW5zIH0gPSByZXF1aXJlKFwiLi9pbXBvcnRhbnQtcGx1Z2luc1wiKTtcbmNvbnN0IHsgcmVnaXN0ZXJJdGFsaWNVbmRlcnNjb3JlIH0gPSByZXF1aXJlKFwiLi9pdGFsaWMtdW5kZXJzY29yZVwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGFzcyBGcmVkUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgcmVnaXN0ZXJDb21tYW5kcyh0aGlzKTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZyZWRTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgdGhpcy51cGRhdGVEYXRhYmFzZUZvbGRlclN0eWxlID0gcmVnaXN0ZXJEYXRhYmFzZUZvbGRlcnModGhpcyk7XG4gICAgcmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUodGhpcyk7XG4gICAgcmVnaXN0ZXJOZXN0ZWRDaGVja2JveFN5bmModGhpcyk7XG4gICAgdGhpcy5yZWZyZXNoSW1wb3J0YW50UGx1Z2luQ29tbWFuZHMgPSByZWdpc3RlckltcG9ydGFudFBsdWdpbnModGhpcyk7XG4gICAgcmVnaXN0ZXJJdGFsaWNVbmRlcnNjb3JlKHRoaXMpO1xuICB9XG5cbiAgb251bmxvYWQoKSB7fVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7O0FBQUE7QUFBQSw2QkFBQUEsVUFBQUMsU0FBQTtBQUFBLFFBQU0sRUFBRSxtQkFBbUIsT0FBTyxJQUFJLFFBQVEsVUFBVTtBQVV4RCxRQUFNLG9CQUFOLGNBQWdDLGtCQUFrQjtBQUFBLE1BQ2hELFlBQVksS0FBSyxXQUFXLFNBQVM7QUFDbkMsY0FBTSxHQUFHO0FBQ1QsYUFBSyxZQUFZO0FBQ2pCLGFBQUssVUFBVTtBQUNmLGFBQUssU0FBUztBQUNkLGFBQUssZUFBZSxvQkFBaUI7QUFBQSxNQUN2QztBQUFBLE1BRUEsV0FBVztBQUNULGVBQU8sS0FBSztBQUFBLE1BQ2Q7QUFBQSxNQUVBLFlBQVksVUFBVTtBQUNwQixlQUFPLFNBQVM7QUFBQSxNQUNsQjtBQUFBLE1BRUEsaUJBQWlCLE1BQU0sS0FBSztBQUMxQixhQUFLLFNBQVM7QUFDZCxjQUFNLGlCQUFpQixNQUFNLEdBQUc7QUFBQSxNQUNsQztBQUFBLE1BRUEsYUFBYSxVQUFVO0FBQ3JCLGFBQUssUUFBUSxTQUFTLEVBQUU7QUFBQSxNQUMxQjtBQUFBLE1BRUEsVUFBVTtBQUNSLGNBQU0sUUFBUTtBQUNkLFlBQUksQ0FBQyxLQUFLLE9BQVEsTUFBSyxRQUFRLElBQUk7QUFBQSxNQUNyQztBQUFBLElBQ0Y7QUFFQSxhQUFTLFVBQVUsS0FBSyxJQUFJO0FBQzFCLGFBQU8sT0FBTyxVQUFV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QUFpQixJQUFJO0FBQzdCLElBQU0sRUFBRSx3QkFBd0IsSUFBSTtBQUNwQyxJQUFNLEVBQUUsOEJBQThCLElBQUk7QUFDMUMsSUFBTSxFQUFFLDJCQUEyQixJQUFJO0FBQ3ZDLElBQU0sRUFBRSx5QkFBeUIsSUFBSTtBQUNyQyxJQUFNLEVBQUUseUJBQXlCLElBQUk7QUFFckMsT0FBTyxVQUFVLE1BQU0sbUJBQW1CLE9BQU87QUFBQSxFQUMvQyxNQUFNLFNBQVM7QUFDYixVQUFNLEtBQUssYUFBYTtBQUN4QixxQkFBaUIsSUFBSTtBQUNyQixTQUFLLGNBQWMsSUFBSSxlQUFlLEtBQUssS0FBSyxJQUFJLENBQUM7QUFDckQsU0FBSyw0QkFBNEIsd0JBQXdCLElBQUk7QUFDN0Qsa0NBQThCLElBQUk7QUFDbEMsK0JBQTJCLElBQUk7QUFDL0IsU0FBSyxpQ0FBaUMseUJBQXlCLElBQUk7QUFDbkUsNkJBQXlCLElBQUk7QUFBQSxFQUMvQjtBQUFBLEVBRUEsV0FBVztBQUFBLEVBQUM7QUFBQSxFQUVaLE1BQU0sZUFBZTtBQUNuQixTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFFQSxNQUFNLGVBQWU7QUFDbkIsVUFBTSxLQUFLLFNBQVMsS0FBSyxRQUFRO0FBQUEsRUFDbkM7QUFDRjsiLAogICJuYW1lcyI6IFsiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJJbXBvcnRhbnRQbHVnaW5zIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgIkRFRkFVTFRfU0VUVElOR1MiLCAiRnJlZFNldHRpbmdUYWIiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJQcm9wZXJ0eUJhY2tsaW5rc0xpdmUiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAicmVnaXN0ZXJDb21tYW5kcyIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJwYXRoIiwgInJlZ2lzdGVyRGF0YWJhc2VGb2xkZXJzIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgInJlZ2lzdGVyTmVzdGVkQ2hlY2tib3hTeW5jIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgInJlZ2lzdGVySXRhbGljVW5kZXJzY29yZSJdCn0K
