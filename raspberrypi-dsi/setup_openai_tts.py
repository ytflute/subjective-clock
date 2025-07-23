#!/usr/bin/env python3
"""
🤖 OpenAI TTS 設定工具
幫助用戶配置 OpenAI API 金鑰和測試語音品質
"""

import os
import sys
import subprocess
from pathlib import Path

def install_openai_library():
    """安裝 OpenAI 庫"""
    print("📦 安裝 OpenAI 庫...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'openai'], check=True)
        print("✅ OpenAI 庫安裝成功！")
        return True
    except subprocess.CalledProcessError:
        print("❌ OpenAI 庫安裝失敗")
        return False

def setup_api_key():
    """設定 OpenAI API 金鑰"""
    print("\n🔑 設定 OpenAI API 金鑰")
    print("=" * 40)
    
    # 檢查是否已有環境變量設定
    existing_key = os.getenv('OPENAI_API_KEY')
    if existing_key:
        print(f"✅ 發現現有 API 金鑰: {existing_key[:8]}...")
        use_existing = input("是否使用現有金鑰？(y/n): ").lower().strip()
        if use_existing == 'y':
            return existing_key
    
    print("\n📋 如何獲取 OpenAI API 金鑰：")
    print("1. 訪問 https://platform.openai.com/api-keys")
    print("2. 登入或註冊 OpenAI 帳戶")
    print("3. 點擊 'Create new secret key'")
    print("4. 複製生成的金鑰")
    
    api_key = input("\n請輸入你的 OpenAI API 金鑰: ").strip()
    
    if not api_key or not api_key.startswith('sk-'):
        print("❌ 無效的 API 金鑰格式")
        return None
    
    # 更新 config.py
    config_file = Path(__file__).parent / 'config.py'
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 替換 API 金鑰和引擎
        new_content = content.replace(
            "'openai_api_key': '',",
            f"'openai_api_key': '{api_key}',"
        ).replace(
            "'engine': 'festival',",
            "'engine': 'openai',"
        )
        
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("✅ API 金鑰已保存到 config.py")
        print("✅ TTS 引擎已切換為 OpenAI")
        return api_key
        
    except Exception as e:
        print(f"❌ 保存 API 金鑰失敗: {e}")
        return None

def test_openai_tts():
    """測試 OpenAI TTS"""
    print("\n🧪 測試 OpenAI TTS...")
    
    try:
        from audio_manager import AudioManager
        from config import TTS_CONFIG
        
        # 確保使用 OpenAI 引擎
        original_engine = TTS_CONFIG['engine']
        TTS_CONFIG['engine'] = 'openai'
        
        audio_manager = AudioManager()
        
        # 測試不同語言
        test_cases = [
            ("Hello, this is a test!", "en"),
            ("你好，這是測試！", "zh"),
            ("Bonjour, c'est un test!", "fr"),
            ("Привет, это тест!", "ru")
        ]
        
        success_count = 0
        
        for i, (text, lang) in enumerate(test_cases, 1):
            print(f"\n🔄 測試 {i}/{len(test_cases)}: {text}")
            
            try:
                audio_file = audio_manager._generate_audio(text, lang)
                if audio_file and audio_file.exists():
                    file_size = audio_file.stat().st_size
                    print(f"✅ 成功生成 ({file_size} bytes)")
                    success_count += 1
                else:
                    print("❌ 生成失敗")
            except Exception as e:
                print(f"❌ 錯誤: {e}")
        
        # 恢復原始引擎
        TTS_CONFIG['engine'] = original_engine
        
        print(f"\n📊 測試結果: {success_count}/{len(test_cases)} 成功")
        
        if success_count == len(test_cases):
            print("🎉 OpenAI TTS 完全正常！")
            return True
        elif success_count > 0:
            print("⚠️  部分成功，可能有網路或配額問題")
            return False
        else:
            print("❌ 所有測試失敗")
            return False
            
    except Exception as e:
        print(f"❌ 測試過程錯誤: {e}")
        return False

def show_voice_options():
    """顯示可用的語音選項"""
    print("\n🎵 OpenAI TTS 語音選項：")
    print("=" * 40)
    
    voices = {
        'alloy': '💫 Alloy - 平衡、通用的聲音',
        'echo': '🎭 Echo - 男性、清晰的聲音', 
        'fable': '📚 Fable - 溫暖、敘事風格',
        'onyx': '💎 Onyx - 深沉、穩重的聲音',
        'nova': '⭐ Nova - 明亮、活潑的女性聲音 (推薦！)',
        'shimmer': '✨ Shimmer - 輕柔、優雅的聲音'
    }
    
    print("當前設定:", f"🎤 {TTS_CONFIG.get('openai_voice', 'nova')}")
    print("\n可選語音:")
    for voice, desc in voices.items():
        print(f"  • {voice}: {desc}")
    
    change_voice = input("\n是否要更改語音？(y/n): ").lower().strip()
    if change_voice == 'y':
        new_voice = input("輸入語音名稱 (nova/alloy/echo/fable/onyx/shimmer): ").strip()
        if new_voice in voices:
            # 更新 config.py
            try:
                config_file = Path(__file__).parent / 'config.py'
                with open(config_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                current_voice = TTS_CONFIG.get('openai_voice', 'nova')
                content = content.replace(
                    f"'openai_voice': '{current_voice}',",
                    f"'openai_voice': '{new_voice}',"
                )
                
                with open(config_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print(f"✅ 語音已更改為: {new_voice}")
            except Exception as e:
                print(f"❌ 更改語音失敗: {e}")

def main():
    """主程序"""
    print("🤖 OpenAI TTS 設定工具")
    print("將您的語音升級到 AI 等級品質！")
    print("=" * 50)
    
    # 1. 檢查並安裝 OpenAI 庫
    try:
        import openai
        print("✅ OpenAI 庫已安裝")
    except ImportError:
        print("📦 OpenAI 庫未安裝")
        if input("是否要安裝？(y/n): ").lower().strip() != 'y':
            print("❌ 需要 OpenAI 庫才能繼續")
            return False
        
        if not install_openai_library():
            return False
    
    # 2. 設定 API 金鑰
    from config import TTS_CONFIG
    
    if not TTS_CONFIG['openai_api_key']:
        print("\n🔑 需要設定 OpenAI API 金鑰")
        api_key = setup_api_key()
        if not api_key:
            print("❌ 無效的 API 金鑰，無法繼續")
            return False
    else:
        print("✅ API 金鑰已配置")
    
    # 3. 顯示語音選項
    show_voice_options()
    
    # 4. 測試 TTS
    print("\n🧪 是否要測試 OpenAI TTS？")
    if input("測試需要使用 API 配額 (y/n): ").lower().strip() == 'y':
        success = test_openai_tts()
        
        if success:
            print("\n🎉 設定完成！")
            print("現在可以使用 OpenAI TTS 享受頂級語音品質！")
            print("\n📋 使用方法:")
            print("  python3 run_updated_system.py")
            return True
        else:
            print("\n⚠️  測試失敗，請檢查：")
            print("  • API 金鑰是否正確")
            print("  • 網路連接是否正常") 
            print("  • OpenAI 帳戶是否有足夠配額")
            return False
    
    print("\n✨ 設定完成！OpenAI TTS 已準備就緒！")
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  設定被用戶中斷")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 設定過程發生錯誤: {e}")
        sys.exit(1) 