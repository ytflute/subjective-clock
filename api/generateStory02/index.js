import OpenAI from 'openai';

export default async function handler(req, res) {
    // 設置 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 處理 OPTIONS 請求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允許 POST 請求
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: `Method ${req.method} not allowed` });
        return;
    }

    try {
        const { city, country, language } = req.body;
        console.log(`[generateStory02] Received request for city: ${city}, country: ${country}, language: ${language}`);

        if (!city || !country) {
            res.status(400).json({ error: 'City and country are required' });
            return;
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const greetingPrompt = `Generate a short, friendly greeting for someone who just woke up in ${city}, ${country}. The greeting should be warm and welcoming, mentioning the city and country. Keep it under 2 sentences.`;
        
        const triviaPrompt = `Generate a short, interesting fact or story about ${city}, ${country}. Focus on something unique, cultural, or historical. Keep it under 3 sentences.`;

        const [greetingResponse, triviaResponse] = await Promise.all([
            openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: greetingPrompt }],
                temperature: 0.7,
                max_tokens: 100
            }),
            openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: triviaPrompt }],
                temperature: 0.7,
                max_tokens: 200
            })
        ]);

        const greeting = greetingResponse.choices[0].message.content.trim();
        const trivia = triviaResponse.choices[0].message.content.trim();

        console.log(`[generateStory02] Generated greeting: ${greeting}`);
        console.log(`[generateStory02] Generated trivia: ${trivia}`);

        res.status(200).json({
            greeting,
            trivia
        });
    } catch (error) {
        console.error('[generateStory02] Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate story',
            details: error.message 
        });
    }
} 
