#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - 樹莓派4B DSI螢幕版本配置檔案
"""

# =============================================================================
# 硬體配置
# =============================================================================

# DSI螢幕配置
SCREEN_CONFIG = {
    'width': 800,
    'height': 480,
    'fullscreen': True,
    'resizable': False,
    'title': 'WakeUpMap 甦醒地圖'
}

# GPIO按鈕配置
BUTTON_CONFIG = {
    'pin': 18,  # GPIO 18 (實體針腳12)
    'pull_up': True,  # 使用內建上拉電阻
    'bounce_time': 300,  # 按鈕防彈跳時間（毫秒）
    'long_press_time': 2.0,  # 長按時間（秒）
}

# LED指示燈配置（可選）
LED_CONFIG = {
    'enabled': True,
    'pin': 16,  # GPIO 16 (實體針腳36)
    'blink_on_activity': True
}

# =============================================================================
# 顯示配置
# =============================================================================

# 字體配置
FONT_CONFIG = {
    'title_size': 48,       # 城市名稱字體大小
    'subtitle_size': 32,    # 國家名稱字體大小
    'greeting_size': 24,    # 早安問候字體大小
    'info_size': 16,        # 資訊文字字體大小
    'font_family': 'Noto Sans CJK TC',  # 支援中文的字體
    'fallback_font': 'DejaVu Sans'      # 備用字體
}

# 顏色配置
COLOR_CONFIG = {
    'background': '#1a1a2e',      # 深藍背景
    'primary_text': '#ffffff',     # 主要文字（白色）
    'secondary_text': '#b8b8b8',   # 次要文字（灰色）
    'accent': '#16213e',          # 強調色
    'success': '#00ff88',         # 成功色（綠色）
    'warning': '#ffa500',         # 警告色（橙色）
    'error': '#ff4757'            # 錯誤色（紅色）
}

# 動畫配置
ANIMATION_CONFIG = {
    'fade_duration': 1000,    # 淡入淡出時間（毫秒）
    'slide_duration': 800,    # 滑動動畫時間（毫秒）
    'pulse_duration': 2000,   # 脈衝動畫時間（毫秒）
}

# =============================================================================
# API配置
# =============================================================================

# API端點
API_ENDPOINTS = {
    'find_city': 'https://subjective-clock02.vercel.app/api/find-city-geonames',
    'translate': 'https://subjective-clock02.vercel.app/api/translate-location',
    'generate_story': 'https://subjective-clock02.vercel.app/api/generateStory'
}

# API請求配置
API_CONFIG = {
    'timeout': 15,        # 請求超時時間（秒）
    'max_retries': 3,     # 最大重試次數
    'retry_delay': 2,     # 重試延遲（秒）
}

# =============================================================================
# 系統配置
# =============================================================================

# 日誌配置
LOGGING_CONFIG = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'file': '/var/log/wakeupmap-dsi.log',
    'max_bytes': 10 * 1024 * 1024,  # 10MB
    'backup_count': 5
}

# 調試模式
DEBUG_MODE = False

# 自動啟動配置
AUTOSTART_CONFIG = {
    'enabled': True,
    'delay': 10,  # 開機後延遲啟動時間（秒）
}

# 螢幕保護配置
SCREENSAVER_CONFIG = {
    'enabled': True,
    'timeout': 300,       # 5分鐘無操作後進入螢幕保護
    'dim_brightness': 20, # 螢幕保護時的亮度百分比
}

# =============================================================================
# 多語言早安問候語
# =============================================================================

MORNING_GREETINGS = {
    'zh-TW': '早安！新的一天開始了！',
    'zh-CN': '早上好！新的一天开始了！',
    'en': 'Good morning! A new day begins!',
    'ja': 'おはようございます！新しい一日が始まります！',
    'ko': '좋은 아침! 새로운 하루가 시작됩니다!',
    'es': '¡Buenos días! ¡Comienza un nuevo día!',
    'fr': 'Bonjour ! Une nouvelle journée commence !',
    'de': 'Guten Morgen! Ein neuer Tag beginnt!',
    'it': 'Buongiorno! Inizia una nuova giornata!',
    'pt': 'Bom dia! Um novo dia começa!',
    'ru': 'Доброе утро! Начинается новый день!',
    'ar': 'صباح الخير! يوم جديد يبدأ!',
    'th': 'สวัสดีตอนเช้า! วันใหม่เริ่มต้นแล้ว!',
    'vi': 'Chào buổi sáng! Một ngày mới bắt đầu!',
    'hi': 'सुप्रभात! एक नया दिन शुरू होता है!',
    'default': 'Good morning! A new day begins!'
}

# =============================================================================
# 錯誤訊息
# =============================================================================

ERROR_MESSAGES = {
    'network_error': '網路連線錯誤，請檢查網路設定',
    'api_error': 'API服務暫時無法使用',
    'location_error': '無法獲取位置資訊',
    'display_error': '顯示器初始化失敗',
    'button_error': '按鈕初始化失敗',
    'unknown_error': '發生未知錯誤'
} 