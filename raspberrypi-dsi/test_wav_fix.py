#!/usr/bin/env python3
"""
🎵 WAV 格式修復驗證工具
測試 Festival TTS 生成的音頻文件是否正確
"""

import subprocess
import sys
from pathlib import Path
import tempfile
from audio_manager import AudioManager
from config import TTS_CONFIG

def test_wav_validation():
    """測試 WAV 文件驗證功能"""
    print("🔍 測試 WAV 文件驗證功能...")
    
    audio_manager = AudioManager()
    
    # 創建一個簡單的測試 WAV 文件
    test_file = Path(tempfile.mktemp(suffix='.wav'))
    
    try:
        # 使用 sox 創建標準 WAV 文件
        cmd = ['sox', '-n', '-r', '16000', '-c', '1', str(test_file), 'trim', '0.0', '1.0']
        result = subprocess.run(cmd, capture_output=True)
        
        if result.returncode == 0:
            # 測試驗證功能
            is_valid = audio_manager._validate_wav_file(test_file)
            print(f"✅ WAV 驗證功能正常: {is_valid}")
            return is_valid
        else:
            print("❌ 無法創建測試 WAV 文件")
            return False
            
    except Exception as e:
        print(f"❌ WAV 驗證測試失敗: {e}")
        return False
    finally:
        if test_file.exists():
            test_file.unlink()

def test_festival_generation():
    """測試 Festival 音頻生成"""
    print("\n🎵 測試 Festival 音頻生成...")
    
    audio_manager = AudioManager()
    test_text = "測試中文語音"
    
    try:
        # 測試生成音頻
        audio_file = audio_manager._generate_audio(test_text, 'zh')
        
        if audio_file and audio_file.exists():
            # 驗證文件格式
            is_valid = audio_manager._validate_wav_file(audio_file)
            file_size = audio_file.stat().st_size
            
            print(f"✅ Festival 音頻生成成功")
            print(f"   📁 文件路徑: {audio_file}")
            print(f"   📏 文件大小: {file_size} bytes")
            print(f"   ✓ 格式驗證: {'通過' if is_valid else '失敗'}")
            
            # 嘗試播放測試
            try:
                import pygame
                pygame.mixer.init()
                pygame.mixer.music.load(str(audio_file))
                print(f"   🎵 pygame 載入: 成功")
                return True
            except Exception as e:
                print(f"   ❌ pygame 載入失敗: {e}")
                return False
                
        else:
            print("❌ Festival 音頻生成失敗")
            return False
            
    except Exception as e:
        print(f"❌ Festival 測試失敗: {e}")
        return False

def test_fallback_mechanisms():
    """測試備用機制"""
    print("\n🔄 測試備用機制...")
    
    audio_manager = AudioManager()
    test_text = "Hello World"
    
    # 強制使用 Festival 並測試回退
    original_engine = TTS_CONFIG['engine']
    
    try:
        # 測試 Festival → espeak 回退
        TTS_CONFIG['engine'] = 'festival'
        audio_file = audio_manager._generate_audio(test_text, 'en')
        
        if audio_file:
            print("✅ 音頻生成成功（可能使用了備用引擎）")
            is_valid = audio_manager._validate_wav_file(audio_file)
            print(f"   ✓ 格式驗證: {'通過' if is_valid else '失敗'}")
            return True
        else:
            print("❌ 所有引擎都失敗")
            return False
            
    finally:
        TTS_CONFIG['engine'] = original_engine

def main():
    """主測試函數"""
    print("🧪 WAV 格式修復驗證測試")
    print("=" * 50)
    
    tests = [
        ("WAV 驗證功能", test_wav_validation),
        ("Festival 音頻生成", test_festival_generation),
        ("備用機制", test_fallback_mechanisms)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔄 執行測試: {test_name}")
        print("-" * 30)
        
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ 測試 {test_name} 發生錯誤: {e}")
            results.append((test_name, False))
    
    # 總結報告
    print("\n📊 測試結果總結")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 通過" if result else "❌ 失敗"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 總計: {passed}/{total} 測試通過")
    
    if passed == total:
        print("🎉 所有測試通過！WAV 格式修復成功！")
        print("\n📋 建議:")
        print("   - 可以重新測試完整系統")
        print("   - 中文故事應該能正常播放")
        print("   - 如需要可重新啟用音質增強")
    else:
        print("⚠️  部分測試失敗，可能需要進一步檢查")
        print("\n🔧 故障排除:")
        print("   - 檢查 Festival 和 sox 是否正確安裝")
        print("   - 確認音頻系統權限")
        print("   - 查看詳細錯誤日誌")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 