#!/bin/bash

# 創建甦醒地圖關閉快捷方式腳本

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 創建甦醒地圖關閉快捷方式${NC}"
echo -e "${BLUE}=========================${NC}"

# 獲取當前腳本目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"

# 確保桌面目錄存在
mkdir -p "$DESKTOP_DIR"

# 設定關閉腳本權限
chmod +x "$SCRIPT_DIR/stop-wakeup-map.sh"

# 創建桌面快捷方式
cat > "$DESKTOP_DIR/關閉甦醒地圖.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=關閉甦醒地圖
Name[en]=Stop WakeUp Map
Comment=安全關閉甦醒地圖程式
Comment[en]=Safely stop WakeUp Map application
Exec=lxterminal --title="關閉甦醒地圖" -e "bash -c 'cd $SCRIPT_DIR && ./stop-wakeup-map.sh'"
Icon=application-exit
Terminal=false
Categories=Utility;
StartupNotify=true
EOF

# 設定桌面快捷方式權限
chmod +x "$DESKTOP_DIR/關閉甦醒地圖.desktop"

echo -e "${GREEN}✅ 關閉快捷方式已創建完成！${NC}"
echo ""
echo -e "📍 快捷方式位置: $DESKTOP_DIR/關閉甦醒地圖.desktop"
echo -e "🖱️  雙擊桌面上的 '關閉甦醒地圖' 圖標即可安全關閉程式"
echo ""