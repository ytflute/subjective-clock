#!/usr/bin/env python3
"""
🔍 OpenAI TTS 詳細診斷工具
深度檢查 OpenAI TTS 為什麼失敗
"""

import sys
import subprocess
from pathlib import Path

def test_openai_import():
    """測試 OpenAI 庫導入"""
    print("🤖 測試 OpenAI 庫...")
    
    try:
        import openai
        print(f"✅ OpenAI 庫版本: {openai.__version__}")
        return True
    except ImportError as e:
        print(f"❌ OpenAI 庫導入失敗: {e}")
        return False

def test_config_loading():
    """測試配置載入"""
    print("\n⚙️  測試配置載入...")
    
    try:
        from config import TTS_CONFIG
        
        print(f"✅ 配置載入成功")
        print(f"   引擎: {TTS_CONFIG.get('engine')}")
        print(f"   API 金鑰: {'設定' if TTS_CONFIG.get('openai_api_key') else '未設定'}")
        print(f"   模型: {TTS_CONFIG.get('openai_model')}")
        print(f"   語音: {TTS_CONFIG.get('openai_voice')}")
        
        if not TTS_CONFIG.get('openai_api_key'):
            print("❌ API 金鑰未設定")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ 配置載入失敗: {e}")
        return False

def test_openai_client():
    """測試 OpenAI 客戶端初始化"""
    print("\n🔌 測試 OpenAI 客戶端...")
    
    try:
        import openai
        from config import TTS_CONFIG
        
        # 創建客戶端
        client = openai.OpenAI(api_key=TTS_CONFIG['openai_api_key'])
        print("✅ OpenAI 客戶端創建成功")
        
        # 測試 API 連接
        try:
            models = client.models.list()
            print("✅ API 連接測試成功")
            return client
        except Exception as e:
            print(f"❌ API 連接失敗: {e}")
            if "401" in str(e):
                print("   💡 可能是 API 金鑰無效")
            elif "quota" in str(e).lower():
                print("   💡 可能是配額不足")
            elif "network" in str(e).lower() or "connection" in str(e).lower():
                print("   💡 可能是網路連接問題")
            return None
            
    except Exception as e:
        print(f"❌ 客戶端初始化失敗: {e}")
        return None

def test_tts_generation(client):
    """測試實際的 TTS 生成"""
    print("\n🎵 測試 TTS 音頻生成...")
    
    if not client:
        print("❌ 客戶端無效，跳過測試")
        return False
    
    try:
        from config import TTS_CONFIG
        
        # 測試簡單文本
        test_text = "Hello, this is a test."
        print(f"📝 測試文本: {test_text}")
        
        response = client.audio.speech.create(
            model=TTS_CONFIG['openai_model'],
            voice=TTS_CONFIG['openai_voice'],
            input=test_text
        )
        
        # 檢查響應
        temp_file = Path("/tmp/openai_test.mp3")
        with open(temp_file, 'wb') as f:
            for chunk in response.iter_bytes(1024):
                f.write(chunk)
        
        if temp_file.exists() and temp_file.stat().st_size > 0:
            file_size = temp_file.stat().st_size
            print(f"✅ 音頻生成成功: {file_size} bytes")
            
            # 清理測試文件
            temp_file.unlink()
            return True
        else:
            print("❌ 音頻文件無效")
            return False
            
    except Exception as e:
        print(f"❌ TTS 生成失敗: {e}")
        if "rate_limit" in str(e).lower():
            print("   💡 可能是請求頻率限制")
        elif "insufficient_quota" in str(e).lower():
            print("   💡 配額不足")
        elif "invalid_request" in str(e).lower():
            print("   💡 請求參數無效")
        return False

def test_audio_playback():
    """測試音頻播放系統"""
    print("\n🔊 測試音頻播放...")
    
    try:
        import pygame
        pygame.mixer.init()
        print("✅ pygame 音頻系統初始化成功")
        
        # 檢查音頻設備
        devices = pygame.mixer.get_init()
        if devices:
            print(f"✅ 音頻設備: {devices}")
        else:
            print("❌ 沒有可用的音頻設備")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ 音頻播放測試失敗: {e}")
        return False

def test_audio_manager():
    """測試音頻管理器"""
    print("\n🎛️  測試音頻管理器...")
    
    try:
        from audio_manager import AudioManager
        from config import TTS_CONFIG
        
        # 強制使用 OpenAI 引擎
        original_engine = TTS_CONFIG['engine']
        TTS_CONFIG['engine'] = 'openai'
        
        audio_manager = AudioManager()
        
        if hasattr(audio_manager, 'openai_client') and audio_manager.openai_client:
            print("✅ AudioManager OpenAI 客戶端已初始化")
            result = True
        else:
            print("❌ AudioManager OpenAI 客戶端未初始化")
            result = False
        
        # 恢復原始設定
        TTS_CONFIG['engine'] = original_engine
        return result
        
    except Exception as e:
        print(f"❌ AudioManager 測試失敗: {e}")
        return False

def main():
    """主診斷程序"""
    print("🔍 OpenAI TTS 詳細診斷")
    print("=" * 50)
    
    # 診斷步驟
    tests = [
        ("OpenAI 庫", test_openai_import),
        ("配置載入", test_config_loading),
        ("OpenAI 客戶端", test_openai_client),
        ("音頻播放", test_audio_playback),
        ("音頻管理器", test_audio_manager)
    ]
    
    results = {}
    client = None
    
    for test_name, test_func in tests:
        print(f"\n{'='*20}")
        try:
            if test_name == "OpenAI 客戶端":
                client = test_func()
                results[test_name] = client is not None
            else:
                results[test_name] = test_func()
        except Exception as e:
            print(f"💥 {test_name} 測試出錯: {e}")
            results[test_name] = False
    
    # 如果客戶端測試成功，測試 TTS 生成
    if client:
        print(f"\n{'='*20}")
        results["TTS 生成"] = test_tts_generation(client)
    
    # 總結報告
    print(f"\n📊 診斷結果總結")
    print("=" * 50)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ 通過" if result else "❌ 失敗"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 總計: {passed}/{total} 測試通過")
    
    # 提供修復建議
    if passed < total:
        print("\n🔧 修復建議:")
        
        if not results.get("OpenAI 庫", True):
            print("  1. 重新安裝 OpenAI 庫:")
            print("     pip3 install openai --user --upgrade")
        
        if not results.get("配置載入", True):
            print("  2. 檢查 config.py 中的 API 金鑰設定")
        
        if not results.get("OpenAI 客戶端", True):
            print("  3. 驗證 API 金鑰:")
            print("     - 訪問 https://platform.openai.com/api-keys")
            print("     - 檢查金鑰是否有效和配額充足")
            print("     - 確認網路連接正常")
        
        if not results.get("音頻播放", True):
            print("  4. 檢查音頻系統:")
            print("     sudo apt install alsa-utils")
            print("     alsamixer  # 調整音量")
        
        if not results.get("TTS 生成", True):
            print("  5. 檢查 OpenAI 服務狀態和配額")
    else:
        print("\n🎉 所有測試通過！OpenAI TTS 應該正常工作！")
        print("如果仍有問題，可能是系統集成問題")
    
    return passed == total

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  診斷被用戶中斷")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 診斷過程發生錯誤: {e}")
        sys.exit(1) 