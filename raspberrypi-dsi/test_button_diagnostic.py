#!/usr/bin/env python3
"""
按鈕診斷測試腳本
用於檢查 GPIO 按鈕是否正常運作
"""

import sys
import time
import signal
import logging
from config import BUTTON_CONFIG, LED_CONFIG

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_gpio_basic():
    """基本 GPIO 測試"""
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        button_pin = BUTTON_CONFIG['pin']
        
        # 設定按鈕針腳
        if BUTTON_CONFIG['pull_up']:
            GPIO.setup(button_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        else:
            GPIO.setup(button_pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        
        print(f"✅ GPIO 設定成功")
        print(f"📍 按鈕針腳: GPIO {button_pin}")
        print(f"⬆️  上拉電阻: {'啟用' if BUTTON_CONFIG['pull_up'] else '停用'}")
        
        # 檢查初始狀態
        initial_state = GPIO.input(button_pin)
        print(f"🔍 初始狀態: {initial_state} ({'HIGH' if initial_state else 'LOW'})")
        
        return True
        
    except Exception as e:
        print(f"❌ GPIO 測試失敗: {e}")
        return False

def test_button_handler():
    """測試按鈕處理器"""
    try:
        # 嘗試導入按鈕處理器
        try:
            from button_handler_pigpio import ButtonHandlerPigpio as ButtonHandler
            handler_type = "pigpiod"
        except ImportError:
            from button_handler import ButtonHandler
            handler_type = "RPi.GPIO"
        
        print(f"📦 使用按鈕處理器: {handler_type}")
        
        # 創建按鈕處理器
        button_handler = ButtonHandler(
            button_pin=BUTTON_CONFIG['pin'],
            button_press_callback=lambda: print("🔘 按鈕按下回調觸發"),
            button_release_callback=lambda: print("🔴 按鈕釋放回調觸發"),
            pull_up=BUTTON_CONFIG.get('pull_up', True),
            bounce_time=BUTTON_CONFIG.get('bounce_time', 200)
        )
        
        print(f"✅ 按鈕處理器創建成功")
        return button_handler
        
    except Exception as e:
        print(f"❌ 按鈕處理器測試失敗: {e}")
        return None

def test_web_controller():
    """測試網頁控制器"""
    try:
        from web_controller_dsi import WebControllerDSI
        
        print("🌐 測試網頁控制器...")
        controller = WebControllerDSI()
        
        print("✅ 網頁控制器創建成功")
        return controller
        
    except Exception as e:
        print(f"❌ 網頁控制器測試失敗: {e}")
        return None

def main():
    """主函數"""
    print("🔧 甦醒地圖按鈕診斷測試")
    print("=" * 50)
    
    # 1. 基本 GPIO 測試
    print("\n1️⃣ 基本 GPIO 測試")
    if not test_gpio_basic():
        print("❌ 基本 GPIO 測試失敗，請檢查硬體連接")
        return
    
    # 2. 按鈕處理器測試
    print("\n2️⃣ 按鈕處理器測試")
    button_handler = test_button_handler()
    if not button_handler:
        print("❌ 按鈕處理器測試失敗")
        return
    
    # 3. 網頁控制器測試
    print("\n3️⃣ 網頁控制器測試")
    web_controller = test_web_controller()
    if not web_controller:
        print("❌ 網頁控制器測試失敗")
    
    # 4. 整合測試
    print("\n4️⃣ 整合測試")
    print("請按下按鈕進行測試...")
    print("短按：應該觸發開始這一天")
    print("長按：應該重新載入網頁")
    print("按 Ctrl+C 退出測試")
    
    def signal_handler(sig, frame):
        print("\n🛑 測試中斷")
        if button_handler and hasattr(button_handler, 'stop'):
            button_handler.stop()
        if web_controller:
            web_controller.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    def test_short_press():
        print("🟢 短按檢測到！")
        if web_controller:
            try:
                result = web_controller.click_start_button()
                print(f"📤 開始按鈕結果: {result}")
            except Exception as e:
                print(f"❌ 開始按鈕失敗: {e}")
    
    def test_long_press():
        print("🔵 長按檢測到！")
        if web_controller:
            try:
                result = web_controller.reload_website()
                print(f"🔄 重載網頁結果: {result}")
            except Exception as e:
                print(f"❌ 重載網頁失敗: {e}")
    
    # 註冊回調函數
    if hasattr(button_handler, 'register_callbacks'):
        button_handler.register_callbacks(test_short_press, test_long_press)
    elif hasattr(button_handler, 'button_press_callback'):
        button_handler.button_press_callback = test_short_press
        button_handler.button_release_callback = test_long_press
    
    # 啟動按鈕處理器
    if hasattr(button_handler, 'start'):
        button_handler.start()
        print("✅ 按鈕處理器已啟動")
    
    # 如果有網頁控制器，初始化瀏覽器
    if web_controller:
        try:
            if web_controller.start_browser():
                print("✅ 瀏覽器啟動成功")
                if web_controller.load_website():
                    print("✅ 網站載入成功")
                else:
                    print("⚠️ 網站載入失敗")
            else:
                print("⚠️ 瀏覽器啟動失敗")
        except Exception as e:
            print(f"⚠️ 瀏覽器初始化錯誤: {e}")
    
    try:
        # 持續運行，等待按鈕事件
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        print("\n🧹 清理資源...")
        if button_handler and hasattr(button_handler, 'stop'):
            button_handler.stop()
        if web_controller:
            web_controller.stop()

if __name__ == "__main__":
    main() 