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

    try {
        let allUserData = [];

        if (req.method === 'GET') {
            // GET 請求：返回所有使用者資料
            console.log('🔍 管理員請求：載入所有使用者資料');
            console.log('📊 Firebase Admin SDK 狀態:', {
                appsLength: admin.apps.length,
                projectId: process.env.FIREBASE_PROJECT_ID,
                hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
                hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
            });

            // 查詢 artifacts 集合下的所有文檔
            console.log('🔍 開始查詢 artifacts 集合...');
            const artifactsSnapshot = await db.collection('artifacts').get();
            console.log(`📄 找到 ${artifactsSnapshot.size} 個 artifacts 文檔`);

            for (const artifactDoc of artifactsSnapshot.docs) {
                const appId = artifactDoc.id;
                console.log(`處理應用程式: ${appId}`);

                // 查詢該應用程式下的所有使用者
                console.log(`🔍 查詢路徑: artifacts/${appId}/userProfiles`);
                const userProfilesSnapshot = await db.collection(`artifacts/${appId}/userProfiles`).get();
                console.log(`👥 找到 ${userProfilesSnapshot.size} 個使用者檔案`);

                for (const userDoc of userProfilesSnapshot.docs) {
                    const userId = userDoc.id;
                    console.log(`處理使用者: ${userId}`);

                    // 查詢該使用者的所有甦醒記錄
                    console.log(`🔍 查詢記錄路徑: artifacts/${appId}/userProfiles/${userId}/clockHistory`);
                    const clockHistorySnapshot = await db.collection(`artifacts/${appId}/userProfiles/${userId}/clockHistory`)
                        .orderBy('recordedAt', 'desc')
                        .get();
                    console.log(`📝 找到 ${clockHistorySnapshot.size} 筆甦醒記錄`);

                    clockHistorySnapshot.forEach(recordDoc => {
                        const recordData = recordDoc.data();
                        const recordedAt = recordData.recordedAt ? recordData.recordedAt.toDate() : null;
                        
                        allUserData.push({
                            userId: userId,
                            appId: appId,
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
            }

            console.log(`✅ 載入完成，共 ${allUserData.length} 筆記錄`);

            return res.status(200).json({
                success: true,
                data: allUserData,
                count: allUserData.length,
                timestamp: new Date().toISOString()
            });

        } else if (req.method === 'POST') {
            // POST 請求：根據搜尋條件返回特定使用者資料
            console.log('📥 收到 POST 請求');
            console.log('📝 請求體 (req.body):', req.body);
            console.log('📝 請求體類型:', typeof req.body);
            console.log('📝 原始請求:', req.rawBody);
            
            const { searchTerm, userId, city, country, dateFrom, dateTo } = req.body;

            console.log('🔍 管理員搜尋請求:', { searchTerm, userId, city, country, dateFrom, dateTo });
            console.log('🎯 提取的 userId:', userId);

            // 如果指定了使用者ID，只搜尋該使用者
            if (userId) {
                console.log(`🔍 搜尋使用者原始輸入: "${userId}"`);
                
                // 轉換使用者名稱為 Firebase 安全識別碼
                const sanitizedUserId = sanitizeNameToFirestoreId(userId);
                console.log(`🔧 轉換後的安全識別碼: "${sanitizedUserId}"`);
                
                if (!sanitizedUserId) {
                    return res.status(400).json({
                        success: false,
                        error: '無效的使用者名稱'
                    });
                }
                
                const artifactsSnapshot = await db.collection('artifacts').get();
                console.log(`📊 找到 ${artifactsSnapshot.size} 個應用程式`);
                
                // 列出所有應用程式ID
                artifactsSnapshot.docs.forEach(doc => {
                    console.log(`📱 應用程式ID: ${doc.id}`);
                });

                for (const artifactDoc of artifactsSnapshot.docs) {
                    const appId = artifactDoc.id;
                    console.log(`🔍 在應用程式 ${appId} 中搜尋使用者 ${sanitizedUserId}`);
                    
                    // 檢查 userProfiles 集合是否存在
                    const userProfilesSnapshot = await db.collection(`artifacts/${appId}/userProfiles`).get();
                    console.log(`👥 應用程式 ${appId} 下有 ${userProfilesSnapshot.size} 個使用者檔案`);
                    
                    // 列出所有使用者ID
                    userProfilesSnapshot.docs.forEach(userDoc => {
                        console.log(`👤 使用者ID: ${userDoc.id}`);
                    });

                    try {
                        const clockHistorySnapshot = await db.collection(`artifacts/${appId}/userProfiles/${sanitizedUserId}/clockHistory`)
                            .orderBy('recordedAt', 'desc')
                            .get();

                        clockHistorySnapshot.forEach(recordDoc => {
                            const recordData = recordDoc.data();
                            const recordedAt = recordData.recordedAt ? recordData.recordedAt.toDate() : null;

                            // 日期過濾
                            if (dateFrom && recordedAt && recordedAt < new Date(dateFrom)) return;
                            if (dateTo && recordedAt && recordedAt > new Date(dateTo)) return;

                            // 城市過濾
                            if (city && recordData.city && !recordData.city.toLowerCase().includes(city.toLowerCase())) return;
                            if (country && recordData.country && !recordData.country.toLowerCase().includes(country.toLowerCase())) return;

                            allUserData.push({
                                userId: userId,
                                appId: appId,
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
                    } catch (error) {
                        console.log(`⚠️ 使用者 ${userId} 在應用程式 ${appId} 中無資料或無權限`);
                    }
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

        } else {
            return res.status(405).json({ 
                success: false, 
                error: `方法 ${req.method} 不被允許` 
            });
        }

    } catch (error) {
        console.error('❌ 管理員資料查詢失敗:', error);
        console.error('❌ 錯誤堆疊:', error.stack);
        console.error('❌ 錯誤代碼:', error.code);
        return res.status(500).json({
            success: false,
            error: '伺服器內部錯誤',
            details: error.message,
            errorCode: error.code || 'UNKNOWN_ERROR'
        });
    }
}
