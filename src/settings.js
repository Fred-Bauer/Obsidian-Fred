const { PluginSettingTab, SettingGroup, Notice, setIcon } = require("obsidian");
const { PluginPickerModal } = require("./important-plugins");

const DEFAULT_SETTINGS = {
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
  propertyBacklinksTypOrder: true,
  nestedCheckboxSyncEnabled: false,
  italicUnderscoreEnabled: false,
  declaredLinkPairs: {},
  // Siehe important-plugins.js: aktivierte Plugin-IDs, für die automatisch
  // je ein eigener "Einstellungen öffnen"-Befehl entsteht.
  importantPlugins: [],
};

const TABS = [
  { id: "general", label: "Generell" },
  { id: "kontakte", label: "KONTAKTE" },
  { id: "media", label: "MEDIA" },
];

class FredSettingTab extends PluginSettingTab {
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
        cls: "fred-settings-tab" + (this.activeTab === tab.id ? " is-active" : ""),
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
    new SettingGroup(containerEl)
      .setHeading("Datenbank-Ordner")
      .addSetting((setting) =>
        setting
          .setName("Präfix-Ordner als Datenbank behandeln")
          .setDesc("Ordner, deren Name mit dem Präfix beginnt, sind im Dateibaum nicht mehr auf-/zuklappbar.")
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.databaseFoldersEnabled).onChange(async (value) => {
              this.plugin.settings.databaseFoldersEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Präfix")
          .setDesc("Ordnernamen, die mit diesem Zeichen/Text beginnen, gelten als Datenbank-Ordner.")
          .addText((text) =>
            text.setValue(this.plugin.settings.databaseFolderPrefix).onChange(async (value) => {
              this.plugin.settings.databaseFolderPrefix = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Folder-Notes-Erweiterung: gesamte Zeile klickbar")
          .setDesc(
            "Bei Datenbank-Ordnern öffnet ein Klick irgendwo in der Titelzeile (nicht nur auf dem Namen) die zugehörige Folder-Note, sofern das Folder-Notes-Plugin genutzt wird."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.folderNoteClickExtensionEnabled).onChange(async (value) => {
              this.plugin.settings.folderNoteClickExtensionEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Anzahl am Zeilenende anzeigen")
          .setDesc("Zeigt die .md-Datei-Anzahl statt an Stelle des Pfeils am Zeilenende an, wie sonst die Dateiendung.")
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.databaseFolderCountAtEnd).onChange(async (value) => {
              this.plugin.settings.databaseFolderCountAtEnd = value;
              await this.plugin.saveSettings();
              this.plugin.updateDatabaseFolderStyle?.();
            })
          )
      );

    new SettingGroup(containerEl)
      .setHeading("Property-Backlinking")
      .addSetting((setting) =>
        setting
          .setName("Properties")
          .setDesc(
            "Kommagetrennte Liste von Frontmatter-Properties mit Links zu anderen Notizen (z. B. Familie, Freunde) - gilt für alle Notizen, unabhängig vom TYP. Verlinkt eine Notiz hier eine andere, bekommt die andere automatisch den Backlink in derselben Property ergänzt - und wieder entfernt, sobald die Verlinkung wegfällt. Groß-/Kleinschreibung muss exakt zum Property-Namen passen."
          )
          .addText((text) =>
            text
              .setValue(this.plugin.settings.reciprocalLinkProperties.join(", "))
              .onChange(async (value) => {
                this.plugin.settings.reciprocalLinkProperties = value
                  .split(",")
                  .map((name) => name.trim())
                  .filter((name) => name.length > 0);
                await this.plugin.saveSettings();
              })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Live aktualisieren")
          .setDesc(
            "Property-Backlinking sofort beim Speichern abgleichen, statt nur auf Befehl (\"Property-Backlinking aktualisieren\")."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.propertyBacklinksLiveEnabled).onChange(async (value) => {
              this.plugin.settings.propertyBacklinksLiveEnabled = value;
              await this.plugin.saveSettings();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Reihenfolge aus TYP-System übernehmen")
          .setDesc(
            "Legt das Backlinking eine Property in einer Notiz neu an, landet sie an ihrem Platz laut Frontmatter-Sortierung des TYP-Systems (globale Reihenfolge, TYP-Frontmatter samt Floating Properties) statt am Ende. Nur die neue Property wird einsortiert, die übrigen bleiben, wie sie sind. Ohne aktiviertes TYP-System wird wie bisher angehängt."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.propertyBacklinksTypOrder).onChange(async (value) => {
              this.plugin.settings.propertyBacklinksTypOrder = value;
              await this.plugin.saveSettings();
            })
          )
      );

    new SettingGroup(containerEl)
      .setHeading("Checklisten")
      .addSetting((setting) =>
        setting
          .setName("Verschachtelte Checkboxen mit umschalten")
          .setDesc(
            "Beim (Ent)Haken einer Checkbox werden alle darunter verschachtelten Checkboxen automatisch mit (ent)hakt - und umgekehrt: sind alle Checkboxen einer Unterliste angehakt, wird die übergeordnete Checkbox automatisch mit angehakt, und wieder entfernt, sobald eine davon wieder abgehakt wird."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.nestedCheckboxSyncEnabled).onChange(async (value) => {
              this.plugin.settings.nestedCheckboxSyncEnabled = value;
              await this.plugin.saveSettings();
            })
          )
      );

    new SettingGroup(containerEl)
      .setHeading("Formatierung")
      .addSetting((setting) =>
        setting
          .setName("Kursiv mit Unterstrichen")
          .setDesc(
            'Der Befehl "Kursiv umschalten" setzt beim Einfügen Unterstriche (_Text_) statt Sternchen (*Text*) um die Auswahl. Bereits vorhandene Kursivformatierung (mit * oder _) wird beim erneuten Umschalten weiterhin korrekt erkannt und entfernt.'
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.italicUnderscoreEnabled).onChange(async (value) => {
              this.plugin.settings.italicUnderscoreEnabled = value;
              await this.plugin.saveSettings();
            })
          )
      );

    // "+"-Button als Extra-Button im Gruppen-Header (wie z. B. bei Obsidians
    // Hotkey-Gruppe), die Liste selbst in einem einzigen Eintrag der Gruppe
    // unter dessen Beschreibung.
    let listEl;
    new SettingGroup(containerEl)
      .setHeading("Important Plugin Settings")
      .addExtraButton((button) =>
        button
          .setIcon("plus")
          .setTooltip("Plugin hinzufügen")
          .onClick(() => {
            const manifests = this.plugin.app.plugins.manifests;
            const candidates = Object.keys(this.plugin.app.plugins.plugins)
              .filter((id) => manifests[id] && !this.plugin.settings.importantPlugins.includes(id))
              .map((id) => manifests[id])
              .sort((a, b) => a.name.localeCompare(b.name));

            if (candidates.length === 0) {
              new Notice("Keine weiteren aktivierten Plugins verfügbar.");
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
      )
      .addSetting((setting) => {
        setting.setDesc("Eigener Befehl je Plugin, um dessen Einstellungen direkt zu öffnen.");
        listEl = setting.infoEl.createDiv({ cls: "fred-important-plugins-list" });
      });

    const renderImportantPluginsList = () => {
      listEl.empty();
      const manifests = this.plugin.app.plugins.manifests;
      // Nur aktivierte Einträge - ein deaktiviertes Plugin hat keine eigene
      // Settings-Tab, ein Befehl dafür wäre wirkungslos (siehe important-plugins.js).
      const enabledIds = this.plugin.settings.importantPlugins.filter(
        (id) => manifests[id] && Object.prototype.hasOwnProperty.call(this.plugin.app.plugins.plugins, id)
      );

      if (enabledIds.length === 0) {
        listEl.createDiv({ cls: "setting-item-description", text: "Keine wichtigen Plugins eingetragen." });
        return;
      }

      // Bewusst kein eigener Setting-Eintrag je Zeile - dessen reguläres
      // Padding/Schriftgröße wirkt für eine reine Name+Entfernen-Liste zu
      // wuchtig. Schlichte eigene Zeile stattdessen.
      for (const id of enabledIds) {
        const row = listEl.createDiv({ cls: "fred-important-plugins-row" });
        row.createSpan({ cls: "fred-important-plugins-name", text: manifests[id].name });
        const removeBtn = row.createDiv({
          cls: "clickable-icon fred-important-plugins-remove",
          attr: { "aria-label": "Entfernen" },
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
    new SettingGroup(containerEl)
      .setHeading("Kontaktimport")
      .addSetting((setting) =>
        setting
          .setName("CSV-Datei")
          .setDesc("Pfad zur Kontakte-CSV, relativ zum Vault-Root.")
          .addText((text) =>
            text.setValue(this.plugin.settings.contactsCsvPath).onChange(async (value) => {
              this.plugin.settings.contactsCsvPath = value;
              await this.plugin.saveSettings();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Kontakte-Basisverzeichnis")
          .setDesc(
            "Alle Kontakte landen flach direkt in diesem Ordner (relativ zum Vault-Root). Bestehende Notizen in direkten Unterordnern werden beim Import hierher zusammengeführt."
          )
          .addText((text) =>
            text.setValue(this.plugin.settings.contactsBaseDir).onChange(async (value) => {
              this.plugin.settings.contactsBaseDir = value;
              await this.plugin.saveSettings();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Nur bestehende Kontakte aktualisieren")
          .setDesc("Wenn aktiv, werden keine neuen Kontakt-Notizen angelegt, nur bestehende aktualisiert.")
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.contactsEditOnly).onChange(async (value) => {
              this.plugin.settings.contactsEditOnly = value;
              await this.plugin.saveSettings();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Irrelevante Kontakte überspringen")
          .setDesc("Kontakte ohne Geburtstag und ohne Tags werden übersprungen.")
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.contactsFilterRelevant).onChange(async (value) => {
              this.plugin.settings.contactsFilterRelevant = value;
              await this.plugin.saveSettings();
            })
          )
      );
  }

  displayMediaTab(containerEl) {
    containerEl.createEl("p", { text: "Noch keine Einstellungen." });
  }
}

module.exports = { DEFAULT_SETTINGS, FredSettingTab };
