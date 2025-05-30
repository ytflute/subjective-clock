// 檔案路徑: your-project-folder/api/generateStory.js
import { OpenAI } from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

// OpenAI 客戶端初始化
const openai = OPENAI_API_KEY ? 
  new OpenAI({ apiKey: OPENAI_API_KEY }) : 
  console.error("重要：OpenAI API 金鑰未在 Vercel 環境變數中設定 (OPENAI_API_KEY)。");

// 生成 Prompt
function generatePrompt(city, country, language) {
  return `
    你是一位知識淵博且友善的助手。針對以下地點：城市 - "${city}"，國家 - "${country}"。
    請提供兩項資訊，並嚴格按照以下 JSON 格式輸出，主要內容請使用${language}：

    {
      "greeting": "一句用「${country}」這個國家的主要或常用本地語言說的「早安」或等效的日常問候語。請同時用括號標註出這是什麼語言，例如：Guten Morgen! (德文的早安)",
      "trivia": "一個關於「${city}」或「${country}」的簡短（一句話或兩句話）、有趣且正面的小知識或冷知識，同時可以結合描述甦醒後的情境故事，開頭必須是：「今天的你在${country}的{city}醒來」。例如：今天的你在${country}的{city}醒來，你聽見街上...，因為${city}是${country}的一個重要打鐵城市...。"
    }

    請確保 "greeting" 中的問候語是該國家道地的說法。
    請確保 "trivia" 中的小知識簡潔且引人入勝。
    如果找不到非常吻合的「早安」，可以使用該語言中更通用的日常問候語。
  `;
}

// 處理 OpenAI 回應
function handleOpenAIResponse(content, city, country) {
  try {
    const parsedJson = JSON.parse(content);
    if (parsedJson?.greeting && parsedJson?.trivia) {
      console.log("成功解析並驗證 OpenAI 的 JSON 回應。");
      return parsedJson;
    }
    throw new Error("回應格式不符合預期");
  } catch (error) {
    console.error("處理 OpenAI 回應時發生錯誤:", error);
    return {
      greeting: `(無法獲取 ${country} 的道地問候)`,
      trivia: `你知道嗎？關於 ${city}, ${country} 的有趣知識正在探索中！`
    };
  }
}

// 主要處理函數
export default async function handler(req, res) {
  // 方法檢查
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  // OpenAI 客戶端檢查
  if (!openai) {
    return res.status(500).json({ error: "服務設定問題，無法生成額外資訊。" });
  }

  try {
    const { city, country, language = "Traditional Chinese" } = req.body;

    // 參數驗證
    if (!city || !country) {
      return res.status(400).json({ 
        error: "必須提供 'city' (城市) 和 'country' (國家) 才能獲取問候語和小知識。" 
      });
    }

    console.log(`API 收到請求: City='${city}', Country='${country}', Lang='${language}'`);

    // 呼叫 OpenAI API
    const prompt = generatePrompt(city, country, language);
    const chatCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: "system", 
          content: "你是一位能提供特定地點問候語和有趣小知識的助手，並且能嚴格按照要求的 JSON 格式回傳結果。" 
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 250,
      temperature: 0.6
    });

    // 處理回應
    const content = chatCompletion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI 回應格式錯誤");
    }

    const result = handleOpenAIResponse(content, city, country);
    return res.status(200).json(result);

  } catch (error) {
    console.error("生成故事時發生錯誤:", error);
    const errorMessage = error.response?.data?.error?.message || error.message || "未預期的錯誤";
    return res.status(500).json({ error: errorMessage });
  }
}
