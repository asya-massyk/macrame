import json
import math
import sys
from pathlib import Path

import requests
import pandas as pd
import io
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.serializers import Serializer, DictField, CharField, ListField

# ====================== ФІКС КОДУВАННЯ ДЛЯ WINDOWS ======================
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

logger = logging.getLogger(__name__)

# ====================== SERIALIZERS ======================
class MaterialInputSerializer(Serializer):
    colors = ListField(child=DictField(child=CharField()), required=True)
    materialType = CharField(required=True, allow_blank=False)


class MaterialOutputSerializer(Serializer):
    color = DictField(child=CharField())
    brand = CharField()
    number = CharField()


# ====================== LAB COLOR SPACE ======================
def rgb_to_lab(r: int, g: int, b: int) -> dict:
    """Перетворення RGB в LAB для точнішого порівняння кольорів"""
    rr = r / 255.0
    gg = g / 255.0
    bb = b / 255.0

    # sRGB to linear
    rr = rr > 0.04045 and ((rr + 0.055) / 1.055) ** 2.4 or rr / 12.92
    gg = gg > 0.04045 and ((gg + 0.055) / 1.055) ** 2.4 or gg / 12.92
    bb = bb > 0.04045 and ((bb + 0.055) / 1.055) ** 2.4 or bb / 12.92

    x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) * 100
    y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) * 100
    z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) * 100

    x /= 95.047
    y /= 100.0
    z /= 108.883

    x = x > 0.008856 and x ** (1/3) or (7.787 * x) + 16/116
    y = y > 0.008856 and y ** (1/3) or (7.787 * y) + 16/116
    z = z > 0.008856 and z ** (1/3) or (7.787 * z) + 16/116

    return {
        'l': 116 * y - 16,
        'a': 500 * (x - y),
        'b': 200 * (y - z)
    }


def color_distance_lab(c1: dict, c2: dict) -> float:
    """Відстань між двома кольорами в LAB просторі"""
    lab1 = rgb_to_lab(int(c1['r']), int(c1['g']), int(c1['b']))
    lab2 = rgb_to_lab(int(c2['r']), int(c2['g']), int(c2['b']))
    return math.sqrt(
        (lab1['l'] - lab2['l']) ** 2 +
        (lab1['a'] - lab2['a']) ** 2 +
        (lab1['b'] - lab2['b']) ** 2
    )


# ====================== ЗАВАНТАЖЕННЯ КОЛЬОРІВ DMC ======================
_dmc_cache = None


def load_dmc_colors():
    """Завантажує список ниток DMC (з JSON або CSV)"""
    global _dmc_cache
    if _dmc_cache is not None:
        return _dmc_cache

    base_dir = Path(__file__).parent.parent  # вказує на папку backend/
    json_path = base_dir / "assets" / "dmc-threads.json"

    try:
        # 1. Спроба завантажити з локального JSON
        if json_path.exists():
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            colors = []
            for item in data:
                colors.append({
                    'brand': 'DMC',
                    'number': str(item.get('floss') or item.get('number') or item.get('DMC')),
                    'color': {
                        'r': int(item['r']),
                        'g': int(item['g']),
                        'b': int(item['b'])
                    }
                })

            logger.info(f"Завантажено {len(colors)} кольорів DMC з локального JSON файлу")
            _dmc_cache = colors
            return colors

        # 2. Fallback — завантаження з GitHub (CSV)
        logger.info("Локальний JSON не знайдено. Завантажуємо DMC кольори з GitHub (CSV)")
        url = "https://raw.githubusercontent.com/nathantspencer/DMC-ColorCodes/master/result.csv"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        df = pd.read_csv(io.StringIO(response.text))

        colors = []
        for _, row in df.iterrows():
            colors.append({
                'brand': 'DMC',
                'number': str(row.get('floss') or row.get('DMC') or row.get('Code')),
                'color': {
                    'r': int(row.get('r') or row.get('Red') or 0),
                    'g': int(row.get('g') or row.get('Green') or 0),
                    'b': int(row.get('b') or row.get('Blue') or 0)
                }
            })

        logger.info(f"Завантажено {len(colors)} кольорів DMC з CSV")
        _dmc_cache = colors
        return colors

    except Exception as e:
        logger.error(f"Помилка завантаження DMC кольорів: {e}")
        # Мінімальний fallback
        return [
            {'brand': 'DMC', 'number': '310', 'color': {'r': 0, 'g': 0, 'b': 0}},
            {'brand': 'DMC', 'number': 'blanc', 'color': {'r': 255, 'g': 255, 'b': 255}},
        ]


# ====================== API VIEW ======================
class MaterialsAPIView(APIView):
    def post(self, request):
        serializer = MaterialInputSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"Невалідні дані: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        input_colors = serializer.validated_data['colors']
        material_type = serializer.validated_data['materialType']

        if material_type != 'threads':
            return Response({'error': 'Підтримується тільки materialType = threads'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        available_materials = load_dmc_colors()

        # === ЖАДІБНИЙ ПІДБІР УНІКАЛЬНИХ НИТОК ===
        used_numbers = set()
        materials = []

        for color in input_colors:
            if not color.get('r') or not color.get('g') or not color.get('b'):
                continue

            best_material = None
            min_distance = float('inf')

            for material in available_materials:
                if material['number'] in used_numbers:
                    continue  # вже використана нитка

                dist = color_distance_lab(color, material['color'])

                if dist < min_distance:
                    min_distance = dist
                    best_material = material

            # Якщо всі нитки вже використані (дуже рідкісний випадок)
            if best_material is None:
                best_material = available_materials[0]

            used_numbers.add(best_material['number'])

            materials.append({
                'color': {
                    'r': color['r'],
                    'g': color['g'],
                    'b': color['b']
                },
                'brand': best_material['brand'],
                'number': best_material['number']
            })

        logger.info(f"Успішно підібрано {len(materials)} унікальних ниток DMC")
        return Response({'materials': materials}, status=status.HTTP_200_OK)