#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - 音頻管理模組
處理 TTS 語音生成、音頻播放和音量控制
"""

import os
import time
import threading
import logging
import hashlib
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False

from config import (
    AUDIO_CONFIG, 
    TTS_CONFIG, 
    SPEAKER_CONFIG,
    MORNING_GREETINGS,
    TTS_LANGUAGE_MAP,
    AUDIO_FILES
)

class AudioManager:
    """音頻管理器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.tts_engine = None
        self.audio_initialized = False
        self.current_volume = AUDIO_CONFIG['volume']
        self.cache_dir = Path(TTS_CONFIG['cache_dir'])
        
        # 確保快取目錄存在
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始化音頻系統
        self._initialize_audio()
        
        # 初始化 TTS 引擎
        self._initialize_tts()
        
        # 清理過期快取
        self._cleanup_cache()
    
    def _initialize_audio(self):
        """初始化音頻系統"""
        try:
            if not AUDIO_CONFIG['enabled']:
                self.logger.info("音頻功能已禁用")
                return
            
            # 嘗試初始化 pygame mixer
            if PYGAME_AVAILABLE:
                try:
                    pygame.mixer.pre_init(
                        frequency=AUDIO_CONFIG['sample_rate'],
                        size=-16,
                        channels=AUDIO_CONFIG['channels'],
                        buffer=512
                    )
                    pygame.mixer.init()
                    self.audio_initialized = True
                    self.logger.info("Pygame 音頻系統初始化成功")
                except Exception as e:
                    self.logger.warning(f"Pygame 初始化失敗: {e}")
            
            # 如果 pygame 不可用，使用 ALSA
            if not self.audio_initialized:
                self._check_alsa_audio()
            
            # 設置音量
            self.set_volume(self.current_volume)
            
        except Exception as e:
            self.logger.error(f"音頻系統初始化失敗: {e}")
    
    def _check_alsa_audio(self):
        """檢查 ALSA 音頻系統"""
        try:
            # 檢查 ALSA 設備
            result = subprocess.run(['aplay', '-l'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            if result.returncode == 0:
                self.audio_initialized = True
                self.logger.info("ALSA 音頻系統可用")
            else:
                self.logger.warning("ALSA 音頻設備檢查失敗")
        except Exception as e:
            self.logger.warning(f"ALSA 檢查失敗: {e}")
    
    def _initialize_tts(self):
        """初始化 TTS 引擎"""
        try:
            if TTS_CONFIG['engine'] == 'festival':
                # 檢查 Festival 是否可用
                try:
                    result = subprocess.run(['festival', '--version'], 
                                          capture_output=True, timeout=5)
                    if result.returncode == 0:
                        self.logger.info("Festival TTS 引擎初始化成功")
                        # 檢查可用的女性聲音
                        self._check_festival_voices()
                    else:
                        self.logger.warning("Festival 不可用，回退到 espeak")
                        TTS_CONFIG['engine'] = 'espeak'
                except Exception as e:
                    self.logger.warning(f"Festival 檢查失敗: {e}，回退到 espeak")
                    TTS_CONFIG['engine'] = 'espeak'
                    
            elif TTS_CONFIG['engine'] == 'pyttsx3' and PYTTSX3_AVAILABLE:
                self.tts_engine = pyttsx3.init()
                
                # 設置語速
                self.tts_engine.setProperty('rate', TTS_CONFIG['speed'])
                
                # 設置女性聲音
                self._set_female_voice_pyttsx3()
                
                self.logger.info("pyttsx3 TTS 引擎初始化成功")
            else:
                self.logger.info("使用系統 TTS 引擎（espeak）")
                
        except Exception as e:
            self.logger.error(f"TTS 引擎初始化失敗: {e}")

    def _check_festival_voices(self):
        """檢查 Festival 可用的聲音"""
        try:
            # 檢查可用聲音
            available_voices = []
            for voice in TTS_CONFIG['festival_female_voices']:
                # 測試聲音是否可用
                test_cmd = f'echo "test" | festival --tts --voice {voice}'
                try:
                    result = subprocess.run(test_cmd, shell=True, 
                                          capture_output=True, timeout=10)
                    if result.returncode == 0:
                        available_voices.append(voice)
                        self.logger.info(f"✅ Festival 聲音可用: {voice}")
                    else:
                        self.logger.debug(f"❌ Festival 聲音不可用: {voice}")
                except:
                    pass
            
            if available_voices:
                TTS_CONFIG['festival_voice'] = available_voices[0]
                self.logger.info(f"選擇 Festival 女性聲音: {TTS_CONFIG['festival_voice']}")
            else:
                # 使用預設聲音
                self.logger.warning("未找到女性聲音，使用預設聲音")
                
        except Exception as e:
            self.logger.warning(f"檢查 Festival 聲音失敗: {e}")

    def _set_female_voice_pyttsx3(self):
        """設置 pyttsx3 的女性聲音"""
        try:
            voices = self.tts_engine.getProperty('voices')
            if voices:
                # 尋找女性聲音
                female_voice = None
                for voice in voices:
                    voice_name = voice.name.lower()
                    voice_id = voice.id.lower()
                    
                    # 檢查是否為女性聲音
                    if any(keyword in voice_name or keyword in voice_id 
                           for keyword in ['female', 'woman', 'girl', 'zira', 'hazel', 'anna']):
                        female_voice = voice
                        break
                
                if female_voice:
                    self.tts_engine.setProperty('voice', female_voice.id)
                    self.logger.info(f"設置女性聲音: {female_voice.name}")
                else:
                    self.logger.warning("未找到女性聲音，使用預設聲音")
                    if voices:
                        self.tts_engine.setProperty('voice', voices[0].id)
            
        except Exception as e:
            self.logger.warning(f"設置女性聲音失敗: {e}")
    
    def play_greeting(self, country_code: str, city_name: str = "", country_name: str = "") -> bool:
        """
        播放早安問候語和城市故事（新版本：使用 ChatGPT API）
        
        Args:
            country_code: 國家代碼
            city_name: 城市名稱
            country_name: 國家名稱
        
        Returns:
            bool: 播放是否成功
        """
        try:
            if not AUDIO_CONFIG['enabled']:
                self.logger.info("音頻功能已禁用，跳過音頻播放")
                return True
            
            # 從 ChatGPT API 獲取問候語和故事
            greeting_data = self._fetch_greeting_and_story_from_api(city_name, country_name, country_code)
            
            if greeting_data:
                success = True
                
                # 1. 播放當地語言問候語
                greeting_text = greeting_data['greeting']
                language_code = greeting_data['languageCode']
                self.logger.info(f"播放當地語言問候語: {greeting_text} ({greeting_data['language']})")
                
                greeting_success = self._play_text_with_language(greeting_text, language_code)
                if not greeting_success:
                    self.logger.warning("當地語言問候語播放失敗")
                    success = False
                
                # 2. 播放中文故事（如果有的話）
                if greeting_data.get('chineseStory'):
                    import time
                    time.sleep(1)  # 短暫停頓
                    
                    story_text = greeting_data['chineseStory']
                    self.logger.info(f"播放中文故事: {story_text}")
                    
                    story_success = self._play_text_with_language(story_text, 'zh')
                    if not story_success:
                        self.logger.warning("中文故事播放失敗")
                        success = False
                
                return success
            else:
                # 備用方案：使用內建問候語
                self.logger.warning("ChatGPT API 失敗，使用備用問候語")
                greeting_text = self._get_greeting_text(country_code, city_name)
                language_code = self._get_language_code(country_code)
                return self._play_text_with_language(greeting_text, language_code)
                
        except Exception as e:
            self.logger.error(f"播放問候語失敗: {e}")
            return False

    def _play_text_with_language(self, text: str, language_code: str) -> bool:
        """
        播放指定語言的文字
        
        Args:
            text: 要播放的文字
            language_code: 語言代碼
        
        Returns:
            bool: 播放是否成功
        """
        try:
            # 檢查快取
            audio_file = self._get_cached_audio(text, language_code)
            
            if not audio_file:
                # 生成新的音頻文件
                audio_file = self._generate_audio(text, language_code)
            
            if audio_file and audio_file.exists():
                # 播放音頻
                return self._play_audio_file(audio_file)
            else:
                self.logger.error(f"無法生成或找到音頻文件: {text}")
                return False
                
        except Exception as e:
            self.logger.error(f"播放文字失敗: {e}")
            return False

    def _fetch_greeting_and_story_from_api(self, city: str, country: str, country_code: str) -> Optional[Dict[str, Any]]:
        """
        從 ChatGPT API 獲取當地語言問候語和中文故事
        
        Args:
            city: 城市名稱
            country: 國家名稱
            country_code: 國家代碼
        
        Returns:
            Dict: 問候語和故事資料，包含 greeting, language, languageCode, chineseStory 等
        """
        try:
            import requests
            import json
            
            # API 端點
            from config import API_ENDPOINTS
            api_url = API_ENDPOINTS['generate_morning_greeting']
            
            # 請求資料（添加故事生成請求）
            request_data = {
                "city": city,
                "country": country,
                "countryCode": country_code,
                "includeStory": True  # 請求生成中文故事
            }
            
            self.logger.info(f"調用問候語和故事 API: {api_url}")
            self.logger.info(f"請求資料: {request_data}")  # 改為 INFO 級別以便在日誌中看到
            
            # 發送請求
            response = requests.post(
                api_url,
                json=request_data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and result.get('data'):
                    greeting_data = result['data']
                    story_info = " + 故事" if greeting_data.get('chineseStory') else ""
                    self.logger.info(f"API 返回問候語{story_info}: {greeting_data['greeting']} ({greeting_data['language']})")
                    return greeting_data
                else:
                    self.logger.warning(f"API 返回格式錯誤: {result}")
                    return None
            else:
                self.logger.error(f"API 請求失敗: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.logger.error(f"調用問候語 API 時發生錯誤: {e}")
            return None
    
    def _get_greeting_text(self, country_code: str, city_name: str = "") -> str:
        """獲取問候語文本"""
        # 根據國家代碼確定語言
        language_map = {
            'TW': 'zh-TW', 'CN': 'zh-CN', 'HK': 'zh-TW', 'MO': 'zh-TW',
            'JP': 'ja', 'KR': 'ko', 'US': 'en', 'GB': 'en', 'AU': 'en',
            'ES': 'es', 'FR': 'fr', 'DE': 'de', 'IT': 'it', 'PT': 'pt',
            'RU': 'ru', 'TH': 'th', 'VN': 'vi', 'IN': 'hi'
        }
        
        language = language_map.get(country_code.upper(), 'default')
        greeting = MORNING_GREETINGS.get(language, MORNING_GREETINGS['default'])
        
        # 如果有城市名稱，可以添加到問候語中
        if city_name:
            if language.startswith('zh'):
                greeting = f"來自{city_name}的{greeting}"
            elif language == 'en':
                greeting = f"Good morning from {city_name}! {greeting}"
            elif language == 'ja':
                greeting = f"{city_name}から{greeting}"
        
        return greeting
    
    def _get_language_code(self, country_code: str) -> str:
        """獲取 TTS 語言代碼"""
        language_map = {
            'TW': 'zh-TW', 'CN': 'zh-CN', 'HK': 'zh-TW', 'MO': 'zh-TW',
            'JP': 'ja', 'KR': 'ko', 'US': 'en', 'GB': 'en', 'AU': 'en',
            'ES': 'es', 'FR': 'fr', 'DE': 'de', 'IT': 'it', 'PT': 'pt',
            'RU': 'ru', 'TH': 'th', 'VN': 'vi', 'IN': 'hi'
        }
        
        language = language_map.get(country_code.upper(), 'default')
        return TTS_LANGUAGE_MAP.get(language, TTS_LANGUAGE_MAP['default'])
    
    def _get_cached_audio(self, text: str, language: str) -> Optional[Path]:
        """檢查快取中是否有對應的音頻文件"""
        if not TTS_CONFIG['cache_enabled']:
            return None
        
        # 生成文本的哈希值作為文件名
        text_hash = hashlib.md5(f"{text}_{language}".encode()).hexdigest()
        audio_file = self.cache_dir / f"greeting_{language}_{text_hash}.wav"
        
        if audio_file.exists():
            # 檢查文件是否過期
            file_age = time.time() - audio_file.stat().st_mtime
            if file_age < AUDIO_FILES['cache_timeout']:
                self.logger.debug(f"使用快取音頻文件: {audio_file}")
                return audio_file
            else:
                # 刪除過期文件
                audio_file.unlink()
        
        return None
    
    def _generate_audio(self, text: str, language: str) -> Optional[Path]:
        """生成音頻文件"""
        try:
            text_hash = hashlib.md5(f"{text}_{language}".encode()).hexdigest()
            audio_file = self.cache_dir / f"greeting_{language}_{text_hash}.wav"
            
            if TTS_CONFIG['engine'] == 'festival':
                # 使用 Festival（更自然的聲音）
                return self._generate_audio_festival(text, audio_file)
                
            elif TTS_CONFIG['engine'] == 'pyttsx3' and self.tts_engine:
                # 使用 pyttsx3
                self.tts_engine.save_to_file(text, str(audio_file))
                self.tts_engine.runAndWait()
                
            else:
                # 使用 espeak（備用方案，優化參數）
                return self._generate_audio_espeak(text, language, audio_file)
            
            if audio_file.exists():
                self.logger.info(f"音頻文件生成成功: {audio_file}")
                return audio_file
            else:
                self.logger.error("音頻文件生成失敗")
                return None
                
        except Exception as e:
            self.logger.error(f"生成音頻失敗: {e}")
            return None

    def _generate_audio_festival(self, text: str, audio_file: Path) -> Optional[Path]:
        """使用 Festival 生成音頻"""
        try:
            # 創建 Festival 腳本
            festival_script = f"""
(voice_{TTS_CONFIG['festival_voice']})
(Parameter.set 'Audio_Method 'Audio_Command)
(Parameter.set 'Audio_Command "sox -t raw -r 16000 -s -w -c 1 - -t wav {audio_file}")
(Parameter.set 'Duration_Stretch {1.0 if TTS_CONFIG['speed'] >= 150 else 1.2})
(SayText "{text}")
"""
            
            # 執行 Festival
            process = subprocess.Popen(['festival'], 
                                     stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE,
                                     text=True)
            
            stdout, stderr = process.communicate(input=festival_script, timeout=30)
            
            if process.returncode == 0 and audio_file.exists():
                # 後處理：提高音質
                self._enhance_audio_quality(audio_file)
                self.logger.info(f"Festival 音頻生成成功: {audio_file}")
                return audio_file
            else:
                self.logger.error(f"Festival 失敗: {stderr}")
                return None
                
        except Exception as e:
            self.logger.error(f"Festival 音頻生成失敗: {e}")
            return None

    def _generate_audio_espeak(self, text: str, language: str, audio_file: Path) -> Optional[Path]:
        """使用優化的 espeak 生成音頻"""
        try:
            # 優化的 espeak 參數
            cmd = [
                'espeak',
                '-s', str(max(120, TTS_CONFIG['speed'] - 20)),  # 稍微放慢語速
                '-a', '100',  # 音量
                '-g', '5',    # 詞間停頓
                '-p', '40',   # 音調（較低，更女性化）
                '-v', f"{language}+f3",  # 語言 + 女性聲音變體
                '-w', str(audio_file),
                text
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            if result.returncode == 0 and audio_file.exists():
                # 後處理：提高音質
                self._enhance_audio_quality(audio_file)
                self.logger.info(f"espeak 音頻生成成功: {audio_file}")
                return audio_file
            else:
                self.logger.error(f"espeak 失敗: {result.stderr}")
                return None
                
        except Exception as e:
            self.logger.error(f"espeak 音頻生成失敗: {e}")
            return None

    def _enhance_audio_quality(self, audio_file: Path):
        """使用 sox 提高音頻質量"""
        try:
            # 檢查 sox 是否可用
            result = subprocess.run(['sox', '--version'], 
                                  capture_output=True, timeout=5)
            if result.returncode != 0:
                return
            
            # 創建臨時文件用於處理
            temp_file = audio_file.with_suffix('.temp.wav')
            
            # sox 音質增強處理
            enhancement_cmd = [
                'sox', str(audio_file), str(temp_file),
                'rate', str(TTS_CONFIG.get('sample_rate_override', 22050)),  # 提高採樣率
                'reverb', '20', '0.5',  # 輕微混響
                'equalizer', '1000', '0.5', '2',  # 增強中頻
                'compand', '0.3,1', '6:-70,-60,-20', '-5',  # 壓縮和標準化
                'norm', '-1'  # 標準化音量
            ]
            
            result = subprocess.run(enhancement_cmd, 
                                  capture_output=True, timeout=30)
            
            if result.returncode == 0 and temp_file.exists():
                # 替換原文件
                temp_file.replace(audio_file)
                self.logger.debug("音質增強完成")
            else:
                # 如果增強失敗，刪除臨時文件
                if temp_file.exists():
                    temp_file.unlink()
                    
        except Exception as e:
            self.logger.debug(f"音質增強失敗（非致命錯誤）: {e}")
    
    def _play_audio_file(self, audio_file: Path) -> bool:
        """播放音頻文件"""
        try:
            if PYGAME_AVAILABLE and self.audio_initialized:
                # 使用 pygame 播放
                pygame.mixer.music.load(str(audio_file))
                pygame.mixer.music.play()
                
                # 等待播放完成
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
                
                self.logger.info("音頻播放完成（pygame）")
                return True
            else:
                # 使用 aplay 播放
                result = subprocess.run(['aplay', str(audio_file)], 
                                      capture_output=True, 
                                      timeout=30)
                if result.returncode == 0:
                    self.logger.info("音頻播放完成（aplay）")
                    return True
                else:
                    self.logger.error(f"aplay 播放失敗: {result.stderr}")
                    return False
                    
        except Exception as e:
            self.logger.error(f"音頻播放失敗: {e}")
            return False
    
    def set_volume(self, volume: int) -> bool:
        """
        設置音量
        
        Args:
            volume: 音量 (0-100)
        
        Returns:
            bool: 設置是否成功
        """
        try:
            volume = max(0, min(100, volume))  # 限制範圍
            
            # 嘗試不同的音量控制名稱
            volume_controls = ['PCM', 'Master', 'Speaker', 'Headphone', 'HDMI']
            
            for control in volume_controls:
                try:
                    # 使用 amixer 設置系統音量
                    result = subprocess.run([
                        'amixer', 'sset', control, f'{volume}%'
                    ], capture_output=True, timeout=5)
                    
                    if result.returncode == 0:
                        self.current_volume = volume
                        self.logger.info(f"音量設置為: {volume}% (使用 {control} 控制)")
                        return True
                    else:
                        self.logger.debug(f"嘗試 {control} 控制失敗: {result.stderr.decode().strip()}")
                        
                except Exception as e:
                    self.logger.debug(f"嘗試 {control} 控制時發生錯誤: {e}")
                    continue
            
            # 如果所有控制都失敗，記錄警告但不阻止程序運行
            self.logger.warning("無法設置音量，但音頻播放可能仍然正常")
            self.current_volume = volume
            return True
                
        except Exception as e:
            self.logger.error(f"音量設置失敗: {e}")
            return False

    def play_notification_sound(self, sound_type: str = 'success') -> bool:
        """
        播放通知音效
        
        Args:
            sound_type: 音效類型 ('success', 'error', 'click')
        
        Returns:
            bool: 播放是否成功
        """
        try:
            if not AUDIO_CONFIG['enabled']:
                self.logger.debug("音頻功能已禁用，跳過通知音效")
                return True
            
            # 根據音效類型選擇不同的問候語
            if sound_type == 'success':
                # 播放簡短的成功音效（使用英語 "Great!"）
                return self.play_greeting('US', '', 'United States')
            elif sound_type == 'error':
                # 播放錯誤提示音
                self.logger.info("播放錯誤提示音")
                return self._play_simple_beep()
            elif sound_type == 'click':
                # 播放點擊音效
                self.logger.info("播放點擊音效")
                return self._play_simple_beep(frequency=800, duration=0.1)
            else:
                self.logger.warning(f"未知的音效類型: {sound_type}")
                return False
                
        except Exception as e:
            self.logger.error(f"播放通知音效失敗: {e}")
            return False

    def _play_simple_beep(self, frequency: int = 440, duration: float = 0.2) -> bool:
        """
        播放簡單的嗶聲
        
        Args:
            frequency: 頻率 (Hz)
            duration: 持續時間 (秒)
        
        Returns:
            bool: 播放是否成功
        """
        try:
            # 使用 speaker-test 生成簡單的測試音
            result = subprocess.run([
                'speaker-test', '-t', 'sine', '-f', str(frequency), 
                '-l', '1', '-s', '1'
            ], capture_output=True, timeout=5)
            
            if result.returncode == 0:
                self.logger.debug(f"播放嗶聲成功 ({frequency}Hz, {duration}s)")
                return True
            else:
                # 如果 speaker-test 失敗，嘗試使用 espeak 生成音效
                result = subprocess.run([
                    'espeak', '-s', '200', 'beep'
                ], capture_output=True, timeout=5)
                return result.returncode == 0
                
        except Exception as e:
            self.logger.error(f"播放嗶聲失敗: {e}")
            return False
    
    def get_volume(self) -> int:
        """獲取當前音量"""
        return self.current_volume
    
    def test_audio(self) -> bool:
        """測試音頻系統"""
        try:
            return self.play_greeting('US', 'Test City')
        except Exception as e:
            self.logger.error(f"音頻測試失敗: {e}")
            return False
    
    def _cleanup_cache(self):
        """清理過期的快取文件"""
        try:
            if not TTS_CONFIG['cache_enabled']:
                return
            
            current_time = time.time()
            cache_files = list(self.cache_dir.glob("greeting_*.wav"))
            
            # 按修改時間排序
            cache_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            
            # 刪除過期文件
            for audio_file in cache_files:
                file_age = current_time - audio_file.stat().st_mtime
                if file_age > AUDIO_FILES['cache_timeout']:
                    audio_file.unlink()
                    self.logger.debug(f"刪除過期快取文件: {audio_file}")
            
            # 限制快取文件數量
            if len(cache_files) > AUDIO_FILES['max_cache_size']:
                for audio_file in cache_files[AUDIO_FILES['max_cache_size']:]:
                    if audio_file.exists():
                        audio_file.unlink()
                        self.logger.debug(f"刪除超量快取文件: {audio_file}")
                        
        except Exception as e:
            self.logger.error(f"清理快取失敗: {e}")
    
    def cleanup(self):
        """清理資源"""
        try:
            if PYGAME_AVAILABLE and self.audio_initialized:
                pygame.mixer.quit()
            
            if self.tts_engine:
                try:
                    self.tts_engine.stop()
                except:
                    pass
            
            self.logger.info("音頻管理器已清理")
            
        except Exception as e:
            self.logger.error(f"音頻管理器清理失敗: {e}")

# 全域音頻管理器實例
audio_manager = None

def get_audio_manager() -> AudioManager:
    """獲取音頻管理器實例"""
    global audio_manager
    if audio_manager is None:
        audio_manager = AudioManager()
    return audio_manager

def cleanup_audio_manager():
    """清理音頻管理器"""
    global audio_manager
    if audio_manager:
        audio_manager.cleanup()
        audio_manager = None 