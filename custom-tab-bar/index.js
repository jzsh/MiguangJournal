Component({
  data: {
    list: [
      { pagePath: '/pages/index/index', text: '首页' },
      { pagePath: '/pages/note/note', text: '便利贴' },
      { pagePath: '/pages/album/album', text: '相册' },
      { pagePath: '/pages/mine/mine', text: '我的' }
    ],
    selected: 0,
    safeAreaBottom: 0
  },

  attached() {
    try {
      const sys = wx.getSystemInfoSync()
      const bottom = sys.screenHeight - sys.safeArea.bottom
      if (bottom > 0) this.setData({ safeAreaBottom: bottom })
    } catch (e) {}
  },

  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.index
      const item = this.data.list[idx]
      if (!item) return
      // 立即切绿，再跳转
      this.setData({ selected: idx })
      wx.switchTab({ url: item.pagePath })
    }
  }
})
