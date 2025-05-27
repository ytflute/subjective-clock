// 檔案路徑: your-project-folder/api/generateStory.js
import { OpenAI } from 'openai';
import tzlookup from 'tz-lookup'; // 引入 tz-lookup 套件

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
    console.error("OpenAI client 未初始化。請檢查 Vercel 環境變數中的 OPENAI_API_KEY 設定。");
    return res.status(500).json({ error: "故事生成服務因伺服器端設定問題而無法使用。" });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  try {
    const {
      city,
      country,
      userName,
      language = "Traditional Chinese",
      latitude,
      longitude,
      activityType,
      timezone: providedTimezone
    } = req.body;

    const userForStory = userName || (activityType && activityType.startsWith("peeking") ? "一位神秘的觀察者" : "一位勇敢的探險家");
    let locationForPrompt = (city && country) ? `${city}, ${country}` : "目前所在的位置";
    let targetTimezone = providedTimezone;

    console.log(`API 收到請求: City='${city}', Country='${country}', User='${userForStory}', Lang='${language}', Lat='${latitude}', Lon='${longitude}', Activity='${activityType}', ProvidedTZ='${providedTimezone}'`);

    // --- 時區與當地時間處理 ---
    if (activityType === "peeking" && latitude !== undefined && longitude !== undefined && !targetTimezone) {
      try {
        targetTimezone = tzlookup(parseFloat(latitude), parseFloat(longitude));
        console.log(`根據即時經緯度 (${latitude}, ${longitude}) 查找到的時區: ${targetTimezone}`);
        if (city && country) {
             locationForPrompt = `${city}, ${country}`;
        } else {
            locationForPrompt = `目前所在座標 (${parseFloat(latitude).toFixed(2)}, ${parseFloat(longitude).toFixed(2)}) 附近`;
        }
      } catch (tzError) {
        console.error(`從即時經緯度查詢時區失敗: ${tzError.message}`);
        targetTimezone = null;
      }
    } else if (activityType === "peekingBasedOnHistory") {
      if (city && country && targetTimezone) {
        locationForPrompt = `${city}, ${country}`;
      } else if (latitude !== undefined && longitude !== undefined && !targetTimezone) {
        try {
          targetTimezone = tzlookup(parseFloat(latitude), parseFloat(longitude));
          locationForPrompt = `上次已知座標 (${parseFloat(latitude).toFixed(2)}, ${parseFloat(longitude).toFixed(2)}) 附近`;
          console.log(`根據歷史經緯度查找到的時區: ${targetTimezone}`);
        } catch (tzError) {
          console.error(`從歷史經緯度查詢時區失敗: ${tzError.message}`);
          targetTimezone = null;
        }
      } else if (!targetTimezone) {
        console.warn("根據歷史偷看請求缺少足夠的時區或經緯度資訊來確定時區。");
      }
    }

    let localTimeDescription = "當地時間";
    let localHourForPrompt = null;
    let localDayOfWeekForPrompt = "";

    if (targetTimezone) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: targetTimezone,
          hour: 'numeric',
          minute: '2-digit',
          weekday: 'long',
          hour12: false
        });
        const parts = formatter.formatToParts(now);
        const hourPartVal = parts.find(p => p.type === 'hour')?.value;
        const minutePartVal = parts.find(p => p.type === 'minute')?.value;
        const weekdayPartVal = parts.find(p => p.type === 'weekday')?.value;

        if (hourPartVal && minutePartVal && weekdayPartVal) {
          localHourForPrompt = parseInt(hourPartVal, 10);
          const weekdayMap = { "Monday": "星期一", "Tuesday": "星期二", "Wednesday": "星期三", "Thursday": "星期四", "Friday": "星期五", "Saturday": "星期六", "Sunday": "星期日"};
          localDayOfWeekForPrompt = weekdayMap[weekdayPartVal] || weekdayPartVal;
          localTimeDescription = `${localDayOfWeekForPrompt} ${hourPartVal}:${minutePartVal}`;
          console.log(`目標地點 (${targetTimezone}) 的 ${localTimeDescription}`);
        } else {
            console.warn(`無法從 Intl.DateTimeFormat 獲取完整的時間組件 (時區: ${targetTimezone}): `, parts);
            localTimeDescription = `當地某個時間 (星期資訊未知)`;
        }
      } catch (timeError) {
        console.error(`轉換到目標時區 ${targetTimezone} 的時間失敗: ${timeError.message}`);
        localTimeDescription = `當地某個時間 (轉換時發生錯誤)`;
        targetTimezone = null;
      }
    } else if (activityType && activityType.startsWith("peeking")) {
        console.warn("「偷看」請求無法確定目標時區，故事將基於通用時間概念。");
        const now = new Date();
        const weekdayMap = {0:"星期日", 1:"星期一", 2:"星期二", 3:"星期三", 4:"星期四", 5:"星期五", 6:"星期六"};
        localDayOfWeekForPrompt = weekdayMap[now.getUTCDay()]; // 使用UTC星期作為備用
        localTimeDescription = `此時此刻 (${localDayOfWeekForPrompt})`;
    }
    // --- 時區與當地時間處理結束 ---

    // --- Prompt 設計 ---
    let prompt;

    if (activityType && activityType.startsWith("peeking")) {
      let timeContextForPrompt = "";
      if (localHourForPrompt !== null) {
        if (localHourForPrompt >= 5 && localHourForPrompt < 9) timeContextForPrompt = "的清晨";
        else if (localHourForPrompt >= 9 && localHourForPrompt < 12) timeContextForPrompt = "的上午";
        else if (localHourForPrompt >= 12 && localHourForPrompt < 14) timeContextForPrompt = "的中午時分";
        else if (localHourForPrompt >= 14 && localHourForPrompt < 18) timeContextForPrompt = "的下午";
        else if (localHourForPrompt >= 18 && localHourForPrompt < 22) timeContextForPrompt = "的傍晚或入夜時分";
        else timeContextForPrompt = "的深夜";
      }

      prompt = `
        你是一位富有想像力的說書人。請為一位名叫 "${userForStory}" 的角色，生動地描寫一段他們此刻可能正在經歷的事情。
        地點線索：他們大致在 ${locationForPrompt}。
        當地時間線索：大約是 ${localTimeDescription}${timeContextForPrompt}。
        
        請你根據這些線索，以及 ${country || '該地區'} 一般的文化背景和生活習慣，
        構思一件 "${userForStory}" 在這個時間點、這個星期(${localDayOfWeekForPrompt})、這個地點，
        可能正在從事的、合理的日常活動或特殊經歷。
        告訴讀者這個角色正在做什麼（約50字以內），簡潔與用詞生動，能讓讀者感受到當地的氛圍。
        故事必須用${language}書寫。
      `;
       if (!targetTimezone && !(city && country) && activityType === "peeking") {
            prompt = `
                你是一位富有想像力的說書人。請為一位名叫 "${userForStory}" 的角色，描寫一段他們此刻可能正在經歷的有趣日常片段或內心小劇場（約50字以內）。
                由於無法得知他們的確切位置和當地時間，請自由想像一個温馨、驚奇或引人思考的場景。
                故事必須用${language}書寫。`;
       }

    } else { // 預設是原本的「甦醒冒險故事」
      if (!city || !country) {
        return res.status(400).json({ error: "製作甦醒冒險故事必須提供 'city' (城市) 和 'country' (國家)。" });
      }
      prompt = `
        你是一位頂尖的說書人，專門為使用者根據他們提供的地點和角色，編寫獨一無二、引人入勝且適合大眾的短篇冒險故事。
        請為一位叫做 "${userForStory}" 的角色，寫一個簡短與背景有關的事件（大約50字以內）。
        故事的背景必須設定在：${city}，${country}。
        故事的開頭應該是 ${userForStory} 在 ${city} 這個地方，有了一個出乎意料的發現，或者遇到了一些與當地風情或虛構的當地傳說相關的神秘事物，
        由此展開一段獨特的冒險。
        請確保故事風格引人入勝且有趣，適合大眾閱讀。
        故事必須用${language}書寫。
      `;
    }
    // --- Prompt 設計結束 ---

    console.log("最終發送給 OpenAI 的 Prompt (節錄給日誌):", prompt.substring(0, 300) + "...");

    const chatCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { "role": "system", "content": "你是一位才華洋溢的說書人，擅長根據使用者提供的角色、地點、時間和文化背景，編寫出獨特、生動且符合情境的短篇故事。" },
        { "role": "user", "content": prompt },
      ],
      max_tokens: 600, 
      temperature: 0.78,
    });

    if (chatCompletion.choices && chatCompletion.choices.length > 0 && chatCompletion.choices[0].message && chatCompletion.choices[0].message.content) {
      const story = chatCompletion.choices[0].message.content.trim();
      console.log("OpenAI 成功生成故事。");
      return res.status(200).json({ story: story });
    } else {
      console.error("OpenAI 回應的格式非預期:", chatCompletion);
      return res.status(500).json({ error: "從 OpenAI 收到的回應格式錯誤，無法生成故事。" });
    }

  } catch (error) {
    console.error("在 generateStory 函式中發生錯誤:", error.name, error.message, error.stack);
    let detailedErrorMessage = "生成冒險故事時發生未預期的錯誤。";
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
      detailedErrorMessage = `OpenAI API 錯誤: ${error.response.data.error.message}`;
    } else if (error.message) {
        detailedErrorMessage = error.message;
    }
    return res.status(500).json({ error: detailedErrorMessage, detailsForDev: error.stack });
  }
}
