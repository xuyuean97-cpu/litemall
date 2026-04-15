var api = require('../config/api.js');
var app = getApp();

function formatTime(date) {
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()

  var hour = date.getHours()
  var minute = date.getMinutes()
  var second = date.getSeconds()


  return [year, month, day].map(formatNumber).join('-') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

function formatNumber(n) {
  n = n.toString()
  return n[1] ? n : '0' + n
}

/**
 * 封封微信的的request
 */
/**
 * 封装微信的request
 * 兼容本地调试(wx.request)与线上云托管(wx.cloud.callContainer)
 */
function request(url, data = {}, method = "GET") {
  return new Promise(function(resolve, reject) {
    
    // 判断是否为本地 HTTP 请求
    // (在 config/api.js 中配置 http://localhost:8080... 会进入此分支)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      wx.request({
        url: url,
        method: method,
        data: data,
        header: {
          'Content-Type': 'application/json',
          'X-Litemall-Token': wx.getStorageSync('token')
        },
        success: function(res) {
          if (res.statusCode == 200) {
            if (res.data.errno == 501) {
              try {
                wx.removeStorageSync('userInfo');
                wx.removeStorageSync('token');
              } catch (e) {}
              wx.navigateTo({ url: '/pages/auth/login/login' });
            } else {
              resolve(res.data);
            }
          } else {
            reject(res.errMsg);
          }
        },
        fail: function(err) {
          reject(err);
        }
      });
      
    } else {
      // 👇 微信云托管官方调用方式 (线上环境使用)
      wx.cloud.callContainer({
        config: {
          env: 'prod-0gpcvux32519964c', 
        },
        path: url,          // 接口路径
        method: method,     // 请求方式
        data: data,         // 请求参数
        header: {
          'Content-Type': 'application/json',
          'X-Litemall-Token': wx.getStorageSync('token'),
          'X-WX-SERVICE': 'aocamity' // 你的云托管服务名
        },
        success: function(res) {
          if (res.statusCode == 200) {
            if (res.data.errno == 501) {
              try {
                wx.removeStorageSync('userInfo');
                wx.removeStorageSync('token');
              } catch (e) {}
              wx.navigateTo({ url: '/pages/auth/login/login' });
            } else {
              resolve(res.data);
            }
          } else {
            reject(res.errMsg);
          }
        },
        fail: function(err) {
          reject(err)
        }
      })
    }
    
  });
}

function redirect(url) {

  //判断页面是否需要登录
  if (false) {
    wx.redirectTo({
      url: '/pages/auth/login/login'
    });
    return false;
  } else {
    wx.redirectTo({
      url: url
    });
  }
}

function showErrorToast(msg) {
  wx.showToast({
    title: msg,
    image: '/static/images/icon_error.png'
  })
}

module.exports = {
  formatTime,
  request,
  redirect,
  showErrorToast
}