const api = require('../../config/api.js');
const util = require('../../utils/util.js');

Page({
  data: {
    messages: [],
    inputText: '',
    isLoading: false,
    scrollTarget: 'chat-bottom',
    messageIdCounter: 0,
    quickQuestions: [
      '如何查询屏幕型号兼容性？',
      'IPS和TN面板有什么区别？',
      '支持哪些发货方式？',
      '质保政策是怎样的？',
      '如何判断屏幕是否损坏？',
    ],
    // WebSocket 相关
    socketConnected: false,
    threadId: '',
    userId: '',
    // 图片相关
    selectedImage: '',
    selectedImageBase64: '',
    // 当前 AI 消息 ID（用于流式更新）
    currentAiMsgId: '',
    // 建议问题（从 end 事件获取）
    suggestions: [],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: 'AI 屏幕助手' });
    // 生成会话 ID
    this.setData({
      threadId: 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      userId: wx.getStorageSync('userId') || 'guest_' + Date.now(),
    });
    // 连接 WebSocket
    this._connectWebSocket();
  },

  onUnload() {
    // 页面卸载时关闭 WebSocket
    this._closeWebSocket();
  },

  onShow() {
    // 页面显示时检查连接状态
    if (!this.data.socketConnected) {
      this._connectWebSocket();
    }
  },

  // ==================== WebSocket 管理 ====================

  _connectWebSocket() {
    const that = this;

    // 关闭现有连接
    this._closeWebSocket();

    this.socketTask = wx.connectSocket({
      url: api.AiChatWs,
      success() {
        console.log('[v0] WebSocket 连接请求已发送');
      },
      fail(err) {
        console.log('[v0] WebSocket 连接失败', err);
        that.setData({ socketConnected: false });
      }
    });

    this.socketTask.onOpen(() => {
      console.log('[v0] WebSocket 连接已打开');
      that.setData({ socketConnected: true });
    });

    this.socketTask.onMessage((res) => {
      that._handleSocketMessage(res.data);
    });

    this.socketTask.onError((err) => {
      console.log('[v0] WebSocket 错误', err);
      that.setData({ socketConnected: false });
    });

    this.socketTask.onClose(() => {
      console.log('[v0] WebSocket 连接已关闭');
      that.setData({ socketConnected: false });
    });
  },

  _closeWebSocket() {
    if (this.socketTask) {
      this.socketTask.close();
      this.socketTask = null;
    }
  },

  // ==================== 消息处理 ====================

  _handleSocketMessage(data) {
    try {
      const msg = JSON.parse(data);
      const event = msg.event;
      const eventData = msg.data;

      console.log('[v0] 收到事件:', event, eventData);

      switch (event) {
        case 'start':
          // 开始事件，可以显示加载状态
          break;

        case 'text':
          this._handleTextEvent(eventData);
          break;

        case 'rich_content':
          this._handleRichContentEvent(eventData);
          break;

        case 'form':
          this._handleFormEvent(eventData);
          break;

        case 'flight_list':
          this._handleListEvent(eventData);
          break;

        case 'transfer_to_human':
          this._handleTransferEvent(eventData);
          break;

        case 'end':
          this._handleEndEvent(eventData);
          break;

        case 'error':
          this._handleErrorEvent(eventData);
          break;

        default:
          console.log('[v0] 未知事件类型:', event);
      }
    } catch (e) {
      console.log('[v0] 解析消息失败', e);
    }
  },

  // 处理文本事件
  _handleTextEvent(eventData) {
    const content = eventData.content;
    const text = content.text || '';

    // 更新或创建 AI 消息
    this._appendAiContent({
      type: 'text',
      text: text,
      format: content.format || 'plain'
    });
  },

  // 处理富文本事件（含图片）
  _handleRichContentEvent(eventData) {
    const content = eventData.content;
    const images = content.images || [];

    this._appendAiContent({
      type: 'rich_content',
      text: content.text || '',
      format: content.format || 'plain',
      images: images.map(img => ({
        id: img.id,
        data: img.data,
        alt: img.alt_text || '',
        description: img.description || ''
      })),
      layout: content.layout || 'text_first'
    });
  },

  // 处理表单事件
  _handleFormEvent(eventData) {
    const content = eventData.content;

    this._appendAiContent({
      type: 'form',
      formId: content.form_id,
      title: content.title,
      description: content.description,
      action: content.action,
      fields: content.fields || [],
      buttons: content.buttons || []
    });
  },

  // 处理列表事件（商品/航班等）
  _handleListEvent(eventData) {
    const content = eventData.content;

    this._appendAiContent({
      type: 'list',
      title: content.title,
      items: content.flights || content.data || [],
      actionHint: content.action_hint
    });
  },

  // 处理转人工事件
  _handleTransferEvent(eventData) {
    const content = eventData.content;

    this._appendAiContent({
      type: 'transfer',
      text: content.text || '正在为您转接人工客服...'
    });

    // 可以在这里调用微信客服
    wx.showModal({
      title: '转接人工客服',
      content: '是否立即联系人工客服？',
      success: (res) => {
        if (res.confirm) {
          // 可以跳转到微信客服或拨打电话
          wx.makePhoneCall({
            phoneNumber: '400-xxx-xxxx',
            fail: () => {}
          });
        }
      }
    });
  },

  // 处理结束事件
  _handleEndEvent(eventData) {
    const content = eventData.content;
    const suggestions = content.suggestions || [];

    // 更新建议问题
    if (suggestions.length > 0) {
      this.setData({ suggestions });
    }

    // 结束加载状态
    this._finishAiMessage();
  },

  // 处理错误事件
  _handleErrorEvent(eventData) {
    const content = eventData.content;
    const errorMsg = content.error_message || '服务暂时不可用';

    this._appendAiContent({
      type: 'error',
      text: errorMsg,
      errorCode: content.error_code
    });

    this._finishAiMessage();

    wx.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2000
    });
  },

  // 追加 AI 内容到当前消息
  _appendAiContent(contentItem) {
    const messages = [...this.data.messages];
    const aiMsgIndex = messages.findIndex(m => m.id === this.data.currentAiMsgId);

    if (aiMsgIndex !== -1) {
      const aiMsg = messages[aiMsgIndex];
      // 追加内容块
      if (!aiMsg.contents) {
        aiMsg.contents = [];
      }
      aiMsg.contents.push(contentItem);
      aiMsg.isTyping = false;

      this.setData({
        messages,
        scrollTarget: ''
      });

      setTimeout(() => {
        this.setData({ scrollTarget: 'chat-bottom' });
      }, 100);
    }
  },

  // 结束 AI 消息
  _finishAiMessage() {
    const messages = this.data.messages.map(m => {
      if (m.id === this.data.currentAiMsgId) {
        return { ...m, isTyping: false };
      }
      return m;
    });

    this.setData({
      messages,
      isLoading: false,
      currentAiMsgId: ''
    });
  },

  // ==================== 用户交互 ====================

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendQuickQuestion(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.sendMessage();
  },

  // 选择图片
  chooseImage() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFile = res.tempFiles[0];
        const tempPath = tempFile.tempFilePath;

        that.setData({ selectedImage: tempPath });

        // 转换为 base64
        wx.getFileSystemManager().readFile({
          filePath: tempPath,
          encoding: 'base64',
          success(fileRes) {
            // 获取文件扩展名
            const ext = tempPath.split('.').pop().toLowerCase();
            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
            const base64Data = `data:${mimeType};base64,${fileRes.data}`;
            that.setData({ selectedImageBase64: base64Data });
          },
          fail(err) {
            console.log('[v0] 读取图片失败', err);
            wx.showToast({ title: '图片处理失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 移除选中图片
  removeImage() {
    this.setData({
      selectedImage: '',
      selectedImageBase64: ''
    });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({
        current: url,
        urls: [url]
      });
    }
  },

  // 发送消息
  sendMessage() {
    const text = this.data.inputText.trim();
    const image = this.data.selectedImageBase64;

    // 必须有文本或图片
    if ((!text && !image) || this.data.isLoading) return;

    const counter = this.data.messageIdCounter + 1;

    // 创建用户消息
    const userMsg = {
      id: 'msg-' + counter,
      role: 'user',
      contents: [],
    };

    if (text) {
      userMsg.contents.push({ type: 'text', text: text });
    }
    if (image) {
      userMsg.contents.push({ type: 'image', data: image, localPath: this.data.selectedImage });
    }

    // 创建 AI 消息占位
    const aiMsgId = 'msg-' + (counter + 1);
    const aiMsg = {
      id: aiMsgId,
      role: 'assistant',
      contents: [],
      isTyping: true,
    };

    this.setData({
      messages: [...this.data.messages, userMsg, aiMsg],
      inputText: '',
      selectedImage: '',
      selectedImageBase64: '',
      isLoading: true,
      messageIdCounter: counter + 1,
      currentAiMsgId: aiMsgId,
      scrollTarget: '',
    });

    setTimeout(() => {
      this.setData({ scrollTarget: 'chat-bottom' });
    }, 100);

    // 发送 WebSocket 消息
    this._sendSocketMessage(text, image);
  },

  // 发送 WebSocket 消息
  _sendSocketMessage(query, imageData) {
    if (!this.socketTask || !this.data.socketConnected) {
      // WebSocket 未连接，尝试重连
      this._connectWebSocket();
      wx.showToast({ title: '正在连接服务器...', icon: 'loading' });

      // 延迟重试
      setTimeout(() => {
        if (this.data.socketConnected) {
          this._sendSocketMessage(query, imageData);
        } else {
          this._handleOfflineMode(query);
        }
      }, 2000);
      return;
    }

    const token = wx.getStorageSync('token') || '';

    const message = {
      thread_id: this.data.threadId,
      user_id: this.data.userId,
      query: query,
      image: imageData || null,
      token: token,
      metadata: {
        Is_translate: false,
        Is_emotion: false,
        query_source: '小程序',
        query_device: '手机',
        query_ip: '',
        network_type: this._getNetworkType()
      }
    };

    this.socketTask.send({
      data: JSON.stringify(message),
      success: () => {
        console.log('[v0] WebSocket 消息已发送');
      },
      fail: (err) => {
        console.log('[v0] WebSocket 发送失败', err);
        this._handleOfflineMode(query);
      }
    });
  },

  // 获取网络类型
  _getNetworkType() {
    let networkType = '4g';
    wx.getNetworkType({
      success(res) {
        networkType = res.networkType;
      }
    });
    return networkType;
  },

  // 离线模式（使用本地规则回复）
  _handleOfflineMode(query) {
    const reply = this._getRuleBasedReply(query);

    this._appendAiContent({
      type: 'text',
      text: reply,
      format: 'plain'
    });

    this._finishAiMessage();
  },

  // 表单提交
  submitForm(e) {
    const formId = e.currentTarget.dataset.formid;
    const formData = e.detail.value;

    console.log('[v0] 提交表单', formId, formData);

    // 发送表单数据到服务器
    wx.showLoading({ title: '提交中...' });

    // 这里可以调用实际的表单提交接口
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });
    }, 1000);
  },

  // 点击列表项
  tapListItem(e) {
    const item = e.currentTarget.dataset.item;
    console.log('[v0] 点击列表项', item);

    // 根据业务需求处理点击事件
    if (item.goods_id) {
      // 跳转商品详情
      wx.navigateTo({
        url: '/pages/goods/goods?id=' + item.goods_id
      });
    }
  },

  // ==================== 本地规则回复（兜底） ====================

  _getRuleBasedReply(question) {
    const q = (question || '').toLowerCase();

    if (q.includes('型号') || q.includes('兼容') || q.includes('适配')) {
      return '屏幕型号兼容性您可以在商城搜索栏输入屏幕编号（如 NV156FHM-N61）直接查询。如果找不到，可以提供您笔记本的品牌和型号，我帮您推荐合适的屏幕。';
    }
    if (q.includes('ips') || q.includes('tn') || q.includes('面板') || q.includes('类型')) {
      return 'IPS面板色彩还原准确、可视角度广（178度），适合追求显示质量的用户；TN面板响应速度快、价格低，适合对延迟要求高的场景；IPS是大多数维修场景的优选。';
    }
    if (q.includes('发货') || q.includes('物流') || q.includes('快递') || q.includes('运费')) {
      return '我们支持顺丰、京东快递。订单当日下午3点前完成付款，当日发货；3点后的订单次日发货。部分偏远地区可能需要额外运费，具体以下单时显示为准。';
    }
    if (q.includes('质保') || q.includes('保修') || q.includes('售后') || q.includes('退换')) {
      return '所有屏幕提供3个月质保，质保期内因产品质量问题可免费换货。人为损坏（如屏幕破碎、进液等）不在质保范围内。如需售后，请在"我的-订单"中申请售后服务。';
    }
    if (q.includes('分辨率') || q.includes('1080') || q.includes('2k') || q.includes('4k')) {
      return '主流笔记本屏幕分辨率：FHD（1920x1080）最常见、性价比高；QHD（2560x1440）细腻适合设计；UHD（3840x2160）最清晰但耗电量大。请确认您的笔记本显卡支持对应分辨率再选购。';
    }
    if (q.includes('刷新率') || q.includes('60hz') || q.includes('144hz') || q.includes('165hz')) {
      return '60Hz适合日常办公；144Hz/165Hz适合游戏场景，画面更流畅；更换高刷新率屏幕前请确认笔记本主板支持对应刷新率输出，否则无法发挥效果。';
    }
    if (q.includes('亮度') || q.includes('nit') || q.includes('暗')) {
      return '笔记本屏幕亮度通常在200-400nits，户外使用建议选择300nits以上；部分高端型号支持HDR，亮度可达500nits以上。如对亮度有特殊要求，可在筛选区选择对应亮度参数。';
    }
    if (q.includes('损坏') || q.includes('花屏') || q.includes('黑屏') || q.includes('漏液') || q.includes('碎')) {
      return '常见屏幕问题判断：\n- 花屏/闪烁：可能是屏幕线缆松动或屏幕本身损坏\n- 黑屏但有背光：屏幕本体损坏\n- 全黑无背光：可能是背光板或驱动板问题\n- 屏幕碎/漏液：需整屏更换\n建议拍照发给我们，专业判断后推荐合适的配件。';
    }
    if (q.includes('价格') || q.includes('多少钱') || q.includes('优惠') || q.includes('折扣')) {
      return '屏幕价格因型号不同差异较大，具体价格请在商城搜索对应型号查看。认证会员可享受批发价优惠，购买10次以上的老客户可享9折优惠。如需大批量采购，欢迎联系客服洽谈。';
    }

    return '感谢您的咨询！我主要负责解答笔记本屏幕选型、兼容性、规格参数和售后相关问题。您可以描述更多细节，或者从上方快捷问题中选择您想了解的内容。如需人工服务，请点击下方"转人工"按钮。';
  },

  // 转人工客服
  transferToHuman() {
    wx.showActionSheet({
      itemList: ['拨打客服电话', '在线客服'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({
            phoneNumber: '400-xxx-xxxx',
            fail: () => {}
          });
        } else {
          // 可以跳转到微信客服会话
          wx.showToast({ title: '正在接入人工客服...', icon: 'loading' });
        }
      }
    });
  }
});
