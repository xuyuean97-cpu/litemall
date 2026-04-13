const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({

  data: {
    banner: [],
    
    // 分类筛选 - 存储分类对象（包含id和name）
    sizeCategories: [],      // 尺寸分类列表 [{id, name}]
    panelCategories: [],     // 面板类型分类列表 [{id, name}]
    currentSizeId: 0,        // 当前选中的尺寸分类ID，0表示全部
    currentPanelId: 0,       // 当前选中的面板分类ID，0表示全部
    currentSizeName: '全部',
    currentPanelName: '全部',

    // 筛选商品列表（统一列表）
    goodsList: [],
    page: 1,
    limit: 10,
    loading: false,
    finished: false,

    // 品牌
    screenBrands: [],

    // 其他商品
    hotGoods: [],
    newGoods: [],
    floorGoods: [],
    goodsCount: 0
  },

  onLoad() {
    this.getIndexData();
    this.getCatalogData();
    this.getGoodsList(true);
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading) return;
    
    this.setData({
      page: this.data.page + 1
    });
    
    this.getGoodsList(false);
  },

  /**
   * 获取商品列表 - 根据分类ID筛选
   */
  getGoodsList(reset = true) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    const { currentSizeId, currentPanelId, page, limit } = this.data;
    
    let params = {
      page,
      limit
    };
    
    // 使用分类ID进行筛选（优先尺寸，其次面板）
    if (currentSizeId > 0) {
      params.categoryId = currentSizeId;
    } else if (currentPanelId > 0) {
      params.categoryId = currentPanelId;
    }
    
    util.request(api.GoodsList, params).then(res => {
      if (res.errno === 0) {
        let list = res.data.list || [];
        
        this.setData({
          goodsList: reset ? list : this.data.goodsList.concat(list),
          finished: list.length < limit,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('getGoodsList error:', err);
      this.setData({ loading: false });
    });
  },

  /**
   * 首页数据
   */
  getIndexData() {
    const that = this;

    util.request(api.IndexUrl).then(res => {
      if (res.errno === 0) {

        // 品牌处理（支持logo）
        const brands = (res.data.brandList || []).map(item => {
          const match = item.name?.match(/\((.*?)\)/);

          return {
            ...item,
            abbr: match ? match[1] : item.name?.substring(0, 2),
            bgColor: that.getRandomColor()
          };
        });

        // 热销商品处理
        const hotGoods = (res.data.hotGoodsList || []).map(item => ({
          ...item,
          hasTierPrice: item.tierPrice?.length > 0,
          stock: item.stock || 0
        }));

        that.setData({
          banner: res.data.banner || [],
          screenBrands: brands,
          hotGoods,
          newGoods: res.data.newGoodsList || [],
          floorGoods: res.data.floorGoodsList || []
        });
      }
    });

    // 商品总数
    util.request(api.GoodsCount).then(res => {
      if (res.errno === 0) {
        that.setData({
          goodsCount: res.data
        });
      }
    });
  },

  /**
   * 分类数据 - 获取尺寸和面板类型的分类列表（带ID）
   */
  getCatalogData() {
    const that = this;
    
    util.request(api.CatalogList).then(res => {
      if (res.errno === 0) {
        const categoryList = res.data.categoryList || [];
        
        // 查找"按尺寸"分类
        const sizeParent = categoryList.find(c => c.name && c.name.includes('尺寸'));
        let sizeCategories = [{ id: 0, name: '全部' }];
        if (sizeParent && sizeParent.subCategoryList) {
          sizeCategories = sizeCategories.concat(sizeParent.subCategoryList.map(sub => ({
            id: sub.id,
            name: sub.name
          })));
        }

        // 查找"面板类型"分类
        const panelParent = categoryList.find(c => c.name && c.name.includes('面板'));
        let panelCategories = [{ id: 0, name: '全部' }];
        if (panelParent && panelParent.subCategoryList) {
          panelCategories = panelCategories.concat(panelParent.subCategoryList.map(sub => ({
            id: sub.id,
            name: sub.name
          })));
        }

        that.setData({
          sizeCategories,
          panelCategories
        });
      }
    }).catch(err => {
      console.error('getCatalogData error:', err);
    });
  },

  /**
   * 随机颜色（品牌UI）
   */
  getRandomColor() {
    const colors = ['#e8f4ff', '#f0fdf4', '#fef3c7', '#fce7f3', '#e0e7ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * 尺寸筛选
   */
  onSizeFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name;
    
    this.setData({
      currentSizeId: id,
      currentSizeName: name,
      page: 1,
      goodsList: [],
      finished: false
    });
    
    this.getGoodsList(true);
  },

  /**
   * 面板类型筛选
   */
  onPanelTypeFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name;

    this.setData({
      currentPanelId: id,
      currentPanelName: name,
      page: 1,
      goodsList: [],
      finished: false
    });

    this.getGoodsList(true);
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    wx.showNavigationBarLoading();
    
    this.setData({
      page: 1,
      goodsList: [],
      finished: false
    });
    
    Promise.all([
      this.getIndexData(),
      this.getCatalogData()
    ]).then(() => {
      this.getGoodsList(true);
      wx.hideNavigationBarLoading();
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '笔记本屏幕商城',
      path: '/pages/index/index'
    };
  }

});
