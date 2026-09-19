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

Einstellungen: **Generell** → *Property-Backlinking*.

## KONTAKTE

Import von Kontakten aus einer CSV-Datei (z. B. Google-Contacts-Export) in Notizen:

- Befehl **„Kontakte aus CSV aktualisieren“** importiert/aktualisiert Kontakt-Notizen aus der konfigurierten CSV in ein Basisverzeichnis
- Befehl **„Unveränderte Kontakte löschen“** entfernt Kontakt-Notizen, die seit dem letzten Import nicht bearbeitet wurden
- optional: nur bestehende Kontakte aktualisieren (keine neuen anlegen), irrelevante Kontakte (ohne Geburtstag/Tags) überspringen

Einstellungen: **KONTAKTE**.

## Technische Hinweise

- `src/` ist die Quelle, `main.js` das über esbuild gebaute Bundle (`npm run dev` für Watch-Modus, `node esbuild.config.mjs production` für einen einmaligen Build)
