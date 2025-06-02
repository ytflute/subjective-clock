// /api/generateImage/index.js
import OpenAI from 'openai';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

// 初始化 Firebase Admin
if (!global.firebaseAdmin) {
    global.firebaseAdmin = initializeApp({
        credential: JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

export default async function handler(req, res) {
    // 設置 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
        // 驗證用戶身份
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('未提供有效的認證令牌');
        }
        const idToken = authHeader.split('Bearer ')[1];
        await getAuth().verifyIdToken(idToken);

        const { city, country, isUniverseTheme } = req.body;

        if ((!city || !country) && !isUniverseTheme) {
            res.status(400).json({ error: '缺少必要參數' });
            return;
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // 根據是否為宇宙主題選擇不同的提示
        let prompt;
        if (isUniverseTheme) {
            prompt = `請生成一張充滿想像力的太空早餐圖片。這應該是一頓在宇宙深處享用的未來風格早餐。
要求：
1. 餐點應該看起來既奇特又美味
2. 可以包含懸浮的食物元素
3. 使用未來科技感的餐具
4. 背景可以有星空或其他太空元素
5. 整體色調要夢幻且充滿科幻感
6. 風格要寫實，不要卡通化
7. 要有精緻的擺盤
8. 光影效果要突出`;
        } else {
            prompt = `請生成一張關於${city}, ${country}當地特色早餐的圖片。
要求：
1. 要符合當地飲食文化特色
2. 擺盤要精緻且富有美感
3. 背景要簡潔，突出食物
4. 要有適當的餐具搭配
5. 光線要明亮自然
6. 風格要寫實，不要卡通化
7. 可以搭配一些當地特色裝飾
8. 整體構圖要平衡`;
        }

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "natural"
        });

        const imageUrl = response.data[0].url;

        // 下載圖片並上傳到 Firebase Storage
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        const bucket = getStorage().bucket();
        const fileName = `breakfast-images/${Date.now()}-${city || 'universe'}.png`;
        const file = bucket.file(fileName);

        await file.save(imageBuffer, {
            metadata: {
                contentType: 'image/png',
                metadata: {
                    city,
                    country,
                    generatedAt: new Date().toISOString(),
                    isUniverseTheme: isUniverseTheme || false
                }
            }
        });

        // 獲取可訪問的 URL
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // URL 有效期 7 天
        });

        res.status(200).json({
            imageUrl: signedUrl
        });

    } catch (error) {
        console.error('生成圖片時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
} 
