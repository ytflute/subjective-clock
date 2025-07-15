#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - 樹莓派4B DSI螢幕版本主程式
甦醒地圖：按下按鈕開始新的一天
"""

import os
import sys
import signal
import logging
import threading
import time
from logging.handlers import RotatingFileHandler
from typing import Optional

# 導入自定義模組
from config import (
    LOGGING_CONFIG, DEBUG_MODE, AUTOSTART_CONFIG,
    SCREENSAVER_CONFIG, ERROR_MESSAGES
)

# 確保模組可以被導入
try:
    from button_handler import ButtonHandler
    from display_manager import DisplayManager
    from api_client import APIClient
except ImportError as e:
    print(f"模組導入失敗: {e}")
    print("請確保所有必要的檔案都在正確的位置")
    sys.exit(1)

# 設定日誌
def setup_logging():
    """設定日誌系統"""
    try:
        # 創建日誌目錄
        log_dir = os.path.dirname(LOGGING_CONFIG['file'])
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        
        # 設定根日誌器
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, LOGGING_CONFIG['level']))
        
        # 清除現有的處理器
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # 建立格式化器
        formatter = logging.Formatter(LOGGING_CONFIG['format'])
        
        # 檔案處理器（回轉日誌）
        try:
            file_handler = RotatingFileHandler(
                LOGGING_CONFIG['file'],
                maxBytes=LOGGING_CONFIG['max_bytes'],
                backupCount=LOGGING_CONFIG['backup_count']
            )
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except PermissionError:
            # 如果無法寫入系統日誌目錄，使用當前目錄
            file_handler = RotatingFileHandler(
                'wakeupmap-dsi.log',
                maxBytes=LOGGING_CONFIG['max_bytes'],
                backupCount=LOGGING_CONFIG['backup_count']
            )
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        
        # 控制台處理器
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        logging.info("日誌系統初始化完成")
        
    except Exception as e:
        print(f"日誌系統初始化失敗: {e}")
        # 使用基本的日誌配置
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

class WakeUpMapApp:
    """WakeUpMap 主應用程式"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.running = False
        
        # 核心元件
        self.button_handler: Optional[ButtonHandler] = None
        self.display_manager: Optional[DisplayManager] = None
        self.api_client: Optional[APIClient] = None
        
        # 狀態管理
        self.is_processing = False
        self.last_activity_time = time.time()
        self.screensaver_active = False
        
        # 執行緒
        self.screensaver_thread = None
        self.display_thread = None
        
        self.logger.info("WakeUpMap 應用程式初始化")
    
    def initialize(self):
        """初始化所有元件"""
        try:
            self.logger.info("正在初始化應用程式元件...")
            
            # 初始化API客戶端
            self.logger.info("初始化API客戶端...")
            self.api_client = APIClient()
            
            # 測試網路連線
            if not self.api_client.test_connection():
                self.logger.warning("網路連線測試失敗，部分功能可能無法正常運作")
            
            # 初始化顯示管理器
            self.logger.info("初始化顯示管理器...")
            self.display_manager = DisplayManager()
            
            # 初始化按鈕處理器
            self.logger.info("初始化按鈕處理器...")
            self.button_handler = ButtonHandler()
            self.button_handler.register_callbacks(
                short_press_callback=self.on_button_press,
                long_press_callback=self.on_long_press
            )
            
            # 啟動螢幕保護執行緒
            if SCREENSAVER_CONFIG['enabled']:
                self.screensaver_thread = threading.Thread(
                    target=self._screensaver_loop,
                    daemon=True
                )
                self.screensaver_thread.start()
            
            self.logger.info("所有元件初始化完成")
            return True
            
        except Exception as e:
            self.logger.error(f"初始化失敗: {e}")
            return False
    
    def on_button_press(self):
        """按鈕短按事件處理"""
        self.logger.info("收到按鈕短按事件")
        self._update_activity()
        
        # 如果螢幕保護啟動，先退出螢幕保護
        if self.screensaver_active:
            self._exit_screensaver()
            return
        
        # 如果正在處理中，忽略按鈕事件
        if self.is_processing:
            self.logger.info("正在處理中，忽略按鈕事件")
            return
        
        # 開始處理「開始這一天」
        self._start_new_day()
    
    def on_long_press(self):
        """按鈕長按事件處理"""
        self.logger.info("收到按鈕長按事件")
        self._update_activity()
        
        # 長按可以用於系統功能，例如重啟或關機
        self.logger.info("長按功能：顯示系統資訊")
        
        # 這裡可以實現系統功能
        # 例如：顯示系統狀態、重啟、關機等
        self._show_system_info()
    
    def _start_new_day(self):
        """開始新的一天處理流程"""
        self.is_processing = True
        
        def process():
            try:
                self.logger.info("開始新的一天處理流程")
                
                # 顯示載入畫面
                self.display_manager.show_loading_screen("正在尋找您的甦醒城市...")
                
                # 呼叫API尋找城市
                city_data = self.api_client.find_matching_city()
                
                if city_data:
                    # 顯示結果
                    self.display_manager.show_result_screen(city_data)
                    self.logger.info(f"成功找到甦醒城市: {city_data['city']}, {city_data['country']}")
                    
                    # 這裡可以添加與網頁的同步功能
                    self._sync_with_web(city_data)
                    
                else:
                    # 顯示錯誤
                    self.display_manager.show_error_screen('api_error')
                    self.logger.error("無法找到匹配的城市")
                
            except Exception as e:
                self.logger.error(f"處理新的一天時發生錯誤: {e}")
                self.display_manager.show_error_screen('unknown_error')
                
            finally:
                self.is_processing = False
        
        # 在背景執行處理
        processing_thread = threading.Thread(target=process, daemon=True)
        processing_thread.start()
    
    def _sync_with_web(self, city_data):
        """與網頁同步資料 (可選功能)"""
        try:
            # 這裡可以實現與網頁系統的同步
            # 例如：發送資料到Firebase、調用webhook等
            self.logger.info("與網頁同步資料")
            
            # 暫時只記錄到日誌
            self.logger.info(f"同步資料: {city_data}")
            
        except Exception as e:
            self.logger.error(f"與網頁同步失敗: {e}")
    
    def _show_system_info(self):
        """顯示系統資訊"""
        try:
            # 獲取系統資訊
            import platform
            import psutil
            
            system_info = {
                'system': platform.system(),
                'release': platform.release(),
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent
            }
            
            self.logger.info(f"系統資訊: {system_info}")
            
            # 這裡可以在螢幕上顯示系統資訊
            # 暫時只記錄到日誌
            
        except Exception as e:
            self.logger.error(f"獲取系統資訊失敗: {e}")
    
    def _update_activity(self):
        """更新活動時間"""
        self.last_activity_time = time.time()
        if self.screensaver_active:
            self._exit_screensaver()
    
    def _enter_screensaver(self):
        """進入螢幕保護模式"""
        if not self.screensaver_active:
            self.logger.info("進入螢幕保護模式")
            self.screensaver_active = True
            
            # 降低螢幕亮度
            if self.display_manager:
                self.display_manager.set_brightness(SCREENSAVER_CONFIG['dim_brightness'])
            
            # 設定LED狀態
            if self.button_handler:
                self.button_handler.set_led(False)
    
    def _exit_screensaver(self):
        """退出螢幕保護模式"""
        if self.screensaver_active:
            self.logger.info("退出螢幕保護模式")
            self.screensaver_active = False
            
            # 恢復螢幕亮度
            if self.display_manager:
                self.display_manager.set_brightness(100)
            
            # 設定LED狀態
            if self.button_handler:
                self.button_handler.set_led(True)
    
    def _screensaver_loop(self):
        """螢幕保護執行緒循環"""
        while self.running:
            try:
                current_time = time.time()
                inactive_time = current_time - self.last_activity_time
                
                # 檢查是否需要進入螢幕保護
                if (inactive_time >= SCREENSAVER_CONFIG['timeout'] and 
                    not self.screensaver_active and 
                    not self.is_processing):
                    self._enter_screensaver()
                
                time.sleep(10)  # 每10秒檢查一次
                
            except Exception as e:
                self.logger.error(f"螢幕保護執行緒錯誤: {e}")
                time.sleep(10)
    
    def run(self):
        """運行主程式"""
        try:
            self.running = True
            self.logger.info("WakeUpMap 應用程式啟動")
            
            # 延遲啟動（如果設定）
            if AUTOSTART_CONFIG.get('delay', 0) > 0:
                self.logger.info(f"延遲 {AUTOSTART_CONFIG['delay']} 秒後啟動...")
                time.sleep(AUTOSTART_CONFIG['delay'])
            
            # 啟動顯示管理器（阻塞式）
            if self.display_manager:
                self.display_manager.run()
            
        except Exception as e:
            self.logger.error(f"主程式運行錯誤: {e}")
            raise
    
    def shutdown(self):
        """關閉應用程式"""
        try:
            self.logger.info("正在關閉 WakeUpMap 應用程式...")
            self.running = False
            
            # 關閉按鈕處理器
            if self.button_handler:
                self.button_handler.cleanup()
            
            # 關閉顯示管理器
            if self.display_manager:
                self.display_manager.stop()
            
            self.logger.info("WakeUpMap 應用程式已關閉")
            
        except Exception as e:
            self.logger.error(f"關閉應用程式時發生錯誤: {e}")

def signal_handler(sig, frame):
    """信號處理器"""
    print("\n收到終止信號，正在關閉...")
    if 'app' in globals():
        app.shutdown()
    sys.exit(0)

def main():
    """主函數"""
    # 設定日誌
    setup_logging()
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("=" * 50)
        logger.info("WakeUpMap - 甦醒地圖 DSI版本啟動")
        logger.info("=" * 50)
        
        # 註冊信號處理器
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # 創建應用程式實例
        global app
        app = WakeUpMapApp()
        
        # 初始化
        if not app.initialize():
            logger.error("應用程式初始化失敗")
            return 1
        
        # 運行應用程式
        app.run()
        
        return 0
        
    except KeyboardInterrupt:
        logger.info("收到鍵盤中斷")
        return 0
        
    except Exception as e:
        logger.error(f"應用程式運行失敗: {e}", exc_info=True)
        return 1
        
    finally:
        if 'app' in globals():
            app.shutdown()

if __name__ == "__main__":
    sys.exit(main()) 