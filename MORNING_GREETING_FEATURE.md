# 🌅 早安問候語功能說明

## 功能概述

新增了按下按鈕後，系統會用找到的國家之當地語言說「早安！」的功能。例如如果是日本就用日語說「おはようございます」，如果是美國就用英語說「Good morning!」。

## 🚀 新增功能

### 1. ChatGPT API 整合
- **API 端點**：`/api/generateMorningGreeting`
- **功能**：根據國家自動生成當地語言的早安問候語
- **支援語言**：50+ 國家和語言
- **備用機制**：當 API 失敗時自動使用內建問候語

### 2. 網頁版本增強
- **語音合成**：使用瀏覽器內建 Speech Synthesis API
- **視覺顯示**：美觀的問候語顯示界面
- **多語言支援**：顯示原文、中文翻譯和羅馬拼音

### 3. Raspberry Pi 版本增強
- **API 整合**：調用網路 API 獲取問候語
- **語音播放**：使用 TTS 引擎（espeak 或 pyttsx3）
- **音頻快取**：智能快取機制避免重複生成
- **硬體整合**：透過 GF1002 喇叭播放

## 📁 新增檔案

### API 端點
```
api/generateMorningGreeting/index.js
```
- 主要的 ChatGPT API 端點
- 支援 50+ 國家的當地語言問候語
- 完整的錯誤處理和備用機制

### 測試頁面
```
test_morning_greeting.html
```
- 功能測試頁面
- 支援不同國家測試
- 語音播放測試功能

### 文檔
```
MORNING_GREETING_FEATURE.md (本檔案)
```

## 🔧 修改的檔案

### 網頁版本
1. **pi-script.js**
   - 新增 `generateAndDisplayMorningGreeting()` 函數
   - 新增 `speakGreeting()` 語音播放函數
   - 修改 `displayAwakeningResult()` 來整合問候語功能

2. **style.css**
   - 新增問候語顯示的 CSS 樣式
   - 漂亮的漸層背景和文字效果

### Raspberry Pi 版本
1. **raspberrypi-dsi/audio_manager.py**
   - 修改 `play_greeting()` 方法支援 ChatGPT API
   - 新增 `_fetch_greeting_from_api()` 方法
   - 完整的錯誤處理和備用機制

2. **raspberrypi-dsi/main.py**
   - 修改 `_play_morning_greeting()` 方法
   - 更好的參數傳遞和錯誤處理

## 🌍 支援的語言

### 主要語言
- **中文**：繁體中文、簡體中文、粵語
- **日語**：おはようございます（Ohayou gozaimasu）
- **韓語**：안녕하세요（Annyeonghaseyo）
- **英語**：Good morning!
- **西班牙語**：¡Buenos días!
- **法語**：Bonjour!
- **德語**：Guten Morgen!
- **義大利語**：Buongiorno!
- **葡萄牙語**：Bom dia!
- **俄語**：Доброе утро!

### 其他支援語言
- 荷蘭語、瑞典語、挪威語、丹麥語、芬蘭語
- 波蘭語、捷克語、阿拉伯語、泰語、越南語
- 印地語等...

## 🎯 使用流程

### 網頁版本
1. 用戶按下「開始這一天」按鈕
2. 系統找到甦醒城市
3. 調用 `/api/generateMorningGreeting` API
4. 顯示當地語言問候語（原文 + 中文 + 發音）
5. 自動播放語音問候

### Raspberry Pi 版本
1. 用戶按下實體按鈕
2. 系統找到甦醒城市
3. 調用網路 API 獲取問候語
4. 透過 TTS 引擎生成語音
5. 透過 GF1002 喇叭播放語音

## 🔊 技術特色

### 智能語言識別
- 根據國家代碼自動判斷主要語言
- 支援多官方語言國家的智能選擇
- 完整的備用機制確保穩定運行

### 語音技術
- **網頁版**：使用瀏覽器 Speech Synthesis API
- **Pi 版**：使用 espeak 或 pyttsx3 TTS 引擎
- 支援語速調整和音量控制

### 快取機制
- 智能音頻快取避免重複生成
- 自動清理過期快取文件
- 最佳化網路請求效率

## 🧪 測試方法

### 使用測試頁面
1. 開啟 `test_morning_greeting.html`
2. 選擇不同國家進行測試
3. 驗證問候語和語音播放

### 手動測試 API
```bash
# 測試日本
curl -X POST https://your-domain.vercel.app/api/generateMorningGreeting \
  -H "Content-Type: application/json" \
  -d '{"city":"Tokyo","country":"Japan","countryCode":"JP"}'

# 測試法國
curl -X POST https://your-domain.vercel.app/api/generateMorningGreeting \
  -H "Content-Type: application/json" \
  -d '{"city":"Paris","country":"France","countryCode":"FR"}'
```

### Raspberry Pi 測試
```bash
# 測試音頻管理器
cd raspberrypi-dsi
python3 -c "
from audio_manager import get_audio_manager
audio_mgr = get_audio_manager()
audio_mgr.play_greeting('JP', 'Tokyo', 'Japan')
"
```

## 🚨 錯誤處理

### API 錯誤
- ChatGPT API 失敗時自動使用備用問候語
- 網路錯誤時顯示友好錯誤訊息
- 完整的日誌記錄方便除錯

### 音頻錯誤
- TTS 引擎失敗時的備用方案
- 音頻設備問題的處理
- 瀏覽器不支援語音合成的提示

## 📈 未來擴展

### 計劃中的功能
- [ ] 更多語言支援（阿拉伯語、希伯來語等）
- [ ] 語音個性化（男聲/女聲選擇）
- [ ] 當地時間問候（早安/午安/晚安）
- [ ] 節慶特殊問候語
- [ ] 音頻品質最佳化

### 技術改進
- [ ] 離線語音合成支援
- [ ] 更快的API回應時間
- [ ] 更好的音頻壓縮
- [ ] 多語言混合問候語

## 🎉 總結

這個新功能大大增強了甦醒地圖的互動性和國際化體驗。無論是網頁版本還是 Raspberry Pi 實體裝置，用戶都能聽到來自世界各地的當地語言早安問候，讓每一天的開始更加特別和有意義。

功能設計考慮了穩定性、效能和用戶體驗，通過多層備用機制確保在任何情況下都能提供良好的服務。 