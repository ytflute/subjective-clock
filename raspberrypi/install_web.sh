#!/bin/bash

# 甦醒地圖實體裝置安裝腳本 (網頁模式)
# 適用於 Raspberry Pi OS

set -e

echo "=== 甦醒地圖實體裝置安裝腳本 (網頁模式) ==="
echo "正在安裝必要的系統套件..."

# 更新系統
sudo apt update
sudo apt upgrade -y

# 安裝必要套件
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-rpi.gpio \
    git \
    alsa-utils \
    sox \
    ffmpeg \
    portaudio19-dev \
    i2c-tools \
    build-essential \
    wget \
    unzip \
    curl

echo "正在安裝 Chrome 瀏覽器..."

# 安裝 Chrome 瀏覽器
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=arm64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# 更新套件列表並安裝 Chrome
sudo apt update
sudo apt install -y google-chrome-stable

echo "正在安裝 ChromeDriver..."

# 安裝 ChromeDriver
CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d'.' -f1-3)
echo "Chrome 版本: $CHROME_VERSION"

# 下載對應版本的 ChromeDriver
CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_$CHROME_VERSION")
echo "ChromeDriver 版本: $CHROMEDRIVER_VERSION"

# 判斷處理器架構
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
    CHROMEDRIVER_ARCH="linux_arm64"
elif [ "$ARCH" = "armv7l" ]; then
    echo "警告：ARM32 可能不支援新版 ChromeDriver，嘗試使用 ARM64 版本"
    CHROMEDRIVER_ARCH="linux_arm64"
else
    CHROMEDRIVER_ARCH="linux64"
fi

# 下載並安裝 ChromeDriver
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_$CHROMEDRIVER_ARCH.zip"
sudo unzip -j /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
rm /tmp/chromedriver.zip

echo "正在建立虛擬環境..."

# 建立虛擬環境
python3 -m venv venv

# 啟用虛擬環境
source venv/bin/activate

echo "正在安裝Python依賴..."

# 安裝Python套件
pip install --upgrade pip
pip install -r requirements.txt

echo "正在設定環境變數..."

# 複製環境變數範例
if [ ! -f .env ]; then
    cp .env.example .env
    echo "已建立 .env 檔案，請編輯其中的設定值"
fi

echo "正在設定系統服務..."

# 建立systemd服務檔案（網頁模式）
sudo tee /etc/systemd/system/subjective-clock-web.service > /dev/null <<EOF
[Unit]
Description=Subjective Clock Device (Web Mode)
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
ExecStart=$(pwd)/venv/bin/python main_web.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 重新載入systemd
sudo systemctl daemon-reload

echo "正在設定GPIO和硬體介面..."

# 啟用GPIO (通常預設已啟用，但確保啟用)
echo "確保GPIO介面已啟用..."

# 檢查並設定GPIO權限
sudo usermod -a -G gpio pi 2>/dev/null || echo "GPIO群組已存在"

# 確保使用者有GPIO權限
echo 'SUBSYSTEM=="gpio", GROUP="gpio", MODE="0664"' | sudo tee /etc/udev/rules.d/99-gpio.rules > /dev/null
echo 'SUBSYSTEM=="gpio*", PROGRAM="/bin/sh -c '\''chown -R root:gpio /sys/class/gpio && chmod -R 775 /sys/class/gpio; chown -R root:gpio /sys/devices/virtual/gpio && chmod -R 775 /sys/devices/virtual/gpio || true'\''"' | sudo tee -a /etc/udev/rules.d/99-gpio.rules > /dev/null

echo "正在設定音頻..."

# 設定音頻輸出為3.5mm
sudo amixer cset numid=3 1

echo "正在設定X11顯示..."

# 確保X11可以使用
if [ -z "$DISPLAY" ]; then
    echo "export DISPLAY=:0" >> ~/.bashrc
fi

# 設定瀏覽器權限
sudo usermod -a -G audio,video pi

echo "安裝完成！"
echo ""
echo "接下來的步驟："
echo "1. 編輯 .env 檔案，設定您的甦醒地圖URL"
echo "2. 確認硬體連接正確"
echo "3. 啟動X11桌面環境 (如果使用SSH，需要X11轉發)"
echo "4. 執行測試：source venv/bin/activate && python3 main_web.py"
echo "5. 如果測試正常，啟用自動啟動："
echo "   sudo systemctl enable subjective-clock-web.service"
echo "   sudo systemctl start subjective-clock-web.service"
echo ""
echo "注意事項："
echo "- 網頁模式需要圖形界面支援"
echo "- 如果使用SSH，需要啟用X11轉發：ssh -X pi@your_pi_ip"
echo "- 或者直接在樹莓派上連接螢幕、鍵盤、滑鼠使用"
echo ""
echo "使用 'sudo systemctl status subjective-clock-web.service' 查看服務狀態"
echo "使用 'sudo journalctl -u subjective-clock-web.service -f' 查看即時日誌" 