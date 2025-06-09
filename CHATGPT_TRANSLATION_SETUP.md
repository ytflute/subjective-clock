# ChatGPT 翻譯與心情故事功能設定指南

## 概述

現在我們的系統整合了兩個 ChatGPT 功能：
1. **智能翻譯**: 自動將英文城市和國家名稱翻譯為繁體中文
2. **心情故事**: 根據用戶選擇的心情生成不同風格的甦醒故事

## 所需的 API 密鑰

### 1. OpenAI API Key（必需）

1. 前往 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 登入或註冊 OpenAI 帳戶
3. 點選 "Create new secret key"
4. 複製生成的 API 密鑰（格式：`sk-...`）
5. 在 Vercel 專案中設定環境變數：
   - 變數名稱：`OPENAI_API_KEY`
   - 變數值：您的 OpenAI API 密鑰

### 2. GeoNames Username（已有）

如前面設定的 `GEONAMES_USERNAME`

## 功能特色

### ✅ **智能翻譯**
- 使用 ChatGPT-3.5-turbo 進行專業地名翻譯
- 自動識別約定俗成的中文名稱（如：New York → 紐約）
- 支援城市和國家名稱的同時翻譯

### ✅ **心情故事生成** (NEW!)
- 根據用戶選擇的四種心情生成不同風格的故事：
  - **😊🌞 快樂熱情**: 充滿陽光活力，描述熱鬧節慶、音樂舞蹈
  - **😌🌱 平靜溫和**: 溫和舒緩，描述自然風景、安靜咖啡館
  - **🤔🍂 憂鬱思考**: 深沉內斂，描述歷史故事、文學色彩
  - **😔❄️ 寂寞冷淡**: 詩意孤寂，描述雪景、空曠街道

### ✅ **故障回退機制**
- 如果 ChatGPT 翻譯失敗，會自動使用預設的中文翻譯
- 如果預設翻譯也沒有，會保留原英文名稱
- 確保系統穩定運作，不會因翻譯服務中斷而停止工作

### ✅ **翻譯來源標記**
- 每個回應都會標記翻譯來源：
  - `chatgpt`: ChatGPT 翻譯成功
  - `chatgpt-fallback`: ChatGPT 為備用資料翻譯成功
  - `fallback`: 使用預設翻譯
  - `geonames`: 原始 GeoNames 資料（通常是英文）

## 新增的 API 端點

### `/api/translate-location`

**功能**: 將城市和國家名稱翻譯為繁體中文

**請求方式**: POST

**請求格式**:
```json
{
  "city": "New York",
  "country": "United States",
  "countryCode": "US"
}
```

**回應格式**:
```json
{
  "city": "New York",
  "country": "United States",
  "countryCode": "US",
  "city_zh": "紐約",
  "country_zh": "美國",
  "translated": true,
  "source": "chatgpt"
}
```

### `/api/generateStory` (修改)

**功能**: 根據心情生成甦醒故事

**請求方式**: POST

**請求格式**:
```json
{
  "city": "Paris",
  "country": "France",
  "mood": "happy",
  "moodName": "快樂熱情",
  "moodDescription": "熱帶陽光般的溫暖",
  "moodEmoji": "😊🌞"
}
```

**回應格式**:
```json
{
  "greeting": "Bonjour !",
  "trivia": "今天的你在法國的巴黎醒來，街頭響起手風琴的悠揚樂聲，路邊咖啡館傳來陣陣歡聲笑語，你感受到這座城市濃厚的藝術氛圍，彷彿每個角落都在慶祝生活的美好。",
  "city_zh": "巴黎",
  "country_zh": "法國",
  "mood": "happy",
  "moodName": "快樂熱情",
  "moodDescription": "熱帶陽光般的溫暖",
  "moodEmoji": "😊🌞"
}
```

## 心情故事範例

### 😊 快樂熱情 (Happy)
> 今天的你在法國的巴黎醒來，街頭響起手風琴的悠揚樂聲，路邊咖啡館傳來陣陣歡聲笑語，你感受到這座城市濃厚的藝術氛圍。

### 😌 平靜溫和 (Peaceful)  
> 今天的你在法國的巴黎醒來，漫步在塞納河畔，微風輕撫過臉頰，遠處傳來教堂鐘聲，你在河邊小咖啡館靜靜品味著香濃咖啡。

### 🤔 憂鬱思考 (Melancholy)
> 今天的你在法國的巴黎醒來，走過石板路的古老街區，思考著這座城市承載的歷史歲月，每一塊石頭都訴說著過往的故事。

### 😔 寂寞冷淡 (Lonely)
> 今天的你在法國的巴黎醒來，獨自穿越空曠的廣場，晨霧籠罩著沉靜的街道，你感受到城市中獨特的孤寂美感。

## 測試頁面

### 翻譯功能測試
訪問 `your-domain.vercel.app/test-translation.html` 測試翻譯功能

### 心情故事測試 (NEW!)
訪問 `your-domain.vercel.app/test-mood-stories.html` 測試四種心情的故事生成

## 成本考量

### OpenAI API 費用
- GPT-3.5-turbo 價格：約 $0.002 / 1K tokens
- 每次翻譯大約使用 50-100 tokens
- 每次故事生成大約使用 200-300 tokens
- 預估成本：
  - 翻譯：約 $0.0001-0.0002 USD/次
  - 故事生成：約 $0.0004-0.0006 USD/次

### 免費額度
- 新註冊的 OpenAI 帳戶通常有 $5 USD 的免費額度
- 可以支援約 8,000-10,000 次完整使用（翻譯+故事生成）

## 整合流程

1. **用戶選擇心情**: 在前端選擇四種心情之一
2. **GeoNames API 查詢**: 獲取英文城市和國家名稱
3. **ChatGPT 翻譯**: 自動呼叫翻譯 API 轉換為中文
4. **ChatGPT 故事生成**: 根據心情和地點生成個性化故事
5. **結果合併**: 回傳包含中英文名稱和心情故事的完整資料
6. **前端顯示**: 使用中文名稱和心情化故事提升用戶體驗

## 優勢

1. **個性化體驗**: 根據心情生成不同風格的故事
2. **實時翻譯**: 不需要維護巨大的中文地名資料庫
3. **準確性高**: ChatGPT 能理解地名的語境和慣用翻譯
4. **自動更新**: 新的地名會自動獲得翻譯支援
5. **成本效益**: 使用成本極低，但體驗提升明顯
6. **容錯性強**: 多層回退機制確保服務穩定
7. **情感連結**: 心情化故事增加用戶的情感投入

## 環境變數設定

在 Vercel 專案設定中添加：

```
OPENAI_API_KEY=sk-your_openai_api_key_here
GEONAMES_USERNAME=your_geonames_username
```

設定完成後，重新部署專案即可啟用所有 ChatGPT 功能！

## 🆕 最新更新：簡化翻譯流程

### 變更說明
- **舊版本**: 在 generateStory API 中先呼叫翻譯 API，再生成故事（兩次 API 呼叫）
- **新版本**: 使用英文 `city` 和 `country` 參數，讓 ChatGPT 在生成故事時自動翻譯

### 優點
1. **降低成本**: 減少 50% 的 API 呼叫次數
2. **提升效率**: 單次請求完成翻譯和故事生成
3. **保持準確性**: ChatGPT 翻譯品質依然很高
4. **簡化架構**: 減少程式碼複雜度

### 使用方式
```javascript
// 直接使用英文參數
const response = await fetch('/api/generateStory', {
    method: 'POST',
    body: JSON.stringify({
        city: 'Tokyo',      // 英文城市名稱
        country: 'Japan',   // 英文國家名稱
        mood: 'peaceful'
    })
});

// ChatGPT 會在故事中自動翻譯為「東京」和「日本」
```

這個更新讓系統更加高效和經濟！ 