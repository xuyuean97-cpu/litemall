var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');
var app = getApp();

Page({
  data: {
    isVip: false,
    vipInfo: {
      authTime: ''
    }
  },

  onLoad: function(options) {
    this.checkVipStatus();
  },

  onShow: function() {
    this.checkVipStatus();
  },

  // 检查VIP状态
  checkVipStatus: function() {
    let that = this;
    util.request(api.VipStatus).then(function(res) {
      if (res.errno === 0) {
        that.setData({
          isVip: res.data.isVip,
          vipInfo: {
            authTime: res.data.authTime || ''
          }
        });
      }
    }).catch(function(err) {
      that.setData({
        isVip: false
      });
    });
  },

  // 开始认证（发起支付）
  startAuth: function() {
    let that = this;
    
    // 先检查是否已登录
    if (!app.globalData.hasLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(function() {
        wx.navigateTo({
          url: '/pages/auth/login/login'
        });
      }, 1500);
      return;
    }

    // 已是VIP
    if (this.data.isVip) {
      wx.showToast({
        title: '您已是认证会员',
        icon: 'success'
      });
      return;
    }

    wx.showLoading({
      title: '正在发起支付...',
      mask: true
    });

    // 调用VIP认证预支付接口
    util.request(api.VipAuthPrepay, {}, 'POST').then(function(res) {
      wx.hideLoading();
      
      if (res.errno === 0) {
        let payParam = res.data;
        // 调用微信支付
        wx.requestPayment({
          timeStamp: payParam.timeStamp,
          nonceStr: payParam.nonceStr,
          package: payParam.packageValue,
          signType: payParam.signType || 'MD5',
          paySign: payParam.paySign,
          success: function(res) {
            // 支付成功，刷新VIP状态
            that.checkVipStatus();
            wx.showToast({
              title: '认证成功',
              icon: 'success',
              duration: 2000
            });
          },
          fail: function(res) {
            if (res.errMsg === 'requestPayment:fail cancel') {
              wx.showToast({
                title: '已取消支付',
                icon: 'none'
              });
            } else {
              wx.showToast({
                title: '支付失败',
                icon: 'none'
              });
            }
          }
        });
      } else {
        wx.showToast({
          title: res.errmsg || '发起支付失败',
          icon: 'none'
        });
      }
    }).catch(function(err) {
      wx.hideLoading();
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
    });
  }
});
