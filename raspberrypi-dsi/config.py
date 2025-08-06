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
    'fullscreen': False,  # 暫時關閉全螢幕模式
    'resizable': True,    # 允許調整視窗大小
    'title': 'WakeUpMap 甦醒地圖'
}

# GPIO按鈕配置
BUTTON_CONFIG = {
    'pin': 18,  # GPIO 18 (實體針腳12)
    'pull_up': True,  # 使用內建上拉電阻
    'bounce_time': 500,  # 按鈕防彈跳時間（毫秒）- 增加到 500ms
    'long_press_time': 2.0,  # 長按時間（秒）
    'min_press_interval': 1.0,  # 最小按壓間隔（秒）- 防止快速重複觸發
}

# LED指示燈配置（可選）
LED_CONFIG = {
    'enabled': True,
    'pin': 16,  # GPIO 16 (實體針腳36)
    'blink_on_activity': True
}

# =============================================================================
# 音頻配置
# =============================================================================

# 音頻硬體配置
AUDIO_CONFIG = {
    'enabled': True,
    'output_device': 'default',  # ALSA音頻輸出設備
    'volume': 80,  # 預設音量 (0-100)
    'sample_rate': 44100,  # 採樣率
    'channels': 2,  # 聲道數 (1=單聲道, 2=立體聲)
}

# GF1002 喇叭配置
SPEAKER_CONFIG = {
    'connection': '3.5mm',  # 連接方式：'3.5mm' 或 'gpio'
    'output_pin': 'headphone',  # 樹莓派3.5mm音頻輸出
    'impedance': '8ohm',  # 喇叭阻抗
    'power': '2w',  # 喇叭功率
    'notes': '連接到樹莓派3.5mm音頻插孔或GPIO音頻針腳'
}

# TTS (文字轉語音) 配置
TTS_CONFIG = {
    'engine': 'festival',  # 預設引擎，可通過 setup_openai_tts.py 升級
    'speed': 140,  # 語速稍微放慢（words per minute）
    'voice_id': 'female',  # 女性聲音
    'voice_name': 'kal_diphone',  # Festival 聲音名稱
    'cache_enabled': True,  # 啟用音頻快取
    'cache_dir': '/tmp/wakeupmap_audio_cache',
    # Festival 特定配置
    'festival_voice': 'kal_diphone',  # 修復：移除 voice_ 前綴
    'festival_female_voices': [
        'kal_diphone',     # 預設女性聲音
        'cmu_us_slt_arctic_hts',  # 高質量女性聲音（如果可用）
        'nitech_us_slt_arctic_hts'  # 備用女性聲音
    ],
    # OpenAI TTS 配置
    'openai_api_key': '',  # 需要設定 OpenAI API 金鑰
    'openai_model': 'tts-1-hd',  # 'tts-1' 或 'tts-1-hd' (高品質)
    'openai_voice': 'nova',  # 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
    'openai_speed': 1.0,  # 0.25 到 4.0
    
    # Nova 整合模式
    'nova_integrated_mode': True,  # 使用 Nova 整合播放當地問候+中文故事
    
    # 音質增強設定
    'audio_quality': 'high',
    'enable_audio_enhancement': False,  # 暫時關閉音質增強以避免格式問題
    'sample_rate_override': 22050,  # 提高採樣率
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
    'find_city': 'https://subjective-clock.vercel.app/api/find-city-geonames',
    'translate': 'https://subjective-clock.vercel.app/api/translate-location',
    'generate_story': 'https://subjective-clock.vercel.app/api/generatePiStory',  # 使用 Pi 專用的故事生成 API
    'save_record': 'https://subjective-clock.vercel.app/api/save-record'
}

# 使用者設定
USER_CONFIG = {
    'display_name': 'future',
    'identifier': 'future',
    'group_name': 'Pi',
    'device_type': 'raspberry_pi_dsi'
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
    'enabled': False,      # 禁用螢幕保護程式
    'timeout': 1800,      # 30分鐘無操作後進入螢幕保護 (如果啟用)
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

# TTS語音語言代碼對應
TTS_LANGUAGE_MAP = {
    'zh-TW': 'zh',     # 中文（繁體）
    'zh-CN': 'zh',     # 中文（簡體）
    'en': 'en',        # 英語
    'ja': 'ja',        # 日語
    'ko': 'ko',        # 韓語
    'es': 'es',        # 西班牙語
    'fr': 'fr',        # 法語
    'de': 'de',        # 德語
    'it': 'it',        # 義大利語
    'pt': 'pt',        # 葡萄牙語
    'ru': 'ru',        # 俄語
    'ar': 'ar',        # 阿拉伯語
    'th': 'th',        # 泰語
    'vi': 'vi',        # 越南語
    'hi': 'hi',        # 印地語
    'af': 'af',        # 南非語
    'sw': 'sw',        # 斯瓦希里語
    'yo': 'yo',        # 約魯巴語
    'ig': 'ig',        # 伊格博語
    'default': 'en'    # 預設英語
}

# 音頻文件管理
AUDIO_FILES = {
    'greeting_format': 'greeting_{language}_{timestamp}.wav',  # 問候語音頻文件格式
    'max_cache_size': 50,  # 最大快取文件數量
    'cache_timeout': 86400,  # 快取過期時間（秒，24小時）
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