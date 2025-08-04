import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import admin from 'firebase-admin';

// 初始化 Firebase Admin（如果尚未初始化）
if (!getApps().length) {
    const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

export default async function handler(req, res) {
    // 設置 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允許 POST 請求' });
    }

    try {
        const { recordId, userIdentifier } = req.body;

        if (!recordId || !userIdentifier) {
            return res.status(400).json({ 
                error: '缺少必要參數：recordId 和 userIdentifier' 
            });
        }

        const db = getFirestore();
        const bucket = getStorage().bucket();
        
        // 獲取記錄
        const appId = 'default-app-id-worldclock-history';
        const recordRef = db.doc(`artifacts/${appId}/userProfiles/${userIdentifier}/clockHistory/${recordId}`);
        const recordDoc = await recordRef.get();
        
        if (!recordDoc.exists) {
            return res.status(404).json({ error: '找不到指定的記錄' });
        }

        const recordData = recordDoc.data();
        
        // 從舊的URL中提取文件路徑
        let fileName = null;
        if (recordData.imageUrl) {
            // 嘗試從URL中提取文件路徑
            const urlMatch = recordData.imageUrl.match(/breakfast-images\/[^?]+/);
            if (urlMatch) {
                fileName = urlMatch[0];
            }
        }
        
        // 如果無法從URL提取路徑，嘗試根據記錄信息構建可能的文件名
        if (!fileName) {
            const city = recordData.city || 'unknown';
            const timestamp = recordData.recordedAt?.toMillis?.() || Date.now();
            
            // 列出可能的文件名模式
            const possiblePatterns = [
                `breakfast-images/*${city}*`,
                `breakfast-images/${timestamp}*`,
                `breakfast-images/*${city.toLowerCase()}*`
            ];
            
            // 嘗試找到匹配的文件
            for (const pattern of possiblePatterns) {
                const [files] = await bucket.getFiles({ prefix: 'breakfast-images/' });
                const matchingFile = files.find(file => {
                    const fileName = file.name;
                    return fileName.includes(city) || fileName.includes(city.toLowerCase());
                });
                
                if (matchingFile) {
                    fileName = matchingFile.name;
                    break;
                }
            }
        }
        
        if (!fileName) {
            return res.status(404).json({ 
                error: '找不到對應的圖片文件' 
            });
        }

        // 檢查文件是否存在
        const file = bucket.file(fileName);
        const [exists] = await file.exists();
        
        if (!exists) {
            return res.status(404).json({ 
                error: '圖片文件不存在於 Firebase Storage 中' 
            });
        }

        // 使用永久的下載 URL，無期限限制
        await file.makePublic();
        const newPermanentUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // 更新記錄中的 URL
        await recordRef.update({
            imageUrl: newPermanentUrl,
            urlRefreshedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({
            success: true,
            newImageUrl: newPermanentUrl,
            fileName: fileName
        });

    } catch (error) {
        console.error('刷新圖片URL時發生錯誤:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}