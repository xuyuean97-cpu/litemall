const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({

  data: {
    banner: [],
    
    // ================= 分类筛选数据 =================
    sizeCategories: [],      // 尺寸列表 [{id, name}]
    panelCategories: [],     // 面板类型列表 [{id, name}]
    resolutionCategories: [],// 分辨率列表 (预留)
    refreshRateCategories: [],// 刷新率列表 (预留)
    brightnessCategories: [], // 亮度列表 (预留)

    // ==== 选中的筛选ID (0表示未选中/全部)，对应后端新增的5个参数 ====
    currentSizeId: 0,        
    currentPanelId: 0,       
    currentResolutionId: 0,  
    currentRefreshRateId: 0, 
    currentBrightnessId: 0,  

    currentSizeName: '全部',
    currentPanelName: '全部',
    // ===============================================

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
    goodsCount: 0,
    isFilterExpanded: true,
  },

  toggleFilter() {
    this.setData({
      isFilterExpanded: !this.data.isFilterExpanded
    });
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
   * 获取商品列表 - 【核心修改：适配后端的5个独立维度参数】
   */
  getGoodsList(reset = true) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    // 提取所有的筛选参数
    const { 
      currentSizeId, currentPanelId, currentResolutionId, 
      currentRefreshRateId, currentBrightnessId, 
      page, limit 
    } = this.data;
    
    let params = {
      page: page,
      limit: limit
    };
    
    // === 关键：将前端状态精准映射到后端对应的独立参数 ===
    if (currentSizeId > 0) params.sizeId = currentSizeId;
    if (currentPanelId > 0) params.panelId = currentPanelId;
    if (currentResolutionId > 0) params.resolutionId = currentResolutionId;
    if (currentRefreshRateId > 0) params.refreshRateId = currentRefreshRateId;
    if (currentBrightnessId > 0) params.brightnessId = currentBrightnessId;
    
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
   * 首页数据 (保持原样)
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

    util.request(api.GoodsCount).then(res => {
      if (res.errno === 0) {
        that.setData({ goodsCount: res.data });
      }
    });
  },

  /**
   * 分类数据 (保持原样)
   */
  getCatalogData() {
    const that = this;
    
    // 注意：这里建议你改成之前提到的新接口，或者用你现有的全量分类接口
    util.request(api.CatalogFilterList).then(res => {
      if (res.errno === 0) {
        const categoryList = res.data.categoryList || [];
        const subCategoryList = res.data.currentSubCategory || []; 

        let sizeCategories = [{ id: 0, name: '全部' }];
        let panelCategories = [{ id: 0, name: '全部' }];
        let resolutionCategories = [{ id: 0, name: '全部' }];
        let refreshRateCategories = [{ id: 0, name: '全部' }];
        let brightnessCategories = [{ id: 0, name: '全部' }];

        // 1. 解析尺寸
        const sizeParent = categoryList.find(c => c.name && c.name.includes('尺寸'));
        if (sizeParent) {
          const sizes = subCategoryList.filter(sub => sub.pid === sizeParent.id);
          sizeCategories = sizeCategories.concat(sizes.map(sub => ({ id: sub.id, name: sub.name })));
        }

        // 2. 解析面板
        const panelParent = categoryList.find(c => 
          (c.name && (c.name.includes('面板') || c.name.includes('屏幕类型'))) || 
          (c.keywords && c.keywords.includes('面板'))
        );
        if (panelParent) {
          const panels = subCategoryList.filter(sub => sub.pid === panelParent.id);
          panelCategories = panelCategories.concat(panels.map(sub => ({ id: sub.id, name: sub.name })));
        }

        // 3. 解析分辨率
        const resParent = categoryList.find(c => c.name && c.name.includes('分辨率'));
        if (resParent) {
          const resolutions = subCategoryList.filter(sub => sub.pid === resParent.id);
          resolutionCategories = resolutionCategories.concat(resolutions.map(sub => ({ id: sub.id, name: sub.name })));
        }

        // 4. 解析刷新率
        const refParent = categoryList.find(c => c.name && c.name.includes('刷新率'));
        if (refParent) {
          const refreshRates = subCategoryList.filter(sub => sub.pid === refParent.id);
          refreshRateCategories = refreshRateCategories.concat(refreshRates.map(sub => ({ id: sub.id, name: sub.name })));
        }

        // 5. 解析亮度
        const briParent = categoryList.find(c => c.name && c.name.includes('亮度'));
        if (briParent) {
          const brightnesses = subCategoryList.filter(sub => sub.pid === briParent.id);
          brightnessCategories = brightnessCategories.concat(brightnesses.map(sub => ({ id: sub.id, name: sub.name })));
        }

        that.setData({ 
          sizeCategories, 
          panelCategories,
          resolutionCategories,
          refreshRateCategories,
          brightnessCategories
        });
      }
    }).catch(err => {
      console.error('getCatalogData error:', err);
    });
  },

  getRandomColor() {
    const colors = ['#e8f4ff', '#f0fdf4', '#fef3c7', '#fce7f3', '#e0e7ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * 尺寸筛选 - 【修改：加入反选功能】
   */
  onSizeFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name;
    
    // 如果点击的已经是当前选中的状态，则取消选中(设为0)
    const isSelected = (this.data.currentSizeId === id);
    
    this.setData({
      currentSizeId: isSelected ? 0 : id,
      currentSizeName: isSelected ? '全部' : name,
      page: 1, // 重置页码
      goodsList: [],
      finished: false
    });
    
    this.getGoodsList(true);
  },

  /**
   * 面板类型筛选 - 【修改：加入反选功能】
   */
  onPanelTypeFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name;

    const isSelected = (this.data.currentPanelId === id);

    this.setData({
      currentPanelId: isSelected ? 0 : id,
      currentPanelName: isSelected ? '全部' : name,
      page: 1,
      goodsList: [],
      finished: false
    });

    this.getGoodsList(true);
  },
  onResolutionFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const isSelected = (this.data.currentResolutionId === id);

    this.setData({
      currentResolutionId: isSelected ? 0 : id,
      page: 1,
      goodsList: [],
      finished: false
    });

    this.getGoodsList(true);
  },

  /**
   * 刷新率筛选
   */
  onRefreshRateFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const isSelected = (this.data.currentRefreshRateId === id);

    this.setData({
      currentRefreshRateId: isSelected ? 0 : id,
      page: 1,
      goodsList: [],
      finished: false
    });

    this.getGoodsList(true);
  },

  /**
   * 亮度筛选
   */
  onBrightnessFilter(e) {
    const id = Number(e.currentTarget.dataset.id);
    const isSelected = (this.data.currentBrightnessId === id);

    this.setData({
      currentBrightnessId: isSelected ? 0 : id,
      page: 1,
      goodsList: [],
      finished: false
    });

    this.getGoodsList(true);
  },
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

  onShareAppMessage() {
    return {
      title: '笔记本屏幕商城',
      path: '/pages/index/index'
    };
  }

});