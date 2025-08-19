import admin from 'firebase-admin';

// 初始化 Firebase Admin SDK（如果尚未初始化）
if (!admin.apps.length) {
    // 從環境變數獲取服務帳戶金鑰
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
    });
}

const db = admin.firestore();

// 複製前端的名稱轉換邏輯
function generateSafeId(originalName) {
    let hash = 0;
    for (let i = 0; i < originalName.length; i++) {
        const char = originalName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    hash = Math.abs(hash);
    
    const safeChars = originalName.replace(/[^a-zA-Z0-9]/g, '');
    const prefix = safeChars.length > 0 ? safeChars : 'user';
    return `${prefix}_${hash}`;
}

function sanitizeNameToFirestoreId(name) {
    if (!name || typeof name !== 'string') return null;
    if (!name.trim()) return null;
    
    // 如果名稱中包含中文字符，使用雜湊函數生成固定的識別碼
    if (/[\u4e00-\u9fa5]/.test(name)) {
        return generateSafeId(name);
    }
    
    // 對於非中文名稱，保持原有的處理邏輯
    let sanitized = name.toLowerCase().trim();
    sanitized = sanitized.replace(/\s+/g, '_');
    sanitized = sanitized.replace(/[^a-z0-9_.-]/g, '');
    
    if (sanitized === "." || sanitized === "..") {
        sanitized = `name_${sanitized.replace(/\./g, '')}`;
    }
    if (sanitized.startsWith("__") && sanitized.endsWith("__") && sanitized.length > 4) {
        sanitized = `name${sanitized.substring(2, sanitized.length - 2)}`;
    } else if (sanitized.startsWith("__")) {
        sanitized = `name${sanitized.substring(2)}`;
    } else if (sanitized.endsWith("__")) {
        sanitized = `name${sanitized.substring(0, sanitized.length - 2)}`;
    }
    
    return sanitized.substring(0, 100) || generateSafeId(name);
}

export default async function handler(req, res) {
    // 設定 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 🔍 詳細 Firebase Admin SDK 診斷
    console.log('🔧 Firebase Admin SDK 詳細診斷:');
    console.log('  - Firebase Admin 應用程式數量:', admin.apps.length);
    console.log('  - 專案ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('  - 客戶端電子郵件存在:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.log('  - 私鑰存在:', !!process.env.FIREBASE_PRIVATE_KEY);
    console.log('  - 客戶端電子郵件值:', process.env.FIREBASE_CLIENT_EMAIL);
    console.log('  - 私鑰前50字符:', process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50));

    // 測試 Firestore 連接
    try {
        console.log('🔗 測試 Firestore 連接...');
        const testCollection = await db.collection('test-connection').limit(1).get();
        console.log('✅ Firestore 連接成功，測試查詢完成');
    } catch (firestoreError) {
        console.error('❌ Firestore 連接失敗:', firestoreError.message);
        console.error('❌ Firestore 錯誤詳情:', firestoreError);
        return res.status(500).json({
            success: false,
            error: `Firestore 連接失敗: ${firestoreError.message}`
        });
    }

    let allUserData = [];

    if (req.method === 'GET') {
        try {
            // GET 請求：返回所有使用者資料
            console.log('🔍 管理員請求：載入所有使用者資料');
            console.log('📊 Firebase Admin SDK 狀態:', {
                appsLength: admin.apps.length,
                projectId: process.env.FIREBASE_PROJECT_ID,
                hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
                hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
            });

            // 🎯 查詢正確的 Firebase 資料結構
            const knownAppId = 'default-app-id-worldclock-history';
            console.log(`🎯 查詢應用程式: ${knownAppId}`);
            
            try {
                // 查詢該應用程式下的所有使用者檔案
                console.log(`🔍 查詢路徑: artifacts/${knownAppId}/userProfiles`);
                const userProfilesSnapshot = await db.collection(`artifacts/${knownAppId}/userProfiles`).get();
                console.log(`👥 找到 ${userProfilesSnapshot.size} 個使用者檔案`);

                for (const userDoc of userProfilesSnapshot.docs) {
                    const dataIdentifier = userDoc.id; // 這是 Firebase 路徑中的 ID (如: yu, user_1268480)
                    console.log(`🔍 處理使用者檔案: ${dataIdentifier}`);

                    // 查詢該使用者的所有甦醒記錄
                    const clockHistoryPath = `artifacts/${knownAppId}/userProfiles/${dataIdentifier}/clockHistory`;
                    console.log(`📄 查詢記錄路徑: ${clockHistoryPath}`);
                    
                    const clockHistorySnapshot = await db.collection(clockHistoryPath)
                        .orderBy('recordedAt', 'desc')
                        .get();
                    console.log(`📝 找到 ${clockHistorySnapshot.size} 筆甦醒記錄`);

                    clockHistorySnapshot.forEach(recordDoc => {
                        const recordData = recordDoc.data();
                        const recordedAt = recordData.recordedAt ? recordData.recordedAt.toDate() : null;
                        
                        // 使用 userDisplayName 作為顯示的使用者名稱，dataIdentifier 作為內部識別
                        const displayName = recordData.userDisplayName || dataIdentifier;
                        
                        console.log(`📋 記錄詳情: userDisplayName="${displayName}", dataIdentifier="${dataIdentifier}"`);
                        
                        allUserData.push({
                            userId: displayName, // 前端顯示使用 userDisplayName
                            dataIdentifier: dataIdentifier, // 內部識別使用 dataIdentifier
                            appId: knownAppId,
                            recordId: recordDoc.id,
                            date: recordedAt ? recordedAt.toLocaleDateString('zh-TW') : '未知',
                            time: recordedAt ? recordedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '未知',
                            city: recordData.city || '未知',
                            country: recordData.country || '未知',
                            cityZh: recordData.city_zh || '',
                            countryZh: recordData.country_zh || '',
                            imageUrl: recordData.imageUrl || '',
                            recordedAt: recordedAt ? recordedAt.toISOString() : null,
                            story: recordData.story || '',
                            greeting: recordData.greeting || '',
                            timezone: recordData.timezone || '',
                            latitude: recordData.latitude || null,
                            longitude: recordData.longitude || null,
                            deviceType: recordData.deviceType || '未知',
                            source: recordData.source || '未知'
                        });
                    });
                }
            } catch (error) {
                console.error(`❌ 查詢 ${knownAppId} 失敗:`, error);
                throw error;
            }

            console.log(`✅ 載入完成，共 ${allUserData.length} 筆記錄`);

            return res.status(200).json({
                success: true,
                data: allUserData,
                count: allUserData.length,
                timestamp: new Date().toISOString()
            });

        } catch (getError) {
            console.error('❌ GET 請求處理失敗:', getError);
            return res.status(500).json({
                success: false,
                error: `GET 請求處理失敗: ${getError.message}`
            });
        }

    } else if (req.method === 'POST') {
        try {
                // POST 請求：根據搜尋條件返回特定使用者資料
                console.log('📥 收到 POST 請求');
            console.log('📝 請求體 (req.body):', req.body);
            console.log('📝 請求體類型:', typeof req.body);
            console.log('📝 原始請求:', req.rawBody);
            
            const { searchTerm, userId, city, country, dateFrom, dateTo } = req.body;

            console.log('🔍 管理員搜尋請求:', { searchTerm, userId, city, country, dateFrom, dateTo });
            console.log('🎯 提取的 userId:', userId);

            // 如果指定了使用者ID，根據 userDisplayName 搜尋該使用者
            if (userId) {
                console.log(`🔍 搜尋使用者 userDisplayName: "${userId}"`);
                
                const knownAppId = 'default-app-id-worldclock-history';
                console.log(`🎯 在應用程式 ${knownAppId} 中搜尋使用者`);
                
                try {
                    // 查詢所有使用者檔案，並檢查每個檔案中的記錄是否匹配 userDisplayName
                    const userProfilesSnapshot = await db.collection(`artifacts/${knownAppId}/userProfiles`).get();
                    console.log(`👥 找到 ${userProfilesSnapshot.size} 個使用者檔案`);
                    
                    let foundMatch = false;
                    
                    for (const userDoc of userProfilesSnapshot.docs) {
                        const dataIdentifier = userDoc.id;
                        console.log(`🔍 檢查使用者檔案: ${dataIdentifier}`);

                        // 查詢該使用者的甦醒記錄
                        const clockHistorySnapshot = await db.collection(`artifacts/${knownAppId}/userProfiles/${dataIdentifier}/clockHistory`)
                            .orderBy('recordedAt', 'desc')
                            .get();

                        clockHistorySnapshot.forEach(recordDoc => {
                            const recordData = recordDoc.data();
                            const recordedAt = recordData.recordedAt ? recordData.recordedAt.toDate() : null;
                            
                            // 檢查是否匹配 userDisplayName
                            const displayName = recordData.userDisplayName || dataIdentifier;
                            
                            if (displayName.toLowerCase().includes(userId.toLowerCase())) {
                                foundMatch = true;
                                console.log(`✅ 找到匹配: userDisplayName="${displayName}", dataIdentifier="${dataIdentifier}"`);
                                
                                // 日期過濾
                                if (dateFrom && recordedAt && recordedAt < new Date(dateFrom)) return;
                                if (dateTo && recordedAt && recordedAt > new Date(dateTo)) return;

                                // 城市過濾
                                if (city && recordData.city && !recordData.city.toLowerCase().includes(city.toLowerCase())) return;
                                if (country && recordData.country && !recordData.country.toLowerCase().includes(country.toLowerCase())) return;

                                allUserData.push({
                                    userId: displayName, // 使用 userDisplayName 顯示
                                    dataIdentifier: dataIdentifier, // 保留 dataIdentifier 供內部使用
                                    appId: knownAppId,
                                    recordId: recordDoc.id,
                                    date: recordedAt ? recordedAt.toLocaleDateString('zh-TW') : '未知',
                                    time: recordedAt ? recordedAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '未知',
                                    city: recordData.city || '未知',
                                    country: recordData.country || '未知',
                                    cityZh: recordData.city_zh || '',
                                    countryZh: recordData.country_zh || '',
                                    imageUrl: recordData.imageUrl || '',
                                    recordedAt: recordedAt ? recordedAt.toISOString() : null,
                                    story: recordData.story || '',
                                    greeting: recordData.greeting || '',
                                    timezone: recordData.timezone || '',
                                    latitude: recordData.latitude || null,
                                    longitude: recordData.longitude || null,
                                    deviceType: recordData.deviceType || '未知',
                                    source: recordData.source || '未知'
                                });
                            }
                        });
                    }
                    
                    if (!foundMatch) {
                        console.log(`⚠️ 未找到 userDisplayName 包含 "${userId}" 的使用者`);
                    }
                    
                } catch (error) {
                    console.error(`❌ 搜尋使用者 "${userId}" 失敗:`, error.message);
                    throw error;
                }
            } else {
                // 搜尋所有使用者（如果沒有指定使用者ID）
                return res.status(400).json({
                    success: false,
                    error: '請指定使用者代號進行搜尋'
                });
            }

            console.log(`✅ 搜尋完成，找到 ${allUserData.length} 筆記錄`);

            return res.status(200).json({
                success: true,
                data: allUserData,
                count: allUserData.length,
                searchCriteria: { searchTerm, userId, city, country, dateFrom, dateTo },
                timestamp: new Date().toISOString()
            });
        } catch (postError) {
            console.error('❌ POST 請求處理失敗:', postError);
            return res.status(500).json({
                success: false,
                error: `POST 請求處理失敗: ${postError.message}`
            });
        }
    } else {
        return res.status(405).json({ 
            success: false, 
            error: `方法 ${req.method} 不被允許` 
        });
    }
}
