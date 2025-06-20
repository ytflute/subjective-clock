# 甦醒地圖實體裝置 (Raspberry Pi)

這是一個基於Raspberry Pi的實體裝置，可以連接到您的甦醒地圖Web應用程式，提供實體的互動體驗。

## 功能特色

- **LCD顯示器**：使用ST7920 LCD顯示匹配的城市和國家
- **按鈕控制**：按下按鈕觸發「開始這一天」功能
- **語音問候**：播放當地語言的「早安」問候語
- **即時連接**：與甦醒地圖Web API即時通信

## 硬體需求

### 必要組件
- Raspberry Pi 4 (推薦) 或 Raspberry Pi 3B+
- MicroSD卡 (32GB以上，Class 10)
- ST7920 128x64 LCD顯示器
- 按鈕開關
- 麵包板和杜邦線
- 電源供應器 (5V 3A)
- 喇叭或耳機 (用於音頻輸出)

### 可選組件
- 外殼 (保護Raspberry Pi)
- GPIO擴展板

## 接線圖

### LCD ST7920 連接
```
LCD Pin  -> Raspberry Pi GPIO
VCC      -> 5V (Pin 2)
GND      -> GND (Pin 6)
RS       -> GPIO 26 (Pin 37)
E        -> GPIO 19 (Pin 35)
D4       -> GPIO 13 (Pin 33)
D5       -> GPIO 6 (Pin 31)
D6       -> GPIO 5 (Pin 29)
D7       -> GPIO 11 (Pin 23)
PSB      -> GPIO 21 (Pin 40) - 設為HIGH使用並行模式
RST      -> GPIO 20 (Pin 38)
```

### 按鈕連接
```
按鈕一端 -> GPIO 18 (Pin 12)
按鈕另一端 -> GND (Pin 14)
```

### 音頻輸出
- 使用3.5mm音頻輸出接口連接喇叭或耳機
- 或通過HDMI輸出音頻

## 軟體安裝

### 1. 系統準備
```bash
# 更新系統
sudo apt update && sudo apt upgrade -y

# 安裝必要套件
sudo apt install python3-pip python3-venv git -y

# 啟用SPI (如果需要)
sudo raspi-config
# 選擇 Interfacing Options -> SPI -> Enable
```

### 2. 安裝專案
```bash
# 複製專案
git clone https://github.com/your-username/subjective-clock02.git
cd subjective-clock02/raspberrypi

# 建立虛擬環境
python3 -m venv venv
source venv/bin/activate

# 安裝依賴
pip install -r requirements.txt
```

### 3. 設定環境變數
```bash
# 複製環境變數範例
cp .env.example .env

# 編輯環境變數
nano .env
```

設定您的甦醒地圖URL：
```
BASE_URL=https://your-subjective-clock-url.vercel.app
DEBUG_MODE=false
AUDIO_OUTPUT=analog
```

## 使用方法

### 手動啟動
```bash
cd raspberrypi
source venv/bin/activate
python3 main.py
```

### 設定自動啟動
建立systemd服務：

```bash
sudo nano /etc/systemd/system/subjective-clock.service
```

內容：
```ini
[Unit]
Description=Subjective Clock Device
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/subjective-clock02/raspberrypi
Environment=PATH=/home/pi/subjective-clock02/raspberrypi/venv/bin
ExecStart=/home/pi/subjective-clock02/raspberrypi/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

啟用服務：
```bash
sudo systemctl enable subjective-clock.service
sudo systemctl start subjective-clock.service
```

## 操作說明

1. **開機**：裝置開機後會顯示「Ready!」訊息
2. **按鈕**：按下按鈕觸發「開始這一天」功能
3. **顯示**：LCD會顯示匹配的城市和國家名稱
4. **語音**：裝置會播放當地語言的「早安」問候語
5. **自動**：10秒後自動返回就緒狀態

## 故障排除

### 常見問題

**LCD沒有顯示**
- 檢查電源連接
- 確認接線正確
- 檢查對比度設定

**音頻沒有聲音**
- 確認音量設定：`alsamixer`
- 檢查音頻輸出設定：`sudo raspi-config`
- 確認喇叭連接

**網路連接問題**
- 檢查網路連接：`ping google.com`
- 確認API URL設定正確
- 檢查防火牆設定

**按鈕沒有反應**
- 檢查按鈕接線
- 確認GPIO設定
- 檢查按鈕是否正常工作

### 調試模式
設定環境變數 `DEBUG_MODE=true` 可以看到詳細的調試訊息：

```bash
# 編輯環境變數
nano .env

# 設定DEBUG_MODE=true
DEBUG_MODE=true

# 重新啟動
python3 main.py
```

## 自訂設定

### 修改GPIO接腳
編輯 `config.py` 檔案中的 `LCD_PINS` 和 `BUTTON_PIN` 設定。

### 修改顯示時間
編輯 `config.py` 檔案中的 `DISPLAY_DURATION` 設定。

### 新增語言支援
在 `audio_manager.py` 的 `get_greeting_by_country()` 函數中新增更多國家和語言。

## 技術架構

- **主控程式**：`main.py` - 整合所有功能
- **LCD驅動**：`lcd_driver.py` - ST7920 LCD控制
- **音頻管理**：`audio_manager.py` - 文字轉語音和播放
- **API客戶端**：`api_client.py` - 與Web API通信
- **設定檔**：`config.py` - 硬體和軟體設定

## 授權

本專案採用ISC授權條款。

## 支援

如果您遇到任何問題，請提交Issue或聯繫開發者。 