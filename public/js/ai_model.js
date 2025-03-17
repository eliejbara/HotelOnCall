async function getResponse(userMessage) {
    try {
        const response = await fetch("https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill", {
            method: "POST",
            headers: { 
                "Authorization": "HUGGINGFACE_API_KEY", // Replace with your actual API key
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ inputs: userMessage })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data); // Debugging: log the full API response

        return data.generated_text || "Sorry, I didn't understand that.";
    } catch (error) {
        console.error('Error with API request:', error);
        return "Error: Unable to process your request.";
    }
}
