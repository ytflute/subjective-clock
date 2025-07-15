#!/usr/bin/env python3
"""
甦醒地圖實體裝置主程式 (網頁版)
透過按鈕觸發 Selenium 自動化控制瀏覽器開啟甦醒地圖
"""

import RPi.GPIO as GPIO
import time
import signal
import sys
import logging
from datetime import datetime
from threading import Timer

# 配置常數
BUTTON_PIN = 18
BUTTON_DEBOUNCE_TIME = 500  # ms
DEBUG_MODE = False

# 匯入自定義模組
from lcd_driver import LCD_ST7920
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
        self.web_controller = None
        self.last_button_time = 0
        self.display_timer = None
        self.is_processing = False
        self.browser_initialized = False
        
        # 設定信號處理
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
    def initialize(self):
        """初始化所有組件"""
        try:
            logger.info("正在初始化甦醒地圖裝置（網頁版）...")
            
            # 初始化 GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # 初始化LCD
            self.lcd = LCD_ST7920()
            self.lcd.display_message("Subjective Clock", "Web Mode", "Initializing...", "")
            
            # 初始化網頁控制器
            self.web_controller = WebController(lcd_display=self.lcd)
            
            # 設定按鈕
            self.setup_button()
            
            # 顯示就緒
            self.lcd.display_message("Subjective Clock", "Web Mode Ready!", "", "Press button")
            
            logger.info("裝置初始化完成！")
            return True
            
        except Exception as e:
            logger.error(f"裝置初始化失敗: {e}")
            if self.lcd:
                self.lcd.display_message("Init Failed", str(e)[:16], "", "Check setup")
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
            self.lcd.display_message("Processing...", "", "Starting browser", "Please wait")
            
            logger.info("開始甦醒地圖網頁自動化序列...")
            
            # 執行完整的自動化序列
            success = self.web_controller.run_full_sequence()
            
            if success:
                # 顯示成功訊息
                self.lcd.display_message("Success!", "Wake Up Map", "is running", "Check browser")
                logger.info("✅ 甦醒序列執行成功")
                self.browser_initialized = True
            else:
                # 顯示失敗訊息
                self.show_error("Automation failed")
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
            self.lcd.display_message("Error", error_msg, "", "Try again")
            
            # 3秒後回到就緒狀態
            Timer(3.0, self.show_ready_message).start()
            
        except Exception as e:
            logger.error(f"顯示錯誤失敗: {e}")
    
    def show_ready_message(self):
        """顯示就緒訊息"""
        try:
            if self.browser_initialized:
                self.lcd.display_message("Subjective Clock", "Browser Ready", "", "Press for new day")
            else:
                self.lcd.display_message("Subjective Clock", "Web Mode Ready", "", "Press button")
        except Exception as e:
            logger.error(f"顯示就緒訊息失敗: {e}")
    
    def set_display_timer(self):
        """設定顯示計時器"""
        if self.display_timer:
            self.display_timer.cancel()
        
        # 15秒後回到就緒狀態，讓使用者有時間查看瀏覽器
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
                self.lcd.display_message("Shutting down", "", "Goodbye!", "")
                time.sleep(2)
            
            # 清理網頁控制器
            if self.web_controller:
                self.web_controller.close_browser()
            
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
    print("請確保已連接 LCD 螢幕和按鈕到 GPIO 18")
    print("網站: https://subjective-clock.vercel.app/")
    
    device = SubjectiveClockWebDevice()
    
    if not device.initialize():
        print("裝置初始化失敗")
        sys.exit(1)
    
    print("裝置已就緒！按下按鈕開始甦醒地圖...")
    device.run()

if __name__ == "__main__":
    main() 