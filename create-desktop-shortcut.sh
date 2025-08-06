#!/bin/bash
# 🖥️ 創建 Raspberry Pi 桌面快捷方式腳本

echo "🖥️ 正在創建甦醒地圖桌面快捷方式..."

# 設定變數
USER_HOME="/home/future"
DESKTOP_DIR="$USER_HOME/Desktop"
PROJECT_DIR="$USER_HOME/pi/subjective-clock"
SHORTCUT_FILE="$DESKTOP_DIR/甦醒地圖.desktop"

# 確保桌面目錄存在
mkdir -p "$DESKTOP_DIR"

# 創建桌面快捷方式文件
cat > "$SHORTCUT_FILE" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=甦醒地圖
Name[en]=WakeUp Map
Comment=啟動甦醒地圖主控程式
Comment[en]=Start WakeUp Map Main Controller
Exec=/home/future/pi/subjective-clock/raspberrypi-dsi/start-wakeup-map.sh
Icon=/home/future/pi/subjective-clock/icon-192x192.png
Terminal=true
StartupNotify=true
Categories=Utility;
Keywords=wakeup;map;raspberry;pi;
StartupWMClass=甦醒地圖
EOF

# 設定檔案權限
chmod +x "$SHORTCUT_FILE"

echo "✅ 桌面快捷方式已創建: $SHORTCUT_FILE"

# 創建啟動腳本
STARTUP_SCRIPT="$PROJECT_DIR/raspberrypi-dsi/start-wakeup-map.sh"

cat > "$STARTUP_SCRIPT" << 'EOF'
#!/bin/bash
# 🚀 甦醒地圖啟動腳本

# 設定變數
PROJECT_DIR="/home/future/pi/subjective-clock"
RASPBERRYPI_DSI_DIR="$PROJECT_DIR/raspberrypi-dsi"
LOG_FILE="$PROJECT_DIR/wakeup-map.log"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 清理函數
cleanup() {
    echo -e "\n${YELLOW}正在關閉甦醒地圖...${NC}"
    # 關閉所有相關的 Python 進程
    pkill -f "main_web_dsi.py"
    pkill -f "main_controller.py"
    echo -e "${GREEN}甦醒地圖已關閉${NC}"
    exit 0
}

# 設置信號處理
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}🌅 甦醒地圖啟動程式${NC}"
echo -e "${BLUE}=================${NC}"
echo ""

# 檢查項目目錄
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ 錯誤: 找不到項目目錄 $PROJECT_DIR${NC}"
    exit 1
fi

# 檢查 raspberrypi-dsi 目錄
if [ ! -d "$RASPBERRYPI_DSI_DIR" ]; then
    echo -e "${RED}❌ 錯誤: 找不到 raspberrypi-dsi 目錄${NC}"
    exit 1
fi

# 進入項目目錄
cd "$RASPBERRYPI_DSI_DIR"

echo -e "${YELLOW}📁 工作目錄: $(pwd)${NC}"
echo -e "${YELLOW}📝 日誌文件: $LOG_FILE${NC}"
echo ""

# 檢查主控制程式是否存在
if [ -f "main_controller.py" ]; then
    MAIN_SCRIPT="main_controller.py"
    echo -e "${GREEN}🚀 使用模組化主控制程式: main_controller.py${NC}"
elif [ -f "main_web_dsi.py" ]; then
    MAIN_SCRIPT="main_web_dsi.py"
    echo -e "${GREEN}🚀 使用傳統主控制程式: main_web_dsi.py${NC}"
else
    echo -e "${RED}❌ 錯誤: 找不到主控制程式文件${NC}"
    echo -e "${YELLOW}請確認以下文件之一存在:${NC}"
    echo -e "  - main_controller.py (模組化版本)"
    echo -e "  - main_web_dsi.py (傳統版本)"
    exit 1
fi

echo ""
echo -e "${YELLOW}按 Ctrl+C 可隨時停止程式${NC}"
echo -e "${BLUE}===================${NC}"
echo ""

# 啟動主控制程式
echo -e "${GREEN}🌅 正在啟動甦醒地圖主控制程式...${NC}"

# 使用 Python 啟動，並將輸出同時顯示在終端和保存到日誌
python3 "$MAIN_SCRIPT" 2>&1 | tee "$LOG_FILE"

# 如果程式意外退出
echo ""
echo -e "${RED}⚠️ 甦醒地圖程式已停止${NC}"
echo -e "${YELLOW}請檢查日誌文件: $LOG_FILE${NC}"
echo ""
echo -e "${BLUE}按任意鍵關閉此視窗...${NC}"
read -n 1
EOF

# 設定啟動腳本權限
chmod +x "$STARTUP_SCRIPT"

echo "✅ 啟動腳本已創建: $STARTUP_SCRIPT"

# 創建停止腳本
STOP_SCRIPT="$PROJECT_DIR/raspberrypi-dsi/stop-wakeup-map.sh"

cat > "$STOP_SCRIPT" << 'EOF'
#!/bin/bash
# 🛑 甦醒地圖停止腳本

echo "🛑 正在停止甦醒地圖..."

# 查找並終止相關進程
PIDS=$(pgrep -f "main_web_dsi.py\|main_controller.py")

if [ -n "$PIDS" ]; then
    echo "找到運行中的進程: $PIDS"
    kill $PIDS
    sleep 2
    
    # 確認是否還有殘留進程
    REMAINING_PIDS=$(pgrep -f "main_web_dsi.py\|main_controller.py")
    if [ -n "$REMAINING_PIDS" ]; then
        echo "強制終止殘留進程: $REMAINING_PIDS"
        kill -9 $REMAINING_PIDS
    fi
    
    echo "✅ 甦醒地圖已停止"
else
    echo "ℹ️ 沒有找到運行中的甦醒地圖進程"
fi
EOF

chmod +x "$STOP_SCRIPT"

echo "✅ 停止腳本已創建: $STOP_SCRIPT"

# 如果存在 autostart 服務，提供禁用選項
if systemctl is-enabled wakeupclock >/dev/null 2>&1; then
    echo ""
    echo -e "\033[1;33m⚠️ 檢測到 wakeupclock 自動啟動服務仍然啟用\033[0m"
    echo -e "\033[1;36m要禁用自動啟動嗎？(y/n)\033[0m"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "正在禁用自動啟動服務..."
        sudo systemctl disable wakeupclock
        sudo systemctl stop wakeupclock
        echo "✅ 自動啟動服務已禁用"
    else
        echo "ℹ️ 保持自動啟動服務啟用"
        echo "📝 注意: 重開機後程式仍會自動啟動"
    fi
fi

echo ""
echo -e "\033[1;32m🎉 桌面快捷方式設置完成！\033[0m"
echo ""
echo -e "\033[1;36m使用說明:\033[0m"
echo -e "  1. 在桌面上雙擊 '\033[1;33m甦醒地圖\033[0m' 圖標啟動程式"
echo -e "  2. 終端視窗會顯示程式運行狀態"
echo -e "  3. 按 \033[1;31mCtrl+C\033[0m 或關閉終端視窗停止程式"
echo -e "  4. 或者執行: \033[1;33m$STOP_SCRIPT\033[0m"
echo ""