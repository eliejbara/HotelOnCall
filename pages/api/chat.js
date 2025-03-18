import fetch from 'node-fetch';

export default async function handler(req, res) {
    console.log("API route hit"); // Logs when the route is accessed

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        const response = await fetch(
            'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputs: message }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Hugging Face API Error:", errorText);
            return res.status(response.status).json({ error: 'Error with Hugging Face API request' });
        }

        const data = await response.json();
        console.log("Hugging Face API Response:", data);

        // Ensure response is in expected format
        const botReply = data?.generated_text || 'Sorry, I didn\'t understand that.';
        return res.status(200).json({ generated_text: botReply });

    } catch (error) {
        console.error('Internal Server Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
