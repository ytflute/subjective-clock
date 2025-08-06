#!/bin/bash
# 🔧 修復 Raspberry Pi 依賴套件問題

echo "🔧 正在修復甦醒地圖依賴套件問題..."
echo "================================"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定變數
PROJECT_DIR="/home/future/pi/subjective-clock"
RASPBERRYPI_DSI_DIR="$PROJECT_DIR/raspberrypi-dsi"

echo -e "${BLUE}📁 項目目錄: $PROJECT_DIR${NC}"
echo -e "${BLUE}📁 工作目錄: $RASPBERRYPI_DSI_DIR${NC}"
echo ""

# 檢查目錄是否存在
if [ ! -d "$RASPBERRYPI_DSI_DIR" ]; then
    echo -e "${RED}❌ 錯誤: 找不到 raspberrypi-dsi 目錄${NC}"
    exit 1
fi

cd "$RASPBERRYPI_DSI_DIR"

echo -e "${YELLOW}🔍 檢查 Python 版本...${NC}"
python3 --version
echo ""

echo -e "${YELLOW}🔍 檢查現有 requirements 文件...${NC}"
if [ -f "requirements.txt" ]; then
    echo "✅ 找到 requirements.txt"
    echo "內容預覽:"
    head -10 requirements.txt
else
    echo "⚠️ 沒有找到 requirements.txt"
fi
echo ""

echo -e "${YELLOW}🔍 檢查 pip 可用性...${NC}"
if command -v pip3 &> /dev/null; then
    echo "✅ pip3 可用"
    pip3 --version
elif command -v pip &> /dev/null; then
    echo "✅ pip 可用"
    pip --version
else
    echo -e "${RED}❌ 錯誤: pip 不可用，正在安裝...${NC}"
    sudo apt update
    sudo apt install -y python3-pip
fi
echo ""

echo -e "${YELLOW}📦 檢查缺失的套件...${NC}"

# 檢查關鍵套件
missing_packages=()

echo "檢查 aiohttp..."
if ! python3 -c "import aiohttp" 2>/dev/null; then
    echo "❌ aiohttp 缺失"
    missing_packages+=("aiohttp")
else
    echo "✅ aiohttp 已安裝"
fi

echo "檢查 requests..."
if ! python3 -c "import requests" 2>/dev/null; then
    echo "❌ requests 缺失"
    missing_packages+=("requests")
else
    echo "✅ requests 已安裝"
fi

echo "檢查 asyncio..."
if ! python3 -c "import asyncio" 2>/dev/null; then
    echo "❌ asyncio 缺失"
    missing_packages+=("asyncio")
else
    echo "✅ asyncio 已安裝"
fi

echo "檢查 selenium..."
if ! python3 -c "import selenium" 2>/dev/null; then
    echo "❌ selenium 缺失"
    missing_packages+=("selenium")
else
    echo "✅ selenium 已安裝"
fi

echo "檢查 webview..."
if ! python3 -c "import webview" 2>/dev/null; then
    echo "❌ webview 缺失"
    missing_packages+=("pywebview")
else
    echo "✅ webview 已安裝"
fi

echo "檢查 pigpio..."
if ! python3 -c "import pigpio" 2>/dev/null; then
    echo "❌ pigpio 缺失"
    missing_packages+=("pigpio")
else
    echo "✅ pigpio 已安裝"
fi

echo ""

if [ ${#missing_packages[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 所有必要套件都已安裝！${NC}"
else
    echo -e "${YELLOW}📦 需要安裝 ${#missing_packages[@]} 個套件: ${missing_packages[*]}${NC}"
    echo ""
    
    echo -e "${BLUE}正在安裝缺失的套件...${NC}"
    
    # 先更新 pip
    echo "🔄 更新 pip..."
    python3 -m pip install --upgrade pip
    
    # 逐個安裝套件
    for package in "${missing_packages[@]}"; do
        echo -e "${YELLOW}📦 安裝 $package...${NC}"
        
        if [ "$package" = "pywebview" ]; then
            # pywebview 需要額外的系統依賴
            echo "安裝 pywebview 系統依賴..."
            sudo apt update
            sudo apt install -y python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.0
            pip3 install pywebview[gtk]
        elif [ "$package" = "pigpio" ]; then
            # pigpio 需要系統服務
            echo "安裝 pigpio..."
            sudo apt update
            sudo apt install -y pigpio python3-pigpio
            sudo systemctl enable pigpiod
            sudo systemctl start pigpiod
        else
            pip3 install "$package"
        fi
        
        # 檢查安裝是否成功
        if python3 -c "import ${package/pywebview/webview}" 2>/dev/null; then
            echo -e "${GREEN}✅ $package 安裝成功${NC}"
        else
            echo -e "${RED}❌ $package 安裝失敗${NC}"
        fi
        echo ""
    done
fi

echo ""
echo -e "${BLUE}🧪 測試模組化主控制程式...${NC}"

# 測試導入
echo "測試 Python 模組導入..."
if python3 -c "
try:
    import sys
    sys.path.append('.')
    from modules.api_client import APIClient
    from modules.audio_manager import AudioManager
    from modules.display_manager import DisplayManager
    from modules.button_handler import ButtonHandler
    from modules.firebase_sync import FirebaseSync
    from modules.config_manager import ConfigManager
    print('✅ 所有模組導入成功')
except ImportError as e:
    print(f'❌ 模組導入失敗: {e}')
    exit(1)
"; then
    echo -e "${GREEN}🎉 模組化主控制程式已就緒！${NC}"
else
    echo -e "${RED}❌ 仍有模組導入問題${NC}"
    echo ""
    echo -e "${YELLOW}🔄 嘗試使用傳統版本...${NC}"
    
    if [ -f "main_web_dsi.py" ]; then
        echo "✅ 找到傳統版本 main_web_dsi.py"
        echo ""
        echo -e "${BLUE}修改啟動腳本使用傳統版本...${NC}"
        
        # 修改啟動腳本優先使用傳統版本
        if [ -f "start-wakeup-map.sh" ]; then
            sed -i 's/main_controller.py/main_web_dsi.py/g' start-wakeup-map.sh
            echo "✅ 啟動腳本已更新為使用傳統版本"
        fi
    else
        echo -e "${RED}❌ 也找不到傳統版本 main_web_dsi.py${NC}"
    fi
fi

echo ""
echo -e "${BLUE}📋 安裝完成總結${NC}"
echo "==================="

if [ ${#missing_packages[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 所有依賴套件都已安裝${NC}"
    echo -e "${GREEN}✅ 模組化版本可以使用${NC}"
    echo -e "${YELLOW}📝 建議: 現在可以雙擊桌面 '甦醒地圖' 圖標測試${NC}"
else
    installed_count=0
    for package in "${missing_packages[@]}"; do
        if python3 -c "import ${package/pywebview/webview}" 2>/dev/null; then
            ((installed_count++))
        fi
    done
    
    echo -e "${YELLOW}📊 安裝進度: $installed_count/${#missing_packages[@]} 個套件${NC}"
    
    if [ $installed_count -eq ${#missing_packages[@]} ]; then
        echo -e "${GREEN}✅ 所有套件安裝完成${NC}"
        echo -e "${YELLOW}📝 建議: 現在可以測試啟動甦醒地圖${NC}"
    else
        echo -e "${YELLOW}⚠️ 部分套件可能需要手動處理${NC}"
        echo -e "${YELLOW}📝 建議: 如果問題持續，可以使用傳統版本${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🚀 測試指令:${NC}"
echo "雙擊桌面圖標: 甦醒地圖"
echo "或手動執行: ~/pi/subjective-clock/raspberrypi-dsi/start-wakeup-map.sh"
echo ""
echo -e "${BLUE}🔧 如果仍有問題:${NC}"
echo "查看日誌: cat ~/pi/subjective-clock/wakeup-map.log"
echo "檢查依賴: python3 -c 'import aiohttp; print(\"aiohttp OK\")'"
echo ""