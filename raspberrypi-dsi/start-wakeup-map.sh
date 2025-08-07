#!/bin/bash

# 甦醒地圖啟動腳本 v4.0.0
# 支援智能版本切換：模組化版本 vs 傳統版本

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌅 甦醒地圖啟動程式${NC}"
echo -e "${BLUE}=================${NC}"
echo ""

# 進入正確目錄
cd "$(dirname "$0")"
SCRIPT_DIR=$(pwd)
echo -e "📁 工作目錄: ${SCRIPT_DIR}"

# 創建日誌目錄
LOG_DIR="${SCRIPT_DIR}/../logs"
mkdir -p "$LOG_DIR"

# 終止現有進程
echo -e "${YELLOW}🔄 檢查並終止現有進程...${NC}"
pkill -f "main_controller.py" 2>/dev/null || true
pkill -f "main_web_dsi.py" 2>/dev/null || true
sleep 2

# 智能版本選擇
MAIN_SCRIPT=""

# 優先檢查模組化版本
if [ -f "main_controller.py" ]; then
    echo -e "${BLUE}🧪 測試模組化版本依賴...${NC}"
    python3 -c "
import sys
sys.path.append('.')
try:
    from modules.api_client import APIClient
    from modules.audio_manager import AudioManager
    from modules.display_manager import DisplayManager
    exit(0)
except ImportError as e:
    print(f'❌ 模組導入失敗: {e}')
    exit(1)
" 2>/dev/null

    if [ $? -eq 0 ]; then
        MAIN_SCRIPT="main_controller.py"
        echo -e "${GREEN}✅ 使用模組化主控制程式: main_controller.py${NC}"
    else
        echo -e "${YELLOW}⚠️ 模組化版本依賴不足，切換至傳統版本${NC}"
    fi
fi

# 備援檢查傳統版本
if [ -z "$MAIN_SCRIPT" ] && [ -f "main_web_dsi.py" ]; then
    MAIN_SCRIPT="main_web_dsi.py"
    echo -e "${GREEN}🔄 使用傳統主控制程式: main_web_dsi.py${NC}"
fi

# 錯誤處理
if [ -z "$MAIN_SCRIPT" ]; then
    echo -e "${RED}❌ 找不到可用的主控制程式${NC}"
    echo -e "${RED}   請確認以下檔案存在:${NC}"
    echo -e "${RED}   - main_controller.py (模組化版本)${NC}"
    echo -e "${RED}   - main_web_dsi.py (傳統版本)${NC}"
    echo ""
    echo -e "${YELLOW}按任意鍵關閉此視窗...${NC}"
    read -n 1
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 甦醒地圖啟動中...${NC}"
echo -e "${BLUE}主控制程式: ${MAIN_SCRIPT}${NC}"
echo ""

# 啟動主程式
python3 "$MAIN_SCRIPT" 2>&1 | tee "${LOG_DIR}/wakeup-map.log"

# 程式結束處理
EXIT_CODE=$?
echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ 甦醒地圖程式正常結束${NC}"
else
    echo -e "${RED}❌ 甦醒地圖程式異常結束 (錯誤碼: $EXIT_CODE)${NC}"
    echo -e "${YELLOW}請檢查日誌文件: ${LOG_DIR}/wakeup-map.log${NC}"
fi

echo ""
echo -e "${YELLOW}按任意鍵關閉此視窗...${NC}"
read -n 1