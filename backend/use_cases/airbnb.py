from use_cases.use_case import UseCase
import math

FILE_PATH = "../data/listings_alt.csv"
TABLE_NAME = "listings"
X_ENCODING = "Saving opportunity"
Y_ENCODING = "Distance"


def distance(lat1, long1, lat2, long2):
    degrees_to_radians = math.pi/180.0
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
    theta1 = long1*degrees_to_radians
    theta2 = long2*degrees_to_radians
    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) +
    math.cos(phi1)*math.cos(phi2))
    arc = math.acos( cos )
    return int(arc * 6371*1000)/1000


class UseCaseAirbnb(UseCase):
  def __init__(self):
    super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)
    return None


  def get_user_parameters(self, user_data):
    # user_data for distance contains only one value, but that one is a maximum, so make it a range
    return {
      "price": user_data["moneyRange"],
      "distance": [0, user_data["userMaxDistance"]]
    }


  def get_dict_for_use_case(self, tuple):
    return {
        "accommodates": tuple[12],
        "bathrooms": tuple[13],
        "bedrooms": tuple[14],
        "beds": tuple[15],
        "cleaning_fee": tuple[18],
        "latitude": tuple[10],
        "longitude": tuple[11],
        "price": tuple[16],
        "zipcode": tuple[7],
        self.x_encoding: tuple[46],
        self.y_encoding: tuple[44], # distance()
    }


  def send_info(self, eel):
    eel.send_dimension_total_extent({"name": "accommodates", "min": 0, "max": 5})
    eel.send_dimension_total_extent({"name": "bathrooms", "min": 0, "max": 4})
    eel.send_dimension_total_extent({"name": "bedrooms", "min": 0, "max": 4})
    eel.send_dimension_total_extent({"name": "beds", "min": 0, "max": 5})
    eel.send_dimension_total_extent({"name": "cleaning_fee", "min": 0, "max": 325})
    eel.send_dimension_total_extent({"name": "latitude", "min": 48.8, "max": 49})
    eel.send_dimension_total_extent({"name": "longitude", "min": 2.2, "max": 2.5})
    eel.send_dimension_total_extent({"name": "price", "min": 50, "max": 95})
    eel.send_dimension_total_extent({"name": "zipcode", "min": 74400, "max": 750011})