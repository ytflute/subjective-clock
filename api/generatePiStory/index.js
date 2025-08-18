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
        const { city, country, countryCode } = req.body;

        if (!city || !country) {
            res.status(400).json({ error: '缺少必要參數' });
            return;
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // 生成問候語和語言信息
        const greetingPrompt = `你是一位語言專家。請根據以下地點：${city}, ${country}${countryCode ? ` (${countryCode})` : ''}，
提供當地最常用語言的「早安」問候語。

請以JSON格式回覆，包含：
{
  "greeting": "當地語言的早安問候語",
  "language": "語言名稱(中文)",
  "languageCode": "ISO語言代碼"
}

範例：
- 德國：{"greeting": "Guten Morgen!", "language": "德語", "languageCode": "de"}
- 日本：{"greeting": "おはようございます", "language": "日語", "languageCode": "ja"}
- 法國：{"greeting": "Bonjour!", "language": "法語", "languageCode": "fr"}
- 美國：{"greeting": "Good morning!", "language": "英語", "languageCode": "en"}

注意：只回覆JSON，不要其他文字`;

        const greetingResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: greetingPrompt }],
            temperature: 0.7,
            max_tokens: 150
        });

        let greetingData;
        try {
            greetingData = JSON.parse(greetingResponse.choices[0].message.content.trim());
        } catch (parseError) {
            // 如果解析失敗，使用預設值
            const rawGreeting = greetingResponse.choices[0].message.content.trim();
            greetingData = {
                greeting: rawGreeting,
                language: "英語",
                languageCode: "en"
            };
        }

        // 生成跟城市和國家相關的創意故事
        const storyPrompt = `請生成一個關於 ${city}, ${country}${countryCode ? ` (${countryCode})` : ''} 的有趣且富有創意的故事。

要求：
1. 開頭必須是先用${country}的當地語言說早安，接下來才使用繁體中文講：「今天的你在[國家中文名]的[城市中文名]醒來」
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 接著描述你在這座城市會做的一件特別的事情，這件事必須與這個城市或國家的特色相關
4. 可以融入以下元素：
   - 當地的歷史典故或傳說
   - 獨特的文化習俗
   - 特殊的地理景觀
   - 著名的建築或地標
   - 當地美食或特產
   - 有趣的冷知識
   - 當地人的日常生活方式
5. 內容要真實且具體，但可以用想像和創意的方式呈現
6. 語氣要生動有趣，讓人感受到這座城市的魅力
7. 故事要有畫面感，讓讀者彷彿身歷其境
8. 控制在50字以內，要精煉但富有想像力
9. 避免太平凡的描述，要有驚喜感和獨特性`;

        const storyResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: storyPrompt }],
            temperature: 0.8,
            max_tokens: 250
        });

        const story = storyResponse.choices[0].message.content.trim();

        res.status(200).json({
            greeting: greetingData.greeting,
            language: greetingData.language,
            languageCode: greetingData.languageCode,
            story,
            chineseStory: story,  // 保持向後兼容
            trivia: story  // 保持向後兼容
        });

    } catch (error) {
        console.error('生成故事時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 