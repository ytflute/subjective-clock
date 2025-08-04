import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import admin from 'firebase-admin';

// 初始化 Firebase Admin（如果尚未初始化）
if (!getApps().length) {
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY 環境變數未設定');
        }
        if (!process.env.FIREBASE_STORAGE_BUCKET) {
            throw new Error('FIREBASE_STORAGE_BUCKET 環境變數未設定');
        }
        
        const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        console.log('正在初始化 Firebase Admin...');
        
        initializeApp({
            credential: admin.credential.cert(serviceAccountKey),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
        
        console.log('Firebase Admin 初始化成功');
    } catch (initError) {
        console.error('Firebase Admin 初始化失敗:', initError);
        throw initError;
    }
} else {
    console.log('Firebase Admin 已經初始化');
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
        
        console.log('正在處理記錄:', { recordId, userIdentifier, imageUrl: recordData.imageUrl });

        // 從舊的URL中提取文件路徑
        let fileName = null;
        if (recordData.imageUrl) {
            console.log('嘗試從URL提取文件路徑:', recordData.imageUrl);
            
            // 改進的正則表達式，支持多種URL格式
            const urlPatterns = [
                /breakfast-images\/[^?&\s]+\.(?:png|jpg|jpeg|gif|webp)/i,  // 標準格式
                /breakfast-images\/[^?&\s]+/,  // 沒有副檔名的格式
                /([^\/]*breakfast-images[^?&\s]*)/i  // 更寬鬆的匹配
            ];
            
            for (const pattern of urlPatterns) {
                const urlMatch = recordData.imageUrl.match(pattern);
                if (urlMatch) {
                    fileName = urlMatch[0];
                    // 如果匹配的路徑不是以 breakfast-images 開頭，則提取正確的部分
                    if (!fileName.startsWith('breakfast-images/')) {
                        const breakfastMatch = fileName.match(/breakfast-images\/[^?&\s]*/);
                        if (breakfastMatch) {
                            fileName = breakfastMatch[0];
                        }
                    }
                    console.log('從URL提取到文件路徑:', fileName);
                    break;
                }
            }
        }
        
        // 如果無法從URL提取路徑，嘗試根據記錄信息搜尋文件
        if (!fileName) {
            console.log('無法從URL提取文件路徑，嘗試搜尋匹配的文件...');
            const city = recordData.city || 'unknown';
            const timestamp = recordData.recordedAt?.toMillis?.() || Date.now();
            
            try {
                // 列出所有 breakfast-images 文件
                const [files] = await bucket.getFiles({ prefix: 'breakfast-images/' });
                console.log(`找到 ${files.length} 個 breakfast-images 文件`);
                
                // 嘗試多種匹配策略
                const matchingStrategies = [
                    (file) => file.name.includes(timestamp.toString()),  // 時間戳匹配
                    (file) => file.name.toLowerCase().includes(city.toLowerCase()),  // 城市名匹配
                    (file) => {
                        // 嘗試匹配記錄創建時間附近的文件
                        const fileNameMatch = file.name.match(/(\d{13})/);  // 13位時間戳
                        if (fileNameMatch) {
                            const fileTimestamp = parseInt(fileNameMatch[1]);
                            const timeDiff = Math.abs(fileTimestamp - timestamp);
                            return timeDiff < 60000; // 1分鐘內
                        }
                        return false;
                    }
                ];
                
                for (const strategy of matchingStrategies) {
                    const matchingFile = files.find(strategy);
                    if (matchingFile) {
                        fileName = matchingFile.name;
                        console.log('找到匹配的文件:', fileName);
                        break;
                    }
                }
            } catch (searchError) {
                console.error('搜尋文件時發生錯誤:', searchError);
            }
        }
        
        if (!fileName) {
            console.log('無法找到對應的圖片文件');
            return res.status(404).json({ 
                error: '找不到對應的圖片文件',
                details: {
                    city: recordData.city,
                    timestamp: recordData.recordedAt?.toMillis?.(),
                    originalUrl: recordData.imageUrl
                }
            });
        }

        console.log('準備檢查文件是否存在:', fileName);

        // 檢查文件是否存在
        const file = bucket.file(fileName);
        let exists;
        try {
            [exists] = await file.exists();
            console.log(`文件 ${fileName} 存在狀態:`, exists);
        } catch (existsError) {
            console.error('檢查文件存在時發生錯誤:', existsError);
            return res.status(500).json({
                error: '檢查文件存在時發生錯誤',
                details: existsError.message
            });
        }
        
        if (!exists) {
            console.log(`文件不存在: ${fileName}`);
            return res.status(404).json({ 
                error: '圖片文件不存在於 Firebase Storage 中',
                fileName: fileName
            });
        }

        console.log('準備設置文件為公開...');

        // 使用永久的下載 URL，無期限限制
        try {
            await file.makePublic();
            console.log('文件已設置為公開');
        } catch (publicError) {
            console.error('設置文件為公開時發生錯誤:', publicError);
            // 即使設置公開失敗，我們也嘗試生成URL
            console.log('繼續嘗試生成永久URL...');
        }
        
        const bucketName = bucket.name;
        const newPermanentUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        console.log('生成的永久URL:', newPermanentUrl);

        // 更新記錄中的 URL
        try {
            await recordRef.update({
                imageUrl: newPermanentUrl,
                urlRefreshedAt: admin.firestore.FieldValue.serverTimestamp(),
                urlType: 'permanent'
            });
            console.log('記錄已更新');
        } catch (updateError) {
            console.error('更新記錄時發生錯誤:', updateError);
            return res.status(500).json({
                error: '更新記錄時發生錯誤',
                details: updateError.message
            });
        }

        res.status(200).json({
            success: true,
            newImageUrl: newPermanentUrl,
            fileName: fileName,
            bucketName: bucketName
        });

    } catch (error) {
        console.error('刷新圖片URL時發生錯誤:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}