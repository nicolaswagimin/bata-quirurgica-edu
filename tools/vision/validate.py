#!/usr/bin/env python3
"""Valida las capturas de landmarks del AR v2.

Lee uno o más JSON producidos por `/bata-ar?captura=1` y comprueba el contrato de captura
(versión 1). No usa red y no contiene video ni imágenes: el archivo son solo coordenadas.

Uso:
    python3 tools/vision/validate.py tools/vision/data/*.json
    python3 tools/vision/validate.py tools/vision/data
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

PERCEPTION_VERSION = 1
BODY_POINTS = 13
HAND_POINTS = 21
POINT_KEYS = ("x", "y", "z", "visibility")
VELOCITY_KEYS = ("x", "y")
ANGLE_KEYS = {"leftElbow", "rightElbow", "leftShoulder", "rightShoulder", "torsoTilt"}
TORSO_KEYS = {"centerX", "centerY", "shoulderWidth", "torsoHeight", "angleRad"}


def finite(value: object) -> bool:
    """True para números reales finitos (los booleanos no cuentan)."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def check_points(points: object, expected: int, where: str, errors: list[str], keys=POINT_KEYS) -> None:
    if not isinstance(points, list) or len(points) != expected:
        errors.append(f"{where}: se esperaban {expected} puntos")
        return
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            errors.append(f"{where}[{index}]: no es un objeto")
            continue
        for key in keys:
            if not finite(point.get(key)):
                errors.append(f"{where}[{index}].{key}: número finito requerido")
        visibility = point.get("visibility")
        if "visibility" in keys and finite(visibility) and not 0 <= visibility <= 1:
            errors.append(f"{where}[{index}].visibility: fuera de [0, 1]")


def validate_take(take: object) -> list[str]:
    errors: list[str] = []
    if not isinstance(take, dict):
        return ["la raíz no es un objeto"]

    if take.get("version") != PERCEPTION_VERSION:
        errors.append(f"version: se esperaba {PERCEPTION_VERSION}")

    label = take.get("label")
    if not isinstance(label, str) or not label.strip():
        errors.append("label: texto no vacío requerido")

    if take.get("source") != "ar-espejo":
        errors.append("source: se esperaba 'ar-espejo'")

    captured = take.get("capturedAt")
    if not isinstance(captured, str) or "T" not in captured:
        errors.append("capturedAt: fecha ISO-8601 requerida")

    for key in ("durationMs", "sampleHz"):
        if not finite(take.get(key)):
            errors.append(f"{key}: número requerido")

    frames = take.get("frames")
    if not isinstance(frames, list) or not frames:
        errors.append("frames: se necesita al menos un frame")
        return errors

    previous_t = None
    for index, frame in enumerate(frames):
        where = f"frames[{index}]"
        if not isinstance(frame, dict):
            errors.append(f"{where}: no es un objeto")
            continue

        t = frame.get("t")
        if not finite(t) or t < 0:
            errors.append(f"{where}.t: milisegundos no negativos requeridos")
        else:
            if previous_t is not None and t <= previous_t:
                errors.append(f"{where}.t: debe crecer de forma estricta")
            previous_t = t

        check_points(frame.get("points"), BODY_POINTS, f"{where}.points", errors)
        check_points(frame.get("velocities"), BODY_POINTS, f"{where}.velocities", errors, VELOCITY_KEYS)

        angles = frame.get("angles")
        if not isinstance(angles, dict) or set(angles) != ANGLE_KEYS:
            errors.append(f"{where}.angles: faltan claves")
        else:
            for key, value in angles.items():
                if not finite(value):
                    errors.append(f"{where}.angles.{key}: número finito requerido")

        torso = frame.get("torso")
        if not isinstance(torso, dict) or set(torso) != TORSO_KEYS:
            errors.append(f"{where}.torso: faltan claves")
        else:
            for key, value in torso.items():
                if not finite(value):
                    errors.append(f"{where}.torso.{key}: número finito requerido")
            for key in ("shoulderWidth", "torsoHeight"):
                if finite(torso.get(key)) and torso[key] <= 0:
                    errors.append(f"{where}.torso.{key}: debe ser positivo")

        hands = frame.get("hands", [])
        if not isinstance(hands, list) or len(hands) > 2:
            errors.append(f"{where}.hands: lista de hasta dos manos")
            continue
        for hand_index, hand in enumerate(hands):
            hand_where = f"{where}.hands[{hand_index}]"
            if not isinstance(hand, dict):
                errors.append(f"{hand_where}: no es un objeto")
                continue
            if hand.get("side") not in ("left", "right"):
                errors.append(f"{hand_where}.side: 'left' o 'right'")
            check_points(hand.get("points"), HAND_POINTS, f"{hand_where}.points", errors)

    return errors


def collect(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(path.glob("*.json")))
        elif path.is_file():
            files.append(path)
        else:
            print(f"No existe: {path}", file=sys.stderr)
    return files


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Valida capturas de landmarks del AR v2 (formato versión 1)."
    )
    parser.add_argument("paths", nargs="+", type=Path, help="archivos JSON o carpetas")
    args = parser.parse_args(argv)

    files = collect(args.paths)
    if not files:
        print("No se encontraron archivos JSON.", file=sys.stderr)
        return 2

    failed = 0
    for path in files:
        try:
            take = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            failed += 1
            print(f"✗ {path}: JSON inválido ({error})")
            continue
        errors = validate_take(take)
        if errors:
            failed += 1
            print(f"✗ {path}")
            for message in errors[:10]:
                print(f"   · {message}")
            if len(errors) > 10:
                print(f"   · … {len(errors) - 10} más")
        else:
            label = take["label"]
            frames = len(take["frames"])
            seconds = take["durationMs"] / 1000
            print(f"✓ {path} · {label} · {frames} frames · {seconds:.1f} s")

    valid = len(files) - failed
    print(f"\n{valid} válidas · {failed} con errores")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
