#!/usr/bin/env python3
"""
甦醒地圖實體裝置主程式 (網頁模式)
透過按鈕觸發 Selenium 自動化控制瀏覽器開啟甦醒地圖
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
    """甦醒地圖網頁模式應用程式"""
    
    def __init__(self):
        # 基本屬性
        self.logger = logging.getLogger(self.__class__.__name__)
        self.web_controller = None
        self.button_handler = None
        
        # 音訊管理
        self.audio_manager = None
        
        # 螢幕保護程式
        self.screensaver_active = False
        self.screensaver_timer = None
        
        # 運行狀態
        self.running = False
        self._stop_event = threading.Event()
        
        # 初始化
        self._initialize()
    
    def _initialize(self):
        """初始化應用程式組件"""
        try:
            self.logger.info("甦醒地圖網頁模式初始化")
            
            # 初始化網頁控制器
            self.logger.info("初始化網頁控制器...")
            self.web_controller = WebControllerDSI()
            
            # 初始化音訊管理器
            self.logger.info("初始化音訊管理器...")
            try:
                self.audio_manager = get_audio_manager()
            except Exception as e:
                self.logger.warning(f"音訊管理器初始化失敗：{e}")
                self.audio_manager = None
            
            # 初始化按鈕處理器
            self._initialize_button_handler()
            
            # 初始化網頁
            self._initialize_web()
            
            self.logger.info("應用程式初始化完成")
            
        except Exception as e:
            self.logger.error(f"初始化失敗：{e}")
            raise
    
    def _initialize_web(self):
        """初始化網頁"""
        try:
            self.logger.info("正在初始化網頁...")
            
            # 啟動瀏覽器並自動設定
            self.web_controller.start_browser()
            
            # 等待頁面載入完成
            time.sleep(3)
            
            # 自動填入使用者名稱並載入資料
            self.web_controller.load_website()
            
            self.logger.info("網頁初始化完成，系統就緒")
            
        except Exception as e:
            self.logger.error(f"網頁初始化失敗：{e}")
            raise
    
    def _setup_screensaver(self):
        """設定螢幕保護程式"""
        if SCREENSAVER_CONFIG['enabled']:
            self._reset_screensaver_timer()
    
    def _reset_screensaver_timer(self):
        """重設螢幕保護計時器"""
        if self.screensaver_timer:
            self.screensaver_timer.cancel()
        
        if SCREENSAVER_CONFIG['enabled']:
            self.screensaver_timer = threading.Timer(
                SCREENSAVER_CONFIG['timeout'],
                self._activate_screensaver
            )
            self.screensaver_timer.start()
    
    def _activate_screensaver(self):
        """啟動螢幕保護程式"""
        self.logger.info("啟動螢幕保護程式")
        self.screensaver_active = True
    
    def _deactivate_screensaver(self):
        """關閉螢幕保護程式"""
        if self.screensaver_active:
            self.screensaver_active = False
            self.logger.info("關閉螢幕保護程式")
    
    def _handle_short_press(self):
        """處理短按事件 - 點擊開始按鈕"""
        self.logger.info("處理短按事件：點擊開始按鈕")
        
        # 處理螢幕保護器
        self._deactivate_screensaver()
        self._reset_screensaver_timer()
        
        try:
            result = self.web_controller.click_start_button()
            
            if result and result.get('success'):
                self.logger.info("開始按鈕點擊成功")
                
                # 從網頁提取城市資料並播放問候語
                self._extract_city_data_and_play_greeting()
                
            else:
                self.logger.error("開始按鈕點擊失敗")
                
        except Exception as e:
            self.logger.error(f"短按事件處理失敗：{e}")

    def _extract_city_data_and_play_greeting(self):
        """從網頁提取城市資料並播放問候語和故事"""
        if not self.audio_manager:
            self.logger.warning("音頻管理器未初始化，跳過音頻播放")
            return
        
        def extract_and_play():
            try:
                # 等待網頁處理完成
                import time
                time.sleep(2)
                
                # 從網頁提取城市資料
                city_data = self._extract_city_data_from_web()
                
                if city_data:
                    self.logger.info(f"從網頁提取到城市資料: {city_data}")
                    
                    # 播放問候語和故事
                    country_code = city_data.get('countryCode') or city_data.get('country_code', 'US')
                    city_name = city_data.get('city', '')
                    country_name = city_data.get('country', '')
                    
                    # 如果沒有國家代碼，嘗試根據國家名稱推測
                    if not country_code and country_name:
                        country_code = self._guess_country_code(country_name)
                    
                    self.logger.info(f"準備播放問候語 - 城市: {city_name}, 國家: {country_name} ({country_code})")
                    
                    success = self.audio_manager.play_greeting(
                        country_code=country_code,
                        city_name=city_name,
                        country_name=country_name
                    )
                    
                    if success:
                        self.logger.info("✅ 問候語和故事播放成功")
                    else:
                        self.logger.warning("⚠️ 問候語和故事播放失敗")
                        
                else:
                    self.logger.warning("無法從網頁提取城市資料，播放通知音")
                    self.audio_manager.play_notification_sound('success')
                    
            except Exception as e:
                self.logger.error(f"提取城市資料和播放音頻失敗: {e}")
                # 備用：播放通知音
                try:
                    self.audio_manager.play_notification_sound('success')
                except:
                    pass
        
        # 在背景執行緒中執行
        threading.Thread(target=extract_and_play, daemon=True).start()

    def _extract_city_data_from_web(self):
        """從網頁提取城市資料"""
        try:
            if not self.web_controller or not self.web_controller.driver:
                self.logger.error("網頁控制器或瀏覽器未初始化")
                return None
            
            # 提取城市資料的 JavaScript
            city_data_js = """
            return {
                city: document.getElementById('cityName') ? document.getElementById('cityName').textContent : '',
                country: document.getElementById('countryName') ? document.getElementById('countryName').textContent : '',
                countryCode: window.currentCityData ? window.currentCityData.country_iso_code : '',
                latitude: window.currentCityData ? window.currentCityData.latitude : null,
                longitude: window.currentCityData ? window.currentCityData.longitude : null,
                timezone: window.currentCityData ? window.currentCityData.timezone : ''
            };
            """
            
            city_data = self.web_controller.driver.execute_script(city_data_js)
            
            if city_data and city_data.get('city'):
                return city_data
            else:
                self.logger.warning(f"未能提取到有效的城市資料: {city_data}")
                return None
                
        except Exception as e:
            self.logger.error(f"從網頁提取城市資料失敗: {e}")
            return None

    def _guess_country_code(self, country_name: str) -> str:
        """根據國家名稱推測國家代碼"""
        country_name = country_name.lower().strip()
        
        # 常見國家名稱對應表
        country_map = {
            'yemen': 'YE',
            'kenya': 'KE',
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
        return 'US'
    
    def _handle_long_press(self):
        """處理長按事件 - 重新載入網頁"""
        self.logger.info("處理長按事件：重新載入網頁")
        
        # 處理螢幕保護器
        self._deactivate_screensaver()
        self._reset_screensaver_timer()
        
        try:
            result = self.web_controller.reload_website()
            
            if result and result.get('success'):
                self.logger.info("網頁重新載入成功")
                
            else:
                self.logger.error("網頁重新載入失敗")
                
        except Exception as e:
            self.logger.error(f"長按事件處理失敗：{e}")
    
    def _initialize_button_handler(self):
        """初始化按鈕處理器"""
        if ButtonHandler is None:
            self.logger.warning("按鈕處理器模組未可用，跳過按鈕初始化")
            return
        
        try:
            self.logger.info(f"初始化按鈕處理器 ({button_handler_type})...")
            
            # 創建按鈕處理器（不需要參數，從配置檔案讀取）
            self.button_handler = ButtonHandler()
            
            # 註冊回調函數
            self.button_handler.register_callbacks(
                short_press_callback=self._handle_short_press,
                long_press_callback=self._handle_long_press
            )
            
            self.logger.info("按鈕處理器初始化完成")
            
        except Exception as e:
            self.logger.error(f"按鈕處理器初始化失敗：{e}")
            self.button_handler = None
    
    def run(self):
        """運行應用程式主循環"""
        if self.running:
            return
        
        self.running = True
        self.logger.info("甦醒地圖網頁模式開始運行")
        
        try:
            # 按鈕處理器已在初始化時啟動
            if self.button_handler:
                self.logger.info("按鈕處理器已就緒")
            
            # 等待停止信號
            while self.running and not self._stop_event.is_set():
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            self.logger.info("收到中斷信號")
        except Exception as e:
            self.logger.error(f"運行時錯誤：{e}")
        finally:
            self.shutdown()
    
    def shutdown(self):
        """關閉應用程式"""
        if not self.running:
            return
        
        self.logger.info("正在關閉應用程式...")
        self.running = False
        self._stop_event.set()
        
        # 取消螢幕保護計時器
        if self.screensaver_timer:
            self.screensaver_timer.cancel()
        
        # 關閉按鈕處理器
        if self.button_handler and hasattr(self.button_handler, 'cleanup'):
            try:
                self.button_handler.cleanup()
            except Exception as e:
                self.logger.error(f"關閉按鈕處理器失敗：{e}")
        
        # 關閉網頁控制器
        if self.web_controller:
            try:
                self.web_controller.stop()
            except Exception as e:
                self.logger.error(f"關閉網頁控制器失敗：{e}")
        
        # 清理音訊管理器
        cleanup_audio_manager()
        
        self.logger.info("應用程式已關閉")

def main():
    """主函數"""
    global app
    
    # 設定信號處理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 設定日誌
    setup_logging()
    
    logger.info("甦醒地圖網頁模式啟動中...")
    print("甦醒地圖網頁模式")
    print("請確保按鈕已連接到 GPIO 18")
    
    try:
        # 創建並運行應用程式
        app = WakeUpMapWebApp()
        app.run()
        
    except Exception as e:
        logger.error(f"應用程式啟動失敗：{e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 