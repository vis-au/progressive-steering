import eel
import duckdb
import platform
import pandas as pd
import numpy as np

import steering_duckdb as steer
from use_cases.use_case import UseCase
from use_cases.spotify import UseCaseSpotify
from use_cases.airbnb import UseCaseAirbnb
from testcase_loader import load_preset_scenarios, get_test_cases

WAIT_INTERVAL = 1

# contains information about the particular use case and is populated by load_use_case() on launch
USE_CASE: UseCase = None

# we reorder the columns when loading the data such that a unique id sits at position 0
ID_COLUMN_INDEX = 0

# user constants
user_parameters={}

# enum of states for progression
PROGRESSTION_STATES = {
    "ready": 0,
    "running": 1,
    "paused": 2,
    "done": 3
}

# Global variables
plotted_points = {} # all plotted points
selected_points = [] # cumulated airb&b ID of points plotted in the user box till the actual chunk

user_selection_updated=False # new box
total_inside_box=0 # number of points plotted in the user box till the actual chunk
tree_ready=False # it is used to interrupt the initial chunking cycle
chunk_size=100 # number of points retrieved per chunk
modifier="True" # modify initial query with conditions coming from the tree
query_att="*" # attributes of the main query
last_selected_items=[]
use_floats_for_savings=True

# progression state can be paused/restarted interactively by the user
progression_state = PROGRESSTION_STATES["ready"]


# initialize the database connection and an empty dataframe
cursor = duckdb.connect()
df: pd.DataFrame = None


def send_chunks(steered_chunk, random_chunk):
    eel.send_both_chunks(steered_chunk, random_chunk)


def send_statistics_to_frontend(precision, total_inside_box):
    eel.send_evaluation_metric({"name": "precision", "value": precision})
    eel.send_evaluation_metric({"name": "recall", "value": total_inside_box})


def build_query(chunk_size):
  global query_att, modifier

  SELECT = "SELECT "+query_att
  FROM   = "FROM "+USE_CASE.table_name
  WHERE = "WHERE "+USE_CASE.table_name+".id NOT IN (SELECT id from plotted)"

  for p in user_parameters:
      param = str(p)
      value = user_parameters[p]

      if isinstance(value, list):
          min_value = str(value[0])
          max_value = str(value[1])
          WHERE += " AND "+param+" >= "+min_value+" AND "+param+" <= "+max_value
      elif isinstance(value, str):
          WHERE += " AND "+param+" = "+value
      elif isinstance(value, (int, float, complex)):
          WHERE += " AND "+param+" = "+str(value)

  return SELECT+" "+FROM+" "+WHERE+" AND "+modifier+" LIMIT "+str(chunk_size)


def reset():
    global plotted_points, selected_points
    global user_selection_updated, total_inside_box, tree_ready, chunk_size, modifier, query_att
    global last_selected_items, use_floats_for_savings
    global progression_state

    print("resetting global state")

    plotted_points = {}
    selected_points = []

    user_selection_updated=False
    total_inside_box=0
    tree_ready=False
    chunk_size=100
    modifier="True"
    query_att="*"
    last_selected_items=[]
    use_floats_for_savings=True

    progression_state = PROGRESSTION_STATES["ready"]


def tuple_to_dict(tuple, state, chunk_number):
    # first apply the data specific properties using a custom function
    transformed_dict = USE_CASE.get_dict_for_use_case(tuple, df)

    # then add the required properties
    transformed_dict["chunk"] = chunk_number
    transformed_dict["state"] = state
    transformed_dict["inside"] = 0

    return transformed_dict


def mark_ids_plotted(result):
    value_string = ""
    for i, tuple in enumerate(result):
        value_string += "('"+str(tuple[ID_COLUMN_INDEX])+"'), " if i < len(result)-1 else "('"+str(tuple[ID_COLUMN_INDEX])+"');"

    if len(value_string) == 0:
        return

    cursor.execute("INSERT INTO plotted (id) VALUES "+value_string)


def get_items_inside_selection_at_chunk(chunk):
    inb = 0

    for k in plotted_points:
        if plotted_points[str(k)]["inside"]==1 and plotted_points[str(k)]["chunk"]==chunk:
            inb+=1

    return inb


def was_progression_reset_during_sleep():
    while progression_state == PROGRESSTION_STATES["paused"]:
        eel.sleep(1)
    if progression_state == PROGRESSTION_STATES["ready"]:
        return True
    elif progression_state == PROGRESSTION_STATES["done"]:
        return True

    return False


def send_results_to_frontend(chunk_number, result, random_result, state):
    global plotted_points

    chunk = {}
    random_chunk = {}

    for tuple in result:
        plotted_points[str(tuple[ID_COLUMN_INDEX])]=tuple_to_dict(tuple, state, chunk_number)
        chunk[tuple[ID_COLUMN_INDEX]]={
            "chunk": chunk_number,
            "state": state,
            "values": plotted_points[str(tuple[ID_COLUMN_INDEX])]
        }

    # ensure equal chunk size between random and steered chunk
    for tuple in random_result[len(plotted_points) - len(result) : len(plotted_points)]:
        random_chunk[tuple[ID_COLUMN_INDEX]] = {
            "chunk": chunk_number,
            "state": "random",
            "values": tuple_to_dict(tuple, state, chunk_number)
        }

    send_chunks(chunk, random_chunk)


def get_next_result(chunk_number, random_result, state, query):
    global total_inside_box, selected_points

    cursor.execute(query)
    result = cursor.fetchall()

    send_results_to_frontend(chunk_number, result, random_result, state)
    mark_ids_plotted(result)

    # IMPORTANT: within this waiting period, the backend receives the "in-/outside" information by
    # the frontend, which influences precision/insde calculation below
    eel.sleep(WAIT_INTERVAL)
    if was_progression_reset_during_sleep():
        return None

    recent_inside = get_items_inside_selection_at_chunk(chunk_number)
    total_inside_box += recent_inside
    precision = recent_inside/chunk_size
    print("chunk:", chunk_number, state, "in selection:", total_inside_box, "Precision:", precision)

    send_statistics_to_frontend(precision, total_inside_box)

    return result


def run_steered_progression(chunk_size, min_box_items=50):
    global progression_state, modifier, total_inside_box

    chunk = 0
    active_query = build_query(chunk_size)

    # reset database of plotted points
    cursor.execute("DELETE FROM plotted")
    progression_state = PROGRESSTION_STATES["ready"]

    # wait until user starts progression
    while progression_state == PROGRESSTION_STATES["ready"]:
        eel.sleep(.1)
        # HACK: if the user reloads the page, the state variable is briefly set to "done" before a
        # new progression is spawned, causing this function to return, which terminates its "thread"
        if progression_state == PROGRESSTION_STATES["done"]:
            return

    # get all items from the dataset to imitate random later on
    query_for_all_items = active_query[0: active_query.find("LIMIT")]
    cursor.execute(query_for_all_items)
    my_result_random = cursor.fetchall()

    ####################### NON-STEERING PHASE #####################################################
    print("Entering NON-STEERING PHASE 1 - Query:", active_query, modifier)
    print("user parameters:", user_parameters)
    state="flushing"
    modifier="True"
    active_query = build_query(chunk_size)
    my_result = []
    my_result_empty = False

    while not my_result_empty and (not tree_ready or total_inside_box<min_box_items or len(modifier)<=3) and len(selected_points) == 0:
        my_result = get_next_result(chunk, my_result_random, state, active_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    ####################### ACTIVATION PHASE #######################################################
    print("Entering ACTIVATION PHASE - Query:", active_query, modifier)
    print(active_query)
    total_inside_box=0
    state="collectingData"
    my_result_empty = False

    while not my_result_empty and (not tree_ready or total_inside_box<min_box_items or len(modifier)<=3):
        my_result = get_next_result(chunk, my_result_random, state, active_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting ACTIVATION PHASE")

    ########################## STEERING PHASE ######################################################
    state="usingTree"
    active_query=build_query(chunk_size)
    print("Entering STEERING PHASE - Query:", active_query, len(my_result))
    my_result_empty = False

    while not my_result_empty:
        my_result = get_next_result(chunk, my_result_random, state, active_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting STEERING PHASE")

    ######################### NON-STEERING PHASE ###################################################
    state="flushing"
    modifier="True"
    active_query=build_query(chunk_size)
    print("Entering NON-STEERING PHASE 2", tree_ready, "modifier =", modifier)
    my_result_empty = False

    while not my_result_empty:
        my_result = get_next_result(chunk, my_result_random, state, active_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting NON-STEERING PHASE 2")
    print("DONE")

    return


def start_progression():
    global progression_state

    while True:
        reset()
        # HACK: set the state variable to "done" here, in order to terminate all progression
        # "threads" currently running, ensuring that only a single progression is run over the data.
        progression_state = PROGRESSTION_STATES["done"]
        eel.sleep(.1)
        eel.spawn(run_steered_progression(chunk_size))
        if progression_state == PROGRESSTION_STATES["done"]:
            return


@eel.expose
def get_use_cases():
    return get_test_cases()


def save_as_user_parameters(user_data):
  global user_parameters
  user_parameters = USE_CASE.get_user_parameters(user_data)


def send_info_to_frontend():
  # send general information to the frontend
  eel.set_x_name(USE_CASE.x_encoding)
  eel.set_y_name(USE_CASE.y_encoding)

  min_x = df[USE_CASE.x_encoding].min()
  max_x = df[USE_CASE.x_encoding].max()
  min_y = df[USE_CASE.y_encoding].min()
  max_y = df[USE_CASE.y_encoding].max()

  eel.send_dimension_total_extent({"name": USE_CASE.x_encoding, "min": min_x, "max": max_x})
  eel.send_dimension_total_extent({"name": USE_CASE.y_encoding, "min": min_y, "max": max_y})

  # also send use case specific bounds to the frontend
  USE_CASE.send_info(eel, df)

  return


@eel.expose
def send_to_backend_userData(user_data):
  print("received user selection", user_data)

  save_as_user_parameters(user_data)
  send_info_to_frontend()

  # TODO: it seems counter-intuitive that this function would also start the progression.
  start_progression()


def update_steering_modifier():
    global modifier
    global tree_ready
    global USE_CASE

    plotted_list = []
    of_interest_list = []

    for id in plotted_points:
        plotted_list.append(plotted_points[str(id)])
        of_interest_list.append(1 if id in selected_points else 0)

    plotted_df = pd.DataFrame(plotted_list)
    of_interest_np = np.array(of_interest_list)

    if len(USE_CASE.feature_columns) == 0:
        feature_names = get_numeric_columns()
        feature_names.remove(USE_CASE.x_encoding)
        feature_names.remove(USE_CASE.y_encoding)
    else:
        feature_names = USE_CASE.feature_columns

    features = plotted_df.loc[:, feature_names]
    modifier="("+steer.get_steering_condition(features, of_interest_np, "sql")+")"

    if len(modifier)>3:
        tree_ready=True
    else:
        modifier="True"

    return modifier


@eel.expose
def send_user_selection(selected_item_ids):
    global plotted_points
    global selected_points
    global last_selected_items

    if len(selected_item_ids)==0:
        return(0)

    print(len(selected_item_ids), "new items received...", selected_item_ids)

    last_selected_items=selected_item_ids.copy()

    for k in selected_item_ids:
        plotted_points[str(k)]["inside"]=1

    selected_points.extend(selected_item_ids)

    eel.sleep(0.01)

    update_steering_modifier()


@eel.expose
def send_user_params(parameters):
    print("new user parameters received")


@eel.expose
def send_progression_state(state):
    global progression_state, PROGRESSTION_STATES

    if state == "ready":
        progression_state = PROGRESSTION_STATES["ready"]
    elif state == "running":
        progression_state = PROGRESSTION_STATES["running"]
    elif state == "paused":
        progression_state = PROGRESSTION_STATES["paused"]
    elif state == "done":
        progression_state = PROGRESSTION_STATES["done"]

    print("new progression state", state)


def start_eel():
    """Start Eel with development configuration."""

    directory = "../frontend/src"
    page = {"port": 3000}
    eel.init(directory, [".tsx", ".ts", ".jsx", ".js", ".html"])
    print("Backend launched successfully. Waiting for requests ...")

    # These will be queued until the first connection is made, but won"t be repeated on a page reload
    eel_kwargs = dict(
        host="localhost",
        port=8080,
        size=(1280, 800),
    )
    try:
        eel.start(page, mode=None, **eel_kwargs)
    except EnvironmentError:
        # If Chrome isn"t found, fallback to Microsoft Edge on Win10 or greater
        if sys.platform in ["win32", "win64"] and int(platform.release()) >= 10:
            eel.start(page, mode="edge", **eel_kwargs)
        else:
            raise


def get_numeric_columns():
  numeric_columns = []
  numeric_types = [np.float32, np.float64, np.int32, np.int64]

  for col in df.columns:
    # avoid having duplicate id column, even if it's numeric
    if df[col].dtype in numeric_types and col != "id":
      numeric_columns.append(col)

  return numeric_columns


def load_use_case(use_case_label: str):
    global USE_CASE, df

    # while we do not have other use cases, this will default to the airbnb use case
    USE_CASE = UseCaseAirbnb()

    if use_case_label == "airbnb":
        USE_CASE = UseCaseAirbnb()
    elif use_case_label == "spotify":
        USE_CASE = UseCaseSpotify()

    df = cursor.execute("SELECT * FROM read_csv_auto('"+USE_CASE.file_path+"');").fetchdf()
    numeric_columns = get_numeric_columns()

    # put id column first to match ID_COLUMN_INDEX, except for airbnb use case, which requires all
    # columns to be available because of index-based column access
    df = df if isinstance(USE_CASE, UseCaseAirbnb) else df[["id"] + numeric_columns]

    cursor.register(USE_CASE.table_name, df)
    cursor.execute("CREATE TABLE plotted(id VARCHAR)")


if __name__ == "__main__":
    import sys

    known_use_cases = ["airbnb", "spotify"]
    use_case_label = sys.argv[1] if len(sys.argv) > 1 else "airbnb"
    if use_case_label not in known_use_cases:
        raise Exception("Unknown use case. Please provide one of the following use cases: "+str(known_use_cases))

    load_use_case(use_case_label)

    if use_case_label == "airbnb":
        load_preset_scenarios(cursor)

    # Uses the production version in the "build" directory if passed a second argument
    start_eel()
