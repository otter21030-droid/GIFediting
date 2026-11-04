const API = location.protocol === "file:" ? "http://127.0.0.1:4173" : "";

const FORMATS = [
  { id: "mp4", label: "MP4" },
  { id: "mov", label: "MOV" },
  { id: "mkv", label: "MKV" },
  { id: "avi", label: "AVI" },
  { id: "webm", label: "WEBM" },
  { id: "wmv", label: "WMV" },
  { id: "flv", label: "FLV" },
  { id: "mpeg", label: "MPEG" },
  { id: "m4v", label: "M4V" },
  { id: "ts", label: "TS" },
  { id: "ogv", label: "OGV" },
  { id: "3gp", label: "3GP" },
  { id: "mxf", label: "MXF" },
  { id: "vob", label: "VOB" },
  { id: "asf", label: "ASF" },
  { id: "rm", label: "RM" },
];

const VIDEO_EXT = new Set([
  "mp4", "m4v", "mov", "qt", "mkv", "avi", "webm", "wmv", "flv", "f4v",
  "mpeg", "mpg", "mpe", "m2v", "ts", "mts", "m2ts", "m2t", "tod", "mod",
  "ogv", "ogg", "ogm", "3gp", "3g2", "mxf", "vob", "dat", "asf", "rm",
  "rmvb", "divx", "dv", "amv", "hevc", "h264", "264", "h265", "265", "av1",
]);

const BLOCKED_EXT = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tif", "tiff", "pdf",
  "txt", "zip", "rar", "7z", "mp3", "wav", "flac", "aac", "m4a", "wma",
  "exe", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "json", "html", "css",
]);

const ICON_OF = {
  mp4: "mp4", m4v: "m4v", mov: "mov", qt: "mov", mkv: "mkv", avi: "avi",
  webm: "webm", wmv: "wmv", flv: "flv", f4v: "flv", mpeg: "mpeg", mpg: "mpeg",
  mpe: "mpeg", m2v: "mpeg", ts: "ts", mts: "ts", m2ts: "ts", m2t: "ts",
  ogv: "ogv", ogg: "ogv", ogm: "ogv", "3gp": "3gp", "3g2": "3gp", mxf: "mxf",
  vob: "vob", dat: "vob", asf: "asf", rm: "rm", rmvb: "rm", divx: "avi",
};

const WIDTHS = [320, 480, 640, 800, 1280, "original"];
const QUALITIES = [
  { id: "small", label: "소형", width: 320, colors: 64, note: "용량이 작아 주고받기 쉽습니다." },
  { id: "medium", label: "중형", width: 480, colors: 128, note: "화면에서 보기 좋은 기본 크기입니다." },
  { id: "large", label: "대형", width: 800, colors: 192, note: "더 선명하고 큰 GIF입니다." },
];
const ASPECTS = [
  { id: "original", label: "원본" },
  { id: "landscape", label: "가로" },
  { id: "square", label: "정사각" },
  { id: "portrait", label: "세로" },
  { id: "free", label: "직접 자르기" },
];
const EMOJIS = ["😀", "😂", "😍", "👍", "🔥", "⭐", "❤️", "🎉", "✨", "💯", "🐱", "🐶", "🌈", "☀️", "🎵", "👑"];

const studio = document.querySelector("#studio");
const libraryView = document.querySelector("#library");
const libraryBtn = document.querySelector("#libraryBtn");
const libraryGrid = document.querySelector("#libraryGrid");
const libraryEmpty = document.querySelector("#libraryEmpty");
const libraryNote = document.querySelector("#libraryNote");
const engineNote = document.querySelector("#engineNote");
const dropzone = document.querySelector("#dropzone");
const dropTitle = document.querySelector("#dropTitle");
const dropStatus = document.querySelector("#dropStatus");
const pickBtn = document.querySelector("#pickBtn");
const fileInput = document.querySelector("#fileInput");
const formatSection = document.querySelector("#formatSection");
const formatHeading = document.querySelector("#formatHeading");
const formatGrid = document.querySelector("#formatGrid");
const notice = document.querySelector("#notice");
const details = document.querySelector("#details");
const qualityChoices = document.querySelector("#qualityChoices");
const qualityNote = document.querySelector("#qualityNote");
const aspectChoices = document.querySelector("#aspectChoices");
const cropFrame = document.querySelector("#cropFrame");
const poster = document.querySelector("#poster");
const cropRect = document.querySelector("#cropRect");
const trimBlock = document.querySelector("#trimBlock");
const trimStart = document.querySelector("#trimStart");
const trimEnd = document.querySelector("#trimEnd");
const trimStartText = document.querySelector("#trimStartText");
const trimEndText = document.querySelector("#trimEndText");
const trimReadout = document.querySelector("#trimReadout");
const stickerPalette = document.querySelector("#stickerPalette");
const stickerLayer = document.querySelector("#stickerLayer");
const stickerSize = document.querySelector("#stickerSize");
const stickerDelete = document.querySelector("#stickerDelete");
const textInput = document.querySelector("#textInput");
const textAdd = document.querySelector("#textAdd");
const textUpdate = document.querySelector("#textUpdate");
const textDelete = document.querySelector("#textDelete");
const textSize = document.querySelector("#textSize");
const textColor = document.querySelector("#textColor");
const textWeight = document.querySelector("#textWeight");
const textWeightValue = document.querySelector("#textWeightValue");
const textOpacity = document.querySelector("#textOpacity");
const textOpacityValue = document.querySelector("#textOpacityValue");
const gifPreview = document.querySelector("#gifPreview");
const gifResult = document.querySelector("#gifResult");
const loopToggle = document.querySelector("#loopToggle");
const sizeChoices = document.querySelector("#sizeChoices");
const convertBtn = document.querySelector("#convertBtn");
const work = document.querySelector("#work");
const workCaption = document.querySelector("#workCaption");
const phaseLabel = document.querySelector("#phaseLabel");
const percentLabel = document.querySelector("#percentLabel");
const progressTrack = document.querySelector("#progressTrack");
const progressFill = document.querySelector("#progressFill");
const stopBtn = document.querySelector("#stopBtn");
const cancelBtn = document.querySelector("#cancelBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const saveName = document.querySelector("#saveName");
const filmstrip = document.querySelector("#filmstrip");
const currentThumb = document.querySelector("#currentThumb");
const currentCaption = document.querySelector("#currentCaption");

const meta = {
  name: document.querySelector("#metaName"),
  size: document.querySelector("#metaSize"),
  format: document.querySelector("#metaFormat"),
  codec: document.querySelector("#metaCodec"),
  resolution: document.querySelector("#metaResolution"),
  duration: document.querySelector("#metaDuration"),
  fps: document.querySelector("#metaFps"),
  frames: document.querySelector("#metaFrames"),
  bitrate: document.querySelector("#metaBitrate"),
  output: document.querySelector("#metaOutput"),
};

let selectedWidth = 640;
let selectedColors = 192;
let selectedAspect = "original";
let focusX = 0.5;
let focusY = 0.5;
let freeCrop = null;
let stickers = [];
let selectedSticker = null;
let texts = [];
let selectedText = null;
let current = null;
let busy = false;
let dragDepth = 0;
let cropDrag = null;
let browserMode = false;

fileInput.accept = [...VIDEO_EXT].map((ext) => `.${ext}`).join(",");
fileInput.multiple = false;

function api(path) {
  return `${API}${path}`;
}

function extensionOf(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match ? match[1] : "";
}

function iconMarkup(label) {
  return `
    <svg viewBox="0 0 72 44" aria-hidden="true">
      <rect x="1.5" y="1.5" width="69" height="41" rx="6" fill="none" stroke="currentColor" stroke-width="1.6"></rect>
      <g fill="currentColor">
        <rect x="6" y="6" width="3.2" height="5" rx="0.6"></rect>
        <rect x="6" y="14" width="3.2" height="5" rx="0.6"></rect>
        <rect x="6" y="22" width="3.2" height="5" rx="0.6"></rect>
        <rect x="6" y="30" width="3.2" height="5" rx="0.6"></rect>
        <rect x="62.8" y="6" width="3.2" height="5" rx="0.6"></rect>
        <rect x="62.8" y="14" width="3.2" height="5" rx="0.6"></rect>
        <rect x="62.8" y="22" width="3.2" height="5" rx="0.6"></rect>
        <rect x="62.8" y="30" width="3.2" height="5" rx="0.6"></rect>
      </g>
    </svg>
    <span>${label}</span>
  `;
}

function renderFormats() {
  formatGrid.replaceChildren();
  for (const format of FORMATS) {
    const tile = document.createElement("div");
    tile.className = "fmt";
    tile.dataset.id = format.id;
    tile.innerHTML = iconMarkup(format.label);
    formatGrid.append(tile);
  }
}

function renderChoices(container, items, selected, onPick) {
  container.replaceChildren();
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.role = "radio";
    button.dataset.id = String(item.id);
    button.textContent = item.label;
    button.setAttribute("aria-checked", String(item.id === selected));
    button.addEventListener("click", () => {
      if (busy) return;
      onPick(item);
      for (const other of container.querySelectorAll("button")) {
        other.setAttribute("aria-checked", String(other === button));
      }
    });
    container.append(button);
  }
}

function renderWidths() {
  renderChoices(
    sizeChoices,
    WIDTHS.map((width) => ({ id: width, label: width === "original" ? "원본" : `${width}px` })),
    selectedWidth,
    (item) => {
      selectedWidth = item.id;
      syncQuality();
      updateOutputSize();
    },
  );
}

function renderQualities() {
  renderChoices(qualityChoices, QUALITIES, null, (item) => {
    selectedWidth = item.width;
    selectedColors = item.colors;
    qualityNote.textContent = item.note;
    for (const button of sizeChoices.querySelectorAll("button")) {
      button.setAttribute("aria-checked", String(button.dataset.id === String(item.width)));
    }
    updateOutputSize();
  });
}

function renderAspects() {
  renderChoices(aspectChoices, ASPECTS, selectedAspect, (item) => {
    if (item.id === "free" && current) {
      const box = sourceCrop();
      freeCrop = { x: box.x, y: box.y, w: box.w, h: box.h };
    }
    selectedAspect = item.id;
    if (item.id !== "free") {
      focusX = 0.5;
      focusY = 0.5;
    }
    paintCrop();
    updateOutputSize();
  });
}

function syncQuality() {
  const match = QUALITIES.find((item) => item.width === selectedWidth);
  selectedColors = match ? match.colors : 192;
  qualityNote.textContent = match
    ? match.note
    : "너비를 직접 고르면 색 수는 대형 기준으로 맞춥니다.";
  for (const button of qualityChoices.querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(match && button.dataset.id === match.id));
  }
}

function even(value) {
  const number = Math.max(2, Math.round(value));
  return number - (number % 2);
}

function sourceCrop() {
  if (!current || selectedAspect === "original") {
    return current ? { x: 0, y: 0, w: current.width, h: current.height } : null;
  }
  if (selectedAspect === "free" && freeCrop) {
    const w = Math.min(current.width, Math.max(16, freeCrop.w));
    const h = Math.min(current.height, Math.max(16, freeCrop.h));
    const x = Math.min(Math.max(0, freeCrop.x), current.width - w);
    const y = Math.min(Math.max(0, freeCrop.y), current.height - h);
    return { x, y, w, h };
  }
  const ratio = selectedAspect === "square" ? 1 : selectedAspect === "portrait" ? 9 / 16 : 16 / 9;
  let cropW;
  let cropH;
  if (current.width / current.height > ratio) {
    cropH = current.height;
    cropW = current.height * ratio;
  } else {
    cropW = current.width;
    cropH = current.width / ratio;
  }
  cropW = Math.min(current.width, cropW);
  cropH = Math.min(current.height, cropH);
  return {
    x: (current.width - cropW) * focusX,
    y: (current.height - cropH) * focusY,
    w: cropW,
    h: cropH,
  };
}

function plannedSize() {
  const box = sourceCrop();
  if (!box) return null;
  const requested = selectedWidth === "original" ? box.w : Math.min(box.w, Number(selectedWidth));
  const width = even(requested);
  const height = even(box.h * (width / box.w));
  return { width, height };
}

function updateOutputSize() {
  const size = plannedSize();
  const label = size ? `${size.width} × ${size.height}` : "-";
  meta.output.textContent = label;
  meta.output.title = label;
  const note = document.querySelector("#sizeNote");
  const box = sourceCrop();
  const clamped = box && selectedWidth !== "original" && box.w < Number(selectedWidth);
  note.textContent = clamped
    ? "원본보다 크게 늘리지 않고, 잘린 화면 크기로 변환합니다."
    : "지원하는 모든 동영상 형식에 이 너비가 실제로 적용됩니다.";
  updateFrameEstimate();
}

function clipRange() {
  if (!current) return { start: 0, end: 0, span: 0 };
  const duration = Number(current.duration) || 0;
  const startValue = Number(trimStart.value);
  const endValue = Number(trimEnd.value);
  let start = Number.isFinite(startValue) ? startValue : 0;
  let end = Number.isFinite(endValue) ? endValue : 0;
  start = Math.min(Math.max(0, start), duration || start);
  end = Math.min(Math.max(0, end), duration || end);
  if (start === 0 && end === 0) return { start: 0, end: 0, span: 0 };
  if (end < start) end = start;
  return { start, end, span: Math.max(0, end - start) };
}

function parseTime(text) {
  const value = String(text ?? "").trim();
  if (value === "") return null;
  const clock = value.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

function formatClock(seconds) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const remain = (total - minutes * 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${remain}`;
}

function updateFrameEstimate() {
  if (!current) return;
  const fps = current.sourceFps > 30 ? 30 : current.targetFps;
  const range = clipRange();
  const frames = current.duration ? Math.max(0, Math.round(range.span * fps)) : current.frames;
  setText(meta.frames, frames ? `${frames.toLocaleString("ko-KR")}장` : "0장");
  trimReadout.textContent = `${formatClock(range.start)} – ${formatClock(range.end)} · ${range.span.toFixed(1)}초`;
  if (document.activeElement !== trimStartText) trimStartText.value = formatClock(range.start);
  if (document.activeElement !== trimEndText) trimEndText.value = formatClock(range.end);
}

function setText(node, value, title) {
  node.textContent = value || "-";
  node.title = title || value || "";
}

function clearAlert() {
  notice.hidden = true;
  notice.replaceChildren();
  formatSection.classList.remove("is-alert");
  formatHeading.textContent = "변환할 수 있는 형식";
}

function showUnsupported(fileName, detail) {
  details.hidden = true;
  work.hidden = true;
  current = null;
  convertBtn.disabled = true;
  formatSection.classList.add("is-alert");
  formatHeading.textContent = "아래 형식으로 다시 선택해 주세요";
  notice.hidden = false;
  notice.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "이 파일은 GIF로 변환할 수 없습니다";
  const body = document.createElement("div");
  body.textContent = `${fileName} — ${detail} 아래에 표시된 동영상 형식으로 다시 선택해 주세요.`;
  notice.append(title, body);
  for (const tile of formatGrid.querySelectorAll(".fmt")) tile.classList.remove("is-current");
  dropTitle.textContent = "다른 동영상 파일을 선택해 주세요";
  dropStatus.textContent = "변환할 수 있는 형식만 불러올 수 있습니다.";
}

function markFormat(ext) {
  const id = ICON_OF[ext] || "";
  for (const tile of formatGrid.querySelectorAll(".fmt")) {
    tile.classList.toggle("is-current", tile.dataset.id === id);
  }
}

function setProgress(percent, phase) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  progressFill.style.width = `${value}%`;
  progressTrack.setAttribute("aria-valuenow", String(value));
  percentLabel.textContent = `${value}%`;
  phaseLabel.textContent = phase;
}

function setRunButtons(running) {
  stopBtn.hidden = !running;
  cancelBtn.hidden = !running;
  stopBtn.disabled = false;
  cancelBtn.disabled = false;
}

function resetWork(saveAs) {
  work.hidden = false;
  setProgress(0, "준비");
  workCaption.textContent = "프레임을 자르는 동안 아래에 미리보기가 쌓입니다.";
  filmstrip.replaceChildren();
  currentThumb.removeAttribute("src");
  currentThumb.classList.remove("is-on");
  currentThumb.alt = "";
  currentCaption.textContent = "프레임이 만들어지면 여기에 보입니다";
  downloadBtn.disabled = true;
  saveName.textContent = saveAs || "";
  saveName.title = saveAs || "";
  gifPreview.hidden = true;
  gifResult.removeAttribute("src");
  setRunButtons(true);
}

function addThumb(src, index) {
  currentThumb.src = src;
  currentThumb.alt = `${index}번째 프레임 미리보기`;
  currentThumb.classList.add("is-on");
  currentCaption.textContent = `${index}번째 프레임`;
  const image = document.createElement("img");
  image.src = src;
  image.alt = `${index}번째 GIF 프레임`;
  filmstrip.append(image);
  filmstrip.scrollLeft = filmstrip.scrollWidth;
}

function paintCrop() {
  const box = sourceCrop();
  cropFrame.classList.toggle("is-fixed", selectedAspect === "original");
  cropFrame.classList.toggle("is-free", selectedAspect === "free");
  if (!box || !poster.naturalWidth || !poster.clientWidth) {
    cropRect.hidden = true;
    return;
  }
  cropRect.hidden = false;
  const scale = poster.clientWidth / current.width;
  const offsetX = poster.offsetLeft;
  const offsetY = poster.offsetTop;
  cropRect.style.left = `${offsetX + box.x * scale}px`;
  cropRect.style.top = `${offsetY + box.y * scale}px`;
  cropRect.style.width = `${box.w * scale}px`;
  cropRect.style.height = `${box.h * scale}px`;
  renderStickers();
}

function refreshOverlaySelection() {
  for (const node of stickerLayer.querySelectorAll(".sticker, .overlay-text")) {
    const selected = node.classList.contains("sticker")
      ? node.dataset.id === selectedSticker
      : node.dataset.id === selectedText;
    node.classList.toggle("is-selected", selected);
  }
  const sticker = stickers.find((item) => item.id === selectedSticker);
  const text = texts.find((item) => item.id === selectedText);
  stickerDelete.disabled = !sticker;
  textUpdate.disabled = !text;
  textDelete.disabled = !text;
  if (sticker) stickerSize.value = String(Math.round((sticker.scale || 0.18) * 100));
  if (text) {
    textSize.value = String(Math.round((text.scale || 0.16) * 100));
    textColor.value = text.color || "#fffdf8";
    textWeight.value = String(text.weight || 800);
    textOpacity.value = String(Math.round((1 - (text.opacity ?? 1)) * 100));
  }
  showTextStyleReadout();
}

function showTextStyleReadout() {
  const weight = Number(textWeight.value);
  textWeightValue.textContent = weight >= 800 ? "굵게" : weight >= 600 ? "중간" : "보통";
  textOpacityValue.textContent = `${textOpacity.value}%`;
}

function currentTextStyle() {
  return {
    color: textColor.value || "#fffdf8",
    weight: Number(textWeight.value) || 800,
    opacity: 1 - Number(textOpacity.value) / 100,
  };
}

function applyTextLook(node, text, width) {
  node.textContent = text.text;
  node.style.left = `${text.x * 100}%`;
  node.style.top = `${text.y * 100}%`;
  node.style.color = text.color || "#fffdf8";
  node.style.fontWeight = String(text.weight || 800);
  node.style.opacity = String(text.opacity ?? 1);
  node.style.fontSize = `${Math.max(16, (text.scale || 0.16) * width)}px`;
}

function renderStickers() {
  if (cropDrag && (cropDrag.mode === "sticker" || cropDrag.mode === "text")) {
    const list = cropDrag.mode === "sticker" ? stickers : texts;
    const item = list.find((entry) => entry.id === cropDrag.id);
    const node = stickerLayer.querySelector(`[data-id="${cropDrag.id}"]`);
    if (item && node) {
      if (cropDrag.mode === "text") applyTextLook(node, item, cropRect.clientWidth || item.scale * 100);
      else {
        node.style.left = `${item.x * 100}%`;
        node.style.top = `${item.y * 100}%`;
      }
      refreshOverlaySelection();
      return;
    }
  }
  stickerLayer.replaceChildren();
  const box = sourceCrop();
  const width = box ? cropRect.clientWidth || box.w : 0;
  for (const sticker of stickers) {
    const node = document.createElement("span");
    node.className = "sticker";
    node.dataset.id = sticker.id;
    node.textContent = sticker.emoji;
    node.style.left = `${sticker.x * 100}%`;
    node.style.top = `${sticker.y * 100}%`;
    node.style.fontSize = `${Math.max(18, (sticker.scale || 0.18) * width)}px`;
    stickerLayer.append(node);
  }
  for (const text of texts) {
    const node = document.createElement("span");
    node.className = "overlay-text";
    node.dataset.id = text.id;
    applyTextLook(node, text, width);
    stickerLayer.append(node);
  }
  refreshOverlaySelection();
}

function applyInfo(file) {
  current = file;
  focusX = 0.5;
  focusY = 0.5;
  freeCrop = { x: file.width * 0.15, y: file.height * 0.15, w: file.width * 0.7, h: file.height * 0.7 };
  stickers = [];
  selectedSticker = null;
  texts = [];
  selectedText = null;
  textInput.value = "";
  renderStickers();
  clearAlert();
  details.hidden = false;
  work.hidden = true;
  convertBtn.disabled = false;
  markFormat(file.ext);
  setText(meta.name, file.baseName);
  setText(meta.size, file.sizeLabel);
  setText(meta.format, file.formatLabel, file.formatTitle);
  setText(meta.codec, file.codecLabel, file.codecTitle);
  setText(meta.resolution, `${file.width} × ${file.height}`);
  setText(meta.duration, file.durationLabel);
  setText(meta.fps, file.fpsLabel);
  setText(meta.bitrate, file.bitrateLabel);
  const duration = Number(file.duration) || 0;
  trimBlock.hidden = duration <= 0;
  trimStart.max = String(duration || 0);
  trimEnd.max = String(duration || 0);
  trimStart.value = "0";
  trimEnd.value = String(duration || 0);
  cropFrame.hidden = !file.hasPoster;
  if (file.hasPoster) {
    poster.onload = () => paintCrop();
    poster.src = file.posterUrl || api(`/api/poster/${file.id}?t=${Date.now()}`);
    poster.alt = `${file.baseName} 미리보기`;
  } else {
    poster.removeAttribute("src");
    cropRect.hidden = true;
  }
  updateOutputSize();
  dropTitle.textContent = file.name;
  dropStatus.textContent = "다른 파일을 놓으면 이 선택을 바꿉니다. 한 번에 하나만 변환합니다.";
  convertBtn.textContent = "GIF로 변환";
  showStudio();
}

function localReject(file) {
  const ext = extensionOf(file.name);
  if (BLOCKED_EXT.has(ext)) {
    return ext ? `${ext.toUpperCase()} 형식은 동영상이 아닙니다.` : "동영상 파일이 아닙니다.";
  }
  return "";
}

async function readSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let splitAt = buffer.indexOf("\n\n");
    while (splitAt >= 0) {
      const raw = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      const data = raw
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data) onEvent(JSON.parse(data));
      splitAt = buffer.indexOf("\n\n");
    }
  }
}

async function handleFile(file) {
  if (!file || busy) {
    if (busy) dropStatus.textContent = "변환이 끝난 뒤 다른 파일을 선택할 수 있습니다.";
    return;
  }
  const rejected = localReject(file);
  if (rejected) {
    showUnsupported(file.name, rejected);
    showStudio();
    return;
  }
  clearAlert();
  showStudio();
  dropTitle.textContent = browserMode ? "변환 엔진을 준비하고 있습니다" : "파일 정보를 읽고 있습니다";
  dropStatus.textContent = file.name;
  pickBtn.disabled = true;
  convertBtn.disabled = true;
  try {
    if (browserMode) {
      const payload = await GifBrowser.inspect(file);
      if (!payload.ok) {
        showUnsupported(file.name, payload.message || "이 형식은 변환할 수 없습니다.");
        return;
      }
      applyInfo(payload.file);
      return;
    }
    const response = await fetch(api("/api/inspect"), {
      method: "POST",
      headers: { "X-Filename": encodeURIComponent(file.name) },
      body: file,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      showUnsupported(file.name, payload.message || "이 형식은 변환할 수 없습니다.");
      return;
    }
    applyInfo(payload.file);
  } catch (error) {
    showUnsupported(file.name, browserMode
      ? "파일을 확인하지 못했습니다. 다른 동영상 파일로 다시 시도해 주세요."
      : "파일을 확인하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.");
  } finally {
    pickBtn.disabled = busy;
  }
}

function handleFileList(fileList) {
  const files = [...fileList];
  if (files.length === 0) return;
  if (files.length > 1) {
    showUnsupported(files[0].name, "파일은 한 번에 하나만 선택할 수 있습니다.");
    showStudio();
    return;
  }
  handleFile(files[0]);
}

function stickerSheet() {
  if (!stickers.length && !texts.length) return "";
  const size = plannedSize();
  if (!size) return "";
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const sticker of stickers) {
    const fontSize = Math.max(12, Math.round((sticker.scale || 0.18) * size.width));
    context.font = `${fontSize}px "Segoe UI Emoji", "Segoe UI Symbol", sans-serif`;
    context.fillText(sticker.emoji, sticker.x * size.width, sticker.y * size.height);
  }
  for (const text of texts) {
    const fontSize = Math.max(14, Math.round((text.scale || 0.16) * size.width));
    const weight = text.weight || 800;
    context.save();
    context.globalAlpha = text.opacity ?? 1;
    context.font = `${weight} ${fontSize}px "Malgun Gothic", "Segoe UI", sans-serif`;
    context.lineWidth = Math.max(2, Math.round(fontSize / 10));
    context.strokeStyle = "rgba(20, 16, 12, 0.92)";
    context.fillStyle = text.color || "#fffdf8";
    context.strokeText(text.text, text.x * size.width, text.y * size.height);
    context.fillText(text.text, text.x * size.width, text.y * size.height);
    context.restore();
  }
  return canvas.toDataURL("image/png");
}

function phaseText(event) {
  if (event.phase === "palette") return "GIF 색을 맞추는 중";
  if (event.phase === "encode") return "GIF를 저장하는 중";
  return `프레임 추출 ${event.frame || 0}${event.total ? ` / ${event.total}` : ""}`;
}

async function startConvert() {
  if (!current || busy) return;
  const earlyRange = clipRange();
  if (earlyRange.span <= 0) {
    trimReadout.textContent = "구간 길이가 0초입니다. 끝 시간을 0보다 뒤로 입력한 뒤 변환해 주세요.";
    return;
  }
  busy = true;
  pickBtn.disabled = true;
  convertBtn.disabled = true;
  dropzone.classList.add("is-busy");
  for (const button of document.querySelectorAll(".choice, #sizeChoices button, #qualityChoices button, #aspectChoices button")) {
    button.disabled = true;
  }
  trimStart.disabled = true;
  trimEnd.disabled = true;
  trimStartText.disabled = true;
  trimEndText.disabled = true;
  loopToggle.disabled = true;
  stickerSize.disabled = true;
  textInput.disabled = true;
  textAdd.disabled = true;
  textUpdate.disabled = true;
  textDelete.disabled = true;
  textSize.disabled = true;
  textColor.disabled = true;
  textWeight.disabled = true;
  textOpacity.disabled = true;
  resetWork(current.downloadName);
  setProgress(0, "프레임 추출 준비");
  const range = earlyRange;
  let outcome = "done";
  try {
    const overlay = await stickerSheet();
    const box = sourceCrop();
    const handle = (event) => {
      if (event.type === "progress") {
        const text = phaseText(event);
        setProgress(event.percent, text);
        workCaption.textContent = text;
      } else if (event.type === "thumb") {
        addThumb(event.url || api(`/api/frame/${encodeURIComponent(current.id)}/${event.name}?v=${event.index}`), event.index);
      } else if (event.type === "done") {
        setProgress(100, "변환 완료");
        workCaption.textContent = `${event.width} × ${event.height} · ${event.frames.toLocaleString("ko-KR")}프레임 · ${event.sizeLabel}`;
        if (event.outputLabel) setText(meta.output, event.outputLabel);
        downloadBtn.disabled = false;
        saveName.textContent = event.filename;
        saveName.title = event.filename;
        convertBtn.textContent = "다시 변환";
        if (event.previewUrl) current.gifUrl = event.downloadUrl || event.previewUrl;
        if (event.libraryId) {
          gifResult.src = event.previewUrl || api(`/api/library/${event.libraryId}/file?inline=1&t=${Date.now()}`);
          gifPreview.hidden = false;
        }
      } else if (event.type === "stopped") {
        outcome = "stopped";
        setProgress(Number(progressTrack.getAttribute("aria-valuenow")) || 0, "변환을 중단했습니다");
        workCaption.textContent = "변환을 중단했습니다. 같은 파일로 다시 변환할 수 있습니다.";
        downloadBtn.disabled = true;
      } else if (event.type === "cancelled") {
        outcome = "cancelled";
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    };
    if (browserMode) {
      await GifBrowser.convert({
        id: current.id,
        width: selectedWidth,
        colors: selectedColors,
        aspect: selectedAspect,
        nx: focusX,
        ny: focusY,
        crop: box,
        start: range.start,
        end: range.end,
        loop: loopToggle.checked,
        overlay,
      }, handle);
    } else {
    const response = await fetch(api("/api/convert"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: current.id,
        width: selectedWidth,
        colors: selectedColors,
        aspect: selectedAspect,
        nx: focusX,
        ny: focusY,
        crop: box,
        start: range.start,
        end: range.end,
        loop: loopToggle.checked,
        overlay,
      }),
    });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("text/event-stream")) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "변환을 시작하지 못했습니다.");
    }
    await readSSE(response, handle);
    }
    if (outcome === "cancelled") {
      work.hidden = true;
      filmstrip.replaceChildren();
      downloadBtn.disabled = true;
      workCaption.textContent = "변환을 취소했습니다.";
    }
  } catch (error) {
    if (outcome === "done") {
      downloadBtn.disabled = true;
      setProgress(0, "변환 실패");
      workCaption.textContent = error.message || "변환에 실패했습니다.";
    }
  } finally {
    busy = false;
    setRunButtons(false);
    pickBtn.disabled = false;
    convertBtn.disabled = !current;
    dropzone.classList.remove("is-busy");
    trimStart.disabled = false;
    trimEnd.disabled = false;
    trimStartText.disabled = false;
    trimEndText.disabled = false;
    loopToggle.disabled = false;
    stickerSize.disabled = false;
    textInput.disabled = false;
    textAdd.disabled = false;
    textSize.disabled = false;
    textColor.disabled = false;
    textWeight.disabled = false;
    textOpacity.disabled = false;
    refreshOverlaySelection();
    for (const button of document.querySelectorAll("#sizeChoices button, #qualityChoices button, #aspectChoices button")) {
      button.disabled = false;
    }
  }
}

async function halt(action) {
  if (!busy || !current) return;
  stopBtn.disabled = true;
  cancelBtn.disabled = true;
  phaseLabel.textContent = action === "stop" ? "중단하는 중" : "취소하는 중";
  try {
    if (browserMode) {
      GifBrowser.control(action);
      return;
    }
    await fetch(api("/api/control"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, action }),
    });
  } catch (error) {
    workCaption.textContent = "중단 요청을 보내지 못했습니다.";
  }
}

function showStudio() {
  libraryView.hidden = true;
  studio.hidden = false;
  libraryBtn.textContent = "편집한 영상";
}

async function showLibrary() {
  libraryView.hidden = false;
  studio.hidden = true;
  libraryBtn.textContent = "변환 화면";
  libraryGrid.replaceChildren();
  libraryEmpty.hidden = true;
  libraryNote.textContent = "";
  try {
    const payload = browserMode
      ? { items: await GifBrowser.library() }
      : await (await fetch(api("/api/library"))).json();
    const items = payload.items || [];
    libraryEmpty.hidden = items.length > 0;
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "library-card";
      const image = document.createElement("img");
      image.src = item.fileUrl || api(`/api/library/${item.id}/file?inline=1`);
      image.alt = item.name;
      const title = document.createElement("h3");
      title.textContent = item.name;
      title.title = item.name;
      const info = document.createElement("p");
      info.textContent = `${item.createdLabel || ""} · ${item.width || "?"} × ${item.height || "?"} · ${item.sizeLabel || ""}`;
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const download = document.createElement("button");
      download.type = "button";
      download.className = "card-download";
      download.textContent = "다운로드";
      download.addEventListener("click", () => {
        const name = item.name;
        saveWithPicker(name, item.fileUrl || api(`/api/library/${item.id}/file`), () => {
          libraryNote.textContent = `${name} 파일로 저장했습니다.`;
        }).catch((error) => {
          if (error && error.name === "AbortError") return;
          libraryNote.textContent = "저장 위치를 열지 못했습니다. 다시 시도해 주세요.";
        });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        const result = browserMode
          ? { ok: true }
          : await fetch(api(`/api/library/${item.id}`), { method: "DELETE" });
        if (browserMode) await GifBrowser.remove(item.id);
        if (result.ok) card.remove();
        libraryEmpty.hidden = libraryGrid.children.length > 0;
      });
      actions.append(download, remove);
      card.append(image, title, info, actions);
      libraryGrid.append(card);
    }
  } catch (error) {
    libraryEmpty.hidden = false;
    libraryEmpty.textContent = browserMode
      ? "보관 목록을 불러오지 못했습니다."
      : "보관 목록을 불러오지 못했습니다. gif-studio 폴더의 index.hta를 더블클릭한 뒤 다시 열어 주세요.";
  }
}

pickBtn.addEventListener("click", () => {
  if (busy) return;
  fileInput.value = "";
  fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files) handleFileList(fileInput.files);
});

document.addEventListener("dragenter", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  dragDepth += 1;
  dropzone.classList.add("is-drag");
});
document.addEventListener("dragover", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
document.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropzone.classList.remove("is-drag");
});
document.addEventListener("drop", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove("is-drag");
  handleFileList(event.dataTransfer.files);
});

function applyTypedTrim(edited) {
  if (!current) return;
  const duration = Number(current.duration) || 0;
  let start = parseTime(trimStartText.value);
  let end = parseTime(trimEndText.value);
  if (start === null) start = Number(trimStart.value) || 0;
  if (end === null) end = Number(trimEnd.value);
  if (!Number.isFinite(end)) end = 0;
  start = Math.min(Math.max(0, start), duration || start);
  end = Math.min(Math.max(0, end), duration || end);
  if (!(start === 0 && end === 0) && end < start) {
    if (edited === "start") end = start;
    else start = end;
  }
  trimStart.value = String(start);
  trimEnd.value = String(end);
  updateFrameEstimate();
}

trimStart.addEventListener("input", () => {
  const start = Number(trimStart.value);
  const end = Number(trimEnd.value);
  if (!(start === 0 && end === 0) && start > end) trimEnd.value = String(start);
  updateFrameEstimate();
});
trimEnd.addEventListener("input", () => {
  const start = Number(trimStart.value);
  const end = Number(trimEnd.value);
  if (!(start === 0 && end === 0) && end < start) trimStart.value = String(end);
  updateFrameEstimate();
});
trimStartText.addEventListener("change", () => applyTypedTrim("start"));
trimEndText.addEventListener("change", () => applyTypedTrim("end"));
trimStartText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyTypedTrim("start");
});
trimEndText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyTypedTrim("end");
});

cropRect.addEventListener("pointerdown", (event) => {
  if (busy || !current || event.target.closest(".sticker, .overlay-text")) return;
  const handle = event.target.dataset.handle || "";
  if (selectedAspect !== "free" && !handle) {
    if (selectedAspect === "original") return;
    cropDrag = { mode: "move-aspect", x: event.clientX, y: event.clientY, fx: focusX, fy: focusY };
  } else if (selectedAspect === "free") {
    const box = sourceCrop();
    cropDrag = { mode: handle ? "resize" : "move-free", handle, x: event.clientX, y: event.clientY, box: { ...box } };
  } else return;
  cropRect.setPointerCapture(event.pointerId);
});
cropRect.addEventListener("pointermove", (event) => {
  if (!cropDrag || !current) return;
  const scale = poster.clientWidth / current.width;
  if (cropDrag.mode === "move-aspect") {
    const box = sourceCrop();
    const freeX = (current.width - box.w) * scale;
    const freeY = (current.height - box.h) * scale;
    if (freeX > 2) focusX = Math.min(1, Math.max(0, cropDrag.fx + (event.clientX - cropDrag.x) / freeX));
    if (freeY > 2) focusY = Math.min(1, Math.max(0, cropDrag.fy + (event.clientY - cropDrag.y) / freeY));
  } else {
    const dx = (event.clientX - cropDrag.x) / scale;
    const dy = (event.clientY - cropDrag.y) / scale;
    const start = cropDrag.box;
    let x = start.x;
    let y = start.y;
    let w = start.w;
    let h = start.h;
    const handle = cropDrag.handle || "";
    if (cropDrag.mode === "move-free") {
      x = start.x + dx;
      y = start.y + dy;
    } else {
      if (handle.includes("e")) w = start.w + dx;
      if (handle.includes("s")) h = start.h + dy;
      if (handle.includes("w")) {
        x = start.x + dx;
        w = start.w - dx;
      }
      if (handle.includes("n")) {
        y = start.y + dy;
        h = start.h - dy;
      }
    }
    w = Math.max(16, w);
    h = Math.max(16, h);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > current.width) {
      if (cropDrag.mode === "move-free") x = current.width - w;
      else w = current.width - x;
    }
    if (y + h > current.height) {
      if (cropDrag.mode === "move-free") y = current.height - h;
      else h = current.height - y;
    }
    freeCrop = { x, y, w: Math.max(16, w), h: Math.max(16, h) };
  }
  paintCrop();
  updateOutputSize();
});
cropRect.addEventListener("pointerup", () => {
  cropDrag = null;
});
cropRect.addEventListener("pointercancel", () => {
  cropDrag = null;
});

stickerLayer.addEventListener("pointerdown", (event) => {
  const stickerNode = event.target.closest(".sticker");
  const textNode = event.target.closest(".overlay-text");
  const node = stickerNode || textNode;
  if (!node || busy) return;
  event.stopPropagation();
  event.preventDefault();
  if (stickerNode) {
    selectedSticker = stickerNode.dataset.id;
    selectedText = null;
    const sticker = stickers.find((item) => item.id === selectedSticker);
    if (!sticker) return;
    cropDrag = {
      mode: "sticker",
      id: selectedSticker,
      x: event.clientX,
      y: event.clientY,
      sx: sticker.x,
      sy: sticker.y,
    };
  } else {
    selectedText = textNode.dataset.id;
    selectedSticker = null;
    const text = texts.find((item) => item.id === selectedText);
    if (!text) return;
    textInput.value = text.text;
    cropDrag = {
      mode: "text",
      id: selectedText,
      x: event.clientX,
      y: event.clientY,
      sx: text.x,
      sy: text.y,
    };
  }
  node.setPointerCapture(event.pointerId);
  renderStickers();
});
stickerLayer.addEventListener("pointermove", (event) => {
  if (!cropDrag || (cropDrag.mode !== "sticker" && cropDrag.mode !== "text")) return;
  const list = cropDrag.mode === "sticker" ? stickers : texts;
  const item = list.find((entry) => entry.id === cropDrag.id);
  if (!item) return;
  const width = cropRect.clientWidth || 1;
  const height = cropRect.clientHeight || 1;
  item.x = Math.min(1, Math.max(0, cropDrag.sx + (event.clientX - cropDrag.x) / width));
  item.y = Math.min(1, Math.max(0, cropDrag.sy + (event.clientY - cropDrag.y) / height));
  renderStickers();
});
stickerLayer.addEventListener("pointerup", () => {
  if (cropDrag && (cropDrag.mode === "sticker" || cropDrag.mode === "text")) {
    cropDrag = null;
    refreshOverlaySelection();
  }
});

stickerSize.addEventListener("input", () => {
  const sticker = stickers.find((item) => item.id === selectedSticker);
  if (!sticker) return;
  sticker.scale = Number(stickerSize.value) / 100;
  renderStickers();
});
stickerDelete.addEventListener("click", () => {
  if (!selectedSticker) return;
  stickers = stickers.filter((item) => item.id !== selectedSticker);
  selectedSticker = null;
  if (cropDrag && cropDrag.mode === "sticker") cropDrag = null;
  renderStickers();
});
textAdd.addEventListener("click", () => {
  if (busy || !current) return;
  const value = textInput.value.trim();
  if (!value) return;
  const id = `text-${Date.now()}-${texts.length}`;
  const style = currentTextStyle();
  texts.push({
    id,
    text: value,
    x: 0.5,
    y: 0.42,
    scale: Number(textSize.value) / 100,
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
  });
  selectedText = id;
  selectedSticker = null;
  renderStickers();
});
textUpdate.addEventListener("click", () => {
  const text = texts.find((item) => item.id === selectedText);
  if (!text || busy) return;
  const value = textInput.value.trim();
  if (!value) return;
  text.text = value;
  renderStickers();
});
textDelete.addEventListener("click", () => {
  if (!selectedText) return;
  texts = texts.filter((item) => item.id !== selectedText);
  selectedText = null;
  if (cropDrag && cropDrag.mode === "text") cropDrag = null;
  renderStickers();
});
function updateSelectedTextStyle() {
  const text = texts.find((item) => item.id === selectedText);
  showTextStyleReadout();
  if (!text) return;
  const style = currentTextStyle();
  text.color = style.color;
  text.weight = style.weight;
  text.opacity = style.opacity;
  text.scale = Number(textSize.value) / 100;
  renderStickers();
}
textSize.addEventListener("input", updateSelectedTextStyle);
textColor.addEventListener("input", updateSelectedTextStyle);
textWeight.addEventListener("input", updateSelectedTextStyle);
textOpacity.addEventListener("input", updateSelectedTextStyle);
for (const emoji of EMOJIS) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = emoji;
  button.addEventListener("click", () => {
    if (busy || !current) return;
    const id = `${Date.now()}-${stickers.length}`;
    stickers.push({ id, emoji, x: 0.5, y: 0.5, scale: 0.18 });
    selectedSticker = id;
    renderStickers();
  });
  stickerPalette.append(button);
}
window.addEventListener("resize", paintCrop);

function downloadBlob(name, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

async function chooseFile(name) {
  if (typeof window.showSaveFilePicker !== "function") return null;
  const options = {
    suggestedName: name,
    startIn: "downloads",
    types: [{ description: "GIF", accept: { "image/gif": [".gif"] } }],
  };
  try {
    return await window.showSaveFilePicker(options);
  } catch (error) {
    if (error && error.name === "AbortError") return false;
    try {
      return await window.showSaveFilePicker({ suggestedName: name, types: options.types });
    } catch (second) {
      if (second && second.name === "AbortError") return false;
      return null;
    }
  }
}

async function saveWithPicker(name, url, onSaved) {
  const handle = await chooseFile(name);
  if (handle === false) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error("저장할 GIF를 찾지 못했습니다.");
  const blob = await response.blob();
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    downloadBlob(name, blob);
  }
  if (onSaved) onSaved(name);
}

downloadBtn.addEventListener("click", () => {
  if (!current || downloadBtn.disabled) return;
  const name = current.downloadName;
  saveWithPicker(name, current.gifUrl || api(`/api/download/${encodeURIComponent(current.id)}`), () => {
    workCaption.textContent = `${name} 파일로 저장했습니다.`;
  }).catch((error) => {
    if (error && error.name === "AbortError") return;
    workCaption.textContent = "저장 위치를 열지 못했습니다. 다시 시도해 주세요.";
  });
});
convertBtn.addEventListener("click", startConvert);
stopBtn.addEventListener("click", () => halt("stop"));
cancelBtn.addEventListener("click", () => halt("cancel"));
libraryBtn.addEventListener("click", () => {
  if (libraryView.hidden) showLibrary();
  else showStudio();
});

showTextStyleReadout();
renderFormats();
renderWidths();
renderQualities();
renderAspects();
syncQuality();

fetch(api("/api/health"))
  .then((response) => response.json())
  .then((health) => {
    if (health.ok) return;
    browserMode = true;
  })
  .catch(() => {
    browserMode = true;
  });
