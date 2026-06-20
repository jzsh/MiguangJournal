// 发送邮件云函数
// 依赖：npm install nodemailer
//
// 使用前需要在 cloudfunctions/sendEmail 目录下执行：
//   npm install
//
// SMTP 配置请放在同目录的 private-data.js 中（已被 .gitignore 忽略）
// 参考 private-data.example.js 的格式

const nodemailer = require('nodemailer')
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 从私有配置读取 SMTP 信息
let MAIL_CONFIG
try {
  MAIL_CONFIG = require('./private-data.js')
} catch (e) {
  MAIL_CONFIG = { user: '', pass: '' }
}

const FROM_NAME = '觅光手记'

// 创建邮件发送器
let transporter = null

function getTransporter() {
  if (!transporter && MAIL_CONFIG.user && MAIL_CONFIG.pass) {
    transporter = nodemailer.createTransport({
      service: 'QQ',
      auth: { user: MAIL_CONFIG.user, pass: MAIL_CONFIG.pass }
    })
  }
  return transporter
}

exports.main = async (event, context) => {
  const { to, subject, html } = event
  if (!to || !subject || !html) {
    return { code: -1, msg: '缺少必填参数：to, subject, html' }
  }

  const t = getTransporter()
  if (!t) {
    return { code: -1, msg: 'SMTP 未配置，请先配置 cloudfunctions/sendEmail/private-data.js' }
  }

  try {
    const info = await t.sendMail({
      from: `"${FROM_NAME}" <${MAIL_CONFIG.user}>`,
      to,
      subject,
      html
    })
    console.log('[sendEmail] 发送成功:', info.messageId)
    return { code: 0, msg: '发送成功', messageId: info.messageId }
  } catch (err) {
    console.error('[sendEmail] 发送失败:', err)
    return { code: -1, msg: err.message }
  }
}
