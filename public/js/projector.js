/**
 * 20/10 CELEBRATION PROJECTOR DISPLAY SCRIPT
 * Bệnh viện ĐK Phương Đông • Phòng Tài Chính Kế Toán
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const canvasPetals = document.getElementById('petals-canvas');
  const projOpenedCount = document.getElementById('proj-opened-count');
  const projOrderedCount = document.getElementById('proj-ordered-count');
  const projQrImg = document.getElementById('proj-qr-img');
  const projJoinUrl = document.getElementById('proj-join-url');
  const projTickerContent = document.getElementById('proj-ticker-content');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // 1. Falling Petals Canvas Engine
  function initPetalsCanvas() {
    if (!canvasPetals) return;
    const ctx = canvasPetals.getContext('2d');
    let width = (canvasPetals.width = window.innerWidth);
    let height = (canvasPetals.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvasPetals.width = window.innerWidth;
      height = canvasPetals.height = window.innerHeight;
    });

    const petalColors = ['#f43f5e', '#fb7185', '#fda4af', '#fbcfe8', '#fecdd3', '#e11d48', '#f59e0b'];
    const petals = [];
    const count = 48;

    for (let i = 0; i < count; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        size: Math.random() * 11 + 8,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        speedY: Math.random() * 1.6 + 0.9,
        speedX: Math.random() * 1.4 - 0.7,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.03,
        oscillationSpeed: Math.random() * 0.02 + 0.01
      });
    }

    function renderPetals() {
      ctx.clearRect(0, 0, width, height);

      petals.forEach((p) => {
        p.y += p.speedY;
        p.x += Math.sin(p.y * p.oscillationSpeed) * 1.3 + p.speedX;
        p.angle += p.angularSpeed;

        if (p.y > height + 25) {
          p.y = -25;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.65, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      requestAnimationFrame(renderPetals);
    }

    renderPetals();
  }

  // 2. Fetch Network / QR Info
  async function fetchInfo() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      if (projQrImg && data.qrCodeData) {
        projQrImg.src = data.qrCodeData;
      }
      if (projJoinUrl && data.joinUrl) {
        projJoinUrl.textContent = data.joinUrl;
      }
    } catch (e) {
      console.error('Error fetching server info:', e);
    }
  }

  // 3. Socket Connection
  socket.on('connect', () => {
    socket.emit('projector_join');
    socket.emit('2010_join');
  });

  socket.on('2010_init', (data) => {
    updateDisplay(data);
  });

  socket.on('2010_update', (data) => {
    updateDisplay(data);
  });

  socket.on('2010_card_opened', (payload) => {
    setTicker(`🌸 ${payload.name} (MS: ${payload.ms}) vừa mở thiệp nhận lời chúc 20/10! 💌`);
  });

  socket.on('2010_order_placed', (payload) => {
    setTicker(`🧋 ${payload.name} (MS: ${payload.ms}) vừa đặt "${payload.order.drinkName}" (Size ${payload.order.size})! 🚀`);
  });

  function updateDisplay(data) {
    if (!data || !data.stats) return;
    if (projOpenedCount) projOpenedCount.textContent = data.stats.openedCount;
    if (projOrderedCount) projOrderedCount.textContent = data.stats.orderedCount;
  }

  function setTicker(msg) {
    if (!projTickerContent) return;
    projTickerContent.style.opacity = '0';
    setTimeout(() => {
      projTickerContent.textContent = msg;
      projTickerContent.style.opacity = '1';
      projTickerContent.style.transition = 'opacity 0.4s ease';
    }, 200);
  }

  // 4. Fullscreen Button
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      } else {
        document.exitFullscreen().catch(err => console.log(err));
      }
    });
  }

  // Initialize
  initPetalsCanvas();
  fetchInfo();
});
