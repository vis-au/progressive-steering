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

totalChunkNumber=0
totalInB=0
treeReady=False
chunkSize=100
modifier='True'
queryAtt='*'
USER_PW = 'password' # configure according to MySQL setup

global userLat
global userLon
global userRange
global userDay
global userMaxDistance

c={'lat': 48.85565,'lon': 2.365492,'range': [60, 90],'day': '2020-04-31','MaxDistance':10+1} #user data for test

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
          print ("Thread '" + self.name + "' avviato")
          #time.sleep(self.durata)
          print ("Thread '" + self.name + "' terminato")
#------------Listener thread: will listen and execute the methods coming from frontend-------

def sendChunk(chunk):
    eel.send_data_chunk(chunk)
    #print('----------------------',len(chunk),chunk)

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

def dbConnect(h,u,p,d):
    global mydb
    mydb = mysql.connector.connect(
       host=h,
       user=u,
       passwd=p,
       database=d
     )
    return mydb

def aboveMinimum(bbId,actualPrice,lat,long,more): # the search is bound to a
    mycursor = mydb.cursor()
    qq=buildQuery(userLat,userLon,userRange,userDay,queryAtt,'True',chunkSize)   
    qq = "SELECT * FROM listings WHERE price>0 and price <="+str(userRange[1])+ " LIMIT 0,100"
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    minimo=actualPrice
    minimoX=(bbId,0)
    vicini=0
    for x in myresult:
        if 0 < distance(userLat,userLon,x[10],x[11])-distance(userLat,userLon,lat,long)<=more:
            vicini+=1
            minimo=min(minimo,x[16])
            minimoX=(x[0],distance(userLat,userLon,x[10],x[11])-distance(userLat,userLon,lat,long))
    return {"neighborhood_min":minimo,"saving":actualPrice-minimo,"alternativeId":minimoX[0],"extraSteps":minimoX[1],'vicini':vicini}

def buildQuery(userLat,userLon,userRange,userDay,att,modifier,chunkSize):
    global LIMIT
    SELECT = "SELECT "+att+"  "
    FROM   = "FROM listings "
    WHERE  = "WHERE price >="+str(userRange[0])+" AND price <="+str(userRange[1])+"  AND listings.id NOT IN (SELECT id from plotted ) "
    return SELECT+' '+FROM+' '+ WHERE + ' AND '+modifier+' LIMIT 0,'+str(chunkSize)

def feedTuples(query,chunkSize):
    global modifier
    global DIZ_plotted
    global treeReady #it is used to interrupt the main chunking cycle
    global mydb
    global totalInb
    global totalChunkNumber
    
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')    
    mycursor = mydb.cursor()
    mycursor.execute('DELETE FROM plotted')
    mydb.commit()
    chunks=0
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    
        
####################### COLLECTING DATA NO TREE °°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°  
    print('Entering LOOP1 - Query:',query,modifier)
    print('c',c)
    print(query)
    totalInb=0
    while len(myresult)>0 and not treeReady or totalInb<200:
         chunks+=1
         actualChunk={}
         for x in myresult:
             mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
             DIZ_plotted[x[0]]={'host_id':x[0],'state':'collecting data', 'zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5),'chunk':chunks,'inside':0}
             actualChunk[x[0]]={'chunk':chunks,'state':'collecting data','values':x, 'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5)}
             mydb.commit()
             eel.sleep(0.001)
         sendChunk(actualChunk)    
         eel.sleep(0.04)
         inb=0
         for k in DIZ_plotted:
             if DIZ_plotted [k]['inside']==1 and DIZ_plotted [k]['chunk']==chunks:
                 inb+=1
         totalInb+=inb
         print('Collecting data-chunk:',chunks ,'Items in box:',totalInb, 'Precision:',inb/chunkSize, inb,distances())
         eel.send_evaluation_metric({"name":"precision","value":inb/chunkSize})       
         eel.send_evaluation_metric({"name":"recall","value":totalInb/1441})
         mycursor.execute(query)
         myresult = mycursor.fetchall() 
    print('uscito loop 1 treeready=',treeReady,'modifier=',modifier)    
    totalChunkNumber=chunks
########################## USING TREE ∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞ 
    modifier="("+sm.getSteeringCondition(DIZ_plotted)+")"
    print(modifier)
    query=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,chunkSize)
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    #print('Entering LOOP2 - Query:',query)   
    while len(myresult)>0:
        chunks+=1
        actualChunk={}
        for x in myresult:
            mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
            DIZ_plotted[x[0]]={'host_id':x[0], 'state':'using tree','zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5),'chunk':chunks,'inside':0}
            actualChunk[x[0]]={'chunk':chunks,'state':'using tree','values':x, 'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5)}
            mydb.commit()
            eel.sleep(0.001)
        sendChunk(actualChunk)
        eel.sleep(0.04)
        inb=0
        for k in DIZ_plotted:
             if DIZ_plotted [k]['inside']==1 and DIZ_plotted [k]['chunk']==chunks:
                 inb+=1
        totalInb+=inb
        print('Using tree-chunk:',chunks ,'Items in box:',totalInb, 'Precision:',inb/chunkSize, inb,distances())
        eel.send_evaluation_metric({"name":"precision","value":inb/chunkSize}) 
        eel.send_evaluation_metric({"name":"recall","value":totalInb/1441})
        mycursor.execute(query)
        myresult = mycursor.fetchall()
    #print('uscito loop 2 treeready=',treeReady,'modifier=',modifier)
    totalChunkNumber=chunks
######################### FLUSHING °°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°    
    modifier='True'
    query=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,chunkSize)
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    #print('Entering LOOP3 - Query:',query,'Precision:',getPrecision(DIZ_plotted)/chunks)   
    while len(myresult)>0:
         chunks+=1
         actualChunk={}
         for x in myresult:
           mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
           DIZ_plotted[x[0]]={'host_id':x[0], 'state':'flushing','zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5),'chunk':chunks,'inside':0}       
           actualChunk[x[0]]={'chunk':chunks,'state':'flushing','values':x, 'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5)}
           mydb.commit()
           eel.sleep(0.001)
         sendChunk(actualChunk)
         eel.sleep(0.04)
         inb=0
         totalInb=0
         for k in DIZ_plotted:
             if DIZ_plotted [k]['inside']==1 and DIZ_plotted [k]['chunk']==chunks:
                 inb+=1
             if DIZ_plotted [k]['inside']==1:
                 totalInb+=1
         print('flushing-chunk: ',chunks ,'Items in box:',totalInb, 'Precision:',inb/chunkSize,distances())
         eel.send_evaluation_metric({"name":"precision","value":inb/chunkSize}) 
         eel.send_evaluation_metric({"name":"recall","value":totalInb/1441})
         mycursor.execute(query)
         myresult = mycursor.fetchall()
    print('uscito loop 3 treeready=',treeReady,'modifier=',modifier)
    totalChunkNumber=chunks
#######################################################################################

@eel.expose
def start():
    sql=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,chunkSize)
    eel.spawn(feedTuples(sql,chunkSize))

@eel.expose
def get_use_cases():
    return {'testcase1':{'name':'case1_0_3_7_9','x_bounds' : [0,3], 'y_bounds':[7,9]}}

@eel.expose
def send_to_backend_userData(x):
  global userLat
  global userLon
  global userRange
  global userDay
  global userMaxDistance
  c={'lat': 48.85565,'lon': 2.365492,'range': [60, 90],'day': '2020-04-31','MaxDistance':10+1}
  print("received user selection",c)

  userLat=x['lat']
  userLon=x['lon']
  userRange=x['moneyRange']
  userDay=x['day']
  userMaxDistance=x['userMaxDistance']
  
  userLat=c['lat']
  userLon=c['lon']
  userRange=c['range']
  userDay=c['day']
  userMaxDistance=c['MaxDistance']

  # send parameters to frontend before sending data
  eel.send_city("Paris")
  eel.set_x_name("Saving opportunity")
  eel.set_y_name("Distance")
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": 0, "max": x['moneyRange'][1]-8})
  eel.send_dimension_total_extent({"name": "Distance", "min": 0, "max": 15})

  #eel.set_min_selection_size({"name": "Saving opportunity", "min": 0, "max": x["moneyRange"][1]-["moneyRange"][0]})

  sql=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,chunkSize)
  eel.spawn(feedTuples(sql,chunkSize))
  #eel.spawn(my_other_thread())
  #feedTuples(sql,10)

@eel.expose
def send_user_selection(selected_items):
    #exmaple of selections by user [22979, 219871, 215638, 111155, 278842]
    global DIZ_plotted
    global modifier
    global treeReady
    global IN
    for k in selected_items:
        #print('k=',k)
        DIZ_plotted[k]['inside']=1
    IN.extend(selected_items)
    #print("new selected items received",selected_items)
    
    if len(selected_items)==0:
        print('Ignoring empty selection')
        return 0
    eel.sleep(0.01)

    if not treeReady:
        modifier="("+sm.getSteeringCondition(DIZ_plotted)+")"
        if len(modifier)>3:
            treeReady=True           
            print('New modifier:',modifier)
        else:
            #print('Wrong empty modifier:',modifier)
            modifier='True'
    return modifier

@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    global totalInb
    global DIZ_plotted
    print("new selected region received bounds",x_bounds, y_bounds)
    '''
    for k in DIZ_plotted:
        DIZ_plotted[k]['inside']=0
    totalInb=0
    '''
    return x_bounds, y_bounds

@eel.expose
def send_selection_bounds_values(x_bounds_val, y_bounds_val):
    global totalInb
    global DIZ_plotted
    print("new selected region received_pixel",x_bounds_val, y_bounds_val)
    '''
    for k in DIZ_plotted:
        DIZ_plotted[k]['inside']=0
    totalInb=0
    '''
    return x_bounds_val, y_bounds_val

@eel.expose
def send_user_params(parameters):
    print("new user parameters received")

def start_eel(develop):
    """Start Eel with either production or development configuration."""
    
    print(develop)

    if develop:
        directory = '../frontend/src'
        app = None
        page = {'port': 3000}
    else:
        directory = 'build'
        app = 'chrome-app'
        page = 'index.html'

    
    eel.init(directory, ['.tsx', '.ts', '.jsx', '.js', '.html'])

    print('Backend launched successfully. Waiting for requests ...')

    # These will be queued until the first connection is made, but won't be repeated on a page reload
    #eel.say_hello_js('Python World!')   # Call a JavaScript function (must be after `eel.init()`)

    eel_kwargs = dict(
        host='localhost',
        port=8080,
        size=(1280, 800),
    )
    try:
        eel.start(page, mode=None, **eel_kwargs)
    except EnvironmentError:
        # If Chrome isn't found, fallback to Microsoft Edge on Win10 or greater
        if sys.platform in ['win32', 'win64'] and int(platform.release()) >= 10:
            eel.start(page, mode='edge', **eel_kwargs)
        else:
            raise
    
    #while True:
    #    print("I'm a main loop")
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
        if DIZ_plotted[k]['inside']==1:
            tot+=1
    return tot

def distances():
    global DIZ_plotted
    mind=100
    maxd=0
    for k in DIZ_plotted:
        if DIZ_plotted[k]['dist2user']>maxd and DIZ_plotted[k]['inside']==1:
            maxd=DIZ_plotted[k]['dist2user']
        if DIZ_plotted[k]['dist2user']<mind and DIZ_plotted[k]['inside']==1:
            mind=DIZ_plotted[k]['dist2user']
    return mind,maxd 

def numberOfPlottedPoints(chunks):
    inb=0
    for k in DIZ_plotted:
        if DIZ_plotted [k]['inside']==1 and DIZ_plotted [k]['chunk']==chunks:
            inb+=1 
    return inb

def history():
    totalInb=0
    for chunks in range(1, totalChunkNumber):
        inb=0
        for k in DIZ_plotted:
            if DIZ_plotted [k]['inside']==1 and DIZ_plotted [k]['chunk']==chunks:
                inb+=1 
        totalInb+=inb
        print('Chunk: ',chunks ,'Items in box:',totalInb, 'Precision:',inb/chunkSize, totalInb)
    

if __name__ == '__main__':
    import sys
    
    #feThread=FrontEndListener("fethread")
    #feThread.start()
    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
     
  
