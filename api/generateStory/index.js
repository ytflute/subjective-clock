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
        res.status(405).json({ error: `方法 ${req.method} 不被允許` });
        return;
    }

    try {
        const { city, country } = req.body;

        if (!city || !country) {
            res.status(400).json({ error: '缺少必要參數' });
            return;
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // 生成問候語
        const greetingPrompt = `你是一位熱情友善的在地嚮導。請為一位剛在${city}, ${country}醒來的旅人，用一句溫暖的話歡迎他/她。
要求：
1. 使用${city},${country}的當地語言，說「早安」
4. 長度限制在10個字以內`;

        const greetingResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: greetingPrompt }],
            temperature: 0.7,
            max_tokens: 100
        });

        const greeting = greetingResponse.choices[0].message.content.trim();

        // 生成小知識和故事
        const storyPrompt = `請生成一個關於${city}, ${country}的簡短（一句話或兩句話）、有趣且正面的小知識或冷知識，同時結合描述甦醒後的情境故事。
要求：
1. 使用繁體中文
2. 開頭必須是：「今天的你在${country}的${city}醒來」
3. 內容要真實且具體
4. 可以包含文化、歷史、建築、美食等面向
5. 語氣要生動活潑
6. 格式範例：今天的你在${country}的${city}醒來，你.....，因為${city}是${country}...。`;

        const storyResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: storyPrompt }],
            temperature: 0.7,
            max_tokens: 200
        });

        const story = storyResponse.choices[0].message.content.trim();

        res.status(200).json({
            greeting,
            trivia: story
        });

    } catch (error) {
        console.error('生成故事時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 
