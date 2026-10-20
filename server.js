const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const cliPort = process.argv[2] ? parseInt(process.argv[2], 10) : null;
let PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3999);
const DATA_DIR = path.join(__dirname, 'data');

// Load Data
function loadJson(filename, defaultVal = []) {
  try {
    const file = path.join(DATA_DIR, filename);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Error loading ${filename}:`, err);
  }
  return defaultVal;
}

function saveJson(filename, data) {
  try {
    const file = path.join(DATA_DIR, filename);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error saving ${filename}:`, err);
    return false;
  }
}

const zodiacHelper = require('./public/js/zodiac.js');

let squizzQuestions = loadJson('squizz_questions.json');
let qaQuestions = loadJson('qa_questions.json');
let membersList = loadJson('members.json');
let yihetangMenu = loadJson('yihetang_menu.json', { categories: [], options: {} });
let orders2010 = loadJson('orders_2010.json', {});

function get2010Status() {
  const members = membersList.map(m => {
    const entry = orders2010[String(m.stt)] || orders2010[String(m.ms)] || {};
    return {
      stt: String(m.stt),
      ms: String(m.ms || m.fingerprint || ''),
      name: m.name || '',
      role: m.role || '',
      dob: m.dob || '',
      avatar: m.avatar || '🌸',
      wish: m.wish || '',
      hasOpenedCard: !!entry.hasOpenedCard,
      openedAt: entry.openedAt || null,
      hasOrdered: !!entry.hasOrdered,
      orderedAt: entry.orderedAt || null,
      order: entry.order || null
    };
  });

  const openedCount = members.filter(m => m.hasOpenedCard).length;
  const orderedCount = members.filter(m => m.hasOrdered).length;
  const unopenedCount = members.length - openedCount;

  // Aggregate summary
  const summaryMap = {};
  members.forEach(m => {
    if (m.hasOrdered && m.order) {
      const o = m.order;
      const key = o.drinkName || 'Món khác';
      if (!summaryMap[key]) {
        summaryMap[key] = {
          drinkName: o.drinkName,
          category: o.category || '',
          totalCount: 0,
          sizeM: 0,
          sizeL: 0,
          toppings: {},
          notes: []
        };
      }
      summaryMap[key].totalCount++;
      if (o.size === 'L') summaryMap[key].sizeL++;
      else summaryMap[key].sizeM++;

      if (Array.isArray(o.toppings)) {
        o.toppings.forEach(top => {
          summaryMap[key].toppings[top] = (summaryMap[key].toppings[top] || 0) + 1;
        });
      }
      if (o.note && o.note.trim()) {
        summaryMap[key].notes.push(`${m.name}: ${o.note.trim()}`);
      }
    }
  });

  return {
    members,
    stats: {
      totalMembers: members.length,
      openedCount,
      orderedCount,
      unopenedCount
    },
    summary: summaryMap,
    menu: yihetangMenu
  };
}

// Get local IPv4 address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        // Prioritize Wi-Fi or Ethernet
        const isWifi = devName.toLowerCase().includes('wi-fi') || devName.toLowerCase().includes('wireless');
        const isEthernet = devName.toLowerCase().includes('ethernet');
        candidates.push({ address: alias.address, isWifi, isEthernet, devName });
      }
    }
  }
  if (candidates.length > 0) {
    // Prefer wifi if available, otherwise ethernet
    const best = candidates.find(c => c.isWifi) || candidates.find(c => c.isEthernet) || candidates[0];
    return best.address;
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIp();

const { spawn } = require('child_process');
let publicTunnelUrl = null;
let cloudflaredProc = null;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints
app.get('/api/info', async (req, res) => {
  const host = req.headers.host || `${LOCAL_IP}:${PORT}`;
  const protocol = req.protocol || 'http';
  // If Cloudflare tunnel is active, prioritize tunnel URL
  const joinUrl = publicTunnelUrl ? `${publicTunnelUrl}/player.html` : `${protocol}://${host}/player.html`;
  
  let qrCodeData = '';
  try {
    qrCodeData = await QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch (e) {
    console.error('QR Gen error:', e);
  }

  res.json({
    localIp: LOCAL_IP,
    port: PORT,
    joinUrl,
    qrCodeData,
    isTunnel: !!publicTunnelUrl,
    tunnelUrl: publicTunnelUrl,
    squizzCount: squizzQuestions.length,
    qaCount: qaQuestions.length,
    memberCount: membersList.length
  });
});

app.get('/api/members', (req, res) => {
  res.json(membersList);
});

app.post('/api/members', (req, res) => {
  if (Array.isArray(req.body)) {
    membersList = req.body;
    saveJson('members.json', membersList);
    io.emit('members_updated', membersList);
    return res.json({ success: true, count: membersList.length });
  }
  res.status(400).json({ error: 'Expected array of member names' });
});

app.post('/api/members/update', (req, res) => {
  const { stt, dob, fingerprint, role, name } = req.body;
  const member = membersList.find(m => String(m.stt) === String(stt));
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (dob !== undefined) member.dob = dob.trim();
  if (fingerprint !== undefined) member.fingerprint = String(fingerprint).trim();
  if (role !== undefined) member.role = role.trim();
  if (name !== undefined) member.name = name.trim();
  saveJson('members.json', membersList);
  io.emit('members_updated', membersList);
  res.json({ success: true, member });
});

app.post('/api/members/reload_excel', (req, res) => {
  try {
    const xlsx = require('xlsx');
    const excelPath = path.join(__dirname, 'Team Building TCKT.xlsx');
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: 'Không tìm thấy file Team Building TCKT.xlsx' });
    }
    const wb = xlsx.readFile(excelPath);
    const sheetName = wb.SheetNames.includes('Danh sách tham gia') ? 'Danh sách tham gia' : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const raw = xlsx.utils.sheet_to_json(sheet, { raw: false });

    function formatDob(val) {
      if (!val) return '';
      const s = String(val).trim();
      const parts = s.split(/[\/\-]/);
      if (parts.length === 3) {
        let [d, m, y] = parts;
        if (d.length === 1) d = '0' + d;
        if (m.length === 1) m = '0' + m;
        if (y.length === 2) y = (parseInt(y, 10) > 30 ? '19' : '20') + y;
        return d + '/' + m + '/' + y;
      }
      return s;
    }

    const members = raw.map((r, i) => {
      const name = (r['Họ và Tên'] || r['Họ và tên'] || r['name'] || '').trim();
      const role = (r['Chức danh'] || r['role'] || '').trim();
      let ms = r['Mã vân tay'] || r['Mã số'] || r['MS'] || r['ms'] ? String(r['Mã vân tay'] || r['Mã số'] || r['MS'] || r['ms']).trim() : '';
      if (!ms && name.toLowerCase().includes('hồ quỳnh trang')) ms = '6248';
      const dob = formatDob(r['Ngày tháng năm sinh'] || r['dob']);

      const existing = membersList.find(m => m.name.toLowerCase() === name.toLowerCase() || String(m.ms) === String(ms));
      return {
        stt: String(i + 1),
        ms: ms || String(i + 1),
        fingerprint: ms || String(i + 1),
        name: name || `Thành viên ${i + 1}`,
        role: role,
        dob: dob,
        avatar: existing && existing.avatar ? existing.avatar : '🌸',
        wish: existing && existing.wish ? existing.wish : `Chúc ${name} ngày 20/10 ngập tràn niềm vui, xinh đẹp, hạnh phúc và luôn thành công trong công việc!`
      };
    });

    if (members.length > 0) {
      membersList = members;
      saveJson('members.json', membersList);
      io.emit('members_updated', membersList);
      io.emit('2010_update', get2010Status());
      return res.json({ success: true, count: membersList.length, members: membersList });
    }
    res.status(400).json({ error: 'Không tìm thấy dòng dữ liệu nào trong sheet' });
  } catch (err) {
    console.error('Error reloading excel:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20/10 GREETINGS & YIHETANG ORDER API
// ==========================================
app.get('/api/2010/status', (req, res) => {
  res.json(get2010Status());
});

app.get('/api/2010/menu', (req, res) => {
  res.json(yihetangMenu);
});

app.post('/api/2010/open-card', (req, res) => {
  const { memberId, ms } = req.body;
  const member = membersList.find(m => String(m.stt) === String(memberId) || (ms && String(m.ms) === String(ms)));
  if (!member) {
    return res.status(404).json({ error: 'Không tìm thấy thành viên trong danh sách' });
  }

  if (!orders2010[member.stt]) {
    orders2010[member.stt] = {
      memberId: member.stt,
      ms: member.ms || member.fingerprint,
      name: member.name,
      role: member.role,
      hasOpenedCard: false,
      openedAt: null,
      hasOrdered: false,
      orderedAt: null,
      order: null
    };
  }

  if (!orders2010[member.stt].hasOpenedCard) {
    orders2010[member.stt].hasOpenedCard = true;
    orders2010[member.stt].openedAt = new Date().toISOString();
    saveJson('orders_2010.json', orders2010);
  }

  const updatedStatus = get2010Status();
  io.emit('2010_update', updatedStatus);
  io.emit('2010_card_opened', {
    memberId: member.stt,
    ms: member.ms,
    name: member.name,
    role: member.role,
    avatar: member.avatar,
    openedAt: orders2010[member.stt].openedAt
  });

  res.json({
    success: true,
    member,
    orderData: orders2010[member.stt]
  });
});

app.post('/api/2010/order', (req, res) => {
  const { memberId, ms, order } = req.body;
  const member = membersList.find(m => String(m.stt) === String(memberId) || (ms && String(m.ms) === String(ms)));
  if (!member) {
    return res.status(404).json({ error: 'Không tìm thấy thành viên' });
  }

  if (!order || !order.drinkName) {
    return res.status(400).json({ error: 'Vui lòng chọn món trà sữa hợp lệ' });
  }

  if (!orders2010[member.stt]) {
    orders2010[member.stt] = {
      memberId: member.stt,
      ms: member.ms || member.fingerprint,
      name: member.name,
      role: member.role
    };
  }

  orders2010[member.stt].hasOpenedCard = true;
  if (!orders2010[member.stt].openedAt) {
    orders2010[member.stt].openedAt = new Date().toISOString();
  }
  orders2010[member.stt].hasOrdered = true;
  orders2010[member.stt].orderedAt = new Date().toISOString();
  orders2010[member.stt].order = {
    drinkId: order.drinkId || '',
    drinkName: order.drinkName,
    category: order.category || '',
    size: order.size || 'M',
    sugar: order.sugar || '100% (Chuẩn)',
    ice: order.ice || '100% (Chuẩn)',
    toppings: Array.isArray(order.toppings) ? order.toppings : [],
    note: order.note ? String(order.note).trim() : ''
  };

  saveJson('orders_2010.json', orders2010);

  const updatedStatus = get2010Status();
  io.emit('2010_update', updatedStatus);
  io.emit('2010_order_placed', {
    memberId: member.stt,
    ms: member.ms,
    name: member.name,
    role: member.role,
    avatar: member.avatar,
    order: orders2010[member.stt].order,
    orderedAt: orders2010[member.stt].orderedAt
  });

  res.json({
    success: true,
    orderData: orders2010[member.stt]
  });
});

app.post('/api/2010/reset-order', (req, res) => {
  const { memberId } = req.body;
  if (memberId && orders2010[String(memberId)]) {
    orders2010[String(memberId)].hasOrdered = false;
    orders2010[String(memberId)].order = null;
    orders2010[String(memberId)].orderedAt = null;
    saveJson('orders_2010.json', orders2010);
    io.emit('2010_update', get2010Status());
  }
  res.json({ success: true });
});

app.get('/api/2010/export-excel', (req, res) => {
  try {
    const XLSX = require('xlsx');
    const statusData = get2010Status();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Chi tiết từng người
    const detailHeaders = [
      'STT',
      'Mã số (MS)',
      'Họ và Tên',
      'Chức danh',
      'Trạng thái',
      'Món đã chọn',
      'Size',
      'Lượng đường',
      'Lượng đá',
      'Topping',
      'Ghi chú',
      'Thời gian mở thiệp',
      'Thời gian đặt hàng'
    ];

    const detailRows = statusData.members.map(m => {
      let statusStr = 'Chưa mở thiệp';
      if (m.hasOrdered) statusStr = 'Đã đặt món';
      else if (m.hasOpenedCard) statusStr = 'Đã mở thiệp';

      const o = m.order || {};
      const formatTime = (iso) => {
        if (!iso) return '';
        try {
          const d = new Date(iso);
          return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN');
        } catch (e) {
          return iso;
        }
      };

      return [
        m.stt,
        m.ms,
        m.name,
        m.role,
        statusStr,
        o.drinkName || '',
        o.size || '',
        o.sugar || '',
        o.ice || '',
        Array.isArray(o.toppings) ? o.toppings.join(', ') : '',
        o.note || '',
        formatTime(m.openedAt),
        formatTime(m.orderedAt)
      ];
    });

    const ws1 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    ws1['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
      { wch: 32 },
      { wch: 8 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 30 },
      { wch: 20 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Chi tiết Order 20-10');

    // Sheet 2: Tổng hợp gom đơn đặt quán
    const summaryHeaders = [
      'STT',
      'Tên Món Trà Sữa Yi He Tang',
      'Size M',
      'Size L',
      'Tổng Số Ly',
      'Chi tiết Topping kèm theo',
      'Ghi chú của thành viên'
    ];

    const summaryRows = [];
    let idx = 1;
    let grandTotal = 0;
    let grandM = 0;
    let grandL = 0;

    for (const key in statusData.summary) {
      const item = statusData.summary[key];
      const topStr = Object.entries(item.toppings).map(([t, c]) => `${t} (x${c})`).join('; ');
      const noteStr = item.notes.join(' | ');
      summaryRows.push([
        idx++,
        item.drinkName,
        item.sizeM,
        item.sizeL,
        item.totalCount,
        topStr,
        noteStr
      ]);
      grandTotal += item.totalCount;
      grandM += item.sizeM;
      grandL += item.sizeL;
    }

    summaryRows.push([
      'TỔNG',
      'TỔNG CỘNG TẤT CẢ CÁC MÓN',
      grandM,
      grandL,
      grandTotal,
      '',
      ''
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    ws2['!cols'] = [
      { wch: 6 },
      { wch: 36 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 40 },
      { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Tổng hợp Đặt Quán');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Danh_Sach_Order_Yihetang_2010_TCKT.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Lỗi xuất file excel: ' + err.message });
  }
});

app.get('/api/questions/squizz', (req, res) => {
  res.json(squizzQuestions);
});

app.post('/api/questions/squizz', (req, res) => {
  if (Array.isArray(req.body)) {
    squizzQuestions = req.body;
    saveJson('squizz_questions.json', squizzQuestions);
    return res.json({ success: true, count: squizzQuestions.length });
  }
  res.status(400).json({ error: 'Invalid format' });
});

app.post('/api/questions/squizz/add', (req, res) => {
  const q = req.body;
  if (!q || !q.question) return res.status(400).json({ error: 'Question content is required' });
  const newId = squizzQuestions.length > 0 ? Math.max(...squizzQuestions.map(item => item.id || 0)) + 1 : 1;
  const newQ = {
    id: newId,
    // Quy tắc Bộ 1: Bắt buộc là bình chọn thành viên trong chuyến đi (VOTE_MEMBER)
    type: 'VOTE_MEMBER',
    effectTheme: q.effectTheme || 'royal-gold',
    icon: q.icon || '🎯',
    title: q.title || `Câu hỏi ${newId}`,
    question: q.question.trim(),
    target: q.target || 'Bình chọn đồng nghiệp trong chuyến đi',
    mcVoice: q.mcVoice || 'Xin chúc mừng đồng chí được anh em bình chọn nhiều nhất!',
    punishment: q.punishment || 'Uống 1 chén danh dự! 🍻',
    timeLimit: parseInt(q.timeLimit, 10) || 30
  };
  squizzQuestions.push(newQ);
  saveJson('squizz_questions.json', squizzQuestions);
  io.emit('questions_updated', { type: 'squizz', count: squizzQuestions.length, question: newQ });
  res.json({ success: true, question: newQ, total: squizzQuestions.length });
});

app.post('/api/questions/squizz/delete', (req, res) => {
  const { index, id } = req.body;
  let targetIdx = -1;
  if (typeof index === 'number' && index >= 0 && index < squizzQuestions.length) {
    targetIdx = index;
  } else if (id !== undefined) {
    targetIdx = squizzQuestions.findIndex(q => q.id === id);
  }
  if (targetIdx >= 0) {
    squizzQuestions.splice(targetIdx, 1);
    saveJson('squizz_questions.json', squizzQuestions);
    io.emit('questions_updated', { type: 'squizz', count: squizzQuestions.length });
    return res.json({ success: true, count: squizzQuestions.length });
  }
  res.status(400).json({ error: 'Không tìm thấy câu hỏi để xóa' });
});

app.get('/api/questions/qa', (req, res) => {
  res.json(qaQuestions);
});

app.post('/api/questions/qa', (req, res) => {
  if (Array.isArray(req.body)) {
    qaQuestions = req.body;
    saveJson('qa_questions.json', qaQuestions);
    return res.json({ success: true, count: qaQuestions.length });
  }
  res.status(400).json({ error: 'Invalid format' });
});

app.post('/api/questions/qa/add', (req, res) => {
  const q = req.body;
  if (!q || !q.question) return res.status(400).json({ error: 'Question content is required' });
  const newId = qaQuestions.length > 0 ? Math.max(...qaQuestions.map(item => item.id || 0)) + 1 : 1;
  
  const opts = Array.isArray(q.options) && q.options.length === 4
    ? q.options.map((opt, i) => String(opt || `Đáp án ${String.fromCharCode(65 + i)}`).trim())
    : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'];

  let correct = parseInt(q.correctAnswer, 10);
  if (isNaN(correct) || correct < 0 || correct > 3) correct = 0;

  const newQ = {
    id: newId,
    // Quy tắc Bộ 2: Bắt buộc là câu hỏi trắc nghiệm 4 đáp án (MULTIPLE_CHOICE)
    type: 'MULTIPLE_CHOICE',
    category: q.category || 'Đố vui Team Building',
    icon: q.icon || '❓',
    question: q.question.trim(),
    options: opts,
    correctAnswer: correct,
    explanation: q.explanation || 'Đáp án chính xác!',
    timeLimit: parseInt(q.timeLimit, 10) || 15
  };
  qaQuestions.push(newQ);
  saveJson('qa_questions.json', qaQuestions);
  io.emit('questions_updated', { type: 'qa', count: qaQuestions.length, question: newQ });
  res.json({ success: true, question: newQ, total: qaQuestions.length });
});

app.post('/api/questions/qa/delete', (req, res) => {
  const { index, id } = req.body;
  let targetIdx = -1;
  if (typeof index === 'number' && index >= 0 && index < qaQuestions.length) {
    targetIdx = index;
  } else if (id !== undefined) {
    targetIdx = qaQuestions.findIndex(q => q.id === id);
  }
  if (targetIdx >= 0) {
    qaQuestions.splice(targetIdx, 1);
    saveJson('qa_questions.json', qaQuestions);
    io.emit('questions_updated', { type: 'qa', count: qaQuestions.length });
    return res.json({ success: true, count: qaQuestions.length });
  }
  res.status(400).json({ error: 'Không tìm thấy câu hỏi để xóa' });
});

// GAME ENGINE STATE
const gameState = {
  mode: 'LOBBY', // 'LOBBY', 'SQUIZZ', 'QA'
  players: new Map(), // playerId -> { id, nickname, avatar, score, squizzVotes: {}, qaAnswers: {}, connected: true, hasJoined: true, socketId }
  
  // SQUIZZ state
  squizz: {
    currentIndex: 0,
    isOpen: false,
    isRevealed: false,
    isPaused: false,
    startTime: 0,
    timeLimit: 30, // 30s mặc định hoặc 0 cho thủ công
    timeRemaining: 30,
    timer: null,
    votes: {}, // playerId -> normalizedName
    rawVotes: {} // playerId -> rawName
  },

  // QA state
  qa: {
    currentIndex: 0,
    isOpen: false,
    isRevealed: false,
    startTime: 0,
    timeLimit: 15, // 15s tự động đếm ngược & công bố
    timeRemaining: 15,
    timer: null,
    autoReveal: true, // Admin có thể bật / tắt tự động công bố
    isPaused: false,
    answers: {} // playerId -> { optionIndex, isCorrect, points, timeTakenMs }
  }
};

function getConnectedPlayers() {
  const list = [];
  gameState.players.forEach(p => {
    if (p.connected) {
      list.push({
        id: p.id,
        memberId: p.memberId,
        nickname: p.nickname,
        role: '',
        avatar: p.avatar,
        score: p.score,
        dob: p.dob,
        zodiacInfo: p.zodiacInfo
      });
    }
  });
  return list;
}

function getMemberActivationStatus() {
  // Thành viên được tính là ĐÃ VÀO TIỆC khi đã check-in (hasJoined = true hoặc đang online)
  const activatedMemberIds = new Set();
  const playerByMemberId = new Map();

  gameState.players.forEach(p => {
    if (p.memberId && (p.hasJoined || p.connected)) {
      activatedMemberIds.add(String(p.memberId));
      playerByMemberId.set(String(p.memberId), p);
    }
  });

  const activatedMembers = [];
  const missingMembers = [];

  membersList.forEach(m => {
    const isAct = activatedMemberIds.has(String(m.stt));
    const p = playerByMemberId.get(String(m.stt));
    const obj = {
      stt: m.stt,
      name: m.name,
      role: '',
      avatar: p ? (p.avatar || '😎') : '😎',
      score: p ? p.score : 0,
      connected: p ? !!p.connected : false,
      dob: m.dob || '',
      fingerprint: m.fingerprint || '',
      zodiacInfo: m.dob ? zodiacHelper.getZodiacDetails(m.dob) : null
    };
    if (isAct) {
      activatedMembers.push(obj);
    } else {
      missingMembers.push(obj);
    }
  });

  return {
    totalMembers: membersList.length,
    activatedCount: activatedMembers.length,
    missingCount: missingMembers.length,
    activatedMembers,
    missingMembers
  };
}

function broadcastPlayerList() {
  const players = getConnectedPlayers();
  const activation = getMemberActivationStatus();
  io.emit('player_list_updated', {
    players,
    total: activation.activatedCount, // Luôn gửi số người đã vào tiệc chính xác, không bị rớt khi tắt màn hình
    onlineCount: players.length,
    activation
  });
}

function normalizeName(str) {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function capitalizeWords(str) {
  if (!str) return '';
  return str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function calculateSquizzTally() {
  const currentQ = squizzQuestions[gameState.squizz.currentIndex];
  const isTextQuestion = currentQ && currentQ.type === 'OPEN_TEXT';

  const counts = {};
  const displayNames = {};
  const votersMap = {};
  const responses = [];

  Object.entries(gameState.squizz.votes).forEach(([playerId, normName]) => {
    if (!normName) return;
    counts[normName] = (counts[normName] || 0) + 1;
    const player = gameState.players.get(playerId);
    const voterNick = player ? player.nickname : 'Ẩn danh';
    if (!votersMap[normName]) votersMap[normName] = [];
    votersMap[normName].push(voterNick);

    const raw = gameState.squizz.rawVotes[playerId];
    if (!displayNames[normName]) {
      displayNames[normName] = isTextQuestion ? raw : capitalizeWords(raw || normName);
    }
    responses.push({
      id: playerId,
      text: raw,
      voter: voterNick,
      avatar: player ? player.avatar : '😎'
    });
  });

  const tallyList = Object.keys(counts).map(normName => ({
    name: displayNames[normName],
    normalized: normName,
    count: counts[normName],
    voters: votersMap[normName]
  })).sort((a, b) => b.count - a.count);

  const totalVotes = Object.keys(gameState.squizz.votes).length;
  const winner = tallyList.length > 0 ? tallyList[0] : null;

  return { tallyList, totalVotes, winner, responses, isTextQuestion };
}

function calculateQaStats() {
  const currentQ = qaQuestions[gameState.qa.currentIndex];
  if (!currentQ) return { optionCounts: [0, 0, 0, 0], totalAnswered: 0, correctCount: 0 };

  const counts = [0, 0, 0, 0];
  let correctCount = 0;
  let totalAnswered = 0;

  Object.values(gameState.qa.answers).forEach(ans => {
    totalAnswered++;
    if (ans.optionIndex >= 0 && ans.optionIndex < 4) {
      counts[ans.optionIndex]++;
    }
    if (ans.isCorrect) {
      correctCount++;
    }
  });

  return {
    optionCounts: counts,
    totalAnswered,
    correctCount,
    correctAnswer: currentQ.correctAnswer
  };
}

function getLeaderboard() {
  const list = [];
  gameState.players.forEach(p => {
    list.push({
      id: p.id,
      memberId: p.memberId,
      nickname: p.nickname,
      role: p.role,
      avatar: p.avatar,
      score: p.score,
      dob: p.dob,
      zodiacInfo: p.zodiacInfo,
      connected: p.connected
    });
  });
  return list.sort((a, b) => b.score - a.score);
}

// SOCKET.IO LOGIC
io.on('connection', (socket) => {
  // 20/10 Handlers
  socket.on('2010_join', () => {
    socket.emit('2010_init', get2010Status());
  });

  socket.on('2010_open_card', ({ memberId, ms }) => {
    const member = membersList.find(m => String(m.stt) === String(memberId) || (ms && String(m.ms) === String(ms)));
    if (member) {
      if (!orders2010[member.stt]) {
        orders2010[member.stt] = {
          memberId: member.stt,
          ms: member.ms || member.fingerprint,
          name: member.name,
          role: member.role,
          hasOpenedCard: false,
          openedAt: null,
          hasOrdered: false,
          orderedAt: null,
          order: null
        };
      }
      if (!orders2010[member.stt].hasOpenedCard) {
        orders2010[member.stt].hasOpenedCard = true;
        orders2010[member.stt].openedAt = new Date().toISOString();
        saveJson('orders_2010.json', orders2010);
      }
      const st = get2010Status();
      io.emit('2010_update', st);
      io.emit('2010_card_opened', {
        memberId: member.stt,
        ms: member.ms,
        name: member.name,
        role: member.role,
        avatar: member.avatar,
        openedAt: orders2010[member.stt].openedAt
      });
    }
  });

  socket.on('2010_submit_order', ({ memberId, ms, order }) => {
    const member = membersList.find(m => String(m.stt) === String(memberId) || (ms && String(m.ms) === String(ms)));
    if (member && order && order.drinkName) {
      if (!orders2010[member.stt]) {
        orders2010[member.stt] = {
          memberId: member.stt,
          ms: member.ms || member.fingerprint,
          name: member.name,
          role: member.role
        };
      }
      orders2010[member.stt].hasOpenedCard = true;
      if (!orders2010[member.stt].openedAt) orders2010[member.stt].openedAt = new Date().toISOString();
      orders2010[member.stt].hasOrdered = true;
      orders2010[member.stt].orderedAt = new Date().toISOString();
      orders2010[member.stt].order = {
        drinkId: order.drinkId || '',
        drinkName: order.drinkName,
        category: order.category || '',
        size: order.size || 'M',
        sugar: order.sugar || '100% (Chuẩn)',
        ice: order.ice || '100% (Chuẩn)',
        toppings: Array.isArray(order.toppings) ? order.toppings : [],
        note: order.note ? String(order.note).trim() : ''
      };
      saveJson('orders_2010.json', orders2010);

      const st = get2010Status();
      io.emit('2010_update', st);
      io.emit('2010_order_placed', {
        memberId: member.stt,
        ms: member.ms,
        name: member.name,
        role: member.role,
        avatar: member.avatar,
        order: orders2010[member.stt].order,
        orderedAt: orders2010[member.stt].orderedAt
      });
    }
  });

  // Biometric Fingerprint / Name Player Join
  socket.on('player_join', ({ id, nickname, memberId, fingerprint, dob, avatar }) => {
    let member = null;
    const inputFp = String(fingerprint || '').trim();

    // 1. Identify by memberId if provided
    if (memberId) {
      member = membersList.find(m => String(m.stt) === String(memberId));
    }

    // 2. Identify by fingerprint if member not identified yet, or user entered fingerprint
    if (!member && inputFp) {
      member = membersList.find(m => String(m.fingerprint || '').trim() === inputFp);
    }

    // 3. Identify by nickname
    if (!member && nickname) {
      const normInput = normalizeName(nickname);
      member = membersList.find(m => normalizeName(m.name) === normInput);
    }

    if (!member) {
      if (inputFp) {
        return socket.emit('join_error', {
          message: `Không tìm thấy mã vân tay "${inputFp}" trong danh sách 47 cán bộ nhân viên! Vui lòng kiểm tra lại hoặc chọn tên từ danh sách.`
        });
      }
      return socket.emit('join_error', {
        message: 'Vui lòng nhập mã vân tay chấm công hoặc chọn tên của bạn trong Danh sách 47 cán bộ nhân viên phòng TCKT!'
      });
    }

    // Validate fingerprint if both member and fingerprint provided and member has fingerprint
    const correctFp = String(member.fingerprint || '').trim();
    if (correctFp && inputFp && inputFp !== correctFp) {
      return socket.emit('join_error', {
        message: `Mã vân tay / mã chấm công chưa chính xác với ${member.name}! Vui lòng nhập lại.`
      });
    }

    // Update DOB if provided by player
    if (dob && dob.trim() && (!member.dob || member.dob !== dob.trim())) {
      member.dob = dob.trim();
      saveJson('members.json', membersList);
      io.emit('members_updated', membersList);
    }

    // Calculate Zodiac and Lunar animal details
    const zodiacInfo = member.dob ? zodiacHelper.getZodiacDetails(member.dob) : null;

    // Use canonical ID per member to prevent duplicate counts
    const playerId = `m_${member.stt}`;
    const cleanNick = member.name;
    const cleanAvatar = avatar || '😎';

    let player = gameState.players.get(playerId);
    if (!player) {
      player = {
        id: playerId,
        memberId: member.stt,
        nickname: cleanNick,
        role: '',
        avatar: cleanAvatar,
        dob: member.dob,
        zodiacInfo,
        score: 0,
        connected: true,
        hasJoined: true,
        socketId: socket.id
      };
      gameState.players.set(playerId, player);
    } else {
      player.connected = true;
      player.hasJoined = true;
      player.socketId = socket.id;
      player.nickname = cleanNick;
      player.memberId = member.stt;
      player.role = '';
      player.dob = member.dob;
      player.zodiacInfo = zodiacInfo;
      if (avatar) player.avatar = cleanAvatar;
    }

    socket.playerId = playerId;
    socket.join('players');

    // Confirm to player
    socket.emit('player_joined_success', {
      player: {
        id: player.id,
        memberId: player.memberId,
        nickname: player.nickname,
        role: player.role,
        avatar: player.avatar,
        score: player.score,
        dob: player.dob,
        zodiacInfo: player.zodiacInfo
      },
      gameState: {
        mode: gameState.mode,
        squizz: {
          currentIndex: gameState.squizz.currentIndex,
          isOpen: gameState.squizz.isOpen,
          isRevealed: gameState.squizz.isRevealed,
          isPaused: gameState.squizz.isPaused || false,
          timeRemaining: gameState.squizz.timeRemaining,
          timeLimit: gameState.squizz.timeLimit || 30,
          myVote: gameState.squizz.rawVotes[playerId] || null,
          question: squizzQuestions[gameState.squizz.currentIndex] || null
        },
        qa: {
          currentIndex: gameState.qa.currentIndex,
          isOpen: gameState.qa.isOpen,
          isRevealed: gameState.qa.isRevealed,
          isPaused: gameState.qa.isPaused || false,
          timeRemaining: gameState.qa.timeRemaining,
          timeLimit: gameState.qa.timeLimit || 15,
          myAnswer: gameState.qa.answers[playerId] || null,
          correctAnswer: gameState.qa.isRevealed && qaQuestions[gameState.qa.currentIndex] ? qaQuestions[gameState.qa.currentIndex].correctAnswer : null,
          explanation: gameState.qa.isRevealed && qaQuestions[gameState.qa.currentIndex] ? qaQuestions[gameState.qa.currentIndex].explanation : '',
          question: qaQuestions[gameState.qa.currentIndex] ? {
            id: qaQuestions[gameState.qa.currentIndex].id,
            type: qaQuestions[gameState.qa.currentIndex].type || 'MULTIPLE_CHOICE',
            category: qaQuestions[gameState.qa.currentIndex].category,
            icon: qaQuestions[gameState.qa.currentIndex].icon,
            question: qaQuestions[gameState.qa.currentIndex].question,
            options: qaQuestions[gameState.qa.currentIndex].options,
            timeLimit: qaQuestions[gameState.qa.currentIndex].timeLimit
          } : null
        }
      },
      members: membersList
    });

    // Notify host & all clients
    broadcastPlayerList();

    io.to('host').emit('player_joined_toast', {
      nickname: player.nickname,
      avatar: player.avatar
    });
  });

  function sendHostInit(targetSocket) {
    const activation = getMemberActivationStatus();
    targetSocket.emit('host_init', {
      mode: gameState.mode,
      players: getConnectedPlayers(),
      totalPlayers: activation.activatedCount,
      onlinePlayers: getConnectedPlayers().length,
      activation,
      squizz: {
        currentIndex: gameState.squizz.currentIndex,
        isOpen: gameState.squizz.isOpen,
        isRevealed: gameState.squizz.isRevealed,
        isPaused: gameState.squizz.isPaused || false,
        timeRemaining: gameState.squizz.timeRemaining,
        timeLimit: gameState.squizz.timeLimit || 30,
        question: squizzQuestions[gameState.squizz.currentIndex] || null,
        tally: calculateSquizzTally()
      },
      qa: {
        currentIndex: gameState.qa.currentIndex,
        isOpen: gameState.qa.isOpen,
        isRevealed: gameState.qa.isRevealed,
        isPaused: gameState.qa.isPaused || false,
        autoReveal: gameState.qa.autoReveal !== false,
        timeRemaining: gameState.qa.timeRemaining,
        timeLimit: gameState.qa.timeLimit || 15,
        question: qaQuestions[gameState.qa.currentIndex] || null,
        stats: calculateQaStats(),
        leaderboard: getLeaderboard()
      },
      squizzQuestions,
      qaQuestions,
      membersList
    });
  }

  socket.on('host_join', () => {
    socket.join('host');
    sendHostInit(socket);
  });

  socket.on('projector_join', () => {
    socket.join('host');
    socket.join('projector');
    sendHostInit(socket);
    socket.emit('2010_init', get2010Status());
  });

  socket.on('admin_join', () => {
    socket.join('host');
    socket.join('admin');
    sendHostInit(socket);
    socket.emit('2010_init', get2010Status());
  });

  // Squizz Timer & Auto-Reveal
  function startSquizzTimer() {
    if (gameState.squizz.timer) clearInterval(gameState.squizz.timer);
    gameState.squizz.isPaused = false;
    if (!gameState.squizz.timeLimit || gameState.squizz.timeLimit <= 0) return;
    gameState.squizz.timeRemaining = gameState.squizz.timeLimit;
    gameState.squizz.startTime = Date.now();
    gameState.squizz.timer = setInterval(() => {
      if (gameState.squizz.isPaused) return;
      gameState.squizz.timeRemaining--;
      io.emit('squizz_timer_tick', { timeRemaining: gameState.squizz.timeRemaining, isPaused: gameState.squizz.isPaused });
      if (gameState.squizz.timeRemaining <= 0) {
        clearInterval(gameState.squizz.timer);
        gameState.squizz.timer = null;
        revealSquizzWinner(true);
      }
    }, 1000);
  }

  function revealSquizzWinner(auto = false) {
    if (gameState.squizz.timer) {
      clearInterval(gameState.squizz.timer);
      gameState.squizz.timer = null;
    }
    gameState.squizz.isOpen = false;
    gameState.squizz.isRevealed = true;
    const tally = calculateSquizzTally();
    const q = squizzQuestions[gameState.squizz.currentIndex];

    // Find winner member info for zodiac & con giap
    let winnerDetails = null;
    if (tally.winner && tally.winner.name) {
      const foundMember = membersList.find(m => normalizeName(m.name) === tally.winner.normalized || normalizeName(m.name).includes(tally.winner.normalized));
      if (foundMember) {
        const zodiac = foundMember.dob ? zodiacHelper.getZodiacDetails(foundMember.dob) : null;
        winnerDetails = {
          stt: foundMember.stt,
          name: foundMember.name,
          role: foundMember.role,
          dob: foundMember.dob,
          zodiac
        };
      }
    }

    io.emit('squizz_revealed', {
      tally,
      question: q,
      winner: tally.winner,
      winnerDetails,
      auto
    });
  }

  // --- SQUIZZ EVENTS ---
  socket.on('player_vote_squizz', ({ name, text, playerId: clientPlayerId }) => {
    const playerId = socket.playerId || clientPlayerId;
    if (!playerId) return;
    if (!socket.playerId) socket.playerId = playerId;
    if (gameState.mode !== 'SQUIZZ' || !gameState.squizz.isOpen) {
      return socket.emit('action_error', { message: 'Thời gian bình chọn đã đóng!' });
    }
    const currentQ = squizzQuestions[gameState.squizz.currentIndex];
    const isText = currentQ && currentQ.type === 'OPEN_TEXT';

    const submission = (isText ? text : name) || name || text || '';
    if (!submission || !submission.trim()) return;

    const trimmed = submission.trim().slice(0, 50);
    gameState.squizz.rawVotes[playerId] = trimmed;
    gameState.squizz.votes[playerId] = normalizeName(trimmed);

    socket.emit('squizz_vote_accepted', { chosenName: trimmed });

    const tally = calculateSquizzTally();
    const act = getMemberActivationStatus();
    io.emit('squizz_live_update', {
      tally,
      totalVotes: tally.totalVotes,
      totalPlayers: act.activatedCount || getConnectedPlayers().length
    });
  });

  // Host squizz controls
  socket.on('host_squizz_start', ({ questionIndex = 0, timeLimit }) => {
    gameState.mode = 'SQUIZZ';
    gameState.squizz.currentIndex = questionIndex;
    gameState.squizz.isOpen = true;
    gameState.squizz.isRevealed = false;
    gameState.squizz.votes = {};
    gameState.squizz.rawVotes = {};
    
    // Default timer: strictly 30s for Question 1, or timeLimit if specified
    const chosenTimer = (questionIndex === 0) ? (timeLimit !== undefined ? timeLimit : 30) : (timeLimit !== undefined ? timeLimit : 30);
    gameState.squizz.timeLimit = chosenTimer;

    const q = squizzQuestions[gameState.squizz.currentIndex];

    io.emit('game_mode_changed', { mode: 'SQUIZZ' });
    io.emit('squizz_question_started', {
      currentIndex: gameState.squizz.currentIndex,
      total: squizzQuestions.length,
      timeLimit: gameState.squizz.timeLimit,
      question: q
    });

    const act = getMemberActivationStatus();
    io.emit('squizz_live_update', {
      tally: calculateSquizzTally(),
      totalVotes: 0,
      totalPlayers: act.activatedCount || getConnectedPlayers().length
    });

    startSquizzTimer();
  });

  socket.on('host_squizz_toggle_lock', ({ open }) => {
    gameState.squizz.isOpen = open;
    if (!open && gameState.squizz.timer) {
      clearInterval(gameState.squizz.timer);
      gameState.squizz.timer = null;
    }
    io.emit('squizz_lock_changed', { isOpen: open });
  });

  socket.on('host_squizz_pause_timer', ({ pause }) => {
    gameState.squizz.isPaused = (pause !== undefined) ? !!pause : !gameState.squizz.isPaused;
    io.emit('squizz_timer_paused', { isPaused: gameState.squizz.isPaused, timeRemaining: gameState.squizz.timeRemaining });
  });

  socket.on('host_squizz_add_time', ({ seconds = 5 }) => {
    gameState.squizz.timeRemaining = Math.max(0, (gameState.squizz.timeRemaining || 0) + seconds);
    io.emit('squizz_timer_tick', { timeRemaining: gameState.squizz.timeRemaining, isPaused: gameState.squizz.isPaused });
  });

  socket.on('host_qa_toggle_lock', ({ open }) => {
    gameState.qa.isOpen = open;
    if (!open && gameState.qa.timer) {
      clearInterval(gameState.qa.timer);
      gameState.qa.timer = null;
    }
    io.emit('qa_lock_changed', { isOpen: open });
  });

  socket.on('host_squizz_reveal', () => {
    revealSquizzWinner(false);
  });

  socket.on('host_squizz_next', () => {
    if (gameState.squizz.currentIndex < squizzQuestions.length - 1) {
      gameState.squizz.currentIndex++;
      gameState.squizz.isOpen = true;
      gameState.squizz.isRevealed = false;
      gameState.squizz.isPaused = false;
      gameState.squizz.votes = {};
      gameState.squizz.rawVotes = {};

      const q = squizzQuestions[gameState.squizz.currentIndex];
      gameState.squizz.timeLimit = (q && q.timeLimit !== undefined) ? q.timeLimit : 30;
      gameState.squizz.timeRemaining = gameState.squizz.timeLimit;
      gameState.squizz.startTime = Date.now();

      io.emit('squizz_question_started', {
        currentIndex: gameState.squizz.currentIndex,
        total: squizzQuestions.length,
        timeLimit: gameState.squizz.timeLimit,
        question: q
      });
      const act = getMemberActivationStatus();
      io.emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });
      startSquizzTimer();
    }
  });

  socket.on('host_squizz_prev', () => {
    if (gameState.squizz.currentIndex > 0) {
      gameState.squizz.currentIndex--;
      gameState.squizz.isOpen = true;
      gameState.squizz.isRevealed = false;
      gameState.squizz.isPaused = false;
      gameState.squizz.votes = {};
      gameState.squizz.rawVotes = {};

      const q = squizzQuestions[gameState.squizz.currentIndex];
      gameState.squizz.timeLimit = (q && q.timeLimit !== undefined) ? q.timeLimit : 30;
      gameState.squizz.timeRemaining = gameState.squizz.timeLimit;
      gameState.squizz.startTime = Date.now();

      io.emit('squizz_question_started', {
        currentIndex: gameState.squizz.currentIndex,
        total: squizzQuestions.length,
        timeLimit: gameState.squizz.timeLimit,
        question: q
      });
      const act = getMemberActivationStatus();
      io.emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });
      startSquizzTimer();
    }
  });

  socket.on('host_trigger_cheer', ({ text }) => {
    io.emit('party_cheer', {
      text: text || '100% CẠN LY! ZÔ ZÔ ZÔ! 🍻🍻🍻'
    });
  });

  socket.on('host_set_squizz_timer', ({ seconds }) => {
    gameState.squizz.timeLimit = seconds;
    gameState.squizz.timeRemaining = seconds;
    gameState.squizz.isPaused = false;
    if (seconds <= 0) {
      if (gameState.squizz.timer) clearInterval(gameState.squizz.timer);
      gameState.squizz.timer = null;
      io.emit('squizz_timer_tick', { timeRemaining: 0, isManual: true });
    } else {
      startSquizzTimer();
    }
  });

  socket.on('host_set_qa_timer', ({ seconds }) => {
    gameState.qa.timeLimit = seconds;
    gameState.qa.timeRemaining = seconds;
    gameState.qa.isPaused = false;
    if (seconds <= 0) {
      if (gameState.qa.timer) clearInterval(gameState.qa.timer);
      gameState.qa.timer = null;
      io.emit('qa_timer_tick', { timeRemaining: 0, isManual: true });
    } else {
      startQaTimer();
    }
  });

  // --- QA EVENTS ---
  socket.on('player_answer_qa', ({ optionIndex, textAnswer, playerId: clientPlayerId }) => {
    const playerId = socket.playerId || clientPlayerId;
    if (!playerId) return;
    if (!socket.playerId) socket.playerId = playerId;
    if (gameState.mode !== 'QA' || !gameState.qa.isOpen) {
      return socket.emit('action_error', { message: 'Thời gian trả lời đã kết thúc!' });
    }
    if (gameState.qa.answers[playerId]) {
      return; // Already answered
    }

    const currentQ = qaQuestions[gameState.qa.currentIndex];
    if (!currentQ) return;

    const timeTakenMs = Math.max(100, Date.now() - gameState.qa.startTime);
    const isCorrect = optionIndex === currentQ.correctAnswer;
    
    // Scoring formula: Kahoot style (up to 1000 points based on speed)
    let points = 0;
    if (isCorrect) {
      const timeLimitMs = (currentQ.timeLimit || 15) * 1000;
      const speedFraction = Math.max(0, 1 - (timeTakenMs / timeLimitMs) / 2);
      points = Math.round(500 + 500 * speedFraction);
    }

    const player = gameState.players.get(playerId);
    if (player) {
      player.score += points;
    }

    gameState.qa.answers[playerId] = {
      optionIndex,
      textAnswer: textAnswer || '',
      isCorrect,
      points,
      timeTakenMs
    };

    socket.emit('qa_answer_accepted', {
      optionIndex,
      pointsAwarded: points,
      isCorrect
    });

    const stats = calculateQaStats();
    const act = getMemberActivationStatus();
    io.emit('qa_live_update', {
      stats,
      totalAnswered: stats.totalAnswered,
      totalPlayers: act.activatedCount || getConnectedPlayers().length
    });

    // If everyone in a full room (10+ players) has answered, reveal early; otherwise let the timer finish or MC control
    const connectedCount = getConnectedPlayers().length;
    if (connectedCount >= 10 && stats.totalAnswered >= connectedCount) {
      endQaQuestion();
      setTimeout(() => {
        if (!gameState.qa.isRevealed && gameState.mode === 'QA') {
          revealQaAnswer(true);
        }
      }, 1000);
    }
  });

  function startQaTimer() {
    if (gameState.qa.timer) clearInterval(gameState.qa.timer);
    gameState.qa.isPaused = false;
    gameState.qa.timer = setInterval(() => {
      if (gameState.qa.isPaused) return;
      gameState.qa.timeRemaining--;
      io.emit('qa_timer_tick', { timeRemaining: gameState.qa.timeRemaining, isPaused: gameState.qa.isPaused });
      if (gameState.qa.timeRemaining <= 0) {
        clearInterval(gameState.qa.timer);
        gameState.qa.timer = null;
        endQaQuestion();
        if (gameState.qa.autoReveal !== false) {
          revealQaAnswer(true);
        }
      }
    }, 1000);
  }

  function endQaQuestion() {
    if (gameState.qa.timer) {
      clearInterval(gameState.qa.timer);
      gameState.qa.timer = null;
    }
    gameState.qa.isOpen = false;
    io.emit('qa_time_up');
  }

  function revealQaAnswer(auto = false) {
    endQaQuestion();
    gameState.qa.isRevealed = true;
    const stats = calculateQaStats();
    const currentQ = qaQuestions[gameState.qa.currentIndex];
    const leaderboard = getLeaderboard();

    // Compile list of players who answered wrong vs right vs unanswered
    const wrongAnswers = [];
    const correctAnswers = [];
    const unanswered = [];

    gameState.players.forEach((p, pId) => {
      if (!p.hasJoined && !p.connected) return;
      const ans = gameState.qa.answers[pId];
      if (!ans) {
        unanswered.push({
          id: pId,
          name: p.nickname,
          avatar: p.avatar
        });
      } else if (ans.isCorrect) {
        correctAnswers.push({
          id: pId,
          name: p.nickname,
          avatar: p.avatar,
          points: ans.points,
          timeTakenMs: ans.timeTakenMs
        });
      } else {
        const optLetter = (ans.optionIndex >= 0 && ans.optionIndex <= 3) ? ['A', 'B', 'C', 'D'][ans.optionIndex] : '?';
        const optText = (currentQ && currentQ.options && currentQ.options[ans.optionIndex]) ? currentQ.options[ans.optionIndex] : '';
        wrongAnswers.push({
          id: pId,
          name: p.nickname,
          avatar: p.avatar,
          optionIndex: ans.optionIndex,
          optionLetter: optLetter,
          optionText: optText
        });
      }
    });

    io.emit('qa_revealed', {
      correctAnswer: currentQ ? currentQ.correctAnswer : 0,
      explanation: currentQ ? currentQ.explanation : '',
      stats,
      leaderboard: leaderboard.slice(0, 10),
      wrongAnswers,
      correctAnswers,
      unanswered,
      auto
    });
  }

  // Master Host QA Controls
  socket.on('host_qa_start', ({ questionIndex = 0, timeLimit }) => {
    gameState.mode = 'QA';
    gameState.qa.currentIndex = questionIndex;
    gameState.qa.isOpen = true;
    gameState.qa.isRevealed = false;
    gameState.qa.answers = {};
    const q = qaQuestions[gameState.qa.currentIndex];
    gameState.qa.timeLimit = timeLimit !== undefined ? timeLimit : (q ? (q.timeLimit || 15) : 15);
    gameState.qa.timeRemaining = gameState.qa.timeLimit;
    gameState.qa.startTime = Date.now();

    io.emit('game_mode_changed', { mode: 'QA' });
    io.emit('qa_question_started', {
      currentIndex: gameState.qa.currentIndex,
      total: qaQuestions.length,
      timeLimit: gameState.qa.timeLimit,
      question: {
        id: q.id,
        category: q.category,
        icon: q.icon,
        question: q.question,
        options: q.options,
        timeLimit: gameState.qa.timeLimit
      }
    });

    const act = getMemberActivationStatus();
    io.emit('qa_live_update', {
      stats: calculateQaStats(),
      totalAnswered: 0,
      totalPlayers: act.activatedCount || getConnectedPlayers().length
    });

    startQaTimer();
  });

  socket.on('host_qa_reveal', () => {
    revealQaAnswer(false);
  });

  socket.on('host_qa_toggle_auto', ({ enabled }) => {
    gameState.qa.autoReveal = (enabled !== undefined) ? !!enabled : !gameState.qa.autoReveal;
    io.emit('qa_auto_toggled', { autoReveal: gameState.qa.autoReveal });
  });

  socket.on('host_qa_pause_timer', ({ pause }) => {
    gameState.qa.isPaused = (pause !== undefined) ? !!pause : !gameState.qa.isPaused;
    io.emit('qa_timer_paused', { isPaused: gameState.qa.isPaused, timeRemaining: gameState.qa.timeRemaining });
  });

  socket.on('host_qa_add_time', ({ seconds = 5 }) => {
    gameState.qa.timeRemaining = Math.max(0, (gameState.qa.timeRemaining || 0) + seconds);
    io.emit('qa_timer_tick', { timeRemaining: gameState.qa.timeRemaining, isPaused: gameState.qa.isPaused });
  });

  socket.on('host_qa_set_display', ({ displayMode }) => {
    // 'WRONG_ANSWERS' or 'LEADERBOARD' or 'DEFAULT'
    io.emit('qa_display_changed', { displayMode });
  });

  // Admin Kick Member (Dùng khi chọn nhầm tên)
  socket.on('admin_kick_member', ({ memberId }) => {
    if (!memberId) return;
    const cleanId = String(memberId);
    let targetPlayerId = null;
    let targetSocketId = null;
    let kickedName = '';

    gameState.players.forEach((p, pId) => {
      if (String(p.memberId) === cleanId) {
        targetPlayerId = pId;
        targetSocketId = p.socketId;
        kickedName = p.nickname;
      }
    });

    if (targetPlayerId) {
      gameState.players.delete(targetPlayerId);
      delete gameState.squizz.votes[targetPlayerId];
      delete gameState.squizz.rawVotes[targetPlayerId];
      delete gameState.qa.answers[targetPlayerId];
    }

    if (targetSocketId) {
      io.to(targetSocketId).emit('player_kicked', {
        message: `Tài khoản (${kickedName}) đã được Admin đặt lại trạng thái (do chọn nhầm tên). Vui lòng chọn đúng tên hoặc nhập mã vân tay của bạn để vào lại bàn tiệc!`
      });
      const s = io.sockets.sockets.get(targetSocketId);
      if (s) {
        s.playerId = null;
        s.leave('players');
      }
    }

    broadcastPlayerList();
    io.to('host').emit('action_success', {
      message: `Đã hủy điểm danh thành viên #${cleanId} (${kickedName || ''}) thành công.`
    });
  });

  socket.on('host_qa_next', () => {
    if (gameState.qa.currentIndex < qaQuestions.length - 1) {
      gameState.qa.currentIndex++;
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 15) : 15;
      gameState.qa.timeRemaining = gameState.qa.timeLimit;
      gameState.qa.startTime = Date.now();

      io.emit('qa_question_started', {
        currentIndex: gameState.qa.currentIndex,
        total: qaQuestions.length,
        timeLimit: gameState.qa.timeLimit,
        question: {
          id: q.id,
          category: q.category,
          icon: q.icon,
          question: q.question,
          options: q.options,
          timeLimit: q.timeLimit || 15
        }
      });

      const act = getMemberActivationStatus();
      io.emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });

      startQaTimer();
    }
  });

  socket.on('host_qa_prev', () => {
    if (gameState.qa.currentIndex > 0) {
      gameState.qa.currentIndex--;
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 15) : 15;
      gameState.qa.timeRemaining = gameState.qa.timeLimit;
      gameState.qa.startTime = Date.now();

      io.emit('qa_question_started', {
        currentIndex: gameState.qa.currentIndex,
        total: qaQuestions.length,
        timeLimit: gameState.qa.timeLimit,
        question: {
          id: q.id,
          category: q.category,
          icon: q.icon,
          question: q.question,
          options: q.options,
          timeLimit: q.timeLimit || 15
        }
      });

      const act = getMemberActivationStatus();
      io.emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });

      startQaTimer();
    }
  });

  socket.on('host_show_podium', () => {
    gameState.mode = 'PODIUM';
    if (gameState.qa.timer) clearInterval(gameState.qa.timer);
    if (gameState.squizz.timer) clearInterval(gameState.squizz.timer);
    const leaderboard = getLeaderboard();
    io.emit('game_mode_changed', { mode: 'PODIUM' });
    io.emit('podium_celebration', {
      leaderboard: leaderboard.slice(0, 10),
      top3: leaderboard.slice(0, 3)
    });
  });

  socket.on('host_back_to_lobby', () => {
    gameState.mode = 'LOBBY';
    if (gameState.qa.timer) clearInterval(gameState.qa.timer);
    if (gameState.squizz.timer) clearInterval(gameState.squizz.timer);
    io.emit('game_mode_changed', { mode: 'LOBBY' });
    broadcastPlayerList();
  });

  socket.on('host_reset_scores', () => {
    gameState.players.forEach(p => {
      p.score = 0;
    });
    gameState.qa.answers = {};
    gameState.squizz.votes = {};
    gameState.squizz.rawVotes = {};
    io.emit('scores_reset');
    broadcastPlayerList();
  });

  // --- ADMIN RESET & BOT SIMULATION (TESTING FEATURES) ---
  const BOT_NAMES = [
    "Hồng Phương", "Hoài Thanh", "Tô Châu", "Minh Hạnh", "Thu Trang",
    "Hải Yến", "Thanh Hương", "Ngọc Anh", "Đức Huy", "Tuấn Anh",
    "Văn Dũng", "Thị Mai", "Khánh Linh", "Quỳnh Nga", "Thành Nam",
    "Bảo Ngọc", "Hoàng Long", "Huyền Trang", "Phương Linh", "Việt Hoàng",
    "Quang Minh", "Thái Sơn", "Bích Ngọc", "Lan Anh", "Trọng Tấn",
    "Hà My", "Xuân Bắc", "Vân Anh", "Thế Anh", "Tiến Dũng",
    "Như Quỳnh", "Thùy Dung", "Hồng Hạnh", "Minh Quân", "Bảo Châu",
    "Gia Huy", "Tú Anh", "Thanh Tùng", "Diệu Linh", "Kim Ngân"
  ];
  const BOT_AVATARS = ['😎', '🦁', '🐯', '🚀', '🍺', '🥳', '👑', '🔥', '⚡', '🍕', '🎯', '💃', '🕺', '🐱', '🦊', '🐉', '🍷', '🦸'];

  const SAMPLE_OPEN_ANSWERS = [
    'Đoàn kết và nhiệt huyết!', 'Bận rộn nhưng cực kỳ vui vẻ!', 'Đi Phú Quốc nghỉ dưỡng 🏖️',
    'Tăng lương gấp đôi 💰', 'Gia đình thứ hai ❤️', 'Tuyệt vời số 1 BV Phương Đông!',
    'Hết mình trong công việc, nhiệt tình trên bàn tiệc! 🍻', 'Đoàn kết là sức mạnh!',
    'Đi Đà Nẵng tắm biển 🌴', 'Năm mới bùng nổ KPI 🚀', 'Thanh xuân cùng phòng Kế toán ✨',
    'Yêu sếp và yêu đồng nghiệp 🥰'
  ];

  socket.on('host_add_bots', ({ count = 40 }) => {
    const num = Math.min(count, membersList.length);
    for (let i = 0; i < num; i++) {
      const m = membersList[i];
      const botId = `bot_${m.stt}`;
      const avatar = BOT_AVATARS[i % BOT_AVATARS.length];
      const zodiacInfo = m.dob ? zodiacHelper.getZodiacDetails(m.dob) : null;
      gameState.players.set(botId, {
        id: botId,
        memberId: m.stt,
        nickname: m.name,
        role: '',
        avatar: avatar,
        score: 0,
        connected: true,
        hasJoined: true,
        isBot: true,
        dob: m.dob,
        zodiacInfo,
        socketId: null
      });
    }

    broadcastPlayerList();
  });

  socket.on('host_simulate_squizz', () => {
    if (gameState.mode !== 'SQUIZZ') return;
    const currentQ = squizzQuestions[gameState.squizz.currentIndex];
    const isText = currentQ && currentQ.type === 'OPEN_TEXT';
    const candidatePool = membersList.map(m => m.name);
    
    // Pick primary winner
    const preferredWinner = currentQ && currentQ.suggested ? currentQ.suggested : (candidatePool[0] || 'Nguyễn Thị Hoài Thanh');

    let delay = 0;
    gameState.players.forEach((player, pId) => {
      setTimeout(() => {
        if (gameState.mode !== 'SQUIZZ' || !gameState.squizz.isOpen) return;

        let voteChoice = '';
        if (isText) {
          voteChoice = SAMPLE_OPEN_ANSWERS[Math.floor(Math.random() * SAMPLE_OPEN_ANSWERS.length)];
        } else {
          // 60% chance to vote for the target winner, 40% distributed among other official members
          voteChoice = preferredWinner;
          if (Math.random() > 0.6) {
            voteChoice = candidatePool[Math.floor(Math.random() * candidatePool.length)];
          }
        }

        gameState.squizz.rawVotes[pId] = voteChoice;
        gameState.squizz.votes[pId] = normalizeName(voteChoice);

        const tally = calculateSquizzTally();
        const act = getMemberActivationStatus();
        io.emit('squizz_live_update', {
          tally,
          totalVotes: tally.totalVotes,
          totalPlayers: act.activatedCount || getConnectedPlayers().length
        });
      }, delay);
      delay += 40; // 40ms stagger so votes count up live
    });
  });

  socket.on('host_simulate_qa', () => {
    if (gameState.mode !== 'QA') return;
    const currentQ = qaQuestions[gameState.qa.currentIndex];
    if (!currentQ) return;

    let delay = 0;
    gameState.players.forEach((player, pId) => {
      setTimeout(() => {
        if (gameState.mode !== 'QA' || !gameState.qa.isOpen) return;
        if (gameState.qa.answers[pId]) return;

        // 70% chance to answer correctly
        let chosenOpt = currentQ.correctAnswer;
        if (Math.random() > 0.7) {
          const wrongOptions = [0, 1, 2, 3].filter(o => o !== currentQ.correctAnswer);
          chosenOpt = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
        }

        const isCorrect = (chosenOpt === currentQ.correctAnswer);
        const timeTakenMs = Math.round(1500 + Math.random() * 8000);
        
        let points = 0;
        if (isCorrect) {
          const timeLimitMs = (currentQ.timeLimit || 15) * 1000;
          const speedFraction = Math.max(0, 1 - (timeTakenMs / timeLimitMs) / 2);
          points = Math.round(500 + 500 * speedFraction);
        }

        player.score += points;
        gameState.qa.answers[pId] = {
          optionIndex: chosenOpt,
          isCorrect,
          points,
          timeTakenMs
        };

        const stats = calculateQaStats();
        const act = getMemberActivationStatus();
        io.emit('qa_live_update', {
          stats,
          totalAnswered: stats.totalAnswered,
          totalPlayers: act.activatedCount || getConnectedPlayers().length
        });
      }, delay);
      delay += 50; // stagger answers
    });
  });

  socket.on('host_reset_current_q', () => {
    if (gameState.mode === 'SQUIZZ') {
      gameState.squizz.isOpen = true;
      gameState.squizz.isRevealed = false;
      gameState.squizz.votes = {};
      gameState.squizz.rawVotes = {};
      const q = squizzQuestions[gameState.squizz.currentIndex];
      io.emit('squizz_question_started', {
        currentIndex: gameState.squizz.currentIndex,
        total: squizzQuestions.length,
        question: q
      });
      const act = getMemberActivationStatus();
      io.emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });
    } else if (gameState.mode === 'QA') {
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 15) : 15;
      gameState.qa.timeRemaining = gameState.qa.timeLimit;
      gameState.qa.startTime = Date.now();

      io.emit('qa_question_started', {
        currentIndex: gameState.qa.currentIndex,
        total: qaQuestions.length,
        timeLimit: gameState.qa.timeLimit,
        question: q
      });
      const act = getMemberActivationStatus();
      io.emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });
      startQaTimer();
    }
  });

  socket.on('host_clear_all_players', () => {
    gameState.players.clear();
    gameState.squizz.votes = {};
    gameState.squizz.rawVotes = {};
    gameState.qa.answers = {};
    io.emit('scores_reset');
    broadcastPlayerList();
  });

  socket.on('host_jump_to_q', ({ mode, index }) => {
    if (mode === 'SQUIZZ') {
      gameState.mode = 'SQUIZZ';
      if (gameState.qa.timer) clearInterval(gameState.qa.timer);
      gameState.squizz.currentIndex = Math.max(0, Math.min(squizzQuestions.length - 1, index));
      gameState.squizz.isOpen = true;
      gameState.squizz.isRevealed = false;
      gameState.squizz.isPaused = false;
      gameState.squizz.votes = {};
      gameState.squizz.rawVotes = {};

      const q = squizzQuestions[gameState.squizz.currentIndex];
      gameState.squizz.timeLimit = (q && q.timeLimit !== undefined) ? q.timeLimit : 30;
      gameState.squizz.timeRemaining = gameState.squizz.timeLimit;
      gameState.squizz.startTime = Date.now();

      io.emit('game_mode_changed', { mode: 'SQUIZZ' });
      io.emit('squizz_question_started', {
        currentIndex: gameState.squizz.currentIndex,
        total: squizzQuestions.length,
        timeLimit: gameState.squizz.timeLimit,
        question: q
      });
      const act = getMemberActivationStatus();
      io.emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });
      startSquizzTimer();
    } else if (mode === 'QA') {
      gameState.mode = 'QA';
      if (gameState.squizz.timer) clearInterval(gameState.squizz.timer);
      gameState.qa.currentIndex = Math.max(0, Math.min(qaQuestions.length - 1, index));
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.isPaused = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 15) : 15;
      gameState.qa.timeRemaining = gameState.qa.timeLimit;
      gameState.qa.startTime = Date.now();

      io.emit('game_mode_changed', { mode: 'QA' });
      io.emit('qa_question_started', {
        currentIndex: gameState.qa.currentIndex,
        total: qaQuestions.length,
        timeLimit: gameState.qa.timeLimit,
        question: {
          id: q.id,
          category: q.category,
          icon: q.icon,
          question: q.question,
          options: q.options,
          timeLimit: gameState.qa.timeLimit
        }
      });
      const act = getMemberActivationStatus();
      io.emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: act.activatedCount || getConnectedPlayers().length
      });
      startQaTimer();
    }
  });

  socket.on('disconnect', () => {
    const playerId = socket.playerId;
    if (playerId) {
      const player = gameState.players.get(playerId);
      if (player) {
        player.connected = false;
        broadcastPlayerList();
      }
    }
  });
});

// Cloudflare Quick Tunnel Manager
function startCloudflareTunnel(port) {
  const binaryPath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(binaryPath)) {
    console.log('ℹ️ Không tìm thấy file cloudflared.exe. Chạy ở chế độ Wi-Fi nội bộ.');
    return;
  }

  console.log('⚡ Đang kết nối Cloudflare Tunnel để tạo link công khai toàn cầu...');
  cloudflaredProc = spawn(binaryPath, ['tunnel', '--url', `http://localhost:${port}`]);

  cloudflaredProc.stderr.on('data', async (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicTunnelUrl) {
      publicTunnelUrl = match[0];
      const playerUrl = `${publicTunnelUrl}/player.html`;
      console.log(`=======================================================`);
      console.log(`🌐 CLOUDFLARE TUNNEL ĐÃ KẾT NỐI THÀNH CÔNG!`);
      console.log(`🔗 Link tham gia toàn cầu (4G/5G/bất kỳ Wi-Fi):`);
      console.log(`👉 ${playerUrl}`);
      console.log(`=======================================================`);

      try {
        const qrCodeData = await QRCode.toDataURL(playerUrl, {
          width: 320,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        io.to('host').emit('tunnel_ready', {
          joinUrl: playerUrl,
          qrCodeData,
          tunnelUrl: publicTunnelUrl
        });
      } catch (err) {
        console.error('Error generating tunnel QR:', err);
      }
    }
  });

  cloudflaredProc.on('error', (err) => {
    console.error('Cloudflare Tunnel error:', err.message);
  });
}

function cleanup() {
  if (cloudflaredProc) {
    try { cloudflaredProc.kill(); } catch (e) {}
  }
  process.exit();
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  if (cloudflaredProc) cloudflaredProc.kill();
});

// Start server with automatic port retry if busy
function startListening(port) {
  server.listen(port, '0.0.0.0', () => {
    PORT = port;
    console.log(`=======================================================`);
    console.log(`🚀 TEAM BUILDING GAME SERVER STARTED!`);
    console.log(`📡 Local Network IP: http://${LOCAL_IP}:${PORT}`);
    console.log(`🖥️  Host / Projector:  http://${LOCAL_IP}:${PORT}/host.html`);
    console.log(`📱 Mobile Players:    http://${LOCAL_IP}:${PORT}/player.html`);
    console.log(`=======================================================`);

    // Launch Cloudflare Tunnel
    startCloudflareTunnel(PORT);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Cổng ${PORT} hiện đang bận, tự động thử cổng ${PORT + 1}...`);
    PORT++;
    startListening(PORT);
  } else {
    console.error('Server error:', err);
  }
});

startListening(PORT);


