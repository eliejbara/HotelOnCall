async function getResponse(userMessage) {
    const response = await fetch("https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill", {
        method: "POST",
        headers: { 
            "Authorization": "Bearer YOUR_HUGGINGFACE_API_KEY",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: userMessage })
    });

    const data = await response.json();
    return data.generated_text || "I'm here to help!";
}
