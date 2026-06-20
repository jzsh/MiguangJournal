// pages/album/album.js
const cloud = require('../../utils/cloud');

Page({
  data: {
    photos: [],
    viewMode: 'grid',
    maxCount: 99,
    swiperImages: []
  },

  _loaded: false,

  onLoad() {
    this._loadPhotos();
    this._loaded = true;
  },

  onShow() {
    const tb = this.getTabBar()
    if (tb) tb.setData({ selected: 2 })

    // 避免重复加载：首次加载后直接用缓存
    if (this._loaded) {
      this._loadPhotosCached();
      return;
    }
    this._loadPhotos();
    this._loaded = true;
  },

  // 缓存版（秒开）：从 storage 读，后台静默刷新
  _loadPhotosCached() {
    const cached = wx.getStorageSync('albumCache');
    if (cached && cached.photos && cached.photos.length > 0) {
      this.setData({ photos: cached.photos, swiperImages: cached.swiperImages || [] });
    }
    // 后台静默刷新
    this._fetchAndCache(true);
  },

  // 全量加载（首次或强制刷新时调用）
  _loadPhotos() {
    this._fetchAndCache(false);
  },

  // 核心：拉取数据 + 缓存
  _fetchAndCache(silent) {
    const db = wx.cloud.database();
    const _ = db.command;

    // 1. photos 集合：只取需要的字段
    const fetchPhotos = db.collection('photos')
      .field({ fileID: true, date: true })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
      .catch(() => ({ data: [] }));

    // 2. diaries：只取图片相关字段（大幅减少数据传输）
    const fetchAllDiaries = async () => {
      const all = [];
      const ps = 20;
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await db.collection('diaries')
          .field({ coverImage: true, images: true, date: true, title: true })
          .orderBy('createdAt', 'desc')
          .skip(page * ps)
          .limit(ps)
          .get()
          .catch(() => ({ data: [] }));
        const data = res.data || [];
        all.push(...data);
        hasMore = data.length >= ps;
        page++;
        if (page > 50) break;
      }
      return { data: all };
    };

    Promise.all([fetchPhotos, fetchAllDiaries()])
      .then(([photosRes, diariesRes]) => this._buildPhotos(photosRes, diariesRes, silent))
      .catch(err => {
        console.error('[album] 加载失败:', err);
        if (!silent) {
          const cached = wx.getStorageSync('albumCache');
          if (cached && cached.photos) {
            this.setData({ photos: cached.photos, swiperImages: cached.swiperImages || [] });
          }
        }
      });
  },

  _buildPhotos(photosRes, diariesRes, silent) {
    const allPhotos = [];

    // photos 集合
    (photosRes.data || []).forEach(item => {
      allPhotos.push({
        _id: item._id,
        fileID: item.fileID,
        src: item.fileID,
        date: item.date || '',
        source: 'album',
        sourceId: item._id
      });
    });

    // diaries 图片（封面 + images，去重）
    const seen = new Set(allPhotos.map(p => p.fileID));
    (diariesRes.data || []).forEach(diary => {
      const d = diary.date || '';
      const push = (fid, tag) => {
        if (fid && fid.startsWith('cloud://') && !seen.has(fid)) {
          seen.add(fid);
          allPhotos.push({
            _id: tag,
            fileID: fid, src: fid,
            date: d, source: 'diary',
            sourceId: diary._id,
            diaryTitle: diary.title || ''
          });
        }
      };
      push(diary.coverImage, 'diary_cover_' + diary._id);
      (diary.images || []).forEach((img, i) => push(img, 'diary_img_' + diary._id + '_' + i));
    });

    allPhotos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 云链接转临时 HTTP
    const cloudFiles = allPhotos.map(p => p.fileID).filter(s => s && s.startsWith('cloud://'));
    const convert = cloudFiles.length > 0
      ? cloud.getTempFileURLs(cloudFiles).then(tmp => {
          const map = {};
          cloudFiles.forEach((f, i) => { map[f] = tmp[i]; });
          allPhotos.forEach(p => { if (map[p.src]) p.src = map[p.src]; });
        })
      : Promise.resolve();

    convert.then(() => {
      const swiper = allPhotos.slice(0, 5).map(p => p.src);
      const photos = allPhotos;

      // 写入缓存（带时间戳，避免过期缓存永远用不到新的）
      wx.setStorageSync('albumCache', { photos, swiperImages: swiper, ts: Date.now() });

      if (!silent || !this.data.photos.length) {
        this.setData({ photos, swiperImages: swiper });
      }
    });
  },

  switchMode(e) {
    this.setData({ viewMode: e.currentTarget.dataset.mode });
  },

  // 上传图片到云存储
  async uploadPhotos() {
    const remaining = this.data.maxCount - this.data.photos.length;
    if (remaining <= 0) {
      wx.showToast({ title: '相册已满', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remaining > 9 ? 9 : remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['original', 'compressed'],
      success: async (res) => {
        wx.showLoading({ title: '上传中...', mask: true });
        try {
          const filePaths = res.tempFiles.map(f => f.tempFilePath);
          const uploadResults = await cloud.uploadImages(filePaths);
          const today = new Date().toLocaleDateString();
          for (const result of uploadResults) {
            await cloud.addPhoto(result.fileID, today);
          }
          wx.showToast({ title: '上传成功', icon: 'success' });
          // 上传后强制刷新并更新缓存
          this._loadPhotos();
        } catch (err) {
          console.error('上传失败:', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.photos.map(p => p.src)
    });
  },

  deletePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photo = this.data.photos[index];
    if (!photo) return;

    const isFromDiary = photo.source === 'diary';
    wx.showModal({
      title: isFromDiary ? '隐藏照片' : '确认删除',
      content: isFromDiary
        ? '这张图片来自日记，只能从相册中隐藏，不会删除原图。确定隐藏吗？'
        : '确定要删除这张照片吗？删除后不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          if (isFromDiary) {
            const photos = this.data.photos.filter((_, i) => i !== index);
            const swiperImages = photos.slice(0, 5).map(p => p.src);
            this.setData({ photos, swiperImages });
            wx.setStorageSync('albumCache', { photos, swiperImages, ts: Date.now() });
            wx.showToast({ title: '已从相册隐藏', icon: 'none' });
          } else {
            if (photo.fileID && photo.fileID.startsWith('cloud://')) {
              await cloud.deleteFile(photo.fileID);
            }
            if (photo._id) {
              await cloud.deletePhoto(photo._id);
            }
            wx.showToast({ title: '已删除', icon: 'none' });
            this._loadPhotos();
          }
        } catch (err) {
          console.error('删除失败:', err);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  onLongPress(e) {
    this.deletePhoto(e);
  }
})
