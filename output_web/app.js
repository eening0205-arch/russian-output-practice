(function () {
  const manifest = window.OUTPUT_PRACTICE;
  const exercises = manifest && Array.isArray(manifest.exercises) ? manifest.exercises : [];
  const baseStorageKey = (manifest && manifest.storageKey) || "russian-output-practice";
  const doneKey = `${baseStorageKey}-done-v1`;
  const speedKey = `${baseStorageKey}-speed-v1`;
  const knownKey = `${baseStorageKey}-known-v1`;
  const retryQueueKey = `${baseStorageKey}-retry-queue-v1`;
  const sentenceStatsKey = `${baseStorageKey}-sentence-stats-v1`;
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));

  function readStoredArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function cleanRetryQueue(ids, known) {
    const seen = new Set();
    return ids.filter((id) => {
      if (!exerciseIds.has(id) || known.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function readStoredObject(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  const storedKnown = new Set(readStoredArray(knownKey).filter((id) => exerciseIds.has(id)));

  const state = {
    currentIndex: 0,
    filter: "all",
    done: new Set(JSON.parse(localStorage.getItem(doneKey) || "[]")),
    known: storedKnown,
    retryQueue: cleanRetryQueue(readStoredArray(retryQueueKey), storedKnown),
    stats: readStoredObject(sentenceStatsKey),
    revealedAnswers: new Set(),
    revealedKeywords: new Set(),
    recordings: new Map(),
    mediaRecorder: null,
    recordingChunks: [],
    activeStream: null,
  };

  const els = {
    themeLabel: document.getElementById("themeLabel"),
    packTitle: document.getElementById("packTitle"),
    list: document.getElementById("exerciseList"),
    player: document.getElementById("player"),
    playButton: document.getElementById("playButton"),
    prevButton: document.getElementById("prevButton"),
    nextButton: document.getElementById("nextButton"),
    promptText: document.getElementById("promptText"),
    answerPanel: document.getElementById("answerPanel"),
    answerText: document.getElementById("answerText"),
    explanationText: document.getElementById("explanationText"),
    keywordPanel: document.getElementById("keywordPanel"),
    keywordList: document.getElementById("keywordList"),
    showKeywordsButton: document.getElementById("showKeywordsButton"),
    showAnswerButton: document.getElementById("showAnswerButton"),
    knowButton: document.getElementById("knowButton"),
    unknownButton: document.getElementById("unknownButton"),
    reviewQueueText: document.getElementById("reviewQueueText"),
    exerciseCounter: document.getElementById("exerciseCounter"),
    progressText: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"),
    speedSelect: document.getElementById("speedSelect"),
    loopToggle: document.getElementById("loopToggle"),
    autoNextToggle: document.getElementById("autoNextToggle"),
    doneButton: document.getElementById("doneButton"),
    recordButton: document.getElementById("recordButton"),
    playRecordingButton: document.getElementById("playRecordingButton"),
    recordingPlayer: document.getElementById("recordingPlayer"),
    downloadRecording: document.getElementById("downloadRecording"),
    recordStatus: document.getElementById("recordStatus"),
    recordLight: document.getElementById("recordLight"),
    filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
    navButtons: Array.from(document.querySelectorAll("[data-view]")),
    viewPanels: Array.from(document.querySelectorAll("[data-app-view]")),
    reviewList: document.getElementById("reviewList"),
    reviewCountText: document.getElementById("reviewCountText"),
    libraryList: document.getElementById("libraryList"),
    libraryStats: document.getElementById("libraryStats"),
    installStatus: document.getElementById("installStatus"),
  };

  function saveDone() {
    localStorage.setItem(doneKey, JSON.stringify(Array.from(state.done)));
  }

  function saveAssessment() {
    localStorage.setItem(knownKey, JSON.stringify(Array.from(state.known)));
    localStorage.setItem(retryQueueKey, JSON.stringify(state.retryQueue));
  }

  function saveStats() {
    localStorage.setItem(sentenceStatsKey, JSON.stringify(state.stats));
  }

  function ensureSentenceStats(exerciseId) {
    if (!state.stats[exerciseId]) {
      state.stats[exerciseId] = {
        status: "new",
        knownCount: 0,
        unknownCount: 0,
        lastReviewedAt: "",
      };
    }
    return state.stats[exerciseId];
  }

  function normalizeExistingStats() {
    let changed = false;
    state.retryQueue.forEach((exerciseId) => {
      const stats = ensureSentenceStats(exerciseId);
      if (!stats.unknownCount) {
        stats.unknownCount = 1;
        changed = true;
      }
      if (stats.status !== "reviewing") {
        stats.status = "reviewing";
        changed = true;
      }
    });
    state.known.forEach((exerciseId) => {
      const stats = ensureSentenceStats(exerciseId);
      if (stats.status === "new") {
        stats.status = "known";
        changed = true;
      }
    });
    if (changed) saveStats();
  }

  function currentExercise() {
    return exercises[state.currentIndex];
  }

  function renderList() {
    els.list.innerHTML = "";
    exercises.forEach((exercise, index) => {
      const item = document.createElement("li");
      item.className = "segment-item";
      item.dataset.id = exercise.id;

      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => selectExercise(index));

      const no = document.createElement("span");
      no.className = "seg-no";
      no.textContent = exercise.id;

      const title = document.createElement("span");
      title.className = "seg-title";
      title.textContent = exercise.prompt_zh;

      const check = document.createElement("span");
      check.className = "seg-check";
      check.setAttribute("aria-hidden", "true");

      button.append(no, title, check);
      item.append(button);
      els.list.appendChild(item);
    });
    updateListState();
  }

  function updateListState() {
    Array.from(els.list.children).forEach((item, index) => {
      const exercise = exercises[index];
      const isDone = state.done.has(exercise.id);
      const needsReview = state.retryQueue.includes(exercise.id);
      item.classList.toggle("is-active", index === state.currentIndex);
      item.classList.toggle("is-done", isDone);
      item.classList.toggle("is-review", needsReview);
      item.classList.toggle(
        "is-hidden",
        (state.filter === "todo" && isDone) || (state.filter === "done" && !isDone),
      );
    });
  }

  function updateProgress() {
    const doneCount = state.done.size;
    const total = exercises.length;
    const ratio = total ? (doneCount / total) * 100 : 0;
    els.progressText.textContent = `${doneCount} / ${total}`;
    els.progressBar.style.width = `${ratio}%`;
  }

  function updateReviewQueueStatus() {
    const exercise = currentExercise();
    els.reviewQueueText.textContent = `复练 ${state.retryQueue.length}`;
    if (exercise) {
      els.knowButton.disabled = state.known.has(exercise.id);
      els.unknownButton.disabled = false;
    }
  }

  function updateRecordingControls() {
    const exercise = currentExercise();
    const saved = exercise ? state.recordings.get(exercise.id) : null;
    if (saved) {
      els.recordingPlayer.src = saved.url;
      els.playRecordingButton.disabled = false;
      els.downloadRecording.classList.remove("is-disabled");
      els.downloadRecording.href = saved.url;
      els.downloadRecording.download = `output-recording-${exercise.id}.webm`;
    } else {
      els.recordingPlayer.removeAttribute("src");
      els.playRecordingButton.disabled = true;
      els.downloadRecording.classList.add("is-disabled");
      els.downloadRecording.removeAttribute("href");
    }
  }

  function renderKeywords(exercise) {
    els.keywordList.innerHTML = "";
    exercise.keywords.forEach((keyword) => {
      const chip = document.createElement("span");
      chip.className = "keyword-chip";
      chip.textContent = keyword;
      els.keywordList.appendChild(chip);
    });
  }

  function exerciseById(exerciseId) {
    return exercises.find((exercise) => exercise.id === exerciseId);
  }

  function createSentenceCard(exercise, metaText, resetReveal) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sentence-card";
    card.addEventListener("click", () => {
      const index = exercises.findIndex((item) => item.id === exercise.id);
      if (index !== -1) selectExercise(index, { resetReveal });
      activateView("practice");
    });

    const prompt = document.createElement("strong");
    prompt.textContent = exercise.prompt_zh;

    const answer = document.createElement("span");
    answer.textContent = exercise.answer_ru;

    const meta = document.createElement("span");
    meta.textContent = metaText;

    card.append(prompt, answer, meta);
    return card;
  }

  function renderReviewView() {
    els.reviewList.innerHTML = "";
    els.reviewCountText.textContent = `复练 ${state.retryQueue.length}`;

    if (!state.retryQueue.length) {
      const empty = document.createElement("p");
      empty.className = "settings-text";
      empty.textContent = "现在没有需要复练的句子。";
      els.reviewList.appendChild(empty);
      return;
    }

    state.retryQueue.forEach((exerciseId) => {
      const exercise = exerciseById(exerciseId);
      if (!exercise) return;
      const stats = ensureSentenceStats(exerciseId);
      els.reviewList.appendChild(
        createSentenceCard(exercise, `不知道 ${stats.unknownCount || 0} 次`, true),
      );
    });
  }

  function renderLibraryView() {
    els.libraryList.innerHTML = "";
    const knownCount = state.known.size;
    const reviewCount = state.retryQueue.length;
    const unknownCount = exercises.filter((exercise) => {
      const stats = state.stats[exercise.id];
      return stats && stats.unknownCount > 0;
    }).length;

    els.libraryStats.innerHTML = "";
    [
      `知道 ${knownCount}`,
      `复练中 ${reviewCount}`,
      `点过不知道 ${unknownCount}`,
    ].forEach((text) => {
      const pill = document.createElement("span");
      pill.className = "stat-pill";
      pill.textContent = text;
      els.libraryStats.appendChild(pill);
    });

    exercises.forEach((exercise) => {
      const stats = ensureSentenceStats(exercise.id);
      const status = state.retryQueue.includes(exercise.id)
        ? "复练中"
        : state.known.has(exercise.id)
          ? "知道"
          : "未练";
      const meta = `${status} · 不知道 ${stats.unknownCount || 0} 次`;
      els.libraryList.appendChild(createSentenceCard(exercise, meta, false));
    });
  }

  function renderSettingsView() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    els.installStatus.textContent = standalone
      ? "已经以程序模式打开。"
      : "在手机浏览器分享菜单里选择“添加到主屏幕”。";
  }

  function activateView(viewName) {
    els.viewPanels.forEach((panel) => {
      panel.hidden = panel.dataset.appView !== viewName;
    });
    els.navButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    });

    if (viewName === "review") renderReviewView();
    if (viewName === "library") renderLibraryView();
    if (viewName === "settings") renderSettingsView();
  }

  function updateRevealState() {
    const exercise = currentExercise();
    if (!exercise) return;
    const isAnswerRevealed = state.revealedAnswers.has(exercise.id);
    const areKeywordsRevealed = state.revealedKeywords.has(exercise.id) || isAnswerRevealed;

    els.keywordPanel.hidden = !areKeywordsRevealed;
    els.answerPanel.hidden = !isAnswerRevealed;
    els.playButton.disabled = !isAnswerRevealed;
    els.showAnswerButton.disabled = isAnswerRevealed;
    els.showKeywordsButton.disabled = areKeywordsRevealed;

    if (areKeywordsRevealed) renderKeywords(exercise);
    if (isAnswerRevealed) {
      els.answerText.textContent = exercise.answer_ru;
      els.explanationText.textContent = exercise.explanation_zh;
      els.player.src = exercise.audio;
      els.player.loop = els.loopToggle.checked;
      els.player.playbackRate = Number(els.speedSelect.value);
    } else {
      els.answerText.textContent = "";
      els.explanationText.textContent = "";
      els.player.removeAttribute("src");
    }
  }

  function resetRevealFor(exerciseId) {
    state.revealedAnswers.delete(exerciseId);
    state.revealedKeywords.delete(exerciseId);
  }

  function selectExercise(index, options = {}) {
    if (!exercises[index]) return;
    state.currentIndex = index;
    const exercise = currentExercise();
    if (options.resetReveal) resetRevealFor(exercise.id);
    els.exerciseCounter.textContent = exercise.id;
    els.promptText.textContent = exercise.prompt_zh;
    els.doneButton.textContent = state.done.has(exercise.id) ? "取消已练" : "标记已练";
    els.playButton.textContent = "播放标准音频";
    updateRevealState();
    updateRecordingControls();
    updateListState();
    updateReviewQueueStatus();
  }

  function selectRelative(offset) {
    if (offset > 0 && state.currentIndex === exercises.length - 1) {
      const retryIndex = nextRetryIndex();
      if (retryIndex !== -1) {
        selectExercise(retryIndex, { resetReveal: true });
        return;
      }
    }
    const nextIndex = Math.max(0, Math.min(exercises.length - 1, state.currentIndex + offset));
    selectExercise(nextIndex);
  }

  function nextRetryIndex() {
    for (const id of state.retryQueue) {
      const index = exercises.findIndex((exercise) => exercise.id === id);
      if (index !== -1 && !state.known.has(id)) return index;
    }
    return -1;
  }

  function nextNewIndexAfterCurrent() {
    for (let index = state.currentIndex + 1; index < exercises.length; index += 1) {
      if (!state.known.has(exercises[index].id)) return index;
    }
    return -1;
  }

  function showKeywords() {
    const exercise = currentExercise();
    if (!exercise) return;
    state.revealedKeywords.add(exercise.id);
    updateRevealState();
  }

  function showAnswer() {
    const exercise = currentExercise();
    if (!exercise) return;
    state.revealedAnswers.add(exercise.id);
    state.revealedKeywords.add(exercise.id);
    updateRevealState();
  }

  function removeFromRetryQueue(exerciseId) {
    state.retryQueue = state.retryQueue.filter((id) => id !== exerciseId);
  }

  function addToRetryQueue(exerciseId) {
    if (!state.retryQueue.includes(exerciseId)) {
      state.retryQueue.push(exerciseId);
    }
  }

  function advanceAfterAssessment() {
    const nextNewIndex = nextNewIndexAfterCurrent();
    if (nextNewIndex !== -1) {
      selectExercise(nextNewIndex);
      return;
    }

    const retryIndex = nextRetryIndex();
    if (retryIndex !== -1) {
      selectExercise(retryIndex, { resetReveal: true });
    } else {
      updateReviewQueueStatus();
    }
  }

  function markKnown() {
    const exercise = currentExercise();
    if (!exercise) return;
    const stats = ensureSentenceStats(exercise.id);
    stats.status = "known";
    stats.knownCount += 1;
    stats.lastReviewedAt = new Date().toISOString();
    state.known.add(exercise.id);
    removeFromRetryQueue(exercise.id);
    setDone(exercise.id, true);
    saveAssessment();
    saveStats();
    updateReviewQueueStatus();
    updateListState();
    advanceAfterAssessment();
  }

  function markUnknown() {
    const exercise = currentExercise();
    if (!exercise) return;
    const stats = ensureSentenceStats(exercise.id);
    stats.status = "reviewing";
    stats.unknownCount += 1;
    stats.lastReviewedAt = new Date().toISOString();
    state.known.delete(exercise.id);
    addToRetryQueue(exercise.id);
    setDone(exercise.id, false);
    showAnswer();
    saveAssessment();
    saveStats();
    updateReviewQueueStatus();
    updateListState();
  }

  async function togglePlay() {
    if (!currentExercise() || els.playButton.disabled) return;
    if (els.player.paused) {
      try {
        await els.player.play();
      } catch (error) {
        els.playButton.textContent = "播放标准音频";
      }
    } else {
      els.player.pause();
    }
  }

  function setDone(exerciseId, value) {
    if (value) {
      state.done.add(exerciseId);
    } else {
      state.done.delete(exerciseId);
    }
    saveDone();
    updateProgress();
    updateListState();
    els.doneButton.textContent = value ? "取消已练" : "标记已练";
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      els.recordStatus.textContent = "当前浏览器不支持录音";
      return;
    }

    state.activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordingChunks = [];
    state.mediaRecorder = new MediaRecorder(state.activeStream);
    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) state.recordingChunks.push(event.data);
    });
    state.mediaRecorder.addEventListener("stop", finishRecording);
    state.mediaRecorder.start();
    els.recordStatus.textContent = "录音中";
    els.recordLight.classList.add("is-recording");
    els.recordButton.textContent = "停止录音";
  }

  function stopRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    }
  }

  function finishRecording() {
    if (state.activeStream) {
      state.activeStream.getTracks().forEach((track) => track.stop());
    }

    const exercise = currentExercise();
    const oldRecording = exercise ? state.recordings.get(exercise.id) : null;
    if (oldRecording) URL.revokeObjectURL(oldRecording.url);

    const blob = new Blob(state.recordingChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    if (exercise) state.recordings.set(exercise.id, { blob, url });

    state.mediaRecorder = null;
    state.activeStream = null;
    state.recordingChunks = [];
    els.recordStatus.textContent = "录音已保存";
    els.recordLight.classList.remove("is-recording");
    els.recordButton.textContent = "开始录音";
    updateRecordingControls();
  }

  function bindEvents() {
    els.showKeywordsButton.addEventListener("click", showKeywords);
    els.showAnswerButton.addEventListener("click", showAnswer);
    els.knowButton.addEventListener("click", markKnown);
    els.unknownButton.addEventListener("click", markUnknown);
    els.playButton.addEventListener("click", togglePlay);
    els.prevButton.addEventListener("click", () => selectRelative(-1));
    els.nextButton.addEventListener("click", () => selectRelative(1));
    els.player.addEventListener("play", () => {
      els.playButton.textContent = "暂停标准音频";
    });
    els.player.addEventListener("pause", () => {
      els.playButton.textContent = "播放标准音频";
    });
    els.player.addEventListener("ended", () => {
      const exercise = currentExercise();
      if (exercise) setDone(exercise.id, true);
      if (els.autoNextToggle.checked && !els.loopToggle.checked) {
        const canMove = state.currentIndex < exercises.length - 1;
        if (canMove) selectRelative(1);
      }
    });

    els.speedSelect.addEventListener("change", () => {
      els.player.playbackRate = Number(els.speedSelect.value);
      localStorage.setItem(speedKey, els.speedSelect.value);
    });
    els.loopToggle.addEventListener("change", () => {
      els.player.loop = els.loopToggle.checked;
      if (els.loopToggle.checked) els.autoNextToggle.checked = false;
    });
    els.autoNextToggle.addEventListener("change", () => {
      if (els.autoNextToggle.checked) els.loopToggle.checked = false;
      els.player.loop = els.loopToggle.checked;
    });
    els.doneButton.addEventListener("click", () => {
      const exercise = currentExercise();
      if (exercise) setDone(exercise.id, !state.done.has(exercise.id));
    });
    els.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        els.filterButtons.forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
        updateListState();
      });
    });
    els.navButtons.forEach((button) => {
      button.addEventListener("click", () => activateView(button.dataset.view));
    });
    els.recordButton.addEventListener("click", async () => {
      try {
        if (state.mediaRecorder) {
          stopRecording();
        } else {
          await startRecording();
        }
      } catch (error) {
        els.recordStatus.textContent = "录音权限未开启";
        els.recordLight.classList.remove("is-recording");
        els.recordButton.textContent = "开始录音";
      }
    });
    els.playRecordingButton.addEventListener("click", () => {
      els.recordingPlayer.play();
    });
    document.addEventListener("keydown", (event) => {
      if (event.target && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) {
        return;
      }
      if (event.key === "ArrowLeft") selectRelative(-1);
      if (event.key === "ArrowRight") selectRelative(1);
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      }
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function init() {
    if (manifest) {
      els.packTitle.textContent = manifest.title || "俄语输出练习";
      els.themeLabel.textContent = `${manifest.theme || "俄语日常表达"} · ${manifest.week || ""}`;
    }
    if (!exercises.length) {
      els.promptText.textContent = "没有找到练习数据";
      els.answerPanel.hidden = true;
      els.keywordPanel.hidden = true;
      els.playButton.disabled = true;
      return;
    }
    const savedSpeed = localStorage.getItem(speedKey);
    if (savedSpeed) els.speedSelect.value = savedSpeed;
    normalizeExistingStats();
    bindEvents();
    renderList();
    updateProgress();
    selectExercise(0);
    activateView("practice");
    registerServiceWorker();
  }

  init();
})();
