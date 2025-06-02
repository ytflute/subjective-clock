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
        const greetingPrompt = `你是一位語言專家。請根據以下地點：${city}, ${country}，
提供一句當地最常用的語言說的「早安」問候語。

要求：
1. 必須使用當地最常用的官方語言或主要語言
2. 必須包含：
   - 原文的早安問候語   
3. 格式範例：
   - Guten Morgen! 
   - おはようございます!
4. 如果是使用非拉丁字母的語言，請一併提供其羅馬拼音
5. 回覆必須精簡，只需要問候語，不要加入其他說明文字`;

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
6. 根據這個城市的特色，可以有創意地推測會做什麼樣的事情與事件，但這個事件要能夠跟這個城市與國家有關。
6. 格式範例：今天的你在${country}的${city}醒來，你進入了一家麵包店聞到陣陣香味，因為${city}是${country}是一個重要的麵粉出產地，最著名的點心就是可頌麵包，作為早餐最適合了！`;

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
