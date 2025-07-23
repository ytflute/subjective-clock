#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
測試新的多語言問候語 + 中文故事功能
"""

import sys
import time
import logging
from datetime import datetime

def setup_logging():
    """設定日誌"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def test_audio_greeting_feature():
    """測試新的音頻問候語功能"""
    print("🎵 測試多語言問候語 + 中文故事功能")
    print("=" * 60)
    
    try:
        # 導入音頻管理器
        from audio_manager import get_audio_manager
        
        # 測試城市列表
        test_cities = [
            {"city": "Paris", "country": "France", "code": "FR"},
            {"city": "Tokyo", "country": "Japan", "code": "JP"},
            {"city": "Berlin", "country": "Germany", "code": "DE"},
            {"city": "Madrid", "country": "Spain", "code": "ES"},
            {"city": "Rome", "country": "Italy", "code": "IT"},
        ]
        
        print("可用的測試城市：")
        for i, city in enumerate(test_cities, 1):
            print(f"  {i}. {city['city']}, {city['country']}")
        
        print("\n選擇要測試的城市（輸入數字 1-5），或按 Enter 測試所有城市：")
        choice = input().strip()
        
        if choice.isdigit() and 1 <= int(choice) <= len(test_cities):
            # 測試單個城市
            selected_city = test_cities[int(choice) - 1]
            test_single_city(selected_city)
        elif choice == "":
            # 測試所有城市
            print("\n🌍 測試所有城市...")
            for i, city in enumerate(test_cities, 1):
                print(f"\n--- 測試 {i}/{len(test_cities)}: {city['city']}, {city['country']} ---")
                test_single_city(city)
                if i < len(test_cities):
                    print("等待 3 秒後繼續...")
                    time.sleep(3)
        else:
            print("❌ 無效選擇")
            return False
            
    except ImportError as e:
        print(f"❌ 導入失敗: {e}")
        print("請確保所有必要的模組都已安裝")
        return False
    except Exception as e:
        print(f"❌ 測試失敗: {e}")
        return False
    
    return True

def test_single_city(city_info):
    """測試單個城市的音頻功能"""
    from audio_manager import get_audio_manager
    
    city = city_info["city"]
    country = city_info["country"]
    code = city_info["code"]
    
    print(f"\n🏙️  測試城市: {city}, {country}")
    print(f"⏰ 開始時間: {datetime.now().strftime('%H:%M:%S')}")
    
    try:
        # 獲取音頻管理器
        audio_manager = get_audio_manager()
        
        print(f"📞 調用 API 獲取問候語和故事...")
        
        # 測試 API 調用
        greeting_data = audio_manager._fetch_greeting_and_story_from_api(city, country, code)
        
        if greeting_data:
            print(f"✅ API 調用成功!")
            print(f"   🗣️  當地語言問候語: {greeting_data['greeting']} ({greeting_data['language']})")
            if greeting_data.get('chineseStory'):
                print(f"   📖 中文故事: {greeting_data['chineseStory']}")
            else:
                print(f"   ⚠️  沒有中文故事")
            
            # 詢問是否播放音頻
            print(f"\n是否播放音頻? (y/N): ", end="")
            play_choice = input().strip().lower()
            
            if play_choice == 'y':
                print(f"🔊 開始播放音頻...")
                success = audio_manager.play_greeting(code, city, country)
                if success:
                    print(f"✅ 音頻播放完成")
                else:
                    print(f"❌ 音頻播放失敗")
            else:
                print(f"⏭️  跳過音頻播放")
                
        else:
            print(f"❌ API 調用失敗")
            
    except Exception as e:
        print(f"❌ 測試城市 {city} 時發生錯誤: {e}")
        import traceback
        traceback.print_exc()

def test_api_connectivity():
    """測試 API 連接性"""
    print("\n🌐 測試 API 連接性")
    print("-" * 40)
    
    try:
        import requests
        from config import API_ENDPOINTS
        
        # 測試問候語 API
        api_url = API_ENDPOINTS['generate_morning_greeting']
        print(f"測試 API: {api_url}")
        
        test_data = {
            "city": "Paris",
            "country": "France", 
            "countryCode": "FR",
            "includeStory": True
        }
        
        response = requests.post(
            api_url,
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ API 連接正常")
                print(f"   問候語: {result['data']['greeting']}")
                if result['data'].get('chineseStory'):
                    print(f"   故事: {result['data']['chineseStory'][:50]}...")
                return True
            else:
                print(f"❌ API 返回錯誤: {result}")
                return False
        else:
            print(f"❌ API 請求失敗: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API 連接測試失敗: {e}")
        return False

def main():
    """主函數"""
    setup_logging()
    
    print("🎵 甦醒地圖音頻功能測試工具")
    print("=" * 60)
    print("測試新的多語言問候語 + 中文故事功能")
    print()
    
    # 測試 API 連接
    if not test_api_connectivity():
        print("\n❌ API 連接測試失敗，無法繼續測試音頻功能")
        return 1
    
    # 測試音頻功能
    if test_audio_greeting_feature():
        print("\n🎉 測試完成!")
        print("如果一切正常，你可以在 Raspberry Pi 上按下按鈕來體驗完整功能。")
    else:
        print("\n❌ 測試失敗!")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 