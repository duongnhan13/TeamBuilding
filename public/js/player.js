// Mobile Player Client Logic
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const AVATARS = ['😎', '🦁', '🐯', '🚀', '🍺', '🥳', '👑', '🔥', '⚡', '🍕', '🎯', '💃', '🕺', '🐱', '🦊', '🐉', '🍷', '🦸'];
  let selectedAvatar = '😎';

  let playerState = {
    id: localStorage.getItem('tckt_player_id') || null,
    nickname: localStorage.getItem('tckt_player_nick') || '',
    avatar: localStorage.getItem('tckt_player_avatar') || '😎',
    score: 0,
    hasJoined: false,
    currentMode: 'LOBBY',
    myVote: null,
    myAnswer: null,
    members: []
  };

  // Screens
  const screens = {
    join: document.getElementById('screen-join'),
    waiting: document.getElementById('screen-waiting'),
    squizz: document.getElementById('screen-squizz'),
    qa: document.getElementById('screen-qa')
  };

  const elPlayerHeader = document.getElementById('player-header');
  const elMyAvatar = document.getElementById('my-avatar');
  const elMyNickname = document.getElementById('my-nickname');
  const elMyScoreTag = document.getElementById('my-score-tag');
  const elWaitAvatar = document.getElementById('wait-avatar');

  function showScreen(name) {
    Object.keys(screens).forEach(key => {
      if (screens[key]) screens[key].style.display = key === name ? 'flex' : 'none';
    });
    if (elPlayerHeader) {
      elPlayerHeader.style.display = (name === 'join') ? 'none' : 'flex';
    }
  }

  // Populate Avatar Selector
  const avatarListContainer = document.getElementById('avatar-list');
  if (avatarListContainer) {
    avatarListContainer.innerHTML = '';
    AVATARS.forEach(emoji => {
      const btn = document.createElement('div');
      btn.className = 'avatar-choice' + (emoji === playerState.avatar ? ' selected' : '');
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = emoji;
      });
      avatarListContainer.appendChild(btn);
    });
    selectedAvatar = playerState.avatar;
  }

  // Pre-fill nickname if stored
  const inputNick = document.getElementById('input-nickname');
  if (inputNick && playerState.nickname) {
    inputNick.value = playerState.nickname;
  }

  // Join Action
  document.getElementById('btn-submit-join').addEventListener('click', () => {
    const nick = inputNick.value.trim();
    if (!nick) {
      alert('Vui lòng nhập họ và tên của bạn!');
      inputNick.focus();
      return;
    }

    playerState.nickname = nick;
    playerState.avatar = selectedAvatar;

    socket.emit('player_join', {
      id: playerState.id,
      nickname: playerState.nickname,
      avatar: playerState.avatar
    });
  });

  socket.on('player_joined_success', ({ player, gameState, members }) => {
    playerState.id = player.id;
    playerState.nickname = player.nickname;
    playerState.avatar = player.avatar;
    playerState.score = player.score;
    playerState.hasJoined = true;
    playerState.members = members || [];

    // Save to local storage
    localStorage.setItem('tckt_player_id', player.id);
    localStorage.setItem('tckt_player_nick', player.nickname);
    localStorage.setItem('tckt_player_avatar', player.avatar);

    elMyAvatar.textContent = player.avatar;
    elMyNickname.textContent = player.nickname;
    elMyScoreTag.textContent = `${player.score.toLocaleString()} điểm`;
    elWaitAvatar.textContent = player.avatar;

    renderMemberSuggestions(playerState.members);

    // Sync current mode
    syncServerState(gameState);
  });

  socket.on('join_error', ({ message }) => {
    alert(message || 'Không thể tham gia phòng!');
  });

  socket.on('members_updated', (members) => {
    playerState.members = members;
    renderMemberSuggestions(members);
  });

  function renderMemberSuggestions(members) {
    const box = document.getElementById('member-suggestions');
    if (!box) return;
    box.innerHTML = '';
    (members || []).forEach(name => {
      const tag = document.createElement('div');
      tag.className = 'sugg-tag';
      tag.textContent = name;
      tag.addEventListener('click', () => {
        const input = document.getElementById('input-squizz-name');
        if (input) {
          input.value = name;
          input.focus();
          if (navigator.vibrate) navigator.vibrate(30);
        }
      });
      box.appendChild(tag);
    });
  }

  function syncServerState(state) {
    if (!state) return;
    playerState.currentMode = state.mode;

    if (state.mode === 'SQUIZZ' && state.squizz && state.squizz.question) {
      renderPlayerSquizz(state.squizz.question, state.squizz.currentIndex, 10);
      if (state.squizz.myVote) {
        setSquizzVoted(state.squizz.myVote);
      }
      showScreen('squizz');
    } else if (state.mode === 'QA' && state.qa && state.qa.question) {
      renderPlayerQa(state.qa.question, state.qa.currentIndex, 15);
      showScreen('qa');
    } else {
      showScreen('waiting');
    }
  }

  socket.on('game_mode_changed', ({ mode }) => {
    playerState.currentMode = mode;
    if (mode === 'LOBBY' || mode === 'PODIUM') {
      showScreen('waiting');
    }
  });

  // --- SQUIZZ EVENTS ---
  const elSqIndex = document.getElementById('player-sq-index');
  const elSqTitle = document.getElementById('player-sq-title');
  const elSqQuestion = document.getElementById('player-sq-question');
  const elSqVoteForm = document.getElementById('sq-vote-form');
  const elSqVoteDone = document.getElementById('sq-vote-done');
  const elSqMyVotedName = document.getElementById('sq-my-voted-name');
  const inputSquizzName = document.getElementById('input-squizz-name');

  function renderPlayerSquizz(q, index, total) {
    elSqIndex.textContent = `CÂU ${index + 1} / ${total || 10}`;
    elSqTitle.textContent = q.title || `Câu hỏi ${index + 1}`;
    elSqQuestion.textContent = q.question;

    elSqVoteForm.style.display = 'block';
    elSqVoteDone.style.display = 'none';
    inputSquizzName.value = '';
    playerState.myVote = null;
  }

  function setSquizzVoted(name) {
    playerState.myVote = name;
    elSqMyVotedName.textContent = name;
    elSqVoteForm.style.display = 'none';
    elSqVoteDone.style.display = 'block';
  }

  socket.on('squizz_question_started', ({ currentIndex, total, question }) => {
    renderPlayerSquizz(question, currentIndex, total);
    showScreen('squizz');
    if (navigator.vibrate) navigator.vibrate(50);
  });

  document.getElementById('btn-submit-vote').addEventListener('click', () => {
    const name = inputSquizzName.value.trim();
    if (!name) {
      alert('Vui lòng nhập tên người bạn muốn bình chọn!');
      inputSquizzName.focus();
      return;
    }
    socket.emit('player_vote_squizz', { name });
  });

  socket.on('squizz_vote_accepted', ({ chosenName }) => {
    setSquizzVoted(chosenName);
    if (window.soundFX) window.soundFX.playCorrect();
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
  });

  document.getElementById('btn-change-vote').addEventListener('click', () => {
    elSqVoteDone.style.display = 'none';
    elSqVoteForm.style.display = 'block';
    inputSquizzName.focus();
  });

  // --- QA EVENTS ---
  const elPlayerQaCat = document.getElementById('player-qa-cat');
  const elPlayerQaIndex = document.getElementById('player-qa-index');
  const elPlayerQaQuestion = document.getElementById('player-qa-question');
  const elPlayerQaResult = document.getElementById('player-qa-result');
  const elPlayerQaResultTitle = document.getElementById('player-qa-result-title');
  const elPlayerQaResultPoints = document.getElementById('player-qa-result-points');

  function renderPlayerQa(q, index, total) {
    elPlayerQaCat.textContent = `${q.icon || '⚔️'} ${q.category || 'Đố vui'}`;
    elPlayerQaIndex.textContent = `CÂU ${index + 1} / ${total || 15}`;
    elPlayerQaQuestion.textContent = q.question;

    elPlayerQaResult.style.display = 'none';
    playerState.myAnswer = null;

    for (let i = 0; i < 4; i++) {
      const label = document.getElementById(`p-opt-${i}`);
      const btn = document.querySelector(`.mobile-opt-btn[data-opt="${i}"]`);
      if (label && q.options) {
        label.textContent = q.options[i] || '';
      }
      if (btn) {
        btn.classList.remove('selected', 'dimmed');
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }

  socket.on('qa_question_started', ({ currentIndex, total, question }) => {
    renderPlayerQa(question, currentIndex, total);
    showScreen('qa');
    if (navigator.vibrate) navigator.vibrate(50);
  });

  document.querySelectorAll('.mobile-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (playerState.myAnswer !== null) return;
      const optIdx = parseInt(btn.getAttribute('data-opt'), 10);
      playerState.myAnswer = optIdx;

      // Highlight selected
      document.querySelectorAll('.mobile-opt-btn').forEach(b => {
        b.disabled = true;
        if (b === btn) {
          b.classList.add('selected');
        } else {
          b.style.opacity = '0.4';
        }
      });

      socket.emit('player_answer_qa', { optionIndex: optIdx });
      if (navigator.vibrate) navigator.vibrate(40);
    });
  });

  socket.on('qa_answer_accepted', ({ optionIndex, pointsAwarded, isCorrect }) => {
    // Answer accepted, wait for reveal
  });

  socket.on('qa_revealed', ({ correctAnswer, explanation, leaderboard }) => {
    if (playerState.myAnswer !== null) {
      const isCorrect = (playerState.myAnswer === correctAnswer);
      elPlayerQaResult.style.display = 'block';

      if (isCorrect) {
        elPlayerQaResult.style.background = 'rgba(16, 185, 129, 0.2)';
        elPlayerQaResult.style.border = '1px solid var(--emerald)';
        elPlayerQaResultTitle.style.color = '#34d399';
        elPlayerQaResultTitle.textContent = '🎉 CHÍNH XÁC!';
        elPlayerQaResultPoints.textContent = 'Bạn đã ghi điểm trong câu hỏi này!';
        if (window.soundFX) window.soundFX.playCorrect();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        elPlayerQaResult.style.background = 'rgba(244, 63, 94, 0.2)';
        elPlayerQaResult.style.border = '1px solid var(--rose)';
        elPlayerQaResultTitle.style.color = '#fb7185';
        elPlayerQaResultTitle.textContent = '😅 RẤT TIẾC, CHƯA ĐÚNG!';
        elPlayerQaResultPoints.textContent = 'Cố gắng ở câu tiếp theo nhé!';
        if (window.soundFX) window.soundFX.playWrong();
      }
    }

    // Update my score
    const me = (leaderboard || []).find(p => p.id === playerState.id);
    if (me) {
      playerState.score = me.score;
      elMyScoreTag.textContent = `${me.score.toLocaleString()} điểm`;
    }
  });

  socket.on('scores_reset', () => {
    playerState.score = 0;
    elMyScoreTag.textContent = '0 điểm';
  });

  // Cheer / Party Toast
  const cheerOverlay = document.getElementById('cheer-overlay');
  const cheerTitle = document.getElementById('cheer-overlay-title');

  socket.on('party_cheer', ({ text }) => {
    if (cheerTitle) cheerTitle.textContent = text || '100% CẠN CHÉN! ZÔ ZÔ!';
    if (cheerOverlay) cheerOverlay.style.display = 'flex';
    if (window.soundFX) window.soundFX.playGlassClink();
    if (navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 300]);
  });

  document.getElementById('btn-close-cheer').addEventListener('click', () => {
    if (cheerOverlay) cheerOverlay.style.display = 'none';
  });

  // If already logged in, try reconnecting automatically
  if (playerState.id && playerState.nickname) {
    socket.emit('player_join', {
      id: playerState.id,
      nickname: playerState.nickname,
      avatar: playerState.avatar
    });
  }
});
