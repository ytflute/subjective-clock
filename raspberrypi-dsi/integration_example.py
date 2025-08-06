#!/usr/bin/env python3
"""
Python + JavaScript 整合範例
展示如何讓 Python 後端觸發 JavaScript 前端處理
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from main_controller import WakeUpMapController

class IntegratedWakeUpController(WakeUpMapController):
    """整合版本的甦醒地圖控制器"""
    
    async def start_wakeup_process(self):
        """完整的整合流程示例"""
        try:
            self.logger.info("🔗 Python + JavaScript 整合流程開始...")
            
            # === Python 後端處理 ===
            self.logger.info("🐍 Python 階段：後端邏輯處理")
            
            # 1. 顯示載入畫面
            await self.display_manager.show_loading()
            
            # 2. API 調用（Python 處理）
            self.logger.info("🌍 Python: 調用API尋找城市")
            city_data = await self.api_client.find_city()
            if not city_data:
                raise Exception("無法獲取城市資料")
            
            # 3. 背景任務：音頻生成（Python 處理）
            self.logger.info("🔊 Python: 開始音頻生成")
            audio_task = asyncio.create_task(
                self.audio_manager.generate_and_play_greeting(city_data)
            )
            
            # 4. 背景任務：Firebase 同步（Python 處理）
            self.logger.info("🔥 Python: Firebase 同步")
            firebase_task = asyncio.create_task(
                self.firebase_sync.save_record(city_data)
            )
            
            # === JavaScript 前端接管 ===
            self.logger.info("🌐 JavaScript 階段：UI 和視覺效果處理")
            
            # 5. 觸發 JavaScript 前端流程
            await self._trigger_javascript_flow(city_data)
            
            # 6. 等待 Python 背景任務完成
            self.logger.info("⏱️ 等待 Python 背景任務完成...")
            audio_success = await audio_task
            firebase_success = await firebase_task
            
            # 7. 後續處理
            await self._handle_completion(audio_success, firebase_success)
            
            self.logger.info("✅ 整合流程完成")
            
        except Exception as e:
            self.logger.error(f"❌ 整合流程失敗: {e}")
            await self.display_manager.show_error(str(e))
    
    async def _trigger_javascript_flow(self, city_data):
        """觸發 JavaScript 前端流程"""
        try:
            # 設定全域變數給 JavaScript 使用
            self.logger.info("📤 設定 JavaScript 全域變數")
            await self.display_manager.execute_js(f"""
            // 設定城市資料
            window.currentCityData = {json.dumps(city_data)};
            console.log('🔄 Python 設定城市資料:', window.currentCityData);
            
            // 設定用戶資訊
            window.rawUserDisplayName = 'future';
            console.log('👤 Python 設定用戶:', window.rawUserDisplayName);
            """)
            
            # 觸發 displayAwakeningResult (包含完整的 v4.0.0 流程)
            self.logger.info("🎯 觸發 displayAwakeningResult")
            await self.display_manager.execute_js("""
            if (typeof displayAwakeningResult === 'function') {
                console.log('🚀 Python 觸發 displayAwakeningResult');
                displayAwakeningResult(window.currentCityData);
            } else {
                console.warn('⚠️ displayAwakeningResult 函數不存在');
                console.log('📋 可用函數:', Object.keys(window).filter(k => typeof window[k] === 'function'));
            }
            """)
            
            # 稍等片刻，然後觸發故事準備事件
            await asyncio.sleep(2)
            self.logger.info("📖 生成並觸發故事內容")
            
            # 生成故事
            story_data = await self.api_client.generate_story(
                city_data.get('name', ''), 
                city_data.get('country', '')
            )
            
            if story_data:
                # 觸發 piStoryReady 事件
                await self.display_manager.execute_js(f"""
                console.log('🎵 Python 觸發 piStoryReady 事件');
                const storyData = {json.dumps(story_data)};
                const event = new CustomEvent('piStoryReady', {{
                    detail: storyData
                }});
                window.dispatchEvent(event);
                """)
            
        except Exception as e:
            self.logger.error(f"❌ JavaScript 流程觸發失敗: {e}")
    
    async def _handle_completion(self, audio_success, firebase_success):
        """處理完成狀態"""
        if not audio_success:
            self.logger.warning("⚠️ 音頻播放失敗")
            await self.audio_manager.play_error_sound()
        
        if not firebase_success:
            self.logger.warning("⚠️ Firebase 同步失敗")
        
        # 向前端發送完成狀態
        await self.display_manager.execute_js(f"""
        console.log('✅ Python 後端處理完成');
        console.log('🔊 音頻狀態:', {str(audio_success).lower()});
        console.log('🔥 Firebase 狀態:', {str(firebase_success).lower()});
        """)

async def main():
    """整合示例主函數"""
    print("🔗 啟動 Python + JavaScript 整合示例...")
    
    controller = IntegratedWakeUpController()
    
    # 設定測試模式
    print("🧪 注意：這是整合測試模式")
    print("📋 功能展示：")
    print("   🐍 Python: API調用、音頻生成、Firebase同步")
    print("   🌐 JavaScript: UI顯示、地圖視覺化、軌跡繪製")
    print("   🔗 整合: Python觸發 + JavaScript處理")
    
    await controller.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 整合示例已停止")
    except Exception as e:
        print(f"❌ 整合示例錯誤: {e}")
        sys.exit(1)