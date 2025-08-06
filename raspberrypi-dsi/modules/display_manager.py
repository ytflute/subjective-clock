"""
顯示管理模組
統一處理網頁顯示和狀態管理
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, Any

try:
    import webview
    WEBVIEW_AVAILABLE = True
except ImportError:
    WEBVIEW_AVAILABLE = False

from utils.logger import LoggerMixin

class DisplayManager(LoggerMixin):
    """顯示管理器"""
    
    def __init__(self, config_manager):
        self.config = config_manager
        self.screen_config = config_manager.get_screen_config()
        
        self.width = self.screen_config.get('width', 800)
        self.height = self.screen_config.get('height', 480)
        self.fullscreen = self.screen_config.get('fullscreen', False)
        
        self.window = None
        self.initialized = False
        self.current_state = 'waiting'
    
    async def initialize(self):
        """初始化顯示系統"""
        try:
            if not WEBVIEW_AVAILABLE:
                self.logger.warning("⚠️ pywebview 不可用，使用模擬模式")
                self.initialized = True
                return True
            
            # 設定網頁路徑
            html_file = Path(__file__).parent.parent.parent / "pi.html"
            if not html_file.exists():
                raise Exception(f"HTML檔案不存在: {html_file}")
            
            # 創建webview視窗
            self.window = webview.create_window(
                title='WakeUpMap 甦醒地圖',
                url=str(html_file),
                width=self.width,
                height=self.height,
                fullscreen=self.fullscreen,
                resizable=True
            )
            
            # 啟動webview（非阻塞）
            asyncio.create_task(self._start_webview())
            
            self.logger.info(f"✅ 顯示管理器初始化完成 ({self.width}x{self.height})")
            self.initialized = True
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 顯示系統初始化失敗: {e}")
            return False
    
    async def _start_webview(self):
        """啟動webview"""
        try:
            webview.start(debug=False)
        except Exception as e:
            self.logger.error(f"❌ webview啟動失敗: {e}")
    
    async def show_waiting(self):
        """顯示等待畫面"""
        await self._set_state('waiting')
    
    async def show_loading(self):
        """顯示載入畫面"""
        await self._set_state('loading')
    
    async def show_result(self, city_data: Dict):
        """顯示結果畫面"""
        # 觸發 JavaScript 的完整流程，包括軌跡視覺化
        await self._trigger_wakeup_process(city_data)
    
    async def show_error(self, error_message: str):
        """顯示錯誤畫面"""
        await self._set_state('error', {'message': error_message})
    
    async def show_system_info(self, info: Dict):
        """顯示系統資訊"""
        self.logger.info(f"🖥️ 系統資訊: {info}")
        # 可以實現彈出視窗或狀態顯示
    
    async def _set_state(self, state: str, data: Any = None):
        """設定顯示狀態"""
        try:
            self.current_state = state
            
            if not WEBVIEW_AVAILABLE:
                self.logger.info(f"🖥️ 模擬顯示狀態: {state}")
                if data:
                    self.logger.info(f"🖥️ 顯示資料: {data}")
                return
            
            # 向網頁發送狀態更新
            if self.window:
                js_code = f"""
                if (window.setState) {{
                    window.setState('{state}');
                }}
                if (window.updateResultData && {json.dumps(data) if data else 'null'}) {{
                    window.updateResultData({json.dumps(data)});
                }}
                """
                
                try:
                    self.window.evaluate_js(js_code)
                    self.logger.debug(f"🖥️ 狀態更新: {state}")
                except Exception as e:
                    self.logger.warning(f"⚠️ JavaScript執行失敗: {e}")
            
        except Exception as e:
            self.logger.error(f"❌ 顯示狀態設定失敗: {e}")
    
    async def _trigger_wakeup_process(self, city_data: Dict):
        """觸發 JavaScript 的完整甦醒流程"""
        try:
            if not WEBVIEW_AVAILABLE:
                self.logger.info("🖥️ 模擬觸發甦醒流程")
                self.logger.info(f"🖥️ 城市資料: {city_data.get('name')}, {city_data.get('country')}")
                return
            
            # 設定城市資料到 window 物件
            js_set_data = f"""
            window.currentCityData = {json.dumps(city_data)};
            console.log('🔄 Python設定城市資料:', window.currentCityData);
            """
            await self.execute_js(js_set_data)
            
            # 觸發 displayAwakeningResult，這會啟動完整的 v4.0.0 流程
            js_trigger = f"""
            if (window.displayAwakeningResult) {{
                console.log('🚀 Python觸發 displayAwakeningResult');
                window.displayAwakeningResult(window.currentCityData);
            }} else {{
                console.warn('⚠️ displayAwakeningResult 函數不存在');
            }}
            """
            await self.execute_js(js_trigger)
            
            self.logger.info("✅ 已觸發 JavaScript 甦醒流程")
            
        except Exception as e:
            self.logger.error(f"❌ 觸發甦醒流程失敗: {e}")
    
    async def trigger_pi_story_ready(self, story_data: Dict):
        """觸發 piStoryReady 事件"""
        try:
            js_code = f"""
            console.log('🎵 Python觸發 piStoryReady 事件');
            const event = new CustomEvent('piStoryReady', {{
                detail: {json.dumps(story_data)}
            }});
            window.dispatchEvent(event);
            """
            await self.execute_js(js_code)
            self.logger.info("✅ 已觸發 piStoryReady 事件")
            
        except Exception as e:
            self.logger.error(f"❌ 觸發 piStoryReady 事件失敗: {e}")
    
    async def execute_js(self, js_code: str):
        """執行JavaScript代碼"""
        try:
            if self.window and WEBVIEW_AVAILABLE:
                result = self.window.evaluate_js(js_code)
                return result
            else:
                self.logger.debug(f"🖥️ 模擬JS執行: {js_code[:50]}...")
                
        except Exception as e:
            self.logger.error(f"❌ JavaScript執行失敗: {e}")
            return None
    
    def is_ready(self) -> bool:
        """檢查顯示管理器是否就緒"""
        return self.initialized
    
    async def cleanup(self):
        """清理顯示資源"""
        try:
            if self.window and WEBVIEW_AVAILABLE:
                self.window.destroy()
            self.logger.info("✅ 顯示管理器清理完成")
            self.initialized = False
        except Exception as e:
            self.logger.error(f"❌ 顯示清理失敗: {e}")

class MockDisplayManager(DisplayManager):
    """模擬顯示管理器（用於測試）"""
    
    async def initialize(self):
        """模擬初始化"""
        self.logger.info("✅ 模擬顯示管理器初始化完成")
        self.initialized = True
        return True
    
    async def _set_state(self, state: str, data: Any = None):
        """模擬狀態設定"""
        self.current_state = state
        self.logger.info(f"🖥️ 模擬顯示狀態: {state}")
        if data:
            self.logger.info(f"🖥️ 顯示資料: {json.dumps(data, ensure_ascii=False)[:100]}...")
    
    async def cleanup(self):
        """模擬清理"""
        self.logger.info("✅ 模擬顯示管理器清理完成")
        self.initialized = False