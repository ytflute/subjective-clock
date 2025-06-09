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

        // 生成跟城市和國家相關的創意故事
        const storyPrompt = `請生成一個關於 ${city}, ${country} 的有趣且富有創意的故事。

要求：
1. 使用繁體中文回答
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 開頭必須是：「今天的你在[國家中文名]的[城市中文名]醒來」
4. 接著描述你在這座城市會做的一件特別的事情，這件事必須與這個城市或國家的特色相關
5. 可以融入以下元素：
   - 當地的歷史典故或傳說
   - 獨特的文化習俗
   - 特殊的地理景觀
   - 著名的建築或地標
   - 當地美食或特產
   - 有趣的冷知識
   - 當地人的日常生活方式
6. 內容要真實且具體，但可以用想像和創意的方式呈現
7. 語氣要生動有趣，讓人感受到這座城市的魅力
8. 故事要有畫面感，讓讀者彷彿身歷其境
9. 控制在80字以內，要精煉但富有想像力
10. 避免太平凡的描述，要有驚喜感和獨特性`;

        const storyResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: storyPrompt }],
            temperature: 0.8,
            max_tokens: 250
        });

        const story = storyResponse.choices[0].message.content.trim();

        res.status(200).json({
            greeting,
            story,
            trivia: story  // 保持向後兼容
        });

    } catch (error) {
        console.error('生成故事時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 
