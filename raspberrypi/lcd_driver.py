#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import RPi.GPIO as GPIO
import time
from config import LCD_PINS

class LCD_ST7920:
    """LCD ST7920 128x64 圖形液晶顯示器驅動程式"""
    
    def __init__(self):
        self.setup_gpio()
        self.init_lcd()
        
    def setup_gpio(self):
        """設定GPIO"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        # 設定所有LCD控制腳位為輸出
        for pin in LCD_PINS.values():
            GPIO.setup(pin, GPIO.OUT)
            
        # 初始狀態
        GPIO.output(LCD_PINS['PSB'], GPIO.HIGH)  # 選擇並行模式
        GPIO.output(LCD_PINS['RST'], GPIO.HIGH)  # 正常工作狀態
        GPIO.output(LCD_PINS['E'], GPIO.LOW)
        GPIO.output(LCD_PINS['RS'], GPIO.LOW)
        
    def init_lcd(self):
        """初始化LCD"""
        time.sleep(0.1)  # 等待穩定
        
        # 重置LCD
        GPIO.output(LCD_PINS['RST'], GPIO.LOW)
        time.sleep(0.01)
        GPIO.output(LCD_PINS['RST'], GPIO.HIGH)
        time.sleep(0.1)
        
        # 功能設定: 8位元介面
        self.write_command(0x30)
        time.sleep(0.01)
        
        # 顯示控制: 開啟顯示
        self.write_command(0x0C)
        time.sleep(0.01)
        
        # 清除顯示
        self.clear()
        
        # 輸入模式設定
        self.write_command(0x06)
        time.sleep(0.01)
        
    def write_command(self, cmd):
        """寫入指令"""
        GPIO.output(LCD_PINS['RS'], GPIO.LOW)  # 指令模式
        self.write_8_bits(cmd)
        
    def write_data(self, data):
        """寫入資料"""
        GPIO.output(LCD_PINS['RS'], GPIO.HIGH)  # 資料模式
        self.write_8_bits(data)
        
    def write_8_bits(self, value):
        """寫入8位元資料"""
        # 設定高4位元
        GPIO.output(LCD_PINS['D7'], (value >> 7) & 0x01)
        GPIO.output(LCD_PINS['D6'], (value >> 6) & 0x01)
        GPIO.output(LCD_PINS['D5'], (value >> 5) & 0x01)
        GPIO.output(LCD_PINS['D4'], (value >> 4) & 0x01)
        
        # 啟用脈衝
        GPIO.output(LCD_PINS['E'], GPIO.HIGH)
        time.sleep(0.0001)
        GPIO.output(LCD_PINS['E'], GPIO.LOW)
        time.sleep(0.0001)
        
    def clear(self):
        """清除顯示"""
        self.write_command(0x01)
        time.sleep(0.002)
        
    def set_cursor(self, row, col):
        """設定游標位置"""
        if row == 0:
            self.write_command(0x80 + col)
        elif row == 1:
            self.write_command(0x90 + col)
        elif row == 2:
            self.write_command(0x88 + col)
        elif row == 3:
            self.write_command(0x98 + col)
            
    def display_text(self, text, row=0, col=0):
        """顯示文字"""
        self.set_cursor(row, col)
        
        # 直接顯示ASCII字符
        for char in text:
            if ord(char) < 128:  # ASCII字符
                self.write_data(ord(char))
            else:
                self.write_data(ord('?'))  # 非ASCII字符顯示為?
                
    def display_message(self, lines):
        """顯示多行訊息"""
        self.clear()
        
        for i, line in enumerate(lines[:4]):  # 最多4行
            if line:
                self.display_text(line, row=i, col=0)
                
    def cleanup(self):
        """清理GPIO資源"""
        self.clear()
        GPIO.cleanup() 