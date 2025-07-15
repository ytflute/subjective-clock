#!/usr/bin/env python3
"""
甦醒地圖實體裝置主程式 (DSI版本 - 網頁模式)
透過按鈕觸發 Selenium 自動化控制瀏覽器開啟甦醒地圖，並在 DSI 螢幕顯示狀態
"""

import os
import sys
import signal
import logging
import threading
import time
from typing import Optional

# 導入自定義模組
from config import (
    LOGGING_CONFIG, DEBUG_MODE, AUTOSTART_CONFIG, BUTTON_CONFIG,
    SCREENSAVER_CONFIG, ERROR_MESSAGES, USER_CONFIG
)

# 確保模組可以被導入
try:
    from display_manager import DisplayManager
    from web_controller_dsi import WebControllerDSI
    from audio_manager import get_audio_manager, cleanup_audio_manager
except ImportError as e:
    print(f"模組導入失敗: {e}")
    print("請確保所有必要的檔案都在正確的位置")
    sys.exit(1)

# 按鈕處理器導入（優先使用 pigpio，更穩定）
ButtonHandler = None
try:
    from button_handler_pigpio import ButtonHandlerPigpio as ButtonHandler
    button_handler_type = "pigpiod"
except ImportError:
    try:
        from button_handler import ButtonHandler
        button_handler_type = "RPi.GPIO"
    except ImportError:
        print("警告：無法導入任何按鈕處理器模組")
        button_handler_type = None

logger = logging.getLogger(__name__)

# 全域應用程式實例
app = None

def signal_handler(sig, frame):
    """信號處理器"""
    logger.info(f"收到信號 {sig}，正在關閉應用程式...")
    if app:
        app.shutdown()
    sys.exit(0)

def setup_logging():
    """設定日誌系統"""
    log_level = getattr(logging, LOGGING_CONFIG['level'].upper(), logging.INFO)
    
    # 基本日誌配置
    logging.basicConfig(
        level=log_level,
        format=LOGGING_CONFIG['format'],
        handlers=[
            logging.StreamHandler(),  # 控制台輸出
        ]
    )
    
    # 如果指定了日誌檔案，添加檔案處理器
    if LOGGING_CONFIG.get('file'):
        try:
            from logging.handlers import RotatingFileHandler
            file_handler = RotatingFileHandler(
                LOGGING_CONFIG['file'],
                maxBytes=LOGGING_CONFIG.get('max_bytes', 10*1024*1024),
                backupCount=LOGGING_CONFIG.get('backup_count', 5)
            )
            file_handler.setFormatter(
                logging.Formatter(LOGGING_CONFIG['format'])
            )
            logging.getLogger().addHandler(file_handler)
        except Exception as e:
            logger.warning(f"無法設定檔案日誌: {e}")

class WakeUpMapWebApp:
    """甦醒地圖網頁模式應用程式 (DSI版本)"""
    
    def __init__(self):
        self.display_manager = None
        self.button_handler = None
        self.web_controller = None
        self.audio_manager = None
        
        self.is_running = False
        self.is_processing = False
        self.last_activity = time.time()
        
        # 螢幕保護器
        self.screensaver_active = False
        self.screensaver_timer = None
        
        self.logger = logging.getLogger(__name__)
    
    def initialize(self):
        """初始化所有組件"""
        try:
            self.logger.info("=" * 50)
            self.logger.info("甦醒地圖 DSI版本 - 網頁模式 初始化")
            self.logger.info("=" * 50)
            
            # 1. 初始化顯示管理器
            self.logger.info("初始化 DSI 顯示管理器...")
            self.display_manager = DisplayManager()
            self.display_manager.show_loading_screen("正在初始化系統...")
            
            # 2. 初始化網頁控制器
            self.logger.info("初始化網頁控制器...")
            self.web_controller = WebControllerDSI(display_manager=self.display_manager)
            
            # 3. 初始化音頻管理器（可選）
            try:
                self.logger.info("初始化音頻管理器...")
                self.audio_manager = get_audio_manager()
                self.logger.info("音頻管理器已就緒")
            except Exception as e:
                self.logger.warning(f"音頻初始化失敗: {e}")
                self.audio_manager = None
            
            # 4. 初始化按鈕處理器
            if ButtonHandler and button_handler_type:
                self.logger.info(f"初始化按鈕處理器 ({button_handler_type})...")
                self.button_handler = ButtonHandler()
                
                # 設定按鈕事件回調
                self.button_handler.on_short_press = self.on_short_press
                self.button_handler.on_long_press = self.on_long_press
                
                self.logger.info("按鈕處理器已就緒")
            else:
                self.logger.warning("無法初始化按鈕處理器")
                self.button_handler = None
            
            # 5. 啟動瀏覽器並載入網頁（背景運行）
            self.logger.info("啟動瀏覽器並載入甦醒地圖網頁...")
            self.display_manager.show_loading_screen("正在載入甦醒地圖...")
            
            # 啟動瀏覽器
            if self.web_controller.start_browser():
                # 載入網站
                if self.web_controller.open_website():
                    # 填入使用者名稱
                    if self.web_controller.fill_username():
                        self.logger.info("甦醒地圖網頁已就緒，等待按鈕觸發")
                        self.display_manager.show_idle_screen()
                        print("甦醒地圖已載入！按下按鈕開啟今天...")
                    else:
                        self.logger.error("使用者名稱設定失敗")
                        self.display_manager.show_error_screen('api_error')
                        return False
                else:
                    self.logger.error("網站載入失敗")
                    self.display_manager.show_error_screen('network_error')
                    return False
            else:
                self.logger.error("瀏覽器啟動失敗")
                self.display_manager.show_error_screen('display_error')
                return False
            
            # 6. 設定螢幕保護器
            self._setup_screensaver()
            
            self.logger.info("系統初始化完成！")
            return True
            
        except Exception as e:
            self.logger.error(f"初始化失敗: {e}", exc_info=True)
            if self.display_manager:
                self.display_manager.show_error_screen('unknown_error')
            return False
    
    def _setup_screensaver(self):
        """設定螢幕保護器"""
        if SCREENSAVER_CONFIG['enabled']:
            self._reset_screensaver_timer()
    
    def _reset_screensaver_timer(self):
        """重設螢幕保護器計時器"""
        if self.screensaver_timer:
            self.screensaver_timer.cancel()
        
        if SCREENSAVER_CONFIG['enabled']:
            self.screensaver_timer = threading.Timer(
                SCREENSAVER_CONFIG['timeout'],
                self._activate_screensaver
            )
            self.screensaver_timer.start()
    
    def _activate_screensaver(self):
        """啟動螢幕保護器"""
        if not self.is_processing:
            self.screensaver_active = True
            self.display_manager.show_idle_screen()  # 或創建專門的螢幕保護畫面
            self.logger.info("螢幕保護器已啟動")
    
    def _deactivate_screensaver(self):
        """停用螢幕保護器"""
        if self.screensaver_active:
            self.screensaver_active = False
            self.display_manager.show_idle_screen()
            self.logger.info("螢幕保護器已停用")
    
    def _update_activity(self):
        """更新活動時間"""
        self.last_activity = time.time()
        self._deactivate_screensaver()
        self._reset_screensaver_timer()
    
    def on_short_press(self):
        """按鈕短按事件處理"""
        self.logger.info("收到按鈕短按事件")
        self._update_activity()
        
        if self.is_processing:
            self.logger.info("正在處理中，忽略按鈕...")
            return
        
        # 開始甦醒地圖網頁模式
        self._start_web_mode()
    
    def on_long_press(self):
        """按鈕長按事件處理"""
        self.logger.info("收到按鈕長按事件")
        self._update_activity()
        
        # 長按功能：重新載入網頁
        self._show_system_info()
    
    def _start_web_mode(self):
        """觸發甦醒地圖開始（按鈕同步功能）"""
        self.is_processing = True
        
        def process():
            try:
                self.logger.info("觸發甦醒地圖開始...")
                
                # 顯示觸發狀態
                if self.display_manager:
                    self.display_manager.show_loading_screen("正在開啟今天...")
                
                # 只點擊開始按鈕（網頁已經載入並填好使用者名稱）
                success = self.web_controller.click_start_button()
                
                if success:
                    self.logger.info("✅ 甦醒地圖已開始")
                    
                    # 顯示成功狀態
                    if self.display_manager:
                        self.display_manager.show_loading_screen("甦醒地圖啟動中...")
                    
                    # 播放成功音效（如果有音頻）
                    if self.audio_manager:
                        try:
                            threading.Thread(
                                target=self.audio_manager.play_notification_sound,
                                daemon=True
                            ).start()
                        except Exception as e:
                            self.logger.warning(f"播放音效失敗: {e}")
                    
                    # 3秒後回到待機畫面
                    time.sleep(3)
                    if self.display_manager:
                        self.display_manager.show_idle_screen()
                        
                else:
                    self.logger.error("觸發甦醒地圖失敗")
                    if self.display_manager:
                        self.display_manager.show_error_screen('api_error')
                
            except Exception as e:
                self.logger.error(f"網頁模式處理錯誤: {e}")
                if self.display_manager:
                    self.display_manager.show_error_screen('unknown_error')
                
            finally:
                self.is_processing = False
        
        # 在背景執行處理流程
        process_thread = threading.Thread(target=process, daemon=True)
        process_thread.start()
    
    def _show_system_info(self):
        """重新載入網頁（長按功能）"""
        try:
            self.logger.info("重新載入甦醒地圖網頁...")
            
            if self.display_manager:
                self.display_manager.show_loading_screen("正在重新載入...")
            
            # 重新載入網站並填入使用者名稱
            def reload_process():
                try:
                    # 重新開啟網站
                    if self.web_controller.open_website():
                        # 重新填入使用者名稱
                        if self.web_controller.fill_username():
                            self.logger.info("網頁重新載入成功")
                            if self.display_manager:
                                self.display_manager.show_loading_screen("重載完成")
                            time.sleep(2)
                            if self.display_manager:
                                self.display_manager.show_idle_screen()
                        else:
                            self.logger.error("重新填入使用者名稱失敗")
                            if self.display_manager:
                                self.display_manager.show_error_screen('api_error')
                    else:
                        self.logger.error("重新載入網站失敗")
                        if self.display_manager:
                            self.display_manager.show_error_screen('network_error')
                            
                except Exception as e:
                    self.logger.error(f"重新載入錯誤: {e}")
                    if self.display_manager:
                        self.display_manager.show_error_screen('unknown_error')
            
            threading.Thread(target=reload_process, daemon=True).start()
            
        except Exception as e:
            self.logger.error(f"重新載入處理錯誤: {e}")
    
    def run(self):
        """主運行迴圈"""
        self.logger.info("甦醒地圖網頁模式開始運行")
        self.logger.info("短按按鈕：開啟今天，長按按鈕：重新載入網頁")
        self.logger.info("按 Ctrl+C 停止...")
        
        self.is_running = True
        
        try:
            # 啟動顯示管理器主迴圈
            if self.display_manager:
                # 在背景監控應用程式狀態
                def monitor():
                    while self.is_running:
                        time.sleep(1)
                        # 可以在這裡添加其他監控邏輯
                
                monitor_thread = threading.Thread(target=monitor, daemon=True)
                monitor_thread.start()
                
                # 運行 Tkinter 主迴圈
                self.display_manager.run()
            else:
                # 如果沒有顯示管理器，簡單的等待迴圈
                while self.is_running:
                    time.sleep(1)
                    
        except KeyboardInterrupt:
            self.logger.info("收到鍵盤中斷")
        finally:
            self.is_running = False
            self.shutdown()
    
    def shutdown(self):
        """關閉應用程式"""
        self.logger.info("正在關閉甦醒地圖網頁模式...")
        
        self.is_running = False
        
        try:
            # 停用螢幕保護器計時器
            if self.screensaver_timer:
                self.screensaver_timer.cancel()
            
            # 關閉網頁控制器
            if self.web_controller:
                self.web_controller.close_browser()
            
            # 清理按鈕處理器
            if self.button_handler and hasattr(self.button_handler, 'cleanup'):
                self.button_handler.cleanup()
            
            # 清理音頻管理器
            if self.audio_manager:
                cleanup_audio_manager()
            
            # 關閉顯示管理器
            if self.display_manager and hasattr(self.display_manager, 'stop'):
                self.display_manager.stop()
            
            self.logger.info("應用程式關閉完成")
            
        except Exception as e:
            self.logger.error(f"關閉過程中發生錯誤: {e}")

def main():
    """主函數"""
    # 設定日誌
    setup_logging()
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("甦醒地圖 DSI版本 - 網頁模式 啟動中...")
        print("甦醒地圖 DSI版本 - 網頁模式")
        print("請確保已連接 DSI 螢幕和按鈕到 GPIO 18")
        print("網站: https://subjective-clock.vercel.app/")
        
        # 註冊信號處理器
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # 創建應用程式實例
        global app
        app = WakeUpMapWebApp()
        
        # 初始化
        if not app.initialize():
            logger.error("應用程式初始化失敗")
            return 1
        
        print("裝置已就緒！按下按鈕開始甦醒地圖...")
        
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
        if 'app' in globals() and app:
            app.shutdown()

if __name__ == "__main__":
    sys.exit(main()) 