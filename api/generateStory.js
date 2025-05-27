// 檔案路徑: your-project-folder/api/generateStory.js

import { OpenAI } from 'openai'; // 從 openai 套件中引入 OpenAI

// 您的 OpenAI API 金鑰將會從 Vercel 的環境變數中讀取。
// 請確保您稍後會在 Vercel 網站上為您的專案設定這個名為 OPENAI_API_KEY 的環境變數。
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 您想使用的 ChatGPT 模型，也可以設為環境變數或直接在此指定。
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

let openai; // 用來存放 OpenAI 客戶端實例

// 檢查 API 金鑰是否存在，如果存在，則初始化 OpenAI 客戶端
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
} else {
  // 如果沒有設定 API 金鑰，在 Vercel 的函式日誌中印出錯誤，這有助於您之後部署時偵錯
  console.error("重要：OpenAI API 金鑰未在 Vercel 環境變數中設定 (OPENAI_API_KEY)。此函式將無法正常運作。");
}

// Vercel Serverless Function 的主要處理函式
// 它會處理來自前端的 HTTP 請求 (req) 並回傳 HTTP 回應 (res)
export default async function handler(req, res) {
  // 步驟 1: 檢查 OpenAI 客戶端是否已準備就緒 (API Key 是否成功載入)
  if (!openai) {
    console.error("OpenAI client 未初始化。請檢查 Vercel 環境變數中的 OPENAI_API_KEY 設定。");
    // 回傳一個 500 (伺服器內部錯誤) 給前端
    return res.status(500).json({ error: "故事生成服務因伺服器端設定問題而無法使用。" });
  }

  // 步驟 2: 我們的 API 設計為只接受 POST 方法的請求
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']); // 告訴客戶端我們只接受 POST
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  try {
    // 步驟 3: 從前端傳來的請求 body (JSON 格式) 中獲取資料
    // req.body 會是前端 fetch 時 body: JSON.stringify({...}) 裡面的物件
    const { city, country, userName, language = "Traditional Chinese" } = req.body;

    // 步驟 4: 檢查必要的參數 (城市和國家) 是否存在
    if (!city || !country) {
      return res.status(400).json({ error: "缺少必要參數：必須提供 'city' (城市) 和 'country' (國家)。" });
    }

    // 如果前端沒有傳送 userName，給一個預設的名稱
    const userForStory = userName || "一位勇敢的探險家";

    // 步驟 5: 設計您要給 ChatGPT 的「提示」(Prompt)
    // 這個 prompt 會告訴 ChatGPT 您希望它生成什麼樣的故事。
    // 您可以盡情發揮創意來調整這個 prompt！
    const prompt = `
      請為一位叫做 "${userForStory}" 的角色，寫一個簡短且充滿想像力的冒險事件（大約50至100字）。
      故事的背景必須設定在：${city}，${country}。
      故事的開頭應該是 ${userForStory} 在 ${city} 這個地方，有了一個出乎意料的發現，或者遇到了一些與當地風情或虛構的當地傳說相關的神秘事物，由此展開一段獨特的冒險。
      請確保故事風格引人入勝且有趣，適合大眾閱讀。
      故事必須用${language}書寫。
    `;

    // (可選) 在 Vercel Functions 的日誌中記錄一下收到的請求，方便偵錯
    console.log(`API 收到的請求: City='${city}', Country='${country}', User='${userForStory}', Language='${language}'`);
    // console.log("發送給 OpenAI 的完整 Prompt:", prompt); // 正式上線時可考慮移除或節制此 log

    // 步驟 6: 呼叫 OpenAI API (Chat Completions Endpoint) 來生成故事
    const chatCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL, // 使用設定的模型
      messages: [
        { "role": "system", "content": "你是一位頂尖的說書人，非常擅長為使用者根據他們提供的地點和角色，編寫獨一無二、引人入勝且適合大眾的短篇冒險故事。" },
        { "role": "user", "content": prompt }, // 我們精心設計的 prompt
      ],
      max_tokens: 500,  // 生成故事的最大 token 數量 (注意：1個中文字大約佔用2-3個token)
      temperature: 0.75, // 控制故事的創意程度/隨機性 (0.2 較為固定和保守，1.0 較為隨機和奔放)
      // top_p: 1, // 另一種控制隨機性的方式，通常與 temperature 二選一
      // frequency_penalty: 0.0, // 降低重複相同詞句的機率
      // presence_penalty: 0.0,  // 鼓勵引入新概念
    });

    // 步驟 7: 處理 OpenAI API 的回應
    if (chatCompletion.choices && chatCompletion.choices.length > 0 && chatCompletion.choices[0].message && chatCompletion.choices[0].message.content) {
      const story = chatCompletion.choices[0].message.content.trim();
      console.log("OpenAI 成功生成故事。");
      // 成功！將生成的冒險故事以 JSON 格式回傳給前端
      return res.status(200).json({ story: story });
    } else {
      // 如果 OpenAI 回應的格式不符合預期
      console.error("OpenAI 回應的格式非預期:", chatCompletion);
      return res.status(500).json({ error: "從 OpenAI 收到的回應格式錯誤，無法生成故事。" });
    }

  } catch (error) {
    // 步驟 8: 處理過程中可能發生的任何錯誤 (例如網路問題、OpenAI API 金鑰無效、超出用量等)
    console.error("在 generateStory 函式中發生錯誤:", error.message);
    let detailedErrorMessage = "生成冒險故事時發生未預期的錯誤。";

    // 嘗試解析更詳細的 OpenAI API 錯誤訊息 (如果有的話)
    if (error.response && error.response.data) { // 通常是 axios 或類似 HTTP 客戶端回傳的錯誤結構
      console.error("詳細的 OpenAI API 錯誤:", error.response.data);
      if (error.response.data.error && error.response.data.error.message) {
        detailedErrorMessage = `OpenAI API 錯誤: ${error.response.data.error.message}`;
      }
    } else if (error.name === 'TimeoutError') {
        detailedErrorMessage = "請求 OpenAI API 超時，請稍後再試。";
    } else if (error.message) {
        // 有些錯誤 (例如 OpenAI SDK v4 的錯誤) 可能直接在 error.message 中包含有用資訊
        detailedErrorMessage = error.message;
    }
    
    return res.status(500).json({ error: detailedErrorMessage });
  }
}
