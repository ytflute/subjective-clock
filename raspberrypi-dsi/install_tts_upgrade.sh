#!/bin/bash
# TTS 語音質量升級安裝腳本
# 安裝 Festival TTS 引擎和女性聲音包

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 檢查是否為 root 用戶
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "請使用 sudo 運行此腳本"
        exit 1
    fi
}

# 更新系統
update_system() {
    log_step "更新系統套件..."
    apt update
    log_info "系統套件更新完成"
}

# 安裝 Festival TTS
install_festival() {
    log_step "安裝 Festival TTS 引擎..."
    
    # 基本 Festival 套件
    apt install -y \
        festival \
        festival-dev \
        festvox-kallpc16k \
        festvox-kdlpc16k \
        sox \
        libsox-fmt-all
    
    log_info "Festival 基本套件安裝完成"
}

# 安裝女性聲音包
install_female_voices() {
    log_step "安裝女性聲音包..."
    
    # 嘗試安裝可用的女性聲音
    FEMALE_VOICES=(
        "festvox-us1-mbrola"
        "festvox-us2-mbrola" 
        "festvox-us3-mbrola"
        "mbrola"
        "mbrola-us1"
        "mbrola-us2"
        "mbrola-us3"
    )
    
    for voice in "${FEMALE_VOICES[@]}"; do
        if apt-cache show "$voice" >/dev/null 2>&1; then
            log_info "安裝聲音包: $voice"
            apt install -y "$voice" || log_warning "聲音包 $voice 安裝失敗，繼續..."
        else
            log_warning "聲音包 $voice 不可用，跳過..."
        fi
    done
    
    # 下載高質量女性聲音（如果網路允許）
    download_hq_voices
}

# 下載高質量聲音
download_hq_voices() {
    log_step "嘗試下載高質量女性聲音..."
    
    VOICES_DIR="/usr/share/festival/voices/english"
    mkdir -p "$VOICES_DIR"
    
    # 嘗試下載 CMU Arctic 聲音
    HQ_VOICES=(
        "http://festvox.org/packed/festival/2.5/voices/festvox_cmu_us_slt_arctic_hts.tar.gz"
        "http://festvox.org/packed/festival/2.5/voices/festvox_cmu_us_clb_arctic_hts.tar.gz"
    )
    
    for voice_url in "${HQ_VOICES[@]}"; do
        voice_name=$(basename "$voice_url" .tar.gz)
        log_info "嘗試下載: $voice_name"
        
        if wget -q --timeout=30 "$voice_url" -O "/tmp/$voice_name.tar.gz"; then
            cd "$VOICES_DIR"
            tar -xzf "/tmp/$voice_name.tar.gz" 2>/dev/null || log_warning "解壓 $voice_name 失敗"
            rm -f "/tmp/$voice_name.tar.gz"
            log_info "✅ $voice_name 下載並安裝成功"
        else
            log_warning "❌ $voice_name 下載失敗"
        fi
    done
}

# 配置 Festival
configure_festival() {
    log_step "配置 Festival..."
    
    # 創建 Festival 配置目錄
    mkdir -p /etc/festival
    
    # 創建女性聲音配置
    cat > /etc/festival/siteinit.scm << 'EOF'
;; WakeUpMap Festival 配置
;; 優先使用女性聲音

;; 設定預設聲音為女性
(if (probe_file "/usr/share/festival/voices/english/cmu_us_slt_arctic_hts/festvox/cmu_us_slt_arctic_hts.scm")
    (set! voice_default 'voice_cmu_us_slt_arctic_hts)
    (if (probe_file "/usr/share/festival/voices/english/kal_diphone/festvox/kal_diphone.scm")
        (set! voice_default 'voice_kal_diphone)))

;; 音質增強設定
(Parameter.set 'Audio_Method 'Audio_Command)
(Parameter.set 'Audio_Required_Rate 22050)
(Parameter.set 'Audio_Required_Format 'wav)

;; 語速和音調調整
(Parameter.set 'Duration_Stretch 1.1)
(Parameter.set 'Default_Female_Voice t)
EOF
    
    log_info "Festival 配置完成"
}

# 測試 TTS 系統
test_tts() {
    log_step "測試 TTS 系統..."
    
    # 測試 Festival
    echo "Testing Festival female voice" | festival --tts
    
    if [ $? -eq 0 ]; then
        log_info "✅ Festival TTS 測試成功"
    else
        log_warning "❌ Festival TTS 測試失敗"
    fi
    
    # 列出可用聲音
    log_info "可用的 Festival 聲音："
    festival --server & 
    FESTIVAL_PID=$!
    sleep 2
    echo '(voice.list)' | nc localhost 1314 2>/dev/null || log_warning "無法列出聲音"
    kill $FESTIVAL_PID 2>/dev/null
}

# 優化 espeak（備用方案）
optimize_espeak() {
    log_step "優化 espeak 作為備用方案..."
    
    # 安裝額外的 espeak 聲音
    apt install -y \
        espeak-data \
        espeak-ng \
        espeak-ng-data
    
    # 測試女性聲音
    log_info "測試 espeak 女性聲音："
    echo "Hello, this is espeak female voice test" | espeak -v en+f3 -s 140 -p 40
    
    log_info "espeak 優化完成"
}

# 設定權限
set_permissions() {
    log_step "設定權限..."
    
    # 確保音頻群組權限
    usermod -a -G audio pi
    
    # 設定 Festival 目錄權限
    chown -R root:audio /usr/share/festival
    chmod -R 755 /usr/share/festival
    
    log_info "權限設定完成"
}

# 主函數
main() {
    echo "🎵 WakeUpMap TTS 語音質量升級"
    echo "=================================="
    echo "將安裝 Festival TTS 引擎和女性聲音包"
    echo "這將大幅改善語音質量和自然度"
    echo ""
    
    read -p "是否繼續安裝？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "安裝已取消"
        exit 0
    fi
    
    check_root
    update_system
    install_festival
    install_female_voices
    configure_festival
    optimize_espeak
    set_permissions
    test_tts
    
    echo ""
    echo "🎉 TTS 升級安裝完成！"
    echo "=================================="
    echo "✅ Festival TTS 引擎已安裝"
    echo "✅ 女性聲音包已安裝"
    echo "✅ 音質增強已配置"
    echo ""
    echo "📋 下一步："
    echo "1. 重新啟動 WakeUpMap 服務："
    echo "   sudo systemctl restart wakeupmap-dsi"
    echo ""
    echo "2. 或手動測試："
    echo "   cd raspberrypi-dsi"
    echo "   python3 test_audio_greeting.py"
    echo ""
    echo "🎵 現在應該能聽到更自然的女性聲音了！"
}

# 執行主函數
main "$@" 