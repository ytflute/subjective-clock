#!/bin/bash

# 甦醒地圖啟動器 - 桌面友好版本
# 這個腳本專門用於桌面快捷方式啟動

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 設置終端標題
echo -e "\033]0;甦醒地圖 - WakeUp Map\007"

# 清屏並顯示歡迎信息
clear
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            🌅 甦醒地圖 v4.0.0            ║${NC}"
echo -e "${CYAN}║         WakeUp Map Application        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🖥️  從桌面啟動模式${NC}"
echo -e "${BLUE}=================${NC}"
echo ""

# 獲取腳本目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "📁 工作目錄: ${SCRIPT_DIR}"
echo ""

# 檢查必要文件
START_SCRIPT="${SCRIPT_DIR}/start-wakeup-map.sh"
if [ ! -f "$START_SCRIPT" ]; then
    echo -e "${RED}❌ 找不到啟動腳本: ${START_SCRIPT}${NC}"
    echo -e "${YELLOW}請確保在正確的目錄中運行此腳本${NC}"
    read -p "按 Enter 鍵退出..."
    exit 1
fi

# 檢查執行權限
if [ ! -x "$START_SCRIPT" ]; then
    echo -e "${YELLOW}🔧 設置執行權限...${NC}"
    chmod +x "$START_SCRIPT"
fi

# 顯示啟動選項
echo -e "${YELLOW}🚀 準備啟動甦醒地圖...${NC}"
echo ""
echo -e "${CYAN}選擇啟動模式：${NC}"
echo -e "  ${GREEN}1)${NC} 正常啟動 (推薦)"
echo -e "  ${GREEN}2)${NC} 調試模式啟動"
echo -e "  ${GREEN}3)${NC} 查看系統狀態"
echo -e "  ${GREEN}q)${NC} 退出"
echo ""

# 讀取用戶選擇
read -p "請選擇 [1]: " choice
choice=${choice:-1}

case $choice in
    1)
        echo -e "${GREEN}🌅 正常啟動甦醒地圖...${NC}"
        echo ""
        ;;
    2)
        echo -e "${BLUE}🔍 調試模式啟動...${NC}"
        echo ""
        export DEBUG_MODE=1
        ;;
    3)
        echo -e "${CYAN}📊 系統狀態檢查...${NC}"
        echo ""
        
        # 檢查Python版本
        echo -e "🐍 Python版本:"
        python3 --version 2>/dev/null || echo "   ❌ Python3 未安裝"
        echo ""
        
        # 檢查正在運行的進程
        echo -e "🔄 甦醒地圖進程狀態:"
        if pgrep -f "main_web_dsi.py" >/dev/null; then
            echo -e "   ✅ main_web_dsi.py 正在運行"
        elif pgrep -f "main_controller.py" >/dev/null; then
            echo -e "   ✅ main_controller.py 正在運行"
        else
            echo -e "   ⭕ 沒有甦醒地圖進程在運行"
        fi
        echo ""
        
        # 檢查瀏覽器進程
        if pgrep -f "chromium" >/dev/null; then
            echo -e "   ✅ Chromium瀏覽器正在運行"
        else
            echo -e "   ⭕ Chromium瀏覽器未運行"
        fi
        echo ""
        
        read -p "按 Enter 鍵繼續啟動，或 Ctrl+C 退出..."
        ;;
    q|Q)
        echo -e "${YELLOW}👋 再見！${NC}"
        exit 0
        ;;
    *)
        echo -e "${YELLOW}使用預設選項：正常啟動${NC}"
        ;;
esac

# 執行啟動腳本
echo -e "${GREEN}🚀 執行啟動腳本...${NC}"
echo ""

# 進入正確目錄
cd "$SCRIPT_DIR"

# 執行主啟動腳本
exec bash "$START_SCRIPT"