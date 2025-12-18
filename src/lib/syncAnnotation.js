/**
 * 1. Find Hardcover IDs using ISBN
 */
async function getHardcoverIds(isbn, { apiToken, apiUrl }) {
  if (!isbn || isbn === "No ISBN") return null;

  // Validate API parameters
  if (!apiToken) {
    throw new Error("API token is required");
  }
  if (!apiUrl) {
    throw new Error("API URL is required");
  }

  const query = `
    query findById($isbn: String!) {
      books(where: {editions: {_or: [{isbn_10: {_eq: $isbn}}, {isbn_13: {_eq: $isbn}}]}}) {
        id
        editions(where: {_or: [{isbn_10: {_eq: $isbn}}, {isbn_13: {_eq: $isbn}}]}) {
          id
        }
      }
    }`;

  
  const fetchOptions = {
    method: "POST",
    headers: {
      Authorization: 'Bearer ' + apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { isbn } }),
  }
  
  let response;
  try {
    response = await fetch(apiUrl, fetchOptions);
  } catch (error) {
    throw new Error(`Failed to connect to API: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  if(json.errors){
    console.error(JSON.stringify(json.errors,null,2));
    throw new Error('Hardcover returned API error')
  }
  const book = json.data?.books?.[0];

  return book ? { bookId: book.id, editionId: book.editions[0].id } : null;
}

/**
 * 2. Sync Annotation
 */
export default async function syncAnnotation(koboAnnotation, { apiToken, apiUrl }) {
  // Validate required parameters
  if (!apiToken) {
    throw new Error("API token is required");
  }
  if (!apiUrl) {
    throw new Error("API URL is required");
  }
  
  if (!koboAnnotation) {
    throw new Error("Kobo annotation is required");
  }
  
  const ids = await getHardcoverIds(koboAnnotation.isbn, { apiToken, apiUrl });

  if (!ids) {
    console.error(`Skipping: No book found for ISBN ${koboAnnotation.isbn}`);
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

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: 'Bearer ' + apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        bookId: ids.bookId,
        editionId: ids.editionId,
        entry: entryText,
        event: isNote ? "annotation" : "quote",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}
