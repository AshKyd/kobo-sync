import fs from 'node:fs/promises';
import syncAnnotation from './syncAnnotation.js';
import lookupIsbn from './lookupIsbn.js';

export default async function syncAllAnnotations({
  annotationsFile = "",
  apiToken = '',
  apiUrl = ''
}) {
  // Validate required parameters
  if (!apiToken) {
    throw new Error("Hardcover API token is required");
  }
  if (!apiUrl) {
    throw new Error("Hardcover API URL is required");
  }

  let annotations;
  try {
    const fileContent = await fs.readFile(annotationsFile, 'utf8');
    annotations = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Failed to read or parse annotations file: ${error.message}`);
  }

  const bookCache = new Map();

  console.log(`Starting sync for ${annotations.length} items...`);

  for (const koboAnnotation of annotations) {
    if (koboAnnotation.synced || koboAnnotation.deleted) continue;

    const cacheKey = koboAnnotation.title.toLowerCase().trim();
    let bookInfo = null;

    try {
      // 1. Check Cache First
      if (bookCache.has(cacheKey)) {
        bookInfo = bookCache.get(cacheKey);
      } else {
        // 2. Determine if we need an expensive lookup
        const hasValidIsbn = koboAnnotation.isbn && koboAnnotation.isbn !== "No ISBN";

        if (hasValidIsbn) {
          console.log(`Using existing ISBN for: ${koboAnnotation.title}`);
          // Structure matches what lookupIsbn would return
          bookInfo = { isbn: koboAnnotation.isbn };
        } else {
          console.log(`Performing expensive lookup for: ${koboAnnotation.title}`);
          bookInfo = await lookupIsbn(koboAnnotation, { apiToken, apiUrl });
        }

        // 3. Memoize the result (even if null!)
        bookCache.set(cacheKey, bookInfo);
      }

      // 4. Handle missing info
      if (!bookInfo) {
        console.warn(`⚠️ Could not resolve book info for: ${koboAnnotation.title}. Skipping.`);
        continue;
      }

      // 5. Sync
      const result = await syncAnnotation({...koboAnnotation, ...bookInfo}, { apiToken, apiUrl });

      if (result && !result.errors) {
        koboAnnotation.synced = true;
        koboAnnotation.isbn = bookInfo.isbn; // Ensure koboAnnotation is updated with found ISBN
        console.log(`✅ Synced: ${koboAnnotation.title} (ID: ${koboAnnotation.id})`);
      } else {
        console.error(`❌ API Error for ${koboAnnotation.id}:`, result?.errors);
      }

    } catch (err) {
      console.error(`🔥 Processing error for ${koboAnnotation.id}:`, err.message);
      console.log(err)
    }
  }

  // 6. Save once at the end (or every X items) to protect disk I/O
  await fs.writeFile(annotationsFile, JSON.stringify(annotations, null, 2));
  console.log("\nSync job complete. File updated.");
  return annotations;
}