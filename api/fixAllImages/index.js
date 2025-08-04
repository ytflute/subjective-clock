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
        console.log('=== 開始批量修復圖片 ===');
        console.log('請求體:', req.body);
        
        const { userIdentifier } = req.body;

        if (!userIdentifier) {
            console.log('錯誤：缺少userIdentifier參數');
            return res.status(400).json({ 
                error: '缺少必要參數：userIdentifier' 
            });
        }

        console.log('用戶識別碼:', userIdentifier);

        // 檢查Firebase服務是否正常初始化
        let db, bucket;
        try {
            db = getFirestore();
            bucket = getStorage().bucket();
            console.log('Firebase服務初始化成功');
        } catch (initError) {
            console.error('Firebase初始化失敗:', initError);
            return res.status(500).json({
                error: 'Firebase服務初始化失敗',
                details: initError.message
            });
        }

        const appId = 'default-app-id-worldclock-history';
        
        // 獲取用戶的所有記錄
        console.log('準備查詢用戶記錄...');
        const userCollectionRef = db.collection(`artifacts/${appId}/userProfiles/${userIdentifier}/clockHistory`);
        
        let querySnapshot;
        try {
            querySnapshot = await userCollectionRef.get();
            console.log(`查詢完成，找到 ${querySnapshot.size} 筆記錄`);
        } catch (queryError) {
            console.error('查詢用戶記錄失敗:', queryError);
            return res.status(500).json({
                error: '查詢用戶記錄失敗',
                details: queryError.message
            });
        }
        
        if (querySnapshot.empty) {
            console.log('用戶沒有任何記錄');
            return res.status(404).json({ 
                error: '找不到用戶記錄',
                userIdentifier: userIdentifier
            });
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
                console.log(`處理記錄 ${doc.id}:`, {
                    city: recordData.city,
                    imageUrl: recordData.imageUrl,
                    timestamp: recordData.recordedAt?.toMillis?.()
                });

                // 從舊URL中提取文件路徑
                let fileName = null;
                
                if (recordData.imageUrl) {
                    console.log(`嘗試從URL提取文件路徑: ${recordData.imageUrl}`);
                    
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
                            console.log(`從URL提取到文件路徑: ${fileName}`);
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
                                console.log(`找到匹配的文件: ${fileName}`);
                                break;
                            }
                        }
                    } catch (searchError) {
                        console.error('搜尋文件時發生錯誤:', searchError);
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
                try {
                    await file.makePublic();
                    console.log(`文件已設置為公開: ${fileName}`);
                } catch (publicError) {
                    console.error(`設置文件為公開時發生錯誤: ${fileName}`, publicError);
                    // 繼續執行，即使設置公開失敗
                }
                
                const permanentUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                console.log(`生成永久URL: ${permanentUrl}`);

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

        console.log('=== 批量修復完成 ===');
        console.log(`總記錄數: ${querySnapshot.size}`);
        console.log(`成功修復: ${fixedCount}`);
        console.log(`錯誤數量: ${errorCount}`);
        
        const response = {
            success: true,
            summary: {
                totalRecords: querySnapshot.size,
                fixedCount: fixedCount,
                errorCount: errorCount,
                alreadyPermanentCount: results.filter(r => r.status === 'already_permanent').length
            },
            details: results
        };
        
        console.log('返回響應:', response.summary);
        res.status(200).json(response);

    } catch (error) {
        console.error('=== 批量修復圖片URL時發生嚴重錯誤 ===');
        console.error('錯誤類型:', error.name);
        console.error('錯誤消息:', error.message);
        console.error('錯誤堆疊:', error.stack);
        
        // 檢查是否是特定的Firebase錯誤
        if (error.code) {
            console.error('Firebase錯誤代碼:', error.code);
        }
        
        res.status(500).json({ 
            error: error.message,
            errorName: error.name,
            errorCode: error.code || 'UNKNOWN',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
}