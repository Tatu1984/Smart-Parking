"""
Latency Optimization for AI Pipeline
Target: <100ms per frame processing
"""
import time
import logging
import numpy as np
from typing import List, Dict, Tuple, Optional, Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from collections import deque
import threading

logger = logging.getLogger(__name__)


@dataclass
class LatencyMetrics:
    """Track latency metrics"""
    detection_times: deque = field(default_factory=lambda: deque(maxlen=100))
    tracking_times: deque = field(default_factory=lambda: deque(maxlen=100))
    anpr_times: deque = field(default_factory=lambda: deque(maxlen=100))
    total_times: deque = field(default_factory=lambda: deque(maxlen=100))

    def record(self, stage: str, duration_ms: float):
        if stage == 'detection':
            self.detection_times.append(duration_ms)
        elif stage == 'tracking':
            self.tracking_times.append(duration_ms)
        elif stage == 'anpr':
            self.anpr_times.append(duration_ms)
        elif stage == 'total':
            self.total_times.append(duration_ms)

    def get_stats(self) -> Dict:
        def calc_stats(times: deque) -> Dict:
            if not times:
                return {'avg': 0, 'p50': 0, 'p95': 0, 'p99': 0}
            arr = np.array(list(times))
            return {
                'avg': float(np.mean(arr)),
                'p50': float(np.percentile(arr, 50)),
                'p95': float(np.percentile(arr, 95)),
                'p99': float(np.percentile(arr, 99))
            }

        return {
            'detection': calc_stats(self.detection_times),
            'tracking': calc_stats(self.tracking_times),
            'anpr': calc_stats(self.anpr_times),
            'total': calc_stats(self.total_times)
        }


class FrameSkipper:
    """
    Adaptive frame skipping based on processing latency
    Maintains target FPS while ensuring we don't miss important events
    """

    def __init__(
        self,
        target_latency_ms: float = 100,
        min_interval: int = 1,
        max_interval: int = 10
    ):
        self.target_latency_ms = target_latency_ms
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.current_interval = min_interval
        self.last_latencies: deque = deque(maxlen=10)

    def update(self, latency_ms: float) -> int:
        """Update skip interval based on measured latency"""
        self.last_latencies.append(latency_ms)

        if len(self.last_latencies) < 3:
            return self.current_interval

        avg_latency = np.mean(list(self.last_latencies))

        # Adjust interval to meet target latency
        if avg_latency > self.target_latency_ms * 1.2:
            # Too slow, skip more frames
            self.current_interval = min(
                self.current_interval + 1,
                self.max_interval
            )
        elif avg_latency < self.target_latency_ms * 0.5:
            # Fast enough, can process more frames
            self.current_interval = max(
                self.current_interval - 1,
                self.min_interval
            )

        return self.current_interval

    def should_process(self, frame_number: int) -> bool:
        """Check if this frame should be processed"""
        return frame_number % self.current_interval == 0


class BatchProcessor:
    """
    Batch processing for improved GPU utilization
    Groups frames for batch inference
    """

    def __init__(
        self,
        batch_size: int = 4,
        max_wait_ms: float = 50
    ):
        self.batch_size = batch_size
        self.max_wait_ms = max_wait_ms
        self.pending_frames: List[Tuple] = []
        self.lock = threading.Lock()
        self.results: Dict[int, any] = {}

    def add_frame(self, frame_id: int, frame: np.ndarray) -> Optional[int]:
        """
        Add frame to batch, returns frame_id if batch is ready
        """
        with self.lock:
            self.pending_frames.append((frame_id, frame))

            if len(self.pending_frames) >= self.batch_size:
                return frame_id
        return None

    def get_batch(self) -> List[Tuple[int, np.ndarray]]:
        """Get current batch of frames"""
        with self.lock:
            batch = self.pending_frames[:self.batch_size]
            self.pending_frames = self.pending_frames[self.batch_size:]
            return batch

    def clear(self):
        """Clear pending frames"""
        with self.lock:
            self.pending_frames.clear()


class AsyncInferenceQueue:
    """
    Async inference queue for parallel processing
    Allows frame capture to continue while inference runs
    """

    def __init__(self, max_queue_size: int = 10, num_workers: int = 2):
        self.max_queue_size = max_queue_size
        self.executor = ThreadPoolExecutor(max_workers=num_workers)
        self.pending: Dict[int, any] = {}
        self.lock = threading.Lock()

    def submit(
        self,
        frame_id: int,
        inference_fn: Callable,
        *args,
        **kwargs
    ):
        """Submit frame for async inference"""
        with self.lock:
            if len(self.pending) >= self.max_queue_size:
                # Drop oldest frame
                oldest_id = min(self.pending.keys())
                self.pending[oldest_id].cancel()
                del self.pending[oldest_id]

            future = self.executor.submit(inference_fn, *args, **kwargs)
            self.pending[frame_id] = future

    def get_result(self, frame_id: int, timeout: float = 0.1):
        """Get inference result for frame"""
        with self.lock:
            if frame_id not in self.pending:
                return None

            future = self.pending[frame_id]

        try:
            result = future.result(timeout=timeout)
            with self.lock:
                del self.pending[frame_id]
            return result
        except Exception:
            return None

    def shutdown(self):
        """Shutdown the executor"""
        self.executor.shutdown(wait=False)


class ROIOptimizer:
    """
    Region of Interest optimization
    Focus processing on relevant areas of the frame
    """

    def __init__(
        self,
        grid_size: Tuple[int, int] = (4, 4),
        activity_threshold: float = 0.1
    ):
        self.grid_size = grid_size
        self.activity_threshold = activity_threshold
        self.activity_map: Optional[np.ndarray] = None
        self.last_frame: Optional[np.ndarray] = None

    def update(self, frame: np.ndarray) -> np.ndarray:
        """
        Update activity map and return mask of active regions
        """
        h, w = frame.shape[:2]
        grid_h, grid_w = h // self.grid_size[0], w // self.grid_size[1]

        if self.last_frame is None:
            self.last_frame = frame
            self.activity_map = np.ones(self.grid_size, dtype=np.float32)
            return self.activity_map

        # Calculate motion between frames
        diff = np.abs(frame.astype(np.float32) - self.last_frame.astype(np.float32))
        if len(diff.shape) == 3:
            diff = np.mean(diff, axis=2)

        # Update activity map
        new_activity = np.zeros(self.grid_size, dtype=np.float32)
        for i in range(self.grid_size[0]):
            for j in range(self.grid_size[1]):
                region = diff[
                    i * grid_h:(i + 1) * grid_h,
                    j * grid_w:(j + 1) * grid_w
                ]
                new_activity[i, j] = np.mean(region) / 255.0

        # Exponential moving average
        if self.activity_map is not None:
            self.activity_map = 0.7 * self.activity_map + 0.3 * new_activity
        else:
            self.activity_map = new_activity

        self.last_frame = frame.copy()

        return self.activity_map

    def get_active_regions(self) -> List[Tuple[int, int, int, int]]:
        """Get list of active region bounding boxes"""
        if self.activity_map is None:
            return []

        active = self.activity_map > self.activity_threshold
        regions = []

        h_step = 1.0 / self.grid_size[0]
        w_step = 1.0 / self.grid_size[1]

        for i in range(self.grid_size[0]):
            for j in range(self.grid_size[1]):
                if active[i, j]:
                    # Return normalized coordinates
                    regions.append((
                        j * w_step,  # x1
                        i * h_step,  # y1
                        (j + 1) * w_step,  # x2
                        (i + 1) * h_step   # y2
                    ))

        return regions


class ModelWarmup:
    """
    Model warmup utility for consistent latency
    Runs dummy inference to prime the model
    """

    @staticmethod
    def warmup_detector(detector, input_shape: Tuple[int, int, int] = (720, 1280, 3), iterations: int = 5):
        """Warmup vehicle detector"""
        logger.info(f"Warming up detector with {iterations} iterations...")
        dummy_frame = np.random.randint(0, 255, input_shape, dtype=np.uint8)

        times = []
        for i in range(iterations):
            start = time.time()
            detector.detect(dummy_frame)
            times.append((time.time() - start) * 1000)

        avg_time = np.mean(times)
        logger.info(f"Detector warmup complete. Avg inference time: {avg_time:.1f}ms")
        return avg_time

    @staticmethod
    def warmup_anpr(anpr_pipeline, input_shape: Tuple[int, int, int] = (100, 400, 3), iterations: int = 5):
        """Warmup ANPR pipeline"""
        logger.info(f"Warming up ANPR with {iterations} iterations...")
        dummy_plate = np.random.randint(0, 255, input_shape, dtype=np.uint8)

        times = []
        for i in range(iterations):
            start = time.time()
            anpr_pipeline.process(dummy_plate, [(0, 0, input_shape[1], input_shape[0])])
            times.append((time.time() - start) * 1000)

        avg_time = np.mean(times)
        logger.info(f"ANPR warmup complete. Avg inference time: {avg_time:.1f}ms")
        return avg_time


class LatencyProfiler:
    """
    Profiler for identifying bottlenecks
    """

    def __init__(self):
        self.checkpoints: Dict[str, float] = {}
        self.start_time: Optional[float] = None

    def start(self):
        """Start profiling"""
        self.checkpoints.clear()
        self.start_time = time.time()

    def checkpoint(self, name: str):
        """Record a checkpoint"""
        if self.start_time is not None:
            self.checkpoints[name] = (time.time() - self.start_time) * 1000

    def get_breakdown(self) -> Dict[str, float]:
        """Get timing breakdown"""
        if not self.checkpoints:
            return {}

        breakdown = {}
        last_time = 0
        for name, cumulative in self.checkpoints.items():
            breakdown[name] = cumulative - last_time
            last_time = cumulative

        return breakdown

    def log_breakdown(self):
        """Log timing breakdown"""
        breakdown = self.get_breakdown()
        if breakdown:
            parts = [f"{k}: {v:.1f}ms" for k, v in breakdown.items()]
            total = sum(breakdown.values())
            logger.debug(f"Timing: {', '.join(parts)} | Total: {total:.1f}ms")


# GPU Optimization Configurations
GPU_CONFIGS = {
    'intel_gpu': {
        'device': 'GPU',
        'precision': 'FP16',
        'num_streams': 2,
        'inference_threads': 4,
        'batch_size': 4
    },
    'nvidia_gpu': {
        'device': 'CUDA',
        'precision': 'FP16',
        'num_streams': 4,
        'inference_threads': 8,
        'batch_size': 8
    },
    'intel_npu': {
        'device': 'NPU',
        'precision': 'INT8',
        'num_streams': 1,
        'inference_threads': 1,
        'batch_size': 1
    },
    'cpu_optimized': {
        'device': 'CPU',
        'precision': 'FP32',
        'num_streams': 1,
        'inference_threads': 4,
        'batch_size': 1
    }
}


def get_optimal_config(device_type: str = 'auto') -> Dict:
    """Get optimal configuration for available hardware"""
    if device_type == 'auto':
        # Try to detect available hardware
        try:
            import openvino as ov
            core = ov.Core()
            devices = core.available_devices

            if 'GPU' in devices:
                return GPU_CONFIGS['intel_gpu']
            elif 'NPU' in devices:
                return GPU_CONFIGS['intel_npu']
        except Exception:
            pass

        return GPU_CONFIGS['cpu_optimized']

    return GPU_CONFIGS.get(device_type, GPU_CONFIGS['cpu_optimized'])
