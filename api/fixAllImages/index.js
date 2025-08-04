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
        const { userIdentifier } = req.body;

        if (!userIdentifier) {
            return res.status(400).json({ 
                error: '缺少必要參數：userIdentifier' 
            });
        }

        const db = getFirestore();
        const bucket = getStorage().bucket();
        const appId = 'default-app-id-worldclock-history';
        
        // 獲取用戶的所有記錄
        const userCollectionRef = db.collection(`artifacts/${appId}/userProfiles/${userIdentifier}/clockHistory`);
        const querySnapshot = await userCollectionRef.get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: '找不到用戶記錄' });
        }

        let fixedCount = 0;
        let errorCount = 0;
        const results = [];

        // 遍歷所有記錄
        for (const doc of querySnapshot.docs) {
            const recordData = doc.data();
            
            // 只處理有 imageUrl 但可能過期的記錄
            if (!recordData.imageUrl) continue;
            
            // 檢查是否已經是永久URL格式
            if (recordData.imageUrl.includes('storage.googleapis.com') && 
                !recordData.imageUrl.includes('Expires=')) {
                results.push({
                    recordId: doc.id,
                    status: 'already_permanent',
                    message: '已經是永久URL'
                });
                continue;
            }

            try {
                // 從舊URL中提取文件路徑
                let fileName = null;
                
                // 嘗試從URL中提取文件路徑
                const urlMatch = recordData.imageUrl.match(/breakfast-images\/[^?&]+/);
                if (urlMatch) {
                    fileName = urlMatch[0];
                } else {
                    // 如果無法提取，根據記錄信息構建可能的文件名
                    const city = recordData.city || 'unknown';
                    const timestamp = recordData.recordedAt?.toMillis?.() || Date.now();
                    
                    // 嘗試找到匹配的文件
                    const [files] = await bucket.getFiles({ prefix: 'breakfast-images/' });
                    const matchingFile = files.find(file => {
                        const fn = file.name;
                        return fn.includes(city) || fn.includes(city.toLowerCase()) ||
                               fn.includes(timestamp.toString());
                    });
                    
                    if (matchingFile) {
                        fileName = matchingFile.name;
                    }
                }
                
                if (!fileName) {
                    errorCount++;
                    results.push({
                        recordId: doc.id,
                        status: 'error',
                        message: '找不到對應的圖片文件'
                    });
                    continue;
                }

                // 檢查文件是否存在
                const file = bucket.file(fileName);
                const [exists] = await file.exists();
                
                if (!exists) {
                    errorCount++;
                    results.push({
                        recordId: doc.id,
                        status: 'error',
                        message: '圖片文件不存在'
                    });
                    continue;
                }

                // 設置為公開並獲取永久URL
                await file.makePublic();
                const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

                // 更新記錄
                await doc.ref.update({
                    imageUrl: permanentUrl,
                    urlFixedAt: admin.firestore.FieldValue.serverTimestamp(),
                    urlType: 'permanent'
                });

                fixedCount++;
                results.push({
                    recordId: doc.id,
                    status: 'fixed',
                    message: '已修復為永久URL',
                    newUrl: permanentUrl
                });

            } catch (error) {
                errorCount++;
                results.push({
                    recordId: doc.id,
                    status: 'error',
                    message: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            summary: {
                totalRecords: querySnapshot.size,
                fixedCount: fixedCount,
                errorCount: errorCount,
                alreadyPermanentCount: results.filter(r => r.status === 'already_permanent').length
            },
            details: results
        });

    } catch (error) {
        console.error('批量修復圖片URL時發生錯誤:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}