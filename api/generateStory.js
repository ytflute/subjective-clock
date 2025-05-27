// 檔案路徑: your-project-folder/api/generateStory.js
import { OpenAI } from 'openai';
import tzlookup from 'tz-lookup';

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
    return res.status(500).json({ error: "故事生成服務因伺服器端設定問題而無法使用。" });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `方法 ${req.method} 不被允許。請使用 POST。` });
  }

  try {
    const {
      city, country, userName,
      language = "Traditional Chinese", // 預設語言
      latitude, longitude, activityType,
      timezone: providedTimezone
    } = req.body;

    const userForStory = userName || (activityType && activityType.startsWith("peeking") ? "一位神秘的觀察者" : "一位勇敢的探險家");
    let locationForPrompt = (city && country) ? `${city}, ${country}` : "目前所在的位置";
    let targetTimezone = providedTimezone;
    let countryForGreeting = country; // 用於生成問候語的國家名稱

    console.log(`API 收到請求: City='${city}', Country='${country}', User='${userForStory}', Lang='${language}', Lat='${latitude}', Lon='${longitude}', Activity='${activityType}', ProvidedTZ='${providedTimezone}'`);

    // --- 時區與當地時間處理 ---
    if (activityType === "peeking" && latitude !== undefined && longitude !== undefined && !targetTimezone) {
      try {
        targetTimezone = tzlookup(parseFloat(latitude), parseFloat(longitude));
        console.log(`根據即時經緯度 (${latitude}, ${longitude}) 查找到的時區: ${targetTimezone}`);
        if (city && country) {
             locationForPrompt = `${city}, ${country}`;
             countryForGreeting = country; // 如果前端有傳，優先使用
        } else {
            // 如果沒有城市國家，可以嘗試反向地理編碼，或讓問候語更通用
            // 暫時，如果只有經緯度，問候語的國家可能不明確，prompt 會做相應處理
            locationForPrompt = `目前所在座標 (${parseFloat(latitude).toFixed(2)}, ${parseFloat(longitude).toFixed(2)}) 附近`;
            if (!countryForGreeting) console.warn("即時偷看請求缺少國家資訊，問候語可能較通用。");
        }
      } catch (tzError) {
        console.error(`從即時經緯度查詢時區失敗: ${tzError.message}`);
        targetTimezone = null;
      }
    } else if (activityType === "peekingBasedOnHistory") {
      if (city && country) { // 歷史記錄中應有 city 和 country
        locationForPrompt = `${city}, ${country}`;
        countryForGreeting = country;
        if (!targetTimezone && latitude !== undefined && longitude !== undefined) { // 如果歷史有經緯度但沒時區
            try {
              targetTimezone = tzlookup(parseFloat(latitude), parseFloat(longitude));
              console.log(`根據歷史經緯度查找到的時區: ${targetTimezone}`);
            } catch (tzError) {
              console.error(`從歷史經緯度查詢時區失敗: ${tzError.message}`);
              targetTimezone = null;
            }
        }
      } else if (!targetTimezone) {
        console.warn("根據歷史偷看請求缺少足夠的時區或地點資訊來確定時區。");
      }
    }

    let localTimeDescription = "當地時間";
    let localHourForPrompt = null;
    let localDayOfWeekForPrompt = "";

    if (targetTimezone) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: targetTimezone, hour: 'numeric', minute: '2-digit',
          weekday: 'long', hour12: false
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
        localDayOfWeekForPrompt = weekdayMap[now.getUTCDay()];
        localTimeDescription = `此時此刻 (${localDayOfWeekForPrompt})`;
    }
    // --- 時區與當地時間處理結束 ---

    // --- Prompt 設計 ---
    let prompt;
    let greetingInstruction = "";

    // 只有當我們有國家資訊時，才加入特定國家的問候語指令
    if (countryForGreeting) {
        greetingInstruction = `
          故事的第一句話，請讓故事中的某個角色用「${countryForGreeting}」這個國家的常用本地語言說一句簡短（一到兩個詞即可）、道地且適合情境的打招呼的問候語（例如 "你好！"、"Hello!"、"Bonjour!" 等，請根據「${countryForGreeting}」的實際情況和接下來的故事場景選擇）。如果可以，請在問候語後面用括號註明這是什麼語言的問候，例如 "(法文的你好)"。
          在這句獨特的問候語之後，再開始接下來的故事。
        `;
    } else {
        greetingInstruction = "故事的開頭，如果情境合適，可以安排一個角色用一句通用的問候語開始。";
    }


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
        你是一位富有想像力的說書人。
        ${greetingInstruction}
        接下來，請為一位名叫 "${userForStory}" 的角色，生動地描寫一段他們此刻可能正在經歷的事情。
        地點線索：他們大致在 ${locationForPrompt}。
        當地時間線索：大約是 ${localTimeDescription}${timeContextForPrompt}。
        
        請你根據這些線索，以及 ${countryForGreeting || '該地區'} 一般的文化背景和生活習慣，
        構思一件 "${userForStory}" 在這個時間點、這個星期(${localDayOfWeekForPrompt})、這個地點，
        可能正在從事的、合理的日常活動或特殊經歷。
        除了開頭的打招呼那一句話之外，故事的主要內容（大約50字以內）必須用${language}書寫，並且用詞生動，能讓讀者感受到當地的氛圍。
      `;
       if (!targetTimezone && !(city && countryForGreeting) && activityType === "peeking") { // 非常通用的偷看 prompt
            prompt = `
                你是一位富有想像力的說書人。
                ${greetingInstruction} {/* 這裡的 greetingInstruction 會比較通用 */}
                請為一位名叫 "${userForStory}" 的角色，發揮創意，描寫一段他們此刻可能正在經歷的有趣日常片段或內心小劇場（大約50字以內）。
                由於無法得知他們的確切位置和當地時間，請自由想像一個温馨、驚奇或引人思考的場景。
                故事的主要內容必須用${language}書寫。`;
       }

    } else { // 預設是原本的「甦醒冒險故事」
      if (!city || !country) { // 甦醒故事必須有城市和國家
        return res.status(400).json({ error: "製作甦醒冒險故事必須提供 'city' (城市) 和 'country' (國家)。" });
      }
      countryForGreeting = country; // 甦醒故事使用其地點的國家
      // 更新問候語指令，確保使用甦醒故事的國家
        if (countryForGreeting) {
            greetingInstruction = `
            故事的第一句話，請讓故事中的某個角色用「${countryForGreeting}」這個國家的常用本地語言說一句簡短（一到兩個詞即可）、道地且適合情境的打招呼的問候語（例如 "你好！"、"Hello!"、"Bonjour!" 等，請根據「${countryForGreeting}」的實際情況和接下來的故事場景選擇）。如果可以，請在問候語後面用括號註明這是什麼語言的問候，例如 "(法文的你好)"。
            在這句獨特的問候語之後，再開始接下來的故事。
            `;
        } else { // 如果甦醒故事也沒有國家資訊 (理論上不應該)
            greetingInstruction = "故事的開頭，如果情境合適，可以安排一個角色用一句通用的問候語開始。";
        }

      prompt = `
        你是一位頂尖的說書人，專門為使用者根據他們提供的地點和角色，編寫獨一無二、引人入勝且適合大眾的短篇冒險故事。
        ${greetingInstruction}
        接下來，請為一位名叫 "${userForStory}" 的角色，寫一個簡短且充滿想像力的冒險故事（大約50字以內）。
        故事的背景必須設定在：${city}，${country}。
        故事的開頭應該是 ${userForStory} 在 ${city} 這個地方，有了一個出乎意料的發現，或者遇到了一些與當地風情或虛構的當地傳說相關的神秘事物，
        由此展開一段獨特的冒險。
        除了開頭的打招呼那一句話之外，故事的主要內容必須用${language}書寫，並且確保故事風格引人入勝且有趣，適合大眾閱讀。
      `;
    }
    // --- Prompt 設計結束 ---

    console.log("最終發送給 OpenAI 的 Prompt (節錄給日誌):", prompt.substring(0, 350) + "...");

    const chatCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { "role": "system", "content": "你是一位才華洋溢的說書人，擅長根據使用者提供的角色、地點、時間、文化背景和特定要求（例如用當地語言打招呼），編寫出獨特、生動且符合情境的短篇故事。" },
        { "role": "user", "content": prompt },
      ],
      max_tokens: 650, 
      temperature: 0.8,
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
