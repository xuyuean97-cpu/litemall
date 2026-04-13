const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({

  data: {
    banner: [],
    goodsList: [],
    // 分类筛选
    sizes: [],
    panelTypes: [],
    currentSize: '全部',
    currentPanelType: '全部',

    // 品牌
    screenBrands: [],

    //分页
    page: 1,
    limit: 10,
    // 商品
    hotGoods: [],
    newGoods: [],
    floorGoods: [],
    goodsCount: 0,
    isFiltering: false
  },

  onLoad() {
    this.getIndexData();
    this.getCatalogData();
    this.getGoodsList();
  },
  onReachBottom() {
    if (this.data.finished || this.data.loading) return;
  
    this.setData({
      page: this.data.page + 1
    });
  
    this.getGoodsList(false);
  },
  getGoodsList(reset = true) {
    if (this.data.loading) return;
  
    this.setData({ loading: true });
  
    const { currentSize, currentPanelType, page, limit } = this.data;
  
    let params = {
      page,
      limit
    };
  
    // 筛选参数
    if (currentSize !== '全部') {
      params.size = currentSize;
    }
  
    if (currentPanelType !== '全部') {
      params.panelType = currentPanelType;
    }
  
    util.request(api.GoodsList, params).then(res => {
      if (res.errno === 0) {
  
        let list = res.data.list || [];
  
        this.setData({
          goodsList: reset ? list : this.data.goodsList.concat(list),
          finished: list.length < limit,
          loading: false
        });
      }
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
   * 分类数据（来自 /catalog/all）
   */
  getCatalogData() {
    const that = this;
  
    util.request(api.CatalogList).then(res => {
      if (res.errno === 0) {
  
        const currentCategory = res.data.currentCategory;
        const subList = res.data.currentSubCategory || [];
  
        let sizes = ['全部'];
        let panelTypes = ['全部'];
  
        // 尺寸
        if (currentCategory.name.includes('尺寸')) {
          sizes = sizes.concat(subList.map(i => i.name));
        }
  
        // 面板（你现在没有这个分类）
        if (currentCategory.name.includes('面板')) {
          panelTypes = panelTypes.concat(subList.map(i => i.name));
        }
  
        // 去重
        sizes = [...new Set(sizes)];
  
        that.setData({
          sizes,
          panelTypes
        });
      }
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
    const size = e.currentTarget.dataset.size;
  
    this.setData({
      currentSize: size,
      page: 1,
      goodsList: [],
      isFiltering: size !== '全部'
    });
  
    this.getGoodsList(true);
  },

  /**
   * 面板筛选
   */
  onPanelTypeFilter(e) {
    const type = e.currentTarget.dataset.type;

    this.setData({
      currentPanelType: type
    });

    if (type !== '全部') {
      wx.navigateTo({
        url: '/pages/search/search?keyword=' + encodeURIComponent(type)
      });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    wx.showNavigationBarLoading();
  
    this.setData({
      page: 1,
      goodsList: []
    });
  
    Promise.all([
      this.getIndexData(),
      this.getCatalogData(),
      this.getGoodsList(true)
    ]).then(() => {
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