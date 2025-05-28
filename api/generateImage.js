// pages/api/generateImage.js (Vercel API 路由)
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    try {
      const response = await openai.images.generate({
        prompt: prompt,
        n: 1, // 生成一張圖片
        size: "512x512", // 可以調整圖片尺寸
        style: "vibrant", // 可以調整風格
      });

      const imageUrl = response.data?.[0]?.url;

      if (imageUrl) {
        res.status(200).json({ imageUrl });
      } else {
        res.status(500).json({ error: 'Failed to generate image URL.' });
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      res.status(500).json({ error: 'Failed to generate image.', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
