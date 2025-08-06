#!/usr/bin/env python3
"""
甦醒地圖主控程式 v4.0.0
統一管理所有功能模組的主控檔案
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path

# 添加模組路徑
sys.path.append(str(Path(__file__).parent))

from modules.button_handler import ButtonHandler
from modules.audio_manager import AudioManager
from modules.display_manager import DisplayManager
from modules.api_client import APIClient
from modules.firebase_sync import FirebaseSync
from modules.config_manager import ConfigManager
from utils.logger import setup_logger

class WakeUpMapController:
    """甦醒地圖主控制器"""
    
    def __init__(self):
        self.logger = setup_logger(__name__)
        self.config = ConfigManager()
        self.running = False
        
        # 初始化各功能模組
        self.button_handler = None
        self.audio_manager = None
        self.display_manager = None
        self.api_client = None
        self.firebase_sync = None
        
    async def initialize(self):
        """初始化所有模組"""
        try:
            self.logger.info("🚀 甦醒地圖控制器啟動中...")
            
            # 按順序初始化各模組
            self.audio_manager = AudioManager(self.config)
            await self.audio_manager.initialize()
            
            self.display_manager = DisplayManager(self.config)
            await self.display_manager.initialize()
            
            self.api_client = APIClient(self.config)
            
            self.firebase_sync = FirebaseSync(self.config)
            await self.firebase_sync.initialize()
            
            self.button_handler = ButtonHandler(
                self.config, 
                self.on_button_press
            )
            await self.button_handler.initialize()
            
            self.logger.info("✅ 所有模組初始化完成")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 模組初始化失敗: {e}")
            return False
    
    async def on_button_press(self, press_type="short"):
        """按鈕按下事件處理"""
        try:
            self.logger.info(f"🔘 按鈕按下 ({press_type})")
            
            if press_type == "short":
                await self.start_wakeup_process()
            elif press_type == "long":
                await self.show_system_info()
                
        except Exception as e:
            self.logger.error(f"❌ 按鈕事件處理失敗: {e}")
    
    async def start_wakeup_process(self):
        """開始甦醒流程 - Python後端 + JavaScript前端協作"""
        try:
            self.logger.info("🚀 開始甦醒流程...")
            
            # 1. 顯示載入畫面
            await self.display_manager.show_loading()
            
            # 2. 調用API獲取城市資料
            self.logger.info("🌍 調用API尋找城市...")
            city_data = await self.api_client.find_city()
            if not city_data:
                raise Exception("無法獲取城市資料")
            
            # 3. 生成故事內容
            self.logger.info("📖 生成故事內容...")
            story_data = await self.api_client.generate_story(
                city_data.get('name', ''), 
                city_data.get('country', '')
            )
            
            # 4. 生成並播放語音問候（背景執行）
            self.logger.info("🔊 開始音頻生成和播放...")
            audio_task = asyncio.create_task(
                self.audio_manager.generate_and_play_greeting(city_data)
            )
            
            # 5. 同步資料到Firebase（背景執行）
            self.logger.info("🔥 同步資料到Firebase...")
            firebase_task = asyncio.create_task(
                self.firebase_sync.save_record(city_data)
            )
            
            # 6. 立即觸發JavaScript前端流程（包含軌跡視覺化）
            self.logger.info("🖥️ 觸發JavaScript前端流程...")
            await self.display_manager.show_result(city_data)
            
            # 7. 如果有故事，觸發piStoryReady事件
            if story_data:
                await asyncio.sleep(1)  # 稍等確保前端準備好
                await self.display_manager.trigger_pi_story_ready(story_data)
            
            # 8. 等待背景任務完成
            audio_success = await audio_task
            firebase_success = await firebase_task
            
            # 9. 處理錯誤情況
            if not audio_success:
                self.logger.warning("⚠️ 音頻播放失敗")
                await self.audio_manager.play_error_sound()
            
            if not firebase_success:
                self.logger.warning("⚠️ Firebase同步失敗")
            
            self.logger.info("✅ 甦醒流程完成")
            
        except Exception as e:
            self.logger.error(f"❌ 甦醒流程失敗: {e}")
            await self.display_manager.show_error(str(e))
            await self.audio_manager.play_error_sound()
    
    async def show_system_info(self):
        """顯示系統資訊"""
        try:
            info = {
                'version': 'v4.0.0',
                'modules': {
                    'audio': self.audio_manager.is_ready(),
                    'display': self.display_manager.is_ready(),
                    'firebase': self.firebase_sync.is_ready()
                }
            }
            await self.display_manager.show_system_info(info)
            
        except Exception as e:
            self.logger.error(f"❌ 系統資訊顯示失敗: {e}")
    
    async def start(self):
        """啟動主程式"""
        if not await self.initialize():
            return False
        
        self.running = True
        self.logger.info("🌅 甦醒地圖已啟動，等待按鈕按下...")
        
        try:
            # 顯示等待畫面
            await self.display_manager.show_waiting()
            
            # 主事件循環
            while self.running:
                await asyncio.sleep(0.1)
                
        except KeyboardInterrupt:
            self.logger.info("收到中斷信號，正在關閉...")
        except Exception as e:
            self.logger.error(f"主循環錯誤: {e}")
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """清理資源"""
        self.logger.info("🧹 清理資源中...")
        self.running = False
        
        if self.button_handler:
            await self.button_handler.cleanup()
        if self.audio_manager:
            await self.audio_manager.cleanup()
        if self.display_manager:
            await self.display_manager.cleanup()
        if self.firebase_sync:
            await self.firebase_sync.cleanup()
        
        self.logger.info("✅ 清理完成")
    
    def signal_handler(self, signum, frame):
        """信號處理器"""
        self.logger.info(f"收到信號 {signum}，準備關閉...")
        self.running = False

async def main():
    """主函數"""
    controller = WakeUpMapController()
    
    # 設定信號處理
    signal.signal(signal.SIGINT, controller.signal_handler)
    signal.signal(signal.SIGTERM, controller.signal_handler)
    
    # 啟動控制器
    await controller.start()

if __name__ == "__main__":
    asyncio.run(main())