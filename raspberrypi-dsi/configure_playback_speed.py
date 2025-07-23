#!/usr/bin/env python3
"""
🚀 播放速度配置工具
控制視聽同步和快速回饋設定
"""

import sys
from pathlib import Path

def check_current_settings():
    """檢查當前播放設定"""
    try:
        from config import TTS_CONFIG
        
        print("🎵 當前播放設定")
        print("=" * 40)
        print(f"TTS 引擎: {TTS_CONFIG['engine']}")
        print(f"Nova 語音: {TTS_CONFIG.get('openai_voice', 'nova')}")
        print(f"Nova 整合模式: {TTS_CONFIG.get('nova_integrated_mode', True)}")
        
        # 檢查快速模式設定（如果存在）
        fast_mode = TTS_CONFIG.get('enable_fast_mode', True)
        print(f"快速回饋模式: {'✅ 啟用' if fast_mode else '❌ 禁用'}")
        
        return True
        
    except Exception as e:
        print(f"❌ 檢查設定失敗: {e}")
        return False

def toggle_fast_mode(enable: bool = None):
    """切換快速回饋模式"""
    try:
        config_file = Path(__file__).parent / 'config.py'
        
        with open(config_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 檢查是否已有快速模式設定
        if 'enable_fast_mode' in content:
            # 已存在，進行切換
            current_enabled = "'enable_fast_mode': True" in content
            
            if enable is None:
                new_enabled = not current_enabled
            else:
                new_enabled = enable
            
            if new_enabled == current_enabled:
                status = "啟用" if new_enabled else "禁用"
                print(f"✅ 快速回饋模式已經{status}，無需更改")
                return True
            
            # 更新設定
            if new_enabled:
                new_content = content.replace(
                    "'enable_fast_mode': False",
                    "'enable_fast_mode': True"
                )
            else:
                new_content = content.replace(
                    "'enable_fast_mode': True",
                    "'enable_fast_mode': False"
                )
        else:
            # 不存在，添加設定
            new_enabled = enable if enable is not None else True
            
            # 在 nova_integrated_mode 後添加
            if 'nova_integrated_mode' in content:
                new_content = content.replace(
                    "'nova_integrated_mode': True,  # 使用 Nova 整合播放當地問候+中文故事",
                    f"'nova_integrated_mode': True,  # 使用 Nova 整合播放當地問候+中文故事\n    'enable_fast_mode': {new_enabled},  # 啟用快速回饋模式（立即音頻回饋）"
                )
            else:
                # 在 TTS_CONFIG 結尾添加
                new_content = content.replace(
                    "    # 音質增強設定",
                    f"    # 快速回饋模式\n    'enable_fast_mode': {new_enabled},  # 啟用快速回饋模式（立即音頻回饋）\n    \n    # 音質增強設定"
                )
        
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        status = "啟用" if new_enabled else "禁用"
        print(f"✅ 快速回饋模式已{status}")
        return True
        
    except Exception as e:
        print(f"❌ 切換模式失敗: {e}")
        return False

def explain_fast_mode():
    """說明快速回饋模式"""
    print("\n📖 快速回饋模式說明")
    print("=" * 40)
    
    print("🚀 快速回饋模式（推薦）:")
    print("   ⏱️  時間軸：")
    print("   0秒：按鈕確認音效")
    print("   2秒：快速問候 '¡Buenos días!'")
    print("   3-5秒：完整 Nova 故事開始")
    print("   ✨ 總延遲：2-5秒")
    
    print("\n🐌 傳統模式:")
    print("   ⏱️  時間軸：")
    print("   0-38秒：無聲等待")
    print("   38秒：完整音頻開始播放")
    print("   ⚠️  總延遲：38秒")
    
    print("\n🎯 技術原理:")
    print("   📡 並行處理：音頻生成與畫面顯示同時進行")
    print("   🎵 分段播放：立即回饋 + 完整內容")
    print("   💾 智能快取：常用問候語預先快取")
    print("   🔄 備用機制：Nova 失敗時使用系統 TTS")
    
    print("\n💡 適用場景:")
    print("   ✅ 推薦啟用：提升用戶體驗，減少等待感")
    print("   ❌ 可禁用：如果偏好傳統的完整播放模式")

def main():
    """主程序"""
    print("🚀 播放速度配置工具")
    print("視聽同步與快速回饋設定")
    print("=" * 50)
    
    # 檢查當前設定
    if not check_current_settings():
        return False
    
    # 顯示選項
    print(f"\n🎛️  配置選項:")
    print("1. 切換快速回饋模式 (啟用 ↔ 禁用)")
    print("2. 啟用快速回饋模式")
    print("3. 禁用快速回饋模式")
    print("4. 查看模式說明")
    print("5. 退出")
    
    while True:
        try:
            choice = input("\n請選擇 (1-5): ").strip()
            
            if choice == '1':
                if toggle_fast_mode():
                    print("\n🔄 重新檢查設定...")
                    check_current_settings()
                break
                
            elif choice == '2':
                if toggle_fast_mode(True):
                    print("\n🔄 重新檢查設定...")
                    check_current_settings()
                break
                
            elif choice == '3':
                if toggle_fast_mode(False):
                    print("\n🔄 重新檢查設定...")
                    check_current_settings()
                break
                
            elif choice == '4':
                explain_fast_mode()
                
            elif choice == '5':
                print("👋 再見！")
                break
                
            else:
                print("❌ 無效選擇，請輸入 1-5")
                
        except KeyboardInterrupt:
            print("\n\n👋 再見！")
            break
        except Exception as e:
            print(f"❌ 輸入錯誤: {e}")
    
    print("\n📋 應用新設定:")
    print("   python3 run_updated_system.py")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n👋 再見！")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 程序錯誤: {e}")
        sys.exit(1) 