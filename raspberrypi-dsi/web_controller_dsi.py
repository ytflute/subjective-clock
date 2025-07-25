#!/usr/bin/env python3
"""
甦醒地圖 - 網頁控制器
透過 Selenium 控制瀏覽器開啟甦醒地圖網站
"""

import os
import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException, TimeoutException, 
    NoSuchElementException, ElementNotInteractableException
)
import subprocess
import platform

logger = logging.getLogger(__name__)

# 配置常數
WEBSITE_URL = "https://subjective-clock.vercel.app/pi.html"
USER_NAME = "future"
WAIT_TIMEOUT = 30
LOAD_DELAY = 2

def get_chromedriver_path():
    """自動偵測 ChromeDriver 路徑"""
    possible_paths = [
        "/usr/bin/chromedriver",
        "/usr/local/bin/chromedriver", 
        "/opt/homebrew/bin/chromedriver",
        "/snap/bin/chromium.chromedriver",
        "chromedriver"
    ]
    
    for path in possible_paths:
        if os.path.exists(path) or subprocess.run(['which', path], 
                                                capture_output=True).returncode == 0:
            logger.info(f"找到 ChromeDriver: {path}")
            return path
    
    logger.warning("未找到 ChromeDriver，嘗試讓 Selenium 自動處理")
    return None

class WebControllerDSI:
    def __init__(self):
        """
        初始化網頁控制器
        """
        self.driver = None
        self.user_name = USER_NAME
        self.website_url = WEBSITE_URL
        self.wait = None
        self.logger = logging.getLogger(self.__class__.__name__)
        
        self.logger.info("甦醒地圖網頁控制器初始化")

    def _setup_chrome_options(self):
        """設定 Chrome 瀏覽器選項"""
        options = Options()
        
        # 效能優化選項
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-logging')
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        options.add_argument('--disable-renderer-backgrounding')
        options.add_argument('--disable-features=TranslateUI')
        options.add_argument('--disable-ipc-flooding-protection')
        
        # 記憶體優化
        options.add_argument('--memory-pressure-off')
        options.add_argument('--max_old_space_size=4096')
        
        # 網頁顯示設定 (適合 800x480 螢幕)
        options.add_argument('--window-size=800,480')
        options.add_argument('--window-position=0,0')
        
        # 全螢幕 kiosk 模式，隱藏瀏覽器分頁和工具列
        options.add_argument('--kiosk')
        options.add_argument('--disable-infobars')
        options.add_argument('--hide-scrollbars')
        
        # 用戶資料目錄
        options.add_argument('--user-data-dir=/tmp/chrome-data')
        
        # 自動播放政策
        options.add_argument('--autoplay-policy=no-user-gesture-required')
        
        return options

    def start_browser(self):
        """啟動瀏覽器"""
        try:
            self.logger.info("正在啟動瀏覽器...")
            
            # 設定 Chrome 選項
            options = self._setup_chrome_options()
            
            # 嘗試找到 ChromeDriver
            chromedriver_path = get_chromedriver_path()
            
            if chromedriver_path:
                service = Service(chromedriver_path)
                service.log_path = "/tmp/chromedriver.log"
                self.driver = webdriver.Chrome(service=service, options=options)
            else:
                # 讓 Selenium 自動管理 ChromeDriver
                self.driver = webdriver.Chrome(options=options)
            
            # 設定等待物件
            self.wait = WebDriverWait(self.driver, WAIT_TIMEOUT)
            
            self.logger.info("瀏覽器啟動成功")
            return True
            
        except Exception as e:
            self.logger.error(f"瀏覽器啟動失敗：{e}")
            return False

    def load_website(self):
        """載入網站並自動設定"""
        try:
            self.logger.info("正在載入甦醒地圖...")
            
            # 開啟網站
            self.driver.get(self.website_url)
            time.sleep(LOAD_DELAY)
            
            # 自動填入使用者名稱
            self._fill_username()
            
            # 自動點擊載入資料按鈕
            self._click_load_data_button()
            
            self.logger.info("網站載入和設定完成")
            return True
            
        except Exception as e:
            self.logger.error(f"網站載入失敗：{e}")
            return False

    def _fill_username(self):
        """填入使用者名稱（pi.html 版本：使用 JavaScript 設定隱藏輸入框）"""
        try:
            self.logger.info(f"正在設定使用者：{self.user_name}")
            
            # 對於 pi.html，使用者名稱是隱藏輸入框，我們直接用 JavaScript 設定
            self.driver.execute_script(f"document.getElementById('userName').value = '{self.user_name}';")
            
            self.logger.info("使用者名稱設定成功")
            return True
            
        except Exception as e:
            self.logger.error(f"使用者名稱設定失敗：{e}")
            return False

    def _click_load_data_button(self):
        """點擊載入資料按鈕"""
        try:
            self.logger.info("正在載入用戶資料...")
            
            # 等待載入資料按鈕出現並可點擊
            load_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "setUserNameButton"))
            )
            
            # 點擊載入資料按鈕
            load_button.click()
            
            # 等待按鈕處理完成，並確保開始按鈕被啟用
            time.sleep(3)
            
            # 確認開始按鈕已被啟用
            try:
                start_button = self.driver.find_element(By.ID, "findCityButton")
                if start_button.is_enabled():
                    self.logger.info("開始這一天按鈕已啟用")
                else:
                    self.logger.warning("開始這一天按鈕仍為禁用狀態，等待更長時間...")
                    time.sleep(2)
            except Exception:
                self.logger.warning("無法檢查開始按鈕狀態")
            
            self.logger.info("用戶資料載入成功")
            return True
            
        except Exception as e:
            self.logger.error(f"載入用戶資料失敗：{e}")
            return False

    def click_start_button(self):
        """點擊開始這一天按鈕"""
        try:
            self.logger.info("正在開始這一天...")
            
            # 檢查是否為新的狀態管理介面
            try:
                # 直接調用 JavaScript 函數來觸發甦醒流程
                self.logger.info("使用 JavaScript 直接觸發甦醒流程...")
                result = self.driver.execute_script("""
                    try {
                        if (typeof startTheDay === 'function') {
                            startTheDay();
                            return 'JavaScript 函數已執行';
                        } else {
                            return 'startTheDay 函數未找到';
                        }
                    } catch (error) {
                        return 'JavaScript 錯誤: ' + error.message;
                    }
                """)
                self.logger.info(f"JavaScript 執行結果：{result}")
                
                # 等待處理完成
                time.sleep(8)
                
                # 檢查最終狀態
                final_state = self.driver.execute_script("return window.currentState || 'unknown';")
                self.logger.info(f"最終狀態：{final_state}")
                
                # 檢查是否有結果顯示
                try:
                    city_name = self.driver.execute_script("return document.getElementById('cityName') ? document.getElementById('cityName').textContent : '';")
                    if city_name:
                        self.logger.info(f"甦醒城市：{city_name}")
                        return {'success': True, 'message': '甦醒成功', 'result': f'甦醒城市: {city_name}'}
                except Exception:
                    pass
                
                # 檢查是否有錯誤
                try:
                    error_msg = self.driver.execute_script("return document.getElementById('errorMessage') ? document.getElementById('errorMessage').textContent : '';")
                    if error_msg:
                        self.logger.warning(f"檢測到錯誤：{error_msg}")
                        return {'success': False, 'error': error_msg}
                except Exception:
                    pass
                
                return {'success': True, 'message': 'JavaScript 觸發完成'}
                
            except Exception as js_error:
                self.logger.warning(f"JavaScript 觸發失敗，回退到按鈕點擊：{js_error}")
                
                # 回退到傳統按鈕點擊方式
                start_button = self.driver.find_element(By.ID, "findCityButton")
                if not start_button.is_enabled():
                    self.logger.warning("開始按鈕被禁用，嘗試重新載入資料...")
                    if not self._click_load_data_button():
                        return {'success': False, 'error': '無法啟用開始按鈕'}
                    start_button = self.driver.find_element(By.ID, "findCityButton")
                
                # 等待開始按鈕可點擊
                start_button = self.wait.until(
                    EC.element_to_be_clickable((By.ID, "findCityButton"))
                )
                
                # 點擊開始按鈕
                start_button.click()
                self.logger.info("開始按鈕已點擊")
                
                # 等待結果處理
                time.sleep(5)
                
                # 檢查是否有結果顯示
                try:
                    result_element = self.driver.find_element(By.ID, "resultText")
                    if result_element.is_displayed():
                        result_text = result_element.text
                        self.logger.info(f"甦醒結果：{result_text}")
                        return {'success': True, 'message': '開始這一天成功', 'result': result_text}
                except NoSuchElementException:
                    pass
                
                return {'success': True, 'message': '開始按鈕已點擊'}
            
        except Exception as e:
            self.logger.error(f"點擊開始按鈕失敗：{e}")
            return {'success': False, 'error': str(e)}

    def reload_website(self):
        """重新載入網站"""
        try:
            self.logger.info("正在重新載入網站...")
            
            # 重新載入頁面
            self.driver.refresh()
            time.sleep(LOAD_DELAY)
            
            # 重新設定使用者資料
            if self._fill_username() and self._click_load_data_button():
                self.logger.info("網站重新載入成功")
                return {'success': True, 'message': '網站重新載入成功'}
            else:
                return {'success': False, 'error': '重新設定失敗'}
                
        except Exception as e:
            self.logger.error(f"重新載入網站失敗：{e}")
            return {'success': False, 'error': str(e)}

    def stop(self):
        """停止並清理瀏覽器"""
        try:
            if self.driver:
                self.logger.info("正在關閉瀏覽器...")
                self.driver.quit()
                self.driver = None
                
        except Exception as e:
            self.logger.error(f"關閉瀏覽器時發生錯誤：{e}")

    def get_page_title(self):
        """取得頁面標題"""
        try:
            if self.driver:
                return self.driver.title
            return None
        except Exception as e:
            self.logger.error(f"取得頁面標題失敗：{e}")
            return None

    def is_browser_running(self):
        """檢查瀏覽器是否正在運行"""
        try:
            if self.driver:
                # 嘗試取得當前URL來測試連接
                _ = self.driver.current_url
                return True
            return False
        except Exception:
            return False

    def _extract_city_data(self):
        """從網頁提取城市資料"""
        try:
            # 等待城市名稱元素出現
            city_name = self.wait_for_element_text('.city-name', timeout=2)
            country_name = self.wait_for_element_text('.country-name', timeout=2)
            
            # 清理城市名稱（移除冒號和空格）
            city_name = city_name.strip().rstrip(':').strip() if city_name else ''
            country_name = country_name.strip() if country_name else ''
            
            # 從國家名稱獲取國家代碼
            country_code = self._get_country_code(country_name)
            
            # 獲取經緯度
            coordinates = self.wait_for_element_text('#coordinates', timeout=2)
            lat, lon = None, None
            if coordinates:
                try:
                    lat_str, lon_str = coordinates.split(',')
                    lat = float(lat_str.strip())
                    lon = float(lon_str.strip())
                except:
                    self.logger.warning(f'無法解析座標: {coordinates}')
            
            # 獲取時區
            timezone = self.wait_for_element_attribute('.timezone-info', 'data-timezone', timeout=2) or ''
            
            city_data = {
                'city': city_name,
                'country': country_name,
                'countryCode': country_code,
                'latitude': lat,
                'longitude': lon,
                'timezone': timezone
            }
            
            self.logger.info(f'甦醒城市：{city_name}')
            return city_data
            
        except Exception as e:
            self.logger.error(f'提取城市資料失敗: {e}')
            return None
            
    def _get_country_code(self, country_name):
        """根據國家名稱獲取國家代碼"""
        country_map = {
            'United States': 'US',
            'Chile': 'CL',
            'Peru': 'PE',
            'Brazil': 'BR',
            'Argentina': 'AR',
            'Mexico': 'MX',
            'Canada': 'CA',
            'China': 'CN',
            'Japan': 'JP',
            'South Korea': 'KR',
            'Taiwan': 'TW',
            'Hong Kong': 'HK',
            'Singapore': 'SG',
            'Malaysia': 'MY',
            'Thailand': 'TH',
            'Vietnam': 'VN',
            'Indonesia': 'ID',
            'Philippines': 'PH',
            'India': 'IN',
            'Australia': 'AU',
            'New Zealand': 'NZ',
            'United Kingdom': 'GB',
            'France': 'FR',
            'Germany': 'DE',
            'Italy': 'IT',
            'Spain': 'ES',
            'Portugal': 'PT',
            'Netherlands': 'NL',
            'Belgium': 'BE',
            'Switzerland': 'CH',
            'Austria': 'AT',
            'Sweden': 'SE',
            'Norway': 'NO',
            'Denmark': 'DK',
            'Finland': 'FI',
            'Russia': 'RU',
            'Poland': 'PL',
            'Czech Republic': 'CZ',
            'Hungary': 'HU',
            'Greece': 'GR',
            'Turkey': 'TR',
            'Israel': 'IL',
            'South Africa': 'ZA',
            'Egypt': 'EG',
            'Morocco': 'MA',
            'United Arab Emirates': 'AE',
            'Saudi Arabia': 'SA'
        }
        return country_map.get(country_name, '')

# 測試程式
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    print("甦醒地圖網頁控制器測試")
    
    controller = WebControllerDSI()
    
    try:
        # 啟動瀏覽器
        if controller.start_browser():
            print("瀏覽器啟動成功")
            
            # 載入網站
            if controller.load_website():
                print("網站載入成功")
                
                # 等待用戶輸入來測試按鈕功能
                input("按 Enter 鍵測試開始按鈕...")
                result = controller.click_start_button()
                print(f"開始按鈕結果：{result}")
                
            time.sleep(5)  # 等待觀察
        else:
            print("瀏覽器啟動失敗")
    
    except KeyboardInterrupt:
        print("測試中斷")
    
    finally:
        controller.stop()
        print("測試完成") 