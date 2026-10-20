/**
 * 20/10 CELEBRATION & YI HE TANG ORDERING CLIENT SCRIPT
 * Bệnh viện ĐK Phương Đông • Phòng Tài Chính Kế Toán
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // App State
  const state = {
    members: [],
    menu: { categories: [], options: {} },
    selectedMember: null,
    currentDrink: null,
    selectedCategory: 'ALL',
    activeOrder: {
      size: 'M',
      sugar: '100% (Chuẩn)',
      ice: '100% (Chuẩn)',
      toppings: [],
      note: ''
    },
    soundEnabled: true
  };

  // DOM Elements
  const canvasPetals = document.getElementById('petals-canvas');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnChangeUser = document.getElementById('btn-change-user');
  const headerAvatar = document.getElementById('header-avatar');
  const headerUserName = document.getElementById('header-user-name');

  // Screens
  const screenLogin = document.getElementById('screen-login');
  const screenCard = document.getElementById('screen-card');
  const screenMenu = document.getElementById('screen-menu');
  const screenConfirmed = document.getElementById('screen-confirmed');

  // Login Screen Elements
  const smartSearchInput = document.getElementById('smart-search-input');
  const smartSuggestionBox = document.getElementById('smart-suggestion-box');
  const selectMember = document.getElementById('select-member');
  const memberPreviewCard = document.getElementById('member-preview-card');
  const previewAvatar = document.getElementById('preview-avatar');
  const previewName = document.getElementById('preview-name');
  const previewRole = document.getElementById('preview-role');
  const previewMs = document.getElementById('preview-ms');
  const btnProceedCard = document.getElementById('btn-proceed-card');
  const loginErrorBox = document.getElementById('login-error-box');

  // Card Screen Elements
  const envelopeElem = document.getElementById('envelope-elem');
  const envelopeTagName = document.getElementById('envelope-tag-name');
  const letterCard = document.getElementById('letter-card');
  const cardAvatarPill = document.getElementById('card-avatar-pill');
  const cardRolePill = document.getElementById('card-role-pill');
  const cardMsPill = document.getElementById('card-ms-pill');
  const cardRecipientName = document.getElementById('card-recipient-name');
  const cardWishText = document.getElementById('card-wish-text');
  const btnGotoOrder = document.getElementById('btn-goto-order');

  // Menu Screen Elements
  const menuUserName = document.getElementById('menu-user-name');
  const btnBackToCard = document.getElementById('btn-back-to-card');
  const catChipsContainer = document.getElementById('cat-chips-container');
  const drinksGridContainer = document.getElementById('drinks-grid-container');

  // Order Customization Modal
  const orderModalBackdrop = document.getElementById('order-modal-backdrop');
  const orderModalSheet = document.getElementById('order-modal-sheet');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalDrinkIcon = document.getElementById('modal-drink-icon');
  const modalDrinkName = document.getElementById('modal-drink-name');
  const modalDrinkBadge = document.getElementById('modal-drink-badge');
  const modalSizesGrid = document.getElementById('modal-sizes-grid');
  const modalSugarGrid = document.getElementById('modal-sugar-grid');
  const modalIceGrid = document.getElementById('modal-ice-grid');
  const modalToppingGrid = document.getElementById('modal-topping-grid');
  const modalNoteInput = document.getElementById('modal-note-input');
  const btnConfirmSubmitOrder = document.getElementById('btn-confirm-submit-order');

  // Confirmed Screen Elements
  const receiptDrinkName = document.getElementById('receipt-drink-name');
  const receiptMemberName = document.getElementById('receipt-member-name');
  const receiptSize = document.getElementById('receipt-size');
  const receiptSugar = document.getElementById('receipt-sugar');
  const receiptIce = document.getElementById('receipt-ice');
  const receiptToppings = document.getElementById('receipt-toppings');
  const receiptNote = document.getElementById('receipt-note');
  const btnReopenCard = document.getElementById('btn-reopen-card');
  const btnChangeOrder = document.getElementById('btn-change-order');

  // ==========================================
  // 1. FALLING ROSE PETALS CANVAS ENGINE
  // ==========================================
  function initPetalsCanvas() {
    if (!canvasPetals) return;
    const ctx = canvasPetals.getContext('2d');
    let width = (canvasPetals.width = window.innerWidth);
    let height = (canvasPetals.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvasPetals.width = window.innerWidth;
      height = canvasPetals.height = window.innerHeight;
    });

    const petalColors = ['#f43f5e', '#fb7185', '#fda4af', '#fbcfe8', '#fecdd3', '#e11d48'];
    const petals = [];
    const count = window.innerWidth < 768 ? 24 : 42;

    for (let i = 0; i < count; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        size: Math.random() * 9 + 7,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        speedY: Math.random() * 1.5 + 0.8,
        speedX: Math.random() * 1.2 - 0.6,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.03,
        oscillationSpeed: Math.random() * 0.02 + 0.01
      });
    }

    function renderPetals() {
      ctx.clearRect(0, 0, width, height);

      petals.forEach((p) => {
        p.y += p.speedY;
        p.x += Math.sin(p.y * p.oscillationSpeed) * 1.2 + p.speedX;
        p.angle += p.angularSpeed;

        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        // Draw delicate rose petal curve
        ctx.ellipse(0, 0, p.size, p.size * 0.65, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      requestAnimationFrame(renderPetals);
    }

    renderPetals();
  }

  // ==========================================
  // 2. CELEBRATION CHIME (WEB AUDIO API)
  // ==========================================
  function playCelebrationChime() {
    if (!state.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Chord: C5, E5, G5, B5, C6 (Lush celebratory chime)
      const freqs = [523.25, 659.25, 783.99, 987.77, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.09 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 1.5);
      });
    } catch (e) {
      console.warn('Audio chime note error:', e);
    }
  }

  // ==========================================
  // 3. FETCH DATA & INITIALIZE
  // ==========================================
  async function initApp() {
    initPetalsCanvas();

    try {
      const res = await fetch('/api/2010/status');
      const data = await res.json();
      state.members = data.members || [];
      state.menu = data.menu || { categories: [], options: {} };

      populateMemberDropdown();
      renderMenuCategories();
      renderDrinks();

      // Check saved member from localStorage
      const savedMemberId = localStorage.getItem('tckt_2010_member_id');
      if (savedMemberId) {
        const member = state.members.find(m => String(m.stt) === String(savedMemberId));
        if (member) {
          selectTargetMember(member);
          // If already ordered, go straight to confirmed screen
          if (member.hasOrdered && member.order) {
            showScreenConfirmed(member.order);
          } else if (member.hasOpenedCard) {
            showScreenCard();
            openEnvelope(false);
          } else {
            showScreenCard();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching 20/10 data:', err);
    }
  }

  function populateMemberDropdown() {
    if (!selectMember) return;
    selectMember.innerHTML = '<option value="">-- Chạm để chọn tên bạn (32 người) --</option>';

    state.members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.stt;
      opt.textContent = `[MS: ${m.ms}] ${m.name} - ${m.role}`;
      selectMember.appendChild(opt);
    });
  }

  // ==========================================
  // 4. SMART MEMBER IDENTIFICATION (MS / NAME)
  // ==========================================
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (smartSearchInput) {
    smartSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (!query) {
        smartSuggestionBox.style.display = 'none';
        return;
      }

      const qNorm = normalizeText(query);
      const qDigits = query.replace(/\D/g, '');

      // Match either by MS (exact or prefix) or Name or Role
      const matches = state.members.filter((m) => {
        const msClean = String(m.ms).trim();
        const msMatch = qDigits && (msClean === qDigits || msClean.startsWith(qDigits));
        const nameMatch = normalizeText(m.name).includes(qNorm);
        const roleMatch = normalizeText(m.role).includes(qNorm);
        return msMatch || nameMatch || roleMatch;
      });

      renderSuggestions(matches);
    });
  }

  function renderSuggestions(matches) {
    if (!smartSuggestionBox) return;
    smartSuggestionBox.innerHTML = '';

    if (matches.length === 0) {
      smartSuggestionBox.style.display = 'block';
      smartSuggestionBox.innerHTML = '<div style="color: #fca5a5; font-size: 0.85rem; padding: 6px;">Không tìm thấy thành viên khớp mã số/tên này!</div>';
      return;
    }

    smartSuggestionBox.style.display = 'flex';
    matches.slice(0, 6).forEach((m) => {
      const chip = document.createElement('div');
      chip.className = 'pill-opt';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '6px';
      chip.style.fontSize = '0.85rem';
      chip.style.padding = '6px 12px';
      chip.style.background = 'rgba(244, 63, 94, 0.2)';
      chip.style.borderColor = '#f43f5e';
      chip.innerHTML = `<span>${m.avatar || '🌸'}</span> <strong>${m.name}</strong> <span style="color: #fef08a;">(MS: ${m.ms})</span>`;

      chip.addEventListener('click', () => {
        selectTargetMember(m);
        smartSuggestionBox.style.display = 'none';
        smartSearchInput.value = `[MS: ${m.ms}] ${m.name}`;
      });

      smartSuggestionBox.appendChild(chip);
    });
  }

  if (selectMember) {
    selectMember.addEventListener('change', (e) => {
      const stt = e.target.value;
      if (!stt) {
        memberPreviewCard.style.display = 'none';
        state.selectedMember = null;
        return;
      }
      const member = state.members.find(m => String(m.stt) === String(stt));
      if (member) {
        selectTargetMember(member);
        smartSearchInput.value = `[MS: ${m.ms}] ${member.name}`;
      }
    });
  }

  function selectTargetMember(member) {
    state.selectedMember = member;
    if (memberPreviewCard) {
      memberPreviewCard.style.display = 'block';
      previewAvatar.textContent = member.avatar || '🌸';
      previewName.textContent = member.name;
      previewRole.textContent = member.role;
      previewMs.textContent = member.ms;
    }
    if (loginErrorBox) loginErrorBox.style.display = 'none';

    // Update Header
    if (headerAvatar) headerAvatar.textContent = member.avatar || '🌸';
    if (headerUserName) headerUserName.textContent = member.name;
    if (btnChangeUser) btnChangeUser.style.display = 'inline-block';
  }

  // ==========================================
  // 5. PROCEED TO CARD & OPEN ENVELOPE
  // ==========================================
  if (btnProceedCard) {
    btnProceedCard.addEventListener('click', async () => {
      if (!state.selectedMember) {
        if (loginErrorBox) {
          loginErrorBox.textContent = 'Vui lòng gõ Mã số (MS) hoặc chọn tên của bạn trong danh sách!';
          loginErrorBox.style.display = 'block';
        }
        return;
      }

      // Save to localStorage
      localStorage.setItem('tckt_2010_member_id', state.selectedMember.stt);

      // Call server to mark opened
      try {
        await fetch('/api/2010/open-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: state.selectedMember.stt, ms: state.selectedMember.ms })
        });
        socket.emit('2010_open_card', { memberId: state.selectedMember.stt, ms: state.selectedMember.ms });
      } catch (e) {
        console.error('Error marking card open:', e);
      }

      showScreenCard();
    });
  }

  function showScreenCard() {
    screenLogin.style.display = 'none';
    screenMenu.style.display = 'none';
    screenConfirmed.style.display = 'none';
    screenCard.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (state.selectedMember) {
      envelopeTagName.textContent = `Kính gửi: ${state.selectedMember.name} 🌸`;
      cardAvatarPill.textContent = state.selectedMember.avatar || '🌸';
      cardRolePill.textContent = state.selectedMember.role;
      cardMsPill.textContent = state.selectedMember.ms;
      cardRecipientName.textContent = state.selectedMember.name;
      cardWishText.textContent = state.selectedMember.wish || 'Chúc bạn luôn xinh đẹp, hạnh phúc, bình an và ngập tràn niềm vui!';
      if (menuUserName) menuUserName.textContent = state.selectedMember.name;
    }
  }

  if (envelopeElem) {
    envelopeElem.addEventListener('click', () => {
      openEnvelope(true);
    });
  }

  function openEnvelope(playEffects = true) {
    if (!envelopeElem) return;
    envelopeElem.classList.add('open');
    letterCard.style.display = 'block';

    if (playEffects) {
      playCelebrationChime();
      if (window.confetti && typeof window.confetti.burst === 'function') {
        window.confetti.burst(window.innerWidth / 2, window.innerHeight * 0.45);
      }
    }
  }

  // ==========================================
  // 6. GOTO ORDER & RENDER YIHETANG MENU
  // ==========================================
  if (btnGotoOrder) {
    btnGotoOrder.addEventListener('click', () => {
      screenCard.style.display = 'none';
      screenMenu.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (btnBackToCard) {
    btnBackToCard.addEventListener('click', () => {
      screenMenu.style.display = 'none';
      screenCard.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function renderMenuCategories() {
    if (!catChipsContainer || !state.menu.categories) return;
    catChipsContainer.innerHTML = '';

    // 'All' Chip
    const allChip = document.createElement('div');
    allChip.className = `cat-chip ${state.selectedCategory === 'ALL' ? 'active' : ''}`;
    allChip.textContent = '⭐ Tất Cả Món';
    allChip.addEventListener('click', () => {
      state.selectedCategory = 'ALL';
      renderMenuCategories();
      renderDrinks();
    });
    catChipsContainer.appendChild(allChip);

    state.menu.categories.forEach((cat) => {
      const chip = document.createElement('div');
      chip.className = `cat-chip ${state.selectedCategory === cat.category ? 'active' : ''}`;
      chip.textContent = cat.category;
      chip.addEventListener('click', () => {
        state.selectedCategory = cat.category;
        renderMenuCategories();
        renderDrinks();
      });
      catChipsContainer.appendChild(chip);
    });
  }

  function renderDrinks() {
    if (!drinksGridContainer || !state.menu.categories) return;
    drinksGridContainer.innerHTML = '';

    const drinksToRender = [];
    state.menu.categories.forEach((cat) => {
      if (state.selectedCategory === 'ALL' || state.selectedCategory === cat.category) {
        cat.items.forEach((item) => {
          drinksToRender.push({ ...item, category: cat.category });
        });
      }
    });

    drinksToRender.forEach((drink) => {
      const card = document.createElement('div');
      card.className = 'drink-card';
      card.innerHTML = `
        <div>
          <div class="drink-header">
            <div class="drink-icon-box">${drink.icon || '🧋'}</div>
            <div style="flex: 1;">
              <div class="drink-name">${drink.name}</div>
              ${drink.subName ? `<div style="font-size: 0.76rem; color: #94a3b8; font-style: italic; margin-top: 1px;">${drink.subName}</div>` : ''}
              ${drink.badge ? `<span class="drink-badge">${drink.badge}</span>` : ''}
            </div>
          </div>
          <div class="drink-desc">${drink.desc || ''}</div>
        </div>
        <button class="btn-select-drink">
          <span>CHỌN MÓN NÀY</span> <span>👉</span>
        </button>
      `;

      card.addEventListener('click', () => {
        openOrderModal(drink);
      });

      drinksGridContainer.appendChild(card);
    });
  }

  // ==========================================
  // 7. ORDER CUSTOMIZATION MODAL
  // ==========================================
  function openOrderModal(drink) {
    state.currentDrink = drink;
    state.activeOrder = {
      size: 'M',
      sugar: '100% (Chuẩn)',
      ice: '100% (Chuẩn)',
      toppings: [],
      note: ''
    };

    modalDrinkIcon.textContent = drink.icon || '🧋';
    modalDrinkName.textContent = drink.name;
    modalDrinkBadge.textContent = drink.badge || drink.category;
    modalNoteInput.value = '';

    // Reset Sizes
    Array.from(modalSizesGrid.children).forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-val') === 'M');
    });

    // Reset Sugar
    Array.from(modalSugarGrid.children).forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-val') === '100% (Chuẩn)');
    });

    // Reset Ice
    Array.from(modalIceGrid.children).forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-val') === '100% (Chuẩn)');
    });

    // Reset Toppings
    Array.from(modalToppingGrid.children).forEach(c => {
      c.classList.remove('selected');
    });

    orderModalBackdrop.style.display = 'flex';
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      orderModalBackdrop.style.display = 'none';
    });
  }

  if (orderModalBackdrop) {
    orderModalBackdrop.addEventListener('click', (e) => {
      if (e.target === orderModalBackdrop) {
        orderModalBackdrop.style.display = 'none';
      }
    });
  }

  // Wire Option Pill Selectors
  function setupPillGroup(container, onSelect) {
    if (!container) return;
    Array.from(container.children).forEach((pill) => {
      pill.addEventListener('click', () => {
        Array.from(container.children).forEach(c => c.classList.remove('selected'));
        pill.classList.add('selected');
        onSelect(pill.getAttribute('data-val'));
      });
    });
  }

  setupPillGroup(modalSizesGrid, (val) => { state.activeOrder.size = val; });
  setupPillGroup(modalSugarGrid, (val) => { state.activeOrder.sugar = val; });
  setupPillGroup(modalIceGrid, (val) => { state.activeOrder.ice = val; });

  // Multi-select Toppings
  if (modalToppingGrid) {
    Array.from(modalToppingGrid.children).forEach((pill) => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        const top = pill.getAttribute('data-top');
        if (pill.classList.contains('selected')) {
          if (!state.activeOrder.toppings.includes(top)) state.activeOrder.toppings.push(top);
        } else {
          state.activeOrder.toppings = state.activeOrder.toppings.filter(t => t !== top);
        }
      });
    });
  }

  // Confirm Submit Order
  if (btnConfirmSubmitOrder) {
    btnConfirmSubmitOrder.addEventListener('click', async () => {
      if (!state.selectedMember || !state.currentDrink) return;

      btnConfirmSubmitOrder.disabled = true;
      btnConfirmSubmitOrder.textContent = 'Đang gửi order... ⏳';

      state.activeOrder.note = modalNoteInput.value.trim();

      const orderPayload = {
        drinkId: state.currentDrink.id,
        drinkName: state.currentDrink.name,
        category: state.currentDrink.category,
        size: state.activeOrder.size,
        sugar: state.activeOrder.sugar,
        ice: state.activeOrder.ice,
        toppings: state.activeOrder.toppings,
        note: state.activeOrder.note
      };

      try {
        const res = await fetch('/api/2010/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: state.selectedMember.stt,
            ms: state.selectedMember.ms,
            order: orderPayload
          })
        });
        const result = await res.json();

        socket.emit('2010_submit_order', {
          memberId: state.selectedMember.stt,
          ms: state.selectedMember.ms,
          order: orderPayload
        });

        orderModalBackdrop.style.display = 'none';
        showScreenConfirmed(orderPayload);
      } catch (err) {
        alert('Lỗi gửi order: ' + err.message);
      } finally {
        btnConfirmSubmitOrder.disabled = false;
        btnConfirmSubmitOrder.textContent = 'XÁC NHẬN GỬI ORDER NÀY 🚀';
      }
    });
  }

  // ==========================================
  // 8. CONFIRMED SCREEN VIEW
  // ==========================================
  function showScreenConfirmed(order) {
    screenLogin.style.display = 'none';
    screenCard.style.display = 'none';
    screenMenu.style.display = 'none';
    screenConfirmed.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    playCelebrationChime();
    if (window.confetti && typeof window.confetti.burst === 'function') {
      window.confetti.burst(window.innerWidth / 2, window.innerHeight * 0.4);
    }

    receiptDrinkName.textContent = order.drinkName;
    receiptMemberName.textContent = state.selectedMember ? `${state.selectedMember.name} (MS: ${state.selectedMember.ms})` : '';
    receiptSize.textContent = order.size === 'L' ? 'Size L (Lớn)' : 'Size M (Vừa)';
    receiptSugar.textContent = order.sugar || '100% (Chuẩn)';
    receiptIce.textContent = order.ice || '100% (Chuẩn)';
    receiptToppings.textContent = Array.isArray(order.toppings) && order.toppings.length > 0 ? order.toppings.join(', ') : 'Không thêm topping';
    receiptNote.textContent = order.note && order.note.trim() ? order.note.trim() : 'Không có ghi chú';
  }

  if (btnReopenCard) {
    btnReopenCard.addEventListener('click', () => {
      showScreenCard();
      openEnvelope(false);
    });
  }

  if (btnChangeOrder) {
    btnChangeOrder.addEventListener('click', () => {
      screenConfirmed.style.display = 'none';
      screenMenu.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (btnChangeUser) {
    btnChangeUser.addEventListener('click', () => {
      if (confirm('Bạn có muốn đổi sang chọn thành viên khác?')) {
        localStorage.removeItem('tckt_2010_member_id');
        location.reload();
      }
    });
  }

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      btnSoundToggle.textContent = state.soundEnabled ? '🔊 Bật Nhạc' : '🔇 Tắt Nhạc';
    });
  }

  // Start app
  initApp();
});
