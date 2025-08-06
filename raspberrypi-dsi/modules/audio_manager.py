"""
音頻管理模組
統一處理TTS語音生成和音頻播放
"""

import asyncio
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Optional

from utils.logger import LoggerMixin

class AudioManager(LoggerMixin):
    """音頻管理器"""
    
    def __init__(self, config_manager):
        self.config = config_manager
        self.audio_config = config_manager.get_audio_config()
        self.tts_config = config_manager.get_tts_config()
        
        self.enabled = self.audio_config.get('enabled', True)
        self.volume = self.audio_config.get('volume', 80)
        self.engine = self.tts_config.get('engine', 'festival')
        self.nova_mode = config_manager.is_nova_mode_enabled()
        
        self.openai_client = None
        self.initialized = False
    
    async def initialize(self):
        """初始化音頻系統"""
        try:
            if not self.enabled:
                self.logger.info("⚠️ 音頻系統已停用")
                self.initialized = True
                return True
            
            # 設定系統音量
            await self._set_system_volume()
            
            # 初始化TTS引擎
            if self.nova_mode:
                await self._init_openai_tts()
            else:
                await self._init_festival_tts()
            
            self.logger.info(f"✅ 音頻管理器初始化完成 (引擎: {self.engine})")
            self.initialized = True
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 音頻系統初始化失敗: {e}")
            return False
    
    async def _set_system_volume(self):
        """設定系統音量"""
        try:
            cmd = ['amixer', 'sset', 'PCM', f'{self.volume}%']
            result = await asyncio.create_subprocess_exec(
                *cmd, 
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
            self.logger.info(f"🔊 系統音量設定為 {self.volume}%")
        except Exception as e:
            self.logger.warning(f"⚠️ 音量設定失敗: {e}")
    
    async def _init_openai_tts(self):
        """初始化OpenAI TTS"""
        try:
            openai_config = self.config.get_openai_config()
            api_key = openai_config.get('api_key', '')
            
            if not api_key:
                raise Exception("OpenAI API key 未設定")
            
            # 這裡應該初始化OpenAI客戶端
            # 為了簡化，暫時標記為未實現
            self.logger.warning("⚠️ OpenAI TTS 初始化跳過（需要完整實現）")
            
        except Exception as e:
            self.logger.error(f"❌ OpenAI TTS 初始化失敗: {e}")
            # 降級到Festival
            await self._init_festival_tts()
    
    async def _init_festival_tts(self):
        """初始化Festival TTS"""
        try:
            # 檢查Festival是否可用
            result = await asyncio.create_subprocess_exec(
                'festival', '--version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            
            if result.returncode == 0:
                self.engine = 'festival'
                self.logger.info("✅ Festival TTS 可用")
            else:
                raise Exception("Festival 不可用")
                
        except Exception as e:
            self.logger.warning(f"⚠️ Festival TTS 不可用: {e}")
            self.engine = 'mock'
    
    async def generate_and_play_greeting(self, city_data: Dict) -> bool:
        """生成並播放問候語 - 與後端TTS系統協作"""
        try:
            if not self.enabled:
                self.logger.info("🔇 音頻已停用，跳過語音生成")
                return True
            
            city = city_data.get('name', '未知城市')
            country = city_data.get('country', '未知國家')
            
            self.logger.info(f"🎵 為 {city}, {country} 生成語音問候")
            
            # 方案1: 如果有Nova模式，調用後端TTS API
            if self.nova_mode:
                return await self._call_backend_tts(city, country)
            
            # 方案2: 使用本地Festival TTS
            else:
                return await self._generate_festival_greeting(city, country)
                
        except Exception as e:
            self.logger.error(f"❌ 語音生成失敗: {e}")
            return False
    
    async def _call_backend_tts(self, city: str, country: str) -> bool:
        """調用後端TTS API生成語音"""
        try:
            # 這裡可以調用現有的後端TTS系統
            # 例如：main_web_dsi.py 中的音頻生成邏輯
            
            self.logger.info("🎵 調用後端TTS系統...")
            
            # 模擬調用，實際可以：
            # 1. 調用 audio_manager.py 的TTS功能
            # 2. 或者觸發現有的語音生成流程
            # 3. 或者通過subprocess調用原有腳本
            
            # 這裡先用Festival替代
            return await self._generate_festival_greeting(city, country)
            
        except Exception as e:
            self.logger.error(f"❌ 後端TTS調用失敗: {e}")
            return False
    
    async def _generate_festival_greeting(self, city: str, country: str) -> bool:
        """使用Festival生成問候語"""
        try:
            text = f"Good morning! Today you wake up in {city}, {country}."
            
            if self.engine == 'mock':
                self.logger.info(f"🔊 模擬播放: {text}")
                await asyncio.sleep(2)  # 模擬播放時間
                return True
            
            # 使用Festival合成語音
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                cmd = [
                    'festival', '--tts', 
                    '--batch', f'(voice_kal_diphone)',
                    f'(SayText "{text}")',
                    '--output', temp_file.name
                ]
                
                result = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await result.communicate()
                
                if result.returncode == 0:
                    # 播放音頻文件
                    await self._play_audio_file(temp_file.name)
                    return True
                else:
                    raise Exception("Festival 合成失敗")
                    
        except Exception as e:
            self.logger.error(f"❌ Festival 語音生成失敗: {e}")
            return False
    
    async def _generate_nova_greeting(self, city: str, country: str) -> bool:
        """使用Nova生成問候語（待實現）"""
        self.logger.warning("⚠️ Nova模式暫未實現，使用Festival替代")
        return await self._generate_festival_greeting(city, country)
    
    async def _play_audio_file(self, file_path: str):
        """播放音頻文件"""
        try:
            cmd = ['aplay', file_path]
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
            
            # 清理臨時文件
            Path(file_path).unlink(missing_ok=True)
            
        except Exception as e:
            self.logger.error(f"❌ 音頻播放失敗: {e}")
    
    async def play_error_sound(self):
        """播放錯誤提示音"""
        try:
            if not self.enabled:
                return
            
            # 播放系統錯誤音
            cmd = ['speaker-test', '-t', 'wav', '-c', '1', '-l', '1']
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await result.communicate()
            
        except Exception as e:
            self.logger.warning(f"⚠️ 錯誤提示音播放失敗: {e}")
    
    def is_ready(self) -> bool:
        """檢查音頻管理器是否就緒"""
        return self.initialized
    
    async def cleanup(self):
        """清理音頻資源"""
        try:
            self.logger.info("🧹 音頻管理器清理完成")
            self.initialized = False
        except Exception as e:
            self.logger.error(f"❌ 音頻清理失敗: {e}")