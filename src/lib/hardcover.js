/**
 * Makes a GraphQL request to the Hardcover API
 * 
 * @param {Object} options - The options for the API request
 * @param {string} options.query - The GraphQL query or mutation string
 * @param {Object} options.variables - The variables to pass to the GraphQL query
 * @param {string} options.apiToken - The Hardcover API token for authentication
 * @param {string} options.apiUrl - The URL of the Hardcover API endpoint
 * @returns {Promise<Object|null>} The API response data or null if an error occurred
 */
export async function hardcoverApiRequest({ query, variables = {}, apiToken, apiUrl }) {
  if (!apiToken) {
    throw new Error("API token is required");
  }
  if (!apiUrl) {
    throw new Error("API URL is required");
  }
  if (!query) {
    throw new Error("GraphQL query is required");
  }

  const fetchOptions = {
    method: "POST",
    headers: {
      Authorization: 'Bearer ' + apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  };

  let response;
  try {
    response = await fetch(apiUrl, fetchOptions);
  } catch (error) {
    console.error(`Failed to connect to Hardcover API: ${error.message}`);
    return null;
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error(`Failed to parse JSON response: ${error.message}`);
    return null;
  }

  if (result.errors) {
    console.error("Hardcover API errors:", JSON.stringify(result.errors, null, 2));
    return null;
  }

  if (!response.ok) {
    console.error(`Hardcover API request failed with status ${response.status}: ${response.statusText}`);
    return null;
  }

  return result;
}

export default hardcoverApiRequest;