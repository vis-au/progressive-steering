import mysql.connector
import math
import platform
import steering_module as sm
import evaluationMetrics as mm
import eel
from threading import Thread

#simple sync with Steering module
global modifier  #modify initial query with conditions coming from the tree
global queryAtt  #attributes of the main query
global treeReady #it is used to interrupt the initial chunking cycle
global chunkSize
global totalChunkNumber
global totalInb  #number of points plotted in the user box till the actual chunk
global userSelectionUpdated #new box
global lastSelectedItems
global X1, X2, Y1, Y2
lastSelectedItems=[]

global floatSaving
global doubleSending

userSelectionUpdated=False
totalChunkNumber=0
totalInb=0
treeReady=False
chunkSize=100
modifier="True"
queryAtt="*"
USER_PW = "password" # configure according to MySQL setup

# enum of states for progression
PROGRESSTION_STATES = {
    "ready": 0,
    "running": 1,
    "paused": 2,
    "done": 3
}

# progression state can be paused/restarted interactively by the user
progression_state = PROGRESSTION_STATES["ready"]

global userLat
global userLon
global userRange
global userDay
global userMaxDistance

userLat=48.85565
userLon=2.365492
userRange= [60, 90]
c={"lat": 48.85565, "lon": 2.365492, "range": [60, 90], "day": "2020-04-31", "MaxDistance":10+1} #user data for test

global mydb
global DIZ_plotted #all plotted points
DIZ_plotted={}
global IN   #cumulated airb&b ID of points plotted in the user box till the actual chunk
IN=[]
#------------Listener thread: will listen and execute the methods coming from frontend-------
class FrontEndListener(Thread):
   def __init__(self, name):
      Thread.__init__(self)
      self.name = name
   def run(self):
      while True:
          print ("Thread "" + self.name + "" avviato")
          #time.sleep(self.durata)
          print ("Thread "" + self.name + "" terminato")
#------------Listener thread: will listen and execute the methods coming from frontend-------




def sendChunk(chunk):
    eel.send_data_chunk(chunk)
    #print("----------------------", len(chunk), chunk)

def sendRandomChunk(chunk):
    eel.send_random_data_chunk(chunk)
    #print("----------------------", len(chunk), chunk)

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

def dbConnect(h, u, p, d):
    global mydb
    mydb = mysql.connector.connect(
       host=h,
       user=u,
       passwd=p,
       database=d
     )
    return mydb

def aboveMinimum(bbId, actualPrice, lat, long, more, x45, x46): # the search is bound to a
    global floatSaving
    if floatSaving:
        return {"neighborhood_min":5, "saving": x46, "alternativeId":100, "extraSteps":0.1, "vicini":100} #from Ground True abovemF
    else:
        return {"neighborhood_min":5, "saving": x45, "alternativeId":100, "extraSteps":0.1, "vicini":100} #from Ground True abovem

    mycursor = mydb.cursor()
    qq=buildQuery(userLat, userLon, userRange, userDay, queryAtt, "True", chunkSize)
    qq = "SELECT * FROM listings WHERE price>0 and price <="+str(userRange[1])+ " LIMIT 0, "+str(chunkSize)
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    minimo=actualPrice
    minimoX=(bbId,0)
    vicini=0
    for x in myresult:
        if 0 < distance(userLat, userLon, x[10], x[11])-distance(userLat, userLon, lat, long)<=more:
            vicini+=1
            minimo=min(minimo, x[16])
            minimoX=(x[0], distance(userLat, userLon, x[10], x[11])-distance(userLat, userLon, lat, long))
    return {"neighborhood_min": minimo, "saving": actualPrice-minimo, "alternativeId": minimoX[0], "extraSteps": minimoX[1], "vicini": vicini}

def buildQuery(userLat, userLon, userRange, userDay, att, modifier, chunkSize):
    global LIMIT
    SELECT = "SELECT "+att+"  "
    FROM   = "FROM listings "
    WHERE  = "WHERE price >="+str(userRange[0])+" AND price <="+str(userRange[1])+"  AND listings.id NOT IN (SELECT id from plotted ) "
    return SELECT+" "+FROM+" "+ WHERE + " AND "+modifier+" LIMIT 0, "+str(chunkSize)

global actualChunk   #debug
actualChunk={}
global actualChunkRandom  #debug
actualChunkRandom={}

def reset():
    global userSelectionUpdated, totalChunkNumber, totalInb, treeReady, chunkSize
    global modifier, queryAtt, IN, DIZ_plotted

    IN = []
    DIZ_plotted = {}
    userSelectionUpdated = False
    totalChunkNumber = 0
    totalInb = 0
    treeReady = False
    chunkSize = 100
    modifier = "True"
    queryAtt = "*"

def feedTuples(query, chunkSize, minimumBoxItems=50):
    global modifier
    global DIZ_plotted
    global treeReady #it is used to interrupt the main chunking cycle
    global mydb
    global totalInb
    global totalChunkNumber
    global userSelectionUpdated
    global progression_state
    global PROGRESSTION_STATES
    global doubleSending
    doubleSending=True


######################## WAIT selection loop


    def processResult(chunks, myresult, mycursor, state):
         global modifier
         global DIZ_plotted
         global treeReady #it is used to interrupt the main chunking cycle
         global mydb
         global totalInb
         global totalChunkNumber
         global userSelectionUpdated
         global actualChunk
         global lastSelectedItems
         chunks+=1
         actualChunk={}
         for x in myresult:
             #print("X40s****", x[40:], aboveMinimum(x[0], x[16], userLat, userLon,0.5), x[45])
             mycursor.execute("INSERT INTO plotted (id) VALUES (" +str(x[0])+")")
             mydb.commit()

             DIZ_plotted[x[0]]={
                "host_id": x[0],
                "state": state,
                "zipcode": x[7],
                "latitude": x[10],
                "longitude": x[11],
                "accommodates": x[12],
                "bathrooms": x[13],
                "bedrooms": x[14],
                "beds": x[15],
                "price": x[16],
                "cleaning_fee": x[18],
                "minimum_nights": x[21],
                "maximum_nights": x[22],
                "dist2user": distance(userLat, userLon, x[10], x[11]),
                "aboveM": aboveMinimum(x[0], x[16], userLat, userLon,0.3, x[45], x[46]),
                "chunk": chunks,
                "inside":0
            }

             actualChunk[x[0]]={
                "chunk": chunks,
                "state": state,
                "values": DIZ_plotted[x[0]],
                "dist2user": distance(userLat, userLon, x[10], x[11]),
                "aboveM": aboveMinimum(x[0], x[16], userLat, userLon,0.3, x[45], x[46])
            }

             eel.sleep(0.001)

         sendChunk(actualChunk)
         eel.sleep(0.04)
         inb=0

         for k in DIZ_plotted:
             if DIZ_plotted [k]["inside"]==1 and DIZ_plotted [k]["chunk"]==chunks:
                 inb+=1

         totalInb+=inb
         #totalInb+=len(lastSelectedItems)
         print("chunk: ", chunks, state, "Items in box: ", totalInb, "Precision: ", inb/chunkSize, inb, distances())

         eel.send_evaluation_metric({"name": "precision", "value": inb/chunkSize})
         eel.send_evaluation_metric({"name": "recall", "value": totalInb})

         mycursor.execute(query)
         myresult = mycursor.fetchall()
         #pmodifier="("+sm.getSteeringCondition(DIZ_plotted)+")"
         #print("----------------------------potential modifier at chunk: ", chunks, pmodifier)
         return chunks, myresult, mycursor

    def processRandomResult(chunksRandom, myresultRandom, state):
         global actualChunkRandom
         global rightID

         state="random_("+state+")"

         actualChunkRandom={}

         for x in myresultRandom[chunksRandom*chunkSize:(chunksRandom+1)*chunkSize]:
            actualChunkRandom[x[0]]={
                "chunk": chunks,
                "state": state,
                "values": {
                    "host_id": x[0],
                    "state": state,
                    "zipcode": x[7],
                    "latitude": x[10],
                    "longitude": x[11],
                    "accommodates": x[12],
                    "bathrooms": x[13],
                    "bedrooms": x[14],
                    "beds": x[15],
                    "price": x[16],
                    "cleaning_fee": x[18],
                    "minimum_nights": x[21],
                    "maximum_nights": x[22],
                    "dist2user": distance(userLat, userLon, x[10], x[11]),
                    "aboveM": aboveMinimum(x[0], x[16], userLat, userLon,0.3, x[45], x[46]),
                    "chunk": chunks,
                    "inside":0
                },
                "dist2user": distance(userLat, userLon, x[10], x[11]),
                "aboveM": aboveMinimum(x[0], x[16], userLat, userLon, 0.3, x[45], x[46])
            }
            eel.sleep(0.001)

         sendRandomChunk(actualChunkRandom)
         #rightID=rightID.union(set(actualChunkRandom.keys()))
         eel.sleep(0.04)

    while progression_state == PROGRESSTION_STATES["ready"]:
        eel.sleep(1)

    # init database
    mydb=dbConnect("localhost", "root", USER_PW, "airbnb")
    mycursor = mydb.cursor()
    mycursor.execute("DELETE FROM plotted")
    mydb.commit()
    chunks=0
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    if doubleSending: #compute the whole results
        queryA=query.replace("AND True LIMIT 0,100", "")
        queryA=query[0: query.find("LIMIT")]
        mycursor.execute(queryA)
        myresultRandom = mycursor.fetchall()
        #print("query: ", queryA, len(myresultA))


    global leftID
    global rightID
    leftID=set({})
    rightID=set({})
####################### COLLECTING DATA NO TREE °°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°
    print("Entering LOOP1 - Query: ", query, modifier)
    print("c", c)
    print(query)
    totalInb=0
    state="collectingData" #"usingTree" "flushing" "empty"
    while len(myresult)>0 and (not treeReady or totalInb<minimumBoxItems or len(modifier)<=3):
        if progression_state == PROGRESSTION_STATES["paused"]:
            print("paused ...")
            eel.sleep(1)
        elif progression_state == PROGRESSTION_STATES["ready"]:
            print("restarting ...")
            return
        else:
            chunks, myresult, mycursor=processResult(chunks, myresult, mycursor, state)
            if doubleSending:
                processRandomResult(chunks, myresultRandom, state)
    print("uscito loop 1")#" treeready=", treeReady, "modifier=", modifier)
    totalChunkNumber=chunks
########################## USING TREE ∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞
    state="usingTree"
    #print(len(myresult)>0 and (not treeReady or totalInb<minimumBoxItems or len(modifier)<=3), totalInb)
    #print(len(myresult)>0, treeReady, totalInb<minimumBoxItems, len(modifier)<=3)
    #pippo
    query=buildQuery(userLat, userLon, userRange, userDay, queryAtt, modifier, chunkSize)
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    print("Entering LOOP2 - Query: ", query, len(myresult))
    while len(myresult)>0:
        if progression_state == PROGRESSTION_STATES["paused"]:
            print("paused ...")
            eel.sleep(1)
        elif progression_state == PROGRESSTION_STATES["ready"]:
            print("restarting ...")
            return
        else:
            chunks, myresult, mycursor=processResult(chunks, myresult, mycursor, state)
            if doubleSending:
                processRandomResult(chunks, myresultRandom, state)
    print("uscito loop 2 treeready=", treeReady, "modifier=", modifier)
    totalChunkNumber=chunks
######################### FLUSHING °°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°
    state="flushing"
    modifier="True"
    query=buildQuery(userLat, userLon, userRange, userDay, queryAtt, modifier, chunkSize)
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    #print("Entering LOOP3 - Query: ", query, "Precision: ", getPrecision(DIZ_plotted)/chunks)
    while len(myresult)>0:
        if progression_state == PROGRESSTION_STATES["paused"]:
            print("paused ...")
            eel.sleep(1)
        elif progression_state == PROGRESSTION_STATES["ready"]:
            print("restarting ...")
            return
        else:
            chunks, myresult, mycursor=processResult(chunks, myresult, mycursor, state)
            if doubleSending:
                processRandomResult(chunks, myresultRandom, state)
    print("uscito loop 3 treeready=")#, treeReady, "modifier=", modifier)
    totalChunkNumber=chunks
#######################################################################################

def start_progression():
    global progression_state

    while True:
        reset()
        sql=buildQuery(userLat, userLon, userRange, userDay, queryAtt, modifier, chunkSize)
        progression_state = PROGRESSTION_STATES["ready"]
        eel.spawn(feedTuples(sql, chunkSize))


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
  global userLat
  global userLon
  global userRange
  global userDay
  global userMaxDistance
  c={"lat": 48.85565, "lon": 2.365492, "range": [60, 90], "day": "2020-04-31", "MaxDistance":10+1}
  print("received user selection", c)

  userLat=x["lat"]
  userLon=x["lon"]
  userRange=x["moneyRange"]
  userDay=x["day"]
  userMaxDistance=x["userMaxDistance"]

  userLat=c["lat"]
  userLon=c["lon"]
  userRange=c["range"]
  userDay=c["day"]
  userMaxDistance=c["MaxDistance"]

  # send parameters to frontend before sending data
  eel.send_city("Paris")
  eel.set_x_name("Saving opportunity")
  eel.set_y_name("Distance")
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": -1, "max": 2+userRange[1]-userRange[0]})
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
def send_user_selection(selected_items):
    global lastSelectedItems
    #exmaple of selections by user [22979, 219871, 215638, 111155, 278842]
    global DIZ_plotted
    global modifier
    global treeReady
    global IN

    if len(selected_items)==0:
        return(0)

    lastSelectedItems=selected_items.copy()
    print("new", len(selected_items), "items received...", selected_items)
    for k in selected_items:
        #print("k=", k)
        DIZ_plotted[k]["inside"]=1
    IN.extend(selected_items)
    #print("new selected items received", selected_items)

    eel.sleep(0.01)

    if not treeReady or True:
        modifier="("+sm.getSteeringCondition(DIZ_plotted)+")"
        if len(modifier)>3:
            treeReady=True
            #print("New modifier: ", modifier)
        else:
            #print("Wrong empty modifier: ", modifier)
            modifier="True"
    return modifier

@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    global X1, X2, Y1, Y2
    global totalInb
    global DIZ_plotted
    global userSelectionUpdated
    global lastSelectedItems

    print("new selected region received bounds", x_bounds, y_bounds)
    X1=x_bounds["xMin"]
    X2=y_bounds["yMin"]
    Y1=y_bounds["yMax"]
    Y2=x_bounds["xMax"]

    totalInb=0
    for k in DIZ_plotted:
        DIZ_plotted[k]["inside"]=0
        if k in lastSelectedItems:
            DIZ_plotted[k]["inside"]=1
            totalInb+=1

    userSelectionUpdated=True
    return x_bounds, y_bounds

@eel.expose
def send_selection_bounds_values(x_bounds_val, y_bounds_val):
    global totalInb
    global DIZ_plotted
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

    print("new progression state", progression_state)

def boxData(testCase):
    mydb=dbConnect("localhost", "root", USER_PW, "airbnb")
    mycursor = mydb.cursor()
    global userRange
    mycursor = mydb.cursor()
    qq = str("SELECT * FROM listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1])+" and abovemF<="+str(testCase["boxMaxRange"])+
             " and abovemF>="+str(testCase["boxMinRange"]) +" and distance>="+str(testCase["boxMinDistance"])+" and distance<="+str(testCase["boxMaxDistance"]))
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    tuplesF=len(myresult)

    qq = str("SELECT * FROM listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1])+" and abovem<="+str(testCase["boxMaxRange"])+
             " and abovem>="+str(testCase["boxMinRange"]) +" and distance>="+str(testCase["boxMinDistance"])+" and distance<="+str(testCase["boxMaxDistance"]))
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    tuples=len(myresult)
    mydb.close()
    return tuples, tuplesF

def loadConfig():
    global floatSaving
    global testCases
    s=eval(open("DB_server_config.txt", encoding="UTF8").read())
    floatSaving=s["floatSaving"]
    testCases=eval(open("testCases.txt", encoding="UTF8").read())
    print("Configuration loaded")
    print("floatSaving: ", floatSaving)
    print("testCases loaded")
    for i in range(len(testCases)):
        t=boxData(testCases[i])
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
    #eel.say_hello_js("Python World!")   # Call a JavaScript function (must be after `eel.init()`)

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

    #while True:
    #    print("I"m a main loop")
    #    eel.sleep(1.0)
def obtainTuples(arrayID):
    result=[]
    for elem in arrayID:
        result.append(DIZ_plotted[elem])
    return result

def my_other_thread():
    while True:
        print("I'm a thread")
        #eel.sleep(1.0)

def insideUserBox():
    tot=0
    for k in DIZ_plotted:
        if DIZ_plotted[k]["inside"]==1:
            tot+=1
    return tot

def distances():
    global DIZ_plotted
    mind=100
    maxd=0
    for k in DIZ_plotted:
        if DIZ_plotted[k]["dist2user"]>maxd and DIZ_plotted[k]["inside"]==1:
            maxd=DIZ_plotted[k]["dist2user"]
        if DIZ_plotted[k]["dist2user"]<mind and DIZ_plotted[k]["inside"]==1:
            mind=DIZ_plotted[k]["dist2user"]
    return mind, maxd

def numberOfPlottedPoints(chunks):
    inb=0
    for k in DIZ_plotted:
        if DIZ_plotted [k]["inside"]==1 and DIZ_plotted [k]["chunk"]==chunks:
            inb+=1
    return inb

def history():
    totalInbox=0
    for chunks in range(1, totalChunkNumber):
        inb=0
        for k in DIZ_plotted:
            if DIZ_plotted [k]["inside"]==1 and DIZ_plotted [k]["chunk"]==chunks:
                inb+=1
        totalInbox+=inb
        print("Chunk: ", chunks, "Items in box: ", totalInbox, "Precision: ", inb/chunkSize, totalInbox)


if __name__ == "__main__":
    import sys
    loadConfig()

    #feThread=FrontEndListener("fethread")
    #feThread.start()
    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)


