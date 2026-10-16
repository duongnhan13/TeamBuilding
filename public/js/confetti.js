// Standalone Canvas Confetti Engine (100% Offline)
(function(window) {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationId = null;

  function initCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '99999';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
  }

  function resize() {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  const colors = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
    '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
    '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316'
  ];

  class Particle {
    constructor(x, y, vx, vy) {
      this.x = x !== undefined ? x : canvas.width / 2;
      this.y = y !== undefined ? y : canvas.height / 2;
      this.size = Math.random() * 10 + 6;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.vx = vx !== undefined ? vx : (Math.random() - 0.5) * 20;
      this.vy = vy !== undefined ? vy : (Math.random() - 0.8) * 22;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = (Math.random() - 0.5) * 12;
      this.gravity = 0.45;
      this.drag = 0.96;
      this.opacity = 1;
      this.decay = Math.random() * 0.008 + 0.005;
      this.shape = Math.random() > 0.4 ? 'rect' : 'circle';
    }

    update() {
      this.vx *= this.drag;
      this.vy *= this.drag;
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.rotationSpeed;
      this.opacity -= this.decay;
    }

    draw(ctx) {
      if (this.opacity <= 0) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, this.opacity);
      ctx.fillStyle = this.color;

      if (this.shape === 'rect') {
        ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw(ctx);
      if (p.opacity <= 0 || p.y > canvas.height + 50) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      animationId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  window.fireConfetti = function(options = {}) {
    initCanvas();
    const count = options.count || 80;
    const originX = options.x !== undefined ? options.x * canvas.width : canvas.width / 2;
    const originY = options.y !== undefined ? options.y * canvas.height : canvas.height * 0.7;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 18 + 4;
      const vx = Math.cos(angle) * speed;
      const vy = (Math.sin(angle) * speed) - 8;
      particles.push(new Particle(originX, originY, vx, vy));
    }

    if (!animationId) {
      loop();
    }
  };

  window.burstCannons = function() {
    window.fireConfetti({ x: 0.1, y: 0.8, count: 60 });
    window.fireConfetti({ x: 0.9, y: 0.8, count: 60 });
    setTimeout(() => {
      window.fireConfetti({ x: 0.3, y: 0.7, count: 70 });
      window.fireConfetti({ x: 0.7, y: 0.7, count: 70 });
    }, 250);
    setTimeout(() => {
      window.fireConfetti({ x: 0.5, y: 0.5, count: 100 });
    }, 500);
  };
})(window);
