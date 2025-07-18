#!/usr/bin/env python3
"""
Pi 按鈕問題除錯腳本
檢查按鈕點擊後為什麼沒有顯示結果
"""

import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_browser():
    """設定瀏覽器"""
    options = Options()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=800,480')
    options.add_argument('--kiosk')
    
    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        logger.error(f"瀏覽器啟動失敗: {e}")
        return None

def check_pi_interface():
    """檢查 Pi 介面"""
    driver = setup_browser()
    if not driver:
        return
    
    try:
        logger.info("🌐 載入 Pi 介面...")
        driver.get("https://subjective-clock.vercel.app/pi.html")
        time.sleep(3)
        
        # 檢查 DOM 元素
        logger.info("🔍 檢查 DOM 元素...")
        elements_to_check = [
            'waitingState', 'resultState', 'loadingState', 'errorState',
            'cityName', 'countryName', 'countryFlag', 'greetingText',
            'mapContainer', 'coordinateInfo'
        ]
        
        for element_id in elements_to_check:
            try:
                element = driver.find_element(By.ID, element_id)
                visible = element.is_displayed()
                logger.info(f"  ✅ {element_id}: 找到, 可見: {visible}")
            except Exception:
                logger.warning(f"  ❌ {element_id}: 未找到")
        
        # 檢查 JavaScript 錯誤
        logger.info("🔍 檢查 JavaScript 錯誤...")
        logs = driver.get_log('browser')
        if logs:
            logger.warning("發現瀏覽器錯誤:")
            for log in logs:
                logger.warning(f"  {log['level']}: {log['message']}")
        else:
            logger.info("  ✅ 沒有 JavaScript 錯誤")
        
        # 檢查當前狀態
        logger.info("🔍 檢查當前狀態...")
        try:
            current_state = driver.execute_script("return window.currentState || 'unknown';")
            logger.info(f"  當前狀態: {current_state}")
        except Exception as e:
            logger.warning(f"  無法獲取狀態: {e}")
        
        # 檢查 Firebase 初始化
        logger.info("🔍 檢查 Firebase 初始化...")
        try:
            firebase_ready = driver.execute_script("return window.firebaseSDK !== undefined;")
            logger.info(f"  Firebase 準備: {firebase_ready}")
        except Exception as e:
            logger.warning(f"  Firebase 檢查失敗: {e}")
        
        # 模擬按鈕點擊
        logger.info("🔘 模擬按鈕點擊...")
        try:
            # 等待 JavaScript 完全載入
            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script("return window.firebaseSDK !== undefined;")
            )
            
            # 執行開始函數
            result = driver.execute_script("""
                try {
                    if (typeof startTheDay === 'function') {
                        startTheDay();
                        return 'startTheDay 函數已執行';
                    } else {
                        return 'startTheDay 函數未找到';
                    }
                } catch (error) {
                    return 'JavaScript 錯誤: ' + error.message;
                }
            """)
            logger.info(f"  執行結果: {result}")
            
            # 等待一段時間觀察變化
            time.sleep(5)
            
            # 檢查狀態變化
            new_state = driver.execute_script("return window.currentState || 'unknown';")
            logger.info(f"  執行後狀態: {new_state}")
            
            # 檢查可見的狀態元素
            active_states = []
            for state in ['waitingState', 'loadingState', 'resultState', 'errorState']:
                try:
                    element = driver.find_element(By.ID, state)
                    if 'active' in element.get_attribute('class'):
                        active_states.append(state)
                except Exception:
                    pass
            
            logger.info(f"  活動狀態: {active_states}")
            
        except Exception as e:
            logger.error(f"  按鈕點擊模擬失敗: {e}")
        
        # 檢查控制台輸出
        logger.info("🔍 檢查最新的控制台輸出...")
        logs = driver.get_log('browser')
        if logs:
            logger.info("最新控制台輸出:")
            for log in logs[-5:]:  # 顯示最後5條
                logger.info(f"  {log['level']}: {log['message']}")
        
        input("按 Enter 鍵關閉瀏覽器...")
        
    except Exception as e:
        logger.error(f"除錯過程發生錯誤: {e}")
    
    finally:
        driver.quit()

if __name__ == "__main__":
    print("🔧 Pi 介面除錯工具")
    print("=" * 50)
    check_pi_interface() 