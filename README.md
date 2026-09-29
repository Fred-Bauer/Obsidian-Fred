# Fred

Persönliches Obsidian-Plugin mit verschiedenen Funktionserweiterungen für diesen Vault. Das Notiz-Typ-System (TYP/SUBTYP) lebt separat im Plugin **TYP-System**.

## Datenbank-Ordner

Ordner, deren Name mit einem konfigurierbaren Präfix beginnt (Standard: `~`), werden im Dateibaum als "Datenbank-Ordner" behandelt:

- nicht mehr auf-/zuklappbar
- optional: gesamte Titelzeile klickbar, um die zugehörige Folder-Note zu öffnen (benötigt das Folder-Notes-Plugin)
- optional: Anzahl enthaltener `.md`-Dateien statt Dateiendung am Zeilenende

Einstellungen: **Generell** → *Datenbank-Ordner*.

## Important Plugin Settings

Ausgewählte, aktivierte Community-Plugins lassen sich in eine Liste eintragen. Für jedes davon entsteht automatisch ein eigener Befehl, der Obsidians Einstellungen direkt auf dessen Seite öffnet - ohne Umweg über "Community plugins". Zusätzlich gibt es den Sammelbefehl **„Wichtiges Plugin - Einstellungen öffnen“**: bei genau einem eingetragenen Plugin ohne Zwischenschritt, sonst über eine native Auswahlliste. Ein deaktiviertes Plugin verschwindet automatisch aus der Liste (und damit auch sein Befehl), taucht nach erneuter Aktivierung aber wieder auf.

Einstellungen: **Generell** → *Important Plugin Settings* (Plugins hinzufügen/entfernen).

## Property-Backlinking

Reziproke Verlinkung über beliebige Frontmatter-Properties (z. B. `Familie`), unabhängig vom Notiz-TYP: Verlinkt Notiz A in einer dieser Properties Notiz B, bekommt B automatisch denselben Backlink ergänzt – und wieder entfernt, sobald die Verlinkung in A wegfällt.

- Befehl **„Property-Backlinking aktualisieren“** stößt den Abgleich manuell an
- optional: Live-Abgleich direkt beim Speichern
- optional: **Reihenfolge aus TYP-System übernehmen** – eine dabei neu angelegte Property landet an ihrem Platz laut Frontmatter-Sortierung des TYP-Systems (über dessen `placeProperty()`), statt am Ende; nur sie wird einsortiert, der Rest bleibt unverändert

Einstellungen: **Generell** → *Property-Backlinking*.

## Bases: Property `file.hasNote`

Stellt in Bases eine zusätzliche Datei-Property `file.hasNote` bereit - implementiert wie die eingebauten `file.embeds`/`file.tags`, also rein virtuell, ohne irgendetwas ins Frontmatter zu schreiben:

- `true`, wenn die Notiz außerhalb des Frontmatters Inhalt hat, sonst `false`
- überall nutzbar, wo Bases Properties anbietet: als Spalte, in Filtern (`file.hasNote`) und zum Gruppieren/Sortieren
- aktualisiert sich beim Bearbeiten der Notiz automatisch mit
- für Nicht-Markdown-Dateien (Bilder, PDFs, ...) zählt stattdessen eine Dateigröße über 0

Technisch: Obsidian hat für eigene `file.*`-Properties keine öffentliche Registrierung, die Bausteine sind aber aus `obsidian` exportiert - ergänzt werden `FileValue.prototype.objectAccess`/`keys` und `BasesEntry.FILE_PROPERTIES`, beides additiv und beim Deaktivieren/Entladen zurückgenommen. Der Inhalt kommt aus dem Metadaten-Cache (eine `section` außer der `yaml`-Section des Frontmatters), weil `objectAccess()` synchron antworten muss. Die Property wirkt ausschließlich in Bases - sie ist Teil von Bases' Ausdruckssprache, nicht des Frontmatters, und damit z. B. für Dataview, die Obsidian-Suche oder Templates unsichtbar. Bereits geöffnete Bases übernehmen eine Umschaltung erst nach einem Neuaufbau.

Außerhalb von Bases ist die Property nicht sichtbar (sie steht in keiner Datei und in keinem Index - `objectAccess` rechnet sie bei jedem Zugriff aus, genau wie Obsidian das bei `file.embeds` macht). Für Skripte und andere Plugins liegt dieselbe Prüfung deshalb direkt auf der Plugin-Instanz:

```js
app.plugins.plugins.fred.hasNoteContent(file)          // TFile
app.plugins.plugins.fred.hasNoteContent("Ordner/X.md") // oder Pfad
```

Ordner, unbekannte Pfade und `undefined` ergeben `false`. Die Funktion hängt nicht am Toggle - der schaltet nur die Bases-Property, nicht die Logik.

Einstellungen: **Generell** → *Bases*.

## KONTAKTE

Import von Kontakten aus einer CSV-Datei (z. B. Google-Contacts-Export) in Notizen:

- Befehl **„Kontakte aus CSV aktualisieren“** importiert/aktualisiert Kontakt-Notizen aus der konfigurierten CSV in ein Basisverzeichnis
- Befehl **„Unveränderte Kontakte löschen“** entfernt Kontakt-Notizen, die seit dem letzten Import nicht bearbeitet wurden
- optional: nur bestehende Kontakte aktualisieren (keine neuen anlegen), irrelevante Kontakte (ohne Geburtstag/Tags) überspringen

Einstellungen: **KONTAKTE**.

## Technische Hinweise

- `src/` ist die Quelle, `main.js` das über esbuild gebaute Bundle (`npm run dev` für Watch-Modus, `node esbuild.config.mjs production` für einen einmaligen Build)
