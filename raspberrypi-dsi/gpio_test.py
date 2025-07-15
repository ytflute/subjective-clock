#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GPIO 18 按鈕測試和修復工具
"""

import RPi.GPIO as GPIO
import time
import sys
import os

def test_gpio_basic():
    """基本 GPIO 測試"""
    print("=== 基本 GPIO 測試 ===")
    try:
        print("1. 設定 GPIO 模式...")
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        print("✅ GPIO 模式設定成功")
        
        print("2. 設定 GPIO 18 為輸入...")
        GPIO.setup(18, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        print("✅ GPIO 18 設定成功")
        
        print("3. 讀取 GPIO 18 狀態...")
        for i in range(5):
            state = GPIO.input(18)
            print(f"   GPIO 18 狀態: {state} ({'按下' if state == 0 else '未按下'})")
            time.sleep(0.5)
        
        return True
        
    except Exception as e:
        print(f"❌ 基本測試失敗: {e}")
        return False
    finally:
        GPIO.cleanup()

def test_edge_detection():
    """邊緣檢測測試"""
    print("\n=== 邊緣檢測測試 ===")
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(18, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # 測試回調函數
        edge_count = 0
        def edge_callback(channel):
            global edge_count
            edge_count += 1
            state = GPIO.input(channel)
            print(f"邊緣檢測觸發 #{edge_count}: GPIO {channel} = {state}")
        
        print("1. 測試 FALLING 邊緣檢測...")
        GPIO.add_event_detect(18, GPIO.FALLING, callback=edge_callback, bouncetime=300)
        print("✅ FALLING 邊緣檢測設定成功")
        time.sleep(2)
        GPIO.remove_event_detect(18)
        
        print("2. 測試 RISING 邊緣檢測...")
        GPIO.add_event_detect(18, GPIO.RISING, callback=edge_callback, bouncetime=300)
        print("✅ RISING 邊緣檢測設定成功")
        time.sleep(2)
        GPIO.remove_event_detect(18)
        
        print("3. 測試 BOTH 邊緣檢測...")
        GPIO.add_event_detect(18, GPIO.BOTH, callback=edge_callback, bouncetime=300)
        print("✅ BOTH 邊緣檢測設定成功")
        
        print("測試10秒鐘，請按幾次按鈕...")
        time.sleep(10)
        
        GPIO.remove_event_detect(18)
        print(f"測試完成，總共檢測到 {edge_count} 次邊緣變化")
        
        return True
        
    except Exception as e:
        print(f"❌ 邊緣檢測測試失敗: {e}")
        return False
    finally:
        GPIO.cleanup()

def cleanup_gpio():
    """清理 GPIO 狀態"""
    print("\n=== 清理 GPIO 狀態 ===")
    try:
        # 清理所有可能的 GPIO 設定
        for pin in range(28):
            try:
                with open(f'/sys/class/gpio/gpio{pin}/direction', 'w') as f:
                    f.write('in')
            except:
                pass
            
            try:
                with open('/sys/class/gpio/unexport', 'w') as f:
                    f.write(str(pin))
            except:
                pass
        
        print("✅ GPIO 狀態清理完成")
        return True
        
    except Exception as e:
        print(f"❌ GPIO 清理失敗: {e}")
        return False

def check_gpio_permissions():
    """檢查 GPIO 權限"""
    print("\n=== 檢查 GPIO 權限 ===")
    
    import grp
    import pwd
    
    # 檢查用戶群組
    username = os.getenv('USER', 'unknown')
    print(f"當前用戶: {username}")
    
    try:
        user = pwd.getpwnam(username)
        groups = [grp.getgrgid(g).gr_name for g in os.getgroups()]
        print(f"用戶群組: {', '.join(groups)}")
        
        if 'gpio' in groups:
            print("✅ 用戶在 gpio 群組中")
        else:
            print("❌ 用戶不在 gpio 群組中")
            print("解決方法: sudo usermod -a -G gpio $USER")
            
    except Exception as e:
        print(f"權限檢查失敗: {e}")
    
    # 檢查設備權限
    gpio_devices = ['/dev/gpiomem', '/dev/gpiochip0']
    for device in gpio_devices:
        if os.path.exists(device):
            stat = os.stat(device)
            print(f"{device}: 權限 {oct(stat.st_mode)[-3:]}")
        else:
            print(f"{device}: 不存在")

def fix_gpio_issues():
    """嘗試修復 GPIO 問題"""
    print("\n=== 嘗試修復 GPIO 問題 ===")
    
    # 1. 清理 GPIO
    cleanup_gpio()
    
    # 2. 重新載入 GPIO 驅動
    print("重新載入 GPIO 驅動...")
    os.system("sudo modprobe -r gpio_bcm2835 2>/dev/null")
    time.sleep(1)
    os.system("sudo modprobe gpio_bcm2835")
    
    # 3. 設定權限
    print("設定 GPIO 設備權限...")
    os.system("sudo chmod 666 /dev/gpiomem 2>/dev/null")
    os.system("sudo chmod 666 /dev/gpiochip* 2>/dev/null")
    
    print("✅ 修復嘗試完成")

def main():
    """主函數"""
    print("GPIO 18 按鈕診斷和修復工具")
    print("="*50)
    
    # 檢查權限
    check_gpio_permissions()
    
    # 基本測試
    if not test_gpio_basic():
        print("\n❌ 基本 GPIO 測試失敗，嘗試修復...")
        fix_gpio_issues()
        
        print("\n重新測試...")
        if not test_gpio_basic():
            print("❌ 修復後仍然失敗，可能需要重新啟動系統")
            return False
    
    # 邊緣檢測測試
    if not test_edge_detection():
        print("\n❌ 邊緣檢測測試失敗")
        return False
    
    print("\n🎉 所有測試通過！GPIO 18 按鈕應該可以正常工作了")
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n測試被中斷")
    finally:
        GPIO.cleanup() 