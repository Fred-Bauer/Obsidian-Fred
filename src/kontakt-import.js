const { Notice, parseYaml, stringifyYaml } = require("obsidian");

/* ============================================================
 * Kontakte-CSV-Import
 * (Portierung von kontakt-update-csv.py)
 * ============================================================ */

const CONTACTS_COLUMNS = [
  "Labels",
  "First Name",
  "Middle Name",
  "Last Name",
  "Birthday",
  "E-mail 1 - Value",
  "Phone 1 - Value",
  "Address 1 - Street",
  "Address 1 - City",
  "Address 1 - Postal Code",
  "Address 1 - Country",
];

const CONTACTS_FIELD_MAPPING = {
  "Labels": "tags",
  "First Name": "Vorname",
  "Middle Name": "Zweitname",
  "Last Name": "Nachname",
  "Birthday": "Geburtstag",
  "Phone 1 - Value": "Handynummer",
  "E-mail 1 - Value": "E-Mail",
  "E-mail 2 - Value": "E-Mail-Alt",
  "Address 1 - Street": "Strasse",
  "Address 1 - Postal Code": "Plz",
  "Address 1 - City": "Stadt",
  "Address 1 - Country": "Nation",
};

function joinVaultPath(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== "")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

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
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    header.forEach((key, idx) => (obj[key] = row[idx] ?? ""));
    return obj;
  });
}

function processContactRow(row, firstNameColumn = "First Name", lastNameColumn = "Last Name") {
  const firstName = (row[firstNameColumn] || "").trim();
  const lastName = (row[lastNameColumn] || "").trim();

  let baseName;
  if (firstName && lastName) baseName = `${firstName} ${lastName}`;
  else if (firstName || lastName) baseName = firstName || lastName;
  else baseName = "_noname";

  const data = {};
  for (const [key, value] of Object.entries(row)) {
    if (CONTACTS_COLUMNS.includes(key) && value.trim()) {
      data[CONTACTS_FIELD_MAPPING[key] || key] = value.trim();
    }
  }

  return { baseName, data };
}

function transformContactFields(data, existingTags, starred) {
  const transformed = { ...data };

  try {
    if ("Geburtstag" in transformed) {
      const geburtstag = transformed.Geburtstag;
      if (geburtstag.startsWith("--")) {
        transformed.Geburtstag = "0001" + geburtstag.slice(1);
      }
    }

    if ("Handynummer" in transformed) {
      let phone = transformed.Handynummer.trim();
      if (phone.includes(" ::: ")) phone = phone.split(" ::: ")[0];
      transformed.Handynummer = phone.replace(/ /g, "").replace(/-/g, "");
    }

    let normalizedExisting = existingTags;
    if (typeof normalizedExisting === "string") normalizedExisting = [normalizedExisting];
    if (!Array.isArray(normalizedExisting)) normalizedExisting = [];
    const hasExisting = normalizedExisting.length > 0;

    if ("tags" in transformed || starred) {
      const newTags = (transformed.tags || "")
        .split(" ::: ")
        .filter((tag) => tag && tag !== "* myContacts" && tag !== "* starred")
        .map((tag) => tag.toLowerCase().replace(/ /g, "_"));
      if (starred) newTags.push("favorit");
      const hasNew = newTags.length > 0;

      if (hasExisting && hasNew) {
        transformed.tags = [...new Set([...newTags, ...normalizedExisting])];
      } else if (hasExisting) {
        transformed.tags = [...new Set(normalizedExisting)];
      } else if (hasNew) {
        transformed.tags = newTags;
      } else {
        delete transformed.tags;
      }
    }
  } catch (e) {
    console.error("[Kontakt-Import] Fehler bei der Daten-Transformation:", e);
  }

  return transformed;
}

function isStarredContact(rawTags) {
  if (!rawTags) return false;
  return rawTags
    .split(" ::: ")
    .map((tag) => tag.trim())
    .includes("* starred");
}

async function findExistingContactFile(adapter, baseName, searchDirs) {
  for (const dir of searchDirs) {
    const path = joinVaultPath(dir, `${baseName}.md`);
    if (await adapter.exists(path)) return path;
  }
  return null;
}

async function readContactFrontmatter(adapter, path) {
  const raw = await adapter.read(path);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, content: raw };
  return { frontmatter: parseYaml(match[1]) || {}, content: raw.slice(match[0].length) };
}

async function writeContactFile(adapter, path, frontmatter, content) {
  const ordered = { TYP: "KONTAKT" };
  if ("aliases" in frontmatter) ordered.aliases = frontmatter.aliases;
  if ("tags" in frontmatter) ordered.tags = frontmatter.tags;
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!(key in ordered)) ordered[key] = value;
  }
  const fileContent = `---\n${stringifyYaml(ordered)}---\n${content}`;

  const dir = path.split("/").slice(0, -1).join("/");
  if (dir && !(await adapter.exists(dir))) await adapter.mkdir(dir);
  await adapter.write(path, fileContent);
}

const AUTO_MANAGED_FRONTMATTER_KEYS = new Set([
  "cssclasses",
  "TYP",
  "aliases",
  "tags",
  ...Object.values(CONTACTS_FIELD_MAPPING),
]);

function isUntouchedContact(frontmatter, content) {
  if (content.trim().length > 0) return false;
  return Object.keys(frontmatter).every((key) => AUTO_MANAGED_FRONTMATTER_KEYS.has(key));
}

async function safeRemoveContactFile(adapter, path) {
  // Papierkorb statt permanentem Löschen, falls beim Zusammenführen der
  // Unterordner mal etwas schiefgeht.
  try {
    const trashedToSystem = await adapter.trashSystem(path);
    if (!trashedToSystem) await adapter.trashLocal(path);
  } catch (e) {
    await adapter.remove(path);
  }
}

async function importContactsFromCsv(app, settings) {
  const { adapter } = app.vault;
  const csvPath = settings.contactsCsvPath;
  const basisVerzeichnis = settings.contactsBaseDir.replace(/\/$/, "");

  if (!(await adapter.exists(csvPath))) {
    new Notice(`Kontakt-Import: Datei nicht gefunden: ${csvPath}`);
    return;
  }
  if (!(await adapter.exists(basisVerzeichnis))) {
    new Notice(`Kontakt-Import: Basisverzeichnis nicht gefunden: ${basisVerzeichnis}`);
    return;
  }

  const { folders } = await adapter.list(basisVerzeichnis);
  const searchDirs = [basisVerzeichnis, ...folders.sort()];

  const rows = csvToObjects(await adapter.read(csvPath));

  let created = 0;
  let updated = 0;
  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const { baseName, data: rawData } = processContactRow(row);
      const starred = isStarredContact(rawData.tags);
      const existingFile = await findExistingContactFile(adapter, baseName, searchDirs);

      if (existingFile) {
        const { frontmatter: existingFrontmatter, content } = await readContactFrontmatter(adapter, existingFile);
        const newData = transformContactFields(rawData, existingFrontmatter.tags, starred);

        if (settings.contactsFilterRelevant && !newData.Geburtstag && (!newData.tags || newData.tags.length < 1)) {
          skipped++;
          continue;
        }

        const updatedFrontmatter = { ...existingFrontmatter, ...newData };
        // Alles landet flach direkt im Basisverzeichnis, keine Unterordner mehr.
        const targetPath = joinVaultPath(basisVerzeichnis, `${baseName}.md`);
        await writeContactFile(adapter, targetPath, updatedFrontmatter, content);

        if (targetPath !== existingFile) {
          await safeRemoveContactFile(adapter, existingFile);
          moved++;
        } else {
          updated++;
        }
      } else if (!settings.contactsEditOnly) {
        const newData = transformContactFields(rawData, undefined, starred);

        if (settings.contactsFilterRelevant && !newData.Geburtstag && (!newData.tags || newData.tags.length < 1)) {
          skipped++;
          continue;
        }

        const newPath = joinVaultPath(basisVerzeichnis, `${baseName}.md`);
        await writeContactFile(adapter, newPath, newData, "");
        created++;
      }
    } catch (e) {
      errors++;
      console.error("[Kontakt-Import] Fehler bei Kontakt-Zeile:", row, e);
    }
  }

  const summary = `Kontakt-Import: ${created} neu, ${updated} aktualisiert, ${moved} aus Unterordnern zusammengeführt, ${skipped} übersprungen${
    errors ? `, ${errors} Fehler (siehe Konsole)` : ""
  }.`;
  console.log("[Kontakt-Import]", summary);
  new Notice(summary);
}

async function deleteUntouchedContacts(app, settings) {
  const { adapter } = app.vault;
  const basisVerzeichnis = settings.contactsBaseDir.replace(/\/$/, "");

  if (!(await adapter.exists(basisVerzeichnis))) {
    new Notice(`Kontakt-Import: Basisverzeichnis nicht gefunden: ${basisVerzeichnis}`);
    return;
  }

  const contactFiles = app.vault
    .getMarkdownFiles()
    .filter((file) => file.path === basisVerzeichnis || file.path.startsWith(basisVerzeichnis + "/"))
    .filter((file) => app.metadataCache.getFileCache(file)?.frontmatter?.TYP === "KONTAKT");

  let deleted = 0;
  let errors = 0;

  for (const file of contactFiles) {
    try {
      const { frontmatter, content } = await readContactFrontmatter(adapter, file.path);
      if (!isUntouchedContact(frontmatter, content)) continue;

      await safeRemoveContactFile(adapter, file.path);
      console.log(`[Kontakt-Import] Unveränderter Kontakt gelöscht: ${file.path}`);
      deleted++;
    } catch (e) {
      errors++;
      console.error("[Kontakt-Import] Fehler beim Prüfen/Löschen:", file.path, e);
    }
  }

  const summary = `Kontakt-Import: ${contactFiles.length} geprüft, ${deleted} unveränderte gelöscht${
    errors ? `, ${errors} Fehler (siehe Konsole)` : ""
  }.`;
  console.log("[Kontakt-Import]", summary);
  new Notice(summary);
}

module.exports = { importContactsFromCsv, deleteUntouchedContacts };
