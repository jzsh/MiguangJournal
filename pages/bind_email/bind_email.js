// pages/bind_email/bind_email.js
const db = wx.cloud.database()
const cloud = require('../../utils/cloud')

Page({
  data: {
    email: '',
    binding: false,
    status: null
  },

  onLoad() {
    this._loadUserEmail()
  },

  _loadUserEmail() {
    const userId = wx.getStorageSync('userId')
    if (!userId) return
    db.collection('users').doc(userId).get().then(res => {
      if (res.data && res.data.email) {
        this.setData({ email: res.data.email })
      }
    }).catch(() => {})
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value })
  },

  onBind() {
    const email = this.data.email.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setData({ status: { type: 'error', msg: '请输入正确的邮箱地址' } })
      return
    }

    const userId = wx.getStorageSync('userId')
    if (!userId) {
      this.setData({ status: { type: 'error', msg: '请先登录' } })
      return
    }

    this.setData({ binding: true, status: null })

    cloud.bindEmail(userId, email).then(() => {
      this.setData({
        binding: false,
        status: { type: 'success', msg: '邮箱绑定成功！日记有更新会发邮件通知你。' }
      })
    }).catch(err => {
      console.error('绑定邮箱失败:', err)
      this.setData({
        binding: false,
        status: { type: 'error', msg: '绑定失败，请重试' }
      })
    })
  },

  onUnbind() {
    wx.showModal({
      title: '确认解绑',
      content: '解绑后将不再收到邮件通知',
      success: (res) => {
        if (!res.confirm) return
        const userId = wx.getStorageSync('userId')
        if (!userId) return
        cloud.unbindEmail(userId).then(() => {
          this.setData({
            email: '',
            status: { type: 'success', msg: '已解绑邮箱' }
          })
        }).catch(err => {
          console.error('解绑失败:', err)
        })
      }
    })
  }
})
