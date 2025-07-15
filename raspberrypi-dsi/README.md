# WakeUpMap - 甦醒地圖 (DSI螢幕版本)

🌅 **按下按鈕，開始新的一天** 🌅

基於 Raspberry Pi 4B + DSI 800x480 螢幕的甦醒地圖裝置，按下按鈕即可獲得世界各地的甦醒城市，並顯示當地語言的早安問候。

## ✨ 功能特色

- 🔘 **一鍵操作**：按下按鈕即可開始
- 🌍 **全球城市**：基於時間智能匹配世界各地城市
- 🌐 **多語言問候**：顯示當地語言的早安問候語
- 🔊 **語音問候**：透過 GF1002 喇叭播放當地語言早安問候
- ⏰ **時間特例**：7:50-8:10 直接顯示您當地的城市
- 📱 **現代界面**：800x480 觸控螢幕，美觀易用
- 🔄 **網頁同步**：可與網頁版本同步資料
- 💡 **LED指示**：按鈕狀態LED指示燈
- 🛡️ **穩定運行**：systemd服務，開機自啟

## 🔧 硬體需求

### 必要硬體
- **Raspberry Pi 4B** (推薦4GB以上)
- **DSI 800x480 螢幕** (電容式觸控)
- **按鈕開關** x 1
- **GF1002 喇叭** x 1 (8Ω, 2W)
- **LED** x 1 (可選)
- **限流電阻** (330Ω, 用於LED)
- **3.5mm音頻線** (連接喇叭)
- **杜邦線** 若干

### 硬體連接

```
┌─────────────────┐
│  Raspberry Pi   │
│                 │
│ GPIO 18 ●───────┼─── 按鈕 ─── GND
│                 │
│ GPIO 16 ●───────┼─── 限流電阻 ─── LED ─── GND
│                 │
│   DSI   ●───────┼─── DSI螢幕
│                 │
│ 3.5mm   ●───────┼─── GF1002喇叭
│  音頻            │
└─────────────────┘
```

#### 詳細接線
| 功能 | GPIO針腳 | 實體針腳 | 連接 |
|------|----------|----------|------|
| 按鈕 | GPIO 18 | 12 | 按鈕 → GND (使用內建上拉電阻) |
| LED | GPIO 16 | 36 | 限流電阻 → LED → GND |
| DSI螢幕 | DSI接口 | DSI接口 | 15針排線連接 |
| GF1002喇叭 | 3.5mm音頻接口 | 音頻插孔 | 3.5mm音頻線連接 |

## 🚀 快速開始

### 1. 下載代碼

```bash
# 方法1：從GitHub下載
cd /home/pi
git clone https://github.com/ytflute/subjective-clock.git
cd subjective-clock/raspberrypi-dsi

# 方法2：手動上傳文件到樹莓派
# 將整個 raspberrypi-dsi 資料夾上傳到 /home/pi/wakeupmap-dsi
```

### 2. 運行安裝腳本

```bash
# 給安裝腳本執行權限
chmod +x install.sh

# 執行安裝（需要sudo權限）
sudo ./install.sh
```

### 3. 重新啟動

```bash
sudo reboot
```

### 4. 啟動服務

```bash
# 啟用開機自啟
sudo systemctl enable wakeupmap-dsi

# 立即啟動服務
sudo systemctl start wakeupmap-dsi

# 查看服務狀態
sudo systemctl status wakeupmap-dsi
```

## 🎮 使用方法

### 基本操作
- **短按按鈕**：開始新的一天，尋找甦醒城市
- **長按按鈕**：顯示系統資訊（可自定義功能）

### 螢幕顯示
1. **待機畫面**：顯示"WakeUpMap"標題和當前時間
2. **載入畫面**：顯示"正在尋找甦醒城市..."和動畫
3. **結果畫面**：顯示城市名稱、國家、當地語言問候語
4. **錯誤畫面**：網路或API錯誤時的提示

### 特殊時間段
- **7:50-8:10**：特例時間段，直接顯示您當地的城市
- **其他時間**：根據分鐘數計算目標緯度，尋找對應地區城市

## ⚙️ 配置選項

主要配置檔案：`config.py`

### 硬體配置
```python
# GPIO按鈕配置
BUTTON_CONFIG = {
    'pin': 18,              # GPIO針腳
    'pull_up': True,        # 使用上拉電阻
    'bounce_time': 300,     # 防彈跳時間(ms)
    'long_press_time': 2.0  # 長按時間(秒)
}

# LED配置
LED_CONFIG = {
    'enabled': True,        # 啟用LED
    'pin': 16,             # GPIO針腳
    'blink_on_activity': True
}
```

### 顯示配置
```python
# 螢幕配置
SCREEN_CONFIG = {
    'width': 800,
    'height': 480,
    'fullscreen': True
}

# 字體配置
FONT_CONFIG = {
    'title_size': 48,       # 城市名稱
    'subtitle_size': 32,    # 國家名稱
    'greeting_size': 24,    # 問候語
    'font_family': 'Noto Sans CJK TC'
}
```

## 🛠️ 故障排除

### 查看日誌
```bash
# 查看服務日誌
sudo journalctl -u wakeupmap-dsi -f

# 查看最近的錯誤
sudo journalctl -u wakeupmap-dsi --since "1 hour ago"
```

### 常見問題

#### 1. 螢幕無顯示
```bash
# 檢查DSI配置
cat /boot/config.txt | grep -A 10 "WakeUpMap DSI"

# 重新啟動圖形服務
sudo systemctl restart display-manager
```

#### 2. 按鈕無反應
```bash
# 測試按鈕
cd /home/pi/wakeupmap-dsi
python3 button_handler.py

# 檢查GPIO權限
groups pi | grep gpio
```

#### 3. 網路連線問題
```bash
# 測試API連線
python3 api_client.py

# 檢查網路連線
ping -c 3 google.com
```

#### 4. 字體顯示問題
```bash
# 重新安裝字體
sudo apt install -y fonts-noto-cjk
sudo fc-cache -fv
```

## 🔊 音頻配置

### GF1002 喇叭連接
1. **連接方式**：使用 3.5mm 音頻線將 GF1002 喇叭連接到樹莓派的音頻插孔
2. **喇叭規格**：8Ω 阻抗，2W 功率
3. **音頻輸出**：樹莓派 3.5mm 耳機插孔

### 音頻系統配置
```bash
# 檢查音頻設備
aplay -l

# 設定音量 (0-100%)
amixer sset PCM,0 80%

# 測試音頻輸出
speaker-test -t wav -c 2 -l 1
```

### TTS (文字轉語音) 設定
支援多種 TTS 引擎：
- **espeak**：系統預設 TTS 引擎
- **pyttsx3**：Python TTS 庫

### 支援的語言
音頻問候支援以下語言：
- 中文（繁體/簡體）
- 英語、日語、韓語
- 西班牙語、法語、德語
- 義大利語、葡萄牙語、俄語
- 阿拉伯語、泰語、越南語、印地語

### 手動測試各模組
```bash
cd /home/pi/wakeupmap-dsi

# 測試按鈕處理
python3 button_handler.py

# 測試顯示管理
python3 display_manager.py

# 測試API客戶端
python3 api_client.py

# 測試主程式
python3 main.py

# 測試音頻系統
speaker-test -t wav -c 2

# 測試TTS引擎
espeak "Hello World"

# 測試音頻管理器
python3 -c "from audio_manager import get_audio_manager; get_audio_manager().test_audio()"
```

## 🔄 更新與維護

### 更新代碼
```bash
cd /home/pi/wakeupmap-dsi
git pull origin main

# 重新啟動服務
sudo systemctl restart wakeupmap-dsi
```

### 備份配置
```bash
# 備份配置檔案
cp config.py config.py.backup

# 備份完整目錄
tar -czf wakeupmap-backup-$(date +%Y%m%d).tar.gz /home/pi/wakeupmap-dsi
```

### 重新安裝
```bash
# 停止服務
sudo systemctl stop wakeupmap-dsi
sudo systemctl disable wakeupmap-dsi

# 重新運行安裝腳本
sudo ./install.sh
```

## 🌐 與網頁版同步

本DSI版本可以與網頁版WakeUpMap同步資料：

1. **共享API**：使用相同的後端API服務
2. **時間邏輯**：實現相同的7:50-8:10特例時間段
3. **城市匹配**：使用相同的城市匹配算法

### 同步配置
在 `config.py` 中設定API端點：
```python
API_ENDPOINTS = {
    'find_city': 'https://your-domain.vercel.app/api/find-city-geonames',
    'translate': 'https://your-domain.vercel.app/api/translate-location'
}
```

## 📋 系統需求

- **作業系統**：Raspberry Pi OS (Bullseye或更新版本)
- **Python**：3.7 或更新版本
- **記憶體**：建議 2GB 以上
- **儲存空間**：至少 1GB 可用空間
- **網路**：WiFi 或 乙太網路連線

## 🤝 貢獻與支援

### 貢獻代碼
1. Fork 本專案
2. 創建功能分支
3. 提交更改
4. 發送 Pull Request

### 回報問題
在 GitHub Issues 中回報問題，請包含：
- 硬體型號
- 錯誤日誌
- 重現步驟

### 技術支援
- 📧 Email: support@wakeupmap.com
- 💬 GitHub Issues: [提交問題](https://github.com/ytflute/subjective-clock/issues)

## 📄 授權

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 🎯 未來計劃

- [ ] 天氣資訊整合
- [x] 語音播報功能 *(已完成)*
- [ ] 音量控制按鈕
- [ ] 攝像頭整合
- [ ] 更多語言支援
- [ ] 音效主題選擇
- [ ] 自訂主題
- [ ] 無線充電支援

---

**WakeUpMap - 讓每一天都從世界的某個角落開始** 🌍✨ 