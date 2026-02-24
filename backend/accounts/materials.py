import requests
import pandas as pd
import io
import math
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.serializers import Serializer, DictField, CharField, ListField

logger = logging.getLogger(__name__)

class MaterialInputSerializer(Serializer):
    colors = ListField(child=DictField(child=CharField()), required=True)
    materialType = CharField(required=True, allow_blank=False)

class MaterialOutputSerializer(Serializer):
    color = DictField(child=CharField())
    brand = CharField()
    number = CharField()

def color_distance(c1, c2):
    return math.sqrt(
        (int(c1['r']) - int(c2['r'])) ** 2 +
        (int(c1['g']) - int(c2['g'])) ** 2 +
        (int(c1['b']) - int(c2['b'])) ** 2
    )

def load_dmc_colors():
    url = 'https://raw.githubusercontent.com/nathantspencer/DMC-ColorCodes/master/DMC_ColorCodes.csv'
    try:
        logger.info(f"Loading DMC colors from {url}")
        response = requests.get(url)
        response.raise_for_status()
        csv_data = pd.read_csv(io.StringIO(response.text))
        colors = []
        for _, row in csv_data.iterrows():
            colors.append({
                'brand': 'DMC',
                'number': str(row['DMC Code']),
                'color': {
                    'r': int(row['Red']),
                    'g': int(row['Green']),
                    'b': int(row['Blue'])
                }
            })
        logger.info(f"Loaded {len(colors)} DMC colors")
        return colors
    except Exception as e:
        logger.error(f"Error loading DMC colors: {str(e)}")
        raise

def load_ariadna_colors():
    url = 'https://raw.githubusercontent.com/JuliaSzulc/flossverter/master/ariadna.csv'
    try:
        logger.info(f"Loading Ariadna colors from {url}")
        response = requests.get(url)
        response.raise_for_status()
        csv_data = pd.read_csv(io.StringIO(response.text))
        colors = []
        for _, row in csv_data.iterrows():
            colors.append({
                'brand': 'Ariadna',
                'number': str(row['Number']),
                'color': {
                    'r': int(row['R']),
                    'g': int(row['G']),
                    'b': int(row['B'])
                }
            })
        logger.info(f"Loaded {len(colors)} Ariadna colors")
        return colors
    except Exception as e:
        logger.error(f"Error loading Ariadna colors: {str(e)}")
        raise

def load_bead_colors():
    # Placeholder для бісеру, замінити на реальне джерело
    try:
        logger.info("Using placeholder for bead colors")
        return [
            {'brand': 'Preciosa', 'number': '00030', 'color': {'r': 255, 'g': 255, 'b': 255}},
            {'brand': 'Preciosa', 'number': '17020', 'color': {'r': 255, 'g': 0, 'b': 0}},
            {'brand': 'Preciosa', 'number': '57060', 'color': {'r': 0, 'g': 255, 'b': 0}},
            {'brand': 'Preciosa', 'number': '37030', 'color': {'r': 0, 'g': 0, 'b': 255}},
        ]
    except Exception as e:
        logger.error(f"Error loading bead colors: {str(e)}")
        raise

class MaterialsAPIView(APIView):
    def post(self, request):
        logger.info(f"Received request to MaterialsAPIView: {request.data}")
        serializer = MaterialInputSerializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Invalid input: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        colors = serializer.validated_data['colors']
        material_type = serializer.validated_data['materialType']
        logger.info(f"Processing {len(colors)} colors for materialType: {material_type}")

        if material_type not in ['beads', 'threads', 'ariadna']:
            logger.error(f"Invalid material type: {material_type}")
            return Response({'error': 'Неправильний тип матеріалу'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            available_materials = []
            if material_type == 'threads':
                available_materials = load_dmc_colors()
            elif material_type == 'ariadna':
                available_materials = load_ariadna_colors()
            else:
                available_materials = load_bead_colors()

            materials = []
            for color in colors:
                closest_material = available_materials[0]
                min_distance = color_distance(color, closest_material['color'])
                for material in available_materials:
                    distance = color_distance(color, material['color'])
                    if distance < min_distance:
                        min_distance = distance
                        closest_material = material
                materials.append({
                    'color': {'r': color['r'], 'g': color['g'], 'b': color['b']},
                    'brand': closest_material['brand'],
                    'number': closest_material['number']
                })

            output_serializer = MaterialOutputSerializer(materials, many=True)
            logger.info(f"Returning {len(materials)} materials")
            return Response({'materials': output_serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in MaterialsAPIView: {str(e)}")
            return Response({'error': 'Помилка завантаження даних'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)