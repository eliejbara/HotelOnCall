// /api/chat.js

const fetch = require('node-fetch');
require('dotenv').config();

module.exports = async (req, res) => {
    console.log("API route hit");

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'No message provided' });
    }

    try {
        // Use the Hugging Face API to get the response
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        const response = await fetch('https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: message }),
        });

        // Handle API errors
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Error with Hugging Face API request' });
        }

        // Parse the response
        const data = await response.json();
        return res.status(200).json({ generated_text: data.generated_text || "Sorry, I didn't understand that." });
    } catch (error) {
        console.error('Error with API request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
