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

// 常數定義
const APP_ID = 'default-app-id-worldclock-history';

export default async function handler(req, res) {
    // 設定 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: '只允許 POST 請求' 
        });
    }

    try {
        const {
            userDisplayName,
            dataIdentifier,
            city,
            country,
            city_zh,
            country_zh,
            country_iso_code,
            latitude,
            longitude,
            timezone,
            localTime,
            targetUTCOffset,
            matchedCityUTCOffset,
            source,
            translationSource,
            timeMinutes,
            latitudePreference,
            latitudeDescription,
            deviceType = 'raspberry_pi'
        } = req.body;

        // 驗證必要欄位
        if (!userDisplayName || !city || !country) {
            return res.status(400).json({
                success: false,
                error: '缺少必要欄位：userDisplayName, city, country'
            });
        }

        // 獲取當前日期字串
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const recordedDateString = `${year}-${month}-${day}`;

        // 準備基本記錄資料
        const baseRecordData = {
            dataIdentifier: dataIdentifier || userDisplayName.toLowerCase(),
            userDisplayName,
            recordedAt: admin.firestore.FieldValue.serverTimestamp(),
            localTime: localTime || now.toLocaleTimeString(),
            city,
            country,
            city_zh: city_zh || city,
            country_zh: country_zh || country,
            country_iso_code: country_iso_code || '',
            latitude: parseFloat(latitude) || 0,
            longitude: parseFloat(longitude) || 0,
            targetUTCOffset: parseFloat(targetUTCOffset) || 0,
            matchedCityUTCOffset: parseFloat(matchedCityUTCOffset) || 0,
            recordedDateString,
            timezone: timezone || 'UTC',
            source: source || 'raspberry_pi_api',
            translationSource: translationSource || 'local_database',
            timeMinutes: parseInt(timeMinutes) || 0,
            latitudePreference: parseFloat(latitudePreference) || 0,
            latitudeDescription: latitudeDescription || '',
            deviceType,
            greeting: '', // 將由前端填入
            story: '', // 將由前端填入
            imageUrl: null // 將由前端填入
        };

        // 準備全域記錄資料
        const baseGlobalRecordData = {
            userDisplayName,
            city,
            country,
            city_zh: city_zh || city,
            country_zh: country_zh || country,
            country_iso_code: country_iso_code || '',
            latitude: parseFloat(latitude) || 0,
            longitude: parseFloat(longitude) || 0,
            timezone: timezone || 'UTC',
            recordedAt: admin.firestore.FieldValue.serverTimestamp(),
            recordedDateString,
            deviceType
        };

        // 準備 artifacts 結構所需的額外資料
        const sanitizedDisplayName = userDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const artifactsData = {
            appId: APP_ID,
            sanitizedDisplayName,
            source: 'raspberry_pi_api'
        };

        // 主要儲存：artifacts 結構
        try {
            // 儲存到個人檔案結構（對應網頁版個人軌跡）
            const userProfilePath = `artifacts/${APP_ID}/userProfiles/${sanitizedDisplayName}/clockHistory`;
            const userProfileDocRef = await db.collection(userProfilePath).add({
                ...baseRecordData,
                ...artifactsData
            });
            console.log('✅ 個人檔案記錄已儲存到 artifacts，文件 ID:', userProfileDocRef.id);

            // 儲存到公共資料結構（對應網頁版眾人地圖）
            const publicDataPath = `artifacts/${APP_ID}/publicData/allSharedEntries/dailyRecords`;
            const publicDocRef = await db.collection(publicDataPath).add({
                ...baseGlobalRecordData,
                ...artifactsData
            });
            console.log('✅ 公共資料記錄已儲存到 artifacts，文件 ID:', publicDocRef.id);

            // === 棄用：為了向後兼容，暫時保留寫入到根層級 ===
            // 儲存到個人歷史記錄
            const historyDocRef = await db.collection('userHistory').add(baseRecordData);
            console.log('⚠️ [棄用] 個人歷史記錄已儲存到根層級，文件 ID:', historyDocRef.id);

            // 儲存到全域每日記錄
            const globalDocRef = await db.collection('globalDailyRecords').add(baseGlobalRecordData);
            console.log('⚠️ [棄用] 全域每日記錄已儲存到根層級，文件 ID:', globalDocRef.id);

            return res.status(200).json({
                success: true,
                message: '記錄已成功儲存',
                artifactsIds: {
                    userProfileId: userProfileDocRef.id,
                    publicDataId: publicDocRef.id
                },
                legacyIds: {  // 棄用
                    historyId: historyDocRef.id,
                    globalId: globalDocRef.id
                },
                recordData: {
                    ...baseRecordData,
                    recordedAt: now.toISOString()
                }
            });

        } catch (error) {
            console.error('儲存記錄時發生錯誤:', error);
            return res.status(500).json({
                success: false,
                error: '內部伺服器錯誤',
                details: error.message
            });
        }

    } catch (error) {
        console.error('處理請求時發生錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '內部伺服器錯誤',
            details: error.message
        });
    }
} 