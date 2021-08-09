from use_cases.use_case import UseCase

# source of dataset: https://www.kaggle.com/yamaerenay/spotify-dataset-19212020-160k-tracks
FILE_PATH = "../data/spotify_data.csv.gz"
TABLE_NAME = "spotify_data"
X_ENCODING = "danceability"
Y_ENCODING = "speechiness"

class UseCaseSpotify(UseCase):
  def __init__(self):
    super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)