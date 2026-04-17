const api = require('../../config/api.js');
const util = require('../../utils/util.js');

// 系统提示词 - 专注笔记本屏幕领域的客服助手
const SYSTEM_PROMPT = `你是一名专业的笔记本屏幕物料客服助手，服务于一家专业的笔记本屏幕维修物料采购平台。

你的职责：
1. 解答客户关于笔记本屏幕型号、规格、兼容性的问题
2. 帮助客户选择合适的屏幕（尺寸、面板类型、分辨率、刷新率、亮度等参数）
3. 解答售后、物流、质保等问题
4. 提供屏幕维修和更换的专业建议

注意事项：
- 回复简洁专业，不要过于冗长
- 如果不确定具体型号是否有货，建议客户通过商城搜索查询
- 遇到复杂售后问题，建议联系人工客服
- 使用中文回复`;

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
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: 'AI 屏幕助手' });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendQuickQuestion(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.sendMessage();
  },

  sendMessage() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isLoading) return;

    const counter = this.data.messageIdCounter + 1;
    const userMsg = {
      id: 'msg-' + counter,
      role: 'user',
      content: text,
    };

    const aiMsgId = 'msg-' + (counter + 1);
    const aiMsg = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      isTyping: true,
    };

    this.setData({
      messages: [...this.data.messages, userMsg, aiMsg],
      inputText: '',
      isLoading: true,
      messageIdCounter: counter + 1,
      scrollTarget: '',
    });

    // 滚动到底部
    setTimeout(() => {
      this.setData({ scrollTarget: 'chat-bottom' });
    }, 100);

    // 构建历史消息（不含当前正在打字的 AI 消息）
    const history = this.data.messages
      .filter(m => !m.isTyping)
      .map(m => ({ role: m.role, content: m.content }));

    // 调用 AI 接口
    this._callAiApi(history, aiMsgId);
  },

  _callAiApi(history, aiMsgId) {
    const that = this;

    // 尝试使用后端 AI 接口，如失败则使用本地规则回复
    util.request(api.AiChatUrl || '/api/ai/chat', {
      messages: history,
      systemPrompt: SYSTEM_PROMPT,
    }, 'POST').then(res => {
      if (res && res.errno === 0 && res.data && res.data.reply) {
        that._updateAiMessage(aiMsgId, res.data.reply);
      } else {
        // 后端接口暂不可用时，使用本地规则回复
        that._updateAiMessage(aiMsgId, that._getRuleBasedReply(history[history.length - 1].content));
      }
    }).catch(() => {
      that._updateAiMessage(aiMsgId, that._getRuleBasedReply(history[history.length - 1].content));
    });
  },

  _updateAiMessage(aiMsgId, reply) {
    const messages = this.data.messages.map(m => {
      if (m.id === aiMsgId) {
        return { ...m, content: reply, isTyping: false };
      }
      return m;
    });

    this.setData({
      messages,
      isLoading: false,
      scrollTarget: '',
    });

    setTimeout(() => {
      this.setData({ scrollTarget: 'chat-bottom' });
    }, 100);
  },

  // 本地规则回复（后端接口未接入时的兜底方案）
  _getRuleBasedReply(question) {
    const q = question.toLowerCase();

    if (q.includes('型号') || q.includes('兼容') || q.includes('适配')) {
      return '屏幕型号兼容性您可以在商城搜索栏输入屏幕编号（如 NV156FHM-N61）直接查询。如果找不到，可以提供您笔记本的品牌和型号，我帮您推荐合适的屏幕。';
    }
    if (q.includes('ips') || q.includes('tn') || q.includes('面板') || q.includes('类型')) {
      return 'IPS面板色彩还原准确、可视角度广（178°），适合追求显示质量的用户；TN面板响应速度快、价格低，适合对延迟要求高的场景；IPS是大多数维修场景的优选。';
    }
    if (q.includes('发货') || q.includes('物流') || q.includes('快递') || q.includes('运费')) {
      return '我们支持顺丰、京东快递。订单当日下午3点前完成付款，当日发货；3点后的订单次日发货。部分偏远地区可能需要额外运费，具体以下单时显示为准。';
    }
    if (q.includes('质保') || q.includes('保修') || q.includes('售后') || q.includes('退换')) {
      return '所有屏幕提供3个月质保，质保期内因产品质量问题可免费换货。人为损坏（如屏幕破碎、进液等）不在质保范围内。如需售后，请在"我的-订单"中申请售后服务。';
    }
    if (q.includes('分辨率') || q.includes('1080') || q.includes('2k') || q.includes('4k')) {
      return '主流笔记本屏幕分辨率：FHD（1920×1080）最常见、性价比高；QHD（2560×1440）细腻适合设计；UHD（3840×2160）最清晰但耗电量大。请确认您的笔记本显卡支持对应分辨率再选购。';
    }
    if (q.includes('刷新率') || q.includes('60hz') || q.includes('144hz') || q.includes('165hz')) {
      return '60Hz适合日常办公；144Hz/165Hz适合游戏场景，画面更流畅；更换高刷新率屏幕前请确认笔记本主板支持对应刷新率输出，否则无法发挥效果。';
    }
    if (q.includes('亮度') || q.includes('nit') || q.includes('暗')) {
      return '笔记本屏幕亮度通常在200-400nits，户外使用建议选择300nits以上；部分高端型号支持HDR，亮度可达500nits以上。如对亮度有特殊要求，可在筛选区选择对应亮度参数。';
    }
    if (q.includes('损坏') || q.includes('花屏') || q.includes('黑屏') || q.includes('漏液') || q.includes('碎')) {
      return '常见屏幕问题判断：\n· 花屏/闪烁 → 可能是屏幕线缆松动或屏幕本身损坏\n· 黑屏但有背光 → 屏幕本体损坏\n· 全黑无背光 → 可能是背光板或驱动板问题\n· 屏幕碎/漏液 → 需整屏更换\n建议拍照发给我们，专业判断后推荐合适的配件。';
    }
    if (q.includes('价格') || q.includes('多少钱') || q.includes('优惠') || q.includes('折扣')) {
      return '屏幕价格因型号不同差异较大，具体价格请在商城搜索对应型号查看。认证会员可享受批发价优惠，购买10次以上的老客户可享9折优惠。如需大批量采购，欢迎联系客服洽谈。';
    }

    return '感谢您的咨询！我主要负责解答笔记本屏幕选型、兼容性、规格参数和售后相关问题。您可以描述更多细节，或者从上方快捷问题中选择您想了解的内容。如需人工服务，请拨打客服热线。';
  },
});
