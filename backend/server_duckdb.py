import duckdb
import math
import platform
import steering_module as sm
import eel

WAIT_INTERVAL = 1
FILE_PATH = "../data/listings_alt.csv"
TABLE_NAME = "listings"

# user constants
USER_LAT = 48.85565
USER_LON = 2.365492
USER_RANGE = [60, 90]
USER_DAY = "2020-04-31"
USER_MAX_DISTANCE = 10 + 1
c={
    "lat": USER_LAT,
    "lon": USER_LON,
    "range": USER_RANGE,
    "day": USER_DAY,
    "MaxDistance": USER_MAX_DISTANCE
}

# user selection in view coordinates
X1 = -1
X2 = -1
Y1 = -1
Y2 = -1

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
test_cases={} # preset scenarios of selections in view space (get loaded from testCases.txt)

# progression state can be paused/restarted interactively by the user
progression_state = PROGRESSTION_STATES["ready"]


# initialize the database connection
cursor = duckdb.connect()
df = cursor.execute("SELECT * FROM read_csv_auto('"+FILE_PATH+"');").fetchdf()
cursor.register(TABLE_NAME, df)
cursor.execute("CREATE TABLE plotted(id VARCHAR)")


def send_chunks(steered_chunk, random_chunk):
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
    FROM   = "FROM "+TABLE_NAME
    WHERE  = "WHERE price >="+str(USER_RANGE[0])+" AND price <="+str(USER_RANGE[1])+"  AND "+TABLE_NAME+".id NOT IN (SELECT id from plotted)"

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


def get_items_inside_selection_at_chunk(chunk):
    inb = 0

    for k in plotted_points:
        if plotted_points[k]["inside"]==1 and plotted_points[k]["chunk"]==chunk:
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
        plotted_points[tuple[0]]=airbnb_tuple_to_dict(tuple, state, chunk_number)
        chunk[tuple[0]]={
            "chunk": chunk_number,
            "state": state,
            "values": plotted_points[tuple[0]],
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    # ensure equal chunk size between random and steered chunk
    for tuple in random_result[len(plotted_points) - len(result) : len(plotted_points)]:
        random_chunk[tuple[0]] = {
            "chunk": chunk_number,
            "state": "random",
            "values": airbnb_tuple_to_dict(tuple, state, chunk_number),
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
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
    print("chunk:", chunk_number, state, "items in selection:", total_inside_box, "Precision:", recent_inside/chunk_size, recent_inside, get_distances_min_max())

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
    use_cases={}
    for i in range(len(test_cases)):
        use_cases["testcase"+str(i+1)]={
            "name": "case"+str(i+1)+"_"+str(test_cases[i]["boxMinRange"])+"_"+str(test_cases[i]["boxMaxRange"])+"_"+str(test_cases[i]["boxMinDistance"])+"_"+str(test_cases[i]["boxMaxDistance"]),
            "x_bounds":[test_cases[i]["boxMinRange"], test_cases[i]["boxMaxRange"]],
            "y_bounds":[test_cases[i]["boxMinDistance"], test_cases[i]["boxMaxDistance"]]
        }
    return use_cases


@eel.expose
def send_to_backend_userData(x):
  global USER_LAT
  global USER_LON
  global USER_RANGE
  global USER_DAY
  global USER_MAX_DISTANCE
  c={"lat": 48.85565, "lon": 2.365492, "range": [60, 90], "day": "2020-04-31", "MaxDistance":10+1}
  print("received user selection", c)

  USER_LAT=x["lat"]
  USER_LON=x["lon"]
  USER_RANGE=x["moneyRange"]
  USER_DAY=x["day"]
  USER_MAX_DISTANCE=x["userMaxDistance"]

  USER_LAT=c["lat"]
  USER_LON=c["lon"]
  USER_RANGE=c["range"]
  USER_DAY=c["day"]
  USER_MAX_DISTANCE=c["MaxDistance"]

  # send parameters to frontend before sending data
  eel.send_city("Paris")
  eel.set_x_name("Saving opportunity")
  eel.set_y_name("Distance")
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": -1, "max": 2+USER_RANGE[1]-USER_RANGE[0]})
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
    global plotted_points
    global selected_points
    global last_selected_items
    global modifier
    global tree_ready

    if len(selected_item_ids)==0:
        return(0)

    print(len(selected_item_ids), "new items received...", selected_item_ids)

    last_selected_items=selected_item_ids.copy()

    for k in selected_item_ids:
        plotted_points[k]["inside"]=1

    selected_points.extend(selected_item_ids)

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
    modifier="("+sm.getSteeringCondition(plotted_points)+")"

    if len(modifier)>3:
        tree_ready=True
    else:
        modifier="True"

    return modifier


@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    global X1, X2, Y1, Y2
    global total_inside_box
    global plotted_points
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
    global plotted_points
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
    global USER_RANGE
    qq = str("SELECT * FROM "+TABLE_NAME+" WHERE price>="+str(USER_RANGE[0])+" and price <=" +str(USER_RANGE[1])+" and abovemF<="+str(test_case["boxMaxRange"])+
             " and abovemF>="+str(test_case["boxMinRange"]) +" and distance>="+str(test_case["boxMinDistance"])+" and distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuplesF=len(myresult)

    qq = str("SELECT * FROM "+TABLE_NAME+" WHERE price>="+str(USER_RANGE[0])+" and price <=" +str(USER_RANGE[1])+" and abovem<="+str(test_case["boxMaxRange"])+
             " and abovem>="+str(test_case["boxMinRange"]) +" and distance>="+str(test_case["boxMinDistance"])+" and distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuples=len(myresult)
    return tuples, tuplesF


def load_config():
    global use_floats_for_savings
    global test_cases
    s=eval(open("DB_server_config.txt", encoding="UTF8").read())
    use_floats_for_savings=s["floatSaving"]
    test_cases=eval(open("testCases.txt", encoding="UTF8").read())
    print("Configuration loaded")
    print("floatSaving: ", use_floats_for_savings)
    print("testCases loaded")
    for i in range(len(test_cases)):
        t=get_box_data(test_cases[i])
        test_cases[i]["tuples"]=t[0]
        test_cases[i]["tuplesF"]=t[1]
        print(i+1, test_cases[i])
    f=open("testCases.txt", "w", encoding="UTF8")
    print(str(test_cases).replace("{", "\n{"), file=f)
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

def get_distances_min_max():
    min_dist=100
    max_dist=0
    for k in plotted_points:
        if plotted_points[k]["dist2user"]>max_dist and plotted_points[k]["inside"]==1:
            max_dist=plotted_points[k]["dist2user"]
        if plotted_points[k]["dist2user"]<min_dist and plotted_points[k]["inside"]==1:
            min_dist=plotted_points[k]["dist2user"]
    return min_dist, max_dist


if __name__ == "__main__":
    import sys
    load_config()

    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
