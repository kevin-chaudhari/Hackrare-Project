"""
Real-time hand pinch detection using Python, OpenCV, and MediaPipe Hands.

Features:
- 21-landmark extraction via MediaPipe Hands
- pinch distance from thumb tip (4) to index tip (8)
- dynamic thresholding based on frame resolution
- moving-average smoothing over recent frames
- gesture state machine with jitter protection
- webcam loop tuned for responsive real-time feedback

Run:
    python -m backend.pinch_detector
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from enum import Enum
from typing import Deque, Optional
import math
import time

import cv2
import mediapipe as mp


class GestureState(str, Enum):
    OPEN = "OPEN"
    PINCH_START = "PINCH_START"
    PINCH_HOLD = "PINCH_HOLD"
    PINCH_RELEASE = "PINCH_RELEASE"


@dataclass
class PinchConfig:
    camera_index: int = 0
    target_width: int = 960
    target_height: int = 540
    min_camera_fps: int = 30
    smoothing_window: int = 5
    pinch_ratio: float = 0.035
    release_ratio: float = 0.05
    min_pinch_start_frames: int = 2
    min_pinch_hold_frames: int = 4
    cooldown_frames: int = 8
    max_num_hands: int = 1
    min_detection_confidence: float = 0.6
    min_tracking_confidence: float = 0.6
    draw_landmarks: bool = True
    show_metrics: bool = True


@dataclass
class PinchFrameResult:
    state: GestureState
    raw_distance_px: Optional[float]
    smoothed_distance_px: Optional[float]
    pinch_threshold_px: float
    release_threshold_px: float
    is_trigger_event: bool
    fps: float


class PinchDetector:
    THUMB_TIP = 4
    INDEX_TIP = 8

    def __init__(self, config: PinchConfig | None = None) -> None:
        self.config = config or PinchConfig()
        self._distance_window: Deque[float] = deque(maxlen=self.config.smoothing_window)
        self._state = GestureState.OPEN
        self._frames_below_threshold = 0
        self._frames_above_release = 0
        self._hold_frames = 0
        self._cooldown_remaining = 0
        self._last_frame_ts = time.perf_counter()
        self._fps = 0.0

        self._mp_hands = mp.solutions.hands
        self._mp_draw = mp.solutions.drawing_utils
        self._hands = self._mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=self.config.max_num_hands,
            model_complexity=0,
            min_detection_confidence=self.config.min_detection_confidence,
            min_tracking_confidence=self.config.min_tracking_confidence,
        )

    @property
    def state(self) -> GestureState:
        return self._state

    def close(self) -> None:
        self._hands.close()

    def process(self, frame_bgr) -> PinchFrameResult:
        frame_h, frame_w = frame_bgr.shape[:2]
        now = time.perf_counter()
        dt = max(now - self._last_frame_ts, 1e-6)
        self._fps = 1.0 / dt
        self._last_frame_ts = now

        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self._hands.process(rgb)

        raw_distance_px: Optional[float] = None
        smoothed_distance_px: Optional[float] = None
        pinch_threshold_px = max(min(frame_w, frame_h) * self.config.pinch_ratio, 14.0)
        release_threshold_px = max(min(frame_w, frame_h) * self.config.release_ratio, pinch_threshold_px + 6.0)
        triggered = False

        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            if self.config.draw_landmarks:
                self._mp_draw.draw_landmarks(
                    frame_bgr,
                    hand_landmarks,
                    self._mp_hands.HAND_CONNECTIONS,
                )

            thumb = hand_landmarks.landmark[self.THUMB_TIP]
            index = hand_landmarks.landmark[self.INDEX_TIP]
            thumb_px = (thumb.x * frame_w, thumb.y * frame_h)
            index_px = (index.x * frame_w, index.y * frame_h)
            raw_distance_px = math.dist(thumb_px, index_px)

            self._distance_window.append(raw_distance_px)
            smoothed_distance_px = sum(self._distance_window) / len(self._distance_window)

            triggered = self._advance_state(smoothed_distance_px, pinch_threshold_px, release_threshold_px)

            cv2.circle(frame_bgr, (int(thumb_px[0]), int(thumb_px[1])), 8, (0, 200, 255), -1)
            cv2.circle(frame_bgr, (int(index_px[0]), int(index_px[1])), 8, (255, 200, 0), -1)
            cv2.line(
                frame_bgr,
                (int(thumb_px[0]), int(thumb_px[1])),
                (int(index_px[0]), int(index_px[1])),
                (0, 255, 180),
                2,
            )
        else:
            self._distance_window.clear()
            self._reset_to_open()

        if self.config.show_metrics:
            self._draw_hud(
                frame_bgr,
                raw_distance_px=raw_distance_px,
                smoothed_distance_px=smoothed_distance_px,
                pinch_threshold_px=pinch_threshold_px,
                release_threshold_px=release_threshold_px,
            )

        return PinchFrameResult(
            state=self._state,
            raw_distance_px=raw_distance_px,
            smoothed_distance_px=smoothed_distance_px,
            pinch_threshold_px=pinch_threshold_px,
            release_threshold_px=release_threshold_px,
            is_trigger_event=triggered,
            fps=self._fps,
        )

    def _advance_state(self, distance_px: float, pinch_threshold_px: float, release_threshold_px: float) -> bool:
        triggered = False

        if self._cooldown_remaining > 0:
            self._cooldown_remaining -= 1

        below_pinch = distance_px <= pinch_threshold_px
        above_release = distance_px >= release_threshold_px

        if below_pinch:
            self._frames_below_threshold += 1
            self._frames_above_release = 0
        elif above_release:
            self._frames_above_release += 1
            self._frames_below_threshold = 0
        else:
            self._frames_below_threshold = 0
            self._frames_above_release = 0

        if self._state == GestureState.OPEN:
            if self._cooldown_remaining == 0 and self._frames_below_threshold >= self.config.min_pinch_start_frames:
                self._state = GestureState.PINCH_START
                self._hold_frames = 0

        elif self._state == GestureState.PINCH_START:
            if below_pinch:
                self._hold_frames += 1
                if self._hold_frames >= self.config.min_pinch_hold_frames:
                    self._state = GestureState.PINCH_HOLD
                    triggered = True
            elif above_release:
                self._reset_to_open()

        elif self._state == GestureState.PINCH_HOLD:
            if above_release:
                self._state = GestureState.PINCH_RELEASE

        elif self._state == GestureState.PINCH_RELEASE:
            if self._frames_above_release >= 1:
                self._cooldown_remaining = self.config.cooldown_frames
                self._reset_to_open(clear_cooldown=False)
            elif below_pinch:
                self._state = GestureState.PINCH_HOLD

        return triggered

    def _reset_to_open(self, *, clear_cooldown: bool = True) -> None:
        self._state = GestureState.OPEN
        self._frames_below_threshold = 0
        self._frames_above_release = 0
        self._hold_frames = 0
        if clear_cooldown:
            self._cooldown_remaining = 0

    def _draw_hud(
        self,
        frame_bgr,
        *,
        raw_distance_px: Optional[float],
        smoothed_distance_px: Optional[float],
        pinch_threshold_px: float,
        release_threshold_px: float,
    ) -> None:
        lines = [
            f"State: {self._state.value}",
            f"FPS: {self._fps:0.1f}",
            f"Raw dist: {raw_distance_px:0.1f}px" if raw_distance_px is not None else "Raw dist: --",
            f"Smooth dist: {smoothed_distance_px:0.1f}px" if smoothed_distance_px is not None else "Smooth dist: --",
            f"Pinch threshold: {pinch_threshold_px:0.1f}px",
            f"Release threshold: {release_threshold_px:0.1f}px",
        ]

        overlay_h = 22 + (len(lines) * 22)
        cv2.rectangle(frame_bgr, (10, 10), (280, overlay_h), (18, 24, 38), -1)
        cv2.rectangle(frame_bgr, (10, 10), (280, overlay_h), (95, 179, 162), 1)

        y = 32
        for line in lines:
            cv2.putText(
                frame_bgr,
                line,
                (20, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (230, 237, 245),
                1,
                cv2.LINE_AA,
            )
            y += 22


def run_webcam_detector(config: PinchConfig | None = None) -> None:
    cfg = config or PinchConfig()
    detector = PinchDetector(cfg)
    cap = cv2.VideoCapture(cfg.camera_index)

    if not cap.isOpened():
        detector.close()
        raise RuntimeError("Unable to open webcam.")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.target_width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.target_height)
    cap.set(cv2.CAP_PROP_FPS, cfg.min_camera_fps)

    trigger_banner_until = 0.0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            frame = cv2.flip(frame, 1)
            result = detector.process(frame)

            if result.is_trigger_event:
                trigger_banner_until = time.perf_counter() + 0.45

            if time.perf_counter() < trigger_banner_until:
                cv2.rectangle(frame, (320, 18), (620, 62), (48, 110, 82), -1)
                cv2.rectangle(frame, (320, 18), (620, 62), (95, 179, 162), 2)
                cv2.putText(
                    frame,
                    "PINCH TRIGGERED",
                    (352, 47),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

            cv2.imshow("Real-Time Pinch Detector", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                break
    finally:
        cap.release()
        detector.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    run_webcam_detector()
