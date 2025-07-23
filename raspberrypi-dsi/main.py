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
    from display_manager import DisplayManager
    from api_client import APIClient
    from audio_manager import get_audio_manager, cleanup_audio_manager
except ImportError as e:
    print(f"模組導入失敗: {e}")
    print("請確保所有必要的檔案都在正確的位置")
    sys.exit(1)

# 按鈕處理器導入（支援多種實現）
ButtonHandler = None
try:
    from button_handler import ButtonHandler
    button_handler_type = "RPi.GPIO"
except ImportError:
    try:
        from button_handler_pigpio import ButtonHandlerPigpio as ButtonHandler
        button_handler_type = "pigpiod"
    except ImportError:
        print("警告：無法導入任何按鈕處理器模組")
        button_handler_type = None

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
        self.audio_manager = None
        
        # 狀態管理
        self.is_processing = False
        self.last_activity_time = time.time()
        self.screensaver_active = False
        
        # 防止重複觸發
        self.last_button_action_time = 0
        self.is_processing_button = False
        
        # 執行緒
        self.screensaver_thread = None
        self.display_thread = None
        self.demo_thread = None
        
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
            self.button_handler = None
            
            if ButtonHandler is None:
                self.logger.warning("沒有可用的按鈕處理器模組")
            else:
                # 首先嘗試使用預設的按鈕處理器
                try:
                    self.logger.info(f"嘗試使用 {button_handler_type} 按鈕處理器...")
                    self.button_handler = ButtonHandler()
                    self.button_handler.register_callbacks(
                        short_press_callback=self.on_button_press,
                        long_press_callback=self.on_long_press
                    )
                    self.logger.info(f"{button_handler_type} 按鈕處理器初始化成功")
                    
                except Exception as e:
                    self.logger.warning(f"{button_handler_type} 按鈕處理器初始化失敗: {e}")
                    
                    # 如果是 RPi.GPIO 失敗，嘗試 pigpiod
                    if button_handler_type == "RPi.GPIO":
                        try:
                            self.logger.info("嘗試使用 pigpiod 按鈕處理器作為備用方案...")
                            from button_handler_pigpio import ButtonHandlerPigpio
                            self.button_handler = ButtonHandlerPigpio()
                            self.button_handler.register_callbacks(
                                short_press_callback=self.on_button_press,
                                long_press_callback=self.on_long_press
                            )
                            self.logger.info("pigpiod 按鈕處理器初始化成功")
                        except Exception as e2:
                            self.logger.warning(f"pigpiod 按鈕處理器也失敗: {e2}")
                            self.button_handler = None
                    else:
                        self.button_handler = None
            
            if self.button_handler is None:
                self.logger.warning("所有按鈕處理器都失敗，程式將在沒有按鈕功能的情況下繼續運行")
            
            # 初始化音頻管理器
            self.logger.info("初始化音頻管理器...")
            try:
                self.audio_manager = get_audio_manager()
                self.logger.info("音頻管理器初始化成功")
            except Exception as e:
                self.logger.warning(f"音頻管理器初始化失敗: {e}")
                self.audio_manager = None
            
            # 啟動螢幕保護執行緒
            if SCREENSAVER_CONFIG['enabled']:
                self.screensaver_thread = threading.Thread(
                    target=self._screensaver_loop,
                    daemon=True
                )
                self.screensaver_thread.start()
            
            # 如果按鈕處理器初始化失敗，啟動演示模式
            if self.button_handler is None:
                self.logger.info("啟動演示模式 - 每30秒自動觸發甦醒地圖")
                self.demo_thread = threading.Thread(
                    target=self._demo_loop,
                    daemon=True
                )
                self.demo_thread.start()
            
            self.logger.info("所有元件初始化完成")
            return True
            
        except Exception as e:
            self.logger.error(f"初始化失敗: {e}")
            return False
    
    def on_button_press(self):
        """按鈕短按事件處理"""
        current_time = time.time()
        
        # 防止重複觸發檢查
        if self.is_processing_button:
            self.logger.warning("按鈕事件正在處理中，忽略重複觸發")
            return
        
        if current_time - self.last_button_action_time < 2.0:  # 2秒內不允許重複操作
            self.logger.warning(f"按鈕操作間隔過短 ({current_time - self.last_button_action_time:.2f}s)，忽略此次操作")
            return
        
        self.is_processing_button = True
        self.last_button_action_time = current_time
        
        try:
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
            
        finally:
            # 延遲重置處理狀態
            def reset_processing_state():
                time.sleep(1)
                self.is_processing_button = False
            
            threading.Thread(target=reset_processing_state, daemon=True).start()
    
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
                    
                    # 播放早安問候語
                    self._play_morning_greeting(city_data)
                    
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
        """與網頁同步資料 - 儲存使用者記錄到甦醒地圖網站"""
        try:
            import threading
            
            def sync_record():
                try:
                    success = self.api_client.save_user_record(city_data)
                    if success:
                        self.logger.info("✅ 記錄已成功同步到甦醒地圖網站")
                    else:
                        self.logger.warning("⚠️ 記錄同步失敗，但裝置繼續正常運作")
                except Exception as e:
                    self.logger.error(f"同步記錄時發生錯誤: {e}")
            
            # 在背景執行緒中同步記錄
            sync_thread = threading.Thread(target=sync_record, daemon=True)
            sync_thread.start()
            self.logger.info("🔄 已啟動背景同步程序")
            
        except Exception as e:
            self.logger.error(f"與網頁同步失敗: {e}")
    
    def _play_morning_greeting(self, city_data):
        """播放早安問候語（使用 ChatGPT API）"""
        try:
            if not self.audio_manager:
                self.logger.warning("音頻管理器未初始化，跳過音頻播放")
                return
            
            # 獲取城市和國家資訊
            country_code = city_data.get('country_iso_code') or city_data.get('countryCode') or city_data.get('country_code')
            city_name = city_data.get('name') or city_data.get('city', '')
            country_name = city_data.get('country', '')
            
            # 如果沒有國家代碼，嘗試根據國家名稱推測
            if not country_code and country_name:
                country_code = self._guess_country_code(country_name)
            
            # 最後預設為美國
            if not country_code:
                country_code = 'US'
                self.logger.warning(f"無法獲取國家代碼，使用預設值 US")
            
            self.logger.info(f"準備播放早安問候語 - 城市: {city_name}, 國家: {country_name} ({country_code})")
            self.logger.info(f"完整城市資料: {city_data}")  # 添加完整資料日誌
            
            # 在背景執行音頻播放，避免阻塞UI
            def play_audio():
                try:
                    # 調用新的 play_greeting 方法，支援 ChatGPT API
                    success = self.audio_manager.play_greeting(
                        country_code=country_code,
                        city_name=city_name,
                        country_name=country_name
                    )
                    if success:
                        self.logger.info("✅ 早安問候語播放成功")
                    else:
                        self.logger.warning("⚠️ 早安問候語播放失敗")
                except Exception as e:
                    self.logger.error(f"❌ 播放音頻時發生錯誤: {e}")
            
            # 創建音頻播放執行緒
            audio_thread = threading.Thread(target=play_audio, daemon=True)
            audio_thread.start()
            
            # 短暫延遲確保音頻開始播放
            time.sleep(0.5)
            
        except Exception as e:
            self.logger.error(f"❌ 播放早安問候語失敗: {e}")

    def _guess_country_code(self, country_name: str) -> str:
        """根據國家名稱推測國家代碼"""
        country_name = country_name.lower().strip()
        
        # 常見國家名稱對應表
        country_map = {
            'yemen': 'YE',
            'kenya': 'KE',
            'south africa': 'ZA',  # 添加南非
            'saudi arabia': 'SA',
            'united arab emirates': 'AE',
            'egypt': 'EG',
            'iraq': 'IQ',
            'jordan': 'JO',
            'kuwait': 'KW',
            'lebanon': 'LB',
            'oman': 'OM',
            'qatar': 'QA',
            'syria': 'SY',
            'china': 'CN',
            'japan': 'JP',
            'korea': 'KR',
            'south korea': 'KR',
            'france': 'FR',
            'germany': 'DE',
            'spain': 'ES',
            'italy': 'IT',
            'russia': 'RU',
            'india': 'IN',
            'thailand': 'TH',
            'vietnam': 'VN',
            'united states': 'US',
            'united kingdom': 'GB',
            'australia': 'AU',
            'canada': 'CA',
            'brazil': 'BR',
            'mexico': 'MX',
            'argentina': 'AR',
            'morocco': 'MA',
            'nigeria': 'NG',
            'ghana': 'GH',
            'ethiopia': 'ET',
            'french southern territories': 'TF',  # 法國南方領土
        }
        
        # 檢查完整匹配
        if country_name in country_map:
            self.logger.info(f"根據國家名稱 '{country_name}' 推測國家代碼: {country_map[country_name]}")
            return country_map[country_name]
        
        # 檢查部分匹配
        for country_key, code in country_map.items():
            if country_key in country_name or country_name in country_key:
                self.logger.info(f"根據國家名稱 '{country_name}' (部分匹配 '{country_key}') 推測國家代碼: {code}")
                return code
        
        self.logger.warning(f"無法根據國家名稱 '{country_name}' 推測國家代碼")
        return ''

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
    
    def _demo_loop(self):
        """演示模式執行緒循環 - 自動觸發甦醒地圖功能"""
        demo_count = 0
        while self.running:
            try:
                # 等待30秒
                time.sleep(30)
                
                if not self.running:
                    break
                
                demo_count += 1
                self.logger.info(f"演示模式觸發 #{demo_count}")
                
                # 模擬按鈕按下事件
                self.on_button_press()
                
            except Exception as e:
                self.logger.error(f"演示模式執行緒錯誤: {e}")
                time.sleep(30)
    
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
            
            # 清理音頻管理器
            if self.audio_manager:
                cleanup_audio_manager()
                self.audio_manager = None
            
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