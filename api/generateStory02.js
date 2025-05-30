generateStory02.js


// 檔案路徑: your-project-folder/api/generateStory.js
import { OpenAI } from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// 為文字和圖片分別指定模型，DALL-E 3 是目前推薦的圖片模型
const TEXT_MODEL = process.env.TEXT_MODEL || "gpt-3.5-turbo";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "dall-e-3"; 

let openai;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.error("重要：OpenAI API 金鑰未在 Vercel 環境變數中設定 (OPENAI_API_KEY)。");
}

export default async function handler(req, res) {
  if (!openai) {
    console.error("OpenAI client 未初始化。");
    return res.status(500).json({ error: "服務設定問題，無法生成內容。" });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。` });
  }

  try {
    const {
      city,
      country,
      language = "Traditional Chinese"
    } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: "必須提供 'city' 和 'country'。" });
    }
    
    // ===================================================================
    // --- 1. 生成文字內容 (問候語 & 小知識) ---
    // ===================================================================
    console.log(`[文字生成] 開始為 ${city}, ${country} 生成文字...`);
    const textPrompt = `
      你是一位知識淵博且友善的助手。針對以下地點：城市 - "${city}"，國家 - "${country}"。
      請提供兩項資訊，並嚴格按照以下 JSON 格式輸出，主要內容請使用${language}：

      {
        "greeting": "一句用「${country}」這個國家的主要或常用本地語言說的「早安」或等效的日常問候語。請同時用括號標註出這是什麼語言，例如：Guten Morgen! (德文的早安)",
        "trivia": "一個關於「${city}」或「${country}」的簡短（一句話或兩句話）、有趣且正面的小知識或冷知識，同時可以結合描述甦醒後的情境故事，開頭必須是：「今天的你在${country}的${city}醒來」。例如：今天的你在${country}的${city}醒來，你聽見街上...，因為${city}是${country}的一個重要打鐵城市...。"
      }
    `;

    const chatCompletion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { "role": "system", "content": "你是一位能提供特定地點問候語和有趣小知識的助手，並且能嚴格按照要求的 JSON 格式回傳結果。" },
        { "role": "user", "content": textPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 250,
      temperature: 0.6,
    });

    let storyData;
    try {
      const content = chatCompletion.choices[0].message.content;
      storyData = JSON.parse(content);
      if (!storyData.greeting || !storyData.trivia) throw new Error("缺少 greeting 或 trivia 欄位");
      console.log("[文字生成] 成功:", storyData);
    } catch (parseError) {
      console.error("[文字生成] 失敗，無法解析或驗證JSON:", parseError);
      // 如果文字生成失敗，直接返回錯誤，不繼續生成圖片
      return res.status(500).json({
          error: "生成文字內容失敗",
          greeting: `(問候語獲取失敗)`,
          trivia: `(小知識獲取失敗 - API回應解析錯誤)。`
      });
    }

    // ===================================================================
    // --- 2. 基於文字內容，生成對應的早餐圖片 ---
    // ===================================================================
    console.log(`[圖片生成] 開始為 "${storyData.trivia}" 生成圖片...`);
    
    // 建立一個更豐富的圖片生成 Prompt
    const imagePrompt = `
      Top view of a traditional local breakfast commonly eaten in ${city}, ${country}. 
      The food is presented on a clean table setting, with realistic textures and lighting, showcasing the variety of dishes, ingredients, and beverages typical of the region. 
      No people, only food. Styled like a professional food photography shot.
      Reflect the feeling of this story: "${storyData.trivia}". 
      Do not include any text or words in the image.
    `;
    
    let imageUrl = null; // 預設圖片 URL 為 null
    try {
      const imageResponse = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024", // DALL-E 3 支援的尺寸
        quality: "standard", // standard 或 hd
      });
      imageUrl = imageResponse.data?.[0]?.url;
      if (imageUrl) {
        console.log("[圖片生成] 成功, URL:", imageUrl);
      } else {
        console.warn("[圖片生成] 未能從API回應中獲取URL。");
      }
    } catch (imageError) {
        // 如果圖片生成失敗，我們不中斷整個請求
        // 僅記錄錯誤，並讓 imageUrl 保持為 null
        console.error("[圖片生成] 失敗:", imageError.message);
    }

    // ===================================================================
    // --- 3. 組合最終回應 ---
    // ===================================================================
    const finalResponse = {
      greeting: storyData.greeting,
      trivia: storyData.trivia,
      imageUrl: imageUrl, // 這可能是 URL 字串或 null
    };

    console.log("[最終回應] 準備回傳給前端:", finalResponse);
    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error("在 generateStory 函式中發生嚴重錯誤:", error.name, error.message);
    return res.status(500).json({ error: "處理請求時發生未預期的錯誤。" });
  }
}
