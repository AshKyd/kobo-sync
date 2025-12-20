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
  if (!dbPath || !outputFile) throw new Error("Paths are required");

  let existingNotes = [];
  try {
    existingNotes = JSON.parse(await fs.readFile(outputFile, "utf8"));
  } catch (e) {
    console.warn(`Creating a new annotations file.`);
  }

  const sqlite = await import("node:sqlite");
  const db = new sqlite.default.DatabaseSync(dbPath);
  const myNotes = getAnnotations(db, since);

  const myNotesIds = new Set(myNotes.map((n) => n.id));
  const existingIds = new Set(existingNotes.map((n) => n.id));
  const newItems = myNotes.filter((n) => !existingIds.has(n.id));

  const finalData = [
    ...existingNotes.map((n) => ({
      ...n,
      existsOnDevice: myNotesIds.has(n.id),
    })),
    ...newItems.map((n) => ({ ...n, existsOnDevice: true })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  await fs.writeFile(outputFile, JSON.stringify(finalData, null, 2));
  console.log(`Found ${myNotes.length} notes (${newItems.length} new).`);
  return finalData;
}
