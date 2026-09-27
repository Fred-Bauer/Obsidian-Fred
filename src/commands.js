const { Notice } = require("obsidian");
const { importContactsFromCsv, deleteUntouchedContacts } = require("./kontakt-import");
const { syncAllLinks } = require("./property-sync");
const { openImportantPluginSettingsPicker } = require("./important-plugins");

function registerCommands(plugin) {

  plugin.addCommand({
    id: "kontakte-csv-import",
    name: "KONTAKTE - Kontakte aus CSV aktualisieren",
    callback: () => importContactsFromCsv(plugin.app, plugin.settings),
  });

  plugin.addCommand({
    id: "kontakte-unveraendert-loeschen",
    name: "KONTAKTE - Unveränderte Kontakte löschen",
    callback: () => deleteUntouchedContacts(plugin.app, plugin.settings),
  });

  plugin.addCommand({
    id: "property-sync",
    name: "Property-Backlinking - Aktualisieren",
    callback: async () => {
      const result = await syncAllLinks(plugin.app, plugin.settings.reciprocalLinkProperties, plugin.settings.declaredLinkPairs, {
        typOrder: plugin.settings.propertyBacklinksTypOrder,
      });
      plugin.settings.declaredLinkPairs = result.declaredPairs;
      await plugin.saveSettings();
      new Notice(`Property-Backlinking: ${result.checked} Notizen geprüft, ${result.added} ergänzt, ${result.removed} entfernt.`);
    },
  });

  plugin.addCommand({
    id: "open-important-plugin-settings",
    name: "Open Important Plugin Settings (Picker)",
    callback: () => openImportantPluginSettingsPicker(plugin),
  });

  plugin.addCommand({
    id: "datenbank-ordner-oeffnen-schliessen",
    name: "Datenbank - Ordner öffnen/schließen",
    callback: () => plugin.toggleDatabaseFolder?.(),
  });

}

module.exports = { registerCommands };
