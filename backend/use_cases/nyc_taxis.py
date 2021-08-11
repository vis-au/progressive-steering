from dateutil import parser
from use_cases.use_case import UseCase
import eel
from typing import Any, List

# source of dataset: https://data.cityofnewyork.us/Transportation/2018-Yellow-Taxi-Trip-Data/t29m-gskq
FILE_PATH = "../data/nyc_taxis.parquet"
TABLE_NAME = "taxis"
X_ENCODING = "trip_duration"
Y_ENCODING = "tip_percentile"

class UseCaseTaxis(UseCase):
    def __init__(self):
        super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)


    def get_pk_columns(self):
        return ["tpep_dropoff_datetime", "tpep_pickup_datetime", "total_amount"]


    def send_info(self, eel: eel, column_names: List[str], cursor: Any):
        super().send_info(eel, column_names, cursor)

        # true max lies at 86392.0, but that's an extreme outlier.
        eel.send_dimension_total_extent({
          "name": X_ENCODING,
          "min": 0,
          "max": 8000
        })
        eel.send_dimension_total_extent({
          "name": Y_ENCODING,
          "min": 0,
          "max": 1
        })


    def get_additional_columns(self):
        return ["tpep_pickup_datetime", "tpep_dropoff_datetime"]


    def get_dict_for_use_case(self, tuple: List[float], column_names: List[str]):
        result = super().get_dict_for_use_case(tuple, column_names)

        dropoff_date = parser.parse(result["tpep_dropoff_datetime"])
        pickup_date = parser.parse(result["tpep_pickup_datetime"])

        result[X_ENCODING] = (dropoff_date - pickup_date).total_seconds()
        result[Y_ENCODING] = (result["tip_amount"] / result["total_amount"])

        return result
