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

            // 查詢 artifacts 集合下的所有文檔
            const artifactsSnapshot = await db.collection('artifacts').get();

            for (const artifactDoc of artifactsSnapshot.docs) {
                const appId = artifactDoc.id;
                console.log(`處理應用程式: ${appId}`);

                // 查詢該應用程式下的所有使用者
                const userProfilesSnapshot = await db.collection(`artifacts/${appId}/userProfiles`).get();

                for (const userDoc of userProfilesSnapshot.docs) {
                    const userId = userDoc.id;
                    console.log(`處理使用者: ${userId}`);

                    // 查詢該使用者的所有甦醒記錄
                    const clockHistorySnapshot = await db.collection(`artifacts/${appId}/userProfiles/${userId}/clockHistory`)
                        .orderBy('recordedAt', 'desc')
                        .get();

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
            const { searchTerm, userId, city, country, dateFrom, dateTo } = req.body;

            console.log('🔍 管理員搜尋請求:', { searchTerm, userId, city, country, dateFrom, dateTo });

            // 如果指定了使用者ID，只搜尋該使用者
            if (userId) {
                const artifactsSnapshot = await db.collection('artifacts').get();

                for (const artifactDoc of artifactsSnapshot.docs) {
                    const appId = artifactDoc.id;

                    try {
                        const clockHistorySnapshot = await db.collection(`artifacts/${appId}/userProfiles/${userId}/clockHistory`)
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
        return res.status(500).json({
            success: false,
            error: '伺服器內部錯誤',
            details: error.message
        });
    }
}
