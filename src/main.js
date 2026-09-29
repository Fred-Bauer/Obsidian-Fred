const { Plugin } = require("obsidian");
const { DEFAULT_SETTINGS, FredSettingTab } = require("./settings");
const { registerCommands } = require("./commands");
const { registerDatabaseFolders } = require("./database-folders");
const { registerPropertyBacklinksLive } = require("./property-sync");
const { registerNestedCheckboxSync } = require("./nested-checkboxes");
const { registerImportantPlugins } = require("./important-plugins");
const { registerItalicUnderscore } = require("./italic-underscore");
const { registerBasesHasNote, hasNoteContent } = require("./bases-has-note");

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
    this.updateBasesHasNote = registerBasesHasNote(this);
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
};
