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
                
                # 檢查是否有城市資料
                if data.get('city') or data.get('name'):
                    # 統一城市資料格式
                    result = {
                        'city': data.get('city') or data.get('name'),
                        'city_zh': data.get('city_zh') or data.get('name_zh') or data.get('city') or data.get('name'),
                        'country': data.get('country') or data.get('countryName'),
                        'country_zh': data.get('country_zh') or data.get('countryName_zh') or data.get('country'),
                        'country_code': data.get('country_iso_code') or data.get('country_code'),
                        'latitude': data.get('latitude') or data.get('lat'),
                        'longitude': data.get('longitude') or data.get('lng'),
                        'timezone': data.get('timezone', {}).get('timeZoneId') if isinstance(data.get('timezone'), dict) else data.get('timezone'),
                        'local_time': self._format_local_time(data),
                        'population': data.get('population'),
                        'source': data.get('source', 'api')
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
        
        logger.error("API請求重試次數已用盡")
        return None
    
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