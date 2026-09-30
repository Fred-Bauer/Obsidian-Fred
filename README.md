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

Die Reihenfolge der Liste lässt sich per **Drag&Drop** ändern (jede Zeile ist anfassbar, das Griff-Symbol links zeigt es an); sie bestimmt, in welcher Folge der Sammelbefehl die Plugins anbietet. Ausgeblendete, weil deaktivierte Einträge behalten dabei ihren Platz in der gespeicherten Liste.

Einstellungen: **Generell** → *Important Plugin Settings* (Plugins hinzufügen/entfernen/sortieren).

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

## Style Settings: Knopf „Modified“

Ergänzt im Einstellungs-Tab des Plugins **Style Settings** links neben *Import*/*Export* einen Knopf **Modified**. Ein Klick filtert die Liste auf die Einstellungen, die nicht mehr ihrem Standardwert entsprechen, ein zweiter Klick zeigt wieder alle. Getippte Suchbegriffe und der Filter schließen sich gegenseitig aus: der Knopf leert das Suchfeld, Tippen schaltet den Knopf wieder ab.

Der Filter fasst den Auf-/Zuklapp-Zustand nicht an: offene Überschriften bleiben offen, geschlossene bleiben geschlossen - anders als Style Settings' eigene Textsuche, die Treffer aufklappt, leere Sektionen zuklappt und beim Zurückschalten alles zuklappt. Wie viel in einer zugeklappten Sektion steckt, verrät deren Trefferzahl in der Titelzeile; die gefilterte Auswahl erscheint dann beim Aufklappen. Überschriften ohne einen einzigen geänderten Eintrag werden ausgeblendet - das ist Filtern, kein Zuklappen.

Maßgeblich ist der Vergleich mit dem Standard, nicht das bloße Vorhandensein eines gespeicherten Werts - wer einen Schalter zweimal umlegt, hinterlässt in Style Settings einen Eintrag mit dem Standardwert darin, und der zählt hier als unverändert. Farben werden dabei über die CSSOM normalisiert, damit `#FFF`, `#ffffff` und `rgb(255,255,255)` als derselbe Wert gelten; themenabhängige Farben gelten als geändert, sobald der helle **oder** der dunkle Wert abweicht.

Technisch nutzt der Filter Style Settings' eigene Mechanik weiter (jede Sektion ist eine Baumkomponente mit `filterMode`/`filteredChildren`, genau wie bei dessen Textsuche) - nur entscheidet statt eines Fuzzy-Treffers „Wert ≠ Standard“. Gerechnet wird dabei getrennt vom Zeichnen: der Filter wird auf allen Sektionen gesetzt, neu gezeichnet werden aber nur die aufgeklappten - eine zugeklappte Sektion hat keine gezeichneten Kinder und zeigt die gefilterte Auswahl von selbst, sobald sie aufgeklappt wird. Gepatcht wird nichts an dessen Prototypen, sondern je eine Methode auf den konkreten Objekten (`settingsTab.display`, `settingsMarkup.generate`), damit der Knopf auch die plugin-eigenen Neuaufbauten nach Import oder „Reset all settings“ übersteht. Eingehängt wird über `app.setting.openTab`, weil Style Settings per Lazy Loading erst später geladen sein kann und dafür kein Ereignis anbietet. Wirkt im Einstellungs-Dialog, nicht in Style Settings' Seitenleisten-Ansicht.

Einstellungen: **Generell** → *Style Settings*.

## KONTAKTE

Import von Kontakten aus einer CSV-Datei (z. B. Google-Contacts-Export) in Notizen. Der Lauf wird erst vollständig durchgerechnet und dann angewandt – dadurch sind Probelauf, Konflikt-Dialog und Lösch-Befehl alle auf denselben Soll-Zustand gestützt.

- Befehl **„Kontakte aus CSV aktualisieren“** – legt neue Notizen an, aktualisiert bestehende, benennt umbenannte um und räumt verschwundene weg
- Befehl **„Unveränderte Kontakte löschen“** – Debugging-Hilfe: entfernt Notizen, die exakt so aussehen, wie der Import sie gerade anlegen würde. Jede eigene Ergänzung (fremde Property, abweichender Wert, Fließtext) schützt eine Notiz davor
- Fortschritt samt **Abbrechen**-Knopf in der Statusleiste; der Notice-Bereich bleibt dadurch für die Meldungen frei

**Identität statt Dateiname:** Eine CSV-Zeile wird einer Notiz über Telefonnummer → E-Mail → Dateiname zugeordnet. Telefon und E-Mail stehen ohnehin in den Notizen, eine technische ID ist deshalb nicht nötig. Wird ein Kontakt in Google umbenannt, zieht die Notiz über `fileManager.renameFile` mit – eingehende `Familie`/`Freunde`-Links bleiben intakt, statt dass eine verwaiste Zweitnotiz entsteht. Gleichnamige Kontakte bekommen die letzten vier Ziffern ihrer Nummer als Zusatz (`Julian (9002)`), weil die über Läufe hinweg stabil ist; ohne Nummer und E-Mail wird der Kontakt übersprungen und gemeldet. Notizen ohne passende CSV-Zeile wandern in einen Unterordner (`_Trash`).

**Zusammenspiel mit dem TYP-System:** Der Import schreibt ausschließlich über `processFrontMatter` und ruft am Ende `sortFrontmatter()` des TYP-Systems auf – er bringt also keine eigene Property-Reihenfolge mehr mit. Die Feldliste kommt aus `getTypeDefaults(TYP, { includeFloating: true })`, wird also nur dort gepflegt; ohne aktives TYP-System greift eine interne Fallback-Liste. Der TYP-Name selbst ist eine Einstellung.

**Normalisierung** (abschaltbar, jede Korrektur wird gruppiert in der Konsole protokolliert): Telefonnummern auf `+49`-Format inklusive geschützter Leerzeichen, E-Mails klein, bekannte Länderkürzel ausgeschrieben, Hausnummern aus US- in deutsche Reihenfolge, `Str.` ausgeschrieben. Eine reine Umschreibung gilt dabei nie als Konflikt – sonst bliebe sie im Modus „nur Lücken füllen“ für immer liegen.

**Bei abweichenden Werten** ist einstellbar, ob die CSV gewinnt, nur leere Properties gefüllt werden oder pro betroffenem Kontakt ein Dialog erscheint. Dazu zählt auch der Fall, dass ein Wert in Google gelöscht wurde: die Property wird dann geleert, im Dialog erscheint sie als „in Google gelöscht“. Geleert werden allerdings nur Properties, deren Quellspalte im CSV-Header überhaupt vorkommt – sonst würde ein knapperer Export Felder abräumen, über die er gar keine Aussage trifft. Tags werden immer zusammengeführt statt ersetzt und nie geleert.

Während des Imports pausiert das Live-Property-Backlinking; zum Schluss läuft genau ein vollständiger Abgleich statt einer pro geschriebener Notiz.

Einstellungen: **KONTAKTE**.

## Technische Hinweise

- `src/` ist die Quelle, `main.js` das über esbuild gebaute Bundle (`npm run dev` für Watch-Modus, `node esbuild.config.mjs production` für einen einmaligen Build)
