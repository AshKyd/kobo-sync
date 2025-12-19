import fs from "node:fs/promises";
/**
 * Fetches annotations from the Kobo database, including highlights
 * from books that have been returned or deleted.
 */
function getAnnotations(db, since = "1970-01-01") {
  const sql = `
    SELECT 
      b.BookmarkID as id,
      -- Extract a title from the VolumeID path if the content table row is gone
      COALESCE(
        c_book.Title, 
        od.title, 
        REPLACE(REPLACE(b.VolumeID, 'file:///mnt/onboard/', ''), '.epub', '')
      ) as title,
      COALESCE(c_book.ISBN, 'No ISBN') as isbn,
      b.DateCreated as time,
      COALESCE(c_chapter.Title, 'Unknown Chapter') as chapter,
      b.Annotation as annotation,
      b.Text as highlightedText
    FROM Bookmark b
    -- Use a LEFT JOIN on a substring match for VolumeID 
    -- This fixes cases where Bookmark has a URL but Content has a filename
    LEFT JOIN content c_book 
      ON b.VolumeID = c_book.ContentID 
      OR b.VolumeID LIKE '%' || c_book.ContentID
    LEFT JOIN content c_chapter 
      ON b.ContentID = c_chapter.ContentID
    LEFT JOIN OverDriveCheckoutBook od 
      ON b.VolumeID = od.id
    WHERE b.DateCreated >= ?
      -- We check for both Text and Annotation to catch 'empty' bookmarks
      AND (b.Text IS NOT NULL OR b.Annotation IS NOT NULL OR b.Type = 'highlight')
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
  console.log(
    `Extracted ${myNotes.length} annotations and merged with existing data.`
  );
  return finalData;
}
