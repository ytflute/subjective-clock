#!/usr/bin/env python3
"""
🇨🇳 中文語音測試工具
專門測試中文 TTS 是否正常工作
"""

import sys
from audio_manager import AudioManager

def test_chinese_voice():
    """測試中文語音生成和播放"""
    print("🇨🇳 測試中文語音...")
    print("=" * 40)
    
    # 初始化音頻管理器
    try:
        audio_manager = AudioManager()
        print("✅ 音頻管理器初始化成功")
    except Exception as e:
        print(f"❌ 音頻管理器初始化失敗: {e}")
        return False
    
    # 測試文本
    test_texts = [
        "今天天氣很好",
        "你好，這是測試",
        "今天的你在城市中甦醒，感受陽光的溫暖"
    ]
    
    success_count = 0
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n🔄 測試 {i}/{len(test_texts)}: {text}")
        print("-" * 30)
        
        try:
            # 生成中文音頻
            audio_file = audio_manager._generate_audio(text, 'zh')
            
            if audio_file and audio_file.exists():
                # 檢查文件大小
                file_size = audio_file.stat().st_size
                print(f"✅ 音頻生成成功")
                print(f"   📁 文件: {audio_file}")
                print(f"   📏 大小: {file_size} bytes")
                
                # 驗證格式
                is_valid = audio_manager._validate_wav_file(audio_file)
                print(f"   ✓ 格式驗證: {'通過' if is_valid else '失敗'}")
                
                # 測試播放
                can_play = audio_manager._test_wav_playback(audio_file)
                print(f"   🎵 播放測試: {'通過' if can_play else '失敗'}")
                
                if is_valid and can_play:
                    print(f"   🎉 測試 {i} 完全成功！")
                    success_count += 1
                else:
                    print(f"   ⚠️  測試 {i} 部分失敗")
                    
            else:
                print(f"❌ 測試 {i} 失敗：無法生成音頻")
                
        except Exception as e:
            print(f"❌ 測試 {i} 發生錯誤: {e}")
    
    # 總結
    print(f"\n📊 測試結果總結")
    print("=" * 40)
    print(f"🎯 成功: {success_count}/{len(test_texts)} 測試")
    
    if success_count == len(test_texts):
        print("🎉 所有中文語音測試通過！")
        print("\n✨ 中文故事播放應該正常工作")
        return True
    elif success_count > 0:
        print(f"⚠️  部分測試通過，可能有間歇性問題")
        return False
    else:
        print("❌ 所有測試失敗，需要檢查配置")
        print("\n🔧 建議檢查:")
        print("   - espeak 是否正確安裝")
        print("   - 音頻權限是否正確")
        print("   - 系統音頻是否工作")
        return False

def main():
    """主函數"""
    print("🧪 中文語音測試工具")
    print("此工具將測試中文 TTS 是否正常工作")
    
    try:
        success = test_chinese_voice()
        return success
    except KeyboardInterrupt:
        print("\n⏹️  測試被用戶中斷")
        return False
    except Exception as e:
        print(f"\n💥 測試過程發生未預期錯誤: {e}")
        return False

if __name__ == "__main__":
    success = main()
    print(f"\n{'🎉 測試完成' if success else '❌ 測試失敗'}")
    sys.exit(0 if success else 1) 