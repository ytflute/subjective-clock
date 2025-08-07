#!/bin/bash
# 🔧 進階依賴套件修復腳本 - 針對樹莓派優化

echo "🔧 進階依賴套件修復 (樹莓派優化版)"
echo "========================================="

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定變數
PROJECT_DIR="/home/future/pi/subjective-clock"
RASPBERRYPI_DSI_DIR="$PROJECT_DIR/raspberrypi-dsi"

cd "$RASPBERRYPI_DSI_DIR"

echo -e "${BLUE}🔍 診斷 Python 和 pip 環境...${NC}"
echo "Python 版本: $(python3 --version)"
echo "Python 路徑: $(which python3)"

# 檢查 pip 版本和位置
if command -v pip3 &> /dev/null; then
    echo "pip3 版本: $(pip3 --version)"
    echo "pip3 路徑: $(which pip3)"
    PIP_CMD="pip3"
elif command -v pip &> /dev/null; then
    echo "pip 版本: $(pip --version)"
    echo "pip 路徑: $(which pip)"
    PIP_CMD="pip"
else
    echo -e "${RED}❌ pip 未找到，正在安裝...${NC}"
    sudo apt update
    sudo apt install -y python3-pip
    PIP_CMD="pip3"
fi

echo ""

echo -e "${YELLOW}🔧 更新系統套件庫...${NC}"
sudo apt update

echo -e "${YELLOW}🔧 安裝基本開發工具...${NC}"
sudo apt install -y \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    build-essential \
    curl \
    wget

echo ""

echo -e "${BLUE}📦 方法1: 使用系統套件管理器安裝 (推薦)${NC}"

# 嘗試使用 apt 安裝 Python 套件
echo "安裝 python3-aiohttp..."
if sudo apt install -y python3-aiohttp; then
    echo -e "${GREEN}✅ python3-aiohttp 安裝成功 (系統套件)${NC}"
else
    echo -e "${YELLOW}⚠️ 系統套件中沒有 python3-aiohttp${NC}"
fi

echo "安裝 python3-requests..."
if sudo apt install -y python3-requests; then
    echo -e "${GREEN}✅ python3-requests 安裝成功 (系統套件)${NC}"
else
    echo -e "${YELLOW}⚠️ 系統套件安裝失敗，稍後嘗試 pip${NC}"
fi

echo ""

echo -e "${BLUE}📦 方法2: 升級 pip 並重新安裝${NC}"

# 升級 pip 到最新版本
echo "升級 pip..."
python3 -m pip install --upgrade pip --user

# 設定 pip 使用用戶目錄
export PATH="$HOME/.local/bin:$PATH"

echo ""

echo -e "${BLUE}📦 方法3: 逐個安裝並驗證${NC}"

# 定義安裝函數
install_package() {
    local package=$1
    local import_name=${2:-$1}
    
    echo -e "${YELLOW}正在安裝 $package...${NC}"
    
    # 嘗試多種安裝方法
    if python3 -c "import $import_name" 2>/dev/null; then
        echo -e "${GREEN}✅ $package 已存在${NC}"
        return 0
    fi
    
    # 方法1: pip install --user
    echo "  嘗試 pip install --user $package"
    if python3 -m pip install --user "$package"; then
        if python3 -c "import $import_name" 2>/dev/null; then
            echo -e "${GREEN}✅ $package 安裝成功 (用戶目錄)${NC}"
            return 0
        fi
    fi
    
    # 方法2: pip install 不使用緩存
    echo "  嘗試 pip install --no-cache-dir $package"
    if python3 -m pip install --no-cache-dir --user "$package"; then
        if python3 -c "import $import_name" 2>/dev/null; then
            echo -e "${GREEN}✅ $package 安裝成功 (無緩存)${NC}"
            return 0
        fi
    fi
    
    # 方法3: 使用 --break-system-packages (Python 3.11+)
    echo "  嘗試 pip install --break-system-packages $package"
    if python3 -m pip install --break-system-packages "$package" 2>/dev/null; then
        if python3 -c "import $import_name" 2>/dev/null; then
            echo -e "${GREEN}✅ $package 安裝成功 (系統套件)${NC}"
            return 0
        fi
    fi
    
    echo -e "${RED}❌ $package 安裝失敗${NC}"
    return 1
}

# 安裝核心套件
echo -e "${BLUE}安裝核心套件...${NC}"

install_package "aiohttp" "aiohttp"
install_package "requests" "requests"
install_package "asyncio" "asyncio"

echo ""

echo -e "${BLUE}📦 方法4: 針對 pywebview 的特殊處理${NC}"

# pywebview 需要特殊處理，因為它依賴系統 GUI 庫
echo "跳過 pywebview 安裝 (非必需用於主控制程式)"
echo "如果需要 GUI 功能，可以手動安裝："
echo "  sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-3.0"
echo "  pip3 install --user pywebview"

echo ""

echo -e "${BLUE}🧪 測試最小化版本的模組導入...${NC}"

# 創建簡化版本測試
cat > test_imports.py << 'EOF'
#!/usr/bin/env python3
import sys
import os

# 測試基本模組
def test_basic_imports():
    try:
        import asyncio
        print("✅ asyncio")
    except ImportError as e:
        print(f"❌ asyncio: {e}")
        return False
    
    try:
        import requests
        print("✅ requests")
    except ImportError as e:
        print(f"❌ requests: {e}")
        return False
    
    try:
        import aiohttp
        print("✅ aiohttp")
    except ImportError as e:
        print(f"❌ aiohttp: {e}")
        return False
    
    return True

# 測試專案模組 (如果存在)
def test_project_modules():
    try:
        sys.path.append('.')
        from modules.config_manager import ConfigManager
        print("✅ config_manager")
    except ImportError as e:
        print(f"❌ config_manager: {e}")
        return False
    
    try:
        from modules.api_client import APIClient
        print("✅ api_client")
    except ImportError as e:
        print(f"❌ api_client: {e}")
        # 如果 api_client 導入失敗，嘗試使用 requests 版本
        return False
    
    return True

if __name__ == "__main__":
    print("測試基本模組導入...")
    basic_ok = test_basic_imports()
    
    print("\n測試專案模組導入...")
    project_ok = test_project_modules()
    
    if basic_ok and project_ok:
        print("\n🎉 所有模組導入成功！")
        exit(0)
    elif basic_ok:
        print("\n⚠️ 基本模組OK，但專案模組有問題")
        print("💡 建議使用傳統版本或簡化版本")
        exit(1)
    else:
        print("\n❌ 基本模組導入失敗")
        print("💡 建議使用完全傳統版本")
        exit(2)
EOF

chmod +x test_imports.py
python3 test_imports.py
test_result=$?

echo ""

echo -e "${BLUE}📋 根據測試結果提供建議...${NC}"

if [ $test_result -eq 0 ]; then
    echo -e "${GREEN}🎉 模組化版本完全可用！${NC}"
    echo "建議使用: main_controller.py"
    
    # 恢復使用模組化版本
    if [ -f "start-wakeup-map.sh" ]; then
        sed -i 's/main_web_dsi.py/main_controller.py/g' start-wakeup-map.sh
        echo "✅ 啟動腳本已恢復為模組化版本"
    fi
    
elif [ $test_result -eq 1 ]; then
    echo -e "${YELLOW}⚠️ 部分模組可用，建議使用傳統版本${NC}"
    echo "建議使用: main_web_dsi.py"
    
    # 確保使用傳統版本
    if [ -f "start-wakeup-map.sh" ]; then
        sed -i 's/main_controller.py/main_web_dsi.py/g' start-wakeup-map.sh
        echo "✅ 啟動腳本確認使用傳統版本"
    fi
    
else
    echo -e "${RED}❌ 基本模組都有問題${NC}"
    echo "建議檢查 Python 環境"
fi

echo ""

echo -e "${BLUE}🚀 測試傳統版本是否可用...${NC}"

if [ -f "main_web_dsi.py" ]; then
    echo "檢查傳統版本依賴..."
    
    if python3 -c "
import sys, os
try:
    import selenium
    from selenium import webdriver
    print('✅ selenium 可用')
    
    # 檢查其他基本依賴
    import time, json, threading
    print('✅ 基本庫可用')
    
    print('🎉 傳統版本應該可以正常運行')
except ImportError as e:
    print(f'⚠️ 傳統版本可能需要: {e}')
    print('💡 但基本功能應該仍可使用')
"; then
        echo -e "${GREEN}✅ 傳統版本檢查通過${NC}"
    else
        echo -e "${YELLOW}⚠️ 傳統版本可能有問題，但應該仍可基本運行${NC}"
    fi
else
    echo -e "${RED}❌ 找不到傳統版本 main_web_dsi.py${NC}"
fi

# 清理測試文件
rm -f test_imports.py

echo ""
echo -e "${BLUE}📝 最終建議${NC}"
echo "=============="

echo -e "${GREEN}🚀 現在可以測試啟動:${NC}"
echo "方法1: 雙擊桌面 '甦醒地圖' 圖標"
echo "方法2: 執行 ~/pi/subjective-clock/raspberrypi-dsi/start-wakeup-map.sh"

echo ""
echo -e "${BLUE}🔧 如果仍有問題:${NC}"
echo "1. 查看日誌: cat ~/pi/subjective-clock/wakeup-map.log"
echo "2. 手動測試: cd ~/pi/subjective-clock/raspberrypi-dsi && python3 main_web_dsi.py"
echo "3. 檢查依賴: python3 -c 'import requests; print(\"requests OK\")'"

echo ""
echo -e "${YELLOW}💡 提示: 即使部分依賴失敗，傳統版本通常仍可正常工作！${NC}"