// 通知云函数（接收所有操作事件，自动通知绑定邮箱的用户）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 根据操作类型和实体类型生成邮件内容
function buildMailContent(operationType, entityType, entityContent, extraInfo = {}) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  // 操作动作文本
  const actionMap = { add: '添加', update: '修改', delete: '删除' }
  const action = actionMap[operationType] || operationType

  // 实体名称映射（与操作历史页一致）
  const entityNames = {
    diary: '日记', comment: '评论', sticky_note: '便利贴',
    anniversary: '纪念日', favorite: '收藏', goal: '小目标',
    memo: '备忘录', quick_entry: '快捷入口', hobby: '爱好标签',
    period_record: '健康记录', couple_thing: '情侣事项', user: '用户资料',
    photo: '照片', feedback: '反馈', diary_like: '日记点赞',
    email_bind: '邮箱绑定', comment_orphan_clean: '孤儿评论清理',
    data_clear: '数据清除', data_import: '数据导入'
  }
  const entityName = entityNames[entityType] || entityType

  // 提取标题
  let itemTitle = entityContent?.title || entityContent?.name || entityContent?.thingText || ''
  // 新实体类型特殊处理
  if (!itemTitle) {
    if (entityType === 'diary_like') itemTitle = entityContent?.action || '点赞操作'
    else if (entityType === 'email_bind') itemTitle = entityContent?.action || '邮箱操作'
    else if (entityType === 'photo') itemTitle = entityContent?.date ? `照片 ${entityContent.date}` : '照片'
    else if (entityType === 'feedback') itemTitle = entityContent?.contentPreview || '用户反馈'
    else if (entityType === 'data_clear') itemTitle = `清除 ${entityContent?.totalDeleted || 0} 条数据`
    else if (entityType === 'data_import') itemTitle = `导入 ${entityContent?.importedCount || 0} 条数据`
    else if (entityType === 'comment_orphan_clean') itemTitle = `清理 ${entityContent?.count || 0} 条孤儿评论`
  }
  const titlePreview = itemTitle ? itemTitle.substring(0, 50) : ''

  // 操作者名称
  const operatorName = extraInfo.operatorName || ''
  const operatorId = extraInfo.userId || ''
  const displayUser = operatorName || (operatorId ? operatorId.substring(0, 8) + '...' : '未知用户')

  // 操作时间
  const displayTime = extraInfo.operationTime
    ? (() => {
        try {
          const d = new Date(extraInfo.operationTime)
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        } catch (e) {
          return extraInfo.operationTime
        }
      })()
    : dateStr

  // 操作类型颜色（与操作历史页一致）
  const typeColors = { add: '#27ae60', update: '#f39c12', delete: '#e74c3c' }
  const color = typeColors[operationType] || '#3498db'
  const borderColor = color
  const badgeBg = color

  // 邮件主题
  const prefix = '[觅光手记]'
  const subject = `${prefix} ${action}${entityName}${titlePreview ? '「' + titlePreview + '」' : ''}`

  // ----- 构建详情内容 -----
  let detailHtml = ''
  if (entityType === 'diary' && (operationType === 'add' || operationType === 'delete')) {
    // 新增/删除：展示完整日记内容
    const detailLines = entityContent.detail || (Array.isArray(entityContent.content) ? entityContent.content.join('\n') : '') || ''
    const maxText = detailLines.split('\n').slice(0, 30).join('\n')
    const tags = [entityContent.mood, entityContent.weather, entityContent.location].filter(Boolean).join(' · ')
    const detailItems = []
    if (tags) detailItems.push(`<tr><td style="padding:4px 0;color:#999;width:50px;vertical-align:top;">标签</td><td style="padding:4px 0;color:#666;">${_escapeHtml(tags)}</td></tr>`)
    if (entityContent.date) detailItems.push(`<tr><td style="padding:4px 0;color:#999;width:50px;vertical-align:top;">日期</td><td style="padding:4px 0;color:#666;">${_escapeHtml(entityContent.date)}</td></tr>`)
    if (maxText) detailHtml = `
      <div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:8px;">
        <div style="font-size:13px;color:#666;margin-bottom:6px;">日记内容</div>
        <div style="font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">${_escapeHtml(maxText)}</div>
      </div>`
  } else if (entityType === 'diary' && operationType === 'update') {
    // 更新：diff（只展示有变化的字段）
    detailHtml = _buildDiffHtml(entityContent)
  }

  // 详情文本（非日记实体用）
  let detailText = ''
  if (!detailHtml && entityContent) {
    if (entityType === 'anniversary') {
      const p = [entityContent.date ? `日期：${entityContent.date}` : '', entityContent.icon ? `图标：${entityContent.icon}` : ''].filter(Boolean).join(' | ')
      detailText = p || (entityContent.name || '')
    } else if (entityType === 'comment') {
      detailText = entityContent.contentPreview || entityContent.content || '（无内容）'
    } else if (entityType === 'sticky_note') {
      detailText = entityContent.textPreview || '（空便利贴）'
    } else if (entityType === 'couple_thing') {
      const p = []
      if (entityContent.action) p.push(`操作：${entityContent.action}`)
      if (entityContent.oldCompleted !== undefined && entityContent.newCompleted !== undefined) {
        p.push(`${entityContent.oldCompleted ? '已完成' : '未完成'} → ${entityContent.newCompleted ? '已完成' : '未完成'}`)
      }
      detailText = p.join(' | ') || (entityContent.thingText || '')
    } else if (entityType === 'user') {
      const p = []
      if (entityContent.nickName) p.push(`昵称：${entityContent.nickName}`)
      if (entityContent.hasAvatar) p.push('更新了头像')
      if (entityContent.hasAge) p.push('更新了年龄')
      detailText = p.join(' | ') || ''
    } else if (entityType === 'diary_like') {
      detailText = `${entityContent.action || '点赞'}（当前 ${entityContent.likeCount} 赞）`
    } else if (entityType === 'email_bind') {
      detailText = entityContent.email ? `${entityContent.action}：${entityContent.email}` : (entityContent.action || '')
    } else if (entityType === 'photo') {
      detailText = entityContent.date ? `日期：${entityContent.date}` : ''
    } else if (entityType === 'feedback') {
      detailText = entityContent.contentPreview || ''
    } else if (entityType === 'data_clear') {
      detailText = `共删除 ${entityContent.totalDeleted || 0} 条数据`
    } else if (entityType === 'data_import') {
      detailText = `成功 ${entityContent.importedCount || 0} 条，失败 ${entityContent.errorCount || 0} 条`
    } else if (entityType === 'comment_orphan_clean') {
      detailText = `清理 ${entityContent.count || 0} 条孤儿评论`
    }
  }

  // ----- 邮件正文 -----
  const html = `
    <div style="max-width:520px;margin:0 auto;font-family:-apple-system,'Microsoft YaHei',sans-serif;background:#f5f6fa;padding:16px;">
      <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid ${borderColor};">

        <!-- 操作类型标签 -->
        <div style="display:inline-block;background:${badgeBg};color:#fff;font-size:12px;font-weight:600;padding:4px 14px;border-radius:12px;letter-spacing:1px;margin-bottom:14px;">${action}${entityName}</div>

        <!-- 信息行 -->
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:5px 0;color:#999;width:60px;vertical-align:top;">操作者</td><td style="padding:5px 0;color:#333;font-weight:500;">${_escapeHtml(displayUser)}</td></tr>
          <tr><td style="padding:5px 0;color:#999;width:60px;vertical-align:top;">时间</td><td style="padding:5px 0;color:#555;">${displayTime}</td></tr>
          ${titlePreview ? `<tr><td style="padding:5px 0;color:#999;width:60px;vertical-align:top;">标题</td><td style="padding:5px 0;color:#333;font-weight:600;font-size:14px;">${_escapeHtml(titlePreview)}</td></tr>` : ''}
          ${detailText ? `<tr><td style="padding:5px 0;color:#999;width:60px;vertical-align:top;">详情</td><td style="padding:5px 0;color:#666;">${_escapeHtml(detailText)}</td></tr>` : ''}
        </table>

        ${detailHtml}

      </div>

      <!-- 按钮 -->
      <div style="text-align:center;margin-top:16px;">
        <a href="https://mp.weixin.qq.com" style="display:inline-block;background:#00b26a;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:13px;">打开小程序查看详情</a>
      </div>

      <p style="text-align:center;color:#ccc;font-size:11px;margin-top:16px;">本邮件由觅光手记自动发送 · 绑定邮箱 → 我的 → 绑定邮箱</p>
    </div>
  `

  return { subject, html }
}

// 构建 diff HTML（新旧对比）
function _buildDiffHtml(entityContent) {
  const fields = ['title', 'detail', 'date', 'mood', 'weather', 'location']
  const fieldLabels = { title: '标题', detail: '正文', date: '日期', mood: '心情', weather: '天气', location: '位置' }
  let hasChanges = false
  let html = ''

  for (const field of fields) {
    const oldVal = (entityContent.old && entityContent.old[field]) || ''
    const newVal = (entityContent.new && entityContent.new[field]) || ''
    if (oldVal !== newVal && !(!oldVal && !newVal)) {
      hasChanges = true
      html += `
      <div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:8px;">
        <div style="font-size:13px;color:#666;margin-bottom:6px;font-weight:500;">${fieldLabels[field]}</div>
        <div style="font-size:13px;color:#c00;background:#fff5f5;padding:6px 10px;border-radius:4px;margin-bottom:4px;">${_escapeHtml(oldVal) || '<span style="color:#ccc;">（空）</span>'}</div>
        <div style="font-size:13px;color:#060;background:#f0fff4;padding:6px 10px;border-radius:4px;">${_escapeHtml(newVal) || '<span style="color:#ccc;">（空）</span>'}</div>
      </div>`
    }
  }

  if (!hasChanges) {
    return '<div style="margin-top:12px;font-size:13px;color:#999;">没有内容变更</div>'
  }

  return html
}

// 转义 HTML 特殊字符
function _escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

exports.main = async (event, context) => {
  const { operationType, entityType, entityContent, userId, operatorName, operationTime } = event
  if (!operationType || !entityType) {
    return { code: -1, msg: '参数不足' }
  }

  // 查所有绑了邮箱的用户
  const { data: users } = await db.collection('users')
    .where({ email: db.command.exists(true) })
    .get()

  if (users.length === 0) {
    return { code: 0, msg: '没有用户绑定邮箱' }
  }

  // 生成邮件内容（传入操作者信息）
  const { subject, html } = buildMailContent(operationType, entityType, entityContent, {
    userId, operatorName, operationTime
  })

  // 逐个发邮件
  const results = []
  for (const user of users) {
    try {
      const res = await cloud.callFunction({
        name: 'sendEmail',
        data: { to: user.email, subject, html }
      })
      results.push({ email: user.email, code: res.result.code })
    } catch (err) {
      console.error('[notifyEvent] 发送给', user.email, '失败:', err)
      results.push({ email: user.email, code: -1 })
    }
  }

  return { code: 0, msg: `已通知 ${results.length} 个用户`, results }
}
