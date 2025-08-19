/**
 * 模組化版本測試腳本
 * 用於驗證所有模組是否可以正常載入和運行
 */

// 測試模組載入
async function testModuleLoading() {
    console.log('🧪 開始測試模組載入...');
    
    try {
        // 測試配置模組
        const { Config } = await import('./modules/config.js');
        console.log('✅ Config 模組載入成功');
        console.log('   - 特例時間檢查:', Config.isSpecialTimeRange());
        console.log('   - 應用程式 ID:', Config.getAppId());
        
        // 測試工具模組
        const { Utils } = await import('./modules/utils.js');
        console.log('✅ Utils 模組載入成功');
        console.log('   - 安全 ID 生成:', Utils.generateSafeId('測試用戶'));
        console.log('   - 數字格式化:', Utils.formatNumber(3.14159, 2));
        
        // 測試時間計算模組
        const { TimeCalculator } = await import('./modules/time-calculator.js');
        console.log('✅ TimeCalculator 模組載入成功');
        const targetLat = TimeCalculator.calculateTargetLatitudeFromTime();
        console.log('   - 目標緯度:', targetLat);
        console.log('   - 緯度描述:', TimeCalculator.getLatitudePreferenceDescription(targetLat));
        
        // 測試其他模組的基本載入
        const modules = [
            'firebase-service.js',
            'city-service.js', 
            'map-service.js',
            'ui-manager.js',
            'event-handler.js',
            'app.js'
        ];
        
        for (const moduleName of modules) {
            const moduleExports = await import(`./modules/${moduleName}`);
            const className = Object.keys(moduleExports)[0];
            console.log(`✅ ${className} 模組載入成功`);
        }
        
        console.log('🎉 所有模組載入測試通過！');
        return true;
        
    } catch (error) {
        console.error('❌ 模組載入測試失敗:', error);
        return false;
    }
}

// 測試模組依賴關係
async function testModuleDependencies() {
    console.log('🔗 開始測試模組依賴關係...');
    
    try {
        // 創建模組實例（不需要 DOM 的部分）
        const { Config } = await import('./modules/config.js');
        const { Utils } = await import('./modules/utils.js');
        const { TimeCalculator } = await import('./modules/time-calculator.js');
        
        // 設置測試配置
        Config.setFirebaseConfig({
            apiKey: "test-key",
            authDomain: "test.firebaseapp.com",
            projectId: "test-project"
        });
        
        console.log('✅ 配置設置成功');
        
        // 測試工具函數
        const testId = Utils.sanitizeNameToFirestoreId('測試@用戶#123');
        console.log('✅ 工具函數測試成功:', testId);
        
        // 測試時間計算
        const utcOffset = TimeCalculator.calculateRequiredUTCOffset(8);
        console.log('✅ 時間計算測試成功:', utcOffset);
        
        console.log('🎉 模組依賴關係測試通過！');
        return true;
        
    } catch (error) {
        console.error('❌ 模組依賴關係測試失敗:', error);
        return false;
    }
}

// 測試主應用程式類
async function testMainApp() {
    console.log('🏗️ 開始測試主應用程式類...');
    
    try {
        const { SubjectiveClockApp } = await import('./modules/app.js');
        
        // 創建應用程式實例
        const app = new SubjectiveClockApp();
        console.log('✅ 應用程式實例創建成功');
        
        // 測試狀態獲取
        const status = app.getStatus();
        console.log('✅ 應用程式狀態:', status);
        
        console.log('🎉 主應用程式類測試通過！');
        return true;
        
    } catch (error) {
        console.error('❌ 主應用程式類測試失敗:', error);
        return false;
    }
}

// 執行所有測試
async function runAllTests() {
    console.log('🚀 開始執行模組化版本測試套件...');
    console.log('='.repeat(50));
    
    const results = {
        moduleLoading: await testModuleLoading(),
        moduleDependencies: await testModuleDependencies(),
        mainApp: await testMainApp()
    };
    
    console.log('='.repeat(50));
    console.log('📊 測試結果總結:');
    console.log(`   模組載入: ${results.moduleLoading ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`   模組依賴: ${results.moduleDependencies ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`   主應用程式: ${results.mainApp ? '✅ 通過' : '❌ 失敗'}`);
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
        console.log('🎉 所有測試通過！模組化版本準備就緒。');
    } else {
        console.log('⚠️ 部分測試失敗，請檢查相關模組。');
    }
    
    return allPassed;
}

// 如果在瀏覽器環境中執行
if (typeof window !== 'undefined') {
    window.testModules = runAllTests;
    console.log('🔧 測試函數已設為全域可用: window.testModules()');
}

// 如果直接執行此腳本
if (typeof process !== 'undefined' && process.argv && process.argv[1].includes('test-modules.js')) {
    runAllTests();
}

export { runAllTests, testModuleLoading, testModuleDependencies, testMainApp };
