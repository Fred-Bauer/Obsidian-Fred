const { Notice, Modal, Setting, ButtonComponent } = require("obsidian");

/* ============================================================
 * Kontakte-CSV-Import
 *
 * Arbeitet in zwei Schritten: erst wird der komplette Lauf
 * durchgerechnet (buildPlan), dann angewandt (applyPlan). Das
 * hält den Probelauf trivial (Plan bauen, nicht anwenden), macht
 * das Konflikt-Modal möglich (alle Abweichungen sind bekannt,
 * bevor irgendetwas geschrieben wird) und erlaubt dem Lösch-
 * Befehl, denselben Soll-Zustand zu benutzen.
 *
 * Geschrieben wird ausschließlich über fileManager.processFrontMatter
 * und die API des TYP-Systems - nie über adapter.write mit selbst
 * gebautem YAML. Sonst kämen sich Import und Frontmatter-Sortierung
 * bei jedem Lauf gegenseitig in die Quere.
 * ============================================================ */

const MULTI_VALUE_SEPARATOR = " ::: ";
const IGNORED_LABELS = new Set(["* myContacts", "* starred"]);
const STARRED_LABEL = "* starred";

// CSV-Spalte -> Property. Telefon und E-Mail fehlen hier bewusst: die
// können mehrwertig sein und werden in collectPhones/collectEmails
// zusammengeführt.
const COLUMN_MAPPING = {
  "First Name": "Vorname",
  "Middle Name": "Zweitname",
  "Last Name": "Nachname",
  "Birthday": "Geburtstag",
  "Address 1 - Street": "Strasse",
  "Address 1 - City": "Stadt",
  "Address 1 - Postal Code": "Plz",
  "Address 1 - Country": "Nation",
};

// Fallback, falls das TYP-System nicht läuft - sonst ist
// getTypeDefaults(TYP, { includeFloating: true }) die Quelle.
const FALLBACK_CONTACT_KEYS = [
  "Vorname",
  "Zweitname",
  "Nachname",
  "Geburtstag",
  "Handynummer",
  "Handynummer-Alt",
  "Festnetz",
  "E-Mail",
  "E-Mail-Alt",
  "Strasse",
  "Stadt",
  "Plz",
  "Nation",
  "Familie",
  "Freunde",
];

// Properties, die der Import selbst befüllt. Alles andere (Familie,
// Freunde, eigene Ergänzungen) gehört dem Nutzer bzw. dem
// Property-Backlinking und wird nie angefasst.
const IMPORT_OWNED_KEYS = [
  "Vorname",
  "Zweitname",
  "Nachname",
  "Geburtstag",
  "Handynummer",
  "Handynummer-Alt",
  "Festnetz",
  "E-Mail",
  "E-Mail-Alt",
  "Strasse",
  "Stadt",
  "Plz",
  "Nation",
  "tags",
];

// Aus welchen CSV-Spalten eine Property gespeist wird. Gebraucht, um zu
// erkennen, ob ein leeres Feld "in Google gelöscht" bedeutet oder nur
// "diese Spalte liefert der Export gar nicht". Ohne die Unterscheidung
// würde ein Export ohne "Phone 2 - Value" das Festnetz bei allen Kontakten
// leeren, statt es einfach in Ruhe zu lassen.
const SOURCE_COLUMNS = {
  Vorname: ["First Name"],
  Zweitname: ["Middle Name"],
  Nachname: ["Last Name"],
  Geburtstag: ["Birthday"],
  Handynummer: ["Phone 1 - Value"],
  "Handynummer-Alt": ["Phone 1 - Value"],
  Festnetz: ["Phone 2 - Value"],
  "E-Mail": ["E-mail 1 - Value"],
  "E-Mail-Alt": ["E-mail 2 - Value", "E-mail 3 - Value"],
  Strasse: ["Address 1 - Street"],
  Stadt: ["Address 1 - City"],
  Plz: ["Address 1 - Postal Code"],
  Nation: ["Address 1 - Country"],
  tags: ["Labels"],
};

// Nur bekannte Kürzel werden ausgeschrieben; alles Unbekannte bleibt
// unangetastet, damit der Import keine Länder erfindet.
const COUNTRY_NAMES = {
  DE: "Deutschland",
  AT: "Österreich",
  CH: "Schweiz",
  FR: "Frankreich",
  NL: "Niederlande",
  BE: "Belgien",
  LU: "Luxemburg",
  IT: "Italien",
  ES: "Spanien",
  PL: "Polen",
  CZ: "Tschechien",
  DK: "Dänemark",
  GB: "Vereinigtes Königreich",
  US: "USA",
  TR: "Türkei",
};

/* ------------------------------------------------------------------ */
/* Pfade                                                               */
/* ------------------------------------------------------------------ */

function joinVaultPath(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

// Vergleiche unempfindlich gegen Groß-/Kleinschreibung: das Setting sagte
// lange "~KONTAKTE", der Ordner heißt "~Kontakte". Unter Windows lief der
// Dateizugriff trotzdem, nur Obsidians eigener Index (file.path) verglich
// sich nie gleich - der Lösch-Befehl fand dadurch stillschweigend nichts.
function isInFolder(path, folder) {
  const p = path.toLowerCase();
  const f = folder.toLowerCase();
  return p === f || p.startsWith(f + "/");
}

// Die echte Schreibweise des Ordners aus dem Vault holen, statt der aus dem
// Setting zu vertrauen. Sonst zielen Umbenennungen und _Trash-Verschiebungen
// auf einen Pfad, den es unter Windows zwar gibt, den Obsidians Index aber
// anders schreibt.
function resolveFolderPath(app, folder) {
  if (app.vault.getAbstractFileByPath(folder)) return folder;
  const lower = folder.toLowerCase();
  for (const item of app.vault.getAllLoadedFiles?.() ?? []) {
    if (item.children && item.path.toLowerCase() === lower) return item.path;
  }
  return folder;
}

function sanitizeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function csvToObjects(text) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    header.forEach((key, idx) => (obj[key] = row[idx] ?? ""));
    return obj;
  });
}

function splitMulti(value) {
  return String(value ?? "")
    .split(MULTI_VALUE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Normalisierung                                                      */
/* ------------------------------------------------------------------ */

// Google liefert Nummern mal mit normalen, mal mit geschützten
// Leerzeichen (U+00A0). Das alte .replace(/ /g, "") traf nur die
// normalen - neun Nummern standen dadurch mit unsichtbaren Zeichen in
// den Notizen und waren nicht auffindbar. Und ohne einheitliches Format
// schlägt die Zuordnung über die Telefonnummer fehl.
function normalizePhone(raw) {
  let phone = String(raw ?? "").replace(/[\s   ()/.-]/g, "");
  if (!phone) return "";
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  else if (phone.startsWith("0")) phone = "+49" + phone.slice(1);
  return phone.replace(/^\+490/, "+49");
}

function normalizeEmail(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function normalizeCountry(raw) {
  const value = String(raw ?? "").trim();
  return COUNTRY_NAMES[value.toUpperCase()] ?? value;
}

// Zwei Eigenheiten des Google-Exports: manche Adressen kommen in
// US-Reihenfolge ("5 Schanzenstraße"), und "Straße" ist gelegentlich
// abgekürzt. Erst ausschreiben, dann drehen - sonst steht das "Str"
// nach dem Drehen nicht mehr am Wortende.
function normalizeStreet(raw) {
  let street = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!street) return "";
  street = street.replace(/([a-zäöüß])str\.?(?=\s|$)/g, "$1straße");
  street = street.replace(/\bStr\.?(?=\s|$)/g, "Straße");
  const usOrder = street.match(/^(\d+\s?[a-zA-Z]?)\s+(\D.*)$/);
  if (usOrder) street = `${usOrder[2].trim()} ${usOrder[1].replace(/\s/g, "")}`;
  return street;
}

// Geburtstage ohne Jahr kommen als "--MM-TT". Das Sentinel-Jahr 0001
// bleibt bewusst erhalten: die Formel in ~Kontakte.base baut das Datum
// ohnehin mit dem laufenden Jahr neu zusammen und ignoriert das Jahr.
function normalizeBirthday(raw) {
  const value = String(raw ?? "").trim();
  return value.startsWith("--") ? "0001" + value.slice(1) : value;
}

function normalizeTag(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* ------------------------------------------------------------------ */
/* CSV-Zeile -> Kontakt                                                */
/* ------------------------------------------------------------------ */

// Sammelt alle Telefonnummern einer Zeile (Phone 1 kann mehrere
// ":::"-getrennte Werte enthalten, Phone 2 kommt separat), normalisiert
// sie und wirft Dubletten raus - Google exportiert dieselbe Nummer gern
// zweimal hintereinander.
function collectPhones(row) {
  const mobile = [];
  const landline = [];
  for (const value of splitMulti(row["Phone 1 - Value"])) {
    const phone = normalizePhone(value);
    if (phone && !mobile.includes(phone)) mobile.push(phone);
  }
  for (const value of splitMulti(row["Phone 2 - Value"])) {
    const phone = normalizePhone(value);
    if (phone && !mobile.includes(phone) && !landline.includes(phone)) landline.push(phone);
  }
  return { mobile, landline };
}

function collectEmails(row) {
  const emails = [];
  for (const column of ["E-mail 1 - Value", "E-mail 2 - Value", "E-mail 3 - Value"]) {
    for (const value of splitMulti(row[column])) {
      const email = normalizeEmail(value);
      if (email && !emails.includes(email)) emails.push(email);
    }
  }
  return emails;
}

function collectTags(row) {
  const labels = splitMulti(row["Labels"]);
  const tags = [];
  for (const label of labels) {
    if (IGNORED_LABELS.has(label)) continue;
    const tag = normalizeTag(label);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  if (labels.includes(STARRED_LABEL) && !tags.includes("favorit")) tags.push("favorit");
  return tags;
}

// Jede Abweichung zwischen Rohwert und normalisiertem Wert landet im
// Bericht, damit nachvollziehbar bleibt, was der Import stillschweigend
// geradegezogen hat.
function noteCorrection(corrections, name, field, from, to) {
  if (from === to || !from) return;
  corrections.push({ name, field, from, to });
}

function buildContact(row, corrections, normalize) {
  const firstName = (row["First Name"] || "").trim();
  const lastName = (row["Last Name"] || "").trim();

  let baseName = "";
  if (firstName && lastName) baseName = `${firstName} ${lastName}`;
  else if (firstName || lastName) baseName = firstName || lastName;

  const data = {};
  for (const [column, key] of Object.entries(COLUMN_MAPPING)) {
    const raw = (row[column] || "").trim();
    if (!raw) continue;
    let value = raw;
    if (key === "Geburtstag") value = normalizeBirthday(raw);
    else if (normalize && key === "Nation") value = normalizeCountry(raw);
    else if (normalize && key === "Strasse") value = normalizeStreet(raw);
    noteCorrection(corrections, baseName, key, raw, value);
    data[key] = value;
  }

  const { mobile, landline } = collectPhones(row);
  if (mobile[0]) {
    noteCorrection(corrections, baseName, "Handynummer", splitMulti(row["Phone 1 - Value"])[0] ?? "", mobile[0]);
    data["Handynummer"] = mobile[0];
  }
  if (mobile.length > 1) data["Handynummer-Alt"] = mobile.length === 2 ? mobile[1] : mobile.slice(1);
  if (landline.length > 0) data["Festnetz"] = landline.length === 1 ? landline[0] : landline;

  const emails = collectEmails(row);
  if (emails[0]) {
    if (normalize) noteCorrection(corrections, baseName, "E-Mail", splitMulti(row["E-mail 1 - Value"])[0] ?? "", emails[0]);
    data["E-Mail"] = emails[0];
  }
  if (emails.length > 1) data["E-Mail-Alt"] = emails.length === 2 ? emails[1] : emails.slice(1);

  const tags = collectTags(row);
  if (tags.length > 0) data["tags"] = tags;

  return {
    baseName,
    data,
    phones: [...mobile, ...landline],
    emails,
    body: (row["Notes"] || "").trim(),
  };
}

function isRelevant(contact) {
  return Boolean(contact.data.Geburtstag) || (contact.data.tags?.length ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* TYP-System                                                          */
/* ------------------------------------------------------------------ */

function getTypSystem(app) {
  return app.plugins.plugins["typ-system"] ?? null;
}

// Die Feldliste kommt aus dem TYP-System, damit sie nur an einer Stelle
// gepflegt werden muss. Läuft es nicht, greift die interne Liste.
function contactPropertyKeys(app, typ) {
  const defaults = getTypSystem(app)?.getTypeDefaults?.(typ, { includeFloating: true });
  const keys = defaults ? Object.keys(defaults) : null;
  return keys && keys.length > 0 ? keys : FALLBACK_CONTACT_KEYS;
}

/* ------------------------------------------------------------------ */
/* Bestehende Notizen                                                  */
/* ------------------------------------------------------------------ */

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

// Der Dateiname war bisher der einzige Schlüssel - eine Umbenennung in
// Google erzeugte dadurch ein Duplikat und ließ die alte Notiz mit ihren
// Familie-/Freunde-Backlinks verwaist zurück. Telefonnummer und E-Mail
// stehen ohnehin schon in den Notizen und sind über den Bestand eindeutig,
// taugen also als Identität, ohne dass eine technische ID nötig wäre.
function buildNoteIndex(app, baseDir, typ) {
  const byPhone = new Map();
  const byEmail = new Map();
  const byName = new Map();
  const notes = [];

  for (const file of app.vault.getMarkdownFiles()) {
    if (!isInFolder(file.path, baseDir)) continue;
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    if (String(frontmatter.TYP ?? frontmatter.typ ?? "") !== typ) continue;

    const entry = { file, frontmatter };
    notes.push(entry);

    for (const key of ["Handynummer", "Handynummer-Alt", "Festnetz"]) {
      for (const value of toArray(frontmatter[key])) {
        const phone = normalizePhone(value);
        if (phone && !byPhone.has(phone)) byPhone.set(phone, entry);
      }
    }
    for (const key of ["E-Mail", "E-Mail-Alt"]) {
      for (const value of toArray(frontmatter[key])) {
        const email = normalizeEmail(value);
        if (email && !byEmail.has(email)) byEmail.set(email, entry);
      }
    }
    const name = file.basename.toLowerCase();
    if (!byName.has(name)) byName.set(name, entry);
  }

  return { byPhone, byEmail, byName, notes };
}

function matchNote(index, contact, taken) {
  for (const phone of contact.phones) {
    const hit = index.byPhone.get(phone);
    if (hit && !taken.has(hit.file.path)) return { entry: hit, via: "Telefon" };
  }
  for (const email of contact.emails) {
    const hit = index.byEmail.get(email);
    if (hit && !taken.has(hit.file.path)) return { entry: hit, via: "E-Mail" };
  }
  const hit = index.byName.get(contact.baseName.toLowerCase());
  if (hit && !taken.has(hit.file.path)) return { entry: hit, via: "Name" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Eindeutige Dateinamen                                               */
/* ------------------------------------------------------------------ */

// Gleichnamige Kontakte überschrieben sich bisher gegenseitig, ohne dass
// es auffiel - im Bestand betrifft das 15 Namen. Der Zusatz kommt aus den
// letzten vier Ziffern der Handynummer, weil die über Läufe hinweg stabil
// ist; eine Durchnummerierung hinge dagegen an der CSV-Zeilenreihenfolge
// und könnte beim nächsten Export Werte zwischen Notizen verschieben.
function uniqueSuffix(contact) {
  const phone = contact.phones[0];
  if (phone && phone.length >= 4) return phone.slice(-4);
  const email = contact.emails[0];
  if (email) {
    // \W würde Umlaute mitentfernen ("bölte" -> "blte"); \p{L} mit u-Flag
    // behält sie und wirft nur Punkte, Plus und Ähnliches raus.
    const local = email.split("@")[0].replace(/[^\p{L}\p{N}]/gu, "");
    if (local.length >= 4) return local.slice(-4);
  }
  return null;
}

function assignFileNames(contacts, skipped) {
  const byName = new Map();
  for (const contact of contacts) {
    const key = contact.baseName.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(contact);
  }

  const result = [];
  for (const group of byName.values()) {
    if (group.length === 1) {
      group[0].fileName = sanitizeFileName(group[0].baseName);
      result.push(group[0]);
      continue;
    }
    const used = new Set();
    for (const contact of group) {
      const suffix = uniqueSuffix(contact);
      if (!suffix || used.has(suffix)) {
        skipped.push({
          name: contact.baseName,
          reason: suffix ? "gleicher Namenszusatz wie ein anderer Kontakt" : "Namensgleichheit ohne Nummer oder E-Mail",
        });
        continue;
      }
      used.add(suffix);
      contact.fileName = sanitizeFileName(`${contact.baseName} (${suffix})`);
      result.push(contact);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

function valuesEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = toArray(a).map(String);
    const y = toArray(b).map(String);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  if (a === undefined || a === null || a === "") return b === undefined || b === null || b === "";
  return String(a) === String(b);
}

// tags werden zusammengeführt statt ersetzt: in den Notizen stehen auch
// Tags, die nie aus Google kamen.
function mergeTags(existing, incoming) {
  return [...new Set([...toArray(incoming).map(String), ...toArray(existing).map(String)])];
}

// Sollwerte gegen den Ist-Zustand der Notiz. Liefert die CSV zu einer
// Property nichts mehr, obwohl ihre Quellspalte im Export vorkommt, gilt
// der Wert als in Google gelöscht und wird zur Entfernung vorgemerkt
// (to: undefined) - was dann je nach Konflikt-Modus greift oder nicht.
// tags sind davon ausgenommen: dort stehen auch Tags, die nie aus Google
// kamen, deshalb wird nur zusammengeführt, nie entfernt.
function buildChanges(contact, frontmatter, ownedKeys, removableKeys) {
  const changes = [];
  for (const key of ownedKeys) {
    let value = contact.data[key];
    if (key === "tags") {
      if (value === undefined && toArray(frontmatter.tags).length === 0) continue;
      value = mergeTags(frontmatter.tags, value);
    }
    if (value === undefined) {
      const existing = frontmatter[key];
      const hasExisting = !(existing === undefined || existing === null || existing === "" || toArray(existing).length === 0);
      if (!hasExisting || !removableKeys?.has(key)) continue;
      changes.push({ key, from: existing, to: undefined });
      continue;
    }
    if (valuesEqual(frontmatter[key], value)) continue;
    changes.push({ key, from: frontmatter[key], to: value });
  }
  return changes;
}

// Derselbe Wert in anderer Schreibweise, auf eine Vergleichsform gebracht.
// Nötig, damit eine Normalisierung nicht als Konflikt durchgeht: in der
// Notiz steht "+49 177 3072177", die CSV liefert dieselbe Nummer - das ist
// keine Abweichung, über die man den Nutzer befragen müsste.
function canonicalValue(key, value) {
  const parts = toArray(value).map(String);
  if (key === "Handynummer" || key === "Handynummer-Alt" || key === "Festnetz") {
    return parts.map(normalizePhone).join("|");
  }
  if (key === "E-Mail" || key === "E-Mail-Alt") return parts.map(normalizeEmail).join("|");
  if (key === "Nation") return parts.map(normalizeCountry).join("|");
  if (key === "Strasse") return parts.map(normalizeStreet).join("|");
  return parts.join("|");
}

// Eine Änderung ist nur dann ein Konflikt, wenn die Notiz schon einen
// inhaltlich abweichenden Wert hatte. Leere Felder zu füllen ist nie ein
// Konflikt, tags werden zusammengeführt statt überschrieben, und eine reine
// Umschreibung (Telefonformat, Groß-/Kleinschreibung, Länderkürzel, Haus-
// nummer) wird immer angewandt - sonst bliebe sie im Modus "nur Lücken
// füllen" für immer liegen.
function splitChanges(changes, frontmatter) {
  const plain = [];
  const conflicts = [];
  for (const change of changes) {
    const existing = frontmatter[change.key];
    const isEmpty = existing === undefined || existing === null || existing === "" || toArray(existing).length === 0;
    const sameValue = canonicalValue(change.key, existing) === canonicalValue(change.key, change.to);
    if (isEmpty || sameValue || change.key === "tags") plain.push(change);
    else conflicts.push(change);
  }
  return { changes: plain, conflicts };
}

async function buildPlan(plugin) {
  const { app, settings } = plugin;
  const { adapter } = app.vault;
  const csvPath = settings.contactsCsvPath;
  const configuredDir = settings.contactsBaseDir.replace(/\/$/, "");
  const typ = settings.contactsTyp || "KONTAKT";

  if (!(await adapter.exists(csvPath))) throw new Error(`Datei nicht gefunden: ${csvPath}`);
  if (!(await adapter.exists(configuredDir))) throw new Error(`Basisverzeichnis nicht gefunden: ${configuredDir}`);

  const baseDir = resolveFolderPath(app, configuredDir);
  const trashDir = joinVaultPath(baseDir, settings.contactsTrashSubdir || "_Trash");

  const corrections = [];
  const skipped = [];
  const normalize = settings.contactsNormalizeEnabled !== false;
  const rows = csvToObjects(await adapter.read(csvPath));

  let contacts = [];
  for (const row of rows) {
    const contact = buildContact(row, corrections, normalize);
    if (!contact.baseName) {
      skipped.push({ name: "(ohne Namen)", reason: "weder Vor- noch Nachname" });
      continue;
    }
    if (settings.contactsFilterRelevant && !isRelevant(contact)) continue;
    contacts.push(contact);
  }
  contacts = assignFileNames(contacts, skipped);

  const index = buildNoteIndex(app, baseDir, typ);
  const typKeys = contactPropertyKeys(app, typ);
  const ownedKeys = new Set(IMPORT_OWNED_KEYS.filter((key) => key === "tags" || typKeys.includes(key)));

  // Nur Properties, deren Quellspalte dieser Export überhaupt mitbringt,
  // dürfen geleert werden - sonst räumt ein knapperer Export Felder ab,
  // über die er gar keine Aussage trifft.
  const header = new Set(rows.length > 0 ? Object.keys(rows[0]) : []);
  const removableKeys = new Set(
    [...ownedKeys].filter((key) => key !== "tags" && (SOURCE_COLUMNS[key] ?? []).some((column) => header.has(column)))
  );

  const actions = [];
  const taken = new Set();

  for (const contact of contacts) {
    const match = matchNote(index, contact, taken);
    const targetPath = joinVaultPath(baseDir, `${contact.fileName}.md`);

    if (!match) {
      if (settings.contactsEditOnly) {
        skipped.push({ name: contact.baseName, reason: "neu, aber „Nur bestehende aktualisieren“ ist aktiv" });
        continue;
      }
      actions.push({
        kind: "create",
        contact,
        targetPath,
        changes: buildChanges(contact, {}, ownedKeys, removableKeys),
        conflicts: [],
      });
      continue;
    }

    taken.add(match.entry.file.path);
    const split = splitChanges(
      buildChanges(contact, match.entry.frontmatter, ownedKeys, removableKeys),
      match.entry.frontmatter
    );
    const rename = match.entry.file.path !== targetPath ? targetPath : null;
    if (split.changes.length === 0 && split.conflicts.length === 0 && !rename) continue;

    actions.push({
      kind: "update",
      contact,
      file: match.entry.file,
      via: match.via,
      targetPath,
      rename,
      changes: split.changes,
      conflicts: split.conflicts,
    });
  }

  // Notizen, zu denen keine CSV-Zeile mehr passt: in Google gelöscht oder
  // durch den Relevanzfilter gefallen.
  const orphans = index.notes.filter((entry) => !taken.has(entry.file.path) && !isInFolder(entry.file.path, trashDir));

  return { typ, baseDir, trashDir, contacts, actions, orphans, corrections, skipped, ownedKeys };
}

/* ------------------------------------------------------------------ */
/* Konflikt-Modal                                                      */
/* ------------------------------------------------------------------ */

function formatValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

// Ein Dialog je betroffenem Kontakt. "Rest automatisch" bricht die Kette
// ab, damit ein Lauf mit vielen Abweichungen nicht zum Klickmarathon wird.
class ConflictModal extends Modal {
  constructor(app, action, resolve) {
    super(app);
    this.action = action;
    this.resolve = resolve;
    this.accepted = new Set(action.conflicts.map((c) => c.key));
    this.answered = false;
  }

  onOpen() {
    const { contentEl, action } = this;
    contentEl.addClass("fred-kontakt-conflict");
    contentEl.createEl("h3", { text: action.contact.baseName });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `${action.conflicts.length} abweichende ${
        action.conflicts.length === 1 ? "Property" : "Properties"
      }. Angehakt wird der CSV-Wert übernommen.`,
    });

    for (const conflict of action.conflicts) {
      const isRemoval = conflict.to === undefined;
      new Setting(contentEl)
        .setName(conflict.key + (isRemoval ? "  (in Google gelöscht)" : ""))
        .setDesc(
          isRemoval
            ? `Notiz: ${formatValue(conflict.from)}   →   aus der Notiz entfernen`
            : `Notiz: ${formatValue(conflict.from)}   →   CSV: ${formatValue(conflict.to)}`
        )
        .addToggle((toggle) =>
          toggle.setValue(true).onChange((value) => {
            if (value) this.accepted.add(conflict.key);
            else this.accepted.delete(conflict.key);
          })
        );
    }

    // Nicht als Setting-Zeile: vier Knöpfe nebeneinander sprengen deren
    // nicht umbrechende Control-Spalte und erzwingen horizontales Scrollen.
    // Obsidians modal-button-container darf dagegen umbrechen.
    const footer = contentEl.createDiv({ cls: "modal-button-container fred-kontakt-conflict-buttons" });
    const button = (text, cta, onClick) => {
      const btn = new ButtonComponent(footer).setButtonText(text).onClick(onClick);
      if (cta) btn.setCta();
      return btn;
    };
    button("Übernehmen", true, () => this.finish({ accepted: this.accepted }));
    button("Notiz behalten", false, () => this.finish({ accepted: new Set() }));
    button("Rest: CSV", false, () => this.finish({ accepted: this.accepted, restMode: "csv" }));
    button("Rest: Notiz", false, () => this.finish({ accepted: new Set(), restMode: "gaps" }));
  }

  finish(result) {
    this.answered = true;
    this.resolve(result);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    if (!this.answered) this.resolve({ accepted: new Set() });
  }
}

function askConflicts(app, action) {
  return new Promise((resolve) => new ConflictModal(app, action, resolve).open());
}

// Konflikte gemäß Modus auflösen und in die normale Änderungsliste
// überführen, damit applyPlan nur noch eine Sorte Änderung kennt.
async function resolveConflicts(plugin, actions) {
  let mode = plugin.settings.contactsConflictMode || "csv";
  for (const action of actions) {
    if (action.conflicts.length === 0) continue;
    if (mode === "csv") {
      action.changes.push(...action.conflicts);
    } else if (mode === "ask") {
      const { accepted, restMode } = await askConflicts(plugin.app, action);
      action.changes.push(...action.conflicts.filter((c) => accepted.has(c.key)));
      if (restMode) mode = restMode;
    }
    action.conflicts = [];
  }
}

/* ------------------------------------------------------------------ */
/* Fortschritt in der Statusleiste                                     */
/* ------------------------------------------------------------------ */

// Bewusst die Statusleiste statt einer Notice: so bleibt der Notice-Bereich
// frei für die Meldungen über Normalisierungen und Übersprungenes.
function createProgress(plugin, total) {
  const el = plugin.addStatusBarItem();
  el.addClass("fred-kontakt-progress");
  const label = el.createSpan({ cls: "fred-kontakt-progress-label" });
  const cancelBtn = el.createEl("span", { cls: "fred-kontakt-progress-cancel", text: "Abbrechen" });

  const state = {
    cancelled: false,
    update(done, name) {
      const width = 12;
      const filled = total > 0 ? Math.round((width * done) / total) : width;
      const bar = "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
      label.setText(`Kontakte ${bar} ${done}/${total}${name ? "  ·  " + name : ""}`);
    },
    finish() {
      el.remove();
    },
  };

  cancelBtn.addEventListener("click", () => {
    state.cancelled = true;
    cancelBtn.setText("wird abgebrochen …");
  });

  state.update(0, "");
  return state;
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

// Der SUBTYP gehört der Notiz, nicht dem Import: er kommt aus dem TYP-System
// oder von Hand, steht in keiner CSV-Spalte und darf einen Import unverändert
// überstehen. Gelesen wird er ohne Beachtung der Groß-/Kleinschreibung, weil
// Obsidian Property-Namen so behandelt ("Subtyp" und "SUBTYP" sind dieselbe
// Property) - genau wie das TYP-System es beim Schreiben tut.
function existingSubtyp(frontmatter) {
  const key = Object.keys(frontmatter).find((name) => name.toLowerCase() === "subtyp");
  const value = key === undefined ? undefined : frontmatter[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// Alles geht durch processFrontMatter und sortFrontmatter - der Import
// bringt damit keine eigene Reihenfolge mehr mit, sondern übernimmt die
// des TYP-Systems. Vorher fraßen sich beide gegenseitig auf: der Import
// zog tags nach vorn, die Frontmatter-Sortierung wieder nach hinten.
//
// Der Subtyp muss dabei durchgereicht werden: applyTypeProperties(fm, typ,
// null) LÖSCHT einen vorhandenen SUBTYP (siehe typ-system/src/main.js), und
// sortFrontmatter ohne Subtyp kennt dessen Property-Block nicht und schöbe
// die Subtyp-Properties ans Ende. Ein fest übergebenes null hätte deshalb,
// sobald KONTAKT Subtypen bekommt, bei jedem Update die Klassifizierung der
// Notiz stillschweigend mitgelöscht.
async function writeFrontmatter(app, file, changes, typ) {
  const typSystem = getTypSystem(app);
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    const subtyp = existingSubtyp(frontmatter);

    if (typSystem?.applyTypeProperties) typSystem.applyTypeProperties(frontmatter, typ, subtyp);
    else frontmatter.TYP = typ;

    for (const change of changes) {
      if (change.to === undefined || change.to === null || change.to === "") delete frontmatter[change.key];
      else frontmatter[change.key] = change.to;
    }

    typSystem?.sortFrontmatter?.(frontmatter, typ, subtyp);
  });
}

async function ensureFolder(app, path) {
  if (!path) return;
  if (!(await app.vault.adapter.exists(path))) await app.vault.createFolder(path).catch(() => {});
}

async function applyPlan(plugin, plan, progress) {
  const { app } = plugin;
  const stats = { created: 0, updated: 0, renamed: 0, trashed: 0, errors: 0 };
  const total = plan.actions.length + plan.orphans.length;
  let done = 0;

  for (const action of plan.actions) {
    if (progress?.cancelled) break;
    done++;
    progress?.update(done, action.contact.baseName);

    try {
      if (action.kind === "create") {
        await ensureFolder(app, plan.baseDir);
        const file = await app.vault.create(action.targetPath, action.contact.body ? action.contact.body + "\n" : "");
        await writeFrontmatter(app, file, action.changes, plan.typ);
        stats.created++;
        continue;
      }

      if (action.changes.length > 0) {
        await writeFrontmatter(app, action.file, action.changes, plan.typ);
        stats.updated++;
      }
      // Umbenennung zuletzt und über fileManager, damit Obsidian die
      // eingehenden Familie-/Freunde-Links mitzieht.
      if (action.rename) {
        await app.fileManager.renameFile(action.file, action.rename);
        stats.renamed++;
      }
    } catch (e) {
      stats.errors++;
      console.error("[Kontakt-Import] Fehler bei", action.contact.baseName, e);
    }
  }

  for (const orphan of plan.orphans) {
    if (progress?.cancelled) break;
    done++;
    progress?.update(done, orphan.file.basename);
    try {
      await ensureFolder(app, plan.trashDir);
      await app.fileManager.renameFile(orphan.file, joinVaultPath(plan.trashDir, orphan.file.name));
      stats.trashed++;
    } catch (e) {
      stats.errors++;
      console.error("[Kontakt-Import] Fehler beim Verschieben nach _Trash:", orphan.file.path, e);
    }
  }

  progress?.update(total, "");
  return stats;
}

/* ------------------------------------------------------------------ */
/* Bericht                                                             */
/* ------------------------------------------------------------------ */

function logGroup(title, lines) {
  if (lines.length === 0) return;
  console.groupCollapsed(`[Kontakt-Import] ${title}`);
  for (const line of lines) console.log(line);
  console.groupEnd();
}

function reportPlan(plan, stats, dryRun) {
  // Nach Feld gruppiert: bei dreistelligen Zahlen ist eine flache Liste
  // nicht mehr lesbar, und die Aufschlüsselung sagt auf einen Blick, ob
  // nur Telefonformate oder auch Adressen angefasst wurden.
  const byField = new Map();
  for (const c of plan.corrections) {
    if (!byField.has(c.field)) byField.set(c.field, []);
    byField.get(c.field).push(c);
  }
  const breakdown = [...byField.entries()].map(([field, list]) => `${list.length}× ${field}`);
  logGroup(
    `${plan.corrections.length} Normalisierungen (${breakdown.join(", ")})`,
    [...byField.entries()].flatMap(([field, list]) => [
      `── ${field} (${list.length})`,
      ...list.map((c) => `   ${c.name}: "${c.from}" → "${c.to}"`),
    ])
  );
  logGroup(
    `${plan.skipped.length} übersprungen`,
    plan.skipped.map((s) => `${s.name}: ${s.reason}`)
  );
  const renames = plan.actions.filter((a) => a.rename);
  logGroup(
    `${renames.length} Umbenennungen`,
    renames.map((a) => `${a.file?.path ?? "(neu)"} → ${a.rename} (erkannt über ${a.via})`)
  );
  logGroup(
    `${plan.orphans.length} nicht mehr in der CSV`,
    plan.orphans.map((o) => o.file.path)
  );
  // Geleerte Properties gesondert ausweisen: das ist der einzige Fall, in
  // dem der Import Daten aus einer Notiz entfernt.
  const cleared = plan.actions.flatMap((a) =>
    a.changes.filter((c) => c.to === undefined).map((c) => `${a.contact.baseName} – ${c.key}: "${formatValue(c.from)}" entfernt`)
  );
  logGroup(`${cleared.length} Properties geleert (in Google gelöscht)`, cleared);

  const parts = [
    `${stats.created} neu`,
    `${stats.updated} aktualisiert`,
    `${stats.renamed} umbenannt`,
    `${stats.trashed} nach _Trash`,
  ];
  if (cleared.length) parts.push(`${cleared.length} geleert`);
  if (plan.corrections.length) parts.push(`${plan.corrections.length} normalisiert`);
  if (plan.skipped.length) parts.push(`${plan.skipped.length} übersprungen`);
  if (stats.errors) parts.push(`${stats.errors} Fehler`);

  const summary = `${dryRun ? "[Probelauf] " : ""}Kontakt-Import: ${parts.join(", ")}. Details in der Konsole.`;
  console.log("[Kontakt-Import]", summary);
  new Notice(summary, 10000);
}

/* ------------------------------------------------------------------ */
/* Befehle                                                             */
/* ------------------------------------------------------------------ */

async function importContactsFromCsv(plugin) {
  let plan;
  try {
    plan = await buildPlan(plugin);
  } catch (e) {
    new Notice(`Kontakt-Import: ${e.message}`);
    console.error("[Kontakt-Import]", e);
    return;
  }

  await resolveConflicts(plugin, plan.actions);

  if (plugin.settings.contactsDryRun) {
    reportPlan(
      plan,
      {
        created: plan.actions.filter((a) => a.kind === "create").length,
        updated: plan.actions.filter((a) => a.kind === "update" && a.changes.length > 0).length,
        renamed: plan.actions.filter((a) => a.rename).length,
        trashed: plan.orphans.length,
        errors: 0,
      },
      true
    );
    return;
  }

  // Das Live-Property-Backlinking würde bei jeder geschriebenen Notiz einen
  // Lauf über den gesamten Vault auslösen. Einmal am Ende reicht.
  const progress = createProgress(plugin, plan.actions.length + plan.orphans.length);
  plugin.suspendPropertyBacklinks = true;
  let stats;
  try {
    stats = await applyPlan(plugin, plan, progress);
  } finally {
    plugin.suspendPropertyBacklinks = false;
    progress.finish();
  }

  if (progress.cancelled) new Notice("Kontakt-Import: abgebrochen.");
  reportPlan(plan, stats, false);
  await plugin.runPropertyBacklinkSync?.();
}

// Debugging-Hilfe: löscht Kontakte, die exakt so aussehen, wie der Import
// sie gerade anlegen würde - also nachweislich von niemandem angefasst
// wurden. Die alte Fassung prüfte nur, ob ausschließlich bekannte
// Property-NAMEN vorkamen, und hätte damit fast den ganzen Ordner erwischt;
// gerettet hat sie nur ein Schreibfehler im Ordnernamen, durch den sie
// überhaupt keine Datei fand.
async function deleteUntouchedContacts(plugin) {
  const { app } = plugin;
  let plan;
  try {
    plan = await buildPlan(plugin);
  } catch (e) {
    new Notice(`Kontakt-Import: ${e.message}`);
    return;
  }

  const sollByPath = new Map();
  for (const contact of plan.contacts) {
    sollByPath.set(joinVaultPath(plan.baseDir, `${contact.fileName}.md`).toLowerCase(), contact);
  }

  const index = buildNoteIndex(app, plan.baseDir, plan.typ);
  const candidates = [];

  for (const entry of index.notes) {
    if (isInFolder(entry.file.path, plan.trashDir)) continue;
    const contact = sollByPath.get(entry.file.path.toLowerCase());
    if (!contact) continue;

    // Fremde Properties (Familie/Freunde, eigene Ergänzungen) zählen als
    // "angefasst" - ebenso jeder abweichende Wert und jeder Fließtext, den
    // der Import nicht selbst geschrieben hat.
    //
    // Ausgenommen ist allein TYP: den setzt der Import selbst, er steht aber
    // nicht in ownedKeys. SUBTYP gehört bewusst NICHT in diese Ausnahme - er
    // ist eine Klassifizierung von Hand und damit gerade das Gegenteil von
    // "unverändert". Eine Notiz mit SUBTYP fällt hier also durch und bleibt
    // stehen; das ist die gewollte Richtung, weil hier gelöscht wird.
    const keys = Object.keys(entry.frontmatter).filter((key) => key !== "TYP");
    if (keys.some((key) => !plan.ownedKeys.has(key))) continue;
    if (keys.some((key) => !valuesEqual(entry.frontmatter[key], contact.data[key]))) continue;

    const raw = await app.vault.cachedRead(entry.file);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
    if (body !== (contact.body || "").trim()) continue;

    candidates.push(entry.file);
  }

  if (plugin.settings.contactsDryRun) {
    logGroup(
      `Probelauf: ${candidates.length} unverändert`,
      candidates.map((f) => f.path)
    );
    new Notice(`[Probelauf] ${index.notes.length} geprüft, ${candidates.length} unverändert.`);
    return;
  }

  let deleted = 0;
  let errors = 0;
  for (const file of candidates) {
    try {
      await app.fileManager.trashFile(file);
      console.log(`[Kontakt-Import] Unveränderter Kontakt gelöscht: ${file.path}`);
      deleted++;
    } catch (e) {
      errors++;
      console.error("[Kontakt-Import] Fehler beim Löschen:", file.path, e);
    }
  }

  new Notice(
    `Kontakt-Import: ${index.notes.length} geprüft, ${deleted} unveränderte gelöscht${errors ? `, ${errors} Fehler` : ""}.`
  );
}

module.exports = { importContactsFromCsv, deleteUntouchedContacts };

// Nur für Tests außerhalb von Obsidian - die reine Rechenlogik lässt sich
// so gegen die echte CSV prüfen, ohne den Vault anzufassen.
module.exports.__test = { buildPlan, normalizePhone, normalizeStreet, normalizeCountry, normalizeBirthday };
