(() => {
    "use strict";

    const canvas = document.getElementById("magicEffects");
    const context = canvas.getContext("2d");
    if (!context) {
        return;
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const COLORS = ["#ffe083", "#fff6c9", "#a4e7ff", "#ffaad5", "#b5f4b2"];
    const MAX_PARTICLES = 120;
    const TRAIL_INTERVAL = 20;
    const particles = [];
    let animationFrame = null;
    let previousFrameTime = null;
    let lastTrailTime = 0;
    let pixelRatio = 1;

    function resizeCanvas() {
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * pixelRatio);
        canvas.height = Math.round(window.innerHeight * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function clearEffects() {
        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
        }
        animationFrame = null;
        previousFrameTime = null;
        particles.length = 0;
        context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
    }

    function drawSparkle(particle) {
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.globalAlpha = Math.max(0, 1 - particle.age / particle.lifetime);
        context.fillStyle = particle.color;
        context.shadowColor = particle.color;
        context.shadowBlur = 8;
        context.beginPath();
        for (let point = 0; point < 8; point++) {
            const angle = point * Math.PI / 4;
            const radius = point % 2 === 0 ? particle.size : particle.size * 0.3;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (point === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        }
        context.closePath();
        context.fill();
        context.restore();
    }

    function animate(time) {
        const elapsed = previousFrameTime === null ? 0 : Math.min(time - previousFrameTime, 32);
        previousFrameTime = time;
        context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
        for (let index = particles.length - 1; index >= 0; index--) {
            const particle = particles[index];
            particle.age += elapsed;
            if (particle.age >= particle.lifetime) {
                particles.splice(index, 1);
                continue;
            }
            particle.x += particle.velocityX * elapsed;
            particle.y += particle.velocityY * elapsed;
            particle.velocityY += 0.00012 * elapsed;
            particle.rotation += particle.spin * elapsed;
            drawSparkle(particle);
        }
        if (particles.length > 0) {
            animationFrame = requestAnimationFrame(animate);
        } else {
            animationFrame = null;
            previousFrameTime = null;
        }
    }

    function addSparkles(x, y, burst) {
        const count = burst ? 18 : 2;
        for (let index = 0; index < count; index++) {
            const angle = burst ? 2 * Math.PI * index / count : Math.random() * 2 * Math.PI;
            const speed = burst ? 0.07 + Math.random() * 0.13 : 0.015 + Math.random() * 0.025;
            particles.push({
                x,
                y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                age: 0,
                lifetime: burst ? 450 + Math.random() * 250 : 300 + Math.random() * 180,
                size: burst ? 3 + Math.random() * 5 : 2 + Math.random() * 3,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                rotation: Math.random() * Math.PI,
                spin: (Math.random() - 0.5) * 0.004,
            });
        }
        if (particles.length > MAX_PARTICLES) {
            particles.splice(0, particles.length - MAX_PARTICLES);
        }
        if (animationFrame === null) {
            animationFrame = requestAnimationFrame(animate);
        }
    }

    function effectsEnabled(event) {
        return finePointer.matches && !reducedMotion.matches && event.pointerType === "mouse";
    }

    document.addEventListener("pointermove", (event) => {
        if (!effectsEnabled(event)) {
            return;
        }
        const time = performance.now();
        if (time - lastTrailTime >= TRAIL_INTERVAL) {
            lastTrailTime = time;
            addSparkles(event.clientX, event.clientY, false);
        }
    }, { passive: true });

    document.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && effectsEnabled(event)) {
            addSparkles(event.clientX, event.clientY, true);
        }
    }, { passive: true });

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pagehide", clearEffects);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearEffects();
        }
    });
    reducedMotion.addEventListener("change", clearEffects);
    finePointer.addEventListener("change", clearEffects);
    resizeCanvas();
})();
