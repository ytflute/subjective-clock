#!/usr/bin/env python3
"""
測試 Raspberry Pi 實體按鈕和網頁控制器功能
"""

import logging
import time
from web_controller_dsi import WebControllerDSI

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def test_web_controller():
    """測試網頁控制器功能"""
    logger.info("開始測試網頁控制器...")
    
    controller = WebControllerDSI()
    
    try:
        # 1. 啟動瀏覽器
        logger.info("步驟 1: 啟動瀏覽器")
        if not controller.start_browser():
            logger.error("瀏覽器啟動失敗")
            return False
        
        logger.info("瀏覽器啟動成功")
        time.sleep(2)
        
        # 2. 載入網站
        logger.info("步驟 2: 載入網站")
        if not controller.load_website():
            logger.error("網站載入失敗")
            return False
            
        logger.info("網站載入成功")
        time.sleep(3)
        
        # 3. 測試點擊開始按鈕
        logger.info("步驟 3: 測試點擊開始按鈕")
        result = controller.click_start_button()
        
        if result and result.get('success'):
            logger.info(f"開始按鈕測試成功: {result}")
        else:
            logger.error(f"開始按鈕測試失敗: {result}")
            return False
        
        # 4. 等待觀察結果
        logger.info("步驟 4: 等待觀察結果...")
        time.sleep(10)
        
        logger.info("所有測試完成！")
        return True
        
    except Exception as e:
        logger.error(f"測試過程中發生錯誤: {e}")
        return False
        
    finally:
        # 清理
        logger.info("清理資源...")
        controller.stop()

def test_button_simulation():
    """模擬按鈕點擊測試"""
    logger.info("開始模擬按鈕點擊測試...")
    
    # 模擬主程式的按鈕事件處理
    from main_web_dsi import WakeUpMapWebApp
    
    try:
        app = WakeUpMapWebApp()
        
        # 模擬短按事件
        logger.info("模擬短按按鈕...")
        app._handle_short_press()
        
        time.sleep(10)
        
        logger.info("按鈕模擬測試完成")
        return True
        
    except Exception as e:
        logger.error(f"按鈕模擬測試失敗: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("Raspberry Pi 實體按鈕功能測試")
    print("="*60)
    
    print("\n選擇測試模式:")
    print("1. 測試網頁控制器 (推薦)")
    print("2. 測試按鈕模擬")
    print("3. 兩個都測試")
    
    choice = input("請輸入選擇 (1-3): ").strip()
    
    success = True
    
    if choice in ['1', '3']:
        print("\n" + "="*60)
        print("測試 1: 網頁控制器功能")
        print("="*60)
        success &= test_web_controller()
    
    if choice in ['2', '3']:
        print("\n" + "="*60)
        print("測試 2: 按鈕模擬功能")
        print("="*60)
        success &= test_button_simulation()
    
    print("\n" + "="*60)
    if success:
        print("✅ 所有測試通過!")
        print("實體按鈕功能應該正常運作")
        print("\n在 Raspberry Pi 上運行主程式:")
        print("python3 main_web_dsi.py")
    else:
        print("❌ 測試失敗!")
        print("請檢查錯誤訊息並修復問題")
    print("="*60) 