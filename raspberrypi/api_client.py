#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import logging
from datetime import datetime, timezone
from config import API_ENDPOINTS, USER_CONFIG, DEBUG_MODE

# 設定日誌
if DEBUG_MODE:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

class APIClient:
    """API客戶端：與甦醒地圖後端通信"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'RaspberryPi-SubjectiveClock/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
    
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
                timeout=10
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
            response = self.session.get(
                API_ENDPOINTS['find_city'],
                params=params,
                timeout=10
            )
            
            response.raise_for_status()
            data = response.json()
            
            if data.get('success') and data.get('selectedCity'):
                city_info = data['selectedCity']
                
                result = {
                    'city': city_info.get('name'),
                    'country': city_info.get('country'),
                    'country_code': city_info.get('country_code'),
                    'latitude': city_info.get('latitude'),
                    'longitude': city_info.get('longitude'),
                    'timezone': city_info.get('timezone'),
                    'local_time': city_info.get('localTime'),
                }
                
                logger.info(f"找到匹配城市: {result['city']}, {result['country']}")
                return result
            else:
                logger.warning("API回應中沒有找到匹配的城市")
                return None
                
        except Exception as e:
            logger.error(f"尋找城市失敗: {e}")
            return None
    
    def translate_location(self, city, country, country_code):
        """呼叫翻譯API獲取中文地名"""
        try:
            payload = {
                'city': city,
                'country': country,
                'countryCode': country_code
            }
            
            response = self.session.post(
                API_ENDPOINTS['translate'],
                json=payload,
                timeout=10
            )
            
            response.raise_for_status()
            data = response.json()
            
            return {
                'city_zh': data.get('city_zh', city),
                'country_zh': data.get('country_zh', country),
                'translated': data.get('translated', False),
            }
            
        except Exception as e:
            logger.error(f"翻譯失敗: {e}")
            return {
                'city_zh': city,
                'country_zh': country,
                'translated': False,
            }
    
    def get_complete_city_info(self):
        """獲取完整的城市資訊（匹配 + 翻譯）"""
        try:
            # 1. 尋找匹配城市
            city_info = self.find_matching_city()
            if not city_info:
                return None
            
            # 2. 翻譯地名
            translation = self.translate_location(
                city_info['city'],
                city_info['country'],
                city_info['country_code']
            )
            
            # 3. 合併結果
            complete_info = {
                **city_info,
                **translation,
                'timestamp': datetime.now().isoformat()
            }
            
            return complete_info
            
        except Exception as e:
            logger.error(f"獲取完整城市資訊失敗: {e}")
            return None
    
    def save_user_record(self, city_info):
        """儲存使用者記錄到網站資料庫"""
        try:
            # 計算目標緯度和 UTC 偏移
            target_latitude = self.calculate_target_latitude_from_time()
            utc_offset = self.get_current_utc_offset()
            
            # 如果是特例時間段，設定適當的描述
            if target_latitude == 'local':
                latitude_description = "當地位置 (7:50-8:10特例時間段)"
                target_latitude = city_info.get('latitude', 0)
            else:
                from datetime import datetime
                minutes = datetime.now().minute
                latitude_description = f"基於時間 {minutes} 分鐘計算的緯度偏好"
            
            # 準備記錄資料
            record_data = {
                'userDisplayName': USER_CONFIG['display_name'],
                'dataIdentifier': USER_CONFIG['identifier'],
                'city': city_info['city'],
                'country': city_info['country'],
                'city_zh': city_info.get('city_zh', city_info['city']),
                'country_zh': city_info.get('country_zh', city_info['country']),
                'country_iso_code': city_info.get('country_code', ''),
                'latitude': city_info.get('latitude', 0),
                'longitude': city_info.get('longitude', 0),
                'timezone': city_info.get('timezone', 'UTC'),
                'localTime': city_info.get('local_time', datetime.now().isoformat()),
                'targetUTCOffset': utc_offset,
                'matchedCityUTCOffset': utc_offset,  # 使用相同值
                'source': 'raspberry_pi_api',
                'translationSource': city_info.get('translationSource', 'api'),
                'timeMinutes': datetime.now().minute,
                'latitudePreference': target_latitude if target_latitude != 'local' else city_info.get('latitude', 0),
                'latitudeDescription': latitude_description,
                'deviceType': USER_CONFIG['device_type']
            }
            
            logger.info(f"正在儲存使用者 '{USER_CONFIG['display_name']}' 的記錄...")
            
            # 發送到 API
            response = self.session.post(
                API_ENDPOINTS['save_record'],
                json=record_data,
                timeout=10
            )
            
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                logger.info(f"記錄已成功同步到網站，歷史 ID: {result.get('historyId')}")
                return True
            else:
                logger.error(f"記錄同步失敗: {result.get('error')}")
                return False
                
        except Exception as e:
            logger.error(f"儲存使用者記錄失敗: {e}")
            return False
    
    def cleanup(self):
        """清理資源"""
        try:
            self.session.close()
        except:
            pass 