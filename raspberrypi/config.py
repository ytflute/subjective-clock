# Raspberry Pi 硬體配置
import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# LCD ST7920 (12864B-V2.3) 連接設定 (並行模式)
LCD_PINS = {
    'RS': 26,     # Register Select (A0)
    'E': 19,      # Enable
    'D4': 13,     # Data 4
    'D5': 6,      # Data 5
    'D6': 5,      # Data 6
    'D7': 11,     # Data 7
    'PSB': 21,    # Parallel/Serial Bus select (設為 HIGH 使用並行模式)
    'RST': 20     # Reset
}

# 12864B-V2.3 特殊連接說明：
# R/W 針腳 → GND (設定為寫入模式，我們不需要讀取LCD)
# BLA (背光正極) → 5V 或 3.3V (通過限流電阻，可選)
# BLK (背光負極) → GND (可選)

# 按鈕連接設定
BUTTON_PIN = 18
BUTTON_DEBOUNCE_TIME = 300  # 防彈跳時間 (毫秒)

# 聲音模組設定
AUDIO_OUTPUT = 'analog'  # 'analog' 或 'hdmi'

# API 端點設定
BASE_URL = os.getenv('BASE_URL', 'https://subjective-clock02.vercel.app')
API_ENDPOINTS = {
    'find_city': f'{BASE_URL}/api/find-city-geonames',
    'translate': f'{BASE_URL}/api/translate-location'
}

# 顯示設定
DISPLAY_DURATION = 10  # 結果顯示時間 (秒)

# 調試模式
DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() == 'true' 