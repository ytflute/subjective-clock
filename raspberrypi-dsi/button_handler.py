#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - GPIO按鈕處理模組
"""

import RPi.GPIO as GPIO
import time
import threading
import logging
from typing import Callable, Optional
from config import BUTTON_CONFIG, LED_CONFIG

logger = logging.getLogger(__name__)

class ButtonHandler:
    """GPIO按鈕處理器"""
    
    def __init__(self):
        self.button_pin = BUTTON_CONFIG['pin']
        self.led_pin = LED_CONFIG['pin'] if LED_CONFIG['enabled'] else None
        self.bounce_time = BUTTON_CONFIG['bounce_time']
        self.long_press_time = BUTTON_CONFIG['long_press_time']
        
        # 回調函數
        self.on_short_press: Optional[Callable] = None
        self.on_long_press: Optional[Callable] = None
        
        # 按鈕狀態
        self.last_press_time = 0
        self.press_start_time = 0
        self.is_pressed = False
        self.long_press_triggered = False
        
        # LED狀態
        self.led_state = False
        self.led_blink_thread = None
        self.led_stop_event = threading.Event()
        
        # 初始化GPIO
        self._setup_gpio()
        
    def _setup_gpio(self):
        """初始化GPIO設定"""
        try:
            # 設定GPIO模式
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # 設定按鈕針腳
            if BUTTON_CONFIG['pull_up']:
                GPIO.setup(self.button_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            else:
                GPIO.setup(self.button_pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
            
            # 設定LED針腳
            if self.led_pin:
                GPIO.setup(self.led_pin, GPIO.OUT)
                GPIO.output(self.led_pin, GPIO.LOW)
            
            # 設定按鈕事件檢測
            if BUTTON_CONFIG['pull_up']:
                # 上拉電阻：按下時為LOW
                GPIO.add_event_detect(
                    self.button_pin, 
                    GPIO.FALLING, 
                    callback=self._button_pressed_callback,
                    bouncetime=self.bounce_time
                )
                GPIO.add_event_detect(
                    self.button_pin, 
                    GPIO.RISING, 
                    callback=self._button_released_callback,
                    bouncetime=self.bounce_time
                )
            else:
                # 下拉電阻：按下時為HIGH
                GPIO.add_event_detect(
                    self.button_pin, 
                    GPIO.RISING, 
                    callback=self._button_pressed_callback,
                    bouncetime=self.bounce_time
                )
                GPIO.add_event_detect(
                    self.button_pin, 
                    GPIO.FALLING, 
                    callback=self._button_released_callback,
                    bouncetime=self.bounce_time
                )
            
            logger.info(f"GPIO初始化成功 - 按鈕針腳: {self.button_pin}, LED針腳: {self.led_pin}")
            
        except Exception as e:
            logger.error(f"GPIO初始化失敗: {e}")
            raise
    
    def _button_pressed_callback(self, channel):
        """按鈕按下回調"""
        current_time = time.time()
        
        # 防止重複觸發
        if current_time - self.last_press_time < (self.bounce_time / 1000):
            return
        
        self.press_start_time = current_time
        self.is_pressed = True
        self.long_press_triggered = False
        
        logger.debug("按鈕按下")
        
        # 開始LED閃爍（如果啟用）
        if self.led_pin and LED_CONFIG.get('blink_on_activity', False):
            self._start_led_blink()
    
    def _button_released_callback(self, channel):
        """按鈕釋放回調"""
        if not self.is_pressed:
            return
            
        current_time = time.time()
        press_duration = current_time - self.press_start_time
        
        self.is_pressed = False
        self.last_press_time = current_time
        
        # 停止LED閃爍
        self._stop_led_blink()
        
        logger.debug(f"按鈕釋放，按壓時長: {press_duration:.2f}秒")
        
        # 判斷是短按還是長按
        if press_duration >= self.long_press_time:
            if not self.long_press_triggered:
                self.long_press_triggered = True
                self._trigger_long_press()
        else:
            self._trigger_short_press()
    
    def _trigger_short_press(self):
        """觸發短按事件"""
        logger.info("檢測到短按")
        
        # LED快閃一次
        if self.led_pin:
            self._led_flash(times=1, duration=0.1)
        
        # 執行短按回調
        if self.on_short_press:
            try:
                self.on_short_press()
            except Exception as e:
                logger.error(f"短按回調執行失敗: {e}")
    
    def _trigger_long_press(self):
        """觸發長按事件"""
        logger.info("檢測到長按")
        
        # LED快閃三次
        if self.led_pin:
            self._led_flash(times=3, duration=0.2)
        
        # 執行長按回調
        if self.on_long_press:
            try:
                self.on_long_press()
            except Exception as e:
                logger.error(f"長按回調執行失敗: {e}")
    
    def _start_led_blink(self):
        """開始LED閃爍"""
        if not self.led_pin:
            return
            
        self._stop_led_blink()  # 先停止之前的閃爍
        
        self.led_stop_event.clear()
        self.led_blink_thread = threading.Thread(target=self._led_blink_loop)
        self.led_blink_thread.daemon = True
        self.led_blink_thread.start()
    
    def _stop_led_blink(self):
        """停止LED閃爍"""
        if not self.led_pin:
            return
            
        self.led_stop_event.set()
        if self.led_blink_thread and self.led_blink_thread.is_alive():
            self.led_blink_thread.join(timeout=1)
        
        # 關閉LED
        GPIO.output(self.led_pin, GPIO.LOW)
        self.led_state = False
    
    def _led_blink_loop(self):
        """LED閃爍循環"""
        while not self.led_stop_event.is_set():
            GPIO.output(self.led_pin, GPIO.HIGH)
            time.sleep(0.1)
            if self.led_stop_event.is_set():
                break
            GPIO.output(self.led_pin, GPIO.LOW)
            time.sleep(0.1)
    
    def _led_flash(self, times: int = 1, duration: float = 0.1):
        """LED閃爍指定次數"""
        if not self.led_pin:
            return
            
        def flash():
            for _ in range(times):
                GPIO.output(self.led_pin, GPIO.HIGH)
                time.sleep(duration)
                GPIO.output(self.led_pin, GPIO.LOW)
                if _ < times - 1:  # 最後一次不延遲
                    time.sleep(duration)
        
        flash_thread = threading.Thread(target=flash)
        flash_thread.daemon = True
        flash_thread.start()
    
    def set_led(self, state: bool):
        """設定LED狀態"""
        if not self.led_pin:
            return
            
        GPIO.output(self.led_pin, GPIO.HIGH if state else GPIO.LOW)
        self.led_state = state
        logger.debug(f"LED設定為: {'開' if state else '關'}")
    
    def is_button_pressed(self) -> bool:
        """檢查按鈕當前是否被按下"""
        if BUTTON_CONFIG['pull_up']:
            return GPIO.input(self.button_pin) == GPIO.LOW
        else:
            return GPIO.input(self.button_pin) == GPIO.HIGH
    
    def register_callbacks(self, short_press_callback: Callable = None, 
                          long_press_callback: Callable = None):
        """註冊按鈕事件回調函數"""
        self.on_short_press = short_press_callback
        self.on_long_press = long_press_callback
        
        logger.info("按鈕回調函數已註冊")
    
    def cleanup(self):
        """清理GPIO資源"""
        try:
            self._stop_led_blink()
            GPIO.remove_event_detect(self.button_pin)
            GPIO.cleanup()
            logger.info("GPIO資源已清理")
        except Exception as e:
            logger.error(f"GPIO清理失敗: {e}")

# 測試程式
if __name__ == "__main__":
    import signal
    import sys
    
    # 設定日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    def test_short_press():
        print("短按檢測！")
    
    def test_long_press():
        print("長按檢測！")
    
    def signal_handler(sig, frame):
        print("\n正在退出...")
        button_handler.cleanup()
        sys.exit(0)
    
    # 創建按鈕處理器
    button_handler = ButtonHandler()
    button_handler.register_callbacks(test_short_press, test_long_press)
    
    # 註冊信號處理器
    signal.signal(signal.SIGINT, signal_handler)
    
    print("按鈕測試程式啟動")
    print("短按: 觸發短按事件")
    print("長按: 觸發長按事件")
    print("按 Ctrl+C 退出")
    
    try:
        # 保持程式運行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        button_handler.cleanup() 