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
1. 使用繁體中文
2. 語氣要親切自然
3. 可以提到當地特色
4. 長度限制在50個字以內
5. 不要說"早安"或"早上好"這類的字眼`;

        const greetingResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: greetingPrompt }],
            temperature: 0.7,
            max_tokens: 100
        });

        const greeting = greetingResponse.choices[0].message.content.trim();

        // 生成小知識
        const triviaPrompt = `請以在地嚮導的身份，分享一個關於${city}, ${country}的有趣小知識或特色。
要求：
1. 使用繁體中文
2. 內容要真實且具體
3. 可以包含文化、歷史、建築、美食等面向
4. 語氣要生動活潑
5. 長度限制在100個字以內
6. 避免使用"你知道嗎"之類的開頭`;

        const triviaResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: triviaPrompt }],
            temperature: 0.7,
            max_tokens: 200
        });

        const trivia = triviaResponse.choices[0].message.content.trim();

        res.status(200).json({
            greeting,
            trivia
        });

    } catch (error) {
        console.error('生成故事時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 
