const GifBrowser = (() => {
  const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
  const FFMPEG = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
  const WORKER = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js";

  let ffmpeg = null;
  let loading = null;
  let controlAction = null;
  let inputName = "";
  let inputInfo = null;
  let sourceBytes = null;
  let inputReady = false;
  const urls = new Map();

  function even(value) {
    const number = Math.max(2, Math.round(Number(value) || 0));
    return number - (number % 2);
  }

  function clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.5;
    return Math.min(1, Math.max(0, number));
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds * 10) / 10);
    const minutes = Math.floor(total / 60);
    const rest = total - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
  }

  function formatFps(fps) {
    const rounded = Math.round(fps * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded} FPS` : `${rounded.toFixed(2)} FPS`;
  }

  function prettyCodec(name) {
    const key = String(name || "").toLowerCase();
    const labels = {
      h264: "H.264",
      hevc: "H.265",
      h265: "H.265",
      vp8: "VP8",
      vp9: "VP9",
      av1: "AV1",
      mpeg4: "MPEG-4",
      mpeg2video: "MPEG-2",
      wmv3: "WMV",
      vc1: "VC-1",
      theora: "Theora",
    };
    return labels[key] || (key ? key.toUpperCase() : "-");
  }

  function stemOf(name) {
    const base = String(name || "video").split(/[/\\]/).pop();
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(0, dot) : base;
  }

  function extOf(name) {
    const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/);
    return match ? match[1] : "mp4";
  }

  async function blobURL(url, type) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("engine");
    return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
  }

  async function workerURL() {
    const source = await (await fetch(WORKER)).text();
    const rewritten = source.replaceAll("from \"./", "from \"https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/");
    return URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
  }

  async function engine() {
    if (ffmpeg) return ffmpeg;
    if (!loading) {
      loading = (async () => {
        const module = await import(FFMPEG);
        const instance = new module.FFmpeg();
        await instance.load({
          classWorkerURL: await workerURL(),
          coreURL: await blobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await blobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpeg = instance;
        return instance;
      })().catch((error) => {
        loading = null;
        ffmpeg = null;
        throw error;
      });
    }
    return loading;
  }

  function controlled(error) {
    if (controlAction) {
      const action = controlAction;
      controlAction = null;
      error.controlled = action;
    }
    return error;
  }

  async function run(ff, args, onRatio, span) {
    if (controlAction) throw controlled(new Error(controlAction));
    const onLog = ({ message }) => {
      const frame = String(message || "").match(/frame=\s*(\d+)/);
      if (frame && onRatio) onRatio(0, Number(frame[1]));
    };
    const onProgress = ({ progress, time }) => {
      if (!onRatio) return;
      if (progress > 0 && progress <= 1) onRatio(progress, 0);
      else if (span > 0 && time > 0) {
        const seconds = time > 100000 ? time / 1e6 : time / 1000;
        onRatio(Math.min(1, seconds / span), 0);
      }
    };
    ff.on("log", onLog);
    ff.on("progress", onProgress);
    try {
      await ff.exec(args);
      if (controlAction) throw controlled(new Error(controlAction));
    } catch (error) {
      throw controlled(error);
    } finally {
      ff.off("log", onLog);
      ff.off("progress", onProgress);
    }
  }

  async function probeLogs(ff, name) {
    const lines = [];
    const onLog = ({ message }) => lines.push(message);
    ff.on("log", onLog);
    try {
      await ff.exec(["-hide_banner", "-i", name]);
    } catch (error) {
      if (controlAction) throw controlled(error);
    } finally {
      ff.off("log", onLog);
    }
    return lines.join("\n");
  }

  function describe(name, byteSize, log) {
    const durationMatch = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const duration = durationMatch
      ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
      : 0;
    const video = log.match(/Video:\s*([A-Za-z0-9_]+)/);
    const size = log.match(/Video:[\s\S]*?(\d{2,5})x(\d{2,5})/);
    const fpsMatch = log.match(/,\s*(\d+(?:\.\d+)?)\s*fps/);
    const bitrate = log.match(/bitrate:\s*(\d+(?:\.\d+)?)\s*kb\/s/i);
    if (!video || !size) return null;
    const width = Number(size[1]);
    const height = Number(size[2]);
    let sourceFps = fpsMatch ? Number(fpsMatch[1]) : 30;
    if (!sourceFps || sourceFps < 1 || sourceFps > 240) sourceFps = 30;
    const targetFps = Math.min(30, sourceFps);
    const frames = duration > 0 ? Math.max(1, Math.round(duration * targetFps)) : 1;
    const ext = extOf(name);
    const baseName = stemOf(name);
    return {
      name,
      baseName,
      downloadName: `${baseName}.gif`,
      ext,
      size: byteSize,
      sizeLabel: formatBytes(byteSize),
      formatLabel: ext.toUpperCase(),
      formatTitle: ext.toUpperCase(),
      codecLabel: prettyCodec(video[1]),
      codecTitle: video[1],
      width,
      height,
      duration,
      durationLabel: duration ? formatDuration(duration) : "-",
      sourceFps,
      targetFps,
      fpsLabel: sourceFps > 30.05 ? `${formatFps(sourceFps)} → 30 FPS` : formatFps(sourceFps),
      frames,
      bitrateLabel: bitrate ? `${Math.round(Number(bitrate[1]))} kbps` : "-",
    };
  }

  function computeCrop(info, aspect, nx, ny) {
    if (aspect === "original") return null;
    const ratio = aspect === "square" ? 1 : aspect === "portrait" ? 9 / 16 : 16 / 9;
    let cropH;
    let cropW;
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
    return {
      w: Math.max(2, cropW),
      h: Math.max(2, cropH),
      x: Math.max(0, even(maxX * clamp01(nx))),
      y: Math.max(0, even(maxY * clamp01(ny))),
    };
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
    return { vf: parts.join(","), rate: info.sourceFps > 30.05 ? 30 : info.targetFps, crop };
  }

  function outputSize(info, filter, options) {
    const baseW = filter.crop ? filter.crop.w : info.width;
    const baseH = filter.crop ? filter.crop.h : info.height;
    const width = options.width === "original" || Number(options.width) >= baseW ? even(baseW) : even(options.width);
    return { width, height: even(baseH * (width / baseW)) };
  }

  function optionsFrom(info, body) {
    const width = body.width === "original" ? "original" : Number(body.width);
    const aspects = new Set(["original", "landscape", "square", "portrait", "free"]);
    const colors = [64, 128, 192];
    const aspect = aspects.has(body.aspect) ? body.aspect : "original";
    const duration = Number(info.duration) || 0;
    let start = Number(body.start);
    if (!Number.isFinite(start) || start < 0) start = 0;
    let end = body.end === undefined || body.end === null || body.end === "" ? duration : Number(body.end);
    if (!Number.isFinite(end) || end < 0) end = 0;
    if (duration && start > duration) start = duration;
    if (duration && end > duration) end = duration;
    if (end < start) end = start;
    const span = Math.max(0, end - start);
    return {
      width,
      aspect,
      nx: clamp01(body.nx),
      ny: clamp01(body.ny),
      crop: body.crop && typeof body.crop === "object" ? body.crop : null,
      colors: colors.includes(Number(body.colors)) ? Number(body.colors) : 192,
      loop: body.loop !== false,
      start,
      end,
      span,
      full: duration > 0 && start <= 0.01 && Math.abs(end - duration) < 0.08,
      overlay: body.overlay,
    };
  }

  function mediaArgs(options, extra) {
    const args = ["-y", "-hide_banner"];
    if (!options.full) args.push("-ss", options.start.toFixed(3), "-t", options.span.toFixed(3));
    args.push("-i", inputName);
    if (extra) args.push(...extra);
    return args;
  }

  function rememberUrl(id, blob) {
    const previous = urls.get(id);
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("gif-studio", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("items", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveLibrary(item, blob) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      tx.objectStore("items").put({ ...item, blob });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function library() {
    const db = await openDb();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction("items", "readonly");
      const request = tx.objectStore("items").getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return records
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((item) => ({
        ...item,
        fileUrl: rememberUrl(item.id, item.blob),
        blob: undefined,
      }));
  }

  async function remove(id) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      tx.objectStore("items").delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const previous = urls.get(id);
    if (previous) URL.revokeObjectURL(previous);
    urls.delete(id);
  }

  async function writeOverlay(ff, dataUrl) {
    if (!dataUrl) return false;
    const match = String(dataUrl).match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return false;
    const binary = atob(match[1].replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    await ff.writeFile("overlay.png", bytes);
    return true;
  }

  async function readBlob(ff, name, type) {
    const data = await ff.readFile(name);
    return new Blob([data], { type });
  }

  async function inspect(file) {
    try {
      const ff = await engine();
      const ext = extOf(file.name).replace(/[^a-z0-9]/g, "") || "mp4";
      const nextName = `source.${ext}`;
      if (inputName && inputName !== nextName) {
        await ff.deleteFile(inputName).catch(() => {});
      }
      inputName = nextName;
      sourceBytes = new Uint8Array(await file.arrayBuffer());
      await ff.writeFile(inputName, sourceBytes);
      inputReady = true;
      const log = await probeLogs(ff, inputName);
      const info = describe(file.name, file.size, log);
      if (!info) {
        return { ok: false, message: "이 파일은 지원하는 동영상으로 열리지 않습니다. 화면에 표시된 형식의 파일을 선택해 주세요." };
      }
      info.id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      let posterUrl = "";
      try {
        await ff.exec(["-y", "-hide_banner", "-ss", "0", "-i", inputName, "-frames:v", "1", "-vf", "scale=720:-2", "poster.jpg"]);
        posterUrl = rememberUrl(`poster-${info.id}`, await readBlob(ff, "poster.jpg", "image/jpeg"));
        await ff.deleteFile("poster.jpg").catch(() => {});
      } catch (error) {
        posterUrl = "";
      }
      info.hasPoster = Boolean(posterUrl);
      info.posterUrl = posterUrl;
      inputInfo = info;
      return { ok: true, file: info };
    } catch (error) {
      const message = /engine|failed to fetch|network/i.test(String(error && error.message))
        ? "변환 엔진을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요."
        : "파일을 확인하지 못했습니다. 다른 동영상 파일로 다시 시도해 주세요.";
      return { ok: false, message };
    }
  }

  async function convert(body, onEvent) {
    const info = inputInfo;
    if (!info || body.id !== info.id) {
      onEvent({ type: "error", message: "변환할 동영상을 다시 선택해 주세요." });
      return;
    }
    const options = optionsFrom(info, body);
    if (options.span <= 0) {
      onEvent({ type: "error", message: "구간 길이가 0초입니다. 끝 시간을 시작보다 뒤로 입력해 주세요." });
      return;
    }
    controlAction = null;
    const filter = videoFilter(info, options);
    const size = outputSize(info, filter, options);
    const expected = Math.max(1, Math.round(options.span * filter.rate));
    const emit = (phase, ratio) => {
      const clamped = Math.max(0, Math.min(1, ratio || 0));
      const percent = phase === "encode" ? 55 + clamped * 44 : phase === "palette" ? 25 + clamped * 30 : clamped * 25;
      onEvent({ type: "progress", phase, percent: Math.min(99, percent), frame: Math.round(clamped * expected), total: expected });
    };
    try {
      const ff = await engine();
      if (!inputReady) {
        if (!sourceBytes) throw new Error("missing");
        await ff.writeFile(inputName, sourceBytes);
        inputReady = true;
      }
      const overlay = await writeOverlay(ff, options.overlay);
      const chain = overlay
        ? `[0:v]${filter.vf}[base];[1:v][base]scale2ref[ov][base2];[base2][ov]overlay=0:0:format=auto`
        : `[0:v]${filter.vf}`;
      emit("extract", 0.05);
      const thumbArgs = mediaArgs(options, overlay ? ["-i", "overlay.png"] : []);
      thumbArgs.push(
        "-an",
        "-filter_complex",
        `${chain},fps=${Math.min(8, filter.rate)}`,
        "-frames:v",
        "8",
        "thumb%02d.jpg",
      );
      await run(ff, thumbArgs, (ratio) => emit("extract", ratio), options.span);
      for (let index = 1; index <= 8; index += 1) {
        const name = `thumb${String(index).padStart(2, "0")}.jpg`;
        try {
          const blob = await readBlob(ff, name, "image/jpeg");
          onEvent({ type: "thumb", url: URL.createObjectURL(blob), index });
          await ff.deleteFile(name);
        } catch (error) {
          break;
        }
      }
      emit("palette", 0.1);
      const paletteArgs = mediaArgs(options, overlay ? ["-i", "overlay.png"] : []);
      paletteArgs.push(
        "-an",
        "-filter_complex",
        `${chain},palettegen=stats_mode=diff:reserve_transparent=0:max_colors=${options.colors}`,
        "palette.png",
      );
      await run(ff, paletteArgs, (ratio) => emit("palette", ratio), options.span);
      emit("encode", 0.05);
      const gifArgs = mediaArgs(options, overlay ? ["-i", "overlay.png", "-i", "palette.png"] : ["-i", "palette.png"]);
      const paletteIndex = overlay ? "2" : "1";
      gifArgs.push(
        "-an",
        "-filter_complex",
        `${chain}[x];[x][${paletteIndex}:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
        "-loop",
        options.loop ? "0" : "-1",
        "out.gif",
      );
      await run(ff, gifArgs, (ratio) => emit("encode", ratio), options.span);
      const gif = await readBlob(ff, "out.gif", "image/gif");
      await ff.deleteFile("palette.png").catch(() => {});
      await ff.deleteFile("out.gif").catch(() => {});
      const libraryId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const item = {
        id: libraryId,
        name: info.downloadName,
        createdAt: new Date().toISOString(),
        createdLabel: new Date().toLocaleString("ko-KR"),
        width: size.width,
        height: size.height,
        frames: expected,
        bytes: gif.size,
        sizeLabel: formatBytes(gif.size),
      };
      await saveLibrary(item, gif);
      const previewUrl = rememberUrl(libraryId, gif);
      rememberUrl(`download-${info.id}`, gif);
      onEvent({
        type: "done",
        filename: info.downloadName,
        bytes: gif.size,
        sizeLabel: formatBytes(gif.size),
        width: size.width,
        height: size.height,
        outputLabel: `${size.width} × ${size.height}`,
        frames: expected,
        libraryId,
        previewUrl,
        downloadUrl: urls.get(`download-${info.id}`),
      });
    } catch (error) {
      const action = error.controlled || controlAction;
      controlAction = null;
      if (action === "stop" || action === "cancel") onEvent({ type: action === "stop" ? "stopped" : "cancelled" });
      else onEvent({ type: "error", message: "변환 중 문제가 생겼습니다. 다른 동영상 파일로 다시 시도해 주세요." });
    }
  }

  function control(action) {
    controlAction = action;
    inputReady = false;
    const current = ffmpeg;
    ffmpeg = null;
    loading = null;
    if (current) current.terminate();
  }

  return { inspect, convert, control, library, remove };
})();
