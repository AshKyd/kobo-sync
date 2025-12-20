import fs from "node:fs/promises";
/**
 * Fetches annotations from the Kobo database, including highlights
 * from books that have been returned or deleted.
 */
function getAnnotations(db, since = "1970-01-01") {
  /*
   * b = Bookmark (The highlights & notes)
   * c = content  (Book-level metadata like Title/ISBN)
   * v = content  (Volume/Chapter-level metadata)
   * o = OverDriveCheckoutBook (Library book metadata fallback)
   */
  const sql = `
    SELECT 
      b.BookmarkID as id,
      COALESCE(c.Title, o.title) as title,
      c.ISBN as isbn,
      b.DateCreated as time,
      v.Title as chapter,
      b.Annotation as annotation,
      b.Text as highlightedText
    FROM Bookmark b
    -- Join for Book Title: Matches VolumeID to root content record
    LEFT JOIN content c 
      ON b.VolumeID = c.ContentID 
      OR b.VolumeID LIKE '%' || c.ContentID
    -- Join for Chapter: Matches ContentID to specific section record
    LEFT JOIN content v 
      ON b.ContentID = v.ContentID
    -- Join for Library Books: Fallback for OverDrive titles
    LEFT JOIN OverDriveCheckoutBook o 
      ON b.VolumeID = o.id
    WHERE b.DateCreated >= ?
      AND b.Text IS NOT NULL 
      AND b.Text != ''
    ORDER BY b.DateCreated DESC
  `;

  try {
    const query = db.prepare(sql);
    return query.all(since);
  } catch (err) {
    console.error("Query Error:", err.message);
    return [];
  }
}

export default async function extractAnnotations({
  dbPath = "",
  outputFile = "",
  since = "1970-01-01",
}) {
  if (!dbPath) {
    throw new Error("Database path is required");
  }

  if (!outputFile) {
    throw new Error("Output file path is required");
  }

  let existingNotes = [];
  try {
    const fileContent = await fs.readFile(outputFile, "utf8");
    existingNotes = JSON.parse(fileContent);
  } catch (error) {
    // If file doesn't exist or is invalid, we'll start with an empty array
    console.warn(`Creating a new annotations file.`);
  }
  const sqlite = await import("node:sqlite");
  const db = new sqlite.default.DatabaseSync(dbPath);
  const myNotes = getAnnotations(db, since);

  // Create a set of existing annotation IDs for quick lookup
  const existingIds = new Set(existingNotes.map((note) => note.id));

  // Filter to find only NEW annotations (ones that don't exist in the file yet)
  const newNotes = myNotes.filter((note) => !existingIds.has(note.id));

  // Merge and De-duplicate
  // We create a Map using the 'id' as the key.
  // New notes will overwrite existing ones if the ID matches (useful if you updated a note).
  const mergedMap = new Map();

  // Add new notes into the map (overwriting duplicates)
  myNotes.forEach((note) => mergedMap.set(note.id, note));

  // Load old notes into the map
  existingNotes.forEach((note) => mergedMap.set(note.id, note));

  // Convert back to array and sort by time (newest first)
  const finalData = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.time) - new Date(a.time)
  );

  await fs.writeFile(outputFile, JSON.stringify(finalData, null, 2));
  console.log(`Found ${myNotes.length} annotations (${newNotes.length} new).`);
  return finalData;
}
