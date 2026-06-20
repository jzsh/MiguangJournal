// ============================================================
// 邮件 SMTP 配置示例
// ============================================================
// 使用方式：
//   1. 复制此文件为 private-data.js： cp private-data.example.js private-data.js
//   2. 编辑 private-data.js，填入你的真实 SMTP 配置
//   3. private-data.js 已被 .gitignore 忽略，不会提交
//
// 获取 QQ邮箱 SMTP 授权码：
//   QQ邮箱 → 设置 → 账户 → 开启 POP3/SMTP 服务 → 生成授权码
// ============================================================

module.exports = {
  user: 'your-qq@qq.com',     // ← 你的QQ邮箱
  pass: 'your-auth-code'      // ← SMTP授权码（不是QQ密码）
}
