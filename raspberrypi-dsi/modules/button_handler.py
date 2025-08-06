"""
按鈕處理模組
處理GPIO按鈕事件，包括短按和長按
"""

import asyncio
import time
from typing import Callable, Optional

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

from utils.logger import LoggerMixin

class ButtonHandler(LoggerMixin):
    """按鈕處理器"""
    
    def __init__(self, config_manager, callback: Callable):
        self.config = config_manager
        self.callback = callback
        self.button_config = config_manager.get_button_config()
        
        self.pin = self.button_config.get('pin', 18)
        self.bounce_time = self.button_config.get('bounce_time', 300)
        self.long_press_time = self.button_config.get('long_press_time', 2.0)
        
        self.press_start_time = None
        self.is_long_press = False
        self.initialized = False
    
    async def initialize(self):
        """初始化GPIO設定"""
        try:
            if not GPIO_AVAILABLE:
                self.logger.warning("⚠️ RPi.GPIO 不可用，使用模擬模式")
                self.initialized = True
                return True
            
            # 設定GPIO模式
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # 設定按鈕針腳
            GPIO.setup(self.pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            
            # 設定事件檢測
            GPIO.add_event_detect(
                self.pin, 
                GPIO.BOTH, 
                callback=self._gpio_callback, 
                bouncetime=self.bounce_time
            )
            
            self.logger.info(f"✅ 按鈕處理器初始化完成 (GPIO {self.pin})")
            self.initialized = True
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 按鈕處理器初始化失敗: {e}")
            return False
    
    def _gpio_callback(self, channel):
        """GPIO中斷回調"""
        try:
            state = GPIO.input(channel)
            current_time = time.time()
            
            if state == GPIO.LOW:  # 按下
                self.press_start_time = current_time
                self.is_long_press = False
                self.logger.debug("🔘 按鈕按下")
                
            elif state == GPIO.HIGH and self.press_start_time:  # 放開
                press_duration = current_time - self.press_start_time
                
                if press_duration >= self.long_press_time:
                    press_type = "long"
                    self.logger.info(f"🔘 長按檢測 ({press_duration:.1f}s)")
                else:
                    press_type = "short"
                    self.logger.info(f"🔘 短按檢測 ({press_duration:.1f}s)")
                
                # 異步調用回調函數
                asyncio.create_task(self.callback(press_type))
                self.press_start_time = None
                
        except Exception as e:
            self.logger.error(f"❌ 按鈕事件處理錯誤: {e}")
    
    async def simulate_button_press(self, press_type: str = "short"):
        """模擬按鈕按下（用於測試）"""
        self.logger.info(f"🔘 模擬按鈕按下 ({press_type})")
        await self.callback(press_type)
    
    def is_ready(self) -> bool:
        """檢查按鈕處理器是否就緒"""
        return self.initialized
    
    async def cleanup(self):
        """清理GPIO資源"""
        try:
            if GPIO_AVAILABLE and self.initialized:
                GPIO.cleanup(self.pin)
                self.logger.info("✅ GPIO資源清理完成")
            self.initialized = False
        except Exception as e:
            self.logger.error(f"❌ GPIO清理失敗: {e}")

class MockButtonHandler(ButtonHandler):
    """模擬按鈕處理器（用於開發和測試）"""
    
    async def initialize(self):
        """模擬初始化"""
        self.logger.info("✅ 模擬按鈕處理器初始化完成")
        self.initialized = True
        
        # 啟動模擬按鈕任務
        asyncio.create_task(self._simulate_periodic_press())
        return True
    
    async def _simulate_periodic_press(self):
        """定期模擬按鈕按下（用於測試）"""
        await asyncio.sleep(5)  # 5秒後開始
        
        while self.initialized:
            await asyncio.sleep(10)  # 每10秒模擬一次按下
            if self.initialized:
                await self.simulate_button_press("short")
    
    async def cleanup(self):
        """模擬清理"""
        self.logger.info("✅ 模擬按鈕處理器清理完成")
        self.initialized = False