import hardcoverApiRequest from './hardcover.js';

async function getHardcoverIds(isbn, { apiToken, apiUrl }) {
  if (!isbn || isbn === "No ISBN") return null;

  const query = `
    query findById($isbn: String!) {
      books(where: {editions: {_or: [{isbn_10: {_eq: $isbn}}, {isbn_13: {_eq: $isbn}}]}}) {
        id
        editions(where: {_or: [{isbn_10: {_eq: $isbn}}, {isbn_13: {_eq: $isbn}}]}) {
          id
        }
      }
    }`;

  const result = await hardcoverApiRequest({
    query,
    variables: { isbn },
    apiToken,
    apiUrl
  });

  if (result === null) {
    throw new Error("Failed to fetch book IDs from Hardcover API");
  }

  const book = result.data?.books?.[0];
  return book ? { bookId: book.id, editionId: book.editions[0].id } : null;
}

export default async function syncAnnotation(koboAnnotation, { apiToken, apiUrl }) {
  if (!koboAnnotation) {
    throw new Error("Kobo annotation is required");
  }
  
  const ids = await getHardcoverIds(koboAnnotation.isbn, { apiToken, apiUrl });

  if (!ids) {
    console.error(`Skipping: No book found for "${koboAnnotation.title}" ISBN ${koboAnnotation.isbn}`);
    return;
  }

  const isNote = koboAnnotation.annotation?.trim().length > 0;
  const entryText = isNote
    ? `${koboAnnotation.highlightedText}\n\n============\n\n${koboAnnotation.annotation}`
    : koboAnnotation.highlightedText;

  const mutation = `
    mutation postquote($bookId: Int!, $editionId: Int!, $entry: String!, $event: String!) {
      insert_reading_journal(object: {
        privacy_setting_id: 1,
        book_id: $bookId,
        edition_id: $editionId,
        event: $event,
        tags: {spoiler: false, category: "quote", tag: ""},
        entry: $entry
      }) {
        id
      }
    }`;

  const result = await hardcoverApiRequest({
    query: mutation,
    variables: {
      bookId: ids.bookId,
      editionId: ids.editionId,
      entry: entryText,
      event: isNote ? "annotation" : "quote",
    },
    apiToken,
    apiUrl
  });

  if (result === null) {
    throw new Error("Failed to sync annotation with Hardcover API");
  }

  return result;
}
