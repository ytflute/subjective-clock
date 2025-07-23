#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - 語音質量測試腳本
測試不同 TTS 引擎和聲音效果
"""

import time
from datetime import datetime
from audio_manager import get_audio_manager

def test_voice_engines():
    """測試不同 TTS 引擎的女性聲音效果"""
    print("🎵 語音質量測試")
    print("=" * 60)
    print("測試不同 TTS 引擎的女性聲音效果")
    print("")
    
    # 測試文本
    test_texts = {
        'en': "Good morning! Welcome to WakeUpMap. This is a test of female voice quality.",
        'zh': "早安！歡迎使用甦醒地圖。這是女性聲音質量測試。",
        'es': "¡Buenos días! Bienvenido al mapa de despertar.",
        'fr': "Bonjour! Bienvenue sur la carte d'éveil.",
        'de': "Guten Morgen! Willkommen bei der Aufwachkarte."
    }
    
    try:
        # 獲取音頻管理器
        audio_manager = get_audio_manager()
        
        print("📋 可選測試：")
        print("1. 測試英語女性聲音")
        print("2. 測試中文女性聲音") 
        print("3. 測試多語言女性聲音")
        print("4. 測試真實問候語（使用 API）")
        print("5. 全部測試")
        print("")
        
        choice = input("請選擇測試項目 (1-5): ").strip()
        
        if choice == "1":
            test_single_language(audio_manager, 'en', test_texts['en'])
        elif choice == "2":
            test_single_language(audio_manager, 'zh', test_texts['zh'])
        elif choice == "3":
            test_multiple_languages(audio_manager, test_texts)
        elif choice == "4":
            test_real_greeting(audio_manager)
        elif choice == "5":
            test_all(audio_manager, test_texts)
        else:
            print("❌ 無效選擇")
            return
            
    except Exception as e:
        print(f"❌ 測試失敗: {e}")

def test_single_language(audio_manager, lang_code, text):
    """測試單一語言"""
    print(f"\n🗣️ 測試 {lang_code} 語音...")
    print(f"文本: {text}")
    print("🔊 播放中...")
    
    success = audio_manager._play_text_with_language(text, lang_code)
    
    if success:
        print("✅ 播放成功")
        rate_voice_quality()
    else:
        print("❌ 播放失敗")

def test_multiple_languages(audio_manager, test_texts):
    """測試多語言"""
    print("\n🌍 測試多語言女性聲音...")
    
    for lang_code, text in test_texts.items():
        print(f"\n--- {lang_code.upper()} ---")
        test_single_language(audio_manager, lang_code, text)
        
        if lang_code != list(test_texts.keys())[-1]:  # 不是最後一個
            input("按 Enter 繼續下一個語言...")

def test_real_greeting(audio_manager):
    """測試真實問候語（使用 API）"""
    print("\n🏙️ 測試真實問候語...")
    
    test_cities = [
        {"city": "Paris", "country": "France", "code": "FR"},
        {"city": "Tokyo", "country": "Japan", "code": "JP"},
        {"city": "Berlin", "country": "Germany", "code": "DE"},
        {"city": "Madrid", "country": "Spain", "code": "ES"},
    ]
    
    print("可用城市：")
    for i, city in enumerate(test_cities, 1):
        print(f"  {i}. {city['city']}, {city['country']}")
    
    choice = input("\n選擇城市 (1-4): ").strip()
    
    try:
        city_idx = int(choice) - 1
        if 0 <= city_idx < len(test_cities):
            city = test_cities[city_idx]
            print(f"\n🔊 播放 {city['city']} 的問候語...")
            
            success = audio_manager.play_greeting(
                city['code'], city['city'], city['country']
            )
            
            if success:
                print("✅ 播放成功")
                rate_voice_quality()
            else:
                print("❌ 播放失敗")
        else:
            print("❌ 無效選擇")
    except ValueError:
        print("❌ 請輸入數字")

def test_all(audio_manager, test_texts):
    """全部測試"""
    print("\n🎯 執行完整測試...")
    
    # 1. 測試多語言
    test_multiple_languages(audio_manager, test_texts)
    
    input("\n按 Enter 繼續測試真實問候語...")
    
    # 2. 測試真實問候語
    test_real_greeting(audio_manager)

def rate_voice_quality():
    """語音質量評分"""
    print("\n📊 請為剛才的語音質量評分：")
    print("1 - 非常機器化，難以理解")
    print("2 - 機器化，但可以理解")
    print("3 - 普通，有些機器感")
    print("4 - 不錯，相當自然")
    print("5 - 很好，非常自然")
    
    rating = input("評分 (1-5): ").strip()
    
    try:
        score = int(rating)
        if 1 <= score <= 5:
            feedback = {
                1: "😞 需要大幅改進",
                2: "😐 需要改進", 
                3: "🙂 還可以",
                4: "😊 不錯",
                5: "😍 很棒"
            }
            print(f"{feedback[score]} - 感謝您的反饋！")
            
            if score <= 2:
                print("\n💡 建議：")
                print("- 運行 TTS 升級腳本：sudo bash install_tts_upgrade.sh")
                print("- 檢查網路連線以使用在線 TTS 服務")
                
        else:
            print("❌ 評分必須在 1-5 之間")
    except ValueError:
        print("❌ 請輸入數字")

def show_improvement_tips():
    """顯示改進建議"""
    print("\n💡 語音質量改進建議:")
    print("=" * 60)
    print("🚀 方案 1: 升級到 Festival TTS")
    print("   sudo bash install_tts_upgrade.sh")
    print("")
    print("🌐 方案 2: 使用在線 TTS 服務（最佳質量）")
    print("   需要良好的網路連線")
    print("")
    print("⚙️ 方案 3: 調整當前設定")
    print("   修改 config.py 中的 TTS_CONFIG")
    print("")
    print("🔧 故障排除:")
    print("   - 檢查音頻設備：aplay -l")
    print("   - 檢查音量設定：amixer")
    print("   - 測試基本音頻：speaker-test")

if __name__ == "__main__":
    try:
        test_voice_engines()
        
        print("\n" + "=" * 60)
        show_improvement_tips()
        
    except KeyboardInterrupt:
        print("\n\n👋 測試中斷")
    except Exception as e:
        print(f"\n❌ 測試程序錯誤: {e}")
        import traceback
        traceback.print_exc() 