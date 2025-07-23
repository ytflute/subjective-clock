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
        
        # 防止重複觸發
        self.last_button_action_time = 0
        self.is_processing_button = False
        
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
        import time
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
            self.logger.info("處理短按事件：點擊開始按鈕")
            
            # 處理螢幕保護器
            self._deactivate_screensaver()
            self._reset_screensaver_timer()
            
            result = self.web_controller.click_start_button()
            
            if result and result.get('success'):
                self.logger.info("開始按鈕點擊成功")
                
                # 從網頁提取城市資料並播放問候語
                self._extract_city_data_and_play_greeting()
                
            else:
                self.logger.error("開始按鈕點擊失敗")
                
        except Exception as e:
            self.logger.error(f"短按事件處理失敗：{e}")
        finally:
            # 延遲重置處理狀態，避免太快重複觸發
            def reset_processing_state():
                time.sleep(1)
                self.is_processing_button = False
            
            threading.Thread(target=reset_processing_state, daemon=True).start()

    def _extract_city_data_and_play_greeting(self):
        """從網頁提取城市資料並播放問候語和故事（優化版：視聽同步）"""
        if not self.audio_manager:
            self.logger.warning("音頻管理器未初始化，跳過音頻播放")
            return
        
        def synchronized_loading_and_play():
            try:
                # 🎵 立即播放按鈕確認音效
                self.logger.info("🎵 播放按鈕確認音效")
                self.audio_manager.play_notification_sound('success')
                
                # 🔄 顯示 Loading 狀態
                self.logger.info("📺 設定 Loading 狀態...")
                self._set_loading_state(True)
                
                # 等待網頁處理完成
                import time
                time.sleep(2)
                
                # 從網頁提取城市資料
                city_data = self._extract_city_data_from_web()
                
                if city_data:
                    self.logger.info(f"📍 從網頁提取到城市資料: {city_data}")
                    
                    # 🎧 在背景準備完整音頻（不播放）
                    country_code = city_data.get('countryCode') or city_data.get('country_code', 'US')
                    city_name = city_data.get('city', '')
                    country_name = city_data.get('country', '')
                    
                    # 如果沒有國家代碼，嘗試根據國家名稱推測
                    if not country_code and country_name:
                        country_code = self._guess_country_code(country_name)
                    
                    self.logger.info(f"🎧 Loading 模式：準備完整音頻 - 城市: {city_name}, 國家: {country_name} ({country_code})")
                    
                    # 🚀 準備完整音頻但不立即播放
                    audio_file = self._prepare_complete_audio(country_code, city_name, country_name)
                    
                    if audio_file:
                        # ✨ 音頻準備完成，同步顯示畫面和播放聲音
                        self.logger.info("✨ 音頻準備完成，啟動同步播放...")
                        self._synchronized_reveal_and_play(audio_file)
                    else:
                        # 音頻準備失敗，顯示畫面並播放備用音效
                        self.logger.warning("⚠️ 音頻準備失敗，顯示畫面")
                        self._set_loading_state(False)
                        self.audio_manager.play_notification_sound('error')
                        
                else:
                    self.logger.warning("⚠️ 無法從網頁提取城市資料")
                    self._set_loading_state(False)
                    self.audio_manager.play_notification_sound('error')
                    
            except Exception as e:
                self.logger.error(f"同步loading處理失敗: {e}")
                self._set_loading_state(False)
                self.audio_manager.play_notification_sound('error')
        
        # 在背景執行緒中執行
        threading.Thread(target=synchronized_loading_and_play, daemon=True).start()
    
    def _start_parallel_audio_generation(self, country_code: str, city_name: str, country_name: str):
        """並行啟動音頻生成，減少等待時間"""
        def generate_and_play_audio():
            try:
                start_time = time.time()
                self.logger.info("🚀 開始並行音頻生成...")
                
                # 立即開始音頻生成
                success = self.audio_manager.play_greeting(
                    country_code=country_code,
                    city_name=city_name,
                    country_name=country_name
                )
                
                end_time = time.time()
                duration = end_time - start_time
                
                if success:
                    self.logger.info(f"✅ 音頻生成並播放成功 (耗時: {duration:.1f}秒)")
                else:
                    self.logger.warning(f"⚠️ 音頻生成失敗 (耗時: {duration:.1f}秒)")
                    # 備用音效
                    self.audio_manager.play_notification_sound('error')
                    
            except Exception as e:
                self.logger.error(f"並行音頻生成失敗: {e}")
                # 備用音效
                try:
                    self.audio_manager.play_notification_sound('error')
                except:
                    pass
        
        # 在獨立執行緒中進行音頻生成，避免阻塞主流程
        import threading
        import time
        threading.Thread(target=generate_and_play_audio, daemon=True).start()
    
    def _set_loading_state(self, loading: bool):
        """設定網頁 Loading 狀態"""
        try:
            if not self.web_controller or not self.web_controller.driver:
                self.logger.warning("網頁控制器未初始化，無法設定Loading狀態")
                return
            
            # 使用 JavaScript 控制 loading 狀態
            if loading:
                loading_js = """
                // 顯示 Loading 遮罩
                var loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'wakeup-loading-overlay';
                loadingOverlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    color: white;
                    font-size: 24px;
                    font-family: Arial, sans-serif;
                `;
                loadingOverlay.innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🌍</div>
                        <div>準備您的甦醒體驗...</div>
                        <div style="font-size: 16px; margin-top: 10px; opacity: 0.7;">Nova 正在為您準備完美的語音</div>
                    </div>
                `;
                document.body.appendChild(loadingOverlay);
                """
            else:
                loading_js = """
                // 移除 Loading 遮罩
                var loadingOverlay = document.getElementById('wakeup-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.remove();
                }
                """
            
            self.web_controller.driver.execute_script(loading_js)
            self.logger.info(f"📺 Loading 狀態設定: {'顯示' if loading else '隱藏'}")
            
        except Exception as e:
            self.logger.error(f"設定Loading狀態失敗: {e}")
    
    def _prepare_complete_audio(self, country_code: str, city_name: str, country_name: str) -> Optional[Path]:
        """準備完整音頻但不播放"""
        try:
            import time
            from pathlib import Path
            start_time = time.time()
            
            self.logger.info("🎧 開始準備完整音頻...")
            
            # 禁用快速模式，準備完整音頻
            audio_file = self.audio_manager.prepare_greeting_audio(
                country_code=country_code,
                city_name=city_name,
                country_name=country_name
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            if audio_file and audio_file.exists():
                self.logger.info(f"✅ 完整音頻準備成功 (耗時: {duration:.1f}秒): {audio_file.name}")
                return audio_file
            else:
                self.logger.error(f"❌ 完整音頻準備失敗 (耗時: {duration:.1f}秒)")
                return None
                
        except Exception as e:
            self.logger.error(f"準備完整音頻時發生錯誤: {e}")
            return None
    
    def _synchronized_reveal_and_play(self, audio_file: Path):
        """同步顯示畫面和播放音頻"""
        try:
            self.logger.info("🎬 啟動同步視聽體驗...")
            
            # 1. 移除 Loading 狀態
            self._set_loading_state(False)
            
            # 2. 立即播放音頻
            import threading
            def play_audio():
                success = self.audio_manager.play_audio_file_direct(audio_file)
                if success:
                    self.logger.info("🎵 同步音頻播放成功")
                else:
                    self.logger.warning("⚠️ 同步音頻播放失敗")
            
            # 在獨立執行緒中播放音頻，避免阻塞
            threading.Thread(target=play_audio, daemon=True).start()
            
            self.logger.info("✨ 同步視聽體驗啟動完成")
            
        except Exception as e:
            self.logger.error(f"同步視聽啟動失敗: {e}")
            # 備用：移除loading並播放錯誤音效
            self._set_loading_state(False)
            self.audio_manager.play_notification_sound('error')

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
            'russia': 'RU',  # 俄羅斯
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