#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Mon Mar 16 17:41:31 2020

@author: beppes
"""


import math
import platform
import sys
import steering_module as sm
import eel
import evaluationMetrics as mm




#simple sync with Steering module
global modifier
global queryAtt
global treeReady #it is used to interrupt the main chunking cycle
global bBox

global X
global y
treeReady=False

global floatSaving

modifier='True'
queryAtt='*'

USER_PW = 'password' # configure according to MySQL setup



global userLat
global userLon
userLat=48.85565
userLon=2.365492

global userRange
userRange= [60, 90]

global userDay
userDay= '2020-04-31'
global userMaxDistance
userMaxDistance=10



global plotted
global mydb

DIZ_plotted={}

global x  #debug

def dbConnect(h,u,p,d):
    global mydb
    mydb = mysql.connector.connect(
       host=h,
       user=u,
       passwd=p,
       database=d
     )
    return mydb

def boxData(testCase): # Computes thetotal number of tuples in the box using both integer (tuples) and float (tuplesF) X values
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()
    global userRange
    mycursor = mydb.cursor() 
    qq = str("SELECT * FROM listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1])+" and abovemF<="+str(testCase['boxMaxRange'])+
             " and abovemF>="+str(testCase['boxMinRange']) +" and distance>="+str(testCase['boxMinDistance'])+" and distance<="+str(testCase['boxMaxDistance']))
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    tuplesF=len(myresult)
    
    qq = str("SELECT * FROM listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1])+" and abovem<="+str(testCase['boxMaxRange'])+
             " and abovem>="+str(testCase['boxMinRange']) +" and distance>="+str(testCase['boxMinDistance'])+" and distance<="+str(testCase['boxMaxDistance']))
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    tuples=len(myresult)    
    mydb.close()
    return tuples,tuplesF
    

def aboveMinimum(bbId,actualPrice,lat,long,more,myresult): #,chunkSize)
    '''
    mycursor = mydb.cursor()  
    #qq = "SELECT * FROM listings WHERE price>0 and price <="+str(userRange[1])+" LIMIT 0,100" #not related with chunkSize
    qq = "SELECT id,latitude,longitude,price FROM listings WHERE price>=0 and price <="+str(userRange[1])#+" LIMIT 0,100" #not related with chunkSize
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    '''
    minimo=actualPrice
    minimoX=(bbId,0)
    vicini=0
    for x in myresult:
        #if 0 < distance(userLat,userLon,x[1],x[2])-distance(userLat,userLon,lat,long)<=more:
        #print(lat,long,x[1],x[2])
        if distance(lat,long,x[1],x[2])<=more and bbId!=x[0]:
            vicini+=1
            #print(x[3])
            if x[3]<minimo:
                minimo=x[3]
                minimoX=(x[0],distance(lat,long,x[1],x[2]))
    delta=2*minimoX[1]/more            
    return {"neighborhood_min":minimo,"saving":(actualPrice-minimo),"savingf":max((actualPrice-minimo)+delta-1,0),"alternativeId":minimoX[0],"extraSteps":minimoX[1],'vicini':vicini}

def enrich_DB(lat=userLat,lon=userLon):
    global x  #debug
    global userRange
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()

    query="Delete from listings where price=0"
    mycursor.execute(query)
    
    try:
        query="ALTER TABLE listings ADD distance float"   
        mycursor.execute(query)
    except:
        pass
    
    try:
        query="ALTER TABLE listings ADD abovem int"   
        mycursor.execute(query)
    except:
        pass
    
    try:
        query="ALTER TABLE listings ADD abovemF float"   
        mycursor.execute(query)
    except:
        pass
    
    mydb.commit()
    dbCopy={}
    
    
    query="Select id,latitude,longitude,price from listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1]) #LIMIT 0,50"
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    i=0
    xx=[0,0,0]
    for x in myresult:      
        xx[0]=distance(lat,lon,x[1],x[2],0)
        xx[1]=aboveMinimum(x[0],x[3],x[1],x[2],0.3,myresult)['saving']
        xx[2]=aboveMinimum(x[0],x[3],x[1],x[2],0.3,myresult)['savingf']
        dbCopy[x[0]]=xx.copy()
        i+=1
        #print(xx, '|',x[0],x[16],lat,lon)
        if i%1000==0:
            print(i,len(myresult),x[0],x[3],x[1],x[2],xx,aboveMinimum(x[0],x[3],x[1],x[2],0.3,myresult))

    i=0
    for id in dbCopy:    
        query="Update listings set distance="+str(dbCopy[id][0])+", abovem="+str(dbCopy[id][1])+", abovemF="+str(dbCopy[id][2])+" WHERE id="+str(id)
        #print(query)
        mycursor.execute(query)
        i+=1
        if i%1000==0:
            print('*',i,len(myresult))
    mydb.commit()
    mydb.close()

c={'lat': 48.85565,'lon': 2.365492,'range': [60, 90],'day': '2020-04-31','MaxDistance':10+1}


def testGenerator(tuplesOnly=False,userPref=c):
    global treeReady
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()
    query="Select * from listings WHERE "+str(c['range'][0])+"<=price AND "+str(c['range'][1])+">=price "
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    GT={}
    for x in myresult:
        GT[x[0]]=0

    testCases=eval(open("testCases.txt",encoding="UTF8").read())   
    
    testCases=[{'boxMinRange': 18.243314313223365, 'boxMaxRange': 20.06614785165546, 'boxMinDistance': 3.407266746723863, 
                'boxMaxDistance': 5.035010716235203, 'tuples': 1164, 'tuplesF': 547}]
    
    
    '''          
    testCases=[{'boxMinRange':15, 'boxMaxRange':30,'boxMinDistance':3, 'boxMaxDistance':12, 'tuples':5972},           #4742 abovemF float savings   
           {'boxMinRange':25, 'boxMaxRange':30,'boxMinDistance':0, 'boxMaxDistance':4,  'tuples':3320},
           {'boxMinRange':29, 'boxMaxRange':30,'boxMinDistance':1, 'boxMaxDistance':2,  'tuples':696},
           {'boxMinRange':10, 'boxMaxRange':20,'boxMinDistance':0, 'boxMaxDistance':3,  'tuples':4580},
           {'boxMinRange':1.2,   'boxMaxRange':50.15,'boxMinDistance':3.16, 'boxMaxDistance':3.9,  'tuples':2934},
           {'boxMinRange':37.69, 'boxMaxRange':38.38,'boxMinDistance':1.78, 'boxMaxDistance':2.71, 'tuples':0},
           {'boxMinRange':11.37, 'boxMaxRange':22.57,'boxMinDistance':5.71, 'boxMaxDistance':6.19, 'tuples':262}]
    '''
    
    i=0
    f=open("AA_File_Name_Doc.txt",'w',encoding="UTF8")
    print("Filename=n_x1_x2_x3_x4_x5_x6_x7",file=f)
    print("n : testcase",file=f)
    print("x1: chunkSize",file=f)
    print("x2: minimumBoxItems",file=f)
    print("x3: boxMinRange",file=f)
    print("x4: boxMaxRange",file=f)
    print("x5: boxMinDistance",file=f)
    print("x6: boxMaxDistance",file=f)
    print("x7: number of tuples",file=f)
    f.close()
                            
    for tc in testCases:
        i+=1
        log={}
        boxMinRange=tc['boxMinRange']
        boxMaxRange=tc['boxMaxRange']
        boxMinDistance=tc['boxMinDistance']
        boxMaxDistance=tc['boxMaxDistance']
        tuples=tc['tuples']
        
        for minimumBoxItems in [50]:#[20,40,60,80]:
            for chunkSize in [100]:#[50,100]: 
                treeReady=False
                for k in GT:
                    GT[k]=0
                query="Select * from listings WHERE " 
                if floatSaving:
                    query+="price >="+str(userPref['range'][0])+" AND price <="+str(userPref['range'][1])+ " AND distance >="+str(boxMinDistance)+" AND distance <="+str(boxMaxDistance)+" AND abovemF >="+str(boxMinRange)+" AND abovemF <="+str(boxMaxRange) 
                else:
                    query+="price >="+str(userPref['range'][0])+" AND price <="+str(userPref['range'][1])+ " AND distance >="+str(boxMinDistance)+" AND distance <="+str(boxMaxDistance)+" AND abovem >="+str(boxMinRange)+" AND abovem <="+str(boxMaxRange) 
                mycursor.execute(query)
                myresult = mycursor.fetchall()
                for x in myresult:
                    GT[x[0]]=1  
                IN={}
                OUT={}
                for k in GT:
                    if GT[k]==1:
                        IN[k]=1
                    else:
                        OUT[k]=0
                tuples=len(IN)
                print(query,"tuples",tuples)
                if tuplesOnly:
                    continue
            
                print('x range : ',boxMinRange,boxMaxRange,'y range :', boxMinDistance,boxMaxDistance,'GT:', len(GT),'INbox:',len(IN), 'Out:', len(OUT))
                log[i]={'GT':GT,'boxMinRange':boxMinRange,'boxMaxRange':boxMaxRange,'boxMinDistance':boxMinDistance,'boxMaxDistance':boxMaxDistance,'price':userPref['range'],'tuples':tuples,'chunks':[]}
                
                
                logFileName='log_'+str(i)+'_'+str(chunkSize)+'_'+str(minimumBoxItems)
                logFileName='log_'+str(i)+'_'+str(chunkSize)+'_'+str(minimumBoxItems)+'_'+str(boxMinRange)+'_'+str(boxMaxRange)+'_'+str(boxMinDistance)+'_'+str(boxMaxDistance)+'_'+str(tuples)
                if floatSaving:
                    logFileName+='_FLOAT'
                
                print(logFileName)
     
                logM={}
                logM={'totalQueryElements':len(GT),'totalIN':len(IN),'totalOUT':len(OUT),'chunks':{}}
                doRun(GT,IN,OUT,userPref,log[i]['chunks'],logM['chunks'],minimumBoxItems,chunkSize,True) #using tree
                
                f=open(logFileName+'_M_usingTree.txt','w',encoding="UTF8")       
                print(str(logM),file=f)             
                f.close()
                
                '''                             
                f=open(logFileName+'_L_usingTree.txt','w',encoding="UTF8")       
                print(str(log),file=f)
                f.close()
                
                f=open(logFileName+'_DIZ_Plotted_usingTree.txt','w',encoding="UTF8")       
                print(str(DIZ_plotted),file=f)             
                f.close()                               
                '''
              
                logM={'totalQueryElements':len(GT),'totalIN':len(IN),'totalOUT':len(OUT),'chunks':{}}
                doRun(GT,IN,OUT,userPref,log[i]['chunks'],logM['chunks'],minimumBoxItems,chunkSize,False) #not using tree
                
                f=open(logFileName+'_M_NOT_usingTree.txt','w',encoding="UTF8")       
                print(str(logM),file=f)             
                f.close() 
                '''                              
                f=open(logFileName+'_L_NOT_usingTree.txt','w',encoding="UTF8")       
                print(str(log),file=f)
                f.close()
                f=open(logFileName+'_DIZ_Plotted_NOT_usingTree.txt','w',encoding="UTF8")       
                print(str(DIZ_plotted),file=f)             
                f.close
                '''
    if tuplesOnly:
        return {},{},{},{},{}
    else:        
        return log,logM,GT,IN,OUT


def doRun(GT,IN,OUT,case,log,logM,minimumBoxItems,chunkSize,useTree):
    sql=buildQuery(case['lat'],case['lon'],case['range'],case['day'],queryAtt,modifier,chunkSize)
    feedTuples(len(IN),case,sql,log,logM,useTree,minimumBoxItems,chunkSize,GT,IN,OUT)   
    pass

def sendChunk(chunk):
    #eel.send_data_chunk(chunk) ##################################################
    #print('----------------------',len(chunk),chunk)
    pass
global cos
def distance(lat1, long1, lat2, long2, sleep=0.001):
    if lat1==lat2 and long1==long2:
        return 0
    global cos
    #print(lat1,long1,lat2,long2)
    degrees_to_radians = math.pi/180.0
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
    theta1 = long1*degrees_to_radians
    theta2 = long2*degrees_to_radians

    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) + math.cos(phi1)*math.cos(phi2))
    arc = math.acos( cos )
    #time.sleep(sleep)
    return int(arc * 6371*1000)/1000




def buildQuery(userLat,userLon,userRange,userDay,att,modifier,chunkSize,useLimit=True):
    global LIMIT
    SELECT = "SELECT "+att+"  "
    FROM   = "FROM listings "
    WHERE  = "WHERE price >="+str(userRange[0])+" AND price <="+str(userRange[1])+"  AND listings.id NOT IN (SELECT id from plotted ) "
    #LIMIT  = "LIMIT 0,50"
    if useLimit:
        return SELECT+' '+FROM+' '+ WHERE + ' AND '+modifier+' LIMIT 0,'+str(chunkSize)
    else:     
        return SELECT+' '+FROM+' '+ WHERE + ' AND '+modifier+' '



global x
global qquery
            
global actualChunk
global chunksLog
global actualHistDiz
global totalDiz
def feedTuples(tuples,case,query,log,logM,useTree,minimumBoxItems,chunkSize,GT=None,IN=None,OUT=None):
    global modifier
    global DIZ_plotted
    global treeReady #it is used to interrupt the main chunking cycle
    global x
    global qquery
    global actualChunk
    global chunksLog
    global actualHistDiz
    global totalDiz
    chunksLog={}
    log.append(chunksLog)
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    
    mycursor = mydb.cursor()
    mycursor.execute('DELETE FROM plotted')
    mydb.commit()
    plotted=0
    chunks=0
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    print('Entering LOOP1 - Query:',query,modifier)
    INplotted={}
    OUTplotted={}
    chunksDIZ={}
    DIZ_plotted={}
    state='collectingData' #'usingTree' 'flushing' 'empty'
    prefisso="Random"
    if useTree:
        prefisso="Optimized"
    if len(myresult)>0:
        while state != 'empty': #len(myresult)>0:#not treeReady or True:
             chunks+=1
             #if chunks>100:
             #    break
             actualChunk={}
             for x in myresult:
               mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
               DIZ_plotted[x[0]]={'host_id':x[0], 'zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'chunk':chunks,'inside':0}
               actualChunk[x[0]]={'chunk':chunks,'state':state,'values':x, 'dist2user':distance(userLat,userLon,x[10],x[11])}        
               plotted+=1
               #eel.sleep(0.001)
             #sendChunk(actualChunk),more
             mydb.commit()
             chunksDIZ[chunks]=actualChunk.keys()
             actualIn=0
             for k in actualChunk.keys():
                 if k in IN:
                     INplotted[k]=1
                     DIZ_plotted[k]['inside']=1
                     actualIn+=1
                 if k in OUT:
                     OUTplotted[k]=0

             if len(IN)>0:
                 chunksLog[chunks]={'recall':[len(INplotted), len(INplotted)/len(IN)],'IN':list(INplotted.keys()),'OUT':list(OUTplotted.keys()),'actualChunk':list(actualChunk.keys())} 
             #def evaluateResults(actualDiz, totalDiz, totalQueryCardinality)
             actualHistDiz=INplotted
             totalDiz=OUT.copy()
             totalDiz.update(IN)
             if len(IN)>0:
                 #marcoMetrics=mm.evaluateCumulatedResults(actualHistDiz,totalDiz)
                 marcoMetrics=mm.evaluateCumulatedResults(DIZ_plotted,totalDiz)                 
                 logM[chunks]={'state':state,'truePositive':actualIn,'falsePositive':chunkSize-actualIn,'metrics':marcoMetrics}
                 print(prefisso,chunkSize,minimumBoxItems,len(INplotted),'Chunk:',chunks,state, 'PRECISION:', round(actualIn/chunkSize,4),'RECALL:', round(len(INplotted)/tuples,4), 'modifier:',modifier[0:70]+' ...','mm.true_positive:', marcoMetrics['true_positive'])
             if useTree and len(INplotted.keys())>minimumBoxItems and not treeReady:
                 modifier=send_user_selection(list(INplotted.keys()))
                 if len(modifier)==0:
                     modifier='True'
                     treeReady='False'
                 print("!!!!!! TREEE READY !!!!!!")               
                 state='usingTree'
                 query=buildQuery(case['lat'],case['lon'],case['range'],case['day'],queryAtt,modifier,chunkSize)
             else:
                 pass
                 #print('Nel box:',INplotted.keys())      
             mycursor.execute(query)
             myresult = mycursor.fetchall()
             if len(myresult)==0:
                 if state=='collectingData' or state=='flushing':
                     state='empty'
                 elif state=='usingTree': 
                     modifier= ' True '
                     state='flushing'
                     query=buildQuery(case['lat'],case['lon'],case['range'],case['day'],queryAtt,modifier,chunkSize)
                     mycursor.execute(query)
                     myresult = mycursor.fetchall()
                     if len(myresult)==0:
                         state='empty'

        print('plotted',plotted,'tuples in',chunks,'chunks')
        
#@eel.expose #####################################
def send_user_selection(selected_items):
    global DIZ_plotted
    global modifier
    global treeReady
    print("new selected items received",selected_items)
    if len(selected_items)==0:
        print('Ignoring empty selection')
        return 0
    #exmaple of selections by user [22979, 219871, 215638, 111155, 278842]
    for k in selected_items:
        #print('k=',k)
        DIZ_plotted[k]['inside']=1

    if not treeReady:
        modifier="("+sm.getSteeringCondition(DIZ_plotted)+")"
        if len(modifier)>3:
            treeReady=True
            print('New modifier:',modifier)
        else:
            print('Wrong empty modifier:',modifier)
            modifier='True AND True'
            treeReady=False
    return modifier

#@eel.expose #####################################
def send_selection_bounds(x_bounds, y_bounds):
    global bBox
    print("new selected region received",x_bounds, y_bounds)
    bBox=[x_bounds,y_bounds]
    #for k in DIZ_plotted:
    #    DIZ_plotted[k]['inside']=0
    

#@eel.expose #####################################
def send_user_params(parameters):
    print("new user parameters received")

def start_eel(develop):
    """Start Eel with either production or development configuration."""
    
    print(develop)

    if develop:
        directory = '../frontend/src'
        #app = None
        page = {'port': 3000}
    else:
        directory = 'build'
        #app = 'chrome-app'
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

#for log analysis
def dentro():
    global DIZ_plotted
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

def loadConfig():
    global floatSaving
    global testCases
    s=eval(open("DB_server_config.txt",encoding="UTF8").read())
    floatSaving=s['floatSaving']
    testCases=eval(open("testCases.txt",encoding="UTF8").read()) 
    print("Configuration loaded")
    print('floatSaving:',floatSaving)
    print("testCases loaded")
    for i in range(len(testCases)):
        t=boxData(testCases[i])
        testCases[i]['tuples']=t[0]
        testCases[i]['tuplesF']=t[1]
        print(i+1,testCases[i]) 
    f=open("testCases.txt",'w',encoding="UTF8") 
    print(str(testCases).replace('{','\n{'),file=f)
    f.close()
    

'''
fft=eval(open('log_1_100_20_L_usingTree.txt','r',encoding="UTF8").read())
dp=eval(open('log_1_100_100_DIZ_Plotted_usingTree.txt','r',encoding="UTF8").read())

##### dir locale

#dp=eval(open('/Users/beppes/GitHub/progressive-steering/backend/log_1_100_100_DIZ_Plotted_usingTree.txt','r',encoding="UTF8").read())
#dpk=list(dp.keys())
#print(dp[dpk[0]])
# =============================================================================
# {'host_id': 3109, 'zipcode': 75014, 'latitude': 48.83349, 'longitude': 2.31852, 'accommodates': 2, 'bathrooms': 1, 'bedrooms': 0, 'beds': 1, 'price': 60, 'cleaning_fee': '60', 'minimum_nights': 2, 'maximum_nights': 30, 'dist2user': 4.229, 'aboveM': {'neighborhood_min': 48, 'saving': 12, 'alternativeId': 128796, 'extraSteps': 0.212, 'vicini': 3}, 'chunk': 1, 'inside': 0}
# 
# dM=eval(open('/Users/beppes/GitHub/progressive-steering/backend/log_1_100_100_M_usingTree.txt','r',encoding="UTF8").read())
# dMk=list(dM['chunks'].keys())
# print( dM['chunks'][1])
# {'state': 'collectingData', 'truePositive': 30, 'falsePositive': 70, 'metrics': {'true_positive': 30, 'false_positive': 0, 'true_negative': 13828, 'false_negative': 8359, 'cumulated_precision': 1.0, 'cumulated_recall': 0.0035761115746811302, 'cumulated_TPR': 0.0035761115746811302, 'cumulated_TNR': 1.0, 'cumulated_accuracy': 0.6237565827969573, 'cumulated_balanced_accuracy': 0.5017880557873405}}
# 
# =============================================================================
'''



#############################################################################
loadConfig()
if len(testCases[0])>0:
    print(boxData(testCases[0]))


#enrich_DB()
log,logM,GT,IN_TEST,OUT_TEST=testGenerator(True,c)
log,logM,GT,IN_TEST,OUT_TEST=testGenerator(False,c)

################################################