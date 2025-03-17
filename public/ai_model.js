async function getResponse(userMessage) {
    const response = await fetch("https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill", {
        method: "POST",
        headers: { 
            "Authorization": "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",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: userMessage })
    });

    const data = await response.json();
    return data.generated_text || "I'm here to help!";
}
