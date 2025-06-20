#!/bin/bash

# 甦醒地圖實體裝置安裝腳本
# 適用於 Raspberry Pi OS

set -e

echo "=== 甦醒地圖實體裝置安裝腳本 ==="
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
    git \
    alsa-utils \
    sox \
    ffmpeg \
    portaudio19-dev

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

# 建立systemd服務檔案
sudo tee /etc/systemd/system/subjective-clock.service > /dev/null <<EOF
[Unit]
Description=Subjective Clock Device
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 重新載入systemd
sudo systemctl daemon-reload

echo "正在設定音頻..."

# 設定音頻輸出為3.5mm
sudo amixer cset numid=3 1

echo "安裝完成！"
echo ""
echo "接下來的步驟："
echo "1. 編輯 .env 檔案，設定您的甦醒地圖URL"
echo "2. 確認硬體連接正確"
echo "3. 執行測試：source venv/bin/activate && python3 main.py"
echo "4. 如果測試正常，啟用自動啟動："
echo "   sudo systemctl enable subjective-clock.service"
echo "   sudo systemctl start subjective-clock.service"
echo ""
echo "使用 'sudo systemctl status subjective-clock.service' 查看服務狀態"
echo "使用 'sudo journalctl -u subjective-clock.service -f' 查看即時日誌" 