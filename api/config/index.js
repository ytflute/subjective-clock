// /api/config/index.js
export default function handler(req, res) {
  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 如果是 OPTIONS 請求，直接返回
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允許 GET 請求
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `方法 ${req.method} 不被允許` });
    return;
  }

  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

  // 檢查必要的配置是否存在
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket'];
  const missingKeys = requiredKeys.filter(key => !config[key]);

  if (missingKeys.length > 0) {
    console.error('缺少必要的環境變數:', missingKeys);
    res.status(500).json({ error: '伺服器配置不完整' });
    return;
  }

  const configScript = `window.firebaseConfig = ${JSON.stringify(config)};`;
  
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(configScript);
} 
