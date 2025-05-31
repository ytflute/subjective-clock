// pages/api/generateImage.js (Vercel API 路由)
import OpenAI from 'openai';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  console.log('收到圖片生成請求:', {
    method: req.method,
    body: req.body,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY
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

    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('圖片生成過程中發生錯誤:', error);
    return res.status(500).json({ 
      error: '圖片生成失敗', 
      details: error.message
    });
  }
}
