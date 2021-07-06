import math

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


def get_airbnb_user_parameters(user_data):
  # user_data for distance contains only one value, but that one is a maximum, so make it a range
  return {
    "price": user_data["moneyRange"],
    "distance": [0, user_data["userMaxDistance"]]
  }


def airbnb_tuple_to_dict(tuple, X_ENCODING, Y_ENCODING):
  '''
  Describes the transformation of a tuple from the airbnb data to the format required by the
  duckdb server. The returned dict is required to encode the x and y dimensions.
  '''
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
      Y_ENCODING: tuple[44],
      X_ENCODING: tuple[46]
  }


def send_airbnb_info(eel):
  '''
  Sends value ranges to the frontend for all dimensions that are included by the
  airbnb_tuple_to_dict() function above.
  '''
  eel.send_dimension_total_extent({"name": "accommodates", "min": 0, "max": 5})
  eel.send_dimension_total_extent({"name": "bathrooms", "min": 0, "max": 4})
  eel.send_dimension_total_extent({"name": "bedrooms", "min": 0, "max": 4})
  eel.send_dimension_total_extent({"name": "beds", "min": 0, "max": 5})
  eel.send_dimension_total_extent({"name": "cleaning_fee", "min": 0, "max": 325})
  eel.send_dimension_total_extent({"name": "latitude", "min": 48.8, "max": 49})
  eel.send_dimension_total_extent({"name": "longitude", "min": 2.2, "max": 2.5})
  eel.send_dimension_total_extent({"name": "price", "min": 50, "max": 95})
  eel.send_dimension_total_extent({"name": "zipcode", "min": 74400, "max": 750011})