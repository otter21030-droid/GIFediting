(() => {
  const FFMPEG_URL = new URL("vendor/ffmpeg/index.js", import.meta.url).href;
  const CORE_JS = new URL("vendor/core/ffmpeg-core.js", import.meta.url).href;
  const CORE_WASM = new URL("vendor/core/ffmpeg-core.wasm", import.meta.url).href;
  function $(selector, parent) { return (parent || document).querySelector(selector); }
  const drop = $("#gifDrop");
  const input = $("#gifFile");
  const fileQueue = $("#gifFileQueue");
  const alertBox = $("#gifAlert");
  const workspace = $("#editorWorkspace");
  const originalGif = $("#originalGif");
  let resultGif = $("#resultGif");
  const config = $("#toolConfig");
  const picker = $("#toolPicker");
  const progress = $("#editorProgress");
  const fill = $("#editorFill");
  const status = $("#editorStatus");
  const percent = $("#editorPercent");
  const errorBox = $("#editorError");
  const resultPanel = $("#resultPanel");
  const saveConfig = $("#saveConfig");
  const editAgainButton = document.createElement("button");
  editAgainButton.type = "button";
  editAgainButton.className = "btn cancel";
  editAgainButton.textContent = "편집본 수정";
  editAgainButton.hidden = true;
  saveConfig.append(editAgainButton);

  const toolNames = {
    resize: "Resize", crop: "Crop", downsize: "Downsizing", format: "Format Convert",
    rotate: "Rotate", optimize: "Optimize", reverse: "Reverse", speed: "Speed", cut: "Cut",
  };
  let ffmpeg = null;
  let loadPromise = null;
  let sourceFile = null;
  let sourceBytes = null;
  let sourceMeta = null;
  let resultBlob = null;
  let resultName = "";
  let resultType = "image/gif";
  let selectedTool = "";
  let job = 0;
  let editorFiles = [];

  function message(text, isError = true) {
    alertBox.hidden = !text;
    alertBox.textContent = text;
    alertBox.classList.toggle("is-error", isError);
  }

  function humanBytes(value) {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  function readGifMeta(bytes) {
    if (bytes.length < 13 || String.fromCharCode(...bytes.slice(0, 3)) !== "GIF") return null;
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    let offset = 13;
    const packed = bytes[10];
    if (packed & 0x80) offset += 3 * (1 << ((packed & 7) + 1));
    let frames = 0;
    let delay = 0;
    let loop = true;
    while (offset < bytes.length) {
      const marker = bytes[offset++];
      if (marker === 0x3b) break;
      if (marker === 0x21) {
        const label = bytes[offset++];
        if (label === 0xf9 && bytes[offset] === 4) {
          delay += (bytes[offset + 2] | (bytes[offset + 3] << 8)) / 100;
          offset += 6;
          continue;
        }
        if (label === 0xff && bytes[offset] === 11) {
          const app = String.fromCharCode(...bytes.slice(offset + 1, offset + 12));
          if (app.includes("NETSCAPE")) loop = true;
        }
        offset = skipBlocks(bytes, offset);
        continue;
      }
      if (marker === 0x2c) {
        if (offset + 9 > bytes.length) break;
        const imagePacked = bytes[offset + 8];
        offset += 9;
        if (imagePacked & 0x80) offset += 3 * (1 << ((imagePacked & 7) + 1));
        offset += 1;
        offset = skipBlocks(bytes, offset);
        frames += 1;
        continue;
      }
      break;
    }
    return { width, height, frames, duration: delay || frames * 0.1, loop };
  }

  function skipBlocks(bytes, offset) {
    while (offset < bytes.length) {
      const size = bytes[offset++];
      if (size === 0) break;
      offset += size;
    }
    return offset;
  }

  function metaMarkup(meta, size) {
    const values = [
      ["해상도", `${meta.width} × ${meta.height}`],
      ["프레임", `${meta.frames.toLocaleString("ko-KR")}장`],
      ["재생 시간", meta.duration ? `${meta.duration.toFixed(2)}초` : "-"],
      ["파일 크기", humanBytes(size)],
      ["형식", meta.formatLabel || "GIF 애니메이션"],
    ];
    return values.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join("");
  }

  async function engine() {
    if (ffmpeg) return ffmpeg;
    if (!loadPromise) {
      loadPromise = (async () => {
        const { FFmpeg } = await import(FFMPEG_URL);
        const instance = new FFmpeg();
        await instance.load({ coreURL: CORE_JS, wasmURL: CORE_WASM });
        ffmpeg = instance;
        return instance;
      })().catch((error) => {
        loadPromise = null;
        ffmpeg = null;
        throw error;
      });
    }
    return loadPromise;
  }

  async function loadGif(file) {
    message("");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const meta = readGifMeta(bytes);
    if (!meta) {
      message("선택한 파일은 편집할 수 없습니다. GIF 형식 파일을 선택해 주세요.");
      return;
    }
    sourceFile = file;
    sourceBytes = bytes;
    sourceMeta = meta;
    resultBlob = null;
    editAgainButton.hidden = true;
    resultPanel.hidden = true;
    saveConfig.hidden = true;
    workspace.hidden = false;
    drop.hidden = true;
    $("#gifDropStatus").textContent = file.name;
    originalGif.src = URL.createObjectURL(file);
    $("#originalMeta").textContent = `${file.name} · ${humanBytes(file.size)}`;
    $("#originalInfo").innerHTML = metaMarkup(meta, file.size);
    $("#saveFilename").value = `${file.name.replace(/\.gif$/i, "")}_ed.gif`;
    $("#saveFolderHint").textContent = "저장 위치는 저장 버튼을 누른 뒤 파일 저장 창에서 선택합니다.";
    picker.hidden = false;
    picker.querySelectorAll("button").forEach((button) => button.classList.remove("selected"));
    config.hidden = true;
    message("");
  }

  function selectTool(name) {
    selectedTool = name;
    picker.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button.dataset.tool === name));
    config.hidden = false;
    config.innerHTML = toolPanel(name);
    bindToolPanel(name);
  }

  function toolPanel(name) {
    const { width, height, frames, duration } = sourceMeta;
    const rangeX = Math.max(1, Math.floor(width * 0.05));
    const rangeY = Math.max(1, Math.floor(height * 0.05));
    const widthMax = Math.max(width, Math.round(width * 3));
    const heightMax = Math.max(height, Math.round(height * 3));
    const common = `<div class="tool-panel-title"><span>${toolNames[name]}</span><small>Original GIF · ${width} × ${height}</small></div>`;
    const footer = `<div class="tool-footer"><button class="btn cancel" data-back>〈 Back</button><button class="btn primary" data-go>Go! 〉</button></div>`;
    let controls = "";
    if (name === "resize") controls = `
      <div class="linked-controls"><label>X축 너비 <output id="resizeXValue">${width}px</output><input id="resizeX" type="range" min="${rangeX}" max="${widthMax}" value="${width}" /></label>
      <button id="ratioLock" type="button" aria-pressed="true" aria-label="가로세로 비율 잠금">🔒</button>
      <label>Y축 높이 <output id="resizeYValue">${height}px</output><input id="resizeY" type="range" min="${rangeY}" max="${heightMax}" value="${height}" /></label></div>`;
    if (name === "crop") controls = `
      <label>자르기 비율<select id="cropRatio"><option value="free">자유 비율</option><option value="1:1">정사각형 1:1</option><option value="4:3">가로 4:3</option><option value="16:9">와이드 16:9</option><option value="9:16">세로 9:16</option></select></label>
      <div class="field-grid"><label>가로<input id="cropWidth" type="number" min="1" max="${width}" value="${width}" /></label><label>세로<input id="cropHeight" type="number" min="1" max="${height}" value="${height}" /></label><label>X 위치<input id="cropX" type="number" min="0" max="${width}" value="0" /></label><label>Y 위치<input id="cropY" type="number" min="0" max="${height}" value="0" /></label></div>
      <label>빈 공간 처리<select id="cropFill"><option value="pad">단색 배경으로 채우기</option><option value="cover">이미지를 확대해 채우기</option></select></label>
      <label>배경색 <input id="cropColor" type="color" value="#241f1b" /></label>`;
    if (name === "downsize") controls = `
      <p class="field-intro">적용할 용량 절감 방법을 선택하세요.</p>
      <label class="check-row"><input type="checkbox" id="downScale" checked /> 이미지 크기 축소 <span>${Math.max(16, Math.round(width * 0.75))} × ${Math.max(16, Math.round(height * 0.75))}</span></label>
      <label class="check-row"><input type="checkbox" id="downFrames" /> 프레임 줄이기 <span>${Math.max(1, Math.floor(frames * 0.7))}장</span></label>
      <label class="check-row"><input type="checkbox" id="downColors" /> 색상 수 줄이기 <span>128색</span></label>`;
    if (name === "format") controls = `<label>저장 형식<select id="convertFormat"><option value="mp4">MP4 동영상</option><option value="jpg">JPG 이미지 (첫 프레임)</option></select></label><p class="tool-help">MP4는 애니메이션 전체를 영상으로 저장하고, JPG는 첫 프레임을 이미지로 저장합니다.</p>`;
    if (name === "rotate") controls = `<div class="choice-row edit-choice"><button data-rotation="90">↻ 90°</button><button data-rotation="180">⟳ 180°</button><button data-rotation="270">↺ 270°</button></div><div class="choice-row edit-choice"><button data-flip="h">↔ 좌우 뒤집기</button><button data-flip="v">↕ 상하 뒤집기</button></div>`;
    if (name === "optimize") controls = `<p class="tool-help">프레임 차이와 투명 영역을 정리해 GIF의 불필요한 데이터를 줄입니다. 프레임 크기와 재생 속도는 유지됩니다.</p>`;
    if (name === "reverse") controls = `<p class="tool-help">모든 프레임의 순서를 뒤집어 애니메이션을 역재생합니다. 현재 ${frames}프레임입니다.</p>`;
    if (name === "speed") controls = `<label>재생 속도 <output id="speedValue">1.0×</output><input id="speedRange" type="range" min="0.25" max="4" step="0.25" value="1" /></label><p class="tool-help">현재 ${duration.toFixed(2)}초 → <span id="speedDuration">${duration.toFixed(2)}초</span></p>`;
    if (name === "cut") controls = `<div class="field-grid"><label>시작 (초)<input id="cutStart" type="number" min="0" max="${duration}" step="0.01" value="0" /></label><label>끝 (초)<input id="cutEnd" type="number" min="0" max="${duration || 9999}" step="0.01" value="${duration.toFixed(2)}" /></label></div><p class="tool-help">선택한 시간 구간만 GIF로 저장합니다.</p>`;
    return common + `<div class="tool-controls">${controls}</div>` + footer;
  }

  function bindToolPanel(name) {
    config.querySelector("[data-back]").addEventListener("click", () => {
      config.hidden = true;
      picker.querySelectorAll("button").forEach((button) => button.classList.remove("selected"));
    });
    config.querySelector("[data-go]").addEventListener("click", () => runEdit(name));
    if (name === "resize") {
      let locked = true;
      const x = $("#resizeX", config);
      const y = $("#resizeY", config);
      config.querySelector("#ratioLock").addEventListener("click", (event) => {
        locked = !locked;
        event.currentTarget.textContent = locked ? "🔒" : "🔓";
        event.currentTarget.setAttribute("aria-pressed", String(locked));
      });
      x.addEventListener("input", () => {
        if (locked) y.value = String(Math.max(1, Math.round(Number(x.value) * sourceMeta.height / sourceMeta.width)));
        $("#resizeXValue", config).value = `${x.value}px`;
        $("#resizeYValue", config).value = `${y.value}px`;
      });
      y.addEventListener("input", () => {
        if (locked) x.value = String(Math.max(1, Math.round(Number(y.value) * sourceMeta.width / sourceMeta.height)));
        $("#resizeXValue", config).value = `${x.value}px`;
        $("#resizeYValue", config).value = `${y.value}px`;
      });
    }
    if (name === "speed") $("#speedRange", config).addEventListener("input", (event) => {
      const speed = Number(event.currentTarget.value);
      $("#speedValue", config).value = `${speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×`;
      $("#speedDuration", config).textContent = `${(sourceMeta.duration / speed).toFixed(2)}초`;
    });
    if (name === "crop") $("#cropRatio", config).addEventListener("change", (event) => {
      const [rw, rh] = event.currentTarget.value.split(":").map(Number);
      if (!rw || !rh) return;
      let w = sourceMeta.width;
      let h = Math.round(w * rh / rw);
      if (h > sourceMeta.height) { h = sourceMeta.height; w = Math.round(h * rw / rh); }
      $("#cropWidth", config).value = String(w);
      $("#cropHeight", config).value = String(h);
      $("#cropX", config).value = String(Math.floor((sourceMeta.width - w) / 2));
      $("#cropY", config).value = String(Math.floor((sourceMeta.height - h) / 2));
    });
  }

  function collectOptions(name) {
    const options = { name, width: sourceMeta.width, height: sourceMeta.height };
    if (name === "resize") {
      options.width = Number($("#resizeX", config).value);
      options.height = Number($("#resizeY", config).value);
    } else if (name === "crop") {
      options.cropWidth = Math.min(sourceMeta.width, Number($("#cropWidth", config).value));
      options.cropHeight = Math.min(sourceMeta.height, Number($("#cropHeight", config).value));
      options.x = Math.max(0, Math.min(sourceMeta.width - options.cropWidth, Number($("#cropX", config).value)));
      options.y = Math.max(0, Math.min(sourceMeta.height - options.cropHeight, Number($("#cropY", config).value)));
      options.fill = $("#cropFill", config).value;
      options.color = $("#cropColor", config).value;
    } else if (name === "downsize") {
      options.scale = $("#downScale", config).checked;
      options.frames = $("#downFrames", config).checked;
      options.colors = $("#downColors", config).checked;
    } else if (name === "format") options.format = $("#convertFormat", config).value;
    else if (name === "rotate") {
      const rotation = config.querySelector("[data-rotation].selected");
      const flip = config.querySelector("[data-flip].selected");
      options.rotation = rotation ? Number(rotation.dataset.rotation) : 0;
      options.flip = flip ? flip.dataset.flip : "";
    } else if (name === "speed") options.speed = Number($("#speedRange", config).value);
    else if (name === "cut") {
      options.start = Math.max(0, Number($("#cutStart", config).value));
      options.end = Math.min(sourceMeta.duration || Infinity, Number($("#cutEnd", config).value));
    }
    return options;
  }

  async function runEdit(name) {
    const options = collectOptions(name);
    if (name === "cut" && (!Number.isFinite(options.end) || options.end <= options.start)) {
      message("끝 시간을 시작 시간보다 뒤로 입력해 주세요.");
      return;
    }
    const thisJob = ++job;
    const button = config.querySelector("[data-go]");
    button.disabled = true;
    errorBox.hidden = true;
    progress.hidden = false;
    $("#editorPercent").textContent = "0%";
    fill.style.width = "0%";
    status.textContent = `${toolNames[name]} 준비 중`;
    try {
      const engine = await getEngine();
      const ext = name === "format" ? options.format : "gif";
      const out = `edited.${ext}`;
      await engine.deleteFile("source.gif").catch(() => {});
      await engine.deleteFile(out).catch(() => {});
      await engine.writeFile("source.gif", sourceBytes);
      const args = makeArgs(options, out);
      const onProgress = ({ progress: amount }) => {
        if (thisJob !== job) return;
        const value = Math.max(0, Math.min(99, Math.round(amount * 100)));
        fill.style.width = `${value}%`;
        $("#editorPercent").textContent = `${value}%`;
        status.textContent = `${toolNames[name]} 작업 중`;
      };
      engine.on("progress", onProgress);
      const code = await engine.exec(args);
      engine.off("progress", onProgress);
      if (thisJob !== job) return;
      if (code !== 0) throw new Error("편집에 실패했습니다. 옵션을 확인하고 다시 시도해 주세요.");
      const data = await engine.readFile(out);
      resultType = ext === "mp4" ? "video/mp4" : ext === "jpg" ? "image/jpeg" : "image/gif";
      resultBlob = new Blob([data], { type: resultType });
      resultName = defaultResultName(name, ext);
      const url = URL.createObjectURL(resultBlob);
      if (ext === "mp4") {
        const video = makeVideo(url);
        resultGif.replaceWith(video);
        resultGif = video;
      } else if (resultGif.tagName !== "IMG") {
        restoreResultImage(url);
      } else {
        resultGif.src = url;
      }
      const meta = ext === "jpg" ? { ...sourceMeta, frames: 1, duration: 0 } : readGifMeta(new Uint8Array(data));
      const resultMetadata = ext === "mp4"
        ? { ...sourceMeta, formatLabel: "MP4 동영상" }
        : ext === "jpg" ? { ...sourceMeta, frames: 1, duration: 0, formatLabel: "JPG 이미지" } : meta || sourceMeta;
      $("#resultInfo").innerHTML = metaMarkup(resultMetadata, resultBlob.size);
      $("#resultTitle").textContent = name === "resize" ? "Resized GIF" : `${toolNames[name]} 결과`;
      $("#resultMeta").textContent = `${humanBytes(resultBlob.size)} · ${meta?.width || "-"} × ${meta?.height || "-"}`;
      resultPanel.hidden = false;
      if (name === "resize") $("#originalBody").hidden = true;
      saveConfig.hidden = false;
      editAgainButton.hidden = resultType !== "image/gif";
      picker.hidden = true;
      config.hidden = true;
    $("#saveFilename").value = `${sourceFile.name.replace(/\.gif$/i, "")}_ed.${ext}`;
      $("#editorPercent").textContent = "100%";
      fill.style.width = "100%";
      status.textContent = "편집 완료";
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (thisJob !== job) return;
      errorBox.textContent = error.message || "편집을 완료하지 못했습니다. 다시 시도해 주세요.";
      errorBox.hidden = false;
      status.textContent = "작업 실패";
    } finally {
      if (thisJob === job) button.disabled = false;
    }
  }

  function makeArgs(options, out) {
    const args = ["-y", "-hide_banner", "-nostdin", "-i", "source.gif"];
    const filters = [];
    if (options.name === "resize") filters.push(`scale=${options.width}:${options.height}:flags=lanczos`);
    if (options.name === "crop") {
      filters.push(`crop=${options.cropWidth}:${options.cropHeight}:${options.x}:${options.y}`);
      if (options.fill === "pad") filters.push(`pad=${sourceMeta.width}:${sourceMeta.height}:(ow-iw)/2:(oh-ih)/2:color=${options.color}`);
      else filters.push(`scale=${sourceMeta.width}:${sourceMeta.height}:force_original_aspect_ratio=increase,crop=${sourceMeta.width}:${sourceMeta.height}`);
    }
    if (options.name === "downsize") {
      if (options.scale) filters.push(`scale=${Math.max(16, Math.round(sourceMeta.width * 0.75))}:${Math.max(16, Math.round(sourceMeta.height * 0.75))}:flags=lanczos`);
      if (options.frames) {
        const sourceFps = sourceMeta.duration > 0 ? sourceMeta.frames / sourceMeta.duration : 15;
        filters.push(`fps=${Math.max(1, Math.floor(sourceFps * 0.7))}`);
      }
      if (options.colors) filters.push("split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse");
    }
    if (options.name === "rotate") {
      if (options.rotation === 90) filters.push("transpose=1");
      if (options.rotation === 180) filters.push("hflip", "vflip");
      if (options.rotation === 270) filters.push("transpose=2");
      if (options.flip === "h") filters.push("hflip");
      if (options.flip === "v") filters.push("vflip");
    }
    if (options.name === "optimize") args.push("-gifflags", "+offsetting+transdiff", "-compression_level", "9");
    if (options.name === "reverse") filters.push("reverse");
    if (options.name === "speed") filters.push(`setpts=PTS/${options.speed}`);
    if (options.name === "cut") args.push("-ss", options.start.toFixed(3), "-t", (options.end - options.start).toFixed(3));
    if (filters.length) {
      const isPaletteGraph = options.name === "downsize" && options.colors;
      args.push(isPaletteGraph ? "-filter_complex" : "-vf", filters.join(","));
    }
    if (options.name === "format" && options.format === "mp4") args.push("-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
    if (options.name === "format" && options.format === "jpg") args.push("-frames:v", "1", "-q:v", "2");
    if (out.endsWith(".gif")) args.push("-loop", "0");
    args.push(out);
    return args;
  }

  function defaultResultName(name, ext) {
    const suffix = name === "resize" ? "Resized_" : `${name}_`;
    return `${suffix}${sourceFile.name.replace(/\.gif$/i, "")}.${ext}`;
  }

  function makeVideo(url) {
    const video = document.createElement("video");
    video.id = "resultGif";
    video.controls = true;
    video.autoplay = true;
    video.loop = true;
    video.src = url;
    video.className = "gif-video-result";
    return video;
  }

  function restoreResultImage(url) {
    const video = $("#resultGif");
    const image = document.createElement("img");
    image.id = "resultGif";
    image.alt = "편집 결과 미리보기";
    image.src = url;
    video.replaceWith(image);
    resultGif = image;
  }

  async function getEngine() { return engine(); }

  async function saveResult(nameOverride = "") {
    if (!resultBlob) return;
    const name = nameOverride || $("#saveFilename").value.trim() || resultName;
    try {
      if (window.showSaveFilePicker) {
        let handle;
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: name,
            startIn: "downloads",
            types: [{ description: resultType.startsWith("image") ? "이미지" : "동영상", accept: { [resultType]: [`.${name.split(".").pop()}`] } }],
          });
        } catch (error) {
          if (error.name === "AbortError") return;
        }
        if (handle) {
          const writable = await handle.createWritable();
          await writable.write(resultBlob);
          await writable.close();
          status.textContent = "선택한 파일로 저장했습니다.";
          return;
        }
      }
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(resultBlob);
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      status.textContent = "편집 파일 다운로드를 시작했습니다.";
    } catch (error) {
      errorBox.textContent = "파일 저장을 완료하지 못했습니다.";
      errorBox.hidden = false;
    }
  }

  editAgainButton.addEventListener("click", async () => {
    if (!resultBlob || resultType !== "image/gif") return;
    const revised = new File([resultBlob], resultName, { type: "image/gif" });
    const bytes = new Uint8Array(await revised.arrayBuffer());
    const meta = readGifMeta(bytes);
    if (!meta) return;
    sourceFile = revised;
    sourceBytes = bytes;
    sourceMeta = meta;
    originalGif.src = URL.createObjectURL(revised);
    $("#originalMeta").textContent = `${revised.name} · ${humanBytes(revised.size)}`;
    $("#originalInfo").innerHTML = metaMarkup(meta, revised.size);
    $("#saveFilename").value = `${revised.name.replace(/\.gif$/i, "")}_ed.gif`;
    resultPanel.hidden = true;
    saveConfig.hidden = true;
    picker.hidden = false;
    config.hidden = true;
    picker.querySelectorAll("button").forEach((button) => button.classList.remove("selected"));
    selectTool(selectedTool || "resize");
    status.textContent = "편집본을 다시 수정할 수 있습니다";
  });

  $("#gifPick").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    editorFiles = [...(input.files || [])].filter((file) => /\.gif$/i.test(file.name));
    fileQueue.replaceChildren();
    fileQueue.hidden = editorFiles.length < 2;
    editorFiles.forEach((file, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1}. ${file.name}`;
      button.addEventListener("click", () => loadGif(file));
      fileQueue.append(button);
    });
    const rejected = [...(input.files || [])].find((file) => !/\.gif$/i.test(file.name));
    if (rejected) message(`${rejected.name}: 편집 가능한 형식은 GIF입니다.`, true);
    if (editorFiles[0]) loadGif(editorFiles[0]);
    input.value = "";
  });
  for (const type of ["dragenter", "dragover"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add("drag-over"); });
  for (const type of ["dragleave", "drop"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove("drag-over"); });
  drop.addEventListener("drop", (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    editorFiles = files.filter((file) => /\.gif$/i.test(file.name));
    fileQueue.replaceChildren();
    fileQueue.hidden = editorFiles.length < 2;
    editorFiles.forEach((file, index) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = `${index + 1}. ${file.name}`;
      button.addEventListener("click", () => loadGif(file)); fileQueue.append(button);
    });
    const rejected = files.find((file) => !/\.gif$/i.test(file.name));
    if (rejected) message(`${rejected.name}: 편집 가능한 형식은 GIF입니다.`, true);
    if (editorFiles[0]) loadGif(editorFiles[0]);
  });
  picker.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tool]");
    if (button && sourceFile) selectTool(button.dataset.tool);
  });
  config.addEventListener("click", (event) => {
    const rotation = event.target.closest("[data-rotation]");
    const flip = event.target.closest("[data-flip]");
    if (rotation) {
      config.querySelectorAll("[data-rotation]").forEach((button) => button.classList.remove("selected"));
      rotation.classList.add("selected");
    }
    if (flip) {
      config.querySelectorAll("[data-flip]").forEach((button) => button.classList.remove("selected"));
      flip.classList.add("selected");
    }
  });
  document.querySelectorAll(".panel-toggle").forEach((button) => button.addEventListener("click", () => {
    const body = $(button.dataset.target);
    body.hidden = !body.hidden;
    button.textContent = body.hidden ? "+" : "−";
  }));
  $("#saveResult").addEventListener("click", saveResult);
  $("#resultDownload").addEventListener("click", () => saveResult(resultName));
  $("#speedRange")?.addEventListener("input", () => {});
})();
