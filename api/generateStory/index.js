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

        // 根據心情生成不同的故事提示
        const mood = req.body.mood || 'peaceful';
        const moodName = req.body.moodName || '平靜溫和';
        const moodDescription = req.body.moodDescription || '溫帶的舒適宜人';
        const moodEmoji = req.body.moodEmoji || '😌🌱';
        
        let storyPrompt;

        // 使用英文的城市和國家名稱，讓 ChatGPT 在故事中自動翻譯

        switch (mood) {
            case 'happy':
                storyPrompt = `請生成一個關於 ${city}, ${country} 的簡短且充滿熱情活力的小知識或故事，要反映出快樂熱情的心境。
要求：
1. 使用繁體中文回答
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 開頭必須是：「今天的你在[國家中文名]的[城市中文名]醒來」
4. 內容要真實且具體
5. 重點描述陽光、活力、熱情的場景，符合「${moodDescription}」的氛圍
6. 根據這個城市的特色，描述一個充滿陽光和活力的早晨
7. 語氣要活潑開朗，充滿正能量
8. 可以包含當地的節慶、音樂、舞蹈或熱鬧的市集等元素
9. 控制在50字以內，讓人感受到熱帶般的溫暖和快樂`;
                break;

            case 'peaceful':
                storyPrompt = `請生成一個關於 ${city}, ${country} 的簡短且平靜溫和的小知識或故事，要反映出平靜溫和的心境。
要求：
1. 使用繁體中文回答
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 開頭必須是：「今天的你在[國家中文名]的[城市中文名]醒來」
4. 內容要真實且具體
5. 重點描述寧靜、和諧、舒適的場景，符合「${moodDescription}」的氛圍
6. 根據這個城市的特色，描述一個平和安詳的早晨
7. 語氣要溫和舒緩，給人安全感
8. 可以包含自然風景、安靜的咖啡館、溫柔的陽光等元素
9. 控制在50字以內，讓人感受到溫帶的舒適宜人`;
                break;

            case 'melancholy':
                storyPrompt = `請生成一個關於 ${city}, ${country} 的簡短且帶有深度思考的小知識或故事，要反映出憂鬱思考的心境。
要求：
1. 使用繁體中文回答
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 開頭必須是：「今天的你在[國家中文名]的[城市中文名]醒來」
4. 內容要真實且具體
5. 重點描述思辨、沉靜、詩意的場景，符合「${moodDescription}」的氛圍
6. 根據這個城市的特色，描述一個充滿思考氛圍的早晨
7. 語氣要深沉內斂，帶有哲思色彩
8. 可以包含歷史故事、文學色彩、秋日風景等元素
9. 控制在50字以內，讓人感受到亞寒帶的沉靜思辨`;
                break;

            case 'lonely':
                storyPrompt = `請生成一個關於 ${city}, ${country} 的簡短且帶有孤寂美感的小知識或故事，要反映出寂寞冷淡的心境。
要求：
1. 使用繁體中文回答
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 開頭必須是：「今天的你在[國家中文名]的[城市中文名]醒來」
4. 內容要真實且具體
5. 重點描述孤寂、純淨、空曠的場景，符合「${moodDescription}」的氛圍
6. 根據這個城市的特色，描述一個安靜而孤獨的早晨
7. 語氣要淡漠而詩意，帶有一種美麗的孤獨感
8. 可以包含雪景、空曠的街道、寧靜的湖泊等元素
9. 控制在50字以內，讓人感受到寒帶的孤寂純淨
10. 即使孤寂也要保持正面，不要太悲傷`;
                break;

            default:
                storyPrompt = `請生成一個關於 ${city}, ${country} 的簡短且有趣的小知識或故事。
要求：
1. 使用繁體中文回答
2. 請將 ${city} 和 ${country} 自動翻譯成適當的繁體中文名稱
3. 開頭必須是：「今天的你在[國家中文名]的[城市中文名]醒來」
4. 內容要真實且具體
5. 根據這個城市的特色，描述一個有趣的早晨活動
6. 語氣要生動活潑
7. 控制在50字以內`;
        }

        const storyResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: storyPrompt }],
            temperature: 0.7,
            max_tokens: 200
        });

        const story = storyResponse.choices[0].message.content.trim();

        res.status(200).json({
            greeting,
            trivia: story,
            mood: mood,
            moodName: moodName,
            moodDescription: moodDescription,
            moodEmoji: moodEmoji
        });

    } catch (error) {
        console.error('生成故事時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 
