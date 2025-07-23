#!/usr/bin/env python3
"""
🌟 Nova 整合模式切換工具
控制是否讓 Nova 整合播放當地問候 + 中文故事
"""

import sys
from pathlib import Path

def check_current_mode():
    """檢查當前 Nova 整合模式狀態"""
    try:
        from config import TTS_CONFIG
        
        is_openai = TTS_CONFIG['engine'] == 'openai'
        is_integrated = TTS_CONFIG.get('nova_integrated_mode', True)
        
        print("🤖 Nova 整合模式狀態檢查")
        print("=" * 40)
        print(f"TTS 引擎: {TTS_CONFIG['engine']}")
        print(f"Nova 語音: {TTS_CONFIG.get('openai_voice', 'nova')}")
        print(f"整合模式: {'✅ 啟用' if is_integrated else '❌ 禁用'}")
        
        if is_openai and is_integrated:
            print("\n🌟 當前狀態: Nova 整合模式 - 當地問候+中文故事一起播放")
        elif is_openai and not is_integrated:
            print("\n🔄 當前狀態: 分離模式 - 分別播放問候語和故事")
        else:
            print("\n📝 當前狀態: 非 OpenAI 模式 - 使用傳統 TTS")
        
        return is_openai, is_integrated
        
    except Exception as e:
        print(f"❌ 檢查狀態失敗: {e}")
        return False, False

def toggle_nova_mode(enable: bool = None):
    """切換 Nova 整合模式"""
    try:
        config_file = Path(__file__).parent / 'config.py'
        
        with open(config_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 檢查當前狀態
        current_enabled = "'nova_integrated_mode': True" in content
        
        if enable is None:
            # 切換模式
            new_enabled = not current_enabled
        else:
            # 設定為指定狀態
            new_enabled = enable
        
        if new_enabled == current_enabled:
            status = "啟用" if new_enabled else "禁用"
            print(f"✅ Nova 整合模式已經{status}，無需更改")
            return True
        
        # 更新配置
        if new_enabled:
            new_content = content.replace(
                "'nova_integrated_mode': False",
                "'nova_integrated_mode': True"
            )
        else:
            new_content = content.replace(
                "'nova_integrated_mode': True",
                "'nova_integrated_mode': False"
            )
        
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        status = "啟用" if new_enabled else "禁用"
        print(f"✅ Nova 整合模式已{status}")
        return True
        
    except Exception as e:
        print(f"❌ 切換模式失敗: {e}")
        return False

def explain_modes():
    """說明不同模式的區別"""
    print("\n📖 模式說明")
    print("=" * 40)
    
    print("🌟 Nova 整合模式（推薦）:")
    print("   - Nova 用當地語言說早安")
    print("   - 然後無縫接入中文故事")
    print("   - 一次性播放，更自然流暢")
    print("   - 例如: \"¡Buenos días! 今天的你在哥倫比亞甦醒...\"")
    
    print("\n🔄 分離模式:")
    print("   - 先播放當地語言問候")
    print("   - 停頓後播放中文故事")
    print("   - 兩個分開的音頻文件")
    print("   - 可能使用不同的語音引擎")
    
    print("\n💡 建議:")
    print("   - 如果使用 OpenAI TTS，推薦整合模式")
    print("   - Nova 的多語言能力讓整合播放更自然")

def main():
    """主程序"""
    print("🌟 Nova 整合模式控制工具")
    print("當地問候 + 中文故事整合播放")
    print("=" * 50)
    
    # 檢查當前狀態
    is_openai, is_integrated = check_current_mode()
    
    if not is_openai:
        print("\n⚠️  注意: 當前未使用 OpenAI TTS")
        print("Nova 整合模式需要 OpenAI TTS 支援")
        print("請先執行: python3 setup_openai_tts.py")
        return False
    
    # 顯示選項
    print(f"\n🎛️  控制選項:")
    print("1. 切換模式 (啟用 ↔ 禁用)")
    print("2. 啟用 Nova 整合模式")
    print("3. 禁用 Nova 整合模式")
    print("4. 查看模式說明")
    print("5. 退出")
    
    while True:
        try:
            choice = input("\n請選擇 (1-5): ").strip()
            
            if choice == '1':
                if toggle_nova_mode():
                    print("\n🔄 重新檢查狀態...")
                    check_current_mode()
                break
                
            elif choice == '2':
                if toggle_nova_mode(True):
                    print("\n🔄 重新檢查狀態...")
                    check_current_mode()
                break
                
            elif choice == '3':
                if toggle_nova_mode(False):
                    print("\n🔄 重新檢查狀態...")
                    check_current_mode()
                break
                
            elif choice == '4':
                explain_modes()
                
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
    
    print("\n📋 使用新設定:")
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