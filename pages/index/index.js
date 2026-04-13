const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({

  data: {
    banner: [],
    
    // 尺寸分类（包含id）
    sizeCategories: [],
    currentSizeId: 0,
    currentSizeName: '全部',
    sizeGoodsList: [],
    sizeGoodsPage: 1,
    sizeGoodsLoading: false,
    sizeGoodsFinished: false,

    // 面板类型分类（包含id）
    panelCategories: [],
    currentPanelId: 0,
    currentPanelName: '全部',
    panelGoodsList: [],
    panelGoodsPage: 1,
    panelGoodsLoading: false,
    panelGoodsFinished: false,

    // 品牌
    screenBrands: [],

    //分页
    page: 1,
    limit: 10,
    // 商品
    hotGoods: [],
    newGoods: [],
    floorGoods: [],
    goodsCount: 0
  },

  onLoad() {
    this.getIndexData();
    this.getCatalogData();
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
   * 尺寸筛选点击
   */
  onSizeFilter(e) {
    const { id, name } = e.currentTarget.dataset;
    
    // 点击"全部"则清空筛选结果
    if (id === 0) {
      this.setData({
        currentSizeId: 0,
        currentSizeName: '全部',
        sizeGoodsList: [],
        sizeGoodsPage: 1,
        sizeGoodsFinished: false
      });
      return;
    }

    // 点击具体分类
    this.setData({
      currentSizeId: id,
      currentSizeName: name,
      sizeGoodsList: [],
      sizeGoodsPage: 1,
      sizeGoodsFinished: false
    });
  
    this.getSizeGoods(true);
  },

  /**
   * 获取尺寸分类下的商品
   */
  getSizeGoods(reset = true) {
    if (this.data.sizeGoodsLoading || this.data.currentSizeId === 0) return;
    
    const { currentSizeId, sizeGoodsPage, limit } = this.data;
    
    this.setData({ sizeGoodsLoading: true });

    util.request(api.GoodsList, {
      categoryId: currentSizeId,
      page: sizeGoodsPage,
      limit
    }).then(res => {
      if (res.errno === 0) {
        let list = res.data.list || [];
        this.setData({
          sizeGoodsList: reset ? list : this.data.sizeGoodsList.concat(list),
          sizeGoodsFinished: list.length < limit,
          sizeGoodsLoading: false
        });
      } else {
        this.setData({ sizeGoodsLoading: false });
      }
    }).catch(err => {
      console.error('getSizeGoods error:', err);
      this.setData({ sizeGoodsLoading: false });
    });
  },

  /**
   * 加载更多尺寸商品
   */
  loadMoreSizeGoods() {
    if (this.data.sizeGoodsFinished || this.data.sizeGoodsLoading) return;
    
    this.setData({
      sizeGoodsPage: this.data.sizeGoodsPage + 1
    });
    
    this.getSizeGoods(false);
  },

  /**
   * 面板类型筛选点击
   */
  onPanelTypeFilter(e) {
    const { id, name } = e.currentTarget.dataset;

    // 点击"全部"则清空筛选结果
    if (id === 0) {
      this.setData({
        currentPanelId: 0,
        currentPanelName: '全部',
        panelGoodsList: [],
        panelGoodsPage: 1,
        panelGoodsFinished: false
      });
      return;
    }

    // 点击具体分类
    this.setData({
      currentPanelId: id,
      currentPanelName: name,
      panelGoodsList: [],
      panelGoodsPage: 1,
      panelGoodsFinished: false
    });

    this.getPanelGoods(true);
  },

  /**
   * 获取面板类型分类下的商品
   */
  getPanelGoods(reset = true) {
    if (this.data.panelGoodsLoading || this.data.currentPanelId === 0) return;
    
    const { currentPanelId, panelGoodsPage, limit } = this.data;
    
    this.setData({ panelGoodsLoading: true });

    util.request(api.GoodsList, {
      categoryId: currentPanelId,
      page: panelGoodsPage,
      limit
    }).then(res => {
      if (res.errno === 0) {
        let list = res.data.list || [];
        this.setData({
          panelGoodsList: reset ? list : this.data.panelGoodsList.concat(list),
          panelGoodsFinished: list.length < limit,
          panelGoodsLoading: false
        });
      } else {
        this.setData({ panelGoodsLoading: false });
      }
    }).catch(err => {
      console.error('getPanelGoods error:', err);
      this.setData({ panelGoodsLoading: false });
    });
  },

  /**
   * 加载更多面板商品
   */
  loadMorePanelGoods() {
    if (this.data.panelGoodsFinished || this.data.panelGoodsLoading) return;
    
    this.setData({
      panelGoodsPage: this.data.panelGoodsPage + 1
    });
    
    this.getPanelGoods(false);
  },

  /**
   * 查看更多尺寸商品（跳转分类页）
   */
  viewMoreSizeGoods() {
    if (this.data.currentSizeId > 0) {
      wx.navigateTo({
        url: '/pages/category/category?id=' + this.data.currentSizeId
      });
    }
  },

  /**
   * 查看更多面板商品（跳转分类页）
   */
  viewMorePanelGoods() {
    if (this.data.currentPanelId > 0) {
      wx.navigateTo({
        url: '/pages/category/category?id=' + this.data.currentPanelId
      });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    wx.showNavigationBarLoading();
  
    this.setData({
      sizeGoodsList: [],
      sizeGoodsPage: 1,
      panelGoodsList: [],
      panelGoodsPage: 1
    });
  
    Promise.all([
      this.getIndexData(),
      this.getCatalogData()
    ]).then(() => {
      // 如果有选中分类，��新加载
      if (this.data.currentSizeId > 0) {
        this.getSizeGoods(true);
      }
      if (this.data.currentPanelId > 0) {
        this.getPanelGoods(true);
      }
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
