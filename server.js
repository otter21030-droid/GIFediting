"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");

const PORT = Number(process.env.PORT) || 4173;
const ROOT = __dirname;
const TMP_DIR = path.join(ROOT, "tmp");
const LIBRARY_DIR = path.join(ROOT, "library");
const LIBRARY_INDEX = path.join(LIBRARY_DIR, "index.json");
const FFMPEG = path.join(ROOT, "bin", "ffmpeg.exe");
const FFPROBE = path.join(ROOT, "bin", "ffprobe.exe");
const MAX_UPLOAD = 4 * 1024 * 1024 * 1024;
const WIDTHS = new Set([320, 480, 640, 800, 1280, "original"]);
const ASPECTS = new Set(["original", "landscape", "square", "portrait", "free"]);
const COLORS = new Set([64, 128, 192]);
const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/browser.js", "browser.js"],
  ["/styles.css", "styles.css"],
]);

const jobs = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  applyCors(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function stemOf(filename) {
  const base = path.basename(String(filename || "video"))
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .trim();
  const stem = base.replace(/\.[^.]+$/, "").replace(/[. ]+$/g, "").trim();
  return (stem || "video").slice(0, 180);
}

function extOf(filename) {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match ? match[1] : "bin";
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remain = total - minutes * 60;
  const text = remain.toFixed(1).padStart(4, "0");
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${text}`;
  }
  return `${minutes}:${text}`;
}

function formatFps(fps) {
  if (!fps) return "-";
  const rounded = Math.round(fps);
  if (Math.abs(fps - rounded) < 0.05) return `${rounded} FPS`;
  return `${fps.toFixed(2)} FPS`;
}

function prettyCodec(name) {
  const key = String(name || "").toLowerCase();
  const known = {
    h264: "H.264",
    hevc: "H.265",
    h265: "H.265",
    vp8: "VP8",
    vp9: "VP9",
    av1: "AV1",
    mpeg4: "MPEG-4",
    mpeg2video: "MPEG-2",
    mpeg1video: "MPEG-1",
    wmv2: "WMV",
    wmv3: "WMV",
    vc1: "VC-1",
    flv1: "FLV",
    theora: "Theora",
    mjpeg: "MJPEG",
    rv40: "RealVideo",
  };
  return known[key] || (key ? key.toUpperCase() : "-");
}

function formatBitrate(bps) {
  const value = Number(bps) || 0;
  if (!value) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mbps`;
  if (value >= 1000) return `${Math.round(value / 1000)} kbps`;
  return `${value} bps`;
}

function parseRate(value) {
  if (!value || value === "0/0") return 0;
  const [num, den] = String(value).split("/").map(Number);
  if (!den) return num || 0;
  if (!Number.isFinite(num / den)) return 0;
  return num / den;
}

function even(value) {
  const number = Math.max(2, Math.round(Number(value) || 2));
  return number - (number % 2);
}

function fpsArg(fps) {
  const rounded = Math.round(fps);
  if (Math.abs(fps - rounded) < 0.01) return String(rounded);
  return String(Math.round(fps * 1000) / 1000);
}

function toolsReady() {
  return fs.existsSync(FFMPEG) && fs.existsSync(FFPROBE);
}

function runTool(bin, args, hooks = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    hooks.attach?.(child);
    let stderr = "";
    child.stdout.on("data", (chunk) => hooks.onStdout?.(chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 24000) stderr = stderr.slice(-16000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const error = new Error(stderr.trim() || `${path.basename(bin)}가 종료되었습니다 (${code})`);
        error.code = code;
        reject(error);
      }
    });
  });
}

function progressParser(onRecord) {
  let carry = "";
  let record = {};
  return (chunk) => {
    carry += chunk;
    const lines = carry.split(/\r?\n/);
    carry = lines.pop() || "";
    for (const line of lines) {
      const index = line.indexOf("=");
      if (index < 0) continue;
      const key = line.slice(0, index);
      const value = line.slice(index + 1);
      if (key === "progress") {
        record.progress = value;
        onRecord(record);
        record = {};
      } else {
        record[key] = value;
      }
    }
  };
}

function timeOf(record) {
  const clock = String(record.out_time || "");
  const match = clock.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (record.out_time_us) return Number(record.out_time_us) / 1e6;
  if (record.out_time_ms) return Number(record.out_time_ms) / 1e6;
  return 0;
}

function friendlyError(error) {
  const text = String(error && error.message ? error.message : error);
  if (/Invalid data|moov atom|not supported|Invalid argument|Error opening input|could not find codec/i.test(text)) {
    return "이 파일은 지원하는 동영상으로 열리지 않습니다. 화면에 표시된 형식의 파일을 선택해 주세요.";
  }
  if (/no frames/i.test(text)) {
    return "영상에서 프레임을 꺼내지 못했습니다. 다른 동영상 파일을 선택해 주세요.";
  }
  return "변환 중 문제가 생겼습니다. 다른 동영상 파일로 다시 시도해 주세요.";
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.min(1, Math.max(0, number));
}

function computeCrop(info, aspect, nx, ny) {
  if (aspect === "original") return null;
  const ratio = aspect === "square" ? 1 : aspect === "portrait" ? 9 / 16 : 16 / 9;
  let cropW;
  let cropH;
  if (info.width / info.height > ratio) {
    cropH = info.height;
    cropW = info.height * ratio;
  } else {
    cropW = info.width;
    cropH = info.width / ratio;
  }
  cropW = Math.min(info.width, even(cropW));
  cropH = Math.min(info.height, even(cropH));
  const maxX = Math.max(0, info.width - cropW);
  const maxY = Math.max(0, info.height - cropH);
  let x = even(maxX * clamp01(nx));
  let y = even(maxY * clamp01(ny));
  if (x > maxX) x = maxX - (maxX % 2);
  if (y > maxY) y = maxY - (maxY % 2);
  return { w: Math.max(2, cropW), h: Math.max(2, cropH), x: Math.max(0, x), y: Math.max(0, y) };
}

function freeCropBox(info, raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  let w = even(Math.min(info.width, Math.max(16, Number(source.w) || info.width)));
  let h = even(Math.min(info.height, Math.max(16, Number(source.h) || info.height)));
  if (w > info.width) w = info.width - (info.width % 2);
  if (h > info.height) h = info.height - (info.height % 2);
  let x = even(Math.max(0, Number(source.x) || 0));
  let y = even(Math.max(0, Number(source.y) || 0));
  if (x + w > info.width) x = Math.max(0, info.width - w);
  if (y + h > info.height) y = Math.max(0, info.height - h);
  x -= x % 2;
  y -= y % 2;
  return { w: Math.max(2, w), h: Math.max(2, h), x: Math.max(0, x), y: Math.max(0, y) };
}

function normalizeOptions(info, body) {
  const width = body.width === "original" ? "original" : Number(body.width);
  const aspect = ASPECTS.has(body.aspect) ? body.aspect : "original";
  const colors = COLORS.has(Number(body.colors)) ? Number(body.colors) : 192;
  const loop = body.loop !== false;
  const duration = Number(info.duration) || 0;
  let start = Number(body.start);
  if (!Number.isFinite(start) || start < 0) start = 0;
  let end = body.end === undefined || body.end === null || body.end === "" ? duration : Number(body.end);
  if (!Number.isFinite(end) || end < 0) end = 0;
  if (duration && start > duration) start = duration;
  if (duration && end > duration) end = duration;
  if (end < start) end = start;
  const span = Math.max(0, end - start);
  const full = duration > 0 && start <= 0.01 && Math.abs(end - duration) < 0.08;
  return {
    width,
    aspect,
    nx: clamp01(body.nx),
    ny: clamp01(body.ny),
    crop: body.crop && typeof body.crop === "object" ? body.crop : null,
    colors,
    loop,
    start,
    end,
    span,
    full,
  };
}

function videoFilter(info, options) {
  const crop = options.aspect === "free"
    ? freeCropBox(info, options.crop)
    : computeCrop(info, options.aspect, options.nx, options.ny);
  const baseWidth = crop ? crop.w : info.width;
  const scale = options.width === "original" || Number(options.width) >= baseWidth
    ? "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos"
    : `scale=${Number(options.width)}:-2:flags=lanczos`;
  const parts = [];
  if (info.sourceFps > 30.05) parts.push("fps=30");
  if (crop) parts.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`);
  parts.push(scale);
  return {
    vf: parts.join(","),
    rate: info.sourceFps > 30.05 ? 30 : info.targetFps,
  };
}

function recordRatio(record, duration, frames) {
  const frame = Number(record.frame);
  if (frames > 0 && Number.isFinite(frame) && frame > 0) return Math.min(1, frame / frames);
  const time = timeOf(record);
  if (duration > 0 && time > 0) return Math.min(1, time / duration);
  return 0;
}

function readLibrary() {
  try {
    const data = JSON.parse(fs.readFileSync(LIBRARY_INDEX, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function writeLibrary(items) {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  const temp = `${LIBRARY_INDEX}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(items, null, 2));
  fs.renameSync(temp, LIBRARY_INDEX);
}

function rememberGif(job, stat, width, height, frames) {
  const id = crypto.randomBytes(8).toString("hex");
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  fs.copyFileSync(job.gifPath, path.join(LIBRARY_DIR, `${id}.gif`));
  const items = readLibrary();
  const item = {
    id,
    name: job.info.downloadName,
    createdAt: new Date().toISOString(),
    width,
    height,
    frames,
    bytes: stat.size,
    sizeLabel: formatBytes(stat.size),
  };
  items.unshift(item);
  writeLibrary(items);
  return item;
}

function saveOverlay(job, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return "";
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return "";
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length < 32 || buffer.length > 12 * 1024 * 1024) return "";
  const dest = path.join(job.dir, "overlay.png");
  fs.writeFileSync(dest, buffer);
  return dest;
}

function stopChild(job) {
  if (job.child && !job.child.killed) job.child.kill();
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function clearIdleJobs() {
  for (const [id, job] of jobs) {
    if (job.status === "running") continue;
    removeDir(job.dir);
    jobs.delete(id);
  }
}

async function probe(inputPath) {
  const args = [
    "-v", "error",
    "-analyzeduration", "100M",
    "-probesize", "100M",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    inputPath,
  ];
  let raw = "";
  await runTool(FFPROBE, args, { onStdout: (chunk) => { raw += chunk; } });
  return JSON.parse(raw || "{}");
}

function describe(originalName, data, byteSize) {
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const video = streams
    .filter((stream) => stream.codec_type === "video" && !(stream.disposition && stream.disposition.attached_pic))
    .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0];
  if (!video || !video.width || !video.height) return null;

  const format = data.format || {};
  const duration = Number(video.duration || format.duration) || 0;
  let sourceFps = parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate);
  if (!sourceFps || sourceFps < 1 || sourceFps > 240) sourceFps = 30;
  const targetFps = Math.min(30, sourceFps);
  const counted = Number(video.nb_frames) || 0;
  let frames = 0;
  if (duration > 0) frames = Math.max(1, Math.round(duration * targetFps));
  else if (counted > 0) frames = Math.max(1, Math.round(counted * (targetFps / sourceFps)));

  const ext = extOf(originalName);
  const baseName = stemOf(originalName);
  const formatName = String(format.format_long_name || format.format_name || ext).split(",")[0];
  const codec = video.codec_long_name || video.codec_name || "-";
  const fpsLabel = sourceFps > 30.05
    ? `${formatFps(sourceFps)} → 30 FPS`
    : formatFps(sourceFps);

  return {
    name: path.basename(originalName),
    baseName,
    downloadName: `${baseName}.gif`,
    ext,
    size: byteSize,
    sizeLabel: formatBytes(byteSize),
    formatLabel: ext.toUpperCase(),
    formatTitle: formatName,
    codecLabel: prettyCodec(video.codec_name),
    codecTitle: codec,
    width: video.width,
    height: video.height,
    duration,
    durationLabel: duration ? formatDuration(duration) : "-",
    sourceFps,
    targetFps,
    fpsLabel,
    frames,
    bitrateLabel: formatBitrate(format.bit_rate || video.bit_rate),
  };
}

function writeUpload(req, dest) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers["content-length"] || 0) > MAX_UPLOAD) {
      reject(Object.assign(new Error("파일이 너무 큽니다. 4GB보다 작은 동영상을 선택해 주세요."), { status: 413 }));
      req.resume();
      return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const output = fs.createWriteStream(dest);
    let size = 0;
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      output.destroy();
      req.destroy();
      reject(error);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD) {
        fail(Object.assign(new Error("파일이 너무 큽니다. 4GB보다 작은 동영상을 선택해 주세요."), { status: 413 }));
      }
    });
    req.on("error", fail);
    output.on("error", fail);
    output.on("finish", () => {
      if (!failed) resolve(size);
    });
    req.pipe(output);
  });
}

function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("요청이 너무 큽니다."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function listFrames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /^\d{5}\.jpg$/.test(name)).sort();
}

function sse(res, payload) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function emitStableThumbs(job, res, known, expected, sizes, includeLast) {
  const names = listFrames(job.framesDir);
  const step = Math.max(1, Math.ceil((expected || names.length || 1) / 48));
  names.forEach((name, indexInList) => {
    const full = path.join(job.framesDir, name);
    const size = fs.statSync(full).size;
    const previous = sizes.get(name);
    sizes.set(name, size);
    const isLast = indexInList === names.length - 1;
    const stable = size > 0 && (includeLast || !isLast || (previous > 0 && previous === size));
    if (!stable || known.has(name)) return;
    known.add(name);
    const index = Number(name.slice(0, 5));
    if (index === 1 || index % step === 0 || (includeLast && isLast)) {
      sse(res, { type: "thumb", name, index });
    }
  });
  return names;
}

function controlledError(action) {
  const error = new Error(action);
  error.controlled = action;
  return error;
}

async function convert(job, options, res) {
  const info = job.info;
  const filtered = videoFilter(info, options);
  const rate = filtered.rate;
  const clipDuration = options.span;
  const expected = Math.max(1, Math.round(clipDuration * rate));
  fs.rmSync(job.framesDir, { recursive: true, force: true });
  fs.mkdirSync(job.framesDir, { recursive: true });
  if (fs.existsSync(job.gifPath)) fs.rmSync(job.gifPath);

  job.status = "running";
  job.gifReady = false;
  job.child = null;
  const known = new Set();
  const sizes = new Map();
  let scanning = false;
  let extractRatio = 0;

  const pushProgress = (phase, ratio, frameCount) => {
    const clamped = Math.max(0, Math.min(1, ratio || 0));
    const percent = phase === "encode"
      ? 82 + clamped * 17
      : phase === "palette"
        ? 65 + clamped * 17
        : clamped * 65;
    sse(res, {
      type: "progress",
      phase,
      percent: Math.min(99, percent),
      frame: frameCount,
      total: expected,
    });
  };

  const timer = setInterval(() => {
    if (scanning || res.writableEnded || job.control) return;
    scanning = true;
    try {
      const names = emitStableThumbs(job, res, known, expected, sizes, false);
      const stableCount = names.length > 0 && !known.has(names[names.length - 1]) ? names.length - 1 : names.length;
      const frameRatio = expected > 0 ? stableCount / expected : 0;
      pushProgress("extract", Math.max(frameRatio, extractRatio), Math.max(0, stableCount));
    } finally {
      scanning = false;
    }
  }, 250);

  const attach = (child) => {
    job.child = child;
    if (job.control) child.kill();
  };
  const ensureRunning = () => {
    if (job.control === "stop" || job.control === "cancel") throw controlledError(job.control);
  };

  try {
    const extractArgs = [
      "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
      "-i", job.inputPath,
    ];
    if (options.overlayPath) extractArgs.push("-i", options.overlayPath);
    if (!options.full) {
      extractArgs.push("-ss", options.start.toFixed(3), "-t", options.span.toFixed(3));
    }
    extractArgs.push("-an", "-sn", "-dn", "-progress", "pipe:1");
    if (options.overlayPath) {
      extractArgs.push(
        "-filter_complex",
        `[0:v]${filtered.vf}[base];[1:v][base]scale2ref[ov][base2];[base2][ov]overlay=0:0:format=auto`,
      );
    } else {
      extractArgs.push("-vf", filtered.vf);
    }
    extractArgs.push("-q:v", "3", path.join(job.framesDir, "%05d.jpg"));
    await runTool(FFMPEG, extractArgs, {
      attach,
      onStdout: progressParser((record) => {
        extractRatio = Math.max(extractRatio, recordRatio(record, clipDuration, expected));
      }),
    });
    ensureRunning();

    const names = emitStableThumbs(job, res, known, expected, sizes, true);
    clearInterval(timer);
    if (names.length === 0) throw new Error("no frames");
    pushProgress("extract", 1, names.length);

    const pattern = path.join(job.framesDir, "%05d.jpg").replace(/\\/g, "/");
    const palettePath = path.join(job.dir, "palette.png");
    await runTool(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
      "-framerate", fpsArg(rate),
      "-start_number", "1",
      "-i", pattern,
      "-progress", "pipe:1",
      "-vf", `palettegen=stats_mode=diff:reserve_transparent=0:max_colors=${options.colors}`,
      palettePath,
    ], {
      attach,
      onStdout: progressParser((record) => {
        pushProgress("palette", recordRatio(record, names.length / rate, names.length), names.length);
      }),
    });
    ensureRunning();
    pushProgress("palette", 1, names.length);

    await runTool(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
      "-framerate", fpsArg(rate),
      "-start_number", "1",
      "-i", pattern,
      "-i", palettePath,
      "-progress", "pipe:1",
      "-filter_complex", "[0:v][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
      "-loop", options.loop ? "0" : "-1",
      job.gifPath,
    ], {
      attach,
      onStdout: progressParser((record) => {
        pushProgress("encode", recordRatio(record, names.length / rate, names.length), names.length);
      }),
    });
    ensureRunning();

    const stat = fs.statSync(job.gifPath);
    let width = 0;
    let height = 0;
    try {
      const probed = await probe(job.gifPath);
      const stream = (probed.streams || []).find((item) => item.codec_type === "video" && item.width);
      if (stream) {
        width = stream.width;
        height = stream.height;
      }
    } catch (probeError) {
      console.error(probeError);
    }
    const saved = rememberGif(job, stat, width, height, names.length);
    job.status = "done";
    job.gifReady = true;
    job.child = null;
    sse(res, {
      type: "done",
      filename: info.downloadName,
      bytes: stat.size,
      sizeLabel: formatBytes(stat.size),
      width,
      height,
      outputLabel: width ? `${width} × ${height}` : "",
      frames: names.length,
      libraryId: saved.id,
    });
  } catch (error) {
    const action = error.controlled || job.control;
    job.child = null;
    if (action === "stop" || action === "cancel") {
      job.status = "ready";
      job.control = null;
      if (!res.writableEnded) sse(res, { type: action === "stop" ? "stopped" : "cancelled" });
    } else {
      job.status = "error";
      job.control = null;
      console.error(error);
      if (!res.writableEnded) sse(res, { type: "error", message: friendlyError(error) });
    }
  } finally {
    clearInterval(timer);
    job.child = null;
    if (!res.writableEnded) res.end();
  }
}

async function inspect(req, res) {
  if (!toolsReady()) {
    sendJson(res, 500, { ok: false, message: "변환 엔진(ffmpeg)을 찾지 못했습니다." });
    return;
  }
  if ([...jobs.values()].some((job) => job.status === "running")) {
    sendJson(res, 409, { ok: false, message: "이미 변환이 진행 중입니다. 끝난 뒤 다른 파일을 선택해 주세요." });
    return;
  }
  let originalName = "video.bin";
  try {
    originalName = path.basename(decodeURIComponent(req.headers["x-filename"] || "video.bin"));
  } catch (error) {
    originalName = "video.bin";
  }
  const id = crypto.randomBytes(8).toString("hex");
  const dir = path.join(TMP_DIR, id);
  const inputPath = path.join(dir, `input.${extOf(originalName)}`);
  try {
    clearIdleJobs();
    const size = await writeUpload(req, inputPath);
    if (!size) throw Object.assign(new Error("빈 파일입니다."), { status: 400 });
    const probed = await probe(inputPath);
    const info = describe(originalName, probed, size);
    if (!info) {
      removeDir(dir);
      sendJson(res, 415, {
        ok: false,
        message: "영상 화면이 없거나, 이 앱이 열 수 없는 형식입니다.",
      });
      return;
    }
    const posterPath = path.join(dir, "poster.jpg");
    let hasPoster = false;
    try {
      await runTool(FFMPEG, [
        "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
        "-ss", "0",
        "-i", inputPath,
        "-frames:v", "1",
        "-vf", "scale=720:-2",
        posterPath,
      ]);
      hasPoster = fs.existsSync(posterPath);
    } catch (posterError) {
      console.error(posterError);
    }
    const job = {
      id,
      dir,
      inputPath,
      framesDir: path.join(dir, "frames"),
      gifPath: path.join(dir, "out.gif"),
      posterPath: hasPoster ? posterPath : "",
      info: { ...info, id, hasPoster },
      status: "ready",
      gifReady: false,
      control: null,
      child: null,
    };
    jobs.set(id, job);
    sendJson(res, 200, { ok: true, file: job.info });
  } catch (error) {
    removeDir(dir);
    console.error(error);
    const message = error.status
      ? error.message
      : "이 파일은 동영상으로 확인하지 못했습니다. 변환 가능한 형식의 파일을 선택해 주세요.";
    sendJson(res, error.status || 415, { ok: false, message });
  }
}

async function beginConvert(req, res) {
  let body;
  try {
    body = await readJson(req, 20_000_000);
  } catch (error) {
    sendJson(res, 400, { ok: false, message: "변환 요청을 읽지 못했습니다." });
    return;
  }
  const job = jobs.get(body.id);
  const choice = body.width === "original" ? "original" : Number(body.width);
  if (!job) {
    sendJson(res, 404, { ok: false, message: "먼저 동영상 파일을 선택해 주세요." });
    return;
  }
  if (job.status === "running") {
    sendJson(res, 409, { ok: false, message: "이미 이 파일을 변환하고 있습니다." });
    return;
  }
  if (!WIDTHS.has(choice)) {
    sendJson(res, 400, { ok: false, message: "출력 크기를 다시 선택해 주세요." });
    return;
  }
  const options = normalizeOptions(job.info, body);
  if (options.span <= 0) {
    sendJson(res, 400, { ok: false, message: "구간 길이가 0초입니다. 끝 시간을 시작보다 뒤로 입력해 주세요." });
    return;
  }
  options.overlayPath = saveOverlay(job, body.overlay);
  job.control = null;
  applyCors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.on("close", () => {
    if (job.status === "running" && !res.writableEnded) {
      job.control = job.control || "cancel";
      stopChild(job);
    }
  });
  convert(job, options, res);
}

function controlJob(req, res) {
  readJson(req).then((body) => {
    const job = jobs.get(body.id);
    const action = body.action === "stop" ? "stop" : body.action === "cancel" ? "cancel" : "";
    if (!job || !action) {
      sendJson(res, 404, { ok: false, message: "중단할 변환 작업을 찾지 못했습니다." });
      return;
    }
    if (job.status !== "running") {
      sendJson(res, 200, { ok: true, idle: true });
      return;
    }
    job.control = action;
    stopChild(job);
    sendJson(res, 200, { ok: true, action });
  }).catch(() => {
    sendJson(res, 400, { ok: false, message: "요청을 읽지 못했습니다." });
  });
}

function serveFile(res, filePath, type, downloadName) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { ok: false, message: "파일을 찾지 못했습니다." });
      return;
    }
    const headers = {
      "Content-Type": type,
      "Content-Length": data.length,
      "Cache-Control": "no-store",
    };
    if (downloadName) {
      const ascii = downloadName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
      headers["Content-Disposition"] = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
    }
    applyCors(res);
    res.writeHead(200, headers);
    res.end(data);
  });
}

function route(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === "OPTIONS") {
    applyCors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: toolsReady(),
      message: toolsReady() ? "" : "bin 폴더에서 ffmpeg를 찾지 못했습니다.",
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/inspect") {
    inspect(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/convert") {
    beginConvert(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/control") {
    controlJob(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/library") {
    sendJson(res, 200, {
      ok: true,
      items: readLibrary().map((item) => ({
        ...item,
        createdLabel: item.createdAt ? item.createdAt.replace("T", " ").slice(0, 16) : "",
      })),
    });
    return;
  }
  const libraryFile = url.pathname.match(/^\/api\/library\/([a-f0-9]{16})\/file$/);
  if (req.method === "GET" && libraryFile) {
    const item = readLibrary().find((entry) => entry.id === libraryFile[1]);
    const filePath = path.join(LIBRARY_DIR, `${libraryFile[1]}.gif`);
    if (!item || !fs.existsSync(filePath)) {
      sendJson(res, 404, { ok: false, message: "보관한 GIF를 찾지 못했습니다." });
      return;
    }
    const inline = url.searchParams.get("inline") === "1";
    if (inline) serveFile(res, filePath, "image/gif");
    else serveFile(res, filePath, "image/gif", item.name);
    return;
  }
  const libraryDelete = url.pathname.match(/^\/api\/library\/([a-f0-9]{16})$/);
  if (req.method === "DELETE" && libraryDelete) {
    const items = readLibrary().filter((entry) => entry.id !== libraryDelete[1]);
    fs.rmSync(path.join(LIBRARY_DIR, `${libraryDelete[1]}.gif`), { force: true });
    writeLibrary(items);
    sendJson(res, 200, { ok: true });
    return;
  }
  const posterMatch = url.pathname.match(/^\/api\/poster\/([a-f0-9]{16})$/);
  if (req.method === "GET" && posterMatch) {
    const job = jobs.get(posterMatch[1]);
    if (!job || !job.posterPath || !fs.existsSync(job.posterPath)) {
      res.writeHead(404);
      res.end();
      return;
    }
    serveFile(res, job.posterPath, "image/jpeg");
    return;
  }
  const frameMatch = url.pathname.match(/^\/api\/frame\/([a-f0-9]{16})\/(\d{5}\.jpg)$/);
  if (req.method === "GET" && frameMatch) {
    const job = jobs.get(frameMatch[1]);
    const filePath = job ? path.join(job.framesDir, frameMatch[2]) : "";
    if (!job || !filePath.startsWith(job.framesDir) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end();
      return;
    }
    serveFile(res, filePath, "image/jpeg");
    return;
  }
  const downloadMatch = url.pathname.match(/^\/api\/download\/([a-f0-9]{16})$/);
  if (req.method === "GET" && downloadMatch) {
    const job = jobs.get(downloadMatch[1]);
    if (!job || !job.gifReady || !fs.existsSync(job.gifPath)) {
      sendJson(res, 409, { ok: false, message: "아직 받을 수 있는 GIF가 없습니다." });
      return;
    }
    const filename = job.info.downloadName;
    const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    let stat;
    try {
      stat = fs.statSync(job.gifPath);
    } catch (error) {
      sendJson(res, 500, { ok: false, message: "GIF를 열지 못했습니다." });
      return;
    }
    applyCors(res);
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(job.gifPath).pipe(res);
    return;
  }
  if (req.method === "GET" && STATIC_FILES.has(url.pathname)) {
    const name = STATIC_FILES.get(url.pathname);
    serveFile(res, path.join(ROOT, name), MIME[path.extname(name)] || "application/octet-stream");
    return;
  }
  if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = path.resolve(ROOT, relative);
    const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;
    if ((filePath === ROOT || filePath.startsWith(rootPrefix)) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveFile(res, filePath, MIME[path.extname(filePath)] || "application/octet-stream");
      return;
    }
  }
  sendJson(res, 404, { ok: false, message: "페이지를 찾지 못했습니다." });
}

function openIndexFile() {
  const indexPath = path.join(ROOT, "index.html");
  const target = pathToFileURL(indexPath).href;
  const candidates = [
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  const browser = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (browser) {
    spawn(browser, [target, "--new-window"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }
  spawn("cmd", ["/c", "start", "", indexPath], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(LIBRARY_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  try {
    route(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { ok: false, message: "요청을 처리하지 못했습니다." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const target = `http://127.0.0.1:${PORT}/index.html`;
  console.log(`GIF 변환 앱: ${target}`);
  console.log(`index 파일: ${path.join(ROOT, "index.html")}`);
  if (process.env.GIF_STUDIO_OPEN === "1") openIndexFile();
});
