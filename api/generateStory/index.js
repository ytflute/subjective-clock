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

        // 根據冒險指數生成不同的故事提示
        const adventureSpectrum = req.body.adventureSpectrum || 'default';
        let storyPrompt;

        switch (adventureSpectrum) {
            case 'peaceful':
                storyPrompt = `請生成一個關於${city}, ${country}的簡短（一句話或兩句話）、寧靜且正面的小知識或冷知識，同時結合描述甦醒後的情境故事。
要求：
1. 使用繁體中文
2. 開頭必須是：「今天的你在${country}的${city}醒來」
3. 內容要真實且具體
4. 重點描述寧靜、平和、舒適的場景
5. 根據這個城市的特色，自由發揮描述一個寧靜的早晨場景
6. 語氣要平和舒緩
7. 格式範例：今天的你在${country}的${city}醒來，你漫步在晨霧籠罩的古老街道上，感受著這座城市獨特的寧靜氛圍。相傳這座城市是${country}最古老的城鎮有著豐富的古老城堡與建物。`;
                break;

            case 'leisurely':
                storyPrompt = `請生成一個關於${city}, ${country}的簡短（一句話或兩句話）、悠閒且正面的小知識或冷知識，同時結合描述甦醒後的情境故事。
要求：
1. 使用繁體中文
2. 開頭必須是：「今天的你在${country}的${city}醒來」
3. 內容要真實且具體
4. 重點描述悠閒、愜意、輕鬆的場景
5. 根據這個城市的特色，自由發揮描述一個悠閒的早晨活動
6. 語氣要輕鬆愉快
7. 格式範例：今天的你在${country}的${city}醒來，你走進一家當地人最愛的咖啡館，品嚐著香濃的咖啡，看著窗外悠閒散步的人們，聽說這座城市是${country}最著名的咖啡產地。`;
                break;

            case 'exploring':
                storyPrompt = `請生成一個關於${city}, ${country}的簡短（一句話或兩句話）、探索且正面的小知識或冷知識，同時結合描述甦醒後的情境故事。
要求：
1. 使用繁體中文
2. 開頭必須是：「今天的你在${country}的${city}醒來」
3. 內容要真實且具體
4. 重點描述探索、發現、冒險的場景
5. 根據這個城市的特色，自由發揮描述一個探索的早晨活動
6. 語氣要活潑好奇
7. 格式範例：今天的你在${country}的${city}醒來，你迫不及待地走進當地的歷史博物館，探索這座城市豐富的文化遺產，聽說這座城市是${country}最著名的歷史城鎮。`;
                break;

            case 'challenging':
                storyPrompt = `請生成一個關於${city}, ${country}的簡短（一句話或兩句話）、挑戰且正面的小知識或冷知識，同時結合描述甦醒後的情境故事。
要求：
1. 使用繁體中文
2. 開頭必須是：「今天的你在${country}的${city}醒來」
3. 內容要真實且具體
4. 重點描述挑戰、刺激、冒險的場景
5. 根據這個城市的特色，自由發揮描述一個充滿挑戰的早晨活動
6. 語氣要充滿活力
7. 格式範例：今天的你在${country}的${city}醒來，你決定挑戰當地地獄級的辣美食，因為聽說住在這座城市的人們都喜歡吃辣，你決定挑戰他們看誰最辣！`;
                break;

            default:
                storyPrompt = `請生成一個關於${city}, ${country}的簡短（一句話或兩句話）、有趣且正面的小知識或冷知識，同時結合描述甦醒後的情境故事。
要求：
1. 使用繁體中文
2. 開頭必須是：「今天的你在${country}的${city}醒來」
3. 內容要真實且具體
4. 根據這個城市的特色，自由發揮描述一個有趣的早晨活動
5. 語氣要生動活潑
6. 格式範例：今天的你在${country}的${city}醒來，你聽見窗外傳來陣陣小提琴聲，聽說這座城市是莫札特的出生地。`;
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
            trivia: story
        });

    } catch (error) {
        console.error('生成故事時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 
