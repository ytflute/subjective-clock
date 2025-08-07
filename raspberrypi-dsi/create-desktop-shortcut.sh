#!/bin/bash

# 創建甦醒地圖桌面快捷方式腳本
# 在Raspberry Pi上運行此腳本來創建桌面圖標

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🖥️  創建甦醒地圖桌面快捷方式${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 獲取當前腳本目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "📁 腳本目錄: ${SCRIPT_DIR}"

# 獲取桌面目錄
DESKTOP_DIR="${HOME}/Desktop"
if [ ! -d "$DESKTOP_DIR" ]; then
    # 嘗試中文桌面目錄
    DESKTOP_DIR="${HOME}/桌面"
    if [ ! -d "$DESKTOP_DIR" ]; then
        # 使用 xdg-user-dir 獲取桌面目錄
        DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null)
        if [ ! -d "$DESKTOP_DIR" ]; then
            DESKTOP_DIR="${HOME}/Desktop"
            mkdir -p "$DESKTOP_DIR"
        fi
    fi
fi

echo -e "🖥️  桌面目錄: ${DESKTOP_DIR}"

# 創建桌面快捷方式文件
SHORTCUT_FILE="${DESKTOP_DIR}/甦醒地圖.desktop"

echo -e "${YELLOW}📝 創建桌面快捷方式...${NC}"

cat > "$SHORTCUT_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=甦醒地圖
Name[en]=WakeUp Map
Comment=啟動甦醒地圖應用程式
Comment[en]=Start WakeUp Map Application
Icon=${SCRIPT_DIR}/wakeup-map-icon.png
Exec=${SCRIPT_DIR}/wakeup-map-launcher.sh
Terminal=true
StartupNotify=false
Categories=Application;Education;
Path=${SCRIPT_DIR}
EOF

# 設置可執行權限
chmod +x "$SHORTCUT_FILE"
chmod +x "${SCRIPT_DIR}/start-wakeup-map.sh"
chmod +x "${SCRIPT_DIR}/wakeup-map-launcher.sh"

echo -e "${GREEN}✅ 桌面快捷方式創建成功！${NC}"
echo ""
echo -e "📋 快捷方式詳情："
echo -e "   文件位置: ${SHORTCUT_FILE}"
echo -e "   啟動器: ${SCRIPT_DIR}/wakeup-map-launcher.sh"
echo -e "   執行腳本: ${SCRIPT_DIR}/start-wakeup-map.sh"
echo -e "   工作目錄: ${SCRIPT_DIR}"
echo ""

# 創建圖標文件（如果不存在）
ICON_FILE="${SCRIPT_DIR}/wakeup-map-icon.png"
if [ ! -f "$ICON_FILE" ]; then
    echo -e "${YELLOW}🎨 創建預設圖標...${NC}"
    
    # 創建一個簡單的SVG圖標並轉換為PNG（如果有工具）
    if command -v convert >/dev/null 2>&1; then
        # 使用ImageMagick創建圖標
        convert -size 64x64 xc:skyblue \
                -gravity center \
                -pointsize 20 \
                -fill white \
                -annotate +0+0 "甦醒" \
                "$ICON_FILE" 2>/dev/null || echo -e "${YELLOW}⚠️  無法創建圖標，將使用系統預設圖標${NC}"
    else
        echo -e "${YELLOW}⚠️  ImageMagick未安裝，將使用系統預設圖標${NC}"
        # 複製一個系統圖標作為備用
        cp /usr/share/pixmaps/python3.png "$ICON_FILE" 2>/dev/null || true
    fi
fi

# 檢查圖標是否存在
if [ -f "$ICON_FILE" ]; then
    echo -e "${GREEN}🎨 圖標文件: ${ICON_FILE}${NC}"
else
    echo -e "${YELLOW}⚠️  圖標文件不存在，將使用系統預設圖標${NC}"
fi

echo ""
echo -e "${GREEN}🎉 設置完成！${NC}"
echo ""
echo -e "${BLUE}📖 使用說明：${NC}"
echo -e "1. 在桌面上會看到 '甦醒地圖' 圖標"
echo -e "2. 雙擊圖標即可啟動甦醒地圖應用程式"
echo -e "3. 如果需要停止應用程式，請使用 './stop-wakeup-map.sh'"
echo ""
echo -e "${YELLOW}💡 提示：${NC}"
echo -e "   - 首次點擊可能需要確認執行權限"
echo -e "   - 應用程式會在終端視窗中顯示運行狀態"
echo -e "   - 關閉終端視窗將停止應用程式"
echo ""