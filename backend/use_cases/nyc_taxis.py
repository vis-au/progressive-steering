from use_cases.use_case import UseCase

# source of dataset: https://data.cityofnewyork.us/Transportation/2018-Yellow-Taxi-Trip-Data/t29m-gskq
FILE_PATH = "../data/nyc_taxis.csv"
TABLE_NAME = "taxis"
X_ENCODING = "trip_distance"
Y_ENCODING = "tip_amount"

class UseCaseTaxis(UseCase):
  def __init__(self):
    super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)

  def transform_df(self, df):
      df["id"] = df["id"].dt.strftime("%Y-%m-%d-%H:%M:%S")
      return df
