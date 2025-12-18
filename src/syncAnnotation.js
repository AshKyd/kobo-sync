import 'dotenv/config';

/**
 * 1. Find Hardcover IDs using ISBN
 */
async function getHardcoverIds(isbn) {
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

  
  const fetchOptions = {
    method: "POST",
    headers: {
      Authorization: 'Bearer '+process.env.HARDCOVER_API_TOKEN, // Usually 'Bearer <token>' depending on your env setup
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { isbn } }),
  }
  console.log(fetchOptions)
  const response = await fetch(process.env.HARDCOVER_API_URL, fetchOptions);

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
export default async function syncAnnotation(koboAnnotation) {
  const ids = await getHardcoverIds(koboAnnotation.isbn);

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

  const response = await fetch(process.env.HARDCOVER_API_URL, {
    method: "POST",
    headers: {
      Authorization: 'Bearer '+process.env.HARDCOVER_API_TOKEN,
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

  return await response.json();
}
