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
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    const members = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[1]) continue;
      const stt = String(r[0] || i);
      const name = String(r[1]).trim();
      const role = String(r[2] || '').trim();
      const fp = String(r[3] !== undefined && r[3] !== null ? r[3] : '').trim();
      let dob = '';
      if (r[4]) {
        if (typeof r[4] === 'number') {
          const p = xlsx.SSF.parse_date_code(r[4]);
          const dd = String(p.d).padStart(2, '0');
          const mm = String(p.m).padStart(2, '0');
          dob = `${dd}/${mm}/${p.y}`;
        } else {
          dob = String(r[4]).trim();
        }
      }
      members.push({ stt, name, role, fingerprint: fp, dob });
    }
    if (members.length > 0) {
      membersList = members;
      saveJson('members.json', membersList);
      io.emit('members_updated', membersList);
      return res.json({ success: true, count: membersList.length, members: membersList });
    }
    res.status(400).json({ error: 'Không tìm thấy dòng dữ liệu nào trong sheet' });
  } catch (err) {
    console.error('Error reloading excel:', err);
    res.status(500).json({ error: err.message });
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
    timeLimit: parseInt(q.timeLimit, 10) || 20
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
  players: new Map(), // playerId -> { id, nickname, avatar, score, squizzVotes: {}, qaAnswers: {}, connected: true, socketId }
  
  // SQUIZZ state
  squizz: {
    currentIndex: 0,
    isOpen: false,
    isRevealed: false,
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
    timeLimit: 20,
    timeRemaining: 20,
    timer: null,
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
        role: p.role,
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
  const connected = getConnectedPlayers();
  const connectedMemberIds = new Set(
    connected
      .filter(p => p.memberId)
      .map(p => String(p.memberId))
  );

  const activatedMembers = [];
  const missingMembers = [];

  membersList.forEach(m => {
    const isAct = connectedMemberIds.has(String(m.stt));
    const obj = {
      stt: m.stt,
      name: m.name,
      role: m.role || '',
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
    total: players.length,
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
  // Biometric Fingerprint Player Join
  socket.on('player_join', ({ id, nickname, memberId, fingerprint, dob, avatar }) => {
    // 1. Identify member from official 47 members list
    let member = null;
    if (memberId) {
      member = membersList.find(m => String(m.stt) === String(memberId));
    }
    if (!member && nickname) {
      const normInput = normalizeName(nickname);
      member = membersList.find(m => normalizeName(m.name) === normInput);
    }

    if (!member) {
      return socket.emit('join_error', {
        message: 'Bạn chưa chọn tên trong Danh sách 47 cán bộ nhân viên phòng TCKT!'
      });
    }

    // 2. Validate Fingerprint Code
    const inputFp = String(fingerprint || '').trim();
    const correctFp = String(member.fingerprint || '').trim();

    if (correctFp && inputFp !== correctFp) {
      return socket.emit('join_error', {
        message: `Mã vân tay / mã chấm công không chính xác với ${member.name}! Vui lòng nhập lại.`
      });
    }

    // 3. Update DOB if provided by player
    if (dob && dob.trim() && (!member.dob || member.dob !== dob.trim())) {
      member.dob = dob.trim();
      saveJson('members.json', membersList);
      io.emit('members_updated', membersList);
    }

    // 4. Calculate Zodiac and Lunar animal details
    const zodiacInfo = member.dob ? zodiacHelper.getZodiacDetails(member.dob) : null;

    const playerId = id || (`m_${member.stt}`);
    const cleanNick = member.name;
    const cleanAvatar = avatar || '😎';

    let player = gameState.players.get(playerId);
    if (!player) {
      player = {
        id: playerId,
        memberId: member.stt,
        nickname: cleanNick,
        role: member.role || '',
        avatar: cleanAvatar,
        dob: member.dob,
        zodiacInfo,
        score: 0,
        connected: true,
        socketId: socket.id
      };
      gameState.players.set(playerId, player);
    } else {
      player.connected = true;
      player.socketId = socket.id;
      player.nickname = cleanNick;
      player.memberId = member.stt;
      player.role = member.role || '';
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
          myVote: gameState.squizz.rawVotes[playerId] || null,
          question: squizzQuestions[gameState.squizz.currentIndex] || null
        },
        qa: {
          currentIndex: gameState.qa.currentIndex,
          isOpen: gameState.qa.isOpen,
          isRevealed: gameState.qa.isRevealed,
          timeRemaining: gameState.qa.timeRemaining,
          myAnswer: gameState.qa.answers[playerId] || null,
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
    targetSocket.emit('host_init', {
      mode: gameState.mode,
      players: getConnectedPlayers(),
      totalPlayers: getConnectedPlayers().length,
      activation: getMemberActivationStatus(),
      squizz: {
        currentIndex: gameState.squizz.currentIndex,
        isOpen: gameState.squizz.isOpen,
        isRevealed: gameState.squizz.isRevealed,
        timeRemaining: gameState.squizz.timeRemaining,
        timeLimit: gameState.squizz.timeLimit || 30,
        question: squizzQuestions[gameState.squizz.currentIndex] || null,
        tally: calculateSquizzTally()
      },
      qa: {
        currentIndex: gameState.qa.currentIndex,
        isOpen: gameState.qa.isOpen,
        isRevealed: gameState.qa.isRevealed,
        timeRemaining: gameState.qa.timeRemaining,
        timeLimit: gameState.qa.timeLimit,
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
  });

  socket.on('admin_join', () => {
    socket.join('host');
    socket.join('admin');
    sendHostInit(socket);
  });

  // Squizz Timer & Auto-Reveal
  function startSquizzTimer() {
    if (gameState.squizz.timer) clearInterval(gameState.squizz.timer);
    if (!gameState.squizz.timeLimit || gameState.squizz.timeLimit <= 0) return;
    gameState.squizz.timeRemaining = gameState.squizz.timeLimit;
    gameState.squizz.startTime = Date.now();
    gameState.squizz.timer = setInterval(() => {
      gameState.squizz.timeRemaining--;
      io.emit('squizz_timer_tick', { timeRemaining: gameState.squizz.timeRemaining });
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
  socket.on('player_vote_squizz', ({ name, text }) => {
    const playerId = socket.playerId;
    if (!playerId) return;
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
    io.to('host').emit('squizz_live_update', {
      tally,
      totalVotes: tally.totalVotes,
      totalPlayers: getConnectedPlayers().length
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

    io.to('host').emit('squizz_live_update', {
      tally: calculateSquizzTally(),
      totalVotes: 0,
      totalPlayers: getConnectedPlayers().length
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

  socket.on('host_squizz_reveal', () => {
    revealSquizzWinner(false);
  });

  socket.on('host_squizz_next', () => {
    if (gameState.squizz.currentIndex < squizzQuestions.length - 1) {
      gameState.squizz.currentIndex++;
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
      io.to('host').emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: getConnectedPlayers().length
      });
    }
  });

  socket.on('host_squizz_prev', () => {
    if (gameState.squizz.currentIndex > 0) {
      gameState.squizz.currentIndex--;
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
      io.to('host').emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: getConnectedPlayers().length
      });
    }
  });

  socket.on('host_trigger_cheer', ({ text }) => {
    io.emit('party_cheer', {
      text: text || '100% CẠN LY! ZÔ ZÔ ZÔ! 🍻🍻🍻'
    });
  });

  // --- QA EVENTS ---
  socket.on('player_answer_qa', ({ optionIndex }) => {
    const playerId = socket.playerId;
    if (!playerId) return;
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
      const timeLimitMs = (currentQ.timeLimit || 20) * 1000;
      const speedFraction = Math.max(0, 1 - (timeTakenMs / timeLimitMs) / 2);
      points = Math.round(500 + 500 * speedFraction);
    }

    const player = gameState.players.get(playerId);
    if (player) {
      player.score += points;
    }

    gameState.qa.answers[playerId] = {
      optionIndex,
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
    io.to('host').emit('qa_live_update', {
      stats,
      totalAnswered: stats.totalAnswered,
      totalPlayers: getConnectedPlayers().length
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
    gameState.qa.timer = setInterval(() => {
      gameState.qa.timeRemaining--;
      io.emit('qa_timer_tick', { timeRemaining: gameState.qa.timeRemaining });
      if (gameState.qa.timeRemaining <= 0) {
        clearInterval(gameState.qa.timer);
        gameState.qa.timer = null;
        endQaQuestion();
        revealQaAnswer(true);
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

    io.emit('qa_revealed', {
      correctAnswer: currentQ ? currentQ.correctAnswer : 0,
      explanation: currentQ ? currentQ.explanation : '',
      stats,
      leaderboard: leaderboard.slice(0, 10),
      auto
    });
  }

  socket.on('host_qa_start', ({ questionIndex = 0, timeLimit }) => {
    gameState.mode = 'QA';
    gameState.qa.currentIndex = questionIndex;
    gameState.qa.isOpen = true;
    gameState.qa.isRevealed = false;
    gameState.qa.answers = {};
    const q = qaQuestions[gameState.qa.currentIndex];
    gameState.qa.timeLimit = timeLimit !== undefined ? timeLimit : (q ? (q.timeLimit || 20) : 20);
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

    io.to('host').emit('qa_live_update', {
      stats: calculateQaStats(),
      totalAnswered: 0,
      totalPlayers: getConnectedPlayers().length
    });

    startQaTimer();
  });

  socket.on('host_qa_reveal', () => {
    revealQaAnswer(false);
  });

  socket.on('host_qa_next', () => {
    if (gameState.qa.currentIndex < qaQuestions.length - 1) {
      gameState.qa.currentIndex++;
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 20) : 20;
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
          timeLimit: q.timeLimit
        }
      });

      io.to('host').emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: getConnectedPlayers().length
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
      gameState.qa.timeLimit = q ? (q.timeLimit || 20) : 20;
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
          timeLimit: q.timeLimit
        }
      });

      io.to('host').emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: getConnectedPlayers().length
      });

      startQaTimer();
    }
  });

  socket.on('host_show_podium', () => {
    gameState.mode = 'PODIUM';
    if (gameState.qa.timer) clearInterval(gameState.qa.timer);
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
        role: m.role || '',
        avatar: avatar,
        score: 0,
        connected: true,
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
        io.to('host').emit('squizz_live_update', {
          tally,
          totalVotes: tally.totalVotes,
          totalPlayers: getConnectedPlayers().length
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
          const timeLimitMs = (currentQ.timeLimit || 20) * 1000;
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
        io.to('host').emit('qa_live_update', {
          stats,
          totalAnswered: stats.totalAnswered,
          totalPlayers: getConnectedPlayers().length
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
      io.to('host').emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: getConnectedPlayers().length
      });
    } else if (gameState.mode === 'QA') {
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 20) : 20;
      gameState.qa.timeRemaining = gameState.qa.timeLimit;
      gameState.qa.startTime = Date.now();

      io.emit('qa_question_started', {
        currentIndex: gameState.qa.currentIndex,
        total: qaQuestions.length,
        timeLimit: gameState.qa.timeLimit,
        question: q
      });
      io.to('host').emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: getConnectedPlayers().length
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
      gameState.squizz.currentIndex = Math.max(0, Math.min(squizzQuestions.length - 1, index));
      gameState.squizz.isOpen = true;
      gameState.squizz.isRevealed = false;
      gameState.squizz.votes = {};
      gameState.squizz.rawVotes = {};
      if (gameState.squizz.currentIndex === 0) {
        gameState.squizz.timeLimit = 30;
      }
      const q = squizzQuestions[gameState.squizz.currentIndex];
      io.emit('squizz_question_started', {
        currentIndex: gameState.squizz.currentIndex,
        total: squizzQuestions.length,
        timeLimit: gameState.squizz.timeLimit || 30,
        question: q
      });
      io.to('host').emit('squizz_live_update', {
        tally: calculateSquizzTally(),
        totalVotes: 0,
        totalPlayers: getConnectedPlayers().length
      });
    } else if (mode === 'QA') {
      gameState.qa.currentIndex = Math.max(0, Math.min(qaQuestions.length - 1, index));
      gameState.qa.isOpen = true;
      gameState.qa.isRevealed = false;
      gameState.qa.answers = {};
      const q = qaQuestions[gameState.qa.currentIndex];
      gameState.qa.timeLimit = q ? (q.timeLimit || 20) : 20;
      gameState.qa.timeRemaining = gameState.qa.timeLimit;
      gameState.qa.startTime = Date.now();

      io.emit('qa_question_started', {
        currentIndex: gameState.qa.currentIndex,
        total: qaQuestions.length,
        timeLimit: gameState.qa.timeLimit,
        question: q
      });
      io.to('host').emit('qa_live_update', {
        stats: calculateQaStats(),
        totalAnswered: 0,
        totalPlayers: getConnectedPlayers().length
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


