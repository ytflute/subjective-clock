"""
API客戶端模組
處理與後端API的通訊
"""

import asyncio
import aiohttp
import json
from datetime import datetime
from typing import Dict, Optional

from utils.logger import LoggerMixin

class APIClient(LoggerMixin):
    """API客戶端"""
    
    def __init__(self, config_manager):
        self.config = config_manager
        self.api_config = config_manager.get_api_config()
        
        # API端點配置
        self.base_url = self.api_config.get('base_url', 'https://subjective-clock.vercel.app')
        self.find_city_endpoint = f"{self.base_url}/api/find-city-geonames"
        self.translate_endpoint = f"{self.base_url}/api/translate-location"
        self.save_record_endpoint = f"{self.base_url}/api/save-record"
        self.generate_story_endpoint = f"{self.base_url}/api/generatePiStory"
        
        self.session = None
        self.timeout = aiohttp.ClientTimeout(total=30)
    
    async def _get_session(self):
        """獲取HTTP會話"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self.session
    
    async def find_city(self) -> Optional[Dict]:
        """尋找甦醒城市"""
        try:
            # 計算當前時間的緯度偏好
            now = datetime.now()
            minutes = now.minute
            target_latitude = 70 - (minutes * 140 / 59)
            
            # 特例時間段 (7:50-8:10) - 使用本地位置
            use_local = (now.hour == 7 and minutes >= 50) or (now.hour == 8 and minutes <= 10)
            
            payload = {
                "targetUTCOffset": 8.0,  # 可以從配置獲取
                "targetLatitude": target_latitude,
                "timeMinutes": minutes,
                "userCityVisitStats": {},  # 可以從本地文件讀取
                "useLocalPosition": use_local
            }
            
            session = await self._get_session()
            async with session.post(self.find_city_endpoint, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('success'):
                        city_info = data.get('city', {})
                        self.logger.info(f"✅ 找到城市: {city_info.get('name')}, {city_info.get('country')}")
                        return city_info
                    else:
                        raise Exception(data.get('error', '未知錯誤'))
                else:
                    raise Exception(f"API回應錯誤: {response.status}")
                    
        except Exception as e:
            self.logger.error(f"❌ 城市搜尋失敗: {e}")
            return None
    
    async def translate_location(self, city: str, country: str) -> Optional[Dict]:
        """翻譯位置名稱"""
        try:
            payload = {
                "city": city,
                "country": country
            }
            
            session = await self._get_session()
            async with session.post(self.translate_endpoint, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    self.logger.info(f"✅ 翻譯完成: {data}")
                    return data
                else:
                    raise Exception(f"翻譯API錯誤: {response.status}")
                    
        except Exception as e:
            self.logger.error(f"❌ 位置翻譯失敗: {e}")
            return None
    
    async def generate_story(self, city: str, country: str) -> Optional[Dict]:
        """生成甦醒故事"""
        try:
            payload = {
                "city": city,
                "country": country
            }
            
            session = await self._get_session()
            async with session.post(self.generate_story_endpoint, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    self.logger.info("✅ 故事生成完成")
                    return data
                else:
                    raise Exception(f"故事生成API錯誤: {response.status}")
                    
        except Exception as e:
            self.logger.error(f"❌ 故事生成失敗: {e}")
            return None
    
    async def save_record(self, record_data: Dict) -> bool:
        """保存記錄到後端"""
        try:
            # 添加設備類型標識
            payload = {
                **record_data,
                "deviceType": "raspberry_pi_dsi",
                "timestamp": datetime.now().isoformat()
            }
            
            session = await self._get_session()
            async with session.post(self.save_record_endpoint, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('success'):
                        self.logger.info("✅ 記錄保存成功")
                        return True
                    else:
                        raise Exception(data.get('error', '保存失敗'))
                else:
                    raise Exception(f"保存API錯誤: {response.status}")
                    
        except Exception as e:
            self.logger.error(f"❌ 記錄保存失敗: {e}")
            return False
    
    async def cleanup(self):
        """清理HTTP會話"""
        if self.session:
            await self.session.close()
            self.session = None
            self.logger.info("✅ API客戶端清理完成")

class MockAPIClient(APIClient):
    """模擬API客戶端（用於測試）"""
    
    async def find_city(self) -> Optional[Dict]:
        """模擬城市搜尋"""
        await asyncio.sleep(1)  # 模擬網路延遲
        
        mock_city = {
            "name": "Tokyo",
            "country": "Japan",
            "latitude": 35.6762,
            "longitude": 139.6503,
            "timezone": {"timeZoneId": "Asia/Tokyo"},
            "country_iso_code": "JP"
        }
        
        self.logger.info(f"🔄 模擬找到城市: {mock_city['name']}, {mock_city['country']}")
        return mock_city
    
    async def save_record(self, record_data: Dict) -> bool:
        """模擬記錄保存"""
        await asyncio.sleep(0.5)
        self.logger.info("🔄 模擬記錄保存成功")
        return True
    
    async def generate_story(self, city: str, country: str) -> Optional[Dict]:
        """模擬故事生成"""
        await asyncio.sleep(1)
        
        mock_story = {
            "story": f"早安！今天的你在{country}的{city}醒來。這是一個充滿希望的早晨...",
            "greeting": "Good morning!",
            "language": "Japanese"
        }
        
        self.logger.info("🔄 模擬故事生成完成")
        return mock_story