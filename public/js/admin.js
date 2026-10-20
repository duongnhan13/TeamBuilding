/**
 * 20/10 GREETINGS & YI HE TANG ORDER MANAGEMENT (ADMIN)
 * Bệnh viện ĐK Phương Đông • Phòng Tài Chính Kế Toán
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // State
  let adminState = {
    members: [],
    stats: { totalMembers: 32, openedCount: 0, orderedCount: 0, unopenedCount: 32 },
    summary: {},
    currentFilter: 'ALL', // 'ALL', 'ORDERED', 'OPENED', 'UNOPENED'
    searchQuery: ''
  };

  // DOM Elements
  const statTotalMembers = document.getElementById('stat-total-members');
  const statOpenedCount = document.getElementById('stat-opened-count');
  const statOrderedCount = document.getElementById('stat-ordered-count');
  const statUnopenedCount = document.getElementById('stat-unopened-count');
  const barOpened = document.getElementById('bar-opened');
  const barOrdered = document.getElementById('bar-ordered');

  const tabSummaryTotalCups = document.getElementById('tab-summary-total-cups');
  const summaryGroupsContainer = document.getElementById('summary-groups-container');
  const zaloCopyText = document.getElementById('zalo-copy-text');
  const btnCopyZalo = document.getElementById('btn-copy-zalo');
  const btnCopyZaloTab = document.getElementById('btn-copy-zalo-tab');
  const btnRefreshData = document.getElementById('btn-refresh-data');

  const pillAllCount = document.getElementById('pill-all-count');
  const pillOrderedCount = document.getElementById('pill-ordered-count');
  const pillOpenedCount = document.getElementById('pill-opened-count');
  const pillUnopenedCount = document.getElementById('pill-unopened-count');
  const filterPillsGroup = document.getElementById('filter-pills-group');
  const adminSearchInput = document.getElementById('admin-search-input');
  const adminMembersTbody = document.getElementById('admin-members-tbody');

  // Socket setup
  socket.on('connect', () => {
    socket.emit('admin_join');
    socket.emit('2010_join');
  });

  socket.on('2010_init', (data) => {
    updateData(data);
  });

  socket.on('2010_update', (data) => {
    updateData(data);
  });

  socket.on('2010_card_opened', (payload) => {
    showToast(`💌 ${payload.name} (MS: ${payload.ms}) vừa mở thiệp chúc mừng!`);
  });

  socket.on('2010_order_placed', (payload) => {
    showToast(`🧋 ${payload.name} (MS: ${payload.ms}) vừa đặt "${payload.order ? payload.order.drinkName : ''}"!`, '#10b981');
  });

  // Fetch data from API
  async function fetchStatus() {
    try {
      const res = await fetch('/api/2010/status');
      const data = await res.json();
      updateData(data);
    } catch (err) {
      console.error('Error fetching admin 2010 status:', err);
    }
  }

  function updateData(data) {
    if (!data) return;
    adminState.members = data.members || [];
    adminState.stats = data.stats || { totalMembers: 32, openedCount: 0, orderedCount: 0, unopenedCount: 32 };
    adminState.summary = data.summary || {};

    renderKPIs();
    renderSummary();
    renderTable();
  }

  // Render KPI cards
  function renderKPIs() {
    const s = adminState.stats;
    if (statTotalMembers) statTotalMembers.textContent = s.totalMembers;
    if (statOpenedCount) statOpenedCount.textContent = s.openedCount;
    if (statOrderedCount) statOrderedCount.textContent = s.orderedCount;
    if (statUnopenedCount) statUnopenedCount.textContent = s.unopenedCount;

    const total = s.totalMembers || 32;
    const openedPct = Math.round((s.openedCount / total) * 100);
    const orderedPct = Math.round((s.orderedCount / total) * 100);

    if (barOpened) barOpened.style.width = `${openedPct}%`;
    if (barOrdered) barOrdered.style.width = `${orderedPct}%`;

    // Filter pill numbers
    if (pillAllCount) pillAllCount.textContent = total;
    if (pillOrderedCount) pillOrderedCount.textContent = s.orderedCount;
    if (pillOpenedCount) pillOpenedCount.textContent = Math.max(0, s.openedCount - s.orderedCount);
    if (pillUnopenedCount) pillUnopenedCount.textContent = s.unopenedCount;
  }

  // Format Time
  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return iso;
    }
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Render Bulk Order Summary
  function renderSummary() {
    if (!summaryGroupsContainer) return;
    summaryGroupsContainer.innerHTML = '';

    const summary = adminState.summary || {};
    const keys = Object.keys(summary);
    let totalCups = 0;

    let zaloText = `📋 DANH SÁCH ĐẶT TRÀ SỮA YI HE TANG - 20/10 PHÒNG TCKT\n`;
    zaloText += `📅 Thời gian xuất: ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}\n`;

    if (keys.length === 0) {
      summaryGroupsContainer.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.08); border: 1.5px dashed rgba(245, 158, 11, 0.4); border-radius: 18px; padding: 28px 20px; text-align: center;">
          <div style="font-size: 2.4rem; margin-bottom: 8px;">🧋✨</div>
          <h4 style="font-size: 1.2rem; font-weight: 900; color: #fef08a; margin-bottom: 6px;">
            HỆ THỐNG GOM ĐƠN TỰ ĐỘNG ĐANG HOẠT ĐỘNG
          </h4>
          <p style="font-size: 0.94rem; color: #cbd5e1; max-width: 620px; margin: 0 auto 16px; line-height: 1.6;">
            Hiện tại chưa có ai gửi order. Ngay khi các chị em mở thiệp trên điện thoại và chọn món, hệ thống sẽ <strong>tự động gom số lượng theo món (Size M, Size L), topping và ghi chú</strong> ngay tại bảng này để bạn gọi quán hoặc copy vào Zalo!
          </p>
          <a href="/player.html" target="_blank" class="btn" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #f43f5e, #be123c); color: #fff; font-size: 0.92rem; font-weight: 800; border-radius: 12px; padding: 9px 20px; text-decoration: none;">
            💌 Mở giao diện thiệp để đặt thử 1 món ↗
          </a>
        </div>
      `;
      if (tabSummaryTotalCups) tabSummaryTotalCups.textContent = '0';
      if (zaloCopyText) zaloCopyText.value = 'Chưa có đơn hàng nào được đặt.';
      return;
    }

    let summaryItemsText = `\n🧋 TỔNG HỢP THEO MÓN:\n`;
    let index = 1;

    keys.forEach((key) => {
      const item = summary[key];
      totalCups += item.totalCount;

      const topEntries = Object.entries(item.toppings || {});
      const topStr = topEntries.length > 0 ? topEntries.map(([t, c]) => `${t} (x${c})`).join(', ') : 'Không có';

      summaryItemsText += `${index++}. ${item.drinkName}: ${item.totalCount} ly (Size M: ${item.sizeM}, Size L: ${item.sizeL})\n`;
      if (topEntries.length > 0) summaryItemsText += `   + Topping: ${topStr}\n`;
      if (item.notes && item.notes.length > 0) {
        summaryItemsText += `   + Ghi chú: ${item.notes.join('; ')}\n`;
      }

      const card = document.createElement('div');
      card.className = 'summary-drink-group';
      card.innerHTML = `
        <div style="flex: 1; min-width: 250px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 1.18rem; color: #6ee7b7;">${escapeHtml(item.drinkName)}</strong>
          </div>
          <div style="font-size: 0.88rem; color: #cbd5e1; margin-top: 5px;">
            ✨ Topping kèm theo: <span style="color: #fef08a; font-weight: 700;">${escapeHtml(topStr)}</span>
          </div>
          ${item.notes && item.notes.length > 0 ? `
            <div style="font-size: 0.82rem; color: #fbcfe8; margin-top: 5px; font-style: italic;">
              💬 Ghi chú (${item.notes.length}): ${escapeHtml(item.notes.join(' | '))}
            </div>
          ` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="text-align: right;">
            <div style="font-size: 0.82rem; color: #94a3b8;">Chi tiết size:</div>
            <div style="font-size: 0.98rem; font-weight: 800; color: #fef08a;">
              ${item.sizeM} Size M • ${item.sizeL} Size L
            </div>
          </div>
          <div style="background: rgba(16, 185, 129, 0.2); border: 1.5px solid var(--emerald); border-radius: 14px; padding: 8px 18px; text-align: center; min-width: 72px;">
            <div style="font-size: 1.5rem; font-weight: 900; color: #6ee7b7; line-height: 1;">
              ${item.totalCount}
            </div>
            <div style="font-size: 0.72rem; color: #cbd5e1; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
              Cốc
            </div>
          </div>
        </div>
      `;
      summaryGroupsContainer.appendChild(card);
    });

    if (tabSummaryTotalCups) tabSummaryTotalCups.textContent = totalCups;

    // Detailed list text for Zalo
    let detailsText = `\n👥 CHI TIẾT TỪNG THÀNH VIÊN ĐÃ ĐẶT:\n`;
    let mIdx = 1;
    adminState.members.filter(m => m.hasOrdered && m.order).forEach((m) => {
      const o = m.order;
      const topList = Array.isArray(o.toppings) && o.toppings.length > 0 ? ` | Topping: ${o.toppings.join(', ')}` : '';
      const noteStr = o.note ? ` | Note: "${o.note}"` : '';
      detailsText += `${mIdx++}. ${m.name} (MS: ${m.ms}): ${o.drinkName} (Size ${o.size}, ${o.sugar}, ${o.ice}${topList}${noteStr})\n`;
    });

    zaloText += `Tổng cộng: ${totalCups} cốc trà sữa\n`;
    zaloText += summaryItemsText;
    zaloText += detailsText;

    if (zaloCopyText) zaloCopyText.value = zaloText;
  }

  // Render detailed table
  function renderTable() {
    if (!adminMembersTbody) return;
    adminMembersTbody.innerHTML = '';

    const q = adminState.searchQuery.trim().toLowerCase();
    const filter = adminState.currentFilter;

    const filtered = adminState.members.filter((m) => {
      // 1. Search Query
      if (q) {
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const msMatch = String(m.ms || '').toLowerCase().includes(q);
        const roleMatch = (m.role || '').toLowerCase().includes(q);
        const zodiacMatch = (m.zodiacSign || '').toLowerCase().includes(q);
        const drinkMatch = m.order && (m.order.drinkName || '').toLowerCase().includes(q);
        if (!nameMatch && !msMatch && !roleMatch && !zodiacMatch && !drinkMatch) return false;
      }

      // 2. Status Filter
      if (filter === 'ORDERED') return m.hasOrdered;
      if (filter === 'OPENED') return m.hasOpenedCard && !m.hasOrdered;
      if (filter === 'UNOPENED') return !m.hasOpenedCard;
      return true;
    });

    if (filtered.length === 0) {
      adminMembersTbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 35px; color: #94a3b8; font-style: italic;">
            Không có thành viên nào khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((m) => {
      const tr = document.createElement('tr');

      // Status Badge
      let statusBadge = '<span class="admin-status-badge badge-unopened">🔴 Chưa mở thiệp</span>';
      if (m.hasOrdered) {
        statusBadge = '<span class="admin-status-badge badge-ordered">🟢 Đã đặt món</span>';
      } else if (m.hasOpenedCard) {
        statusBadge = '<span class="admin-status-badge badge-opened">🟡 Đã xem thiệp</span>';
      }

      // Zodiac Pill
      const zodiacHtml = m.zodiacSign 
        ? `<span class="zodiac-table-pill">${escapeHtml(m.zodiacIcon || '✨')} ${escapeHtml(m.zodiacSign)}</span>`
        : '<span style="color: #64748b;">--</span>';

      // Order Details HTML
      let orderHtml = '<span style="color: #64748b; font-style: italic;">Chưa chọn món</span>';
      if (m.hasOrdered && m.order) {
        const o = m.order;
        const topStr = Array.isArray(o.toppings) && o.toppings.length > 0 ? o.toppings.join(', ') : 'Không topping';
        orderHtml = `
          <div>
            <div style="font-weight: 800; color: #6ee7b7; font-size: 0.98rem;">
              ${escapeHtml(o.drinkName)} 
              <span style="color: #fef08a; font-size: 0.82rem; background: rgba(245, 158, 11, 0.2); padding: 1px 6px; border-radius: 4px; margin-left: 4px;">Size ${o.size || 'M'}</span>
            </div>
            <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 3px;">
              🍬 ${escapeHtml(o.sugar || '100%')} • 🧊 ${escapeHtml(o.ice || '100%')} • 🧋 ${escapeHtml(topStr)}
            </div>
            ${o.note ? `<div style="font-size: 0.78rem; color: #fbcfe8; font-style: italic; margin-top: 2px;">💬 "${escapeHtml(o.note)}"</div>` : ''}
          </div>
        `;
      } else if (m.hasOpenedCard) {
        orderHtml = '<span style="color: #fef08a; font-size: 0.85rem;">💌 Đã đọc lời chúc, đang chọn món...</span>';
      }

      // Timestamp
      let timeHtml = '<span style="color: #64748b;">--</span>';
      if (m.orderedAt) {
        timeHtml = `<div style="font-size: 0.82rem; font-weight: 700; color: #6ee7b7;">Đặt: ${formatTime(m.orderedAt)}</div>`;
        if (m.openedAt) timeHtml += `<div style="font-size: 0.74rem; color: #94a3b8;">Mở: ${formatTime(m.openedAt)}</div>`;
      } else if (m.openedAt) {
        timeHtml = `<div style="font-size: 0.82rem; color: #fef08a;">Mở: ${formatTime(m.openedAt)}</div>`;
      }

      tr.innerHTML = `
        <td style="font-weight: 700; color: #94a3b8;">${m.stt}</td>
        <td>
          <span style="font-family: monospace; font-weight: 900; background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 6px; color: #fef08a;">
            ${escapeHtml(m.ms)}
          </span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">${m.avatar || '🌸'}</span>
            <strong style="font-size: 0.98rem; color: #fff;">${escapeHtml(m.name)}</strong>
          </div>
        </td>
        <td>${zodiacHtml}</td>
        <td style="color: #cbd5e1; font-size: 0.88rem;">${escapeHtml(m.role)}</td>
        <td>${statusBadge}</td>
        <td>${orderHtml}</td>
        <td>${timeHtml}</td>
        <td style="text-align: center;">
          ${m.hasOrdered ? `<button class="btn btn-secondary btn-reset-order" data-id="${m.stt}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 8px;" title="Reset đơn để thành viên đặt lại">🔄</button>` : ''}
        </td>
      `;

      adminMembersTbody.appendChild(tr);
    });

    // Attach reset handlers
    document.querySelectorAll('.btn-reset-order').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mId = btn.getAttribute('data-id');
        const member = adminState.members.find(m => String(m.stt) === String(mId));
        if (confirm(`Bạn có chắc muốn hủy đơn đặt của "${member ? member.name : mId}" để thành viên chọn lại món?`)) {
          try {
            await fetch('/api/2010/reset-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ memberId: mId })
            });
            fetchStatus();
          } catch (e) {
            alert('Lỗi: ' + e.message);
          }
        }
      });
    });
  }

  // Toast helper
  function showToast(msg, bg = '#be123c') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.background = bg;
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '14px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.4)';
    toast.style.fontWeight = '800';
    toast.style.fontSize = '0.95rem';
    toast.style.zIndex = '999999';
    toast.style.animation = 'popIn 0.3s ease';
    toast.textContent = msg;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // Copy Zalo Text
  function copyZaloHandler() {
    if (!zaloCopyText || !zaloCopyText.value) return;
    navigator.clipboard.writeText(zaloCopyText.value).then(() => {
      showToast('📋 Đã copy danh sách đặt quán vào clipboard! Bạn có thể dán vào Zalo ngay.', '#059669');
    }).catch(err => {
      alert('Không thể copy: ' + err);
    });
  }

  if (btnCopyZalo) btnCopyZalo.addEventListener('click', copyZaloHandler);
  if (btnCopyZaloTab) btnCopyZaloTab.addEventListener('click', copyZaloHandler);

  // Filter Pills
  if (filterPillsGroup) {
    Array.from(filterPillsGroup.children).forEach((pill) => {
      pill.addEventListener('click', () => {
        Array.from(filterPillsGroup.children).forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        adminState.currentFilter = pill.getAttribute('data-filter') || 'ALL';
        renderTable();
      });
    });
  }

  // Search Input
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      adminState.searchQuery = e.target.value;
      renderTable();
    });
  }

  // Refresh Button
  if (btnRefreshData) {
    btnRefreshData.addEventListener('click', () => {
      btnRefreshData.textContent = '⏳ Đang tải...';
      fetchStatus().finally(() => {
        btnRefreshData.textContent = '🔄 Làm Mới';
        showToast('Đã làm mới dữ liệu!');
      });
    });
  }

  // Periodic Auto-refresh (Every 8 seconds) in case of background updates
  setInterval(fetchStatus, 8000);

  // Initial Fetch
  fetchStatus();
});
