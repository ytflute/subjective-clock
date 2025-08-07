#!/bin/bash

# 甦醒地圖關閉腳本
# 安全關閉所有相關進程

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 甦醒地圖關閉程式${NC}"
echo -e "${BLUE}=================${NC}"
echo ""

# 檢查正在運行的進程
echo -e "${YELLOW}🔍 檢查正在運行的甦醒地圖進程...${NC}"

MAIN_CONTROLLER_PID=$(pgrep -f "main_controller.py")
MAIN_WEB_DSI_PID=$(pgrep -f "main_web_dsi.py")
CHROMIUM_PID=$(pgrep -f "chromium.*localhost")

if [ -z "$MAIN_CONTROLLER_PID" ] && [ -z "$MAIN_WEB_DSI_PID" ] && [ -z "$CHROMIUM_PID" ]; then
    echo -e "${GREEN}✅ 沒有發現正在運行的甦醒地圖進程${NC}"
    echo ""
    echo -e "${YELLOW}按任意鍵關閉此視窗...${NC}"
    read -n 1
    exit 0
fi

# 顯示發現的進程
if [ ! -z "$MAIN_CONTROLLER_PID" ]; then
    echo -e "${YELLOW}📍 發現主控制程式 (模組化): PID $MAIN_CONTROLLER_PID${NC}"
fi

if [ ! -z "$MAIN_WEB_DSI_PID" ]; then
    echo -e "${YELLOW}📍 發現主控制程式 (傳統): PID $MAIN_WEB_DSI_PID${NC}"
fi

if [ ! -z "$CHROMIUM_PID" ]; then
    echo -e "${YELLOW}📍 發現瀏覽器進程: PID $CHROMIUM_PID${NC}"
fi

echo ""
echo -e "${YELLOW}🛑 正在關閉甦醒地圖程式...${NC}"

# 溫和關閉
echo -e "   ⏳ 嘗試溫和關閉..."
pkill -TERM -f "main_controller.py" 2>/dev/null
pkill -TERM -f "main_web_dsi.py" 2>/dev/null
pkill -TERM -f "chromium.*localhost" 2>/dev/null

# 等待進程結束
sleep 3

# 檢查是否還有進程存在
REMAINING_PROCESSES=$(pgrep -f "(main_controller|main_web_dsi|chromium.*localhost)" | wc -l)

if [ "$REMAINING_PROCESSES" -gt 0 ]; then
    echo -e "   💪 強制關閉剩餘進程..."
    pkill -KILL -f "main_controller.py" 2>/dev/null
    pkill -KILL -f "main_web_dsi.py" 2>/dev/null
    pkill -KILL -f "chromium.*localhost" 2>/dev/null
    sleep 1
fi

# 最終檢查
FINAL_CHECK=$(pgrep -f "(main_controller|main_web_dsi|chromium.*localhost)" | wc -l)

if [ "$FINAL_CHECK" -eq 0 ]; then
    echo -e "${GREEN}✅ 甦醒地圖程式已成功關閉${NC}"
else
    echo -e "${RED}⚠️ 部分進程可能仍在運行，建議重啟系統${NC}"
fi

echo ""
echo -e "${YELLOW}按任意鍵關閉此視窗...${NC}"
read -n 1