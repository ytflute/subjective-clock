#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import RPi.GPIO as GPIO
import time
import signal
import sys
import logging
from datetime import datetime
from threading import Timer
from config import BUTTON_PIN, BUTTON_DEBOUNCE_TIME, DEBUG_MODE

# 匯入自定義模組
from lcd_driver import LCD_ST7920
from audio_manager import AudioManager
from web_controller import WebController

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

class SubjectiveClockWebDevice:
    """甦醒地圖實體裝置主控類別 (網頁版)"""
    
    def __init__(self):
        self.lcd = None
        self.audio = None
        self.web_controller = None
        self.last_button_time = 0
        self.display_timer = None
        self.is_processing = False
        self.browser_open = False
        
        # 設定信號處理
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
    def initialize(self):
        """初始化所有組件"""
        try:
            logger.info("正在初始化甦醒地圖裝置（網頁版）...")
            
            # 初始化LCD
            self.lcd = LCD_ST7920()
            self.lcd.display_message([
                "Subjective Clock",
                "Web Mode",
                "Initializing...",
                ""
            ])
            
            # 初始化音頻管理器（可選）
            try:
                self.audio = AudioManager()
                logger.info("音頻管理器已就緒")
            except Exception as e:
                logger.warning(f"音頻初始化失敗: {e}")
                self.audio = None
            
            # 初始化網頁控制器
            self.web_controller = WebController()
            
            # 設定按鈕
            self.setup_button()
            
            # 顯示就緒
            self.lcd.display_message([
                "Subjective Clock",
                "Web Mode Ready!",
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
        logger.info(f"按鈕設定完成 (GPIO {BUTTON_PIN})")
    
    def button_callback(self, channel):
        """按鈕按下回呼函數"""
        current_time = time.time()
        
        # 防彈跳檢查
        if current_time - self.last_button_time < (BUTTON_DEBOUNCE_TIME / 1000.0):
            return
            
        self.last_button_time = current_time
        
        if self.is_processing:
            logger.info("正在處理中，忽略按鈕...")
            return
        
        logger.info("按鈕被按下！開始新的一天...")
        self.start_new_day()
    
    def start_new_day(self):
        """開始新的一天"""
        self.is_processing = True
        
        try:
            # 取消之前的顯示計時器
            if self.display_timer:
                self.display_timer.cancel()
            
            # 顯示處理中訊息
            self.lcd.display_message([
                "Processing...",
                "",
                "Opening website",
                "Please wait"
            ])
            
            # 如果瀏覽器沒開啟，先開啟
            if not self.browser_open or not self.web_controller.is_browser_alive():
                logger.info("開啟甦醒地圖網站...")
                
                # 顯示載入訊息
                self.lcd.display_message([
                    "Loading website",
                    "",
                    "Please wait...",
                    ""
                ])
                
                # 開啟網站並設定使用者
                if self.web_controller.open_website():
                    if self.web_controller.setup_user_info():
                        self.browser_open = True
                        logger.info("網站載入完成")
                    else:
                        self.show_error("User setup failed")
                        return
                else:
                    self.show_error("Website failed")
                    return
            
            # 顯示觸發訊息
            self.lcd.display_message([
                "Triggering",
                "Wake Up...",
                "",
                datetime.now().strftime("%H:%M:%S")
            ])
            
            # 觸發甦醒
            if self.web_controller.trigger_wake_up():
                # 顯示成功訊息
                self.lcd.display_message([
                    "Wake Up",
                    "Triggered!",
                    "",
                    "Check browser"
                ])
                
                # 播放提示音（如果有音頻）
                if self.audio:
                    try:
                        self.audio.play_notification_sound()
                    except:
                        pass
                
                logger.info("✅ 甦醒序列執行成功")
            else:
                self.show_error("Trigger failed")
                return
            
            # 設定自動返回就緒狀態的計時器
            self.set_display_timer()
            
        except Exception as e:
            logger.error(f"開始新的一天失敗: {e}")
            self.show_error("Error occurred")
        finally:
            self.is_processing = False
    
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
            mode_text = "Web Mode Ready!" if self.browser_open else "Web Mode Ready!"
            self.lcd.display_message([
                "Subjective Clock",
                mode_text,
                "",
                "Press button"
            ])
        except Exception as e:
            logger.error(f"顯示就緒訊息失敗: {e}")
    
    def set_display_timer(self):
        """設定顯示計時器"""
        if self.display_timer:
            self.display_timer.cancel()
        
        # 較長的顯示時間，讓使用者可以查看瀏覽器結果
        self.display_timer = Timer(15.0, self.show_ready_message)
        self.display_timer.start()
    
    def signal_handler(self, sig, frame):
        """處理系統信號"""
        logger.info("收到終止信號，正在清理...")
        self.cleanup()
        sys.exit(0)
    
    def cleanup(self):
        """清理資源"""
        try:
            # 取消計時器
            if self.display_timer:
                self.display_timer.cancel()
            
            # 清理 LCD
            if self.lcd:
                self.lcd.display_message([
                    "Shutting down",
                    "",
                    "Goodbye!",
                    ""
                ])
                time.sleep(1)
            
            # 清理網頁控制器
            if self.web_controller:
                self.web_controller.cleanup()
            
            # 清理 GPIO
            GPIO.cleanup()
            
            logger.info("清理完成")
            
        except Exception as e:
            logger.error(f"清理失敗: {e}")
    
    def run(self):
        """主運行迴圈"""
        logger.info("甦醒地圖裝置開始運行（網頁模式）")
        logger.info("按 Ctrl+C 停止...")
        
        try:
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("收到鍵盤中斷")
        finally:
            self.cleanup()

def main():
    """主函數"""
    print("甦醒地圖實體裝置啟動中（網頁模式）...")
    
    device = SubjectiveClockWebDevice()
    
    if not device.initialize():
        print("裝置初始化失敗")
        sys.exit(1)
    
    device.run()

if __name__ == "__main__":
    main() 