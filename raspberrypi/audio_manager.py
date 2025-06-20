#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pygame
import os
import tempfile
from gtts import gTTS
from config import AUDIO_OUTPUT, DEBUG_MODE
import logging

# 設定日誌
if DEBUG_MODE:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

class AudioManager:
    """音頻管理器：處理文字轉語音和播放"""
    
    def __init__(self):
        self.setup_audio()
        
    def setup_audio(self):
        """初始化音頻系統"""
        try:
            # 設定音頻輸出
            if AUDIO_OUTPUT == 'hdmi':
                os.system('sudo amixer cset numid=3 2')
            else:
                os.system('sudo amixer cset numid=3 1')
                
            # 初始化pygame mixer
            pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
            
            logger.info(f"音頻系統初始化完成，輸出：{AUDIO_OUTPUT}")
            
        except Exception as e:
            logger.error(f"音頻系統初始化失敗：{e}")
            
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
        """將文字轉換為語音"""
        try:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
            temp_file.close()
            
            logger.debug(f"正在生成語音：{text} (語言：{lang})")
            
            tts = gTTS(text=text, lang=lang, slow=False)
            tts.save(temp_file.name)
            
            return temp_file.name
            
        except Exception as e:
            logger.error(f"文字轉語音失敗：{e}")
            return None
    
    def play_audio_file(self, audio_file):
        """播放音頻檔案"""
        try:
            if not os.path.exists(audio_file):
                return False
                
            pygame.mixer.music.load(audio_file)
            pygame.mixer.music.play()
            
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)
                
            return True
            
        except Exception as e:
            logger.error(f"播放音頻失敗：{e}")
            return False
        finally:
            try:
                if os.path.exists(audio_file):
                    os.unlink(audio_file)
            except:
                pass
    
    def speak_greeting(self, city, country, country_code):
        """播放城市問候語"""
        try:
            greeting_info = self.get_greeting_by_country(country_code)
            greeting_text = greeting_info['text']
            greeting_lang = greeting_info['lang']
            
            logger.info(f"為 {city}, {country} 播放問候語：{greeting_text}")
            
            audio_file = self.text_to_speech(greeting_text, greeting_lang)
            if audio_file:
                return self.play_audio_file(audio_file)
            
            return False
                
        except Exception as e:
            logger.error(f"播放問候語失敗：{e}")
            return False
    
    def cleanup(self):
        """清理音頻資源"""
        try:
            pygame.mixer.quit()
        except:
            pass 