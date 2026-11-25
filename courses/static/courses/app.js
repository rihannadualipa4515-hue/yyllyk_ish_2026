(() => {
  const layout = document.querySelector(".learn-layout");
  if (!layout) return;

  const courseId = layout.dataset.course;
  const stepIndex = Number(layout.dataset.step);
  const stepCount = Number(layout.dataset.stepCount);
  const lessonData = JSON.parse(document.getElementById("course-data").textContent);
  const activeStep = lessonData[stepIndex];
  const stateKey = `okuw-simulator:${courseId}`;
  const progressKey = `okuw-progress:${courseId}`;
  const linesElement = document.getElementById("terminal-lines");
  const form = document.getElementById("terminal-form");
  const input = document.getElementById("terminal-input");
  const history = [];
  let historyIndex = -1;
  let state = loadState();
  let completed = loadProgress();

  function initialState() {
    return {
      cwd: "~",
      files: {},
      git: { initialized: false, branch: "main", branches: ["main"], staged: [], tracked: {}, commits: [], config: {}, remotes: {} },
      docker: { containers: [], images: [] },
    };
  }

  function loadState() {
    const saved = localStorage.getItem(stateKey);
    if (!saved) return initialState();
    try {
      return { ...initialState(), ...JSON.parse(saved) };
    } catch (error) {
      console.error("Simulator state could not be loaded:", error);
      return initialState();
    }
  }

  function loadProgress() {
    const saved = localStorage.getItem(progressKey);
    if (!saved) return [];
    try {
      return JSON.parse(saved).filter((value) => Number.isInteger(value) && value >= 0 && value < stepCount);
    } catch (error) {
      console.error("Course progress could not be loaded:", error);
      return [];
    }
  }

  function persist() {
    localStorage.setItem(stateKey, JSON.stringify(state));
    localStorage.setItem(progressKey, JSON.stringify(completed));
    updateStatus();
  }

  function updateStatus() {
    document.getElementById("done-count").textContent = String(completed.length);
    document.getElementById("progress-fill").style.width = `${Math.round((completed.length / stepCount) * 100)}%`;
    document.getElementById("file-list").textContent = Object.keys(state.files).join(", ") || "—";
    document.getElementById("branch-name").textContent = state.git.initialized ? state.git.branch : "—";
    document.getElementById("commit-count").textContent = String(state.git.commits.length);
    document.getElementById("prompt-path").textContent = state.cwd;
    document.querySelectorAll(".lesson-link").forEach((link) => {
      const index = Number(link.dataset.lesson);
      const number = link.querySelector(".lesson-number");
      if (completed.includes(index)) {
        number.textContent = "✓";
        number.classList.add("is-done");
      }
    });
    const done = completed.includes(stepIndex);
    document.getElementById("task-complete").hidden = !done;
    document.getElementById("hint-toggle").hidden = done;
  }

  function addLine(kind, text) {
    const line = document.createElement("pre");
    line.className = `terminal-line ${kind}`;
    line.textContent = text;
    linesElement.append(line);
    line.scrollIntoView({ block: "nearest" });
  }

  function execute(rawCommand, persistState = true) {
    const command = rawCommand.trim();
    if (!command) return "";
    if (command === "clear" || command === "cls") {
      linesElement.replaceChildren();
      return "";
    }
    const result = run(command);
    if (persistState) persist();
    addLine("in", `$ ${command}`);
    if (result) {
      const failed = /^(fatal|error|Error|ERROR)|not found|not a git|tanyş buýruk däl|ýalňyş|did not match|nothing to commit/i.test(result);
      addLine(failed ? "err" : "out", result);
      const check = activeStep.check ? new RegExp(activeStep.check) : null;
      if (check?.test(command) && !failed && !completed.includes(stepIndex)) {
        completed.push(stepIndex);
        persist();
        addLine("ok", "✓ Dogry! Tabşyryk ýerine ýetirildi.");
      }
    } else {
      const check = activeStep.check ? new RegExp(activeStep.check) : null;
      if (check?.test(command) && !completed.includes(stepIndex)) {
        completed.push(stepIndex);
        persist();
        addLine("ok", "✓ Dogry! Tabşyryk ýerine ýetirildi.");
      }
    }
    return result;
  }

  function run(command) {
    const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const first = parts[0] || "";
    if (first === "help") return "Elýeterli: ls, pwd, mkdir, cd, echo, cat, git, docker, clear";
    if (first === "pwd") return state.cwd === "~" ? "/home/okuwcy" : `/home/okuwcy/${state.cwd}`;
    if (first === "ls") return Object.keys(state.files).join("  ") || (state.git.initialized && parts.includes("-a") ? ".  ..  .git" : "");
    if (first === "mkdir") {
      if (!parts[1]) return "Ulanylyşy: mkdir <papka>";
      state.files[parts[1]] = state.files[parts[1]] || "";
      return "";
    }
    if (first === "cd") {
      state.cwd = parts[1] === ".." ? "~" : (parts[1] || "~");
      return "";
    }
    if (first === "echo") {
      const match = command.match(/^echo\s+(?:"([^"]*)"|'([^']*)'|(.+?))\s*(>>|>)\s*(\S+)\s*$/);
      if (!match) return command.slice(5).replace(/^["']|["']$/g, "");
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      const filename = match[5];
      state.files[filename] = match[4] === ">>" ? `${state.files[filename] || ""}${state.files[filename] ? "\n" : ""}${value}` : value;
      return "";
    }
    if (first === "cat") return state.files[parts[1]] ?? `cat: ${parts[1] || ""}: faýl tapylmady`;
    if (first === "touch") {
      parts.slice(1).forEach((file) => { state.files[file] = state.files[file] || ""; });
      return "";
    }
    if (first === "tree") return state.git.initialized ? ".git\n├── HEAD\n├── config\n└── objects" : "Faýl tapylmady";
    if (first === "python") return state.files[parts[1]]?.includes("Hello") ? "Hello, Git!" : "";
    if (first === "git") return runGit(parts.slice(1));
    if (first === "docker") return runDocker(parts.slice(1));
    return `tanyş buýruk däl: ${first}`;
  }

  function runPreview(command) {
    const savedState = state;
    state = JSON.parse(JSON.stringify(state));
    try {
      return run(command);
    } finally {
      state = savedState;
    }
  }

  function runGit(args) {
    const [subcommand, ...rest] = args;
    const git = state.git;
    if (subcommand === "--version" || subcommand === "version") return "git version 2.45.0";
    if (subcommand === "help" || subcommand === "--help") return "git init · status · add · commit · log · branch · checkout · merge · remote · push · pull · diff";
    if (subcommand === "init") {
      git.initialized = true;
      return "Boş Git repozitoriýasy başladyldy.";
    }
    if (!git.initialized && !["config"].includes(subcommand)) return "fatal: bu papka Git repozitoriýasy däl (ýa-da ýokarky papkalaryň hiç biri däl)";
    if (subcommand === "config") {
      const keyIndex = rest.findIndex((part) => part.startsWith("user.") || part === "color.ui");
      if (keyIndex < 0 && (rest[0] === "-l" || rest[0] === "--list")) return Object.entries(git.config).map(([key, value]) => `${key}=${value}`).join("\n") || "";
      const key = rest[keyIndex >= 0 ? keyIndex : 0];
      const value = rest.slice((keyIndex >= 0 ? keyIndex : 0) + 1).join(" ").replace(/^["']|["']$/g, "");
      if (value) { git.config[key] = value; return ""; }
      return git.config[key] || "";
    }
    if (subcommand === "status") {
      const staged = git.staged.map((file) => `  (commit üçin) ${file}`).join("\n");
      const changed = Object.keys(state.files).filter((file) => git.tracked[file] !== state.files[file] && !git.staged.includes(file)).map((file) => `  (üýtgedildi) ${file}`).join("\n");
      const untracked = Object.keys(state.files).filter((file) => !(file in git.tracked) && !git.staged.includes(file)).map((file) => `  (yzarlanmaýar) ${file}`).join("\n");
      return [`On branch ${git.branch}`, staged && `Changes to be committed:\n${staged}`, changed && `Changes not staged:\n${changed}`, untracked && `Untracked files:\n${untracked}`, !staged && !changed && !untracked && "nothing to commit, working tree clean"].filter(Boolean).join("\n");
    }
    if (subcommand === "add") {
      if (!rest.length) return "Ulanylyşy: git add <faýl>";
      const targets = rest.includes(".") ? Object.keys(state.files) : rest.filter((part) => !part.startsWith("-"));
      targets.forEach((file) => { if (file in state.files && !git.staged.includes(file)) git.staged.push(file); });
      return "";
    }
    if (subcommand === "commit") {
      if (!git.staged.length) return "nothing to commit";
      const message = rest.slice(rest.indexOf("-m") + 1).join(" ").replace(/^["']|["']$/g, "") || "Okuw commit";
      git.staged.forEach((file) => { git.tracked[file] = state.files[file]; });
      git.commits.unshift({ message, branch: git.branch, files: [...git.staged] });
      git.staged = [];
      return `[${git.branch} ${git.commits.length.toString(16).padStart(7, "0")}] ${message}\n${git.commits[0].files.length} file changed`;
    }
    if (subcommand === "log") return git.commits.length ? git.commits.map((commit, i) => `commit ${String(git.commits.length - i).padStart(7, "0")}\n    ${commit.message}`).join("\n\n") : "fatal: commit tapylmady";
    if (subcommand === "branch") {
      if (rest[0]) { if (!git.branches.includes(rest[0])) git.branches.push(rest[0]); return ""; }
      return git.branches.map((name) => `${name === git.branch ? "* " : "  "}${name}`).join("\n");
    }
    if (subcommand === "checkout" || subcommand === "switch") {
      let target = rest[rest.length - 1];
      if (rest[0] === "-b" || rest[0] === "-c") {
        target = rest[1];
        if (!git.branches.includes(target)) git.branches.push(target);
      }
      if (/^[0-9a-f]{4,}$/i.test(target || "")) return git.commits.length ? `HEAD indi commit ${target} ýagdaýyna geçirildi.` : "fatal: commit tapylmady";
      if (!git.branches.includes(target)) git.branches.push(target);
      git.branch = target;
      return `Şaha çalşyldy: '${target}'`;
    }
    if (subcommand === "merge" || subcommand === "rebase") return rest.length ? `${rest[0]} bilen birleşdirildi.` : `Ulanylyşy: git ${subcommand} <şaha>`;
    if (subcommand === "diff") return rest.includes("--staged") || rest.includes("--cached") ? "Staging meýdanyndaky üýtgeşmeler ýok." : "Üýtgeşme tapylmady.";
    if (subcommand === "remote") {
      if (rest[0] === "add" && rest[1]) { git.remotes[rest[1]] = rest[2] || ""; return ""; }
      return Object.entries(git.remotes).map(([name, url]) => `${name}\t${url} (fetch)\n${name}\t${url} (push)`).join("\n") || "";
    }
    if (["fetch", "push", "pull"].includes(subcommand)) return subcommand === "pull" ? "Täze üýtgeşme ýok." : "Simulýasiýa: uzakdaky repozitoriýa birikme ýok.";
    if (subcommand === "clone") {
      state.files["README.md"] = "Göçürilen okuw taslamasy";
      git.initialized = true;
      return "Okuw taslamasy ýerli papka göçürildi.";
    }
    if (subcommand === "rm") {
      const file = rest[rest.length - 1];
      delete state.files[file];
      if (!git.staged.includes(file)) git.staged.push(file);
      return "";
    }
    if (subcommand === "mv") {
      const [oldName, newName] = rest;
      if (!state.files[oldName]) return `fatal: ${oldName} tapylmady`;
      state.files[newName] = state.files[oldName];
      delete state.files[oldName];
      git.staged.push(newName);
      return "";
    }
    if (subcommand === "stash") return "Üýtgeşmeler wagtlaýyn saklandy.";
    if (subcommand === "reset" || subcommand === "tag" || subcommand === "show" || subcommand === "rev-parse") return "Buýruk okuw simulýatorynda ýerine ýetirildi.";
    return `tanyş buýruk däl: git ${subcommand || ""}`;
  }

  function runDocker(args) {
    const [action, ...rest] = args;
    const docker = state.docker;
    if (action === "--version" || action === "version") return "Docker version 27.0.3";
    if (action === "run") {
      const nameIndex = rest.indexOf("--name");
      const image = rest[rest.length - 1] || "debian";
      const name = nameIndex >= 0 ? rest[nameIndex + 1] : `container_${docker.containers.length + 1}`;
      docker.images.push(image);
      docker.containers.push({ name, image, running: true });
      return `Konteýner başladyldy: ${name}`;
    }
    if (action === "ps") {
      const visible = docker.containers.filter((container) => container.running || rest.includes("-a"));
      return visible.map((container) => `${container.name}\t${container.image}\t${container.running ? "Up" : "Exited"}`).join("\n") || "Işleýän konteýner ýok.";
    }
    if (["stop", "start", "rm"].includes(action)) {
      const container = docker.containers.find((item) => item.name === rest[0]);
      if (!container) return `Ýalňyşlyk: ${rest[0] || "konteýner"} tapylmady`;
      if (action === "stop") container.running = false;
      if (action === "start") container.running = true;
      if (action === "rm") docker.containers = docker.containers.filter((item) => item !== container);
      return `${container.name} ${action === "rm" ? "öçürildi" : action === "stop" ? "saklandy" : "başladyldy"}`;
    }
    if (action === "pull") {
      const image = rest[0] || "nginx";
      if (!docker.images.includes(image)) docker.images.push(image);
      return `${image} image simulýasiýa arkaly ýüklenildi.`;
    }
    if (action === "images") return docker.images.map((image) => `${image}\tlatest`).join("\n") || "Image ýok.";
    if (action === "exec" || action === "logs" || action === "tag" || action === "history") return `docker ${action}: buýruk simulýasiýa edildi.`;
    return `tanyş buýruk däl: docker ${action || ""}`;
  }

  function complete(value) {
    const choices = ["git", "docker", "status", "init", "add", "commit", "log", "branch", "checkout", "merge", "remote", "push", "pull", "ls", "cd", "pwd", "mkdir", "cat", "help"];
    if (value.includes(" ")) return value;
    return choices.find((choice) => choice.startsWith(value) && choice !== value) || value;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    history.unshift(input.value.trim());
    historyIndex = -1;
    execute(input.value);
    input.value = "";
    input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      input.value = complete(input.value);
    } else if (event.key === "ArrowUp" && history.length) {
      historyIndex = Math.min(historyIndex + 1, history.length - 1);
      input.value = history[historyIndex];
      event.preventDefault();
    } else if (event.key === "ArrowDown" && historyIndex >= 0) {
      historyIndex -= 1;
      input.value = historyIndex >= 0 ? history[historyIndex] : "";
      event.preventDefault();
    } else if (event.key.toLowerCase() === "l" && event.ctrlKey) {
      linesElement.replaceChildren();
      event.preventDefault();
    }
  });

  document.querySelectorAll(".run-example").forEach((button) => {
    button.addEventListener("click", () => {
      execute(button.dataset.command);
      input.focus();
    });
  });
  document.getElementById("reset-terminal").addEventListener("click", () => {
    state = initialState();
    linesElement.replaceChildren();
    persist();
    input.focus();
  });
  document.getElementById("hint-toggle").addEventListener("click", (event) => {
    const hint = document.getElementById("hint");
    hint.hidden = !hint.hidden;
    event.currentTarget.textContent = hint.hidden ? "Kömek gerekmi?" : "Kömegi gizlemek";
  });

  const dialog = document.getElementById("demo-dialog");
  const demoTyped = document.getElementById("demo-typed");
  const demoResult = document.getElementById("demo-result");
  const demoToggle = document.getElementById("demo-toggle");
  const demoProgress = document.getElementById("demo-progress-fill");
  let demoTimer;
  let demoStarted = 0;
  let demoElapsed = 0;
  let demoCommand = "";
  function startDemo(restart = false) {
    clearInterval(demoTimer);
    if (restart) demoElapsed = 0;
    demoStarted = performance.now() - demoElapsed;
    demoToggle.textContent = "Duruz";
    demoTimer = setInterval(() => {
      demoElapsed = Math.min(performance.now() - demoStarted, 10000);
      demoTyped.textContent = demoCommand.slice(0, Math.floor((demoElapsed / 3800) * demoCommand.length));
      demoProgress.style.width = `${demoElapsed / 100}%`;
      document.getElementById("demo-seconds").textContent = `${Math.ceil((10000 - demoElapsed) / 1000)} sek`;
      if (demoElapsed >= 4600) demoResult.textContent = runPreview(demoCommand);
      if (demoElapsed >= 10000) {
        clearInterval(demoTimer);
        demoToggle.textContent = "Ýene görkez";
        document.getElementById("demo-status").textContent = "✓ Görkezme tamamlandy";
      }
    }, 40);
  }
  document.querySelectorAll(".demo-button").forEach((button) => {
    button.addEventListener("click", () => {
      demoCommand = button.dataset.command;
      demoElapsed = 0;
      demoTyped.textContent = "";
      demoResult.textContent = "";
      demoProgress.style.width = "0";
      document.getElementById("demo-status").textContent = "";
      dialog.showModal();
      startDemo(true);
    });
  });
  document.getElementById("close-demo").addEventListener("click", () => {
    clearInterval(demoTimer);
    dialog.close();
  });
  document.getElementById("demo-restart").addEventListener("click", () => {
    demoResult.textContent = "";
    document.getElementById("demo-status").textContent = "";
    startDemo(true);
  });
  demoToggle.addEventListener("click", () => {
    if (demoElapsed >= 10000) {
      demoResult.textContent = "";
      document.getElementById("demo-status").textContent = "";
      startDemo(true);
    } else if (demoTimer) {
      clearInterval(demoTimer);
      demoToggle.textContent = "Dowam et";
      demoTimer = null;
    } else {
      startDemo();
    }
  });
  dialog.addEventListener("close", () => clearInterval(demoTimer));
  updateStatus();
})();
