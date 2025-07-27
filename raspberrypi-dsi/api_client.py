#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WakeUpMap - API客戶端模組 (DSI版本)
"""

import requests
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from config import API_ENDPOINTS, API_CONFIG

logger = logging.getLogger(__name__)

class APIClient:
    """API客戶端：與甦醒地圖後端通信"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'RaspberryPi-WakeUpMap-DSI/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
        self.session.timeout = API_CONFIG['timeout']
    
    def calculate_target_latitude_from_time(self):
        """基於時間分鐘數計算目標緯度"""
        now = datetime.now()
        hours = now.hour
        minutes = now.minute
        
        # 檢查是否在7:50-8:10特例時間段
        if (hours == 7 and minutes >= 50) or (hours == 8 and minutes <= 10):
            logger.info(f"時間: {hours}:{minutes:02d} -> 特例時間段，將使用用戶當地位置")
            return 'local'  # 返回特殊標記，表示使用用戶當地位置
        
        # 修正後的線性映射：避免極地問題
        # 0分=北緯70度，30分≈赤道0度，59分=南緯70度
        target_latitude = 70 - (minutes * 140 / 59)
        
        logger.debug(f"時間: {hours}:{minutes:02d} -> 目標緯度: {target_latitude:.2f}度 (避免極地)")
        return target_latitude
    
    def get_current_utc_offset(self):
        """獲取當前UTC偏移量"""
        now = datetime.now(timezone.utc)
        local_now = datetime.now()
        
        # 計算UTC偏移量（小時）
        utc_offset = (local_now - now.replace(tzinfo=None)).total_seconds() / 3600
        logger.debug(f"當前UTC偏移量: {utc_offset}小時")
        return utc_offset
    
    def get_user_location_by_ip(self):
        """通過IP地理定位獲取用戶位置"""
        try:
            # 使用免費的IP地理定位服務
            response = self.session.get(
                'http://ip-api.com/json/?fields=lat,lon,city,country,countryCode,timezone',
                timeout=API_CONFIG['timeout']
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('lat') and data.get('lon'):
                    location = {
                        'latitude': data['lat'],
                        'longitude': data['lon'],
                        'city': data.get('city', ''),
                        'country': data.get('country', ''),
                        'country_code': data.get('countryCode', ''),
                        'timezone': data.get('timezone', '')
                    }
                    logger.info(f"通過IP獲取到位置: {location['city']}, {location['country']} ({location['latitude']:.4f}, {location['longitude']:.4f})")
                    return location
            
            logger.warning("IP地理定位服務無法獲取位置")
            return None
            
        except Exception as e:
            logger.error(f"IP地理定位失敗: {e}")
            return None
    
    def find_matching_city(self):
        """呼叫城市匹配API"""
        retries = 0
        while retries < API_CONFIG['max_retries']:
            try:
                # 計算參數
                target_latitude = self.calculate_target_latitude_from_time()
                utc_offset = self.get_current_utc_offset()
                
                # 準備API請求參數
                params = {
                    'targetUTCOffset': utc_offset,
                    'latitudePreference': 'any',
                    'userLocalTime': datetime.now().isoformat()
                }
                
                # 檢查是否為特例時間段
                if target_latitude == 'local':
                    logger.info("特例時間段 (7:50-8:10)，正在獲取用戶地理位置...")
                    
                    # 獲取用戶位置
                    user_location = self.get_user_location_by_ip()
                    if user_location:
                        params['useLocalPosition'] = True
                        params['userLatitude'] = user_location['latitude']
                        params['userLongitude'] = user_location['longitude']
                        logger.info(f"使用用戶位置: {user_location['latitude']:.4f}, {user_location['longitude']:.4f}")
                    else:
                        logger.warning("無法獲取用戶位置，使用備用方案")
                        params['targetLatitude'] = 0  # 赤道附近
                        params['useLocalPosition'] = False
                else:
                    # 正常時間段：使用計算的緯度
                    params['targetLatitude'] = target_latitude
                    params['useLocalPosition'] = False
                
                logger.info(f"正在尋找匹配城市，參數: {params}")
                
                # 發送API請求
                response = self.session.post(
                    API_ENDPOINTS['find_city'],
                    json=params,  # 使用POST和JSON
                    timeout=API_CONFIG['timeout']
                )
                
                response.raise_for_status()
                data = response.json()
                
                # 檢查是否有城市資料 - 修復 API 回應結構解析
                if data.get('success') and data.get('city'):
                    city_data = data['city']  # 正確獲取城市資料物件
                    # 統一城市資料格式
                    result = {
                        'city': city_data.get('name') or city_data.get('city'),
                        'city_zh': city_data.get('name_zh') or city_data.get('city_zh') or city_data.get('name') or city_data.get('city'),
                        'country': city_data.get('country') or city_data.get('countryName'),
                        'country_zh': city_data.get('country_zh') or city_data.get('countryName_zh') or city_data.get('country'),
                        'country_code': city_data.get('country_iso_code') or city_data.get('country_code'),
                        'latitude': city_data.get('latitude') or city_data.get('lat') or 0,
                        'longitude': city_data.get('longitude') or city_data.get('lng') or 0,
                        'timezone': city_data.get('timezone', {}).get('timeZoneId') if isinstance(city_data.get('timezone'), dict) else city_data.get('timezone'),
                        'local_time': self._format_local_time(city_data),
                        'population': city_data.get('population'),
                        'source': city_data.get('source', 'api')
                    }
                    
                    logger.info(f"找到匹配城市: {result['city']}, {result['country']}")
                    return result
                
                elif data.get('isUniverseCase'):
                    # 宇宙模式
                    logger.info("觸發宇宙模式")
                    return {
                        'city': '宇宙',
                        'city_zh': '宇宙',
                        'country': '銀河系',
                        'country_zh': '銀河系',
                        'country_code': 'UNIVERSE',
                        'latitude': 0,
                        'longitude': 0,
                        'timezone': 'UTC',
                        'local_time': datetime.now().strftime('%H:%M:%S'),
                        'population': float('inf'),
                        'source': 'universe'
                    }
                
                else:
                    logger.warning("API回應中沒有找到匹配的城市")
                    return None
                    
            except requests.exceptions.Timeout:
                retries += 1
                logger.warning(f"API請求超時，重試 {retries}/{API_CONFIG['max_retries']}")
                if retries < API_CONFIG['max_retries']:
                    import time
                    time.sleep(API_CONFIG['retry_delay'])
                continue
                
            except requests.exceptions.RequestException as e:
                retries += 1
                logger.error(f"API請求失敗: {e}，重試 {retries}/{API_CONFIG['max_retries']}")
                if retries < API_CONFIG['max_retries']:
                    import time
                    time.sleep(API_CONFIG['retry_delay'])
                continue
                
            except Exception as e:
                logger.error(f"尋找城市失敗: {e}")
                return None
        
        logger.error("API請求重試次數已用盡，使用備用城市資料")
        return self._get_fallback_city()
    
    def _format_local_time(self, data: Dict[str, Any]) -> str:
        """格式化當地時間"""
        try:
            # 嘗試從不同的欄位獲取時間
            local_time = data.get('local_time') or data.get('localTime')
            
            if local_time:
                return local_time
            
            # 如果沒有當地時間，使用當前時間
            return datetime.now().strftime('%H:%M:%S')
            
        except Exception as e:
            logger.warning(f"格式化當地時間失敗: {e}")
            return datetime.now().strftime('%H:%M:%S')
    
    def _get_fallback_city(self):
        """獲取備用城市資料（當API不可用時）"""
        import random
        
        # 備用城市資料庫
        fallback_cities = [
            {
                'city': '台北',
                'city_zh': '台北',
                'country': '台灣',
                'country_zh': '台灣',
                'country_code': 'TW',
                'latitude': 25.0330,
                'longitude': 121.5654,
                'timezone': 'Asia/Taipei',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 2646204,
                'source': 'fallback'
            },
            {
                'city': '東京',
                'city_zh': '東京',
                'country': '日本',
                'country_zh': '日本',
                'country_code': 'JP',
                'latitude': 35.6762,
                'longitude': 139.6503,
                'timezone': 'Asia/Tokyo',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 13929286,
                'source': 'fallback'
            },
            {
                'city': '首爾',
                'city_zh': '首爾',
                'country': '韓國',
                'country_zh': '韓國',
                'country_code': 'KR',
                'latitude': 37.5665,
                'longitude': 126.9780,
                'timezone': 'Asia/Seoul',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 9776000,
                'source': 'fallback'
            },
            {
                'city': '紐約',
                'city_zh': '紐約',
                'country': '美國',
                'country_zh': '美國',
                'country_code': 'US',
                'latitude': 40.7128,
                'longitude': -74.0060,
                'timezone': 'America/New_York',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 8336817,
                'source': 'fallback'
            },
            {
                'city': '巴黎',
                'city_zh': '巴黎',
                'country': '法國',
                'country_zh': '法國',
                'country_code': 'FR',
                'latitude': 48.8566,
                'longitude': 2.3522,
                'timezone': 'Europe/Paris',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 2165423,
                'source': 'fallback'
            },
            {
                'city': '倫敦',
                'city_zh': '倫敦',
                'country': '英國',
                'country_zh': '英國',
                'country_code': 'GB',
                'latitude': 51.5074,
                'longitude': -0.1278,
                'timezone': 'Europe/London',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 8982000,
                'source': 'fallback'
            },
            {
                'city': '香港',
                'city_zh': '香港',
                'country': '香港',
                'country_zh': '香港',
                'country_code': 'HK',
                'latitude': 22.3193,
                'longitude': 114.1694,
                'timezone': 'Asia/Hong_Kong',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 7496981,
                'source': 'fallback'
            },
            {
                'city': '新加坡',
                'city_zh': '新加坡',
                'country': '新加坡',
                'country_zh': '新加坡',
                'country_code': 'SG',
                'latitude': 1.3521,
                'longitude': 103.8198,
                'timezone': 'Asia/Singapore',
                'local_time': datetime.now().strftime('%H:%M:%S'),
                'population': 5850342,
                'source': 'fallback'
            }
        ]
        
        # 隨機選擇一個城市
        selected_city = random.choice(fallback_cities)
        
        logger.info(f"使用備用城市資料: {selected_city['city']}, {selected_city['country']}")
        return selected_city
    
    def get_weather_info(self, latitude: float, longitude: float):
        """獲取天氣資訊 (可選功能)"""
        try:
            # 這裡可以整合天氣API
            # 例如 OpenWeatherMap, WeatherAPI 等
            logger.info(f"獲取天氣資訊: {latitude}, {longitude}")
            
            # 暫時返回模擬資料
            return {
                'temperature': 20,
                'condition': 'sunny',
                'humidity': 60,
                'description': '晴朗'
            }
            
        except Exception as e:
            logger.error(f"獲取天氣資訊失敗: {e}")
            return None
    
    def test_connection(self):
        """測試API連線"""
        try:
            # 測試基本的網路連線
            response = self.session.get('https://httpbin.org/get', timeout=5)
            if response.status_code == 200:
                logger.info("網路連線正常")
                return True
            else:
                logger.warning("網路連線異常")
                return False
                
        except Exception as e:
            logger.error(f"網路連線測試失敗: {e}")
            return False
    
    def save_user_record(self, city_data):
        """儲存使用者記錄到網站資料庫"""
        try:
            from config import USER_CONFIG
            
            # 計算目標緯度和 UTC 偏移（簡化版）
            now = datetime.now()
            minutes = now.minute
            
            # 基於時間分鐘數計算目標緯度
            if (now.hour == 7 and minutes >= 50) or (now.hour == 8 and minutes <= 10):
                latitude_description = "當地位置 (7:50-8:10特例時間段)"
                target_latitude = city_data.get('latitude', 0)
            else:
                target_latitude = 70 - (minutes * 140 / 59)
                latitude_description = f"基於時間 {minutes} 分鐘計算的緯度偏好"
            
            # 準備記錄資料
            record_data = {
                'userDisplayName': USER_CONFIG['display_name'],
                'dataIdentifier': USER_CONFIG['identifier'],
                'city': city_data['city'],
                'country': city_data['country'],
                'city_zh': city_data.get('city_zh', city_data['city']),
                'country_zh': city_data.get('country_zh', city_data['country']),
                'country_iso_code': city_data.get('country_code', ''),
                'latitude': city_data.get('latitude', 0),
                'longitude': city_data.get('longitude', 0),
                'timezone': city_data.get('timezone', 'UTC'),
                'localTime': now.isoformat(),
                'targetUTCOffset': 8,  # 台灣時區
                'matchedCityUTCOffset': 8,
                'source': 'raspberry_pi_dsi_api',
                'translationSource': 'api',
                'timeMinutes': minutes,
                'latitudePreference': target_latitude,
                'latitudeDescription': latitude_description,
                'deviceType': USER_CONFIG['device_type']
            }
            
            print(f"🔄 正在同步使用者 '{USER_CONFIG['display_name']}' 的記錄...")
            
            # 發送到 API
            response = self.session.post(
                API_ENDPOINTS['save_record'],
                json=record_data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print(f"✅ 記錄已成功同步到網站，歷史 ID: {result.get('historyId')}")
                    return True
                else:
                    print(f"❌ 記錄同步失敗: {result.get('error')}")
                    return False
            else:
                print(f"❌ API 回應錯誤: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ 儲存使用者記錄失敗: {e}")
            return False

# 測試程式
if __name__ == "__main__":
    import time
    
    # 設定日誌
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("API客戶端測試程式")
    
    # 創建API客戶端
    api_client = APIClient()
    
    # 測試連線
    print("測試網路連線...")
    if api_client.test_connection():
        print("✓ 網路連線正常")
    else:
        print("✗ 網路連線失敗")
        exit(1)
    
    # 測試城市搜尋
    print("\n測試城市搜尋...")
    result = api_client.find_matching_city()
    
    if result:
        print(f"✓ 找到城市: {result['city']}, {result['country']}")
        print(f"  座標: {result['latitude']:.4f}, {result['longitude']:.4f}")
        print(f"  當地時間: {result['local_time']}")
        print(f"  資料來源: {result['source']}")
    else:
        print("✗ 無法找到匹配的城市")
    
    print("\n測試完成") 