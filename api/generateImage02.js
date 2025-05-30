// pages/api/generateImage.js (Vercel API 路由)
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 生成圖片的 prompt
function generateImagePrompt(city, country) {
  return `Top view of a traditional local breakfast commonly eaten in ${city}, ${country}. 
          The food is presented on a clean table setting, with realistic textures and lighting, 
          showcasing the variety of dishes, ingredients, and beverages typical of the region. 
          No people, only food. Styled like a professional food photography shot.`.trim().replace(/\s+/g, ' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  const { prompt, city, country } = req.body;

  // 如果沒有提供 prompt，但有提供 city 和 country，則生成 prompt
  const finalPrompt = prompt || (city && country ? generateImagePrompt(city, country) : null);

  if (!finalPrompt) {
    return res.status(400).json({ 
      error: '需要提供 prompt 或者 city 和 country 參數。' 
    });
  }

  try {
    console.log('生成圖片，使用 prompt:', finalPrompt);

    const response = await openai.images.generate({
      prompt: finalPrompt,
      n: 1,
      size: "512x512",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('無法獲取生成的圖片 URL');
    }

    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('圖片生成失敗:', error);
    return res.status(500).json({ 
      error: '圖片生成失敗', 
      details: error.message 
    });
  }
}
