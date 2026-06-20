// pages/feedback/feedback.js
const cloud = require('../../utils/cloud');
Page({
  data: { content: '', contact: '', submitted: false },
  onContentInput(e) { this.setData({ content: e.detail.value }); },
  onContactInput(e) { this.setData({ contact: e.detail.value }); },
  submit() {
    const { content, contact } = this.data;
    if (!content.trim()) { wx.showToast({ title: '请输入反馈内容', icon: 'none' }); return; }
    wx.showLoading({ title: '提交中...', mask: true });
    cloud.addFeedback(content.trim(), contact.trim()).then(() => {
      this.setData({ submitted: true, content: '', contact: '' });
      wx.hideLoading();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    });
  }
})
