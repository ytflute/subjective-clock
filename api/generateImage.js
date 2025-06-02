// pages/api/generateImage.js (Vercel API 路由)
import OpenAI from 'openai';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 初始化 Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig, 'storage-app');
const storage = getStorage(app);

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

// 從 URL 下載圖片並轉換為 Blob
async function downloadImageAsBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('圖片下載失敗');
  return await response.blob();
}

// 生成安全的檔案名
function generateSafeFileName(city, country) {
  const timestamp = Date.now();
  const safeName = `${city || 'unknown'}_${country || 'unknown'}_${timestamp}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  return `${safeName}.jpg`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

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
    console.log('生成圖片，使用 prompt:', finalPrompt);

    // 1. 使用 OpenAI 生成圖片
    const response = await openai.images.generate({
      prompt: finalPrompt,
      n: 1,
      size: "512x512",
    });

    const tempImageUrl = response.data?.[0]?.url;
    if (!tempImageUrl) {
      throw new Error('無法獲取生成的圖片 URL');
    }

    // 2. 下載圖片
    console.log('下載生成的圖片...');
    const imageBlob = await downloadImageAsBlob(tempImageUrl);

    // 3. 上傳到 Firebase Storage
    console.log('上傳圖片到 Firebase Storage...');
    const fileName = generateSafeFileName(city, country);
    const imagePath = `breakfast_images/${fileName}`;
    const storageRef = ref(storage, imagePath);
    
    await uploadBytes(storageRef, imageBlob);
    
    // 4. 獲取永久連結
    console.log('獲取永久下載連結...');
    const permanentUrl = await getDownloadURL(storageRef);

    return res.status(200).json({ imageUrl: permanentUrl });

  } catch (error) {
    console.error('圖片生成或儲存失敗:', error);
    return res.status(500).json({ 
      error: '圖片生成或儲存失敗', 
      details: error.message 
    });
  }
}
