#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pygame
import os
import tempfile
from gtts import gTTS
from config import AUDIO_CONFIG, TTS_CONFIG, DEBUG_MODE
import logging
import subprocess

# 設定日誌
if DEBUG_MODE:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

class AudioManager:
    """音頻管理器：處理文字轉語音和播放，針對 PAM8403 數位功率放大模組優化"""
    
    def __init__(self):
        self.audio_config = AUDIO_CONFIG
        self.tts_config = TTS_CONFIG
        self.setup_audio()
        
    def setup_audio(self):
        """初始化音頻系統 - 針對 PAM8403 優化"""
        try:
            # 確保音頻輸出到 3.5mm 接口（連接到 PAM8403）
            if self.audio_config['output_type'] == 'analog':
                # 設定音頻輸出到 3.5mm 接口
                os.system('sudo amixer cset numid=3 1')
                logger.info("音頻輸出設定為 3.5mm 類比輸出（PAM8403）")
            else:
                # HDMI 輸出
                os.system('sudo amixer cset numid=3 2')
                logger.info("音頻輸出設定為 HDMI")
                
            # 初始化 pygame mixer - 使用高品質設定
            pygame.mixer.init(
                frequency=self.audio_config['sample_rate'],  # 44.1kHz
                size=-16,                                    # 16-bit 有符號
                channels=self.audio_config['channels'],      # 立體聲
                buffer=self.audio_config['buffer_size']      # 緩衝區大小
            )
            
            # 設定適當的音量（PAM8403 有硬體音量控制）
            self.set_system_volume(85)  # 設定系統音量為 85%
            
            logger.info(f"PAM8403 音頻系統初始化完成")
            logger.info(f"取樣率: {self.audio_config['sample_rate']}Hz")
            logger.info(f"聲道數: {self.audio_config['channels']}")
            logger.info(f"緩衝區: {self.audio_config['buffer_size']}")
            
        except Exception as e:
            logger.error(f"PAM8403 音頻系統初始化失敗：{e}")
            
    def set_system_volume(self, volume_percent):
        """設定系統音量（0-100%）"""
        try:
            # 使用 amixer 設定 PCM 音量
            cmd = f"amixer sset PCM {volume_percent}%"
            subprocess.run(cmd, shell=True, check=True, capture_output=True)
            logger.debug(f"系統音量設定為 {volume_percent}%")
        except subprocess.CalledProcessError as e:
            logger.warning(f"無法設定系統音量：{e}")
        except Exception as e:
            logger.error(f"設定音量時發生錯誤：{e}")
            
    def get_greeting_by_country(self, country_code):
        """根據國家代碼獲取當地語言的早安問候語"""
        greetings = {
            'CN': {'text': '早安', 'lang': 'zh'},
            'TW': {'text': '早安', 'lang': 'zh-tw'},
            'HK': {'text': '早晨', 'lang': 'zh-tw'},
            'US': {'text': 'Good morning', 'lang': 'en'},
            'GB': {'text': 'Good morning', 'lang': 'en'},
            'JP': {'text': 'おはようございます', 'lang': 'ja'},
            'KR': {'text': '안녕하세요', 'lang': 'ko'},
            'ES': {'text': 'Buenos días', 'lang': 'es'},
            'FR': {'text': 'Bonjour', 'lang': 'fr'},
            'DE': {'text': 'Guten Morgen', 'lang': 'de'},
            'IT': {'text': 'Buongiorno', 'lang': 'it'},
            'PT': {'text': 'Bom dia', 'lang': 'pt'},
            'RU': {'text': 'Доброе утро', 'lang': 'ru'},
        }
        
        if country_code and country_code.upper() in greetings:
            return greetings[country_code.upper()]
        
        return {'text': '早安', 'lang': 'zh-tw'}
    
    def text_to_speech(self, text, lang='zh-tw'):
        """將文字轉換為語音 - 針對 PAM8403 優化音質"""
        try:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
            temp_file.close()
            
            logger.debug(f"正在生成高品質語音：{text} (語言：{lang})")
            
            # 使用高品質設定生成語音
            tts = gTTS(
                text=text, 
                lang=lang, 
                slow=self.tts_config['slow']
            )
            tts.save(temp_file.name)
            
            logger.debug(f"語音檔案已儲存：{temp_file.name}")
            return temp_file.name
            
        except Exception as e:
            logger.error(f"文字轉語音失敗：{e}")
            return None
    
    def play_audio_file(self, audio_file):
        """播放音頻檔案 - 針對 PAM8403 優化"""
        try:
            if not os.path.exists(audio_file):
                logger.error(f"音頻檔案不存在：{audio_file}")
                return False
                
            logger.debug(f"正在播放音頻檔案：{audio_file}")
                
            # 載入並播放音頻
            pygame.mixer.music.load(audio_file)
            pygame.mixer.music.play()
            
            # 等待播放完成
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)
                
            logger.debug("音頻播放完成")
            return True
            
        except Exception as e:
            logger.error(f"播放音頻失敗：{e}")
            return False
        finally:
            # 清理臨時檔案
            try:
                if os.path.exists(audio_file):
                    os.unlink(audio_file)
                    logger.debug(f"已清理臨時檔案：{audio_file}")
            except Exception as e:
                logger.warning(f"清理臨時檔案失敗：{e}")
    
    def speak_greeting(self, city, country, country_code):
        """播放城市問候語 - 使用 PAM8403 輸出"""
        try:
            greeting_info = self.get_greeting_by_country(country_code)
            greeting_text = greeting_info['text']
            greeting_lang = greeting_info['lang']
            
            logger.info(f"為 {city}, {country} 播放問候語：{greeting_text}")
            logger.info(f"透過 PAM8403 數位功率放大模組輸出")
            
            audio_file = self.text_to_speech(greeting_text, greeting_lang)
            if audio_file:
                return self.play_audio_file(audio_file)
            
            return False
                
        except Exception as e:
            logger.error(f"播放問候語失敗：{e}")
            return False
    
    def test_audio(self):
        """測試 PAM8403 音頻輸出"""
        try:
            logger.info("正在測試 PAM8403 音頻輸出...")
            
            # 播放測試音頻
            test_text = "PAM8403 音頻測試"
            audio_file = self.text_to_speech(test_text, 'zh-tw')
            
            if audio_file:
                success = self.play_audio_file(audio_file)
                if success:
                    logger.info("PAM8403 音頻測試成功！")
                    return True
                else:
                    logger.error("PAM8403 音頻測試失敗")
                    return False
            else:
                logger.error("無法生成測試音頻")
                return False
                
        except Exception as e:
            logger.error(f"音頻測試時發生錯誤：{e}")
            return False
    
    def get_audio_info(self):
        """獲取當前音頻配置資訊"""
        info = {
            'amplifier': 'PAM8403 數位功率放大模組',
            'power': '3W+3W 雙聲道',
            'sample_rate': self.audio_config['sample_rate'],
            'channels': self.audio_config['channels'],
            'output_type': self.audio_config['output_type'],
            'volume_control': self.audio_config['volume_control']
        }
        return info
    
    def cleanup(self):
        """清理音頻資源"""
        try:
            pygame.mixer.quit()
            logger.info("PAM8403 音頻系統已清理")
        except Exception as e:
            logger.warning(f"清理音頻系統時發生錯誤：{e}") 