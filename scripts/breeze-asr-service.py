"""
Breeze-ASR-26 台語語音辨識服務
INPUT:  POST /transcribe { audioBase64: str, mimeType: "audio/m4a" | "audio/webm" | "audio/wav" }
OUTPUT: { transcript: str, duration_ms: int, mode: "live" | "demo" }
PORT:   8003

技術棧：
  - MediaTek-Research/Breeze-ASR-26（CTranslate2 INT8，台語→繁體中文）
  - faster-whisper（4-8x faster than transformers on CPU）
  - FastAPI + uvicorn
  - ffmpeg（m4a/webm → wav 轉換）
  - asyncio.run_in_executor（non-blocking inference）

啟動方式：
  pip install fastapi uvicorn faster-whisper pydub
  uvicorn scripts.breeze-asr-service:app --host 0.0.0.0 --port 8003 --reload
"""

import asyncio
import base64
import io
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("breeze-asr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(
    title="Breeze-ASR-26 台語語音辨識服務",
    description="MediaTek-Research/Breeze-ASR-26 CTranslate2 INT8：台語語音 → 繁體中文文字",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ─── 模型路徑 ──────────────────────────────────────────────────────
_CT2_MODEL_DIR = Path(__file__).parent.parent / "models" / "breeze-asr-26-ct2"

# ─── 模型延遲載入 ─────────────────────────────────────────────────

_model = None


def _get_model():
    """延遲載入 faster-whisper Breeze-ASR-26 模型"""
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel

            logger.info(f"正在載入 Breeze-ASR-26 CTranslate2 模型（{_CT2_MODEL_DIR}）…")
            _model = WhisperModel(
                str(_CT2_MODEL_DIR),
                device="cpu",
                compute_type="int8",
            )
            logger.info("Breeze-ASR-26 CTranslate2 模型載入完成 ✓")
        except Exception as exc:
            logger.warning(f"Breeze-ASR-26 載入失敗（{exc}），使用 Demo 模式")
            _model = None
    return _model


# ─── 請求/回應模型 ────────────────────────────────────────────────


class TranscribeRequest(BaseModel):
    audioBase64: str
    mimeType: str = "audio/m4a"  # audio/m4a | audio/webm | audio/wav


class TranscribeResponse(BaseModel):
    transcript: str
    duration_ms: int
    mode: str  # "live" | "demo"


# ─── 音訊轉換工具 ─────────────────────────────────────────────────


def _convert_to_wav(audio_bytes: bytes, mime_type: str) -> bytes:
    """使用 ffmpeg 將任意格式音訊轉為 16kHz mono PCM WAV（Whisper 要求格式）"""
    ext_map = {
        "audio/m4a": ".m4a",
        "audio/mp4": ".m4a",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
    }
    in_ext = ext_map.get(mime_type.lower(), ".m4a")

    with tempfile.TemporaryDirectory() as tmp_dir:
        in_path = Path(tmp_dir) / f"input{in_ext}"
        out_path = Path(tmp_dir) / "output.wav"

        in_path.write_bytes(audio_bytes)

        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(in_path),
                "-ar", "16000",  # 16kHz（Whisper 標準）
                "-ac", "1",      # mono
                "-f", "wav",
                str(out_path),
            ],
            capture_output=True,
            timeout=60,
        )

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(f"ffmpeg 轉換失敗：{stderr[-500:]}")

        return out_path.read_bytes()


# ─── 同步推論（在 executor 中執行，不阻塞 event loop） ────────────


def _run_inference(audio_bytes: bytes, mime_type: str) -> tuple[str, str]:
    """
    同步執行 faster-whisper 推論，回傳 (transcript, mode)。
    此函式由 asyncio.run_in_executor 在 thread pool 中呼叫。
    """
    model = _get_model()

    if model is not None:
        try:
            # 轉換音訊格式
            if mime_type.lower() not in ("audio/wav", "audio/x-wav"):
                wav_bytes = _convert_to_wav(audio_bytes, mime_type)
            else:
                wav_bytes = audio_bytes

            # faster-whisper 直接讀 bytes
            import io
            segments, info = model.transcribe(
                io.BytesIO(wav_bytes),
                language="zh",
                task="transcribe",
                beam_size=1,          # 加快速度（犧牲少量精度）
                vad_filter=True,      # 跳過靜音段，大幅加速
                vad_parameters={"min_silence_duration_ms": 500},
            )
            transcript = "".join(seg.text for seg in segments).strip()
            logger.info(f"[live] 語言={info.language} 信心={info.language_probability:.2f}，辨識：{transcript[:50]}")
            return transcript, "live"

        except Exception as exc:
            logger.warning(f"真實推論失敗（{exc}），降級至 Demo 模式")

    # Demo 降級
    transcript = _demo_transcribe(audio_bytes)
    return transcript, "demo"


# ─── Demo 降級辨識 ────────────────────────────────────────────────

_DEMO_TRANSCRIPTS = [
    "我想借錢買厝，請問可以貸多少？",
    "我要申請青安貸款，第一次購屋。",
    "我是現役軍人，想辦軍公教信用貸款。",
    "請問房子的鑑價怎麼算？",
    "我想了解以房養老的條件。",
]


def _demo_transcribe(audio_bytes: bytes) -> str:
    """Demo 模式：依音訊長度回傳不同示範文字"""
    size_kb = len(audio_bytes) // 1024
    idx = size_kb % len(_DEMO_TRANSCRIPTS)
    return _DEMO_TRANSCRIPTS[idx]


# ─── API 端點 ─────────────────────────────────────────────────────


@app.get("/health")
def health():
    pipeline_loaded = _model is not None
    return {
        "status": "ok",
        "model": "Breeze-ASR-26",
        "pipeline_loaded": pipeline_loaded,
        "mode": "live" if pipeline_loaded else "demo",
        "backend": "faster-whisper-int8",
    }


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest):
    """
    台語語音辨識端點（非阻塞，推論在 thread pool 執行）

    Request body:
      audioBase64  base64 編碼的音訊資料
      mimeType     音訊格式（預設 audio/m4a）

    Response:
      transcript   辨識出的繁體中文文字
      duration_ms  推論耗時（毫秒）
      mode         "live"（真實推論）或 "demo"（降級）
    """
    t0 = time.time()

    # base64 解碼
    try:
        audio_bytes = base64.b64decode(req.audioBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="audioBase64 格式錯誤，無法解碼")

    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="音訊資料過短")

    # 在 thread pool 執行同步推論，不阻塞 event loop
    loop = asyncio.get_event_loop()
    transcript, mode = await loop.run_in_executor(
        None, _run_inference, audio_bytes, req.mimeType
    )

    duration_ms = int((time.time() - t0) * 1000)
    logger.info(f"[{mode}] 辨識完成 {duration_ms}ms：{transcript[:50]}")
    return TranscribeResponse(transcript=transcript, duration_ms=duration_ms, mode=mode)


# ─── 主程式 ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("BREEZE_ASR_PORT", "8003"))
    logger.info(f"Breeze-ASR-26 服務啟動中，port={port}")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
