import fs from 'node:fs/promises';
import syncAnnotation from './syncAnnotation.js';
import lookupIsbn from './lookupIsbn.js';

const FILE_PATH = 'annotations.json';

async function runSync() {
  const annotations = JSON.parse(await fs.readFile(FILE_PATH, 'utf8'));
  const bookCache = new Map();

  console.log(`Starting sync for ${annotations.length} items...`);

  for (const item of annotations) {
    if (item.synced || item.deleted) continue;

    const cacheKey = item.title.toLowerCase().trim();
    let bookInfo = null;

    try {
      // 1. Check Cache First
      if (bookCache.has(cacheKey)) {
        bookInfo = bookCache.get(cacheKey);
      } else {
        // 2. Determine if we need an expensive lookup
        const hasValidIsbn = item.isbn && item.isbn !== "No ISBN";

        if (hasValidIsbn) {
          console.log(`Using existing ISBN for: ${item.title}`);
          // Structure matches what lookupIsbn would return
          bookInfo = { isbn: item.isbn }; 
        } else {
          console.log(`Performing expensive lookup for: ${item.title}`);
          bookInfo = await lookupIsbn(item);
        }

        // 3. Memoize the result (even if null!)
        bookCache.set(cacheKey, bookInfo);
      }

      // 4. Handle missing info
      if (!bookInfo) {
        console.warn(`⚠️ Could not resolve book info for: ${item.title}. Skipping.`);
        continue;
      }

      // 5. Sync
      const result = await syncAnnotation(item, bookInfo);

      if (result && !result.errors) {
        item.synced = true;
        item.isbn = bookInfo.isbn; // Ensure item is updated with found ISBN
        console.log(`✅ Synced: ${item.title} (ID: ${item.id})`);
      } else {
        console.error(`❌ API Error for ${item.id}:`, result?.errors);
      }

    } catch (err) {
      console.error(`🔥 Processing error for ${item.id}:`, err.message);
    }
  }

  // 6. Save once at the end (or every X items) to protect disk I/O
  await fs.writeFile(FILE_PATH, JSON.stringify(annotations, null, 2));
  console.log("\nSync job complete. File updated.");
}

runSync();