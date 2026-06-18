// ============================================================
// 小程序配置
// ============================================================
// 私密信息（appid、cloudEnv）请放在 private-data.js 中，
// private-data.js 已被 .gitignore 忽略，不会提交到 Git。
//
// 首次使用：cp config.js private-data.js，然后编辑 private-data.js
// ============================================================

let privateData = {};
try {
  privateData = require('./private-data.js');
} catch (e) {
  // private-data.js 不存在，使用占位值
}

module.exports = {
  appid: privateData.appid || 'your-appid-here',
  cloudEnv: privateData.cloudEnv || 'your-cloud-env-id'
}
