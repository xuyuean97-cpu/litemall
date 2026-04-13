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
function request(url, data = {}, method = "GET") {
  return new Promise(function(resolve, reject) {
    // 👇 微信云托管官方调用方式，替换原有 wx.request
    wx.cloud.callContainer({
      config: {
        env: 'prod-0gpcvux32519964c', 
      },
      // ======================================================
      path: url,          // 接口路径，原逻辑不动
      method: method,     // 请求方式，原逻辑不动
      data: data,         // 请求参数，原逻辑不动
      header: {
        'Content-Type': 'application/json',
        'X-Litemall-Token': wx.getStorageSync('token'),
        // ⚠️ 修改点 2：必须加上 X-WX-SERVICE 指定服务名！
        // 请确保 'litemall' 是你在云托管控制台创建的【服务名称】。如果是其他名字请修改。
        'X-WX-SERVICE': 'aocamity' 
      },
      success: function(res) {
        // 完全保留你原来的 501 登录失效逻辑
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