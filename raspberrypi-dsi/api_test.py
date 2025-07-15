#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 連接診斷和測試工具
"""

import requests
import json
import time
import sys
from datetime import datetime
from config import API_ENDPOINTS, API_CONFIG

def test_basic_network():
    """測試基本網路連接"""
    print("=== 測試基本網路連接 ===")
    
    # 測試 DNS 解析
    try:
        import socket
        socket.gethostbyname('google.com')
        print("✅ DNS 解析正常")
    except Exception as e:
        print(f"❌ DNS 解析失敗: {e}")
        return False
    
    # 測試基本 HTTP 連接
    try:
        response = requests.get('http://httpbin.org/get', timeout=10)
        if response.status_code == 200:
            print("✅ HTTP 連接正常")
        else:
            print(f"❌ HTTP 連接異常: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ HTTP 連接失敗: {e}")
        return False
    
    # 測試 HTTPS 連接
    try:
        response = requests.get('https://httpbin.org/get', timeout=10)
        if response.status_code == 200:
            print("✅ HTTPS 連接正常")
        else:
            print(f"❌ HTTPS 連接異常: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ HTTPS 連接失敗: {e}")
        return False
    
    return True

def test_time_sync():
    """測試時間同步"""
    print("\n=== 檢查系統時間 ===")
    
    try:
        # 獲取網路時間
        response = requests.get('http://worldtimeapi.org/api/timezone/UTC', timeout=10)
        if response.status_code == 200:
            data = response.json()
            network_time = datetime.fromisoformat(data['datetime'].replace('Z', '+00:00'))
            local_time = datetime.now()
            
            time_diff = abs((network_time - local_time).total_seconds())
            
            print(f"系統時間: {local_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"網路時間: {network_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"時間差異: {time_diff:.1f} 秒")
            
            if time_diff > 300:  # 5分鐘
                print("❌ 系統時間可能不正確，這可能導致 HTTPS 證書驗證失敗")
                print("建議執行: sudo ntpdate -s time.nist.gov")
                return False
            else:
                print("✅ 系統時間正常")
                return True
        else:
            print("❌ 無法獲取網路時間")
            return False
    except Exception as e:
        print(f"❌ 時間同步檢查失敗: {e}")
        return False

def test_vercel_connection():
    """測試 Vercel 網站連接"""
    print("\n=== 測試 Vercel 網站連接 ===")
    
    try:
        # 測試主網站
        print("測試主網站...")
        response = requests.get('https://subjective-clock.vercel.app', timeout=15)
        print(f"主網站狀態: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Vercel 網站可以訪問")
            return True
        else:
            print(f"❌ Vercel 網站回應異常: {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ 連接 Vercel 超時")
        return False
    except requests.exceptions.SSLError as e:
        print(f"❌ SSL 證書錯誤: {e}")
        print("可能是系統時間不正確導致")
        return False
    except Exception as e:
        print(f"❌ 連接 Vercel 失敗: {e}")
        return False

def test_api_endpoints():
    """測試 API 端點"""
    print("\n=== 測試 API 端點 ===")
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'RaspberryPi-WakeUpMap-DSI/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    })
    
    # 測試 find-city API
    try:
        print("測試 find-city API...")
        
        # 準備測試參數
        test_params = {
            'targetLatitude': 25.0,  # 台灣附近
            'utcOffset': 8,
            'useLocalPosition': False
        }
        
        print(f"API 端點: {API_ENDPOINTS['find_city']}")
        print(f"測試參數: {test_params}")
        
        response = session.post(
            API_ENDPOINTS['find_city'],
            json=test_params,
            timeout=API_CONFIG['timeout']
        )
        
        print(f"回應狀態: {response.status_code}")
        print(f"回應標頭: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"回應資料: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            if data.get('city') or data.get('name'):
                print("✅ find-city API 正常工作")
                return True
            else:
                print("❌ API 回應格式異常")
                return False
        else:
            print(f"❌ API 回應錯誤: {response.status_code}")
            try:
                error_data = response.json()
                print(f"錯誤詳情: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
            except:
                print(f"錯誤詳情: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ API 請求超時")
        return False
    except Exception as e:
        print(f"❌ API 測試失敗: {e}")
        return False

def test_fallback_solution():
    """測試備用解決方案"""
    print("\n=== 測試備用解決方案 ===")
    
    # 本地城市資料（備用）
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
            'source': 'fallback'
        }
    ]
    
    import random
    test_city = random.choice(fallback_cities)
    print(f"備用城市資料: {test_city['city']}, {test_city['country']}")
    print("✅ 備用解決方案可用")
    
    return test_city

def fix_common_issues():
    """修復常見問題"""
    print("\n=== 嘗試修復常見問題 ===")
    
    import subprocess
    import os
    
    # 1. 更新系統時間
    try:
        print("更新系統時間...")
        result = subprocess.run(['sudo', 'ntpdate', '-s', 'time.nist.gov'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ 系統時間已更新")
        else:
            print(f"❌ 時間更新失敗: {result.stderr}")
    except Exception as e:
        print(f"時間更新失敗: {e}")
    
    # 2. 刷新 DNS
    try:
        print("刷新 DNS 快取...")
        subprocess.run(['sudo', 'systemctl', 'restart', 'systemd-resolved'], 
                      capture_output=True, timeout=10)
        print("✅ DNS 快取已刷新")
    except Exception as e:
        print(f"DNS 刷新失敗: {e}")
    
    # 3. 檢查防火牆
    try:
        print("檢查防火牆狀態...")
        result = subprocess.run(['sudo', 'ufw', 'status'], 
                              capture_output=True, text=True, timeout=10)
        if 'Status: active' in result.stdout:
            print("⚠️  防火牆已啟用，可能阻擋連接")
            print("如需要，可以暫時關閉: sudo ufw disable")
        else:
            print("✅ 防火牆未阻擋")
    except Exception as e:
        print(f"防火牆檢查失敗: {e}")

def main():
    """主函數"""
    print("WakeUpMap API 連接診斷工具")
    print("=" * 50)
    
    all_tests_passed = True
    
    # 1. 基本網路測試
    if not test_basic_network():
        all_tests_passed = False
    
    # 2. 時間同步測試
    if not test_time_sync():
        all_tests_passed = False
    
    # 3. Vercel 連接測試
    if not test_vercel_connection():
        all_tests_passed = False
    
    # 4. API 端點測試
    if not test_api_endpoints():
        all_tests_passed = False
    
    # 結果總結
    print("\n" + "=" * 50)
    if all_tests_passed:
        print("🎉 所有測試通過！API 連接正常")
    else:
        print("❌ 部分測試失敗")
        
        # 嘗試修復
        print("\n嘗試自動修復...")
        fix_common_issues()
        
        # 提供備用方案
        print("\n提供備用解決方案...")
        fallback_city = test_fallback_solution()
        
        print("\n建議解決方案：")
        print("1. 檢查網路連接")
        print("2. 重新啟動樹莓派: sudo reboot")
        print("3. 更新系統時間: sudo ntpdate -s time.nist.gov")
        print("4. 使用備用模式（程式會自動啟用）")

if __name__ == "__main__":
    main() 