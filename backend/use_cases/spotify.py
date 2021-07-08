from use_cases.use_case import UseCase

# source of dataset: https://www.kaggle.com/yamaerenay/spotify-dataset-19212020-160k-tracks
FILE_PATH = "../data/spotify_data.csv.gz"
TABLE_NAME = "spotify_data"
X_ENCODING = "danceability"
Y_ENCODING = "speechiness"

class UseCaseSpotify(UseCase):
  def __init__(self):
    super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)

  def get_user_parameters(self, user_data):
    return {}

  def get_dict_for_use_case(self, tuple, df):
    result = {}

    for i, col in enumerate(df.columns):
      result[col] = tuple[i]

    return result

  def send_info(self, eel, df):
    for col in df.columns:
      min = df[col].min()
      max = df[col].max()
      eel.send_dimension_total_extent({
        "name": col,
        "min": min,
        "max": max
      })