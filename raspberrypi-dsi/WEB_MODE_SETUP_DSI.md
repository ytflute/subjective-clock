# 甦醒地圖 DSI版本 - 網頁模式設定指南

🌐 **網頁模式**：透過 DSI 螢幕 + 按鈕控制瀏覽器自動開啟甦醒地圖網站，享受完整的網頁體驗！

## 🎯 網頁模式特色

### ✨ 最佳解決方案特點
- **✅ 邏輯完全一致**：與網頁版使用相同的邏輯，無需維護兩套代碼
- **✅ 自動同步**：直接記錄到資料庫，無需額外同步機制
- **✅ 零維護成本**：單一代碼庫，網頁更新自動同步到硬體版本
- **✅ 功能同步**：所有網頁新功能立即可用
- **✅ 使用者一致性**：保持 "future" 身份，記錄連續性完整

### 🔗 雙重體驗整合
- **DSI 螢幕**：顯示操作狀態、載入進度、成功提示
- **網頁瀏覽器**：完整的甦醒地圖體驗（地圖、音頻、故事、圖片）
- **按鈕控制**：硬體按鈕觸發網頁自動化
- **音頻播放**：支援網頁音頻和系統提示音

## 🛠️ 硬體需求

### 必要硬體
- **Raspberry Pi 4B** (推薦4GB以上)
- **DSI 800x480 螢幕** (觸控螢幕)
- **按鈕開關** x 1
- **限流電阻** (330Ω，用於LED)
- **LED指示燈** x 1 (可選)
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
│   DSI   ●───────┼─── DSI螢幕 (800x480)
│                 │
└─────────────────┘
```

## 🚀 快速安裝

### 1. 下載程式碼
```bash
# 方法1：從GitHub下載
cd /home/pi
git clone https://github.com/ytflute/subjective-clock.git
cd subjective-clock/raspberrypi-dsi

# 方法2：更新現有代碼
cd /path/to/subjective-clock/raspberrypi-dsi
git pull origin main
```

### 2. 執行網頁模式安裝
```bash
# 給安裝腳本執行權限
chmod +x install_web_dsi.sh

# 執行安裝（需要sudo權限）
./install_web_dsi.sh
```

### 3. 重新啟動系統
```bash
sudo reboot
```

### 4. 手動測試
```bash
cd /path/to/subjective-clock/raspberrypi-dsi
source venv/bin/activate
python3 main_web_dsi.py
```

### 5. 啟用自動啟動
```bash
sudo systemctl enable wakeupmap-dsi-web
sudo systemctl start wakeupmap-dsi-web
```

## 🎮 使用方法

### 操作方式
- **短按按鈕**：啟動甦醒地圖網頁版
- **長按按鈕**：顯示系統資訊並關閉瀏覽器

### 操作流程
1. **按下按鈕** → DSI螢幕顯示「正在啟動瀏覽器...」
2. **自動開啟網站** → DSI螢幕顯示「正在載入甦醒地圖...」
3. **自動填入使用者** → DSI螢幕顯示「正在設定使用者：future」
4. **自動點擊開始** → DSI螢幕顯示「甦醒地圖已在瀏覽器中開啟」
5. **享受完整體驗** → 在瀏覽器中體驗地圖、音頻、故事等功能

### DSI螢幕顯示狀態
- **待機畫面**：WakeUpMap 標題 + 當前時間
- **載入畫面**：顯示當前操作進度和動畫
- **成功畫面**：顯示「甦醒地圖已在瀏覽器中開啟」
- **錯誤畫面**：顯示錯誤訊息和重試提示

## ⚙️ 配置選項

### 環境變數 (.env)
```bash
# 甦醒地圖 DSI版本網頁模式配置
WEBSITE_URL=https://subjective-clock.vercel.app/
USER_NAME=future
BROWSER_COMMAND=chromium-browser
```

### 主要配置 (config.py)
```python
# 使用者設定
USER_CONFIG = {
    'display_name': 'future',
    'identifier': 'future',
    'device_type': 'raspberry_pi_dsi'
}

# 按鈕配置
BUTTON_CONFIG = {
    'pin': 18,              # GPIO針腳
    'pull_up': True,        # 使用上拉電阻
    'bounce_time': 300,     # 防彈跳時間(ms)
    'long_press_time': 2.0  # 長按時間(秒)
}

# DSI螢幕配置
SCREEN_CONFIG = {
    'width': 800,
    'height': 480,
    'fullscreen': True
}
```

## 🔧 自動化流程詳解

### Selenium 自動化步驟
1. **啟動 Chromium 瀏覽器**
   - 無邊框全螢幕模式 (800x480)
   - 優化ARM架構性能
   - 自動播放音頻支援

2. **開啟甦醒地圖網站**
   - 載入 https://subjective-clock.vercel.app/
   - 等待頁面完全載入

3. **自動填入使用者資料**
   - 尋找使用者名稱輸入框 (#userName)
   - 清除並輸入 "future"

4. **觸發甦醒流程**
   - 尋找開始按鈕 (#startButton)
   - 自動點擊開始甦醒地圖

5. **保持瀏覽器運行**
   - 監控瀏覽器狀態
   - 提供完整網頁體驗

## 🛠️ 故障排除

### 常見問題與解決方案

#### 1. 瀏覽器無法啟動
```bash
# 檢查 Chromium 安裝
chromium-browser --version

# 檢查 ChromeDriver
chromedriver --version

# 檢查顯示環境
echo $DISPLAY

# 手動測試瀏覽器
DISPLAY=:0 chromium-browser --kiosk https://google.com
```

#### 2. DSI螢幕無顯示
```bash
# 檢查DSI配置
cat /boot/config.txt | grep -A 5 "WakeUpMap DSI"

# 重新啟動顯示服務
sudo systemctl restart display-manager

# 檢查桌面環境
ps aux | grep -i desktop
```

#### 3. 按鈕無反應
```bash
# 測試GPIO
python3 -c "
import RPi.GPIO as GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup(18, GPIO.IN, pull_up_down=GPIO.PUD_UP)
print('按鈕狀態:', GPIO.input(18))
GPIO.cleanup()
"

# 檢查權限
groups $USER | grep gpio
```

#### 4. 網頁載入失敗
```bash
# 檢查網路連線
ping -c 3 subjective-clock.vercel.app

# 檢查DNS
nslookup subjective-clock.vercel.app

# 手動測試API
curl -I https://subjective-clock.vercel.app/
```

### 日誌查看
```bash
# 查看服務狀態
sudo systemctl status wakeupmap-dsi-web

# 查看即時日誌
sudo journalctl -u wakeupmap-dsi-web -f

# 查看錯誤日誌
sudo journalctl -u wakeupmap-dsi-web --since "1 hour ago" | grep ERROR

# 查看 Selenium 日誌
tail -f /tmp/chromedriver-dsi.log
```

## 🔄 維護與更新

### 更新程式碼
```bash
cd /path/to/subjective-clock/raspberrypi-dsi
git pull origin main

# 重新啟動服務
sudo systemctl restart wakeupmap-dsi-web
```

### 重新安裝
```bash
# 停止服務
sudo systemctl stop wakeupmap-dsi-web
sudo systemctl disable wakeupmap-dsi-web

# 重新執行安裝
./install_web_dsi.sh
```

### 切換模式
```bash
# 切換到原生API模式
sudo systemctl stop wakeupmap-dsi-web
sudo systemctl start wakeupmap-dsi

# 切換到網頁模式
sudo systemctl stop wakeupmap-dsi
sudo systemctl start wakeupmap-dsi-web
```

## 🎯 進階配置

### 自訂瀏覽器選項
編輯 `web_controller_dsi.py` 中的 `_setup_chrome_options()` 方法：

```python
def _setup_chrome_options(self):
    options = Options()
    
    # 自訂選項
    options.add_argument('--window-size=800,480')
    options.add_argument('--start-maximized')
    options.add_argument('--kiosk')
    options.add_argument('--autoplay-policy=no-user-gesture-required')
    
    # 效能優化
    options.add_argument('--disable-images')  # 關閉圖片加載
    options.add_argument('--disable-javascript')  # 關閉JS（可能影響功能）
    
    return options
```

### 自訂顯示訊息
編輯 `config.py` 中的 `MORNING_GREETINGS` 或 `ERROR_MESSAGES`：

```python
MORNING_GREETINGS = {
    'web': '甦醒地圖已在瀏覽器中開啟！',
    # ... 其他語言
}

ERROR_MESSAGES = {
    'browser_error': '瀏覽器啟動失敗，請檢查設定',
    'network_error': '網路連線錯誤，請檢查網路',
    # ... 其他錯誤
}
```

## 📊 效能最佳化

### 系統資源優化
```bash
# 增加GPU記憶體分配（適用於圖形密集應用）
echo "gpu_mem=128" | sudo tee -a /boot/config.txt

# 關閉不必要的服務
sudo systemctl disable bluetooth
sudo systemctl disable cups

# 設定swappiness
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

### 瀏覽器效能調整
```bash
# 創建 Chromium 效能配置
mkdir -p ~/.config/chromium/Default
cat > ~/.config/chromium/Default/Preferences << 'EOF'
{
   "profile": {
      "default_content_setting_values": {
         "images": 2,
         "javascript": 1,
         "plugins": 2,
         "media_stream": 2
      }
   }
}
EOF
```

## 🎉 功能展示

### 網頁模式 vs 原生模式比較

| 特色 | 網頁模式 | 原生API模式 |
|------|----------|------------|
| **邏輯一致性** | ✅ 100%一致 | ❌ 需要同步維護 |
| **功能完整性** | ✅ 所有網頁功能 | ⚠️ 部分功能 |
| **維護成本** | ✅ 零維護 | ❌ 雙重維護 |
| **更新同步** | ✅ 自動同步 | ❌ 手動更新 |
| **使用者體驗** | ✅ 完整體驗 | ⚠️ 基本體驗 |
| **資源使用** | ⚠️ 較高 | ✅ 較低 |
| **啟動速度** | ⚠️ 較慢 | ✅ 較快 |

### 推薦使用場景
- **✅ 推薦網頁模式**：希望獲得完整甦醒地圖體驗
- **✅ 推薦原生模式**：資源受限或需要快速啟動
- **✅ 混合使用**：根據需求動態切換

## 📞 支援與回饋

### 技術支援
- 📧 Email: support@wakeupmap.com
- 💬 GitHub Issues: [提交問題](https://github.com/ytflute/subjective-clock/issues)
- 📖 文檔: [查看完整文檔](../README.md)

### 回報問題
請提供以下資訊：
- 硬體型號和配置
- 錯誤日誌 (`journalctl` 輸出)
- 重現步驟
- 期望行為

---

**🌅 享受您的甦醒地圖網頁模式體驗！** 