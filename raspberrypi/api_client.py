#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import logging
from datetime import datetime, timezone
from config import API_ENDPOINTS, DEBUG_MODE

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
        minutes = now.minute  # 0-59
        
        # 線性映射：0分=北緯90度，30分≈赤道0度，59分=南緯90度
        target_latitude = 90 - (minutes * 180 / 59)
        
        logger.debug(f"時間: {minutes}分 -> 目標緯度: {target_latitude:.2f}度")
        return target_latitude
    
    def get_current_utc_offset(self):
        """獲取當前UTC偏移量"""
        now = datetime.now(timezone.utc)
        local_now = datetime.now()
        
        # 計算UTC偏移量（小時）
        utc_offset = (local_now - now.replace(tzinfo=None)).total_seconds() / 3600
        logger.debug(f"當前UTC偏移量: {utc_offset}小時")
        return utc_offset
    
    def find_matching_city(self):
        """呼叫城市匹配API"""
        try:
            # 計算參數
            target_latitude = self.calculate_target_latitude_from_time()
            utc_offset = self.get_current_utc_offset()
            
            # 準備API請求參數
            params = {
                'targetUTCOffset': utc_offset,
                'targetLatitude': target_latitude,
                'latitudePreference': 'any',
                'userLocalTime': datetime.now().isoformat()
            }
            
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
    
    def cleanup(self):
        """清理資源"""
        try:
            self.session.close()
        except:
            pass 