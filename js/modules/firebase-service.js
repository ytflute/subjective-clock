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
            const app = initializeApp(firebaseConfig);
            
            this.auth = getAuth(app);
            this.db = getFirestore(app);
            
            this.initialized = true;
            console.log('[FirebaseService] 初始化完成');
            
        } catch (error) {
            console.error('[FirebaseService] 初始化失敗:', error);
            throw error;
        }
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
