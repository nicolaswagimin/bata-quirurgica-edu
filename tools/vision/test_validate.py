"""Pruebas del validador de capturas del AR v2 (stdlib, sin dependencias).

    python3 -m unittest discover -s tools/vision
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from validate import main, validate_take  # noqa: E402


def point(value: float = 0.0) -> dict:
    return {"x": value, "y": value, "z": 0.0, "visibility": 0.9}


def frame(t: int) -> dict:
    return {
        "t": t,
        "points": [point() for _ in range(13)],
        "velocities": [{"x": 0.0, "y": 0.0} for _ in range(13)],
        "angles": {
            "leftElbow": 3.0,
            "rightElbow": 3.0,
            "leftShoulder": 1.5,
            "rightShoulder": 1.5,
            "torsoTilt": 0.0,
        },
        "torso": {
            "centerX": 500.0,
            "centerY": 400.0,
            "shoulderWidth": 200.0,
            "torsoHeight": 180.0,
            "angleRad": 0.0,
        },
        "hands": [],
    }


def take(**overrides) -> dict:
    base = {
        "version": 1,
        "label": "g3-bata",
        "source": "ar-espejo",
        "capturedAt": "2026-11-07T20:00:00.000Z",
        "durationMs": 2000,
        "sampleHz": 15,
        "frames": [frame(0), frame(66)],
    }
    base.update(overrides)
    return base


class ValidateTakeTest(unittest.TestCase):
    def test_accepts_a_valid_take(self):
        self.assertEqual(validate_take(take()), [])

    def test_rejects_unknown_version(self):
        self.assertTrue(validate_take(take(version=2)))

    def test_rejects_empty_label(self):
        self.assertTrue(validate_take(take(label="   ")))

    def test_rejects_missing_points(self):
        broken = take()
        broken["frames"][0]["points"] = broken["frames"][0]["points"][:-1]
        self.assertTrue(validate_take(broken))

    def test_rejects_visibility_out_of_range(self):
        broken = take()
        broken["frames"][0]["points"][0]["visibility"] = 1.4
        self.assertTrue(validate_take(broken))

    def test_rejects_non_monotonic_time(self):
        broken = take(frames=[frame(66), frame(0)])
        self.assertTrue(validate_take(broken))

    def test_rejects_non_finite_numbers(self):
        broken = take()
        broken["frames"][0]["angles"]["torsoTilt"] = float("nan")
        self.assertTrue(validate_take(broken))

    def test_rejects_hands_that_are_not_21_points(self):
        broken = take()
        broken["frames"][0]["hands"] = [{"side": "left", "points": [point()]}]
        self.assertTrue(validate_take(broken))


class CliTest(unittest.TestCase):
    def test_exit_code_zero_for_valid_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "take.json"
            path.write_text(json.dumps(take()), encoding="utf-8")
            self.assertEqual(main([str(path)]), 0)

    def test_exit_code_one_for_invalid_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.json"
            path.write_text(json.dumps(take(version=9)), encoding="utf-8")
            self.assertEqual(main([str(path)]), 1)

    def test_exit_code_two_without_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(main([tmp]), 2)


if __name__ == "__main__":
    unittest.main()
