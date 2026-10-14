(() => {
    "use strict";

    // Positions are measured in the background's native pixel dimensions.
    const BOARD_WIDTH = 1536;
    const BOARD_HEIGHT = 1024;
    const POSITIONS = [
        { x: 320, y: 692 },
        { x: 450, y: 611 },
        { x: 558, y: 507 },
        { x: 688, y: 393 },
        { x: 874, y: 444 },
        { x: 1055, y: 377 },
        { x: 929, y: 262 },
        { x: 1038, y: 180 },
        { x: 1338, y: 257 }, // Happy Planet
    ];
    const STAR_COUNT = POSITIONS.length - 1;
    const PLANET_INDEX = STAR_COUNT;
    const FORWARD_KEYS = new Set(["+", "=", "ArrowRight", "ArrowUp"]);
    const BACKWARD_KEYS = new Set(["-", "ArrowLeft", "ArrowDown"]);
    const STAGE_MESSAGES = [
        "Speak English to help Lileng move forward!",
        "Great job! Let’s keep speaking English!",
        "Awesome teamwork! Keep going!",
        "Fantastic! Lileng is getting closer!",
        "Super! Keep using English!",
        "Great listening and speaking!",
        "Almost there! You can do it!",
        "Just one more + to reach Happy Planet!",
    ];
    const STATUS_ICONS = {
        neutral: "🌟",
        positive: "🎉",
        negative: "😢",
        win: "🏆",
        flying: "🚀",
    };
    const CONFETTI_COLORS = [
        "#fff582", "#ff80bf", "#64fff1", "#ab92ff", "#fdd35c", "#ffffff",
    ];
    const CONFETTI_COUNT = 46;
    const FLIGHT_DURATION = {
        reduced: 180,
        victory: 3150,
        forward: 2050,
        backward: 2470,
    };
    const FLIGHT_HEIGHT = { victory: 48, forward: 115, backward: 24 };
    const BACKWARD_PAUSE = 490;
    const LANDING_DURATION = { forward: 710, backward: 770 };
    const REACTION_DURATION = {
        default: 1700,
        boundary: 1300,
        flight: 4000,
        forward: 1350,
        backward: 1750,
        victory: 999999,
    };

    const getElement = (id) => document.getElementById(id);
    const elements = {
        board: getElement("board"),
        avatar: getElement("avatar"),
        reaction: getElement("reaction"),
        stageText: getElement("chipStage"),
        stageCard: getElement("stageCard"),
        stageIcon: getElement("stageIcon"),
        stageFill: getElement("stageFill"),
        statusLine: getElement("statusLine"),
        statusText: getElement("statusText"),
        statusIcon: getElement("statusIcon"),
        minus: getElement("minus"),
        plus: getElement("plus"),
        controls: getElement("controls"),
        sparkles: getElement("sparkles"),
        banner: getElement("winBanner"),
        soundToggle: getElement("soundToggle"),
        fullscreenToggle: getElement("fullscreenToggle"),
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = {
        positionIndex: 0,
        moving: false,
        soundEnabled: true,
        reactionTimer: null,
        landingTimer: null,
        reactionFrame: null,
    };
    const sounds = {
        up: new Audio("sounds/up.wav"),
        down: new Audio("sounds/down.wav"),
        win: new Audio("sounds/win.wav"),
    };

    const xPercent = (value) => `${100 * value / BOARD_WIDTH}%`;
    const yPercent = (value) => `${100 * value / BOARD_HEIGHT}%`;
    const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

    function placeAvatar(position) {
        elements.avatar.style.left = xPercent(position.x);
        elements.avatar.style.top = yPercent(position.y);
        updateReactionPlacement();
    }

    function updateReactionPlacement() {
        if (!elements.reaction.textContent) {
            return;
        }

        const board = elements.board.getBoundingClientRect();
        const avatar = elements.avatar.getBoundingClientRect();
        const width = elements.reaction.offsetWidth;
        const height = elements.reaction.offsetHeight;
        const angle = 5 * Math.PI / 180;
        // Reserve room for the rotated bubble and the appearance animation's overshoot.
        const halfWidth = (width * Math.cos(angle) + height * Math.sin(angle)) * 0.55;
        const halfHeight = (height * Math.cos(angle) + width * Math.sin(angle)) * 0.55;
        const margin = 8;
        const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));
        const preferredX = avatar.left - board.left - elements.board.clientLeft + avatar.width * 0.57;
        const preferredY = avatar.top - board.top - elements.board.clientTop - avatar.height * 0.08 - height / 2;
        const avatarLeft = avatar.left - board.left - elements.board.clientLeft;
        const avatarRight = avatarLeft + avatar.width;
        const leftSpace = avatarLeft - margin;
        const rightSpace = elements.board.clientWidth - avatarRight - margin;
        const sideX = leftSpace >= rightSpace
            ? avatarLeft - margin - halfWidth
            : avatarRight + margin + halfWidth;
        const ceilingOverlap = Math.max(0, margin + halfHeight - preferredY);
        const sideProgress = Math.min(1, ceilingOverlap / height);
        const shiftedX = preferredX + (sideX - preferredX) * sideProgress;
        const centerX = clamp(shiftedX, margin + halfWidth, elements.board.clientWidth - margin - halfWidth);
        const centerY = clamp(preferredY, margin + halfHeight, elements.board.clientHeight - margin - halfHeight);
        elements.reaction.style.left = `${centerX}px`;
        elements.reaction.style.top = `${centerY - height / 2}px`;
    }

    function trackReaction() {
        updateReactionPlacement();
        state.reactionFrame = requestAnimationFrame(trackReaction);
    }

    function playSound(type) {
        if (!state.soundEnabled || !sounds[type]) {
            return;
        }

        Object.values(sounds).forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
        sounds[type].play().catch(() => {
            // A blocked or unavailable sound must not interrupt gameplay.
        });
    }

    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        Object.values(sounds).forEach((audio) => {
            audio.muted = !state.soundEnabled;
        });
        elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
        elements.soundToggle.textContent = state.soundEnabled
            ? "🔊 Sound: on · M"
            : "🔇 Sound: off · M";
    }

    function syncFullscreen() {
        const active = Boolean(document.fullscreenElement);
        elements.fullscreenToggle.setAttribute("aria-pressed", String(active));
        elements.fullscreenToggle.textContent = active
            ? "⛶ Full screen: on · F"
            : "⛶ Full screen: off · F";
    }

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen?.();
            } else {
                await document.documentElement.requestFullscreen?.();
            }
        } catch {
            // Keep the button in sync when the browser rejects full screen.
        }
        syncFullscreen();
    }

    function showReaction(text, mood, duration = REACTION_DURATION.default) {
        clearTimeout(state.reactionTimer);
        elements.reaction.className = `reaction ${mood} show`;
        elements.reaction.textContent = text;
        updateReactionPlacement();
        state.reactionTimer = setTimeout(() => {
            if (!state.moving && state.positionIndex !== PLANET_INDEX) {
                elements.reaction.classList.remove("show");
            }
        }, duration);
    }

    function hideReaction() {
        clearTimeout(state.reactionTimer);
        elements.reaction.className = "reaction";
        elements.reaction.textContent = "";
    }

    function startConfetti() {
        elements.sparkles.replaceChildren();
        for (let index = 0; index < CONFETTI_COUNT; index++) {
            const particle = document.createElement("span");
            const variation = (seed) => ((index * 37 + seed * 17) % 97) / 97;
            particle.className = "confetti";
            particle.style.setProperty("--left", `${69 + variation(3) * 30}%`);
            particle.style.setProperty("--top", `${3 + variation(6) * 26}%`);
            particle.style.setProperty("--drift", `${-180 + variation(9) * 320}%`);
            particle.style.setProperty("--duration", `${1.7 + variation(2) * 2.5}s`);
            particle.style.setProperty("--delay", `${-variation(8) * 3}s`);
            particle.style.setProperty("--color", CONFETTI_COLORS[index % CONFETTI_COLORS.length]);
            elements.sparkles.append(particle);
        }
    }

    function setStatus(text, tone = "neutral") {
        const changed = elements.statusText.textContent !== text;
        elements.statusText.textContent = text;
        elements.statusLine.dataset.tone = tone;
        elements.statusIcon.textContent = STATUS_ICONS[tone];
        if (changed && !reducedMotion) {
            elements.statusLine.animate([
                { opacity: 0.4, transform: "translateY(5px)" },
                { opacity: 1, transform: "translateY(0)" },
            ], { duration: 300, easing: "ease-out" });
        }
    }

    function updateStage(won) {
        const text = won ? "Happy Planet!" : `Star ${state.positionIndex + 1} of ${STAR_COUNT}`;
        if (elements.stageText.textContent !== text) {
            elements.stageText.textContent = text;
            if (!reducedMotion) {
                elements.stageCard.animate([
                    { transform: "scale(1)" },
                    { transform: "scale(1.07)", offset: 0.4 },
                    { transform: "scale(1)" },
                ], { duration: 600, easing: "ease-out" });
            }
        }
        elements.stageIcon.textContent = won ? "🏆" : "⭐";
        elements.stageCard.classList.toggle("is-won", won);
        elements.stageFill.style.width = `${100 * Math.min(state.positionIndex + 1, STAR_COUNT) / STAR_COUNT}%`;
    }

    function updateStageMessage(won, lastDirection) {
        if (won) {
            setStatus("Hooray! Lileng made it to Happy Planet!", "win");
        } else if (lastDirection < 0) {
            setStatus("Oh no! Let’s listen and try again!", "negative");
        } else {
            setStatus(STAGE_MESSAGES[state.positionIndex], lastDirection > 0 ? "positive" : "neutral");
        }
    }

    function refresh(lastDirection = 0) {
        const won = state.positionIndex === PLANET_INDEX;
        updateStage(won);
        elements.avatar.setAttribute("aria-label", won
            ? "Lileng is dancing on Happy Planet!"
            : `Lileng on Star ${state.positionIndex + 1}`);
        elements.avatar.classList.toggle("is-dancing", won);
        elements.plus.disabled = won || state.moving;
        elements.minus.disabled = state.moving;
        elements.plus.setAttribute("aria-label", won ? "Mission complete" : "Plus: go forward one star");
        elements.banner.classList.toggle("shown", won);
        elements.banner.setAttribute("aria-hidden", String(!won));
        if (won) {
            startConfetti();
        } else {
            elements.sparkles.replaceChildren();
        }
        updateStageMessage(won, lastDirection);
    }

    function beginMovement(direction) {
        elements.stageCard.classList.add("is-travelling");
        state.moving = true;
        elements.plus.disabled = true;
        elements.minus.disabled = true;
        elements.controls.classList.toggle("is-positive", direction > 0);
        elements.controls.classList.toggle("is-negative", direction < 0);
        trackReaction();
    }

    function finishMovement() {
        cancelAnimationFrame(state.reactionFrame);
        state.reactionFrame = null;
        elements.stageCard.classList.remove("is-travelling");
        state.moving = false;
        elements.controls.classList.remove("is-positive", "is-negative");
    }

    function createFlightFrames(start, end, height, forward) {
        const frame = (progress, verticalShift, offset) => ({
            left: xPercent(start.x + (end.x - start.x) * progress),
            top: yPercent(start.y + (end.y - start.y) * progress + verticalShift),
            offset,
        });
        return forward ? [
            frame(0, 0, 0),
            frame(0.09, 0, 0.12),
            frame(0.27, -height * 0.7, 0.30),
            frame(0.47, -height, 0.51),
            frame(0.75, -height * 0.6, 0.77),
            frame(0.96, -height * 0.12, 0.95),
            frame(1, 0, 1),
        ] : [
            frame(0, 0, 0),
            frame(0, 12, 0.14),
            frame(0.13, -height * 0.1, 0.33),
            frame(0.43, -height, 0.55),
            frame(0.77, 10, 0.83),
            frame(1, 0, 1),
        ];
    }

    async function travel(fromIndex, toIndex, direction) {
        clearTimeout(state.landingTimer);
        elements.avatar.classList.remove("is-preparing", "is-sad-landing", "landed-happy", "is-dancing");
        const forward = direction > 0;
        const flightType = toIndex === PLANET_INDEX ? "victory" : forward ? "forward" : "backward";
        const duration = reducedMotion ? FLIGHT_DURATION.reduced : FLIGHT_DURATION[flightType];
        const frames = createFlightFrames(POSITIONS[fromIndex], POSITIONS[toIndex], FLIGHT_HEIGHT[flightType], forward);
        elements.avatar.style.setProperty("--flight-duration", `${duration}ms`);
        elements.avatar.classList.add(forward ? "is-forward" : "is-backward");
        const animation = elements.avatar.animate(frames, {
            duration,
            easing: forward ? "cubic-bezier(.3,.05,.5,.95)" : "cubic-bezier(.35,.1,.7,1)",
            fill: "none",
        });
        try {
            await animation.finished;
        } catch {
            // A cancelled flight still settles the avatar at its destination.
        }
        placeAvatar(POSITIONS[toIndex]);
        elements.avatar.classList.remove("is-forward", "is-backward");
        const landingClass = forward ? "landed-happy" : "is-sad-landing";
        elements.avatar.classList.add(landingClass);
        state.landingTimer = setTimeout(() => {
            elements.avatar.classList.remove(landingClass);
        }, forward ? LANDING_DURATION.forward : LANDING_DURATION.backward);
    }

    async function move(direction) {
        if (state.moving || (direction > 0 && state.positionIndex === PLANET_INDEX)) {
            return;
        }
        if (direction < 0 && state.positionIndex === 0) {
            setStatus("Star 1 is the start. Let’s try for +1!", "negative");
            showReaction("Oh no! 💧", "bad", REACTION_DURATION.boundary);
            elements.avatar.classList.add("is-bumping");
            playSound("down");
            setTimeout(() => elements.avatar.classList.remove("is-bumping"), 470);
            return;
        }

        const fromIndex = state.positionIndex;
        const toIndex = fromIndex + direction;
        beginMovement(direction);
        if (fromIndex === PLANET_INDEX) {
            elements.avatar.classList.remove("is-dancing");
            elements.banner.classList.remove("shown");
            elements.sparkles.replaceChildren();
        }
        if (direction > 0) {
            const finalFlight = toIndex === PLANET_INDEX;
            setStatus(finalFlight ? "Flying to Happy Planet!" : "Great English! On to the next star!", "flying");
            showReaction(finalFlight ? "Hooray! 🚀" : "YAY! +1 ⭐", "good", REACTION_DURATION.flight);
            playSound(finalFlight ? "win" : "up");
        } else {
            setStatus("Going back one star. Let’s listen and try again.", "negative");
            showReaction("OH NO! −1 💧", "bad", REACTION_DURATION.flight);
            elements.avatar.classList.add("is-preparing");
            playSound("down");
            if (!reducedMotion) {
                await delay(BACKWARD_PAUSE);
            }
        }

        await travel(fromIndex, toIndex, direction);
        state.positionIndex = toIndex;
        finishMovement();
        if (toIndex === PLANET_INDEX) {
            hideReaction();
            showReaction("WE DID IT! 🎉", "win", REACTION_DURATION.victory);
        } else if (direction > 0) {
            showReaction("GREAT! +1 ✨", "good", REACTION_DURATION.forward);
        } else {
            showReaction("TRY AGAIN 💙", "bad", REACTION_DURATION.backward);
        }
        refresh(direction);
    }

    function handleKeydown(event) {
        if (event.altKey || event.metaKey || event.ctrlKey || event.repeat) {
            return;
        }
        if (FORWARD_KEYS.has(event.key)) {
            event.preventDefault();
            move(1);
        } else if (BACKWARD_KEYS.has(event.key)) {
            event.preventDefault();
            move(-1);
        } else if (event.key.toLowerCase() === "m") {
            event.preventDefault();
            toggleSound();
        } else if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            toggleFullscreen();
        }
    }

    function initialize() {
        Object.values(sounds).forEach((audio) => {
            audio.preload = "auto";
            audio.volume = 1;
        });
        elements.fullscreenToggle.disabled = !document.fullscreenEnabled;
        syncFullscreen();
        elements.soundToggle.addEventListener("click", toggleSound);
        elements.fullscreenToggle.addEventListener("click", toggleFullscreen);
        document.addEventListener("fullscreenchange", syncFullscreen);
        elements.plus.addEventListener("click", () => move(1));
        elements.minus.addEventListener("click", () => move(-1));
        document.addEventListener("keydown", handleKeydown);
        new ResizeObserver(updateReactionPlacement).observe(elements.board);
        placeAvatar(POSITIONS[0]);
        refresh();
    }

    initialize();
})();
