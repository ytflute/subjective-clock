const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { city, country, language } = JSON.parse(event.body);
        console.log(`[generateStory02] Received request for city: ${city}, country: ${country}, language: ${language}`);

        if (!city || !country) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'City and country are required' })
            };
        }

        const greetingPrompt = `Generate a short, friendly greeting for someone who just woke up in ${city}, ${country}. The greeting should be warm and welcoming, mentioning the city and country. Keep it under 2 sentences.`;
        
        const triviaPrompt = `Generate a short, interesting fact or story about ${city}, ${country}. Focus on something unique, cultural, or historical. Keep it under 3 sentences.`;

        const [greetingResponse, triviaResponse] = await Promise.all([
            openai.createCompletion({
                model: "text-davinci-003",
                prompt: greetingPrompt,
                max_tokens: 100,
                temperature: 0.7,
            }),
            openai.createCompletion({
                model: "text-davinci-003",
                prompt: triviaPrompt,
                max_tokens: 200,
                temperature: 0.7,
            })
        ]);

        const greeting = greetingResponse.data.choices[0].text.trim();
        const trivia = triviaResponse.data.choices[0].text.trim();

        console.log(`[generateStory02] Generated greeting: ${greeting}`);
        console.log(`[generateStory02] Generated trivia: ${trivia}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                greeting,
                trivia
            })
        };
    } catch (error) {
        console.error('[generateStory02] Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to generate story',
                details: error.message 
            })
        };
    }
}; 
