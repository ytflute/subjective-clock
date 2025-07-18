#!/usr/bin/env python3
"""
甦醒地圖更新後系統啟動腳本
包含全螢幕瀏覽器、修復的按鈕功能和 API 錯誤修復
"""

import os
import sys
import time
import logging
import subprocess

def setup_logging():
    """設定日誌"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def check_dependencies():
    """檢查相依性"""
    logger = logging.getLogger(__name__)
    
    print("🔍 檢查系統相依性...")
    
    # 檢查 Python 模組
    required_modules = [
        'selenium', 'RPi.GPIO', 'requests'
    ]
    
    missing_modules = []
    for module in required_modules:
        try:
            __import__(module)
            print(f"✅ {module}")
        except ImportError:
            print(f"❌ {module} 未安裝")
            missing_modules.append(module)
    
    if missing_modules:
        print(f"\n請安裝缺少的模組: pip install {' '.join(missing_modules)}")
        return False
    
    # 檢查 ChromeDriver
    try:
        result = subprocess.run(['which', 'chromedriver'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ ChromeDriver 已安裝")
        else:
            print("⚠️  ChromeDriver 未找到，系統將嘗試自動下載")
    except Exception as e:
        print(f"⚠️  ChromeDriver 檢查失敗: {e}")
    
    return True

def show_system_info():
    """顯示系統資訊"""
    print("\n📋 系統更新摘要:")
    print("=" * 50)
    print("1. ✅ 瀏覽器設定為全螢幕 kiosk 模式")
    print("2. ✅ 修復實體按鈕觸發問題")
    print("3. ✅ 修復 API 回傳格式錯誤")
    print("4. ✅ 更新按鈕處理器回調邏輯")
    print("5. ✅ 簡化按鈕事件處理流程")
    print()
    print("🔘 按鈕功能:")
    print("   - 短按: 觸發「開始這一天」")
    print("   - 長按: 重新載入網頁")
    print()
    print("🌐 網頁功能:")
    print("   - 全螢幕顯示，無瀏覽器分頁")
    print("   - 觸控螢幕「開始這一天」正常運作")
    print("   - API 錯誤已修復")
    print("=" * 50)

def run_diagnostic():
    """執行診斷測試"""
    print("\n🔧 是否要執行系統診斷? (y/n): ", end="")
    choice = input().lower()
    
    if choice == 'y':
        print("\n🚀 啟動診斷測試...")
        try:
            import subprocess
            subprocess.run([sys.executable, 'test_button_diagnostic.py'])
        except Exception as e:
            print(f"❌ 診斷測試失敗: {e}")

def main():
    """主函數"""
    setup_logging()
    
    print("🌅 甦醒地圖更新後系統")
    print("=" * 50)
    
    # 檢查相依性
    if not check_dependencies():
        return 1
    
    # 顯示更新資訊
    show_system_info()
    
    # 詢問是否執行診斷
    run_diagnostic()
    
    # 啟動主系統
    print("\n🚀 啟動甦醒地圖系統...")
    print("按 Ctrl+C 停止系統")
    
    try:
        from main_web_dsi import main
        main()
    except KeyboardInterrupt:
        print("\n🛑 系統已停止")
    except Exception as e:
        print(f"\n❌ 系統啟動失敗: {e}")
        print("請檢查錯誤訊息或執行診斷測試")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 