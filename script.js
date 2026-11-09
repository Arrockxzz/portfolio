(() => {
  const frameCount = 238;
  const sequence = document.querySelector(".hero-scroll");
  const stage = document.querySelector(".hero-stage");
  const canvas = document.querySelector(".hero-canvas");
  const context = canvas?.getContext("2d", { alpha: false });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const chapterNames = [
    "A considered introduction",
    "Leading people and service",
    "Transforming the operation",
    "Making every interaction matter",
    "The next chapter starts here",
  ];
  const chapterButtons = [...document.querySelectorAll(".chapter-dot")];
  const chapterLabel = document.querySelector(".hero-chapter");
  const chapterStep = document.querySelector(".hero-step");
  const pageProgress = document.body;

  if (sequence && stage && canvas && context) {
    const cache = new Map();
    const maxCachedFrames = 7;
    let activeFrame = 1;
    let requestedFrame = 1;
    let drawQueued = false;
    let sizeQueued = false;

    const frameSource = (frame) => `assets/frames/ezgif-frame-${String(frame).padStart(3, "0")}.jpg`;

    const getFrame = (frame) => {
      if (cache.has(frame)) {
        const image = cache.get(frame);
        cache.delete(frame);
        cache.set(frame, image);
        return image;
      }

      const image = new Image();
      image.decoding = "async";
      image.src = frameSource(frame);
      image.decode().then(() => {
        if (frame === requestedFrame) queueDraw();
      }).catch(() => {
        if (frame === requestedFrame) {
          stage.classList.add("sequence-error");
        }
      });
      cache.set(frame, image);

      while (cache.size > maxCachedFrames) {
        const oldestFrame = cache.keys().next().value;
        if (oldestFrame === requestedFrame || oldestFrame === activeFrame) {
          const retained = cache.get(oldestFrame);
          cache.delete(oldestFrame);
          cache.set(oldestFrame, retained);
          continue;
        }
        cache.delete(oldestFrame);
      }
      return image;
    };

    const paint = () => {
      drawQueued = false;
      const image = getFrame(requestedFrame);
      if (!image.complete || !image.naturalWidth) return;

      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const x = width > 620 ? width - drawWidth : (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;

      context.clearRect(0, 0, width, height);
      context.drawImage(image, x, y, drawWidth, drawHeight);
      activeFrame = requestedFrame;
      stage.classList.remove("sequence-error");
      preloadNeighbors(requestedFrame);
    };

    const queueDraw = () => {
      if (drawQueued) return;
      drawQueued = true;
      window.requestAnimationFrame(paint);
    };

    const preloadNeighbors = (frame) => {
      for (const neighbor of [frame - 1, frame + 1]) {
        if (neighbor >= 1 && neighbor <= frameCount && !cache.has(neighbor)) getFrame(neighbor);
      }
    };

    const resizeCanvas = () => {
      sizeQueued = false;
      const bounds = stage.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      queueDraw();
    };

    const queueResize = () => {
      if (sizeQueued) return;
      sizeQueued = true;
      window.requestAnimationFrame(resizeCanvas);
    };

    const updateScroll = () => {
      const bounds = sequence.getBoundingClientRect();
      const scrollableDistance = Math.max(1, sequence.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -bounds.top / scrollableDistance));
      stage.style.setProperty("--scene-progress", String(progress));
      stage.style.setProperty("--camera-zoom", String(1.12 - progress * 0.12));
      updateChapter(progress);
      if (reducedMotion.matches) return;
      const nextFrame = Math.round(progress * (frameCount - 1)) + 1;
      if (nextFrame === requestedFrame) return;
      requestedFrame = nextFrame;
      queueDraw();
    };

    const scrollToChapter = (progress) => {
      const top = sequence.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(0, sequence.offsetHeight - window.innerHeight);
      window.scrollTo({
        top: top + distance * progress,
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    };

    const updateChapter = (progress) => {
      const activeIndex = Math.min(chapterNames.length - 1, Math.floor(progress * (chapterNames.length - 1) + 0.5));
      chapterButtons.forEach((button, index) => {
        const isActive = index === activeIndex;
        button.classList.toggle("is-active", isActive);
        if (isActive) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
      if (chapterLabel) chapterLabel.textContent = chapterNames[activeIndex];
      if (chapterStep) chapterStep.textContent = `${String(activeIndex + 1).padStart(2, "0")} — 05`;
    };

    chapterButtons.forEach((button) => {
      button.addEventListener("click", () => scrollToChapter(Number(button.dataset.progress)));
    });

    let scrollQueued = false;
    window.addEventListener("scroll", () => {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        scrollQueued = false;
        const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        pageProgress.style.setProperty("--page-progress", `${Math.min(100, (window.scrollY / scrollRange) * 100)}%`);
        document.querySelector(".site-header")?.classList.toggle("is-scrolled", window.scrollY > 30);
        updateScroll();
      });
    }, { passive: true });

    window.addEventListener("resize", queueResize, { passive: true });
    window.addEventListener("load", updateScroll, { once: true });
    const handleMotionPreference = () => {
      if (reducedMotion.matches) requestedFrame = 1;
      updateScroll();
      queueDraw();
    };
    if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", handleMotionPreference);
    else reducedMotion.addListener(handleMotionPreference);
    queueResize();
    updateScroll();
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const metricRow = document.querySelector(".metric-row");
  const metricValues = document.querySelectorAll("[data-count]");
  const animateMetrics = () => {
    if (reducedMotion.matches) return;
    metricValues.forEach((metric) => {
      const target = Number(metric.dataset.count);
      const duration = 950;
      const startedAt = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        metric.textContent = String(Math.round(target * (1 - (1 - progress) ** 4)));
        if (progress < 1) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
  };
  if (metricRow && metricValues.length && "IntersectionObserver" in window && !reducedMotion.matches) {
    const metricObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      animateMetrics();
      observer.disconnect();
    }, { threshold: 0.6 });
    metricObserver.observe(metricRow);
  }

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (finePointer.matches && !reducedMotion.matches) {
    document.querySelectorAll("[data-tilt]").forEach((element) => {
      element.addEventListener("pointermove", (event) => {
        const bounds = element.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        element.style.setProperty("--tilt-x", `${(0.5 - y) * 7}deg`);
        element.style.setProperty("--tilt-y", `${(x - 0.5) * 8}deg`);
        element.style.setProperty("--glint-x", `${x * 100}%`);
        element.style.setProperty("--glint-y", `${y * 100}%`);
        element.classList.add("is-tilting");
      });

      element.addEventListener("pointerleave", () => {
        element.style.removeProperty("--tilt-x");
        element.style.removeProperty("--tilt-y");
        element.style.setProperty("--glint-x", "50%");
        element.style.setProperty("--glint-y", "40%");
        element.classList.remove("is-tilting");
      });
    });

    const heroStage = document.querySelector(".hero-stage");
    heroStage?.addEventListener("pointermove", (event) => {
      const bounds = heroStage.getBoundingClientRect();
      const pointerX = (event.clientX / bounds.width) * 2 - 1;
      const pointerY = (event.clientY / bounds.height) * 2 - 1;
      heroStage.style.setProperty("--camera-x", `${pointerX * -10}px`);
      heroStage.style.setProperty("--camera-y", `${pointerY * 7}px`);
      heroStage.style.setProperty("--camera-rotate", `${pointerX * 1.1}deg`);
    });
    heroStage?.addEventListener("pointerleave", () => {
      heroStage.style.setProperty("--camera-x", "0px");
      heroStage.style.setProperty("--camera-y", "0px");
      heroStage.style.setProperty("--camera-rotate", "0deg");
    });
  }

  const menuToggle = document.querySelector(".menu-toggle");
  const primaryNav = document.querySelector(".primary-nav");
  if (menuToggle && primaryNav) {
    const closeMenu = () => {
      menuToggle.setAttribute("aria-expanded", "false");
      primaryNav.classList.remove("is-open");
      document.body.classList.remove("menu-open");
    };

    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
      primaryNav.classList.toggle("is-open", !isOpen);
      document.body.classList.toggle("menu-open", !isOpen);
    });

    primaryNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  const year = document.querySelector("#current-year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
