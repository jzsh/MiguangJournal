// pages/note/note.js
const cloud = require('../../utils/cloud');

Page({
  data: {
    anniversaries: [],
    countdownList: [],
    showAddAnniversary: false,
    newAnnName: '',
    newAnnDate: '',
    newAnnIcon: '🎉',
    coupleThingsDone: 0,
    coupleThingsTotal: 100,
    stickyNotes: [],
    showAddNote: false,
    noteText: '',
    quickEntries: [],
    showAddQuick: false,
    newQuickIcon: '📌',
    newQuickName: '',
    hobbies: [],
    showAddHobby: false,
    newHobby: ''
  },

  _loaded: false,
  _refreshing: false,

  onLoad() {
    this._calcCountdown();
    this._loadCoupleThingsProgress();
  },

  onShow() {
    const tb = this.getTabBar()
    if (tb) tb.setData({ selected: 1 })

    if (this._loaded) {
      this._loadFromCache();
      this._refreshSilently();
    } else {
      this._loadAllData(true);
      this._loaded = true;
    }
  },

  // 从缓存恢复（秒开）
  _loadFromCache() {
    const cached = wx.getStorageSync('noteCache');
    if (!cached) return;
    if (cached.stickyNotes) this.setData({ stickyNotes: cached.stickyNotes });
    if (cached.anniversaries) this.setData({ anniversaries: cached.anniversaries });
    if (cached.quickEntries) this.setData({ quickEntries: cached.quickEntries });
    if (cached.hobbies) this.setData({ hobbies: cached.hobbies });
    this._calcCountdown();
  },

  // 后台静默刷新（不显示 loading）
  _refreshSilently() {
    if (this._refreshing) return;
    this._refreshing = true;
    this._loadAllData(false).finally(() => { this._refreshing = false; });
  },

  // 加载全部数据：firstLoad = true 时显示 loading
  _loadAllData(firstLoad) {
    if (firstLoad) wx.showLoading({ title: '加载中...', mask: false });

    return Promise.all([
      cloud.getStickyNotes(),
      cloud.getAnniversaries(),
      cloud.getQuickEntries(),
      cloud.getHobbies()
    ]).then(([notesRes, annivRes, quickRes, hobbiesRes]) => {
      const stickyNotes = (notesRes.data || []).map(note => {
        const date = new Date(note.createTime);
        const timeStr = String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        return { id: note._id, color: note.color, text: note.text, time: timeStr };
      });

      const anniversaries = annivRes.data || [];
      const quickEntries = quickRes.data || [];
      const hobbies = (hobbiesRes.data || []).map(hobby => hobby.name);

      const data = {
        stickyNotes: stickyNotes.length > 0 ? stickyNotes : this._defaultStickyNotes(),
        anniversaries: anniversaries.length > 0 ? anniversaries : this._defaultAnniversaries(),
        quickEntries: quickEntries.length > 0 ? quickEntries : this._defaultQuickEntries(),
        hobbies: hobbies.length > 0 ? hobbies : this._defaultHobbies()
      };

      // 写入缓存
      wx.setStorageSync('noteCache', data);

      this.setData(data);
      this._calcCountdown();
      if (firstLoad) wx.hideLoading();
    }).catch(err => {
      console.error('加载数据失败:', err);
      if (firstLoad) wx.hideLoading();
      // 有缓存就用缓存
      this._loadFromCache();
      // 缓存也没有就用默认值
      if (!this.data.stickyNotes.length) {
        this.setData({
          stickyNotes: this._defaultStickyNotes(),
          anniversaries: this._defaultAnniversaries(),
          quickEntries: this._defaultQuickEntries(),
          hobbies: this._defaultHobbies()
        });
        this._calcCountdown();
      }
    });
  },

  // 加载情侣100件事进度
  _loadCoupleThingsProgress() {
    cloud.getCoupleThingsProgress().then(res => {
      const completedCount = (res.data || []).filter(item => item.completed).length;
      this.setData({ coupleThingsDone: completedCount });
    }).catch(() => {
      this.setData({ coupleThingsDone: 0 });
    });
  },

  _defaultStickyNotes() {
    return [
      { id: 'demo1', color: '#FFF9C4', text: '周末一起去吃那家新开的日料！', time: '03-30' },
      { id: 'demo2', color: '#F8BBD0', text: '记得给妈妈买生日蛋糕🎂', time: '03-28' },
      { id: 'demo3', color: '#C8E6C9', text: '下周三下午3点看牙医', time: '03-27' }
    ];
  },

  _defaultAnniversaries() {
    return [
      { name: '生日', date: '2026-05-15', icon: '🎂' },
      { name: '在一起1000天', date: '2026-08-20', icon: '💕' },
      { name: '纪念日', date: '2026-07-07', icon: '🌹' }
    ];
  },

  _defaultQuickEntries() {
    return [
      { icon: '🌸', name: '健康记录', page: '/pages/period/period' },
      { icon: '🗒️', name: '备忘录', page: '/pages/memo/memo' },
      { icon: '⏰', name: '提醒设置', page: '' },
      { icon: '🔒', name: '私密空间', page: '/pages/secret/secret' },
      { icon: '💝', name: '我的爱好', page: '' },
      { icon: '🎯', name: '小目标', page: '/pages/goals/goals' }
    ];
  },

  _defaultHobbies() {
    return ['📚 阅读', '🏃 跑步', '🎮 游戏', '🎵 音乐', '🍳 烘焙'];
  },

  // 计算倒数天数
  _calcCountdown() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const anniversaries = this.data.anniversaries;
    if (!anniversaries || anniversaries.length === 0) return;
    const countdownList = anniversaries.map(item => {
      const target = new Date(item.date);
      target.setHours(0, 0, 0, 0);
      let diff = target - now;
      let days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days < 0) {
        while (days < 0) {
          target.setFullYear(target.getFullYear() + 1);
          diff = target - now;
          days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
      }
      return { ...item, days };
    });
    countdownList.sort((a, b) => a.days - b.days);
    this.setData({ countdownList });
  },

  // ========== 纪念日管理 ==========
  toggleAddAnniversary() {
    this.setData({ showAddAnniversary: !this.data.showAddAnniversary, newAnnName: '', newAnnDate: '' });
  },
  onAnnNameInput(e) { this.setData({ newAnnName: e.detail.value }); },
  onAnnDateChange(e) { this.setData({ newAnnDate: e.detail.value }); },
  selectAnnIcon() {
    const icons = ['🎂', '💕', '🌹', '🎉', '💍', '🏠', '✈️', '🎂', '🎁', '🌸', '⭐', '🎊'];
    wx.showActionSheet({ itemList: icons, success: (res) => { this.setData({ newAnnIcon: icons[res.tapIndex] }); } });
  },
  addAnniversary() {
    const { newAnnName, newAnnDate, newAnnIcon } = this.data;
    if (!newAnnName.trim() || !newAnnDate) { wx.showToast({ title: '请填写名称和日期', icon: 'none' }); return; }
    wx.showLoading({ title: '添加中...' });
    cloud.addAnniversary({ name: newAnnName.trim(), date: newAnnDate, icon: newAnnIcon }).then(() => {
      wx.hideLoading();
      this._loadAllData(false);
      this.setData({ showAddAnniversary: false, newAnnName: '', newAnnDate: '' });
      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('添加纪念日失败:', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  deleteAnniversary(item) {
    if (!item) return;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个纪念日吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          if (item._id) {
            cloud.deleteAnniversary(item._id).then(() => {
              this._loadAllData(false);
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
            }).catch(err => {
              wx.hideLoading();
              console.error('删除失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
          } else {
            const anniversaries = this.data.anniversaries.filter(a => !(a.name === item.name && a.date === item.date));
            this.setData({ anniversaries }, () => {
              this._calcCountdown();
              wx.setStorageSync('noteCache', Object.assign(wx.getStorageSync('noteCache') || {}, { anniversaries }));
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
            });
          }
        }
      }
    });
  },

  onAnniversaryLongPress(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.countdownList[index];
    if (item) this.deleteAnniversary(item);
  },

  onCoupleThingsTap() {
    wx.navigateTo({ url: '/pages/couple_things/couple_things' });
  },

  // ========== 便利贴 ==========
  toggleAddNote() {
    this.setData({ showAddNote: !this.data.showAddNote, noteText: '' });
  },
  onNoteInput(e) { this.setData({ noteText: e.detail.value }); },

  addNote() {
    const text = this.data.noteText.trim();
    if (!text) return;
    const colors = ['#FFF9C4', '#F8BBD0', '#C8E6C9', '#BBDEFB', '#D1C4E9', '#FFE0B2'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    wx.showLoading({ title: '添加中...' });
    cloud.addStickyNote({ text, color }).then(() => {
      this._loadAllData(false);
      wx.hideLoading();
      this.setData({ showAddNote: false, noteText: '' });
      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('添加便利贴失败:', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  deleteNote(e) {
    const id = e.currentTarget.dataset.id;
    if (id.startsWith('demo')) {
      const notes = this.data.stickyNotes.filter(n => n.id !== id);
      this.setData({ stickyNotes: notes });
      wx.setStorageSync('noteCache', Object.assign(wx.getStorageSync('noteCache') || {}, { stickyNotes: notes }));
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个便利贴吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          cloud.deleteStickyNote(id).then(() => {
            this._loadAllData(false);
            wx.hideLoading();
            wx.showToast({ title: '删除成功', icon: 'success' });
          }).catch(err => {
            wx.hideLoading();
            console.error('删除便利贴失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // ========== 快捷入口 ==========
  onQuickTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.quickEntries[index];
    if (item.page) {
      wx.navigateTo({ url: item.page, fail: () => { wx.showToast({ title: item.name + ' 开发中', icon: 'none' }); } });
    } else {
      wx.showToast({ title: item.name + ' 开发中', icon: 'none' });
    }
  },
  toggleAddQuick() {
    this.setData({ showAddQuick: !this.data.showAddQuick, newQuickName: '' });
  },
  onQuickNameInput(e) { this.setData({ newQuickName: e.detail.value }); },
  addQuickEntry() {
    const { newQuickName, newQuickIcon } = this.data;
    if (!newQuickName.trim()) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    wx.showLoading({ title: '添加中...' });
    cloud.addQuickEntry({ icon: newQuickIcon, name: newQuickName.trim(), page: '' }).then(() => {
      this._loadAllData(false);
      wx.hideLoading();
      this.setData({ showAddQuick: false, newQuickName: '' });
      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('添加快捷入口失败:', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  deleteQuickEntry(e) {
    const index = e.currentTarget.dataset.index;
    const entry = this.data.quickEntries[index];
    if (!entry._id) return;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个快捷入口吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          cloud.deleteQuickEntry(entry._id).then(() => {
            this._loadAllData(false);
            wx.hideLoading();
            wx.showToast({ title: '删除成功', icon: 'success' });
          }).catch(err => {
            wx.hideLoading();
            console.error('删除快捷入口失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // ========== 爱好管理 ==========
  toggleAddHobby() {
    this.setData({ showAddHobby: !this.data.showAddHobby, newHobby: '' });
  },
  onHobbyInput(e) { this.setData({ newHobby: e.detail.value }); },
  addHobby() {
    const { newHobby } = this.data;
    if (!newHobby.trim()) { wx.showToast({ title: '请输入爱好', icon: 'none' }); return; }
    wx.showLoading({ title: '添加中...' });
    cloud.addHobby({ name: '💡 ' + newHobby.trim() }).then(() => {
      this._loadAllData(false);
      wx.hideLoading();
      this.setData({ showAddHobby: false, newHobby: '' });
      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('添加爱好失败:', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  deleteHobby(e) {
    const index = e.currentTarget.dataset.index;
    const hobbyName = this.data.hobbies[index];
    wx.showLoading({ title: '删除中...' });
    cloud.getHobbies().then(res => {
      const hobby = (res.data || []).find(h => h.name === hobbyName);
      if (hobby && hobby._id) return cloud.deleteHobby(hobby._id);
      throw new Error('找不到该爱好');
    }).then(() => {
      this._loadAllData(false);
      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('删除爱好失败:', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    });
  }
})
