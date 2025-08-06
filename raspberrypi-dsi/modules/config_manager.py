"""
配置管理模組
統一管理所有配置設定
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any

class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_file="config.py"):
        self.logger = logging.getLogger(__name__)
        self.config_file = Path(__file__).parent.parent / config_file
        self.config = {}
        self.load_config()
    
    def load_config(self):
        """載入配置檔案"""
        try:
            # 動態導入 config.py
            import sys
            sys.path.append(str(self.config_file.parent))
            import config
            
            # 提取所有大寫的配置項
            for attr in dir(config):
                if attr.isupper():
                    self.config[attr] = getattr(config, attr)
            
            self.logger.info("✅ 配置檔案載入成功")
            
        except Exception as e:
            self.logger.error(f"❌ 配置檔案載入失敗: {e}")
            self.load_default_config()
    
    def load_default_config(self):
        """載入預設配置"""
        self.config = {
            'BUTTON_CONFIG': {
                'pin': 18,
                'pull_up': True,
                'bounce_time': 300,
                'long_press_time': 2.0
            },
            'AUDIO_CONFIG': {
                'enabled': True,
                'volume': 80,
                'output_device': 'default'
            },
            'SCREEN_CONFIG': {
                'width': 800,
                'height': 480,
                'fullscreen': False
            },
            'TTS_CONFIG': {
                'engine': 'festival',
                'nova_integrated_mode': False
            }
        }
        self.logger.warning("⚠️ 使用預設配置")
    
    def get(self, key: str, default: Any = None) -> Any:
        """獲取配置值"""
        return self.config.get(key, default)
    
    def get_button_config(self) -> Dict:
        """獲取按鈕配置"""
        return self.get('BUTTON_CONFIG', {})
    
    def get_audio_config(self) -> Dict:
        """獲取音頻配置"""
        return self.get('AUDIO_CONFIG', {})
    
    def get_screen_config(self) -> Dict:
        """獲取螢幕配置"""
        return self.get('SCREEN_CONFIG', {})
    
    def get_tts_config(self) -> Dict:
        """獲取TTS配置"""
        return self.get('TTS_CONFIG', {})
    
    def get_api_config(self) -> Dict:
        """獲取API配置"""
        return self.get('API_CONFIG', {})
    
    def is_nova_mode_enabled(self) -> bool:
        """檢查是否啟用Nova模式"""
        tts_config = self.get_tts_config()
        return tts_config.get('nova_integrated_mode', False)
    
    def get_openai_config(self) -> Dict:
        """獲取OpenAI配置"""
        tts_config = self.get_tts_config()
        return {
            'api_key': tts_config.get('openai_api_key', ''),
            'model': tts_config.get('openai_model', 'tts-1-hd'),
            'voice': tts_config.get('openai_voice', 'nova'),
            'speed': tts_config.get('openai_speed', 1.0)
        }
    
    def set(self, key: str, value: Any):
        """設定配置值"""
        self.config[key] = value
    
    def save_config(self):
        """保存配置到檔案（JSON格式，用於運行時修改）"""
        try:
            config_backup = self.config_file.parent / "config_runtime.json"
            with open(config_backup, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            self.logger.info("✅ 運行時配置已保存")
        except Exception as e:
            self.logger.error(f"❌ 配置保存失敗: {e}")
    
    def __str__(self):
        """字串表示"""
        return f"ConfigManager({len(self.config)} items loaded)"