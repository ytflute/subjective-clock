/**
 * Firebase 服務模組
 * 處理所有 Firebase 相關的操作
 */

import { Config } from './config.js';
import { Utils } from './utils.js';

export class FirebaseService {
    constructor() {
        this.db = null;
        this.auth = null;
        this.initialized = false;
    }
    
    /**
     * 初始化 Firebase
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.waitForFirebaseConfig();
            
            const {
                initializeApp,
                getAuth,
                getFirestore,
                setLogLevel
            } = window.firebaseSDK;
            
            // 設置日誌級別
            setLogLevel('error');
            
            const firebaseConfig = Config.getFirebaseConfig();
            
            // 檢查是否為開發環境的 demo 配置
            const isDemoConfig = firebaseConfig.apiKey === "demo-api-key";
            
            if (isDemoConfig) {
                console.warn('[FirebaseService] 檢測到 demo 配置，初始化模擬模式');
                this.initializeDemoMode();
                return;
            }
            
            const app = initializeApp(firebaseConfig);
            
            this.auth = getAuth(app);
            this.db = getFirestore(app);
            
            this.initialized = true;
            console.log('[FirebaseService] 初始化完成');
            
        } catch (error) {
            console.error('[FirebaseService] 初始化失敗:', error);
            
            // 如果是 API key 錯誤，嘗試 demo 模式
            if (error.code === 'auth/invalid-api-key') {
                console.warn('[FirebaseService] API key 無效，切換到 demo 模式');
                this.initializeDemoMode();
                return;
            }
            
            throw error;
        }
    }
    
    /**
     * 初始化 Demo 模式
     */
    initializeDemoMode() {
        console.log('[FirebaseService] 初始化 Demo 模式');
        
        // 創建模擬的 auth 和 db 對象
        this.auth = {
            currentUser: { uid: 'demo-user-123' }
        };
        
        this.db = null; // Demo 模式下不使用真實資料庫
        this.isDemoMode = true;
        this.initialized = true;
        
        console.log('[FirebaseService] Demo 模式初始化完成');
    }
    
    /**
     * 等待 Firebase 配置
     */
    async waitForFirebaseConfig() {
        return new Promise((resolve) => {
            const checkConfig = () => {
                if (window.firebaseConfig) {
                    Config.setFirebaseConfig(window.firebaseConfig);
                    resolve();
                } else {
                    setTimeout(checkConfig, 100);
                }
            };
            checkConfig();
        });
    }
    
    /**
     * 用戶認證
     */
    async authenticateUser() {
        if (!this.auth) {
            throw new Error('Firebase Auth 未初始化');
        }
        
        // Demo 模式直接返回模擬用戶
        if (this.isDemoMode) {
            console.log('[FirebaseService] Demo 模式：模擬用戶登入');
            return this.auth.currentUser;
        }
        
        const { signInAnonymously, signInWithCustomToken, onAuthStateChanged } = window.firebaseSDK;
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(this.auth, async (user) => {
                if (user) {
                    console.log('[FirebaseService] 用戶已登入:', user.uid);
                    resolve(user);
                    unsubscribe();
                } else {
                    try {
                        if (initialAuthToken) {
                            console.log('[FirebaseService] 使用 initialAuthToken 登入...');
                            await signInWithCustomToken(this.auth, initialAuthToken);
                        } else {
                            console.log('[FirebaseService] 匿名登入...');
                            await signInAnonymously(this.auth);
                        }
                    } catch (error) {
                        console.error('[FirebaseService] 登入失敗:', error);
                        reject(error);
                        unsubscribe();
                    }
                }
            });
        });
    }
    
    /**
     * 儲存歷史記錄
     */
    async saveHistoryRecord(recordData, userIdentifier) {
        if (!userIdentifier) {
            throw new Error('用戶標識符未設定');
        }
        
        // Demo 模式模擬儲存
        if (this.isDemoMode) {
            console.log('[FirebaseService] Demo 模式：模擬儲存歷史記錄', recordData);
            return 'demo-record-' + Date.now();
        }
        
        const { collection, addDoc, serverTimestamp } = window.firebaseSDK;
        
        // 準備記錄數據
        const sanitizedData = {
            ...recordData,
            recordedAt: serverTimestamp(),
            greeting: recordData.greeting || "",
            story: recordData.story || "",
            imageUrl: recordData.imageUrl || null,
            groupName: recordData.groupName || ""
        };
        
        // 檢查特殊情況
        const isSpecialCase = recordData.city === "Unknown Planet" || recordData.city_zh === "未知星球";
        
        if (isSpecialCase) {
            sanitizedData.latitude = recordData.latitude || 0;
            sanitizedData.longitude = recordData.longitude || 0;
        } else {
            if (recordData.latitude === null || recordData.longitude === null) {
                throw new Error('經緯度無效');
            }
        }
        
        const appId = Config.getAppId();
        const historyCollectionRef = collection(this.db, `artifacts/${appId}/userProfiles/${userIdentifier}/clockHistory`);
        
        try {
            const docRef = await addDoc(historyCollectionRef, sanitizedData);
            console.log('[FirebaseService] 歷史記錄已儲存:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('[FirebaseService] 儲存歷史記錄失敗:', error);
            throw error;
        }
    }
    
    /**
     * 儲存全域每日記錄
     */
    async saveToGlobalDailyRecord(recordData) {
        if (!this.auth.currentUser) {
            throw new Error('Firebase 會話未就緒');
        }
        
        // Demo 模式模擬儲存
        if (this.isDemoMode) {
            console.log('[FirebaseService] Demo 模式：模擬儲存全域記錄', recordData);
            return 'demo-global-' + Date.now();
        }
        
        const { collection, addDoc, serverTimestamp } = window.firebaseSDK;
        
        const sanitizedData = {
            dataIdentifier: recordData.dataIdentifier,
            userDisplayName: recordData.userDisplayName,
            groupName: recordData.groupName || "",
            city: recordData.city,
            country: recordData.country,
            city_zh: recordData.city_zh,
            country_zh: recordData.country_zh,
            latitude: recordData.latitude,
            longitude: recordData.longitude,
            targetUTCOffset: recordData.targetUTCOffset,
            timezone: recordData.timezone,
            recordedAt: serverTimestamp(),
            userLocalTime: recordData.userLocalTime,
            targetLatitude: recordData.targetLatitude,
            latitudeDescription: recordData.latitudeDescription,
            isUniverseTheme: recordData.isUniverseTheme || false
        };
        
        const today = new Date().toISOString().split('T')[0];
        const appId = Config.getAppId();
        const globalDailyCollectionRef = collection(this.db, `artifacts/${appId}/globalDaily/${today}/records`);
        
        try {
            const docRef = await addDoc(globalDailyCollectionRef, sanitizedData);
            console.log('[FirebaseService] 全域記錄已儲存:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('[FirebaseService] 儲存全域記錄失敗:', error);
            throw error;
        }
    }
    
    /**
     * 獲取用戶歷史記錄
     */
    async getUserHistory(userIdentifier, limit = 20) {
        // Demo 模式返回模擬數據
        if (this.isDemoMode) {
            console.log('[FirebaseService] Demo 模式：返回模擬歷史記錄');
            
            // 為不同用戶提供不同的模擬數據
            const demoRecords = [
                {
                    id: 'demo-1',
                    city: 'Tokyo',
                    country: 'Japan',
                    city_zh: '東京',
                    country_zh: '日本',
                    latitude: 35.6762,
                    longitude: 139.6503,
                    targetUTCOffset: 9,
                    timezone: { timeZoneId: 'Asia/Tokyo', countryCode: 'JP' },
                    story: '在東京的清晨，您感受到這座城市的活力與傳統的完美融合。櫻花飄落的街道上，人們開始了忙碌而有序的一天。',
                    greeting: 'おはようございます (Good morning)',
                    translationSource: 'ai_translate',
                    latitudeDescription: '北緯35.7度 (溫帶區域)',
                    isUniverseTheme: false,
                    recordedAt: { toDate: () => new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 昨天
                    groupName: 'demo'
                },
                {
                    id: 'demo-2',
                    city: 'Paris',
                    country: 'France',
                    city_zh: '巴黎',
                    country_zh: '法國',
                    latitude: 48.8566,
                    longitude: 2.3522,
                    targetUTCOffset: 1,
                    timezone: { timeZoneId: 'Europe/Paris', countryCode: 'FR' },
                    story: '在巴黎的清晨，塞納河畔瀰漫著浪漫的氣息。咖啡館開始營業，城市慢慢甦醒在藝術與美食的懷抱中。',
                    greeting: 'Bonjour',
                    translationSource: 'ai_translate',
                    latitudeDescription: '北緯48.9度 (溫帶區域)',
                    isUniverseTheme: false,
                    recordedAt: { toDate: () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, // 前天
                    groupName: 'demo'
                }
            ];
            
            // 根據用戶標識符決定返回哪些記錄
            if (userIdentifier.includes('test') || userIdentifier.includes('測試')) {
                return demoRecords;
            } else {
                // 新用戶返回最近的一筆記錄
                return [demoRecords[0]];
            }
        }
        
        const { collection, query, where, orderBy, getDocs, limit: firestoreLimit } = window.firebaseSDK;
        
        const appId = Config.getAppId();
        const historyCollectionRef = collection(this.db, `artifacts/${appId}/userProfiles/${userIdentifier}/clockHistory`);
        
        const historyQuery = query(
            historyCollectionRef,
            orderBy('recordedAt', 'desc'),
            firestoreLimit(limit)
        );
        
        try {
            const querySnapshot = await getDocs(historyQuery);
            const records = [];
            
            querySnapshot.forEach((doc) => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`[FirebaseService] 獲取到 ${records.length} 筆歷史記錄`);
            return records;
        } catch (error) {
            console.error('[FirebaseService] 獲取歷史記錄失敗:', error);
            throw error;
        }
    }
    
    /**
     * 獲取用戶最後記錄
     */
    async getUserLastRecord(userIdentifier) {
        const records = await this.getUserHistory(userIdentifier, 1);
        return records.length > 0 ? records[0] : null;
    }
    
    /**
     * 獲取全域每日記錄
     */
    async getGlobalDailyRecords(date = null) {
        // Demo 模式返回模擬全域數據
        if (this.isDemoMode) {
            console.log('[FirebaseService] Demo 模式：返回模擬全域記錄');
            return [
                {
                    id: 'demo-global-1',
                    city: 'Paris',
                    country: 'France',
                    city_zh: '巴黎',
                    country_zh: '法國',
                    latitude: 48.8566,
                    longitude: 2.3522,
                    userDisplayName: 'Demo User 1',
                    recordedAt: { toDate: () => new Date() }
                },
                {
                    id: 'demo-global-2',
                    city: 'New York',
                    country: 'USA',
                    city_zh: '紐約',
                    country_zh: '美國',
                    latitude: 40.7128,
                    longitude: -74.0060,
                    userDisplayName: 'Demo User 2',
                    recordedAt: { toDate: () => new Date() }
                }
            ];
        }
        
        const { collection, query, orderBy, getDocs } = window.firebaseSDK;
        
        const targetDate = date || new Date().toISOString().split('T')[0];
        const appId = Config.getAppId();
        const globalDailyCollectionRef = collection(this.db, `artifacts/${appId}/globalDaily/${targetDate}/records`);
        
        const globalQuery = query(
            globalDailyCollectionRef,
            orderBy('recordedAt', 'desc')
        );
        
        try {
            const querySnapshot = await getDocs(globalQuery);
            const records = [];
            
            querySnapshot.forEach((doc) => {
                records.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`[FirebaseService] 獲取到 ${records.length} 筆全域記錄 (${targetDate})`);
            return records;
        } catch (error) {
            console.error('[FirebaseService] 獲取全域記錄失敗:', error);
            throw error;
        }
    }
    
    /**
     * 更新記錄
     */
    async updateRecord(userIdentifier, recordId, updateData) {
        // Demo 模式模擬更新
        if (this.isDemoMode) {
            console.log('[FirebaseService] Demo 模式：模擬更新記錄', recordId, updateData);
            return;
        }
        
        const { doc, updateDoc } = window.firebaseSDK;
        
        const appId = Config.getAppId();
        const recordRef = doc(this.db, `artifacts/${appId}/userProfiles/${userIdentifier}/clockHistory`, recordId);
        
        try {
            await updateDoc(recordRef, updateData);
            console.log('[FirebaseService] 記錄已更新:', recordId);
        } catch (error) {
            console.error('[FirebaseService] 更新記錄失敗:', error);
            throw error;
        }
    }
    
    /**
     * 獲取用戶城市訪問統計
     */
    async getUserCityVisitStats(userIdentifier) {
        try {
            // Demo 模式返回模擬統計
            if (this.isDemoMode) {
                console.log('[FirebaseService] Demo 模式：返回模擬城市訪問統計');
                return {
                    'Tokyo_Japan': 2,
                    'Paris_France': 1,
                    'New York_USA': 1
                };
            }
            
            const records = await this.getUserHistory(userIdentifier, 100); // 獲取更多記錄用於統計
            const cityVisitCounts = {};
            
            records.forEach(record => {
                const cityKey = `${record.city}_${record.country}`;
                cityVisitCounts[cityKey] = (cityVisitCounts[cityKey] || 0) + 1;
            });
            
            console.log('[FirebaseService] 城市訪問統計:', cityVisitCounts);
            return cityVisitCounts;
        } catch (error) {
            console.error('[FirebaseService] 獲取城市訪問統計失敗:', error);
            return {};
        }
    }
}
