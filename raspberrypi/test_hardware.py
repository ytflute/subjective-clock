#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
硬體測試腳本
用於測試LCD顯示器和按鈕是否正常工作
"""

import RPi.GPIO as GPIO
import time
import sys
from config import LCD_PINS, BUTTON_PIN

class HardwareTest:
    """硬體測試類別"""
    
    def __init__(self):
        self.button_pressed = False
        
    def test_lcd(self):
        """測試LCD顯示器"""
        print("正在測試LCD顯示器...")
        
        try:
            from lcd_driver import LCD_ST7920
            
            lcd = LCD_ST7920()
            
            # 測試文字顯示
            test_messages = [
                ["LCD Test", "Line 1", "Line 2", "Line 3"],
                ["Hello World!", "Testing 123", "GPIO Pins OK", "Display Works"],
                ["Chinese Test", "中文測試", "Encoding?", "ASCII Only"],
            ]
            
            for i, message in enumerate(test_messages):
                print(f"顯示測試訊息 {i+1}/{len(test_messages)}")
                lcd.display_message(message)
                time.sleep(3)
            
            # 清除顯示
            lcd.clear()
            lcd.display_message(["LCD Test", "Completed!", "", "Press Ctrl+C"])
            
            print("LCD測試完成！")
            return True
            
        except Exception as e:
            print(f"LCD測試失敗: {e}")
            return False
    
    def button_callback(self, channel):
        """按鈕按下回呼函數"""
        print("按鈕被按下！")
        self.button_pressed = True
    
    def test_button(self):
        """測試按鈕"""
        print("正在測試按鈕...")
        print(f"請按下連接到GPIO {BUTTON_PIN}的按鈕...")
        
        try:
            # 設定按鈕GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            GPIO.add_event_detect(
                BUTTON_PIN, 
                GPIO.FALLING, 
                callback=self.button_callback,
                bouncetime=300
            )
            
            # 等待按鈕按下
            timeout = 10  # 10秒超時
            start_time = time.time()
            
            while not self.button_pressed and (time.time() - start_time) < timeout:
                time.sleep(0.1)
            
            if self.button_pressed:
                print("按鈕測試成功！")
                return True
            else:
                print("按鈕測試超時，請檢查連接")
                return False
                
        except Exception as e:
            print(f"按鈕測試失敗: {e}")
            return False
    
    def test_audio(self):
        """測試音頻系統"""
        print("正在測試音頻系統...")
        
        try:
            from audio_manager import AudioManager
            
            audio = AudioManager()
            
            # 測試文字轉語音
            print("正在測試文字轉語音...")
            audio_file = audio.text_to_speech("測試音頻系統", "zh-tw")
            
            if audio_file:
                print("語音生成成功，正在播放...")
                success = audio.play_audio_file(audio_file)
                if success:
                    print("音頻測試成功！")
                    return True
                else:
                    print("音頻播放失敗")
                    return False
            else:
                print("語音生成失敗")
                return False
                
        except Exception as e:
            print(f"音頻測試失敗: {e}")
            return False
    
    def test_api(self):
        """測試API連接"""
        print("正在測試API連接...")
        
        try:
            from api_client import APIClient
            
            api = APIClient()
            
            # 測試城市匹配
            print("正在測試城市匹配API...")
            city_info = api.find_matching_city()
            
            if city_info:
                print(f"API測試成功！找到城市: {city_info.get('city')}, {city_info.get('country')}")
                return True
            else:
                print("API測試失敗，無法找到匹配城市")
                return False
                
        except Exception as e:
            print(f"API測試失敗: {e}")
            return False
    
    def run_all_tests(self):
        """執行所有測試"""
        print("=== 甦醒地圖裝置硬體測試 ===")
        print()
        
        tests = [
            ("LCD顯示器", self.test_lcd),
            ("按鈕", self.test_button),
            ("音頻系統", self.test_audio),
            ("API連接", self.test_api),
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            print(f"\n--- {test_name}測試 ---")
            try:
                results[test_name] = test_func()
            except KeyboardInterrupt:
                print(f"\n{test_name}測試被中斷")
                results[test_name] = False
                break
            except Exception as e:
                print(f"{test_name}測試異常: {e}")
                results[test_name] = False
        
        # 顯示測試結果
        print("\n=== 測試結果 ===")
        for test_name, result in results.items():
            status = "✓ 通過" if result else "✗ 失敗"
            print(f"{test_name}: {status}")
        
        all_passed = all(results.values())
        print(f"\n整體測試: {'✓ 全部通過' if all_passed else '✗ 部分失敗'}")
        
        return all_passed
    
    def cleanup(self):
        """清理資源"""
        try:
            GPIO.cleanup()
        except:
            pass

def main():
    """主函數"""
    test = HardwareTest()
    
    try:
        # 檢查參數
        if len(sys.argv) > 1:
            test_type = sys.argv[1].lower()
            
            if test_type == "lcd":
                test.test_lcd()
            elif test_type == "button":
                test.test_button()
            elif test_type == "audio":
                test.test_audio()
            elif test_type == "api":
                test.test_api()
            else:
                print("未知的測試類型")
                print("可用選項: lcd, button, audio, api")
                sys.exit(1)
        else:
            # 執行所有測試
            test.run_all_tests()
            
    except KeyboardInterrupt:
        print("\n測試被中斷")
    finally:
        test.cleanup()

if __name__ == "__main__":
    main() 