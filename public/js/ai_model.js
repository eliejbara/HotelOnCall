// ai_model.js
async function getResponse(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      // Log detailed error information
      const errorData = await response.text();
      console.error('Error with API request:', response.status, response.statusText, errorData);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    // Catching any errors and logging them
    console.error('Error with API request:', error);
    return "Error: Unable to process your request.";
  }
}
