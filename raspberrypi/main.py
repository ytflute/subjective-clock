#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import RPi.GPIO as GPIO
import time
import signal
import sys
import logging
from datetime import datetime
from threading import Timer
from config import BUTTON_PIN, BUTTON_DEBOUNCE_TIME, DISPLAY_DURATION, DEBUG_MODE

# 匯入自定義模組
from lcd_driver import LCD_ST7920
from audio_manager import AudioManager
from api_client import APIClient

# 設定日誌
if DEBUG_MODE:
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
else:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

logger = logging.getLogger(__name__)

class SubjectiveClockDevice:
    """甦醒地圖實體裝置主控類別"""
    
    def __init__(self):
        self.lcd = None
        self.audio = None
        self.api = None
        self.last_button_time = 0
        self.display_timer = None
        self.is_processing = False
        
        # 設定信號處理
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
    def initialize(self):
        """初始化所有組件"""
        try:
            logger.info("正在初始化甦醒地圖裝置...")
            
            # 初始化LCD
            self.lcd = LCD_ST7920()
            self.lcd.display_message([
                "Subjective Clock",
                "Initializing...",
                "",
                ""
            ])
            
            # 初始化 PAM8403 音頻管理器
            self.audio = AudioManager()
            logger.info("PAM8403 數位功率放大模組已就緒")
            
            # 初始化API客戶端
            self.api = APIClient()
            
            # 設定按鈕
            self.setup_button()
            
            # 顯示就緒
            self.lcd.display_message([
                "Subjective Clock",
                "Ready!",
                "",
                "Press button"
            ])
            
            logger.info("裝置初始化完成！")
            return True
            
        except Exception as e:
            logger.error(f"裝置初始化失敗: {e}")
            return False
    
    def setup_button(self):
        """設定按鈕GPIO"""
        GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.add_event_detect(
            BUTTON_PIN, 
            GPIO.FALLING, 
            callback=self.button_callback,
            bouncetime=BUTTON_DEBOUNCE_TIME
        )
    
    def button_callback(self, channel):
        """按鈕按下回呼函數"""
        try:
            current_time = time.time() * 1000
            
            if current_time - self.last_button_time < BUTTON_DEBOUNCE_TIME:
                return
            
            self.last_button_time = current_time
            
            if self.is_processing:
                return
            
            logger.info("按鈕被按下，開始新的一天...")
            self.start_new_day()
            
        except Exception as e:
            logger.error(f"按鈕回呼錯誤: {e}")
    
    def start_new_day(self):
        """開始新的一天 - 主要功能"""
        try:
            self.is_processing = True
            
            # 顯示載入訊息
            self.lcd.display_message([
                "Starting day...",
                "Finding city...",
                "",
                datetime.now().strftime("%H:%M:%S")
            ])
            
            # 獲取城市資訊
            city_info = self.api.get_complete_city_info()
            
            if not city_info:
                self.show_error("No city found")
                return
            
            # 顯示城市資訊
            self.display_city_info(city_info)
            
            # 播放問候語
            self.play_greeting(city_info)
            
            # 同步記錄到網站（背景執行）
            self._sync_user_record(city_info)
            
            # 設定顯示計時器
            self.set_display_timer()
            
        except Exception as e:
            logger.error(f"開始新的一天失敗: {e}")
            self.show_error("Error occurred")
        finally:
            self.is_processing = False
    
    def display_city_info(self, city_info):
        """在LCD上顯示城市資訊"""
        try:
            city_name = city_info.get('city_zh', city_info.get('city', 'Unknown'))
            country_name = city_info.get('country_zh', city_info.get('country', 'Unknown'))
            
            # 截短文字以適應LCD
            if len(city_name) > 16:
                city_name = city_name[:13] + "..."
            if len(country_name) > 16:
                country_name = country_name[:13] + "..."
            
            lines = [
                "Today's city:",
                city_name,
                country_name,
                datetime.now().strftime("%H:%M")
            ]
            
            self.lcd.display_message(lines)
            logger.info(f"顯示城市: {city_name}, {country_name}")
            
        except Exception as e:
            logger.error(f"顯示城市資訊失敗: {e}")
    
    def play_greeting(self, city_info):
        """播放問候語"""
        try:
            city = city_info.get('city', 'Unknown')
            country = city_info.get('country', 'Unknown')
            country_code = city_info.get('country_code', 'US')
            
            self.audio.speak_greeting(city, country, country_code)
                
        except Exception as e:
            logger.error(f"播放問候語失敗: {e}")
    
    def _sync_user_record(self, city_info):
        """同步使用者記錄到網站（背景執行）"""
        try:
            import threading
            
            def sync_record():
                try:
                    success = self.api.save_user_record(city_info)
                    if success:
                        logger.info("✅ 記錄已成功同步到甦醒地圖網站")
                    else:
                        logger.warning("⚠️ 記錄同步失敗，但裝置繼續正常運作")
                except Exception as e:
                    logger.error(f"同步記錄時發生錯誤: {e}")
            
            # 在背景執行緒中同步記錄
            sync_thread = threading.Thread(target=sync_record, daemon=True)
            sync_thread.start()
            
        except Exception as e:
            logger.error(f"無法啟動記錄同步: {e}")
    
    def show_error(self, error_msg):
        """顯示錯誤訊息"""
        try:
            self.lcd.display_message([
                "Error",
                error_msg,
                "",
                "Try again"
            ])
            
            Timer(3.0, self.show_ready_message).start()
            
        except Exception as e:
            logger.error(f"顯示錯誤失敗: {e}")
    
    def show_ready_message(self):
        """顯示就緒訊息"""
        try:
            self.lcd.display_message([
                "Subjective Clock",
                "Ready!",
                "",
                "Press button"
            ])
        except Exception as e:
            logger.error(f"顯示就緒訊息失敗: {e}")
    
    def set_display_timer(self):
        """設定顯示計時器"""
        if self.display_timer:
            self.display_timer.cancel()
        
        self.display_timer = Timer(DISPLAY_DURATION, self.show_ready_message)
        self.display_timer.start()
    
    def run(self):
        """主運行迴圈"""
        try:
            logger.info("甦醒地圖裝置開始運行...")
            
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("收到中斷信號，正在關閉裝置...")
        finally:
            self.cleanup()
    
    def signal_handler(self, signum, frame):
        """信號處理程序"""
        logger.info(f"收到信號 {signum}，正在清理...")
        self.cleanup()
        sys.exit(0)
    
    def cleanup(self):
        """清理所有資源"""
        try:
            logger.info("正在清理裝置資源...")
            
            if self.display_timer:
                self.display_timer.cancel()
            
            if self.lcd:
                self.lcd.display_message([
                    "Shutting down...",
                    "",
                    "",
                    ""
                ])
                time.sleep(1)
                self.lcd.cleanup()
            
            if self.audio:
                self.audio.cleanup()
            
            if self.api:
                self.api.cleanup()
            
            GPIO.cleanup()
            
            logger.info("裝置清理完成")
            
        except Exception as e:
            logger.error(f"清理失敗: {e}")

def main():
    """主函數"""
    print("甦醒地圖實體裝置啟動中...")
    
    device = SubjectiveClockDevice()
    
    if not device.initialize():
        print("裝置初始化失敗")
        sys.exit(1)
    
    device.run()

if __name__ == "__main__":
    main() 