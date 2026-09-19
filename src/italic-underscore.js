const COMMAND_ID = "editor:toggle-italics";

// Obsidians eigener "Kursiv"-Befehl fügt beim Einfügen neuer Formatierung fest
// "*...*" ein (uf.italic.surroundingChars in Obsidians Editor-Bundle) - "_"
// wird dort nur als altSurroundingChars zur ERKENNUNG/ENTFERNUNG bereits
// vorhandener Kursivformatierung akzeptiert, nie beim Einfügen verwendet. uf
// selbst ist Teil eines privaten Closure-Objekts ohne öffentlichen Zugriff,
// toggleMarkdownFormatting() (Editor.prototype, aufgerufen über den nativen
// Befehl) aber genauso wenig überschreibbar, ohne Obsidians eigene Listen-/
// Tabellen-/Mehrfachauswahl-Logik nachzubauen.
//
// Der schmalste Eingriffspunkt liegt eine Ebene tiefer: toggleMarkdownFormatting
// baut alle Änderungen in ein Array aus {from,to,insert}-Objekten und ruft am
// Ende GENAU EINMAL this.cm.dispatch({changes:...}) auf (this.cm = editor.cm,
// die rohe CodeMirror-EditorView - eine stabile Instanz-Property, siehe
// Editor-Konstruktor im Bundle: "this.cm=e"). Jede frisch eingefügte
// Kursiv-Markierung erscheint darin als eigener Change mit insert==="*"
// (uf.italic.surroundingChars) - Entfernungen bestehender Marker (egal ob "*"
// oder "_") laufen dagegen immer als insert:"". Dispatch für die Dauer dieses
// einen Aufrufs abzufangen und insert==="*" auf insert:"_" umzuschreiben,
// lässt Obsidians komplette Selection-/Wort-/Listen-/Tabellen-Logik
// unangetastet - inklusive der Fälle, in denen sie eine mehrzeilige Auswahl
// (z. B. mehrere Listeneinträge) in mehrere separate "*...*"-Paare pro Zeile
// aufteilt.
//
// Grenzfall verschachtelte Formatierung (z. B. Kursiv auf nur das Wort in
// "**|fett|**", oder auf den ganzen Fett-Block inkl. Sternchen "|**fett**|"
// angewendet): ein frisch eingefügter "_" landet dabei direkt neben
// bestehendem "**" ("**_fett_**" bzw. "_**fett**_"). Ursprünglich wurde diese
// Umwandlung deshalb blockiert (Fallback auf unschönes, aber "sicheres"
// "***fett***"), weil Obsidians eigene Erkennung genau diesen Fall beim
// erneuten Ausschalten von Kursiv falsch behandelt hätte und dabei einen
// Bold-Stern je Seite mitgefressen hätte. dropSpuriousBoldStarRemovals()
// unten repariert genau das jetzt direkt an der Quelle (unabhängig davon, wie
// die Verschachtelung entstanden ist) - die Umwandlung selbst braucht daher
// keine Sonderbehandlung mehr und läuft für jedes frisch eingefügte "*"
// gleich.

// Spiegelbildliches Problem beim ENTFERNEN: liegt bereits vorhandener Text wie
// "_**wort**_" vor (Kursiv außen mit "_", Fett innen mit "**" - z. B. weil
// jemand das von Hand so getippt hat), findet Obsidians eigene Such-/
// Entfernungslogik (yf()/gf()) beim Ausschalten von Kursiv zwar korrekt beide
// "_"-Marker, entfernt dabei aber ZUSÄTZLICH je ein "*" aus dem verschachtelten
// "**" - weil dessen Marker (da innerhalb der Kursivspanne liegend) ebenfalls
// das "em"-Tag tragen und gf()'s Tag-Check keinen Unterschied zwischen einem
// alleinstehenden Kursiv-"*" und dem ersten Zeichen eines längeren "**"-Laufs
// macht ("_**wort**_" -> "*wort*" statt "**wort**"). Betrifft nur "*"-
// Entfernungen (uf.italic.surroundingChars), "_"-Entfernungen (altSurrounding-
// Chars) sind davon nie betroffen, da "_" nie Teil eines "**"-Laufs ist.
// Jede Löschung, deren einzelnes Zeichen im (noch unveränderten) Dokument
// direkt neben einem weiteren "*" liegt, kann daher gefahrlos verworfen
// werden - die echten "_"-Löschungen bleiben unangetastet stehen.
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

function registerItalicUnderscore(plugin) {
  const patch = () => {
    const cmd = plugin.app.commands.commands[COMMAND_ID];
    if (!cmd || cmd.__fredItalicPatched) return;
    cmd.__fredItalicPatched = true;

    const original = cmd.editorCallback;
    cmd.editorCallback = function (editor, ctx) {
      if (!plugin.settings.italicUnderscoreEnabled) return original.call(this, editor, ctx);

      const cm = editor.cm;
      const originalDispatch = cm.dispatch.bind(cm);
      cm.dispatch = function (spec) {
        if (spec && Array.isArray(spec.changes)) {
          const doc = cm.state.doc;
          for (const change of spec.changes) {
            if (change.insert === "*") change.insert = "_";
          }
          const repaired = dropSpuriousBoldStarRemovals(doc, spec.changes);
          if (repaired !== spec.changes) {
            // Anzahl/Länge der Changes hat sich geändert - Obsidians eigene,
            // auf dem ORIGINAL-Changeset berechnete Selection wäre jetzt an
            // falscher Position. selection weglassen und CM6 die (Standard-)
            // Abbildung der bisherigen Selection durch die Changes selbst
            // übernehmen lassen, statt sie hier von Hand nachzurechnen.
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

module.exports = { registerItalicUnderscore };
