#!/usr/bin/env python3
"""
🎬 同步模式配置工具
選擇 Loading 同步模式或快速回饋模式
"""

import sys
from pathlib import Path

def check_current_sync_mode():
    """檢查當前同步模式設定"""
    try:
        # 檢查 main_web_dsi.py 中使用的方法名稱
        main_file = Path(__file__).parent / 'main_web_dsi.py'
        
        with open(main_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'synchronized_loading_and_play' in content and 'threading.Thread(target=synchronized_loading_and_play' in content:
            current_mode = 'sync_loading'
        elif '_extract_city_data_and_play_greeting' in content and 'threading.Thread(target=extract_and_play' in content:
            current_mode = 'fast_feedback'
        else:
            current_mode = 'unknown'
        
        print("🎬 當前同步模式設定")
        print("=" * 40)
        
        if current_mode == 'sync_loading':
            print("✅ 當前模式: Loading 同步模式")
            print("   📱 體驗: 按鈕 → Loading畫面 → 等待Nova → 畫面+聲音同步出現")
            print("   🎵 特點: 無重複播放，完美視聽同步")
        elif current_mode == 'fast_feedback':
            print("✅ 當前模式: 快速回饋模式")
            print("   📱 體驗: 按鈕 → 確認音效 → 快速問候 → 完整故事")
            print("   🎵 特點: 立即回饋，分段播放")
        else:
            print("❓ 當前模式: 未知狀態")
        
        return current_mode
        
    except Exception as e:
        print(f"❌ 檢查模式失敗: {e}")
        return 'unknown'

def switch_to_sync_loading():
    """切換到 Loading 同步模式"""
    try:
        main_file = Path(__file__).parent / 'main_web_dsi.py'
        
        with open(main_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 檢查是否已經是同步模式
        if 'synchronized_loading_and_play' in content and 'threading.Thread(target=synchronized_loading_and_play' in content:
            print("✅ 已經是 Loading 同步模式，無需更改")
            return True
        
        # 替換為同步模式的調用
        if 'threading.Thread(target=extract_and_play, daemon=True).start()' in content:
            new_content = content.replace(
                'threading.Thread(target=extract_and_play, daemon=True).start()',
                'threading.Thread(target=synchronized_loading_and_play, daemon=True).start()'
            )
            
            with open(main_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print("✅ 已切換到 Loading 同步模式")
            return True
        else:
            print("❌ 無法找到切換點，請檢查代碼")
            return False
            
    except Exception as e:
        print(f"❌ 切換到同步模式失敗: {e}")
        return False

def switch_to_fast_feedback():
    """切換到快速回饋模式"""
    try:
        main_file = Path(__file__).parent / 'main_web_dsi.py'
        
        with open(main_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 檢查是否已經是快速回饋模式
        if 'extract_and_play' in content and 'threading.Thread(target=extract_and_play' in content:
            print("✅ 已經是快速回饋模式，無需更改")
            return True
        
        # 替換為快速回饋模式的調用
        if 'threading.Thread(target=synchronized_loading_and_play, daemon=True).start()' in content:
            new_content = content.replace(
                'threading.Thread(target=synchronized_loading_and_play, daemon=True).start()',
                'threading.Thread(target=extract_and_play, daemon=True).start()'
            )
            
            with open(main_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print("✅ 已切換到快速回饋模式")
            return True
        else:
            print("❌ 無法找到切換點，請檢查代碼")
            return False
            
    except Exception as e:
        print(f"❌ 切換到快速回饋模式失敗: {e}")
        return False

def explain_modes():
    """詳細說明兩種模式的差異"""
    print("\n📖 同步模式詳細說明")
    print("=" * 50)
    
    print("🎬 Loading 同步模式（推薦解決重複播放）:")
    print("   📱 流程：")
    print("   1. 按下按鈕 → 立即確認音效")
    print("   2. 顯示 Loading 畫面「準備您的甦醒體驗...」")
    print("   3. 背景準備完整 Nova 音頻（無播放）")
    print("   4. 音頻準備完成 → 同時移除Loading + 播放完整音頻")
    print("   ")
    print("   ✅ 優點：")
    print("   - 無重複播放問題")
    print("   - 完美視聽同步")
    print("   - 一次完整的 Nova 體驗")
    print("   - 清晰的等待提示")
    print("   ")
    print("   ⚠️  缺點：")
    print("   - 需要等待 Nova 生成（5-10秒）")
    print("   - Loading 時間較長")
    
    print("\n🚀 快速回饋模式:")
    print("   📱 流程：")
    print("   1. 按下按鈕 → 立即確認音效")
    print("   2. 立即播放快速問候 \"Good morning\"")
    print("   3. 背景生成完整音頻")
    print("   4. 播放完整 Nova 整合內容")
    print("   ")
    print("   ✅ 優點：")
    print("   - 立即音頻回饋")
    print("   - 無等待感")
    print("   - 分段體驗")
    print("   ")
    print("   ⚠️  缺點：")
    print("   - 可能重複播放（如您遇到的問題）")
    print("   - 多次音頻片段")
    
    print("\n💡 建議：")
    print("   🎬 Loading 同步模式：適合追求完美體驗，不介意短暫等待")
    print("   🚀 快速回饋模式：適合需要立即回饋，接受分段播放")
    
    print("\n🎯 解決用戶問題：")
    print("   您反饋的「重複 Good morning」問題 → Loading 同步模式完美解決")

def main():
    """主程序"""
    print("🎬 同步模式配置工具")
    print("解決重複播放 vs 快速回饋選擇")
    print("=" * 50)
    
    # 檢查當前模式
    current_mode = check_current_sync_mode()
    
    # 顯示選項
    print(f"\n🎛️  模式切換選項:")
    print("1. 切換到 Loading 同步模式（解決重複播放）")
    print("2. 切換到快速回饋模式（立即音頻回饋）")
    print("3. 查看詳細模式說明")
    print("4. 退出")
    
    while True:
        try:
            choice = input("\n請選擇 (1-4): ").strip()
            
            if choice == '1':
                if switch_to_sync_loading():
                    print("\n🔄 重新檢查模式...")
                    check_current_sync_mode()
                    print("\n🎯 解決方案：")
                    print("   ✅ 不再重複播放 Good morning")
                    print("   ✅ 完美視聽同步體驗")
                    print("   ✅ Loading 提示用戶等待")
                break
                
            elif choice == '2':
                if switch_to_fast_feedback():
                    print("\n🔄 重新檢查模式...")
                    check_current_sync_mode()
                    print("\n⚡ 效果：")
                    print("   ✅ 立即音頻回饋")
                    print("   ⚠️  可能有重複播放")
                break
                
            elif choice == '3':
                explain_modes()
                
            elif choice == '4':
                print("👋 再見！")
                break
                
            else:
                print("❌ 無效選擇，請輸入 1-4")
                
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