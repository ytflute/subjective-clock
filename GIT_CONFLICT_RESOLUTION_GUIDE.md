# 🔧 Git 衝突處理完整指南

## 📋 目錄
1. [常見衝突類型](#常見衝突類型)
2. [快速解決方案](#快速解決方案)
3. [詳細步驟說明](#詳細步驟說明)
4. [預防措施](#預防措施)
5. [緊急情況處理](#緊急情況處理)

---

## 🚨 常見衝突類型

### **類型1: 本地修改衝突**
```bash
錯誤: 您對下列檔案的本機修改將被合併動作覆蓋：
  raspberrypi-dsi/config.py
```

### **類型2: 合併衝突**
```bash
CONFLICT (content): Merge conflict in raspberrypi-dsi/config.py
Automatic merge failed; fix conflicts and then commit the result.
```

### **類型3: 未追蹤檔案衝突**
```bash
錯誤: 工作目錄中未被追蹤的檔案 'example.txt' 將被合併動作覆蓋。
```

---

## ⚡ 快速解決方案

### **🔥 緊急快速處理（推薦）**

```bash
# 1. 備份你的重要修改
cp raspberrypi-dsi/config.py raspberrypi-dsi/config.py.backup

# 2. 暫存所有本地修改
git stash --include-untracked

# 3. 拉取最新代碼
git pull origin main

# 4. 恢復你的修改（如果需要）
cp raspberrypi-dsi/config.py.backup raspberrypi-dsi/config.py

# 5. 檢查差異（可選）
git diff raspberrypi-dsi/config.py
```

### **📁 保守安全處理**

```bash
# 1. 建立備份分支
git branch backup-$(date +%Y%m%d-%H%M%S)

# 2. 重置到遠端狀態
git reset --hard origin/main

# 3. 手動恢復需要的配置
# （從備份文件中複製回來）
```

---

## 📖 詳細步驟說明

### **步驟 1: 分析衝突狀況**

```bash
# 查看當前狀態
git status

# 查看修改內容
git diff raspberrypi-dsi/config.py

# 查看遠端最新提交
git log origin/main --oneline -3
```

### **步驟 2: 選擇處理策略**

#### **策略A: 保留本地修改（推薦用於config.py）**

```bash
# 1. 暫存修改並附註釋
git stash push -m "config.py本地設定-$(date +%Y%m%d)" raspberrypi-dsi/config.py

# 2. 拉取遠端更新
git pull origin main

# 3. 恢復本地修改
git stash pop

# 4. 如果有衝突，手動合併
git add raspberrypi-dsi/config.py
git commit -m "合併config.py本地設定"
```

#### **策略B: 使用遠端版本**

```bash
# 1. 備份本地修改
cp raspberrypi-dsi/config.py ~/config.py.backup

# 2. 重置到遠端版本
git checkout -- raspberrypi-dsi/config.py

# 3. 拉取更新
git pull origin main

# 4. 手動恢復需要的設定
nano raspberrypi-dsi/config.py
```

#### **策略C: 手動合併**

```bash
# 1. 強制拉取（允許衝突）
git pull origin main --no-ff

# 2. 手動編輯衝突文件
nano raspberrypi-dsi/config.py

# 3. 尋找衝突標記並解決
<<<<<<< HEAD
# 你的本地修改
=======
# 遠端的修改
>>>>>>> origin/main

# 4. 標記為已解決
git add raspberrypi-dsi/config.py
git commit -m "解決config.py合併衝突"
```

### **步驟 3: 驗證結果**

```bash
# 檢查是否成功
git status

# 確認最新代碼
git log --oneline -3

# 測試配置是否正常
python3 -c "from raspberrypi-dsi.config import *; print('配置載入成功')"
```

---

## 🛡️ 預防措施

### **1. 定期同步**
```bash
# 每天工作前
git fetch origin
git status
```

### **2. 配置文件管理**
```bash
# 對於config.py這類個人配置文件，考慮：

# 方法1: 創建本地配置模板
cp raspberrypi-dsi/config.py raspberrypi-dsi/config.local.py
# 編輯 config.local.py，在 .gitignore 中忽略它

# 方法2: 使用環境變數
export OPENAI_API_KEY="your-key-here"
export TTS_ENGINE="openai"
```

### **3. 建立個人配置文件**
```python
# raspberrypi-dsi/config.local.py（不會被追蹤）
from config import *

# 覆蓋個人設定
TTS_CONFIG['engine'] = 'openai'
TTS_CONFIG['openai_api_key'] = 'your-key-here'
AUDIO_CONFIG['volume'] = 95
```

### **4. 使用Git Hooks**
```bash
# 建立預提交檢查
echo '#!/bin/bash
if git diff --cached --name-only | grep -q "config.py"; then
    echo "警告：正在提交config.py，請確認是否包含敏感資訊"
    read -p "繼續？(y/N): " confirm
    [[ $confirm == [yY] ]] || exit 1
fi' > .git/hooks/pre-commit

chmod +x .git/hooks/pre-commit
```

---

## 🚨 緊急情況處理

### **情況1: 完全搞砸了**
```bash
# 核彈選項：完全重置
git stash --include-untracked  # 先備份
git reset --hard origin/main   # 重置到遠端狀態
git clean -fdx                 # 清除所有未追蹤文件

# 重新應用關鍵配置
# （手動從備份恢復重要設定）
```

### **情況2: 想要回到特定版本**
```bash
# 查看歷史
git log --oneline

# 回到特定提交
git reset --hard [commit-hash]

# 重新拉取
git pull origin main
```

### **情況3: 多個文件衝突**
```bash
# 暫存所有修改
git stash --include-untracked

# 拉取更新
git pull origin main

# 檢查暫存的修改
git stash show -p

# 選擇性恢復
git checkout stash@{0} -- raspberrypi-dsi/config.py
```

---

## 📋 常用命令速查表

| 操作 | 命令 | 說明 |
|------|------|------|
| 備份修改 | `git stash` | 暫存當前修改 |
| 查看暫存 | `git stash list` | 列出所有暫存 |
| 恢復暫存 | `git stash pop` | 恢復最新暫存 |
| 放棄修改 | `git checkout -- file` | 恢復到上次提交 |
| 重置分支 | `git reset --hard origin/main` | 完全重置到遠端 |
| 查看差異 | `git diff file` | 查看文件修改 |
| 強制拉取 | `git pull origin main --force` | 強制覆蓋本地 |

---

## 🎯 針對你的具體情況

### **處理 config.py 衝突的標準流程：**

```bash
# 1. 立即執行（解決當前衝突）
cd ~/pi/subjective-clock
cp raspberrypi-dsi/config.py ~/config.py.backup.$(date +%Y%m%d-%H%M%S)
git stash push -m "config.py個人設定備份" raspberrypi-dsi/config.py
git pull origin main

# 2. 檢查是否需要恢復設定
diff ~/config.py.backup.* raspberrypi-dsi/config.py

# 3. 如果需要，手動恢復關鍵設定
nano raspberrypi-dsi/config.py
# 恢復你的 OpenAI API key、音量設定等

# 4. 測試配置
python3 -c "from raspberrypi-dsi.config import *; print('✅ 配置正常')"
```

### **未來避免此問題：**

```bash
# 建立個人配置文件（一次性設置）
cp raspberrypi-dsi/config.py raspberrypi-dsi/my_config.py
echo "raspberrypi-dsi/my_config.py" >> .gitignore

# 在個人配置中覆蓋設定
echo "
# 個人設定覆蓋
TTS_CONFIG['engine'] = 'openai'
TTS_CONFIG['openai_api_key'] = 'your-key-here'
AUDIO_CONFIG['volume'] = 95
" >> raspberrypi-dsi/my_config.py
```

---

## ✅ 檢查清單

執行完成後，請確認：

- [ ] `git status` 顯示 "working tree clean"
- [ ] `git log --oneline -3` 顯示最新提交
- [ ] 應用程式可以正常啟動
- [ ] 個人配置（API key、音量等）仍然有效
- [ ] 備份文件已安全保存

---

**🎯 記住：遇到Git衝突不要慌張，先備份，再處理！**