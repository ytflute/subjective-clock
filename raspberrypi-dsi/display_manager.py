#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - DSI螢幕顯示管理模組
"""

import tkinter as tk
from tkinter import ttk
import threading
import time
import logging
from typing import Dict, Optional, Any
from config import (
    SCREEN_CONFIG, FONT_CONFIG, COLOR_CONFIG, 
    ANIMATION_CONFIG, MORNING_GREETINGS, ERROR_MESSAGES
)

logger = logging.getLogger(__name__)

class DisplayManager:
    """DSI螢幕顯示管理器"""
    
    def __init__(self):
        self.root = None
        self.is_fullscreen = SCREEN_CONFIG['fullscreen']
        self.current_screen = 'idle'  # idle, loading, result, error
        self.animation_running = False
        
        # 畫面元件
        self.widgets = {}
        
        # 初始化顯示
        self._setup_display()
        
    def _setup_display(self):
        """初始化顯示設定"""
        try:
            # 創建主視窗
            self.root = tk.Tk()
            self.root.title(SCREEN_CONFIG['title'])
            self.root.geometry(f"{SCREEN_CONFIG['width']}x{SCREEN_CONFIG['height']}")
            self.root.configure(bg=COLOR_CONFIG['background'])
            
            # 設定為全螢幕（如果啟用）
            if self.is_fullscreen:
                self.root.attributes('-fullscreen', True)
                self.root.attributes('-topmost', True)
            
            # 隱藏游標
            self.root.config(cursor="none")
            
            # 禁用調整大小（如果設定）
            if not SCREEN_CONFIG.get('resizable', False):
                self.root.resizable(False, False)
            
            # 綁定按鍵事件
            self.root.bind('<Escape>', self._toggle_fullscreen)
            self.root.bind('<F11>', self._toggle_fullscreen)
            
            # 創建主要容器
            self._create_main_container()
            
            # 顯示初始畫面
            self.show_idle_screen()
            
            logger.info("顯示器初始化成功")
            
        except Exception as e:
            logger.error(f"顯示器初始化失敗: {e}")
            raise
    
    def _create_main_container(self):
        """創建主要容器"""
        # 主容器框架
        self.main_frame = tk.Frame(
            self.root, 
            bg=COLOR_CONFIG['background'],
            width=SCREEN_CONFIG['width'],
            height=SCREEN_CONFIG['height']
        )
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        self.main_frame.pack_propagate(False)
        
        # 內容容器
        self.content_frame = tk.Frame(
            self.main_frame,
            bg=COLOR_CONFIG['background']
        )
        self.content_frame.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
    
    def _toggle_fullscreen(self, event=None):
        """切換全螢幕模式"""
        self.is_fullscreen = not self.is_fullscreen
        self.root.attributes('-fullscreen', self.is_fullscreen)
        logger.info(f"全螢幕模式: {self.is_fullscreen}")
    
    def _clear_content(self):
        """清除內容區域"""
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        self.widgets.clear()
    
    def _create_label(self, parent, text: str, font_size: int, 
                     color: str = None, **kwargs) -> tk.Label:
        """創建標籤元件"""
        if color is None:
            color = COLOR_CONFIG['primary_text']
            
        # 嘗試使用配置的字體
        try:
            font = (FONT_CONFIG['font_family'], font_size, 'bold')
        except:
            # 使用備用字體
            font = (FONT_CONFIG['fallback_font'], font_size, 'bold')
        
        label = tk.Label(
            parent,
            text=text,
            font=font,
            fg=color,
            bg=COLOR_CONFIG['background'],
            **kwargs
        )
        return label
    
    def show_idle_screen(self):
        """顯示待機畫面"""
        self._clear_content()
        self.current_screen = 'idle'
        
        # 標題
        title_label = self._create_label(
            self.content_frame,
            "WakeUpMap",
            FONT_CONFIG['title_size'],
            COLOR_CONFIG['primary_text']
        )
        title_label.pack(pady=(0, 20))
        
        # 副標題
        subtitle_label = self._create_label(
            self.content_frame,
            "甦醒地圖",
            FONT_CONFIG['subtitle_size'],
            COLOR_CONFIG['secondary_text']
        )
        subtitle_label.pack(pady=(0, 40))
        
        # 提示訊息
        instruction_label = self._create_label(
            self.content_frame,
            "按下按鈕開始新的一天",
            FONT_CONFIG['greeting_size'],
            COLOR_CONFIG['secondary_text']
        )
        instruction_label.pack(pady=(0, 20))
        
        # 時間顯示
        self.time_label = self._create_label(
            self.content_frame,
            "",
            FONT_CONFIG['info_size'],
            COLOR_CONFIG['secondary_text']
        )
        self.time_label.pack()
        
        # 儲存元件參考
        self.widgets['title'] = title_label
        self.widgets['subtitle'] = subtitle_label
        self.widgets['instruction'] = instruction_label
        self.widgets['time'] = self.time_label
        
        # 開始時間更新
        self._update_time()
        
        logger.info("顯示待機畫面")
    
    def show_loading_screen(self, message: str = "正在尋找甦醒城市..."):
        """顯示載入畫面"""
        self._clear_content()
        self.current_screen = 'loading'
        
        # 載入訊息
        loading_label = self._create_label(
            self.content_frame,
            message,
            FONT_CONFIG['subtitle_size'],
            COLOR_CONFIG['primary_text']
        )
        loading_label.pack(pady=(0, 30))
        
        # 載入動畫
        self.loading_dots_label = self._create_label(
            self.content_frame,
            "●○○",
            FONT_CONFIG['greeting_size'],
            COLOR_CONFIG['accent']
        )
        self.loading_dots_label.pack()
        
        # 儲存元件參考
        self.widgets['loading'] = loading_label
        self.widgets['loading_dots'] = self.loading_dots_label
        
        # 開始載入動畫
        self._start_loading_animation()
        
        logger.info(f"顯示載入畫面: {message}")
    
    def show_result_screen(self, city_data: Dict[str, Any]):
        """顯示結果畫面"""
        self._clear_content()
        self.current_screen = 'result'
        self.animation_running = False
        
        # 城市名稱
        city_name = city_data.get('city', '未知城市')
        city_label = self._create_label(
            self.content_frame,
            city_name,
            FONT_CONFIG['title_size'],
            COLOR_CONFIG['primary_text']
        )
        city_label.pack(pady=(0, 10))
        
        # 國家名稱
        country_name = city_data.get('country', '未知國家')
        country_label = self._create_label(
            self.content_frame,
            country_name,
            FONT_CONFIG['subtitle_size'],
            COLOR_CONFIG['secondary_text']
        )
        country_label.pack(pady=(0, 30))
        
        # 獲取當地語言的早安問候
        country_code = city_data.get('country_iso_code', '').lower()
        greeting = self._get_morning_greeting(country_code)
        
        greeting_label = self._create_label(
            self.content_frame,
            greeting,
            FONT_CONFIG['greeting_size'],
            COLOR_CONFIG['success']
        )
        greeting_label.pack(pady=(0, 20))
        
        # 額外資訊
        lat = city_data.get('latitude', 0)
        lng = city_data.get('longitude', 0)
        info_text = f"座標: {lat:.2f}°, {lng:.2f}°"
        
        info_label = self._create_label(
            self.content_frame,
            info_text,
            FONT_CONFIG['info_size'],
            COLOR_CONFIG['secondary_text']
        )
        info_label.pack(pady=(0, 10))
        
        # 當地時間
        local_time = city_data.get('local_time', '')
        if local_time:
            time_text = f"當地時間: {local_time}"
            time_label = self._create_label(
                self.content_frame,
                time_text,
                FONT_CONFIG['info_size'],
                COLOR_CONFIG['secondary_text']
            )
            time_label.pack()
        
        # 儲存元件參考
        self.widgets['city'] = city_label
        self.widgets['country'] = country_label
        self.widgets['greeting'] = greeting_label
        self.widgets['info'] = info_label
        if local_time:
            self.widgets['local_time'] = time_label
        
        logger.info(f"顯示結果畫面: {city_name}, {country_name}")
        
        # 設定自動返回待機畫面
        self.root.after(10000, self.show_idle_screen)  # 10秒後返回
    
    def show_error_screen(self, error_type: str = 'unknown_error'):
        """顯示錯誤畫面"""
        self._clear_content()
        self.current_screen = 'error'
        self.animation_running = False
        
        # 錯誤圖示
        error_icon = self._create_label(
            self.content_frame,
            "⚠",
            FONT_CONFIG['title_size'],
            COLOR_CONFIG['error']
        )
        error_icon.pack(pady=(0, 20))
        
        # 錯誤訊息
        error_message = ERROR_MESSAGES.get(error_type, ERROR_MESSAGES['unknown_error'])
        error_label = self._create_label(
            self.content_frame,
            error_message,
            FONT_CONFIG['subtitle_size'],
            COLOR_CONFIG['error']
        )
        error_label.pack(pady=(0, 30))
        
        # 重試提示
        retry_label = self._create_label(
            self.content_frame,
            "請稍後再試或檢查網路連線",
            FONT_CONFIG['greeting_size'],
            COLOR_CONFIG['secondary_text']
        )
        retry_label.pack()
        
        # 儲存元件參考
        self.widgets['error_icon'] = error_icon
        self.widgets['error_message'] = error_label
        self.widgets['retry'] = retry_label
        
        logger.warning(f"顯示錯誤畫面: {error_type}")
        
        # 設定自動返回待機畫面
        self.root.after(5000, self.show_idle_screen)  # 5秒後返回
    
    def _get_morning_greeting(self, country_code: str) -> str:
        """根據國家代碼獲取早安問候語"""
        # 國家代碼到語言的映射
        country_to_language = {
            'tw': 'zh-TW', 'cn': 'zh-CN', 'hk': 'zh-TW', 'mo': 'zh-TW',
            'us': 'en', 'gb': 'en', 'au': 'en', 'ca': 'en', 'nz': 'en',
            'jp': 'ja', 'kr': 'ko', 'es': 'es', 'mx': 'es', 'ar': 'es',
            'fr': 'fr', 'de': 'de', 'it': 'it', 'pt': 'pt', 'br': 'pt',
            'ru': 'ru', 'sa': 'ar', 'ae': 'ar', 'th': 'th', 'vn': 'vi',
            'in': 'hi'
        }
        
        language = country_to_language.get(country_code, 'default')
        return MORNING_GREETINGS.get(language, MORNING_GREETINGS['default'])
    
    def _start_loading_animation(self):
        """開始載入動畫"""
        self.animation_running = True
        self._loading_animation_step(0)
    
    def _loading_animation_step(self, step: int):
        """載入動畫步驟"""
        if not self.animation_running or self.current_screen != 'loading':
            return
            
        if 'loading_dots' not in self.widgets:
            return
        
        dots = ["●○○", "○●○", "○○●", "○●○"]
        current_dots = dots[step % len(dots)]
        
        try:
            self.widgets['loading_dots'].config(text=current_dots)
            self.root.after(500, lambda: self._loading_animation_step(step + 1))
        except:
            # 元件可能已被銷毀
            pass
    
    def _update_time(self):
        """更新時間顯示"""
        if self.current_screen == 'idle' and 'time' in self.widgets:
            try:
                current_time = time.strftime("%Y-%m-%d %H:%M:%S")
                self.widgets['time'].config(text=current_time)
                self.root.after(1000, self._update_time)
            except:
                # 元件可能已被銷毀
                pass
    
    def set_brightness(self, brightness: int):
        """設定螢幕亮度 (0-100)"""
        try:
            # 對於DSI螢幕，可能需要使用系統命令來調整亮度
            import subprocess
            cmd = f"echo {brightness} | sudo tee /sys/class/backlight/*/brightness"
            subprocess.run(cmd, shell=True, check=False)
            logger.info(f"螢幕亮度設定為: {brightness}%")
        except Exception as e:
            logger.warning(f"無法設定螢幕亮度: {e}")
    
    def run(self):
        """運行顯示管理器主循環"""
        try:
            logger.info("啟動顯示管理器主循環")
            self.root.mainloop()
        except Exception as e:
            logger.error(f"顯示管理器運行錯誤: {e}")
            raise
    
    def stop(self):
        """停止顯示管理器"""
        try:
            self.animation_running = False
            if self.root:
                self.root.quit()
                self.root.destroy()
            logger.info("顯示管理器已停止")
        except Exception as e:
            logger.error(f"停止顯示管理器時發生錯誤: {e}")

# 測試程式
if __name__ == "__main__":
    import signal
    import sys
    
    # 設定日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    def signal_handler(sig, frame):
        print("\n正在退出...")
        display.stop()
        sys.exit(0)
    
    # 創建顯示管理器
    display = DisplayManager()
    
    # 註冊信號處理器
    signal.signal(signal.SIGINT, signal_handler)
    
    print("顯示管理器測試程式啟動")
    print("按 Ctrl+C 退出")
    
    # 測試不同畫面
    def test_screens():
        time.sleep(3)
        display.show_loading_screen("正在測試載入畫面...")
        
        time.sleep(5)
        test_city_data = {
            'city': '東京',
            'country': '日本',
            'country_iso_code': 'JP',
            'latitude': 35.6762,
            'longitude': 139.6503,
            'local_time': '08:00:00'
        }
        display.show_result_screen(test_city_data)
    
    # 在背景執行測試
    test_thread = threading.Thread(target=test_screens)
    test_thread.daemon = True
    test_thread.start()
    
    try:
        display.run()
    except KeyboardInterrupt:
        pass
    finally:
        display.stop() 