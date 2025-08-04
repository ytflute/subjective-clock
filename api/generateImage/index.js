// /api/generateImage/index.js
import OpenAI from 'openai';
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

// 初始化 Firebase Admin
let firebaseAdmin;
try {
    if (getApps().length === 0) {
        const adminConfig = {
            credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        };
        firebaseAdmin = initializeApp(adminConfig);
        console.log('Firebase Admin 初始化成功');
    } else {
        firebaseAdmin = getApps()[0];
        console.log('使用現有的 Firebase Admin 實例');
    }
} catch (error) {
    console.error('Firebase Admin 初始化失敗:', error);
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
        // 檢查 Firebase Admin 是否正確初始化
        if (!firebaseAdmin) {
            throw new Error('Firebase Admin 未正確初始化');
        }

        // 驗證用戶身份
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('未提供有效的認證令牌');
        }
        const idToken = authHeader.split('Bearer ')[1];
        
        try {
            await getAuth().verifyIdToken(idToken);
        } catch (authError) {
            console.error('驗證令牌失敗:', authError);
            res.status(401).json({ error: '認證失敗：' + authError.message });
            return;
        }

        const { city, country, isUniverseTheme } = req.body;

        if ((!city || !country) && !isUniverseTheme) {
            res.status(400).json({ error: '缺少必要參數' });
            return;
        }

        // 檢查 OpenAI API Key
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('未設置 OpenAI API Key');
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('OpenAI API 初始化成功，開始生成圖片...');

        // 根據是否為宇宙主題選擇不同的提示
        let prompt;
        if (isUniverseTheme) {
            prompt = `A beautiful top-down view of a futuristic single-serving breakfast spread in space. The scene shows various creative space-themed food items arranged on a sleek metallic table, portioned for one person. The dishes have a cosmic aesthetic with subtle glowing elements and are presented in an artistic way. The background features gentle starfield lighting. Professional food photography style with sci-fi elements.`;
        } else {
            prompt = `A beautiful top-down view of a traditional single-serving breakfast from ${city}, ${country}. The meal is authentically prepared and beautifully presented on local tableware, with proper portion sizes suitable for one person. The food showcases the regional breakfast culture with authentic ingredients and traditional presentation. Natural lighting highlights the textures and colors of the local cuisine. Professional food photography style.`;
        }

        let imageUrl;
        try {
            console.log('正在呼叫 OpenAI DALL-E API...');
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                style: "natural"
            });
            imageUrl = response.data[0].url;
            console.log('OpenAI 圖片生成成功，URL:', imageUrl);
        } catch (openaiError) {
            console.error('OpenAI 圖片生成失敗:', openaiError);
            console.error('OpenAI 錯誤詳情:', JSON.stringify(openaiError, null, 2));
            
            // 提供更詳細的錯誤資訊
            let errorMessage = 'OpenAI API 錯誤';
            
            if (openaiError.status === 429) {
                errorMessage = 'OpenAI API 配額已用完，請稍後再試';
            } else if (openaiError.status === 401) {
                errorMessage = 'OpenAI API 金鑰無效';
            } else if (openaiError.status === 400) {
                // 處理400錯誤的詳細信息
                if (openaiError.error && openaiError.error.message) {
                    errorMessage = '圖片生成請求被拒絕：' + openaiError.error.message;
                } else if (openaiError.message) {
                    errorMessage = '圖片生成請求格式錯誤：' + openaiError.message;
                } else {
                    errorMessage = '圖片生成請求被拒絕，可能內容不符合OpenAI政策';
                }
            } else {
                errorMessage = '圖片生成失敗：' + (openaiError.message || '未知錯誤');
            }
            
            throw new Error(errorMessage);
        }

        // 下載圖片並上傳到 Firebase Storage
        try {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) throw new Error('圖片下載失敗');
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

            // 使用永久的下載 URL，無期限限制
            await file.makePublic();
            const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

            res.status(200).json({
                imageUrl: permanentUrl
            });
        } catch (storageError) {
            console.error('Firebase Storage 操作失敗:', storageError);
            throw new Error('圖片儲存失敗：' + storageError.message);
        }

    } catch (error) {
        console.error('生成圖片時發生錯誤:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
} 
