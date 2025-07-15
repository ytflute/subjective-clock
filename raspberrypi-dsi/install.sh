#!/bin/bash
# WakeUpMap DSI版本 - 自動安裝腳本
# 適用於 Raspberry Pi 4B + DSI 800x480 螢幕

set -e  # 遇到錯誤立即退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 檢查是否為root用戶
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "請使用sudo執行此腳本"
        exit 1
    fi
}

# 檢查樹莓派型號
check_raspberry_pi() {
    log_step "檢查硬體兼容性..."
    
    if ! grep -q "Raspberry Pi" /proc/cpuinfo; then
        log_error "此腳本只適用於Raspberry Pi"
        exit 1
    fi
    
    # 檢查是否為Pi 4
    if grep -q "Raspberry Pi 4" /proc/cpuinfo; then
        log_info "檢測到 Raspberry Pi 4，兼容性良好"
    else
        log_warning "未檢測到 Raspberry Pi 4，可能存在兼容性問題"
        read -p "是否繼續安裝？ (y/N): " choice
        if [[ ! "$choice" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 更新系統
update_system() {
    log_step "更新系統套件..."
    apt update
    apt upgrade -y
}

# 安裝Python依賴
install_python_deps() {
    log_step "安裝Python依賴..."
    
    # 確保pip已安裝
    apt install -y python3-pip python3-venv
    
    # 安裝系統級依賴
    apt install -y python3-tk python3-dev
    
    # 安裝GPIO庫
    apt install -y python3-rpi.gpio
    
    # 安裝其他依賴
    pip3 install -r requirements.txt
    
    log_info "Python依賴安裝完成"
}

# 配置DSI螢幕
configure_dsi_display() {
    log_step "配置DSI螢幕..."
    
    # 備份原始配置
    if [ -f /boot/config.txt ]; then
        cp /boot/config.txt /boot/config.txt.backup.$(date +%Y%m%d_%H%M%S)
        log_info "已備份原始config.txt"
    fi
    
    # DSI螢幕配置
    cat >> /boot/config.txt << 'EOF'

# WakeUpMap DSI螢幕配置
# DSI顯示器啟用
dtoverlay=vc4-kms-v3d
display_auto_detect=1

# 如果使用官方7吋DSI螢幕
# dtoverlay=rpi-ft5406

# 如果使用第三方DSI螢幕，可能需要以下配置
# lcd_rotate=2  # 旋轉180度
# display_hdmi_rotate=2

# GPIO配置 (用於按鈕和LED)
gpio=18=ip,pu  # GPIO18設為輸入，啟用上拉電阻 (按鈕)
gpio=16=op,dl  # GPIO16設為輸出，初始為低電平 (LED)

EOF
    
    log_info "DSI螢幕配置已添加到 /boot/config.txt"
}

# 安裝字體
install_fonts() {
    log_step "安裝中文字體..."
    
    # 安裝Noto字體（支援中文）
    apt install -y fonts-noto-cjk fonts-noto-cjk-extra
    
    # 安裝其他常用字體
    apt install -y fonts-dejavu-core fonts-liberation
    
    # 更新字體快取
    fc-cache -fv
    
    log_info "字體安裝完成"
}

# 創建服務檔案
create_service() {
    log_step "創建systemd服務..."
    
    # 獲取當前目錄
    INSTALL_DIR=$(pwd)
    
    # 創建服務檔案
    cat > /etc/systemd/system/wakeupmap-dsi.service << EOF
[Unit]
Description=WakeUpMap DSI Version - 甦醒地圖
After=network.target sound.target
Wants=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=${INSTALL_DIR}
Environment=DISPLAY=:0
Environment=PYTHONPATH=${INSTALL_DIR}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# 確保GPIO權限
SupplementaryGroups=gpio

[Install]
WantedBy=multi-user.target
EOF
    
    # 重新載入systemd
    systemctl daemon-reload
    
    log_info "systemd服務已創建"
}

# 設定權限
setup_permissions() {
    log_step "設定檔案權限..."
    
    # 確保pi用戶擁有檔案
    chown -R pi:pi .
    
    # 設定執行權限
    chmod +x main.py
    chmod +x install.sh
    
    # 確保pi用戶在gpio群組中
    usermod -a -G gpio pi
    
    log_info "權限設定完成"
}

# 配置自動登入和啟動X11
configure_auto_login() {
    log_step "配置自動登入..."
    
    # 啟用自動登入
    systemctl set-default graphical.target
    
    # 設定自動登入到pi用戶
    mkdir -p /etc/systemd/system/getty@tty1.service.d
    cat > /etc/systemd/system/getty@tty1.service.d/override.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
EOF
    
    # 配置X11自動啟動 (如果需要圖形界面)
    if [ ! -f /home/pi/.xinitrc ]; then
        cat > /home/pi/.xinitrc << 'EOF'
#!/bin/bash
# 啟動WakeUpMap
cd /home/pi/wakeupmap-dsi
python3 main.py
EOF
        chown pi:pi /home/pi/.xinitrc
        chmod +x /home/pi/.xinitrc
    fi
    
    log_info "自動登入配置完成"
}

# 創建桌面快捷方式
create_desktop_shortcut() {
    log_step "創建桌面快捷方式..."
    
    # 確保桌面目錄存在
    mkdir -p /home/pi/Desktop
    
    # 創建桌面快捷方式
    cat > /home/pi/Desktop/WakeUpMap.desktop << EOF
[Desktop Entry]
Name=WakeUpMap 甦醒地圖
Comment=按下按鈕開始新的一天
Icon=applications-multimedia
Exec=python3 $(pwd)/main.py
Type=Application
Encoding=UTF-8
Terminal=false
Categories=Application;AudioVideo;
EOF
    
    # 設定權限
    chown pi:pi /home/pi/Desktop/WakeUpMap.desktop
    chmod +x /home/pi/Desktop/WakeUpMap.desktop
    
    log_info "桌面快捷方式已創建"
}

# 測試安裝
test_installation() {
    log_step "測試安裝..."
    
    # 測試Python模組導入
    if python3 -c "import config, button_handler, display_manager, api_client" 2>/dev/null; then
        log_info "Python模組測試通過"
    else
        log_error "Python模組測試失敗"
        return 1
    fi
    
    # 測試GPIO權限
    if python3 -c "import RPi.GPIO; RPi.GPIO.setmode(RPi.GPIO.BCM)" 2>/dev/null; then
        log_info "GPIO權限測試通過"
    else
        log_warning "GPIO權限測試失敗，可能需要重新啟動"
    fi
    
    # 測試網路連線
    if python3 -c "import requests; requests.get('https://httpbin.org/get', timeout=5)" 2>/dev/null; then
        log_info "網路連線測試通過"
    else
        log_warning "網路連線測試失敗，請檢查網路設定"
    fi
    
    log_info "安裝測試完成"
}

# 顯示安裝後說明
show_post_install_info() {
    log_info "安裝完成！"
    echo
    echo "================== 接下來的步驟 =================="
    echo
    echo "1. 硬體連接："
    echo "   - 按鈕：GPIO 18 → 按鈕 → GND (使用內建上拉電阻)"
    echo "   - LED：GPIO 16 → 限流電阻 → LED → GND"
    echo "   - DSI螢幕：連接到DSI接口"
    echo
    echo "2. 重新啟動系統："
    echo "   sudo reboot"
    echo
    echo "3. 啟動服務："
    echo "   sudo systemctl enable wakeupmap-dsi"
    echo "   sudo systemctl start wakeupmap-dsi"
    echo
    echo "4. 查看狀態："
    echo "   sudo systemctl status wakeupmap-dsi"
    echo "   sudo journalctl -u wakeupmap-dsi -f"
    echo
    echo "5. 手動測試："
    echo "   cd $(pwd)"
    echo "   python3 main.py"
    echo
    echo "================== 故障排除 =================="
    echo
    echo "- 檢查日誌：journalctl -u wakeupmap-dsi"
    echo "- 測試按鈕：python3 button_handler.py"
    echo "- 測試顯示：python3 display_manager.py"
    echo "- 測試API：python3 api_client.py"
    echo
    echo "==============================================="
}

# 主安裝流程
main() {
    log_info "開始安裝 WakeUpMap DSI版本..."
    
    check_root
    check_raspberry_pi
    update_system
    install_python_deps
    configure_dsi_display
    install_fonts
    setup_permissions
    create_service
    configure_auto_login
    create_desktop_shortcut
    test_installation
    
    show_post_install_info
}

# 處理中斷信號
trap 'log_error "安裝被中斷"; exit 1' INT TERM

# 執行主流程
main "$@" 