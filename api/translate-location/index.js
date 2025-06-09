export default async function handler(req, res) {
    // 設置 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
        const { city, country, countryCode } = req.body;

        if (!city && !country) {
            return res.status(400).json({ 
                error: 'At least one of city or country is required' 
            });
        }

        console.log(`翻譯請求 - 城市: ${city}, 國家: ${country}, 國家代碼: ${countryCode}`);

        // OpenAI API Key
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (!OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not found in environment variables');
            return res.status(500).json({ 
                error: 'Translation service not configured',
                city: city,
                country: country,
                city_zh: city,      // 回傳原文作為備用
                country_zh: country // 回傳原文作為備用
            });
        }

        // 建構翻譯請求
        let translationPrompt = '請將以下地名翻譯為繁體中文，只回傳翻譯結果，不要其他說明：\n';
        
        if (city && country) {
            translationPrompt += `城市：${city}\n國家：${country}`;
        } else if (city) {
            translationPrompt += `城市：${city}`;
        } else if (country) {
            translationPrompt += `國家：${country}`;
        }

        const requestBody = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "你是一個專業的地理名稱翻譯專家。請將英文地名翻譯為標準的繁體中文名稱。如果是知名城市或國家，請使用約定俗成的中文名稱。回應格式應為：城市：[中文名]\\n國家：[中文名]（如果兩者都需要翻譯）或只回傳單一翻譯結果。"
                },
                {
                    role: "user", 
                    content: translationPrompt
                }
            ],
            max_tokens: 100,
            temperature: 0.1
        };

        console.log('呼叫 OpenAI API 進行翻譯...');
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json().catch(() => ({}));
            console.error('OpenAI API 錯誤:', openaiResponse.status, errorData);
            throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
        }

        const translationData = await openaiResponse.json();
        
        if (!translationData.choices || translationData.choices.length === 0) {
            throw new Error('No translation result from OpenAI');
        }

        const translatedText = translationData.choices[0].message.content.trim();
        console.log('翻譯結果:', translatedText);

        // 解析翻譯結果
        let city_zh = city;
        let country_zh = country;

        // 嘗試解析結構化的回應
        if (city && country) {
            const lines = translatedText.split('\n');
            for (const line of lines) {
                if (line.includes('城市：') || line.includes('城市:')) {
                    city_zh = line.replace(/城市[：:]\s*/, '').trim();
                } else if (line.includes('國家：') || line.includes('國家:')) {
                    country_zh = line.replace(/國家[：:]\s*/, '').trim();
                }
            }
        } else if (city) {
            city_zh = translatedText;
        } else if (country) {
            country_zh = translatedText;
        }

        // 清理翻譯結果，移除多餘的標點符號
        if (city_zh) {
            city_zh = city_zh.replace(/[，。；！？]/g, '').trim();
        }
        if (country_zh) {
            country_zh = country_zh.replace(/[，。；！？]/g, '').trim();
        }

        const result = {
            city: city,
            country: country,
            countryCode: countryCode,
            city_zh: city_zh,
            country_zh: country_zh,
            translated: true,
            source: 'chatgpt'
        };

        console.log('翻譯完成結果:', result);
        res.status(200).json(result);

    } catch (error) {
        console.error('翻譯 API 錯誤:', error);
        
        // 即使翻譯失敗，也回傳原始資料作為備用
        const { city, country, countryCode } = req.body;
        res.status(200).json({
            city: city,
            country: country, 
            countryCode: countryCode,
            city_zh: city || null,      // 使用原文作為備用
            country_zh: country || null, // 使用原文作為備用
            translated: false,
            source: 'fallback',
            error: error.message
        });
    }
} 