#!/usr/bin/env python3
"""
甦醒地圖實體裝置主程式 v2.0 (網頁模式 - 重構版)
透過按鈕觸發 Selenium 自動化控制瀏覽器開啟甦醒地圖
使用重構版前端 pi-script-refactored.js 以提升性能與減少處理時間
"""

import os
import sys
import signal
import logging
import threading
import time
from typing import Optional
from pathlib import Path

# 導入自定義模組
from config import (
    LOGGING_CONFIG, DEBUG_MODE, AUTOSTART_CONFIG, BUTTON_CONFIG,
    SCREENSAVER_CONFIG, ERROR_MESSAGES, USER_CONFIG
)
# 🔧 已停用本地儲存，統一使用前端Firebase直寫
# from local_storage import LocalStorage  
# from firebase_sync import FirebaseSync

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

class WakeUpMapWebAppV2:
    """甦醒地圖網頁模式應用程式 v2.0 - 重構版"""
    
    def __init__(self):
        # 基本屬性
        self.logger = logging.getLogger(self.__class__.__name__)
        self.web_controller = None
        self.button_handler = None
        
        # 音訊管理
        self.audio_manager = None
        
        # 本地儲存管理
        self.local_storage = None
        
        # Firebase 同步管理
        self.firebase_sync = None
        
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
            self.logger.info("甦醒地圖網頁模式 v2.0 (重構版) 初始化")
            
            # 初始化網頁控制器 - 修改為使用重構版前端
            self.logger.info("初始化網頁控制器 (重構版前端)...")
            self.web_controller = WebControllerDSIRefactored()  # 使用重構版控制器
            
            # 🔧 統一使用前端Firebase直寫，停用本地儲存
            self.logger.info("已停用本地儲存，採用前端Firebase直寫模式")
            self.local_storage = None
            self.firebase_sync = None
            
            # 🔧 前端日誌監控標誌
            self.frontend_log_monitoring_started = False
            
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
            
            self.logger.info("應用程式 v2.0 初始化完成")
            
        except Exception as e:
            self.logger.error(f"初始化失敗：{e}")
            raise
    
    def _initialize_web(self):
        """初始化網頁 - 使用重構版前端"""
        try:
            self.logger.info("正在初始化重構版網頁...")
            
            # 啟動瀏覽器並自動設定
            self.web_controller.start_browser()
            
            # 等待頁面載入完成
            time.sleep(3)
            
            # 自動填入使用者名稱並載入資料
            self.web_controller.load_website()
            
            self.logger.info("重構版網頁初始化完成，系統就緒")
            
        except Exception as e:
            self.logger.error(f"重構版網頁初始化失敗：{e}")
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
        """處理短按事件 - 觸發重構版甦醒流程"""
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
            self.logger.info("🚀 處理短按事件：觸發重構版甦醒流程")
            
            # 處理螢幕保護器
            self._deactivate_screensaver()
            self._reset_screensaver_timer()
            
            # 使用重構版的甦醒流程
            result = self.web_controller.trigger_refactored_wakeup()
            
            if result and result.get('success'):
                self.logger.info("✅ 重構版甦醒流程觸發成功")
                
                # 🔧 Day計數由前端Firebase決定，不再使用本地計數
                self.logger.info("📊 Day計數將由前端Firebase查詢決定")
                
                # 從網頁提取城市資料並播放問候語（優化版）
                self._extract_city_data_and_play_greeting_optimized()
                
            else:
                self.logger.error("❌ 重構版甦醒流程觸發失敗")
                
        except Exception as e:
            self.logger.error(f"短按事件處理失敗：{e}")
        finally:
            # 延遲重置處理狀態，避免太快重複觸發
            def reset_processing_state():
                time.sleep(1)
                self.is_processing_button = False
            
            threading.Thread(target=reset_processing_state, daemon=True).start()

    def _increment_local_day_counter(self) -> int:
        """🔧 已停用本地Day計數，由前端Firebase決定"""
        self.logger.info("Day計數由前端Firebase查詢決定，不再使用本地計數")
        return 1  # 回傳預設值，實際由前端決定
    
    def _get_current_day_number(self) -> int:
        """🔧 已停用本地Day查詢，由前端Firebase決定"""
        self.logger.info("Day編號由前端Firebase查詢決定，不再使用本地計數")
        return 1  # 回傳預設值，實際由前端決定
    
    def _save_basic_record(self, city_data: dict):
        """🔧 已停用基本記錄儲存，由前端統一處理"""
        # 移除本地Day計數調用
        self.logger.info("📊 基本城市資料處理完成，Day計數由前端決定")

    def _save_local_record(self, city_data: dict, story_content: dict = None):
        """🔧 已停用本地儲存，資料將由前端直接寫入Firebase"""
        self.logger.info("📊 資料儲存交由前端處理，確保單一寫入點")
        
        # 記錄資料內容供除錯使用
        if story_content:
            self.logger.info(f"📖 故事內容準備完成: {story_content.get('city', '')} / {story_content.get('story', '')[:50]}...")
        
        # 不再進行本地儲存，由前端統一處理
        return True

    def _extract_city_data_and_play_greeting_optimized(self):
        """從網頁提取城市資料並播放問候語（重構版優化）"""
        if not self.audio_manager:
            self.logger.warning("音頻管理器未初始化，跳過音頻播放")
            return
        
        def optimized_loading_and_play():
            try:
                # 🎵 使用重構版的優化流程
                self.logger.info("🎵 重構版流程：跳過冗餘等待，快速處理")
                
                # 減少等待時間（重構版前端處理更快）
                import time
                time.sleep(1)  # 從原來的2秒減少到1秒
                
                # 從網頁提取城市資料
                city_data = self._extract_city_data_from_web_optimized()
                
                if city_data:
                    self.logger.info(f"📍 從重構版網頁提取到城市資料: {city_data}")
                    
                    # 💾 保存甦醒記錄到本地並同步到 Firebase
                    self._save_basic_record(city_data)
                    
                    # 🎧 在背景準備完整音頻（優化版）
                    country_code = city_data.get('countryCode') or city_data.get('country_code', 'US')
                    city_name = city_data.get('city', '')
                    country_name = city_data.get('country', '')
                    
                    # 如果沒有國家代碼，嘗試根據國家名稱推測
                    if not country_code and country_name:
                        country_code = self._guess_country_code(country_name)
                    
                    self.logger.info(f"🎧 重構版：準備完整音頻 - 城市: {city_name}, 國家: {country_name} ({country_code})")
                    
                    # 🚀 準備完整音頻但不立即播放（優化版）
                    audio_file = self._prepare_complete_audio_optimized(country_code, city_name, country_name, city_data)
                    
                    if audio_file:
                        # ✨ 音頻準備完成，同步顯示畫面和播放聲音
                        self.logger.info("✨ 重構版音頻準備完成，啟動同步播放...")
                        self._synchronized_reveal_and_play(audio_file)
                    else:
                        # 音頻準備失敗，顯示畫面並播放備用音效
                        self.logger.warning("⚠️ 重構版音頻準備失敗，顯示畫面")
                        self.audio_manager.play_notification_sound('error')
                        
                else:
                    self.logger.warning("⚠️ 無法從重構版網頁提取城市資料")
                    self.audio_manager.play_notification_sound('error')
                    
            except Exception as e:
                self.logger.error(f"重構版處理失敗: {e}")
                self.audio_manager.play_notification_sound('error')
        
        # 在背景執行緒中執行
        threading.Thread(target=optimized_loading_and_play, daemon=True).start()
    
    def _extract_city_data_from_web_optimized(self):
        """從重構版網頁提取城市資料（優化版）"""
        try:
            if not self.web_controller or not self.web_controller.driver:
                self.logger.error("網頁控制器或瀏覽器未初始化")
                return None
            
            # 重構版城市資料提取的 JavaScript（使用重構版的全域變數）
            city_data_js = """
            // 重構版：使用 WakeUpManager 或全域變數提取資料
            return {
                city: window.currentCityData ? window.currentCityData.city : 
                      (document.getElementById('cityName') ? document.getElementById('cityName').textContent : ''),
                country: window.currentCityData ? window.currentCityData.country : 
                         (document.getElementById('countryName') ? document.getElementById('countryName').textContent : ''),
                countryCode: window.currentCityData ? window.currentCityData.country_iso_code : '',
                latitude: window.currentCityData ? window.currentCityData.latitude : null,
                longitude: window.currentCityData ? window.currentCityData.longitude : null,
                timezone: window.currentCityData ? window.currentCityData.timezone : '',
                // 重構版特有：檢查狀態管理
                currentState: window.currentState || 'unknown',
                isRefactored: true  // 標記為重構版資料
            };
            """
            
            city_data = self.web_controller.driver.execute_script(city_data_js)
            
            if city_data and city_data.get('city'):
                # 清理城市名稱（移除冒號和空格）
                city_data['city'] = city_data['city'].strip().rstrip(':').strip() if city_data['city'] else ''
                city_data['country'] = city_data['country'].strip() if city_data['country'] else ''
                
                # 如果沒有國家代碼，嘗試從國家名稱獲取
                if not city_data.get('countryCode') and city_data.get('country'):
                    city_data['countryCode'] = self._guess_country_code(city_data['country'])
                
                self.logger.info(f"重構版清理後的城市資料: {city_data}")
                return city_data
            else:
                self.logger.warning(f"重構版未能提取到有效的城市資料: {city_data}")
                return None
                
        except Exception as e:
            self.logger.error(f"從重構版網頁提取城市資料失敗: {e}")
            return None
    
    def _prepare_complete_audio_optimized(self, country_code: str, city_name: str, country_name: str, city_data: dict = None) -> Optional[Path]:
        """準備完整音頻但不播放，並將內容傳給重構版網頁（優化版）"""
        try:
            import time
            from pathlib import Path
            start_time = time.time()
            
            self.logger.info("🎧 重構版：開始準備完整音頻...")
            
            # 1. 先生成音頻內容並獲取故事文本
            audio_file, story_content = self.audio_manager.prepare_greeting_audio_with_content(
                country_code=country_code,
                city_name=city_name,
                country_name=country_name,
                city_data=city_data  # 🔧 傳遞完整城市數據，包含坐標信息
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            # 🔧 重構版：減少Firebase同步等待時間
            if story_content:
                self.logger.info("📖 重構版：發現故事內容，檢查Firebase上傳狀態...")
                
                # 🕐 減少等待時間（重構版前端處理更快）
                import time
                time.sleep(1)  # 從原來的2秒減少到1秒
                
                self.logger.info("🔥 重構版Firebase同步等待完成，現在傳送故事給前端顯示")
                self._send_story_to_web_optimized(story_content)
                
                if audio_file and audio_file.exists():
                    self.logger.info(f"✅ 重構版完整音頻準備成功 (耗時: {duration:.1f}秒): {audio_file.name}")
                    self.logger.info("📊 重構版：故事資料已由 audio_manager 上傳到 Firebase，前端事件已觸發")
                    return audio_file
                else:
                    self.logger.warning(f"⚠️ 重構版音頻生成失敗，但故事內容已傳送給前端 (耗時: {duration:.1f}秒)")
                    return None
            else:
                self.logger.error(f"❌ 重構版完整音頻和故事內容準備失敗 (耗時: {duration:.1f}秒)")
                return None
                
        except Exception as e:
            self.logger.error(f"重構版準備完整音頻時發生錯誤: {e}")
            return None

    def _send_story_to_web_optimized(self, story_content: dict):
        """將故事內容傳給重構版網頁端用於打字機效果（優化版）"""
        try:
            import json
            
            if not self.web_controller or not self.web_controller.driver:
                self.logger.warning("網頁控制器未初始化，無法傳送故事內容")
                return
            
            # 獲取當前 Day 編號
            current_day = self._get_current_day_number()
            
            # 將故事內容注入到重構版網頁中
            story_js = f"""
            // 重構版：設定樹莓派生成的故事內容
            window.piGeneratedStory = {{
                greeting: {json.dumps(story_content.get('greeting', ''), ensure_ascii=False)},
                language: {json.dumps(story_content.get('language', ''), ensure_ascii=False)},
                languageCode: {json.dumps(story_content.get('languageCode', ''), ensure_ascii=False)},
                story: {json.dumps(story_content.get('story', ''), ensure_ascii=False)},
                fullContent: {json.dumps(story_content.get('fullContent', ''), ensure_ascii=False)},
                city: {json.dumps(story_content.get('city', ''), ensure_ascii=False)},
                country: {json.dumps(story_content.get('country', ''), ensure_ascii=False)},
                countryCode: {json.dumps(story_content.get('countryCode', ''), ensure_ascii=False)},
                day: {current_day},
                isRefactored: true  // 標記為重構版
            }};
            
            // 重構版：觸發 piStoryReady 事件（使用重構版的事件處理器）
            window.dispatchEvent(new CustomEvent('piStoryReady', {{ 
                detail: window.piGeneratedStory 
            }}));
            
            console.log('🎵 重構版：樹莓派故事內容已準備完成:', window.piGeneratedStory);
            console.log('🎵 重構版：即將觸發 piStoryReady 事件，Day: {current_day}');
            """
            
            self.web_controller.driver.execute_script(story_js)
            self.logger.info("✅ 重構版：故事內容已傳送給網頁端")
            
            # 🔧 啟動前端日誌監控
            self._start_frontend_log_monitoring()
            
        except Exception as e:
            self.logger.error(f"重構版傳送故事內容失敗: {e}")
    
    def _start_frontend_log_monitoring(self):
        """啟動前端日誌監控，定期讀取前端日誌並輸出到後端日誌"""
        if self.frontend_log_monitoring_started:
            return  # 避免重複啟動
            
        import threading
        import time
        
        def monitor_frontend_logs():
            try:
                last_timestamp = None
                element_found = False
                
                # 給前端足夠時間初始化
                time.sleep(2)
                
                while True:
                    try:
                        if not self.web_controller or not self.web_controller.driver:
                            break
                            
                        # 讀取前端日誌橋接元素
                        log_element = self.web_controller.driver.find_element("id", "frontend-log-bridge")
                        
                        if not element_found:
                            self.logger.info("🔧 [重構版日誌橋接] 找到前端日誌橋接元素")
                            element_found = True
                        
                        current_timestamp = log_element.get_attribute("data-timestamp")
                        
                        # 如果有新的日誌條目
                        if current_timestamp and current_timestamp != last_timestamp:
                            log_content = log_element.text
                            if log_content:
                                try:
                                    import json
                                    log_entry = json.loads(log_content)
                                    level = log_entry.get('level', 'INFO')
                                    message = log_entry.get('message', '')
                                    data = log_entry.get('data', '')
                                    
                                    # 根據日誌級別輸出到對應的後端日誌
                                    if level == 'ERROR':
                                        self.logger.error(f"[重構版前端] {message} {data}")
                                    elif level == 'WARN':
                                        self.logger.warning(f"[重構版前端] {message} {data}")
                                    else:
                                        self.logger.info(f"[重構版前端] {message} {data}")
                                    
                                    last_timestamp = current_timestamp
                                    
                                except json.JSONDecodeError as e:
                                    self.logger.warning(f"🔧 [重構版日誌橋接] JSON解析失敗: {e}, 內容: {log_content[:100]}")
                                    
                    except Exception as e:
                        if not element_found:
                            # 只在第一次找不到元素時報告
                            self.logger.warning(f"🔧 [重構版日誌橋接] 尚未找到前端日誌元素: {e}")
                            element_found = None  # 標記為已報告
                    
                    time.sleep(1)  # 每秒檢查一次
                    
            except Exception as e:
                self.logger.error(f"重構版前端日誌監控失敗: {e}")
        
        # 在後台執行緒中啟動監控
        monitor_thread = threading.Thread(target=monitor_frontend_logs, daemon=True)
        monitor_thread.start()
        self.frontend_log_monitoring_started = True
        self.logger.info("🔧 [重構版日誌橋接] 前端日誌監控已啟動")
    
    def _synchronized_reveal_and_play(self, audio_file: Path):
        """同步顯示畫面和播放音頻"""
        try:
            self.logger.info("🎬 重構版：啟動同步視聽體驗...")
            
            # 2. 立即播放音頻
            import threading
            def play_audio():
                success = self.audio_manager.play_audio_file_direct(audio_file)
                if success:
                    self.logger.info("🎵 重構版同步音頻播放成功")
                else:
                    self.logger.warning("⚠️ 重構版同步音頻播放失敗")
            
            # 在獨立執行緒中播放音頻，避免阻塞
            threading.Thread(target=play_audio, daemon=True).start()
            
            self.logger.info("✨ 重構版同步視聽體驗啟動完成")
            
        except Exception as e:
            self.logger.error(f"重構版同步視聽啟動失敗: {e}")
            # 備用：播放錯誤音效
            self.audio_manager.play_notification_sound('error')

    def _guess_country_code(self, country_name: str) -> str:
        """根據國家名稱推測國家代碼"""
        country_name = country_name.lower().strip()
        
        # 常見國家名稱對應表
        country_map = {
            'yemen': 'YE',
            'kenya': 'KE',
            'south africa': 'ZA',
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
            'french southern territories': 'TF',
            'russia': 'RU',
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
        self.logger.info("處理長按事件：重新載入重構版網頁")
        
        # 處理螢幕保護器
        self._deactivate_screensaver()
        self._reset_screensaver_timer()
        
        try:
            result = self.web_controller.reload_website()
            
            if result and result.get('success'):
                self.logger.info("重構版網頁重新載入成功")
                
            else:
                self.logger.error("重構版網頁重新載入失敗")
                
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
        self.logger.info("甦醒地圖網頁模式 v2.0 (重構版) 開始運行")
        
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
        
        self.logger.info("正在關閉重構版應用程式...")
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
        
        self.logger.info("重構版應用程式已關閉")

# 重構版網頁控制器
class WebControllerDSIRefactored(WebControllerDSI):
    """重構版網頁控制器 - 連結到 pi-script-refactored.js"""
    
    def __init__(self):
        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.is_refactored = True
    
    def load_website(self):
        """載入重構版網站"""
        try:
            # 使用重構版的HTML文件
            refactored_url = "file:///home/future/pi/subjective-clock/pi-modular.html"
            
            self.logger.info(f"載入重構版網站: {refactored_url}")
            self.driver.get(refactored_url)
            
            # 等待重構版頁面載入
            time.sleep(3)
            
            # 自動填入使用者名稱
            success = self._fill_username()
            if success:
                # 點擊載入資料按鈕
                self._click_load_data_button()
                
            return {'success': True, 'message': '重構版網站載入成功'}
            
        except Exception as e:
            self.logger.error(f"載入重構版網站失敗: {e}")
            return {'success': False, 'message': f'載入重構版網站失敗: {e}'}
    
    def trigger_refactored_wakeup(self):
        """觸發重構版甦醒流程"""
        try:
            self.logger.info("觸發重構版甦醒流程...")
            
            # 使用重構版的 WakeUpManager.startTheDay()
            result = self.driver.execute_script("""
                try {
                    console.log('🚀 重構版：Python觸發甦醒流程');
                    
                    // 檢查重構版管理器是否存在
                    if (typeof WakeUpManager !== 'undefined' && WakeUpManager.startTheDay) {
                        console.log('✅ 重構版：使用 WakeUpManager.startTheDay()');
                        WakeUpManager.startTheDay();
                        return {success: true, method: 'WakeUpManager'};
                    } else if (typeof startTheDay === 'function') {
                        console.log('✅ 重構版：使用傳統 startTheDay()');
                        startTheDay();
                        return {success: true, method: 'traditional'};
                    } else {
                        console.error('❌ 重構版：找不到甦醒函數');
                        return {success: false, error: '找不到甦醒函數'};
                    }
                } catch (error) {
                    console.error('❌ 重構版甦醒流程錯誤:', error);
                    return {success: false, error: error.message};
                }
            """)
            
            self.logger.info(f"重構版甦醒流程結果：{result}")
            
            # 等待處理完成（重構版處理更快）
            time.sleep(5)  # 從原來的8秒減少到5秒
            
            return result if result else {'success': False, 'message': '未知錯誤'}
            
        except Exception as e:
            self.logger.error(f"觸發重構版甦醒流程失敗: {e}")
            return {'success': False, 'message': f'觸發重構版甦醒流程失敗: {e}'}

def main():
    """主函數"""
    global app
    
    # 設定信號處理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 設定日誌
    setup_logging()
    
    logger.info("甦醒地圖網頁模式 v2.0 (重構版) 啟動中...")
    print("甦醒地圖網頁模式 v2.0 (重構版)")
    print("使用重構版前端 pi-script-refactored.js 以提升性能")
    print("請確保按鈕已連接到 GPIO 18")
    
    try:
        # 創建並運行應用程式
        app = WakeUpMapWebAppV2()
        app.run()
        
    except Exception as e:
        logger.error(f"重構版應用程式啟動失敗：{e}")
        sys.exit(1)

if __name__ == "__main__":
    main()