const { PluginSettingTab, SettingGroup, Notice, setIcon } = require("obsidian");
const { PluginPickerModal } = require("./important-plugins");

const DEFAULT_SETTINGS = {
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
          .addText((text) => {
            text
              .setValue(this.plugin.settings.reciprocalLinkProperties.join(", "))
              .onChange(async (value) => {
                this.plugin.settings.reciprocalLinkProperties = value
                  .split(",")
                  .map((name) => name.trim())
                  .filter((name) => name.length > 0);
                await this.plugin.saveSettings();
              });
            // Eine neu eingetragene Property einmal abgleichen - erst beim
            // Verlassen des Felds ("change"), nicht bei jedem Tastendruck.
            text.inputEl.addEventListener("change", () => {
              if (this.plugin.settings.propertyBacklinksLiveEnabled) this.plugin.addMissingPropertyBacklinks();
            });
          })
      )
      .addSetting((setting) =>
        setting
          .setName("Aktiv")
          .setDesc(
            "Spiegelt jede Änderung an diesen Properties sofort bei der verlinkten Notiz. Beim Einschalten werden alle fehlenden Backlinks ergänzt; ein Link, der entfernt wurde, während das Backlinking aus war, bleibt bei der verlinkten Notiz dagegen stehen."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.propertyBacklinksLiveEnabled).onChange(async (value) => {
              this.plugin.settings.propertyBacklinksLiveEnabled = value;
              await this.plugin.saveSettings();
              if (value) this.plugin.addMissingPropertyBacklinks();
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

    new SettingGroup(containerEl)
      .setHeading("Bases")
      .addSetting((setting) =>
        setting
          .setName('Property "file.hasNote"')
          .setDesc(
            'Stellt in Bases die zusätzliche Datei-Property "file.hasNote" bereit - wie die eingebauten file.embeds/file.tags, also ohne etwas ins Frontmatter zu schreiben. Sie ist true, wenn die Notiz außerhalb des Frontmatters Inhalt hat, und damit als Spalte, Filter oder Gruppierung nutzbar. Bereits geöffnete Bases zeigen sie erst nach einem Neuaufbau (Tab neu öffnen).'
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.basesHasNoteEnabled).onChange(async (value) => {
              this.plugin.settings.basesHasNoteEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateBasesHasNote?.();
            })
          )
      );

    new SettingGroup(containerEl)
      .setHeading("Style Settings")
      .addSetting((setting) =>
        setting
          .setName('Knopf "Modified"')
          .setDesc(
            'Ergänzt in den Einstellungen des Plugins "Style Settings" links neben Import/Export einen Knopf, der die Liste auf die Einstellungen filtert, die nicht mehr ihrem Standardwert entsprechen - ein zweiter Klick zeigt wieder alle. Zählt nur echte Abweichungen: ein Wert, der (z. B. durch zweimaliges Umschalten) wieder dem Standard entspricht, gilt als unverändert. Der Auf-/Zuklapp-Zustand der Überschriften bleibt dabei unberührt; wie viel in einer zugeklappten Sektion steckt, zeigt deren Trefferzahl. Wirkt im Einstellungs-Dialog, nicht in Style Settings\' Seitenleisten-Ansicht.'
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.styleSettingsModifiedFilterEnabled).onChange(async (value) => {
              this.plugin.settings.styleSettingsModifiedFilterEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.updateStyleSettingsFilter?.();
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
        setting.setDesc("Eigener Befehl je Plugin, um dessen Einstellungen direkt zu öffnen. Reihenfolge per Drag&Drop.");
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

      // Übernimmt die Reihenfolge, wie die Zeilen gerade im DOM stehen (nach
      // dem Ziehen), in die Einstellung. Angezeigt werden nur aktivierte
      // Plugins, gespeichert sind auch deaktivierte: deren Plätze in der Liste
      // bleiben unverändert, nur die sichtbaren Plätze werden neu befüllt.
      const saveOrderFromDom = async () => {
        const visible = new Set(enabledIds);
        const newOrder = Array.from(listEl.children, (el) => el.dataset.pluginId);
        let next = 0;
        this.plugin.settings.importantPlugins = this.plugin.settings.importantPlugins.map((id) =>
          visible.has(id) ? newOrder[next++] : id
        );
        await this.plugin.saveSettings();
        // Die Reihenfolge bestimmt, in welcher Folge der Sammelbefehl die
        // Plugins zur Auswahl anbietet (siehe important-plugins.js).
        this.plugin.refreshImportantPluginCommands?.();
      };

      // Die Liste ist ein Grid mit mehreren Spalten (styles.css), die
      // Reihenfolge läuft darin zeilenweise von links nach rechts. Deshalb
      // entscheidet innerhalb derselben Zeile die X-Position, ober- bzw.
      // unterhalb davon die Y-Position.
      const dropsBefore = (row, evt) => {
        const rect = row.getBoundingClientRect();
        if (evt.clientY < rect.top) return true;
        if (evt.clientY > rect.bottom) return false;
        return evt.clientX < rect.left + rect.width / 2;
      };

      // Bewusst kein eigener Setting-Eintrag je Zeile - dessen reguläres
      // Padding/Schriftgröße wirkt für eine reine Name+Entfernen-Liste zu
      // wuchtig. Schlichte eigene Zeile stattdessen.
      for (const id of enabledIds) {
        const row = listEl.createDiv({ cls: "fred-important-plugins-row" });
        // Natives HTML5-Drag&Drop statt Obsidians interner DragManager: für eine
        // Liste in den eigenen Einstellungen genügt das und bleibt unabhängig
        // von deren nicht dokumentierter API.
        row.draggable = true;
        row.dataset.pluginId = id;
        const grip = row.createDiv({ cls: "fred-important-plugins-grip" });
        setIcon(grip, "grip-vertical");
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

        row.addEventListener("dragstart", (evt) => {
          dragged = row;
          row.addClass("is-dragging");
          evt.dataTransfer.effectAllowed = "move";
          // Ohne gesetzte Daten startet in Electron/Chromium kein Drag.
          evt.dataTransfer.setData("text/plain", id);
        });

        // Die Zeilen werden schon während des Ziehens umgestellt, das ist die
        // Vorschau - gespeichert wird erst am Ende (dragend).
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
    // Über renderImportantPluginsList() hinweg gültig, weil ein Drag die Liste
    // nicht neu aufbaut - erst das dragend speichert.
    let dragged = null;
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
            "Alle Kontakte landen flach direkt in diesem Ordner (relativ zum Vault-Root). Groß-/Kleinschreibung wird beim Abgleich ignoriert."
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
          .setName("TYP der Kontakt-Notizen")
          .setDesc(
            "Bestimmt zugleich, aus welchem TYP-Frontmatter der Import seine Feldliste liest. Läuft das TYP-System nicht, greift eine interne Liste."
          )
          .addText((text) =>
            text.setValue(this.plugin.settings.contactsTyp).onChange(async (value) => {
              this.plugin.settings.contactsTyp = value;
              await this.plugin.saveSettings();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Papierkorb-Unterordner")
          .setDesc(
            "Kontakte, zu denen keine CSV-Zeile mehr passt, wandern hierhin (innerhalb des Basisverzeichnisses). Eingehende Links bleiben dabei erhalten."
          )
          .addText((text) =>
            text.setValue(this.plugin.settings.contactsTrashSubdir).onChange(async (value) => {
              this.plugin.settings.contactsTrashSubdir = value;
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
      )
      .addSetting((setting) =>
        setting
          .setName("Werte normalisieren")
          .setDesc(
            "Telefonnummern auf +49-Format (inkl. geschützter Leerzeichen), E-Mails klein, Länderkürzel ausgeschrieben, Hausnummern in deutsche Reihenfolge. Jede Korrektur wird in der Konsole protokolliert."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.contactsNormalizeEnabled).onChange(async (value) => {
              this.plugin.settings.contactsNormalizeEnabled = value;
              await this.plugin.saveSettings();
            })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Bei abweichenden Werten")
          .setDesc(
            "Was passiert, wenn eine Notiz bereits einen anderen Wert hat als die CSV. Leere Properties werden immer gefüllt, Tags immer zusammengeführt."
          )
          .addDropdown((dropdown) =>
            dropdown
              .addOption("csv", "CSV gewinnt")
              .addOption("gaps", "Notiz behalten, nur Lücken füllen")
              .addOption("ask", "Pro Kontakt nachfragen")
              .setValue(this.plugin.settings.contactsConflictMode)
              .onChange(async (value) => {
                this.plugin.settings.contactsConflictMode = value;
                await this.plugin.saveSettings();
              })
          )
      )
      .addSetting((setting) =>
        setting
          .setName("Probelauf")
          .setDesc(
            "Rechnet den Lauf komplett durch und meldet in der Konsole, was passieren würde - schreibt aber nichts. Gilt für beide Kontakt-Befehle."
          )
          .addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.contactsDryRun).onChange(async (value) => {
              this.plugin.settings.contactsDryRun = value;
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
