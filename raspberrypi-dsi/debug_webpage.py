#!/usr/bin/env python3
"""
甦醒地圖網頁元素調試腳本
用於檢查網頁實際結構，找出按鈕和輸入框的正確選擇器
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import time
import os

def find_chromedriver():
    """尋找 ChromeDriver 路徑"""
    paths = ['/usr/local/bin/chromedriver', '/usr/bin/chromedriver']
    for path in paths:
        if os.path.exists(path):
            return path
    return 'chromedriver'  # 假設在 PATH 中

def main():
    # 設定選項
    options = Options()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1200,800')
    
    # 設定 ChromeDriver
    chromedriver_path = find_chromedriver()
    service = Service(executable_path=chromedriver_path)
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        print("🌐 正在載入甦醒地圖網站...")
        driver.get("https://subjective-clock.vercel.app/")
        time.sleep(5)
        
        print(f"\n📄 頁面標題: {driver.title}")
        print(f"🔗 當前網址: {driver.current_url}")
        
        print("\n" + "="*50)
        print("🔍 檢查輸入框元素")
        print("="*50)
        
        # 檢查所有輸入框
        inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"找到 {len(inputs)} 個輸入框:")
        
        for i, inp in enumerate(inputs):
            print(f"  輸入框 {i}:")
            print(f"    ID: '{inp.get_attribute('id')}'")
            print(f"    Type: '{inp.get_attribute('type')}'")
            print(f"    Placeholder: '{inp.get_attribute('placeholder')}'")
            print(f"    Class: '{inp.get_attribute('class')}'")
            print(f"    可見: {inp.is_displayed()}")
            print(f"    啟用: {inp.is_enabled()}")
            print()
        
        print("="*50)
        print("🔍 檢查按鈕元素")
        print("="*50)
        
        # 檢查所有按鈕
        buttons = driver.find_elements(By.TAG_NAME, "button")
        print(f"找到 {len(buttons)} 個按鈕:")
        
        for i, btn in enumerate(buttons):
            print(f"  按鈕 {i}:")
            print(f"    ID: '{btn.get_attribute('id')}'")
            print(f"    Text: '{btn.text}'")
            print(f"    Class: '{btn.get_attribute('class')}'")
            print(f"    Type: '{btn.get_attribute('type')}'")
            print(f"    可見: {btn.is_displayed()}")
            print(f"    啟用: {btn.is_enabled()}")
            print()
        
        print("="*50)
        print("🧪 測試填入使用者名稱")
        print("="*50)
        
        # 嘗試不同的使用者名稱輸入框選擇器
        username_selectors = [
            "#userName",
            "input[type='text']",
            "input[placeholder*='name']",
            "input[placeholder*='Name']",
            "input[placeholder*='使用者']",
            "input[placeholder*='用戶']"
        ]
        
        username_input = None
        successful_selector = None
        
        for selector in username_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements and elements[0].is_displayed() and elements[0].is_enabled():
                    username_input = elements[0]
                    successful_selector = selector
                    print(f"✅ 成功找到使用者名稱輸入框: {selector}")
                    break
                else:
                    print(f"❌ 選擇器 {selector}: 找到但不可用")
            except Exception as e:
                print(f"❌ 選擇器 {selector}: {e}")
        
        if username_input:
            try:
                username_input.clear()
                username_input.send_keys("future")
                print("✅ 成功填入使用者名稱 'future'")
                time.sleep(3)  # 等待頁面可能的更新
            except Exception as e:
                print(f"❌ 填入使用者名稱失敗: {e}")
        else:
            print("❌ 無法找到可用的使用者名稱輸入框")
        
        print("\n" + "="*50)
        print("🔍 再次檢查按鈕（填入使用者名稱後）")
        print("="*50)
        
        # 重新檢查按鈕（可能有新的按鈕出現）
        buttons_after = driver.find_elements(By.TAG_NAME, "button")
        print(f"現在找到 {len(buttons_after)} 個按鈕:")
        
        for i, btn in enumerate(buttons_after):
            print(f"  按鈕 {i}:")
            print(f"    ID: '{btn.get_attribute('id')}'")
            print(f"    Text: '{btn.text}'")
            print(f"    Class: '{btn.get_attribute('class')}'")
            print(f"    可見: {btn.is_displayed()}")
            print(f"    啟用: {btn.is_enabled()}")
            print()
        
        print("="*50)
        print("🎯 測試開始按鈕選擇器")
        print("="*50)
        
        # 測試各種開始按鈕選擇器
        start_selectors = [
            "#startButton",
            "button[id='startButton']",
            "button[type='submit']",
            ".start-button",
            ".btn-start",
            "[data-testid='start-button']",
            "button:contains('開始')",
            "button:contains('Start')",
            "button:contains('start')",
            "button:contains('GO')",
            "button:contains('開始體驗')"
        ]
        
        successful_start_selector = None
        
        for selector in start_selectors:
            try:
                if ":contains(" in selector:
                    # 使用 XPath 處理 contains
                    text = selector.split("'")[1]
                    xpath = f"//button[contains(text(), '{text}')]"
                    elements = driver.find_elements(By.XPATH, xpath)
                else:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                
                if elements:
                    btn = elements[0]
                    if btn.is_displayed() and btn.is_enabled():
                        print(f"✅ 找到可用的開始按鈕: {selector}")
                        print(f"   ID: '{btn.get_attribute('id')}'")
                        print(f"   Text: '{btn.text}'")
                        print(f"   Class: '{btn.get_attribute('class')}'")
                        successful_start_selector = selector
                        break
                    else:
                        print(f"⚠️  找到但不可用: {selector}")
                else:
                    print(f"❌ 找不到: {selector}")
            except Exception as e:
                print(f"❌ 測試 {selector} 時出錯: {e}")
        
        print("\n" + "="*50)
        print("📋 調試結果總結")
        print("="*50)
        
        print(f"✅ 成功的使用者名稱選擇器: {successful_selector or '無'}")
        print(f"✅ 成功的開始按鈕選擇器: {successful_start_selector or '無'}")
        
        if successful_start_selector:
            print("\n🎉 建議的修復方案:")
            print(f"將 web_controller_dsi.py 中的開始按鈕選擇器改為: {successful_start_selector}")
        else:
            print("\n⚠️  未找到可用的開始按鈕，請檢查網頁是否完全載入")
        
        print("\n📸 頁面截圖已保存（如果需要）")
        try:
            driver.save_screenshot("/tmp/webpage_debug.png")
            print("截圖保存至: /tmp/webpage_debug.png")
        except:
            print("截圖保存失敗")
        
        input("\n按 Enter 鍵關閉瀏覽器...")
        
    except Exception as e:
        print(f"❌ 調試過程中發生錯誤: {e}")
        
    finally:
        driver.quit()
        print("🔧 調試完成，瀏覽器已關閉")

if __name__ == "__main__":
    main() 