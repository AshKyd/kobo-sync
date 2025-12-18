import 'dotenv/config';
/**
 * Normalizes strings by removing subtitles, punctuation, and extra whitespace.
 */
const normalize = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(':')[0]                // Remove subtitles (e.g., "Leviathan: A Novel")
    .replace(/[^\w\s]/gi, '')     // Remove punctuation
    .replace(/\s+/g, ' ')         // Collapse whitespace
    .trim();
};

/**
 * Finds the best book match in the user's library using a scoring system.
 * Prevents "Iris" from matching "Shadow of Iris" by checking word coverage.
 */
function findBookInLibrary(koboTitle, library) {
  const target = normalize(koboTitle);
  const targetWords = target.split(' ');
  
  let bestMatch = null;
  let highestScore = 0;

  for (const item of library) {
    const candidate = normalize(item.book.title);
    const candidateWords = candidate.split(' ');
    
    // 1. Exact match gets top priority
    if (target === candidate) {
      return item.book; 
    }

    // 2. Word-based intersection
    const matchedWords = targetWords.filter(word => candidateWords.includes(word));
    
    // Coverage: How much of the total words are shared?
    // This prevents "Iris" (1 word) from matching "The Iris Messenger" (3 words)
    // because coverage would only be 1/3 (33%)
    const coverage = matchedWords.length / Math.max(targetWords.length, candidateWords.length);

    if (coverage > 0.75) { // Threshold: Must share at least 75% of words
      const score = coverage * 100;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item.book;
      }
    }
  }

  return bestMatch;
}

/**
 * Main Lookup function: fetches library, performs fuzzy match, and returns ISBN.
 */
export default async function lookupISBN(koboAnnotation) {
  const query = `
    query getMyLibrary {
      me {
        user_books {
          book {
            id
            title
            editions {
              id
              isbn_10
              isbn_13
            }
          }
        }
      }
    }`;

  try {
    const response = await fetch(process.env.HARDCOVER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HARDCOVER_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    const userBooks = result.data?.me?.[0]?.user_books || [];

    const matchedBook = findBookInLibrary(koboAnnotation.title, userBooks);

    if (!matchedBook) {
      console.warn(`No confident match found for: "${koboAnnotation.title}"`);
      return null;
    }

    // Prefer ISBN-13, fall back to ISBN-10
    const primaryEdition = matchedBook.editions[0];
    const foundIsbn = primaryEdition?.isbn_13 || primaryEdition?.isbn_10 || "No ISBN Found";

    console.log(`Fuzzy matched "${koboAnnotation.title}" -> ISBN: ${foundIsbn}`);

    return {
      bookId: matchedBook.id,
      editionId: primaryEdition?.id,
      isbn: foundIsbn
    };
  } catch (err) {
    console.error("Library lookup failed:", err.message);
    throw err
    return null;
  }
}