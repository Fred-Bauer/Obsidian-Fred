const { importContactsFromCsv, deleteUntouchedContacts } = require("./kontakt-import");
const { openImportantPluginSettingsPicker } = require("./important-plugins");

function registerCommands(plugin) {

  plugin.addCommand({
    id: "kontakte-csv-import",
    name: "KONTAKTE - Kontakte aus CSV aktualisieren",
    callback: () => importContactsFromCsv(plugin),
  });

  plugin.addCommand({
    id: "kontakte-unveraendert-loeschen",
    name: "KONTAKTE - Unveränderte Kontakte löschen",
    callback: () => deleteUntouchedContacts(plugin),
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
