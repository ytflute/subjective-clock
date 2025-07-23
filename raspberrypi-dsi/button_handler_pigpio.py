#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - GPIO按鈕處理模組 (pigpiod版本)
使用 pigpiod 來解決 RPi.GPIO 邊緣檢測問題
"""

import pigpio
import time
import threading
import logging
from typing import Callable, Optional
from config import BUTTON_CONFIG, LED_CONFIG

logger = logging.getLogger(__name__)

class ButtonHandlerPigpio:
    """GPIO按鈕處理器 (使用 pigpiod)"""
    
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
        
        # pigpio 連接
        self.pi = None
        
        # 初始化pigpio
        self._setup_pigpio()
        
    def _setup_pigpio(self):
        """初始化pigpio連接和GPIO設定"""
        try:
            # 連接到 pigpiod
            self.pi = pigpio.pi()
            if not self.pi.connected:
                raise Exception("無法連接到 pigpiod，請確保 pigpiod 服務正在運行")
            
            logger.info("成功連接到 pigpiod")
            
            # 設定按鈕針腳
            self.pi.set_mode(self.button_pin, pigpio.INPUT)
            if BUTTON_CONFIG['pull_up']:
                self.pi.set_pull_up_down(self.button_pin, pigpio.PUD_UP)
            else:
                self.pi.set_pull_up_down(self.button_pin, pigpio.PUD_DOWN)
            
            # 設定LED針腳
            if self.led_pin:
                self.pi.set_mode(self.led_pin, pigpio.OUTPUT)
                self.pi.write(self.led_pin, 0)
            
            # 設定按鈕邊緣檢測
            if BUTTON_CONFIG['pull_up']:
                # 上拉電阻：檢測下降邊緣（按下）和上升邊緣（釋放）
                self.pi.callback(self.button_pin, pigpio.EITHER_EDGE, self._button_edge_callback)
            else:
                # 下拉電阻：檢測上升邊緣（按下）和下降邊緣（釋放）
                self.pi.callback(self.button_pin, pigpio.EITHER_EDGE, self._button_edge_callback)
            
            logger.info("pigpio GPIO設定完成")
            
        except Exception as e:
            logger.error(f"pigpio初始化失敗: {e}")
            if self.pi:
                self.pi.stop()
                self.pi = None
            raise
    
    def _button_edge_callback(self, gpio, level, tick):
        """統一的邊緣檢測回調 - pigpio版本"""
        try:
            if BUTTON_CONFIG['pull_up']:
                # 上拉電阻：LOW = 按下，HIGH = 釋放
                if level == 0:  # 按下
                    self._button_pressed_callback(gpio)
                else:  # 釋放
                    self._button_released_callback(gpio)
            else:
                # 下拉電阻：HIGH = 按下，LOW = 釋放
                if level == 1:  # 按下
                    self._button_pressed_callback(gpio)
                else:  # 釋放
                    self._button_released_callback(gpio)
                    
        except Exception as e:
            logger.error(f"按鈕回調錯誤: {e}")
    
    def _button_pressed_callback(self, gpio):
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
    
    def _button_released_callback(self, gpio):
        """按鈕釋放回調"""
        if not self.is_pressed:
            return
            
        current_time = time.time()
        press_duration = current_time - self.press_start_time
        
        self.is_pressed = False
        
        # 停止LED閃爍
        self._stop_led_blink()
        
        logger.debug(f"按鈕釋放，按壓時長: {press_duration:.2f}秒")
        
        # 檢查最小按壓間隔，防止重複觸發
        min_interval = BUTTON_CONFIG.get('min_press_interval', 1.0)
        if current_time - self.last_press_time < min_interval:
            logger.debug(f"按壓間隔過短 ({current_time - self.last_press_time:.2f}s < {min_interval}s)，忽略此次按壓")
            return
        
        self.last_press_time = current_time
        
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
        if not self.led_pin or not self.pi:
            return
            
        self._stop_led_blink()
        self.led_stop_event.clear()
        
        def blink_loop():
            while not self.led_stop_event.is_set():
                self.pi.write(self.led_pin, 1)
                if self.led_stop_event.wait(0.5):
                    break
                self.pi.write(self.led_pin, 0)
                if self.led_stop_event.wait(0.5):
                    break
        
        self.led_blink_thread = threading.Thread(target=blink_loop, daemon=True)
        self.led_blink_thread.start()
    
    def _stop_led_blink(self):
        """停止LED閃爍"""
        if self.led_blink_thread:
            self.led_stop_event.set()
            self.led_blink_thread.join(timeout=1)
            self.led_blink_thread = None
        
        if self.led_pin and self.pi:
            self.pi.write(self.led_pin, 0)
    
    def _led_flash(self, times=1, duration=0.1):
        """LED快閃"""
        if not self.led_pin or not self.pi:
            return
        
        def flash_loop():
            for _ in range(times):
                self.pi.write(self.led_pin, 1)
                time.sleep(duration)
                self.pi.write(self.led_pin, 0)
                time.sleep(duration)
        
        flash_thread = threading.Thread(target=flash_loop, daemon=True)
        flash_thread.start()
    
    def set_led(self, state: bool):
        """設定LED狀態"""
        if self.led_pin and self.pi:
            self.pi.write(self.led_pin, 1 if state else 0)
            self.led_state = state
    
    def register_callbacks(self, short_press_callback: Callable = None, long_press_callback: Callable = None):
        """註冊按鈕事件回調函數"""
        self.on_short_press = short_press_callback
        self.on_long_press = long_press_callback
        logger.info("按鈕事件回調已註冊")
    
    def cleanup(self):
        """清理資源"""
        try:
            logger.info("清理按鈕處理器...")
            
            # 停止LED閃爍
            self._stop_led_blink()
            
            # 關閉pigpio連接
            if self.pi:
                if self.led_pin:
                    self.pi.write(self.led_pin, 0)
                self.pi.stop()
                self.pi = None
            
            logger.info("按鈕處理器清理完成")
            
        except Exception as e:
            logger.error(f"清理按鈕處理器時發生錯誤: {e}")

# 為了向後兼容，提供一個別名
ButtonHandler = ButtonHandlerPigpio

if __name__ == "__main__":
    # 測試程式
    import signal
    import sys
    
    def signal_handler(sig, frame):
        print("\n正在退出...")
        if 'button_handler' in locals():
            button_handler.cleanup()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # 設定日誌
    logging.basicConfig(level=logging.INFO)
    
    try:
        print("測試 pigpio 按鈕處理器...")
        button_handler = ButtonHandlerPigpio()
        
        def on_short_press():
            print("🔵 短按檢測到！")
        
        def on_long_press():
            print("🔴 長按檢測到！")
        
        button_handler.register_callbacks(on_short_press, on_long_press)
        
        print("按鈕測試開始，按 Ctrl+C 結束...")
        print("請試試短按和長按按鈕...")
        
        while True:
            time.sleep(0.1)
            
    except Exception as e:
        print(f"錯誤: {e}")
    finally:
        if 'button_handler' in locals():
            button_handler.cleanup() 