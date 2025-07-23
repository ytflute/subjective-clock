# 甦醒地圖 Raspberry Pi 版 v3.0.0

🌟 **Nova 整合版 - ChatGPT 多語言無縫播放**

## 🎯 版本特色

### 🤖 ChatGPT Nova 引擎
- **高品質語音**：OpenAI TTS-HD + Nova 語音模型
- **多語言支援**：50+ 種語言流暢自然發音
- **無縫整合**：當地語言問候 + 中文故事一氣呵成
- **智能處理**：自動語言檢測和內容整合

### 🎵 播放模式

#### 🌟 整合模式（推薦）
```
體驗：Nova 一次性播放
示例：「¡Buenos días! 今天的你在墨西哥城甦醒，感受陽光灑落在色彩繽紛的市集上...」
特點：無停頓、自然流暢、完美語音過渡
```

#### 🔄 分離模式
```
體驗：分別播放問候語和故事
流程：當地語言問候 → 短暫停頓 → 中文故事
優點：可單獨控制每部分的播放
```

## 🚀 快速開始

### 1. 系統要求
```bash
# 確認系統版本
cat /etc/os-release

# 必要依賴
sudo apt update
sudo apt install python3 python3-pip ffmpeg chromium-chromedriver
```

### 2. 安裝和配置
```bash
# 克隆專案
git clone https://github.com/ytflute/subjective-clock.git
cd subjective-clock/raspberrypi-dsi

# 安裝依賴
pip3 install -r requirements.txt

# 配置 OpenAI API
python3 setup_openai_tts.py
```

### 3. 模式配置
```bash
# 檢查當前模式
python3 toggle_nova_mode.py

# 快速設定：啟用 Nova 整合模式
python3 -c "
from config import TTS_CONFIG
print('當前引擎:', TTS_CONFIG['engine'])
print('整合模式:', TTS_CONFIG.get('nova_integrated_mode', True))
"
```

### 4. 運行系統
```bash
# 啟動甦醒地圖系統
python3 run_updated_system.py

# 按 GPIO 18 按鈕開始體驗
```

## 🎛️ 控制工具

### toggle_nova_mode.py - 模式切換工具
```bash
python3 toggle_nova_mode.py

# 功能選項：
# 1. 切換模式 (整合 ↔ 分離)
# 2. 啟用 Nova 整合模式
# 3. 禁用 Nova 整合模式  
# 4. 查看模式說明
# 5. 退出
```

### 診斷工具
```bash
# OpenAI TTS 診斷
python3 diagnose_openai_tts.py

# 音頻播放測試
python3 test_audio_playback.py

# 按鈕測試
python3 test_button_functionality.py
```

## 🔧 配置文件

### config.py 關鍵設定
```python
TTS_CONFIG = {
    'engine': 'openai',                    # 使用 OpenAI TTS
    'openai_api_key': 'sk-proj-...',      # 你的 API Key
    'openai_model': 'tts-1-hd',           # 高品質模型
    'openai_voice': 'nova',               # Nova 語音
    'openai_speed': 1.0,                  # 自然語速
    'nova_integrated_mode': True,         # 啟用整合模式
}
```

## 🎵 音頻體驗對比

### ❌ v2.x 版本體驗
```
1. espeak 播放："¡Buenos días!" (機械音)
2. [停頓 1-2 秒]
3. Nova 播放："今天的你在墨西哥城甦醒..." (流暢音)
```

### ✅ v3.0 版本體驗  
```
1. Nova 無縫播放："¡Buenos días! 今天的你在墨西哥城甦醒，感受陽光灑落在色彩繽紛的市集上，鮮豔的墨西哥風情充滿街頭..."
2. 完全無停頓，自然語音過渡
```

## 🐛 故障排除

### 常見問題

#### 問題 1：仍然聽到 espeak 聲音
```bash
# 檢查配置
python3 -c "from config import TTS_CONFIG; print('引擎:', TTS_CONFIG['engine'])"

# 如果不是 'openai'，重新配置
python3 setup_openai_tts.py
```

#### 問題 2：Nova 整合模式未啟用
```bash
# 強制啟用整合模式
python3 toggle_nova_mode.py
# 選擇選項 2: 啟用 Nova 整合模式
```

#### 問題 3：音頻播放失敗
```bash
# 檢查音頻系統
python3 test_audio_playback.py

# 檢查 ffmpeg 安裝
ffmpeg -version

# 重新安裝音頻依賴
sudo apt install ffmpeg sox alsa-utils
```

#### 問題 4：API 請求失敗
```bash
# 測試 OpenAI 連接
python3 diagnose_openai_tts.py

# 檢查 API Key
python3 -c "from config import TTS_CONFIG; print('API Key 長度:', len(TTS_CONFIG['openai_api_key']))"
```

## 📋 日誌解讀

### 成功運行的日誌標記
```
✨ OpenAI TTS 引擎初始化成功！
🔍 整合模式條件檢查: story_text='True', openai='True', integrated='True'
🌟 Nova 整合模式：當地問候語 + 中文故事
🤖 Nova 多語言整合朗讀開始...
✨ Nova 整合朗讀完成：當地問候 + 中文故事
```

### 需要注意的警告
```
⚠️ OpenAI TTS 失敗，使用備用引擎  # 檢查 API Key
⚠️ 當地語言問候語播放失敗        # 檢查網路連接
⚠️ Nova 整合音頻生成失敗         # 檢查 ffmpeg 安裝
```

## 🌟 功能優勢

### 🎵 音質提升
- **傳統 TTS**：機械化、不自然的合成音
- **Nova TTS**：接近真人的流暢自然語音
- **多語言**：每種語言都有優化的發音

### 🔄 體驗流暢度
- **停頓消除**：告別語音間的尷尬停頓
- **情境連接**：當地問候自然過渡到故事情節
- **沉浸感**：完整的文化和語言體驗

### 🛠️ 技術可靠性
- **智能備用**：網路或 API 問題時自動降級
- **格式兼容**：完善的 MP3/WAV 轉換機制
- **錯誤處理**：詳細的診斷和恢復機制

## 📞 技術支援

### 更新系統
```bash
# 拉取最新更新
git pull origin main

# 重新運行
python3 run_updated_system.py
```

### 重置配置
```bash
# 重置 TTS 配置
python3 setup_openai_tts.py

# 重置模式設定
python3 toggle_nova_mode.py
```

---

**甦醒地圖 v3.0.0 - 讓 Nova 用世界的語言為你講述甦醒的故事** 🌍🎵✨ 