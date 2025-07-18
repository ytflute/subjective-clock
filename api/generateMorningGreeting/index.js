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

        if (!country) {
            res.status(400).json({ error: '缺少國家參數' });
            return;
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // 生成當地語言的早安問候語
        const greetingPrompt = `你是一位語言專家。請根據以下國家：${country}${countryCode ? ` (${countryCode})` : ''}，
提供該國最常用的官方語言或主要語言說的「早安」問候語。

要求：
1. 必須使用該國最常用的官方語言或主要語言
2. 回應必須是JSON格式，包含：
   - "greeting": 原文的早安問候語
   - "language": 語言名稱（中文）
   - "languageCode": ISO 639-1 語言代碼（用於語音合成）
   - "pronunciation": 如果使用非拉丁字母，提供羅馬拼音或發音指南
   - "meaning": 中文翻譯

範例格式：
{
  "greeting": "おはようございます",
  "language": "日語", 
  "languageCode": "ja",
  "pronunciation": "Ohayou gozaimasu",
  "meaning": "早安"
}

注意事項：
- 對於美國、英國、澳洲等英語國家，使用 "Good morning!"
- 對於中國、台灣等中文地區，使用 "早安！"
- 對於西班牙、墨西哥等西語國家，使用 "¡Buenos días!"
- 對於德國、奧地利等德語國家，使用 "Guten Morgen!"
- 對於法國等法語國家，使用 "Bonjour!"
- 對於日本，使用 "おはようございます"
- 對於韓國，使用 "안녕하세요"
- 對於俄羅斯，使用 "Доброе утро"
- 對於印度，可考慮使用印地語 "सुप्रभात" 或英語
- 確保 languageCode 是有效的 ISO 639-1 代碼`;

        const greetingResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "你是一位專業的語言專家。請準確識別不同國家的主要語言，並提供正確的早安問候語。回應必須是有效的JSON格式。"
                },
                { 
                    role: "user", 
                    content: greetingPrompt 
                }
            ],
            temperature: 0.3,
            max_tokens: 300
        });

        const greetingText = greetingResponse.choices[0].message.content.trim();
        
        let greetingData;
        try {
            greetingData = JSON.parse(greetingText);
        } catch (parseError) {
            console.error('無法解析 ChatGPT 回應:', greetingText);
            // 備用方案：根據國家代碼提供預設問候語
            greetingData = getDefaultGreeting(country, countryCode);
        }

        // 驗證回應格式
        if (!greetingData.greeting || !greetingData.language || !greetingData.languageCode) {
            console.warn('ChatGPT 回應格式不完整，使用備用方案');
            greetingData = getDefaultGreeting(country, countryCode);
        }

        console.log(`為 ${country} 生成問候語:`, greetingData);

        res.status(200).json({
            success: true,
            data: greetingData,
            city: city,
            country: country,
            countryCode: countryCode
        });

    } catch (error) {
        console.error('生成早安問候語時發生錯誤:', error);
        
        // 發生錯誤時的備用問候語
        const fallbackGreeting = getDefaultGreeting(req.body.country, req.body.countryCode);
        
        res.status(200).json({
            success: false,
            error: error.message,
            data: fallbackGreeting,
            city: req.body.city,
            country: req.body.country,
            countryCode: req.body.countryCode
        });
    }
}

// 備用問候語函數
function getDefaultGreeting(country, countryCode) {
    // 根據國家代碼或國家名稱提供預設問候語
    const defaultGreetings = {
        'US': { greeting: 'Good morning!', language: '英語', languageCode: 'en', pronunciation: 'Good morning', meaning: '早安' },
        'GB': { greeting: 'Good morning!', language: '英語', languageCode: 'en', pronunciation: 'Good morning', meaning: '早安' },
        'AU': { greeting: 'Good morning!', language: '英語', languageCode: 'en', pronunciation: 'Good morning', meaning: '早安' },
        'CA': { greeting: 'Good morning!', language: '英語', languageCode: 'en', pronunciation: 'Good morning', meaning: '早安' },
        'JP': { greeting: 'おはようございます', language: '日語', languageCode: 'ja', pronunciation: 'Ohayou gozaimasu', meaning: '早安' },
        'KR': { greeting: '안녕하세요', language: '韓語', languageCode: 'ko', pronunciation: 'Annyeonghaseyo', meaning: '早安' },
        'CN': { greeting: '早安！', language: '中文', languageCode: 'zh', pronunciation: 'Zǎo ān', meaning: '早安' },
        'TW': { greeting: '早安！', language: '繁體中文', languageCode: 'zh-TW', pronunciation: 'Zǎo ān', meaning: '早安' },
        'HK': { greeting: '早晨！', language: '粵語', languageCode: 'zh-HK', pronunciation: 'Jou san', meaning: '早安' },
        'DE': { greeting: 'Guten Morgen!', language: '德語', languageCode: 'de', pronunciation: 'Guten Morgen', meaning: '早安' },
        'FR': { greeting: 'Bonjour!', language: '法語', languageCode: 'fr', pronunciation: 'Bonjour', meaning: '早安' },
        'ES': { greeting: '¡Buenos días!', language: '西班牙語', languageCode: 'es', pronunciation: 'Buenos días', meaning: '早安' },
        'IT': { greeting: 'Buongiorno!', language: '意大利語', languageCode: 'it', pronunciation: 'Buongiorno', meaning: '早安' },
        'PT': { greeting: 'Bom dia!', language: '葡萄牙語', languageCode: 'pt', pronunciation: 'Bom dia', meaning: '早安' },
        'RU': { greeting: 'Доброе утро!', language: '俄語', languageCode: 'ru', pronunciation: 'Dobroe utro', meaning: '早安' },
        'IN': { greeting: 'सुप्रभात!', language: '印地語', languageCode: 'hi', pronunciation: 'Suprabhat', meaning: '早安' },
        'NL': { greeting: 'Goedemorgen!', language: '荷蘭語', languageCode: 'nl', pronunciation: 'Goedemorgen', meaning: '早安' },
        'SE': { greeting: 'God morgon!', language: '瑞典語', languageCode: 'sv', pronunciation: 'God morgon', meaning: '早安' },
        'NO': { greeting: 'God morgen!', language: '挪威語', languageCode: 'no', pronunciation: 'God morgen', meaning: '早安' },
        'DK': { greeting: 'God morgen!', language: '丹麥語', languageCode: 'da', pronunciation: 'God morgen', meaning: '早安' },
        'FI': { greeting: 'Hyvää huomenta!', language: '芬蘭語', languageCode: 'fi', pronunciation: 'Hyvää huomenta', meaning: '早安' },
        'PL': { greeting: 'Dzień dobry!', language: '波蘭語', languageCode: 'pl', pronunciation: 'Dzień dobry', meaning: '早安' },
        'CZ': { greeting: 'Dobré ráno!', language: '捷克語', languageCode: 'cs', pronunciation: 'Dobré ráno', meaning: '早安' },
        'BR': { greeting: 'Bom dia!', language: '葡萄牙語', languageCode: 'pt-BR', pronunciation: 'Bom dia', meaning: '早安' },
        'MX': { greeting: '¡Buenos días!', language: '西班牙語', languageCode: 'es-MX', pronunciation: 'Buenos días', meaning: '早安' },
        'AR': { greeting: '¡Buenos días!', language: '西班牙語', languageCode: 'es-AR', pronunciation: 'Buenos días', meaning: '早安' },
    };

    // 優先使用國家代碼匹配
    if (countryCode && defaultGreetings[countryCode.toUpperCase()]) {
        return defaultGreetings[countryCode.toUpperCase()];
    }

    // 根據國家名稱匹配
    const countryLower = country.toLowerCase();
    if (countryLower.includes('japan')) return defaultGreetings['JP'];
    if (countryLower.includes('korea')) return defaultGreetings['KR'];
    if (countryLower.includes('china')) return defaultGreetings['CN'];
    if (countryLower.includes('taiwan')) return defaultGreetings['TW'];
    if (countryLower.includes('germany')) return defaultGreetings['DE'];
    if (countryLower.includes('france')) return defaultGreetings['FR'];
    if (countryLower.includes('spain')) return defaultGreetings['ES'];
    if (countryLower.includes('italy')) return defaultGreetings['IT'];
    if (countryLower.includes('russia')) return defaultGreetings['RU'];
    if (countryLower.includes('india')) return defaultGreetings['IN'];
    if (countryLower.includes('brazil')) return defaultGreetings['BR'];
    if (countryLower.includes('mexico')) return defaultGreetings['MX'];

    // 預設為英語
    return defaultGreetings['US'];
} 