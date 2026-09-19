const { FuzzySuggestModal, Notice } = require("obsidian");

// Generischer Picker: wählt aus einer Manifest-Liste eins aus, löst mit
// dessen ID oder null (Abbruch) auf - genutzt sowohl zum Hinzufügen eines
// Plugins in den Einstellungen (settings.js) als auch vom Sammelbefehl unten.
// Gleicher Aufbau wie TypPickerModal (type-picker.js), inkl. desselben
// selectSuggestion()/onChooseItem()-Kommentars dort: Obsidians SuggestModal
// ruft intern erst close() und danach erst onChooseItem() auf - "chosen"
// muss deshalb schon in selectSuggestion() gesetzt werden, sonst löst das von
// close() ausgelöste onClose() das Promise fälschlich zuerst mit null auf.
class PluginPickerModal extends FuzzySuggestModal {
  constructor(app, manifests, resolve) {
    super(app);
    this.manifests = manifests;
    this.resolve = resolve;
    this.chosen = false;
    this.setPlaceholder("ESC für Abbruch");
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
}

function isEnabled(app, id) {
  return Object.prototype.hasOwnProperty.call(app.plugins.plugins, id);
}

// Als "wichtig" markierte Plugins (settings.js, Generell -> Important Plugin
// Settings), gefiltert auf aktuell aktivierte - Grundlage sowohl für die
// Einzelbefehle als auch den Sammelbefehl. Ein deaktiviertes Plugin hat keine
// offene Settings-Tab (Obsidian entlädt sie mit dem Plugin), ein Befehl dafür
// wäre also ohnehin wirkungslos.
function enabledImportantManifests(plugin) {
  return plugin.settings.importantPlugins
    .filter((id) => isEnabled(plugin.app, id))
    .map((id) => plugin.app.plugins.manifests[id])
    .filter(Boolean);
}

function openPluginSettings(app, id) {
  app.setting.open();
  if (!app.setting.openTabById(id)) new Notice("Dieses Plugin hat keine eigenen Einstellungen.");
}

// Sammelbefehl "Wichtiges Plugin - Einstellungen öffnen": bei genau einem
// markierten (aktivierten) Plugin ohne Zwischenschritt, sonst über denselben
// Picker wie beim Hinzufügen in den Einstellungen. Ergänzt die Einzelbefehle
// unten, ersetzt sie nicht - praktisch, wenn man den Namen des Einzelbefehls
// nicht im Kopf hat.
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

// Ein eigener Befehl je markiertem (aktiviertem) Plugin. Obsidians Commands-
// Registry erlaubt addCommand()/removeCommand() jederzeit, nicht nur beim
// Plugin-Start - hier deshalb bei jeder Änderung der Liste (Einstellungen)
// sowie bei jeder Plugin-Aktivierung/-Deaktivierung neu mit dem Ist-Zustand
// abgeglichen, statt die Befehle einmalig fix zu registrieren.
const registeredCommandIds = new Set();

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
      callback: () => openPluginSettings(plugin.app, manifest.id),
    });
    registeredCommandIds.add(id);
  }
}

function registerImportantPlugins(plugin) {
  const refresh = () => refreshPerPluginCommands(plugin);

  plugin.registerEvent(plugin.app.plugins.on("changed", refresh));
  plugin.app.workspace.onLayoutReady(refresh);

  return refresh;
}

module.exports = { registerImportantPlugins, openImportantPluginSettingsPicker, PluginPickerModal, enabledImportantManifests };
