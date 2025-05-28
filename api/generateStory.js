// 檔案路徑: your-project-folder/api/generateStory.js
import { OpenAI } from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

let openai;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.error("重要：OpenAI API 金鑰未在 Vercel 環境變數中設定 (OPENAI_API_KEY)。函式將無法正常運作。");
}

export default async function handler(req, res) {
  if (!openai) {
    console.error("OpenAI client 未初始化。");
    return res.status(500).json({ error: "服務設定問題，無法生成額外資訊。" });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  try {
    const {
      city,                // 城市名稱
      country,             // 國家名稱
      // userName,         // userName 可能不再直接用於這個 prompt，但可以保留以備將來使用
      language = "Traditional Chinese" // 主要回應語言
    } = req.body;

    console.log(`API 收到請求 (問候與知識): City='${city}', Country='${country}', Lang='${language}'`);

    if (!city || !country) {
      return res.status(400).json({ error: "必須提供 'city' (城市) 和 'country' (國家) 才能獲取問候語和小知識。" });
    }

    // 設計新的 Prompt 給 OpenAI
    const prompt = `
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

    console.log("最終發送給 OpenAI 的 Prompt (節錄):", prompt.substring(0, 300) + "...");

    const chatCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { "role": "system", "content": "你是一位能提供特定地點問候語和有趣小知識的助手，並且能嚴格按照要求的 JSON 格式回傳結果。" },
        { "role": "user", "content": prompt },
      ],
      response_format: { type: "json_object" }, // ★ 要求 OpenAI 以 JSON 格式輸出
      max_tokens: 250, // 限制 token 數量
      temperature: 0.6, 
    });

    if (chatCompletion.choices && chatCompletion.choices.length > 0 && chatCompletion.choices[0].message && chatCompletion.choices[0].message.content) {
      const content = chatCompletion.choices[0].message.content;
      console.log("OpenAI 原始回應內容:", content);
      try {
        const parsedJson = JSON.parse(content); // 解析 OpenAI 回傳的 JSON 字串
        // 驗證回傳的 JSON 是否包含 greeting 和 trivia
        if (parsedJson && typeof parsedJson.greeting === 'string' && typeof parsedJson.trivia === 'string') {
            console.log("成功解析並驗證 OpenAI 的 JSON 回應。");
            return res.status(200).json(parsedJson); // 直接回傳解析後的 JSON 物件
        } else {
            console.error("OpenAI 回傳的 JSON 格式不符合預期 (缺少 greeting 或 trivia):", parsedJson);
            // 如果格式不對，嘗試回傳一個預設的錯誤或通用訊息，但仍是 JSON 格式
            return res.status(200).json({ 
                greeting: `(無法獲取 ${country} 的道地問候)`, 
                trivia: `你知道嗎？關於 ${city}, ${country} 的有趣知識正在探索中！` 
            });
        }
      } catch (parseError) {
        console.error("解析 OpenAI 回應的 JSON 時失敗:", parseError, "原始內容:", content);
        // 如果解析失敗，表示 OpenAI 沒有嚴格按 JSON 格式回傳，這是一個問題
        // 嘗試從原始 content 中提取，或回傳通用訊息
        return res.status(200).json({ // 即使解析失敗，也嘗試回傳一個 JSON 結構給前端
            greeting: `(問候語獲取失敗)`,
            trivia: `(小知識獲取失敗 - API回應解析錯誤)。原始訊息片段：${content.substring(0,100)}...`
        });
      }
    } else {
      console.error("OpenAI 回應的格式非預期 (沒有 choices 或 message):", chatCompletion);
      return res.status(500).json({ error: "從 OpenAI 收到的回應主體格式錯誤，無法獲取資訊。" });
    }

  } catch (error) {
    console.error("在 generateStory (問候與知識) 函式中發生錯誤:", error.name, error.message);
    let detailedErrorMessage = "獲取地點問候與知識時發生未預期的錯誤。";
     if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
      detailedErrorMessage = `OpenAI API 錯誤: ${error.response.data.error.message}`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    return res.status(500).json({ error: detailedErrorMessage });
  }
}
