// pages/api/generateImage.js (Vercel API 路由)
import OpenAI from 'openai';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

// 初始化 Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      storageBucket: "subjective-clock.appspot.com"
    });
    console.log('Firebase Admin 初始化成功');
  } catch (error) {
    console.error('Firebase Admin 初始化失敗:', error);
    console.error('環境變數狀態:', {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    });
    throw error;
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 生成一般早餐圖片的 prompt
function generateBreakfastPrompt(city, country) {
  return `Top view of a traditional local breakfast commonly eaten in ${city}, ${country}. 
          The food is presented on a clean table setting, with realistic textures and lighting, 
          showcasing the variety of dishes, ingredients, and beverages typical of the region. 
          No people, only food. Styled like a professional food photography shot.`.trim().replace(/\s+/g, ' ');
}

// 生成宇宙主題早餐圖片的 prompt
function generateUniverseBreakfastPrompt() {
  return `Top view of a creative and surreal cosmic breakfast scene from an alien civilization. 
          The food items appear otherworldly yet appetizing, with bioluminescent elements 
          and strange geometric shapes. The scene includes exotic alien fruits and beverages 
          that glow with ethereal light. The setting suggests a space station or alien planet 
          with a view of stars or nebulae in the background. Styled like a professional sci-fi 
          concept art with a focus on food photography shot.`.trim().replace(/\s+/g, ' ');
}

// 將圖片上傳到 Firebase Storage
async function uploadImageToFirebase(imageBuffer, fileName) {
  try {
    console.log('開始上傳圖片到 Firebase Storage');
    const bucket = admin.storage().bucket();
    const file = bucket.file(`breakfast-images/${fileName}`);
    
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      },
    });

    console.log('圖片儲存成功，準備設置公開訪問權限');
    // 生成公開訪問 URL
    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    console.log('圖片上傳完成，公開 URL:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('上傳圖片到 Firebase Storage 失敗:', error);
    console.error('完整錯誤堆疊:', error.stack);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  console.log('收到圖片生成請求:', {
    method: req.method,
    body: req.body,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  });

  const { prompt, city, country, isUniverseTheme } = req.body;

  // 根據參數決定使用哪個 prompt
  let finalPrompt = prompt;
  if (!finalPrompt) {
    if (isUniverseTheme) {
      finalPrompt = generateUniverseBreakfastPrompt();
    } else if (city && country) {
      finalPrompt = generateBreakfastPrompt(city, country);
    }
  }

  if (!finalPrompt) {
    return res.status(400).json({ 
      error: '需要提供 prompt 或者 city 和 country 參數，或指定 isUniverseTheme。' 
    });
  }

  try {
    console.log('準備生成圖片，使用 prompt:', finalPrompt);

    const response = await openai.images.generate({
      prompt: finalPrompt,
      n: 1,
      size: "512x512",
    });

    console.log('OpenAI 回應:', response);

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('無法獲取生成的圖片 URL');
    }

    // 下載圖片
    console.log('準備下載圖片:', imageUrl);
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.buffer();

    // 生成唯一的檔案名
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    console.log('準備上傳到 Firebase Storage，檔案名:', fileName);

    // 上傳到 Firebase Storage
    const permanentUrl = await uploadImageToFirebase(imageBuffer, fileName);
    console.log('圖片上傳成功，永久 URL:', permanentUrl);

    return res.status(200).json({ imageUrl: permanentUrl });

  } catch (error) {
    console.error('圖片生成過程中發生錯誤:', error);
    console.error('完整錯誤堆疊:', error.stack);
    return res.status(500).json({ 
      error: '圖片生成失敗', 
      details: error.message,
      stack: error.stack
    });
  }
}
