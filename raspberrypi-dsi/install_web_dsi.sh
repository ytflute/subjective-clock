#!/bin/bash

# 甦醒地圖實體裝置安裝腳本 (DSI版本 - 網頁模式)
# 適用於 Raspberry Pi 4B + DSI 螢幕

set -e

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

echo "=== 甦醒地圖實體裝置安裝腳本 (DSI版本 - 網頁模式) ==="
echo

# 檢查是否為root或有sudo權限
if [ "$EUID" -eq 0 ]; then
    log_warning "檢測到以root用戶運行，建議使用一般用戶搭配sudo"
elif ! sudo -n true 2>/dev/null; then
    log_error "此腳本需要sudo權限，請確保當前用戶有sudo權限"
    exit 1
fi

# 檢查樹莓派型號
check_raspberry_pi() {
    log_step "檢查硬體兼容性..."
    
    if ! grep -q "Raspberry Pi" /proc/cpuinfo; then
        log_error "此腳本只適用於Raspberry Pi"
        exit 1
    fi
    
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
    sudo apt update
    sudo apt upgrade -y
}

# 安裝基本依賴
install_basic_deps() {
    log_step "安裝基本依賴..."
    
    sudo apt install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        python3-rpi.gpio \
        python3-tk \
        git \
        curl \
        wget \
        unzip \
        build-essential
}

# 安裝瀏覽器
install_browser() {
    log_step "檢測處理器架構..."
    
    # 檢測架構
    ARCH=$(uname -m)
    log_info "檢測到架構：$ARCH"
    
    # 安裝瀏覽器
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "armv7l" ]; then
        log_info "ARM 架構檢測到，安裝 Chromium 瀏覽器 (對 ARM 支援更佳)..."
        
        # ARM 架構使用 Chromium
        sudo apt install -y chromium-browser
        
        # 建立 Chrome 符號連結以保持兼容性
        if [ ! -f /usr/bin/google-chrome ]; then
            sudo ln -s /usr/bin/chromium-browser /usr/bin/google-chrome
        fi
        
        BROWSER_CMD="chromium-browser"
        
        log_info "正在安裝 ChromeDriver (ARM 版本)..."
        
        # ARM 架構使用系統 ChromeDriver
        sudo apt install -y chromium-chromedriver
        
        # 建立符號連結
        if [ ! -f /usr/local/bin/chromedriver ]; then
            sudo ln -s /usr/bin/chromedriver /usr/local/bin/chromedriver
        fi
        
    else
        log_info "x86_64 架構檢測到，安裝 Google Chrome..."
        
        # x86_64 架構使用 Google Chrome
        wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
        echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
        
        sudo apt update
        sudo apt install -y google-chrome-stable
        
        BROWSER_CMD="google-chrome"
        
        log_info "正在安裝 ChromeDriver..."
        
        # 獲取 Chrome 版本
        CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d'.' -f1-3)
        log_info "Chrome 版本: $CHROME_VERSION"
        
        # 下載對應版本的 ChromeDriver
        CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_$CHROME_VERSION")
        log_info "ChromeDriver 版本: $CHROMEDRIVER_VERSION"
        
        # 下載並安裝 ChromeDriver
        wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_linux64.zip"
        sudo unzip -j /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
        sudo chmod +x /usr/local/bin/chromedriver
        rm /tmp/chromedriver.zip
    fi
    
    log_info "瀏覽器安裝完成：$BROWSER_CMD"
}

# 配置DSI螢幕
configure_dsi() {
    log_step "配置DSI螢幕..."
    
    # 檢查是否已有配置
    if grep -q "WakeUpMap DSI" /boot/config.txt; then
        log_info "DSI螢幕配置已存在"
    else
        # 備份原始配置
        sudo cp /boot/config.txt /boot/config.txt.backup.$(date +%Y%m%d_%H%M%S)
        
        # 添加DSI配置
        sudo tee -a /boot/config.txt > /dev/null << 'EOF'

# WakeUpMap DSI螢幕配置 (網頁模式)
dtoverlay=vc4-kms-v3d
display_auto_detect=1

# GPIO配置
gpio=18=ip,pu  # GPIO18設為輸入，啟用上拉電阻 (按鈕)
gpio=16=op,dl  # GPIO16設為輸出，初始為低電平 (LED)
EOF
        
        log_info "DSI螢幕配置已添加"
    fi
}

# 安裝字體
install_fonts() {
    log_step "安裝中文字體..."
    
    sudo apt install -y \
        fonts-noto-cjk \
        fonts-noto-cjk-extra \
        fonts-dejavu-core \
        fonts-liberation
    
    # 更新字體快取
    fc-cache -fv
    
    log_info "字體安裝完成"
}

# 安裝音頻依賴
install_audio() {
    log_step "安裝音頻依賴..."
    
    # 基本音頻套件（必需）
    local BASIC_AUDIO_PACKAGES=(
        "alsa-utils"
        "pulseaudio"
        "espeak"
        "espeak-data"
        "sox"
        "libsox-fmt-all"
        "portaudio19-dev"
    )
    
    # 可選音頻套件（可能在某些版本中不存在）
    local OPTIONAL_AUDIO_PACKAGES=(
        "alsa-base"
        "libasound2-dev"
    )
    
    # 安裝基本套件
    log_info "安裝基本音頻套件..."
    for package in "${BASIC_AUDIO_PACKAGES[@]}"; do
        if sudo apt install -y "$package"; then
            log_info "✓ $package 安裝成功"
        else
            log_error "✗ $package 安裝失敗"
            exit 1
        fi
    done
    
    # 嘗試安裝可選套件
    log_info "嘗試安裝可選音頻套件..."
    for package in "${OPTIONAL_AUDIO_PACKAGES[@]}"; do
        if sudo apt install -y "$package" 2>/dev/null; then
            log_info "✓ $package 安裝成功"
        else
            log_warning "⚠ $package 安裝失敗或不存在，跳過"
        fi
    done
    
    # 確保音頻服務運行
    log_info "配置音頻服務..."
    
    # 啟動並啟用音頻服務
    sudo systemctl --global enable pulseaudio.service pulseaudio.socket 2>/dev/null || log_warning "PulseAudio 服務配置略過"
    
    # 添加用戶到音頻群組
    sudo usermod -a -G audio $USER
    
    log_info "音頻依賴安裝完成"
}

# 安裝Python依賴
install_python_deps() {
    log_step "建立虛擬環境並安裝Python依賴..."
    
    # 建立虛擬環境
    python3 -m venv venv
    
    # 啟用虛擬環境
    source venv/bin/activate
    
    # 更新pip
    pip install --upgrade pip
    
    # 安裝 selenium
    pip install selenium==4.15.0
    
    # 安裝其他依賴
    if [ -f requirements.txt ]; then
        pip install -r requirements.txt
    fi
    
    log_info "Python依賴安裝完成"
}

# 建立環境配置
create_env_config() {
    log_step "建立環境配置..."
    
    # 創建 .env 檔案
    cat > .env << EOF
# 甦醒地圖 DSI版本網頁模式配置
WEBSITE_URL=https://subjective-clock.vercel.app/
USER_NAME=future
BROWSER_COMMAND=$BROWSER_CMD
EOF
    
    log_info "環境配置檔案已建立"
}

# 設定權限
setup_permissions() {
    log_step "設定權限..."
    
    # GPIO權限
    sudo usermod -a -G gpio $USER 2>/dev/null || log_warning "GPIO群組已存在"
    
    # 設定GPIO權限規則
    echo 'SUBSYSTEM=="gpio", GROUP="gpio", MODE="0664"' | sudo tee /etc/udev/rules.d/99-gpio.rules > /dev/null
    
    # 音頻和視頻權限
    sudo usermod -a -G audio,video $USER
    
    log_info "權限設定完成"
}

# 建立systemd服務
create_service() {
    log_step "建立systemd服務..."
    
    SERVICE_FILE="/etc/systemd/system/wakeupmap-dsi-web.service"
    
    sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=WakeUpMap DSI Web Mode
After=network.target graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$USER/.Xauthority
ExecStart=$(pwd)/venv/bin/python main_web_dsi.py
Restart=always
RestartSec=5
KillMode=process

[Install]
WantedBy=graphical-session.target
EOF
    
    # 重新載入systemd
    sudo systemctl daemon-reload
    
    log_info "systemd服務已建立"
}

# 配置自動登入 (可選)
configure_auto_login() {
    log_step "配置自動登入..."
    
    read -p "是否設定自動登入桌面環境？ (y/N): " choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
        sudo raspi-config nonint do_boot_behaviour B4  # 自動登入桌面
        log_info "自動登入已設定"
    else
        log_info "跳過自動登入設定"
    fi
}

# 測試安裝
test_installation() {
    log_step "測試安裝..."
    
    # 測試瀏覽器
    if command -v $BROWSER_CMD &> /dev/null; then
        log_info "瀏覽器測試: ✓"
        $BROWSER_CMD --version
    else
        log_error "瀏覽器測試: ✗"
    fi
    
    # 測試 ChromeDriver
    if command -v chromedriver &> /dev/null; then
        log_info "ChromeDriver測試: ✓"
        chromedriver --version | head -n 1
    else
        log_error "ChromeDriver測試: ✗"
    fi
    
    # 測試Python模組
    source venv/bin/activate
    if python3 -c "import selenium; print('Selenium版本:', selenium.__version__)" 2>/dev/null; then
        log_info "Selenium測試: ✓"
    else
        log_error "Selenium測試: ✗"
    fi
}

# 顯示安裝後資訊
show_post_install_info() {
    log_info "DSI版本網頁模式安裝完成！"
    echo
    echo "=================== 接下來的步驟 ==================="
    echo
    echo "1. 硬體連接："
    echo "   - 按鈕：GPIO 18 → 按鈕 → GND"
    echo "   - LED：GPIO 16 → 限流電阻 → LED → GND"
    echo "   - DSI螢幕：連接到DSI接口"
    echo
    echo "2. 重新啟動系統："
    echo "   sudo reboot"
    echo
    echo "3. 手動測試："
    echo "   cd $(pwd)"
    echo "   source venv/bin/activate"
    echo "   python3 main_web_dsi.py"
    echo
    echo "4. 啟用自動啟動："
    echo "   sudo systemctl enable wakeupmap-dsi-web"
    echo "   sudo systemctl start wakeupmap-dsi-web"
    echo
    echo "5. 查看狀態："
    echo "   sudo systemctl status wakeupmap-dsi-web"
    echo "   sudo journalctl -u wakeupmap-dsi-web -f"
    echo
    echo "================= 使用方法 ================="
    echo
    echo "- 短按按鈕：啟動甦醒地圖網頁版"
    echo "- 長按按鈕：顯示系統資訊/關閉瀏覽器"
    echo "- DSI螢幕顯示：操作狀態和結果"
    echo "- 網頁版：在瀏覽器中完整體驗甦醒地圖"
    echo
    echo "================= 故障排除 ================="
    echo
    echo "- 檢查日誌：sudo journalctl -u wakeupmap-dsi-web"
    echo "- 測試瀏覽器：$BROWSER_CMD --version"
    echo "- 測試ChromeDriver：chromedriver --version"
    echo "- 檢查顯示：echo \$DISPLAY"
    echo "- 手動測試：python3 web_controller_dsi.py"
    echo
    echo "================================================="
}

# 主安裝流程
main() {
    log_info "開始安裝甦醒地圖 DSI版本 - 網頁模式..."
    
    check_raspberry_pi
    update_system
    install_basic_deps
    install_browser
    configure_dsi
    install_fonts
    install_audio
    install_python_deps
    create_env_config
    setup_permissions
    create_service
    configure_auto_login
    test_installation
    
    show_post_install_info
}

# 處理中斷信號
trap 'log_error "安裝被中斷"; exit 1' INT TERM

# 執行主流程
main "$@" 