(function () {
  const manifest = window.OUTPUT_PRACTICE;
  const exercises = manifest && Array.isArray(manifest.exercises) ? manifest.exercises : [];
  const baseStorageKey = (manifest && manifest.storageKey) || "russian-output-practice";
  const doneKey = `${baseStorageKey}-done-v1`;
  const speedKey = `${baseStorageKey}-speed-v1`;

  const state = {
    currentIndex: 0,
    filter: "all",
    done: new Set(JSON.parse(localStorage.getItem(doneKey) || "[]")),
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
  };

  function saveDone() {
    localStorage.setItem(doneKey, JSON.stringify(Array.from(state.done)));
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
      item.classList.toggle("is-active", index === state.currentIndex);
      item.classList.toggle("is-done", isDone);
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

  function selectExercise(index) {
    if (!exercises[index]) return;
    state.currentIndex = index;
    const exercise = currentExercise();
    els.exerciseCounter.textContent = exercise.id;
    els.promptText.textContent = exercise.prompt_zh;
    els.doneButton.textContent = state.done.has(exercise.id) ? "取消已练" : "标记已练";
    els.playButton.textContent = "播放标准音频";
    updateRevealState();
    updateRecordingControls();
    updateListState();
  }

  function selectRelative(offset) {
    const nextIndex = Math.max(0, Math.min(exercises.length - 1, state.currentIndex + offset));
    selectExercise(nextIndex);
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
    bindEvents();
    renderList();
    updateProgress();
    selectExercise(0);
  }

  init();
})();
