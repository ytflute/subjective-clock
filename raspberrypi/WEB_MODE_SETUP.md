# 甦醒地圖樹莓派網頁模式設定指南

## 🌐 網頁模式概述

網頁模式讓樹莓派直接控制甦醒地圖網站，確保與網頁版邏輯完全一致，解決同步和邏輯差異問題。

### 優勢對比

| 特點 | 原始API模式 | 網頁模式 |
|------|-------------|----------|
| 邏輯一致性 | ❌ 需要維護兩套 | ✅ 完全一致 |
| 功能同步 | ❌ 手動同步 | ✅ 自動同步 |
| 記錄同步 | ❌ 容易失敗 | ✅ 直接記錄 |
| 維護成本 | ❌ 高 | ✅ 低 |
| 用戶體驗 | ❌ 可能不同 | ✅ 完全相同 |

## 🛠 安裝步驟

### 1. 系統需求
- Raspberry Pi 4 (推薦) 或 Pi 3B+
- Raspberry Pi OS with Desktop
- 至少 2GB RAM 
- 網路連接
- 螢幕連接（HDMI 或 DSI）

### 2. 自動安裝
```bash
cd raspberrypi
./install_web.sh
```

### 3. 手動安裝（如果自動安裝失敗）

#### 安裝Chrome瀏覽器
```bash
# 添加 Google 套件源
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=arm64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# 安裝 Chrome
sudo apt update
sudo apt install -y google-chrome-stable
```

#### 安裝ChromeDriver
```bash
# 檢查Chrome版本
google-chrome --version

# 下載對應的ChromeDriver（請替換為實際版本）
CHROMEDRIVER_VERSION="119.0.6045.105"
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_linux_arm64.zip"
sudo unzip -j /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
```

#### 安裝Python依賴
```bash
pip install selenium==4.15.0
```

## 🚀 使用方法

### 測試模式
```bash
# 進入虛擬環境
source venv/bin/activate

# 執行測試
python3 main_web.py
```

### 自動啟動模式
```bash
# 啟用服務
sudo systemctl enable subjective-clock-web.service
sudo systemctl start subjective-clock-web.service

# 查看狀態
sudo systemctl status subjective-clock-web.service

# 查看日誌
sudo journalctl -u subjective-clock-web.service -f
```

## 📋 操作流程

### 使用者體驗
1. **按鈕按下** → LCD顯示"Loading website"
2. **網站載入** → 自動填入使用者名稱 "future"
3. **觸發甦醒** → 點擊網站的「開始這一天」按鈕
4. **查看結果** → 瀏覽器全螢幕顯示甦醒結果
5. **LCD提示** → 顯示"Wake Up Triggered! Check browser"

### 技術流程
```
按鈕 GPIO → main_web.py → WebController → 
Selenium → Chrome → 甦醒地圖網站 → 自動點擊 → 
完整網頁體驗（地圖、語音、故事、圖片）
```

## 🖥 顯示設定

### 螢幕配置
- **HDMI螢幕**：Chrome自動全螢幕顯示
- **DSI螢幕**：可能需要調整解析度
- **LCD12864**：顯示狀態資訊

### 解析度調整
編輯 `/boot/config.txt`：
```bash
# 強制HDMI輸出
hdmi_force_hotplug=1
hdmi_group=2
hdmi_mode=82  # 1920x1080 60Hz
```

## 🔧 故障排除

### Chrome無法啟動
```bash
# 檢查Chrome安裝
google-chrome --version

# 檢查ChromeDriver
chromedriver --version

# 測試Chrome（無頭模式）
google-chrome --headless --no-sandbox --dump-dom https://google.com
```

### X11顯示問題
```bash
# 檢查DISPLAY環境變數
echo $DISPLAY

# 設定顯示
export DISPLAY=:0

# 測試X11
xclock &
```

### Selenium錯誤
```bash
# 檢查依賴
pip list | grep selenium

# 重新安裝
pip uninstall selenium
pip install selenium==4.15.0
```

### 權限問題
```bash
# 檢查用戶群組
groups pi

# 添加必要群組
sudo usermod -a -G audio,video,gpio pi
```

## ⚙️ 設定檔案

### config.py 設定
```python
USER_CONFIG = {
    'display_name': 'future',
    'identifier': 'future', 
    'device_type': 'raspberry_pi_web'
}
```

### Chrome選項自訂
編輯 `web_controller.py`：
```python
chrome_options.add_argument('--window-size=1920,1080')
chrome_options.add_argument('--disable-notifications')
chrome_options.add_argument('--mute-audio')  # 靜音瀏覽器
```

## 🔄 模式切換

### 切換到網頁模式
```bash
# 停用原始服務
sudo systemctl stop subjective-clock.service
sudo systemctl disable subjective-clock.service

# 啟用網頁模式
sudo systemctl enable subjective-clock-web.service
sudo systemctl start subjective-clock-web.service
```

### 切換回API模式
```bash
# 停用網頁模式
sudo systemctl stop subjective-clock-web.service
sudo systemctl disable subjective-clock-web.service

# 啟用原始模式
sudo systemctl enable subjective-clock.service
sudo systemctl start subjective-clock.service
```

## 🎯 最佳實務

### 效能優化
- 使用高速 SD 卡（Class 10 或更好）
- 確保充足的電源供應（5V 3A）
- 定期清理瀏覽器快取

### 網路優化
- 使用有線網路（更穩定）
- 設定固定IP地址
- 確保DNS正常解析

### 安全設定
- 定期更新系統和瀏覽器
- 設定防火牆規則
- 使用強密碼

## 📝 日誌監控

### 查看服務日誌
```bash
# 即時日誌
sudo journalctl -u subjective-clock-web.service -f

# 近期日誌
sudo journalctl -u subjective-clock-web.service --since "1 hour ago"

# 錯誤日誌
sudo journalctl -u subjective-clock-web.service -p err
```

### Chrome日誌
```bash
# Chrome在前台執行時可看到詳細日誌
google-chrome --enable-logging --v=1
```

## 🚧 已知限制

### 硬體限制
- Pi 3B+ 可能在開啟大型網頁時較慢
- 需要圖形界面，純命令行模式無法使用
- 記憶體使用量較高（~500MB+）

### 軟體限制
- 依賴X11顯示系統
- Chrome更新可能影響相容性
- 網路斷線會影響功能

## 🔮 未來改進

### 計劃功能
- 支援無頭模式（不需要螢幕）
- 自動重啟機制
- 遠端監控界面
- 多使用者支援

---

**網頁模式讓你的樹莓派成為完美的甦醒地圖實體控制器！** 🎯 