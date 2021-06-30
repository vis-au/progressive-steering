import duckdb
import math
import platform
import steering_module as sm
import eel

# initialize the database connection
cursor = duckdb.connect()
listings_df = cursor.execute("SELECT * FROM read_csv_auto('../data/listings_alt.csv');").fetchdf()
cursor.register("listings", listings_df)
cursor.execute("CREATE TABLE plotted(id VARCHAR)")

# enum of states for progression
PROGRESSTION_STATES = {
    "ready": 0,
    "running": 1,
    "paused": 2,
    "done": 3
}

# Global variables
PLOTTED_POINTS = {} # all plotted points
ALL_POINTS_IN_SELECTION = [] # cumulated airb&b ID of points plotted in the user box till the actual chunk
WAIT_INTERVAL = 1

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

# user data for test
user_lat = 48.85565
user_lon = 2.365492
user_range = [60, 90]
user_day = "2020-04-31"
user_max_distance = 10 + 1
c={
    "lat": user_lat,
    "lon": user_lon,
    "range": user_range,
    "day": user_day,
    "MaxDistance": user_max_distance
}

# user selection in view coordinates
X1 = -1
X2 = -1
Y1 = -1
Y2 = -1


def send_chunk(chunk):
    eel.send_data_chunk(chunk)


def send_random_chunk(chunk):
    eel.send_random_data_chunk(chunk)


def send_both_chunks(steered_chunk, random_chunk):
    eel.send_both_chunks(steered_chunk, random_chunk)


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


def above_m(saving, saving_as_float): # the search is bound to a
    return {
        "neighborhood_min": 5,
        "saving": saving_as_float if use_floats_for_savings else saving,
        "alternativeId": 100,
        "extraSteps": 0.1,
        "vicini": 100
    }


def build_query(chunk_size):
    global query_att, modifier

    SELECT = "SELECT "+query_att
    FROM   = "FROM listings"
    WHERE  = "WHERE price >="+str(user_range[0])+" AND price <="+str(user_range[1])+"  AND listings.id NOT IN (SELECT id from plotted)"

    return SELECT+" "+FROM+" "+WHERE+" AND "+modifier+" LIMIT "+str(chunk_size)


def reset():
    global PLOTTED_POINTS, ALL_POINTS_IN_SELECTION, WAIT_INTERVAL
    global user_selection_updated, total_inside_box, tree_ready, chunk_size, modifier, query_att
    global last_selected_items, use_floats_for_savings
    global progression_state

    print("resetting global state")

    PLOTTED_POINTS = {}
    ALL_POINTS_IN_SELECTION = []
    WAIT_INTERVAL = 1

    user_selection_updated=False
    total_inside_box=0
    tree_ready=False
    chunk_size=100
    modifier="True"
    query_att="*"
    last_selected_items=[]
    use_floats_for_savings=True

    progression_state = PROGRESSTION_STATES["ready"]


def airbnb_tuple_to_dict(tuple, state, chunk):
    return {
        "host_id": tuple[0],
        "state": state,
        "zipcode": tuple[7],
        "latitude": tuple[10],
        "longitude": tuple[11],
        "accommodates": tuple[12],
        "bathrooms": tuple[13],
        "bedrooms": tuple[14],
        "beds": tuple[15],
        "price": tuple[16],
        "cleaning_fee": tuple[18],
        "minimum_nights": tuple[21],
        "maximum_nights": tuple[22],
        # "dist2user": distance(user_lat, user_lon, tuple[10], tuple[11]),
        "dist2user": tuple[44],
        "aboveM": above_m(tuple[45], tuple[46]),
        "chunk": chunk,
        "inside": 0
    }


def mark_ids_plotted(result):
    value_string = ""
    for i, tuple in enumerate(result):
        value_string += "("+str(tuple[0])+"), " if i < len(result)-1 else "("+str(tuple[0])+");"

    if len(value_string) == 0:
        return

    cursor.execute("INSERT INTO plotted (id) VALUES "+value_string)


def send_result_to_frontend(chunk_number, result, state):
    global PLOTTED_POINTS

    chunk = {}

    for tuple in result:
        PLOTTED_POINTS[tuple[0]]=airbnb_tuple_to_dict(tuple, state, chunk_number)
        chunk[tuple[0]]={
            "chunk": chunk_number,
            "state": state,
            "values": PLOTTED_POINTS[tuple[0]],
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    send_chunk(chunk)


def send_random_result_to_frontend(chunk_number, random_result, state):
    state = "random_("+state+")"
    chunk = {}

    for tuple in random_result[chunk_number*chunk_size:(chunk_number+1)*chunk_size]:
        chunk[tuple[0]] = {
            "chunk": chunk_number,
            "state": state,
            "values": airbnb_tuple_to_dict(tuple, state, chunk_number),
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    send_random_chunk(chunk)


def get_items_inside_selection_at_chunk(chunk):
    inb = 0

    for k in PLOTTED_POINTS:
        if PLOTTED_POINTS[k]["inside"]==1 and PLOTTED_POINTS[k]["chunk"]==chunk:
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


def send_both_results_to_frontend(chunk_number, result, random_result, state):
    global PLOTTED_POINTS

    chunk = {}

    for tuple in result:
        PLOTTED_POINTS[tuple[0]]=airbnb_tuple_to_dict(tuple, state, chunk_number)
        chunk[tuple[0]]={
            "chunk": chunk_number,
            "state": state,
            "values": PLOTTED_POINTS[tuple[0]],
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    random_state = "random_("+state+")"
    random_chunk = {}

    for tuple in random_result[len(PLOTTED_POINTS) - len(result) : len(PLOTTED_POINTS)]:
        random_chunk[tuple[0]] = {
            "chunk": chunk_number,
            "state": random_state,
            "values": airbnb_tuple_to_dict(tuple, random_state, chunk_number),
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    send_both_chunks(chunk, random_chunk)


def get_next_result(chunk_number, random_result, state, query):
    global total_inside_box, ALL_POINTS_IN_SELECTION

    cursor.execute(query)
    result = cursor.fetchall()

    send_both_results_to_frontend(chunk_number, result, random_result, state)
    mark_ids_plotted(result)

    # IMPORTANT: within this waiting period, the backend receives the "in-/outside" information by
    # the frontend, which influences precision/insde calculation below
    eel.sleep(WAIT_INTERVAL)
    if was_progression_reset_during_sleep():
        return None

    recent_inside = get_items_inside_selection_at_chunk(chunk_number)
    total_inside_box += recent_inside
    print("chunk:", chunk_number, state, "items in selection:", total_inside_box, "Precision:", recent_inside/chunk_size, recent_inside, distances())

    eel.send_evaluation_metric({"name": "precision", "value": recent_inside/chunk_size})
    eel.send_evaluation_metric({"name": "recall", "value": total_inside_box})

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
    print("Entering LOOP0 - Query:", active_query, modifier)
    print("c", c)
    state="flushing"
    modifier="True"
    active_query = build_query(chunk_size)
    my_result = []
    my_result_empty = False

    while not my_result_empty and (not tree_ready or total_inside_box<min_box_items or len(modifier)<=3) and len(ALL_POINTS_IN_SELECTION) == 0:
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


def encodeTestCases(testCases):
    r={}
    for i in range(len(testCases)):
        r["testcase"+str(i+1)]={"name": "case"+str(i+1)+"_"+str(testCases[i]["boxMinRange"])+"_"+str(testCases[i]["boxMaxRange"])+"_"+str(testCases[i]["boxMinDistance"])+"_"+str(testCases[i]["boxMaxDistance"]),
          "x_bounds":[testCases[i]["boxMinRange"], testCases[i]["boxMaxRange"]], "y_bounds":[testCases[i]["boxMinDistance"], testCases[i]["boxMaxDistance"]]}
    return r


@eel.expose
def get_use_cases():
    return encodeTestCases(testCases)


@eel.expose
def send_to_backend_userData(x):
  global user_lat
  global user_lon
  global user_range
  global user_day
  global user_max_distance
  c={"lat": 48.85565, "lon": 2.365492, "range": [60, 90], "day": "2020-04-31", "MaxDistance":10+1}
  print("received user selection", c)

  user_lat=x["lat"]
  user_lon=x["lon"]
  user_range=x["moneyRange"]
  user_day=x["day"]
  user_max_distance=x["userMaxDistance"]

  user_lat=c["lat"]
  user_lon=c["lon"]
  user_range=c["range"]
  user_day=c["day"]
  user_max_distance=c["MaxDistance"]

  # send parameters to frontend before sending data
  eel.send_city("Paris")
  eel.set_x_name("Saving opportunity")
  eel.set_y_name("Distance")
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": -1, "max": 2+user_range[1]-user_range[0]})
  eel.send_dimension_total_extent({"name": "Distance", "min": 0, "max": 10})
  eel.send_dimension_total_extent({"name": "price", "min": 50, "max": 95})
  eel.send_dimension_total_extent({"name": "cleaning_fee", "min": 0, "max": 325})
  eel.send_dimension_total_extent({"name": "bedrooms", "min": 0, "max": 4})
  eel.send_dimension_total_extent({"name": "bathrooms", "min": 0, "max": 4})
  eel.send_dimension_total_extent({"name": "beds", "min": 0, "max": 5})
  eel.send_dimension_total_extent({"name": "accommodates", "min": 0, "max": 5})
  eel.send_dimension_total_extent({"name": "longitude", "min": 2.2, "max": 2.5})
  eel.send_dimension_total_extent({"name": "latitude", "min": 48.8, "max": 49})
  eel.send_dimension_total_extent({"name": "zipcode", "min": 74400, "max": 750011})

  start_progression()


@eel.expose
def send_user_selection(selected_item_ids):
    global PLOTTED_POINTS
    global ALL_POINTS_IN_SELECTION
    global last_selected_items
    global modifier
    global tree_ready

    if len(selected_item_ids)==0:
        return(0)

    print(len(selected_item_ids), "new items received...", selected_item_ids)

    last_selected_items=selected_item_ids.copy()

    for k in selected_item_ids:
        PLOTTED_POINTS[k]["inside"]=1

    ALL_POINTS_IN_SELECTION.extend(selected_item_ids)

    eel.sleep(0.01)

    # FIXME: the code below can be used together with the generalized steering module that uses
    #        pandas and numpy instead of dicts
    # plotted_list = []
    # of_interest_list = []

    # for id in DIZ_plotted:
    #     plotted_list.append(DIZ_plotted[id])
    #     of_interest_list.append(1 if id in IN else 0)

    # plotted = pd.DataFrame(plotted_list)
    # of_interest = np.array(of_interest_list)
    # features = plotted.loc[:,['zipcode', 'latitude', 'longitude','price']]
    # modifier="("+steer.get_steering_condition(features, of_interest, "sql")+")"
    modifier="("+sm.getSteeringCondition(PLOTTED_POINTS)+")"

    if len(modifier)>3:
        tree_ready=True
    else:
        modifier="True"

    return modifier


@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    global X1, X2, Y1, Y2
    global total_inside_box
    global PLOTTED_POINTS
    global user_selection_updated
    global last_selected_items

    print("new selected region received bounds", x_bounds, y_bounds)
    X1=x_bounds["xMin"]
    X2=y_bounds["yMin"]
    Y1=y_bounds["yMax"]
    Y2=x_bounds["xMax"]

    # total_inside_box=0
    # for k in PLOTTED_POINTS:
    #     PLOTTED_POINTS[k]["inside"]=0
    #     if k in last_selected_items:
    #         PLOTTED_POINTS[k]["inside"]=1
    #         total_inside_box+=1

    user_selection_updated=True
    return x_bounds, y_bounds


@eel.expose
def send_selection_bounds_values(x_bounds_val, y_bounds_val):
    global total_inside_box
    global PLOTTED_POINTS
    print("new selected region received_pixel", x_bounds_val, y_bounds_val)
    return x_bounds_val, y_bounds_val


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


def get_box_data(test_case):
    global user_range
    qq = str("SELECT * FROM listings WHERE price>="+str(user_range[0])+" and price <=" +str(user_range[1])+" and abovemF<="+str(test_case["boxMaxRange"])+
             " and abovemF>="+str(test_case["boxMinRange"]) +" and distance>="+str(test_case["boxMinDistance"])+" and distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuplesF=len(myresult)

    qq = str("SELECT * FROM listings WHERE price>="+str(user_range[0])+" and price <=" +str(user_range[1])+" and abovem<="+str(test_case["boxMaxRange"])+
             " and abovem>="+str(test_case["boxMinRange"]) +" and distance>="+str(test_case["boxMinDistance"])+" and distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuples=len(myresult)
    return tuples, tuplesF


def load_config():
    global use_floats_for_savings
    global testCases
    s=eval(open("DB_server_config.txt", encoding="UTF8").read())
    use_floats_for_savings=s["floatSaving"]
    testCases=eval(open("testCases.txt", encoding="UTF8").read())
    print("Configuration loaded")
    print("floatSaving: ", use_floats_for_savings)
    print("testCases loaded")
    for i in range(len(testCases)):
        t=get_box_data(testCases[i])
        testCases[i]["tuples"]=t[0]
        testCases[i]["tuplesF"]=t[1]
        print(i+1, testCases[i])
    f=open("testCases.txt", "w", encoding="UTF8")
    print(str(testCases).replace("{", "\n{"), file=f)
    f.close()


def start_eel(develop):
    """Start Eel with either production or development configuration."""

    print(develop)

    if develop:
        directory = "../frontend/src"
        app = None
        page = {"port": 3000}
    else:
        directory = "build"
        app = "chrome-app"
        page = "index.html"


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

def distances():
    global PLOTTED_POINTS
    mind=100
    maxd=0
    for k in PLOTTED_POINTS:
        if PLOTTED_POINTS[k]["dist2user"]>maxd and PLOTTED_POINTS[k]["inside"]==1:
            maxd=PLOTTED_POINTS[k]["dist2user"]
        if PLOTTED_POINTS[k]["dist2user"]<mind and PLOTTED_POINTS[k]["inside"]==1:
            mind=PLOTTED_POINTS[k]["dist2user"]
    return mind, maxd


if __name__ == "__main__":
    import sys
    load_config()

    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
