const { Plugin } = require("obsidian");
const { DEFAULT_SETTINGS, FredSettingTab } = require("./settings");
const { registerCommands } = require("./commands");
const { registerDatabaseFolders } = require("./database-folders");
const { registerPropertyBacklinksLive } = require("./property-sync");
const { registerNestedCheckboxSync } = require("./nested-checkboxes");
const { registerImportantPlugins } = require("./important-plugins");
const { registerItalicUnderscore } = require("./italic-underscore");
const { registerBasesHasNote, hasNoteContent } = require("./bases-has-note");
const { registerStyleSettingsFilter } = require("./style-settings-filter");

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
    // Für andere Plugins/Skripte (Templater, QuickAdd, ...):
    // app.plugins.plugins.fred.hasNoteContent(fileOderPfad). Bewusst unabhängig
    // vom Bases-Toggle - der schaltet nur die Property in Bases, nicht die Logik.
    this.hasNoteContent = (fileOrPath) => hasNoteContent(this.app, fileOrPath);
  }

  onunload() {}

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
    // declaredLinkPairs ist der Abgleichstand DIESES Geräts und passt nur zu
    // dessen Vault-Stand - mit dem eines anderen Geräts gälten Links fälschlich
    // als neu oder weggefallen. Entfällt, sobald property-sync.js ohne
    // gespeicherten Stand auskommt.
    const { declaredLinkPairs } = this.settings;
    await this.loadSettings();
    this.settings.declaredLinkPairs = declaredLinkPairs;
    this.updateDatabaseFolderStyle();
    this.updateBasesHasNote();
    this.updateStyleSettingsFilter();
    this.refreshImportantPluginCommands();
  }
};
