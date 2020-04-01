#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Mon Mar 16 17:41:31 2020

@author: beppes
"""

import mysql.connector
import math
import time
import os
import platform
import random
import sys
import steering_module as sm
import eel
from threading import Thread
import evaluationMetrics as mm


#simple sync with Steering module
global modifier
global queryAtt
global treeReady #it is used to interrupt the main chunking cycle
global bBox

global X
global y
treeReady=False


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
def enrich_DB(lat=userLat,lon=userLon):
    global x  #debug
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()
    query="Delete from listings where price=0" #LIMIT 0,50"
    mycursor.execute(query)
    
    mydb.commit()
    dbCopy={}
    
    
    query="Select * from listings" #LIMIT 0,50"
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    i=0
    xx=[0,0]
    for x in myresult:      
        xx[-1]=aboveMinimum(x[0],x[16],lat,lon,0.5)['saving']
        xx[-2]=distance(lat,lon,x[10],x[11],0)
        dbCopy[x[0]]=xx.copy()
        i+=1
        #print(xx, '|',x[0],x[16],lat,lon)
        if i%1000==0:
            print(i,len(myresult))
    query="ALTER TABLE listings  DROP COLUMN abovem, DROP COLUMN distance"    
    mycursor.execute(query)
    query="ALTER TABLE listings ADD distance float, ADD abovem int"   
    mycursor.execute(query)
    mydb.commit() 
    for id in dbCopy:    
        query="Update listings set distance="+str(dbCopy[id][-2])+", abovem="+str(dbCopy[id][-1])+" WHERE id="+str(id)
        print(query)
        mycursor.execute(query)
    mydb.commit()
    mydb.close()

c={'lat': 48.85565,'lon': 2.365492,'range': [60, 90],'day': '2020-04-31','MaxDistance':10+1}


def testGenerator(userPref=c):
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()
    query="Select * from listings WHERE "+str(c['range'][0])+"<=price AND "+str(c['range'][1])+">=price "# WHERE distance<25 and distance>4 AND price>=30 AND price<=80 AND abovem>=0"
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    GT={}
    for x in myresult:
        GT[x[0]]=0
    testCases=[{'boxMinRange':15, 'boxMaxRange':40,'boxMinDistance':3, 'boxMaxDistance':12, 'chunkSize':100, 'minimumBoxItems':20, 'tuples':8389},
               {'boxMinRange':35, 'boxMaxRange':40,'boxMinDistance':0, 'boxMaxDistance':4,  'chunkSize':100, 'minimumBoxItems':60, 'tuples':1448},
               {'boxMinRange':29, 'boxMaxRange':37,'boxMinDistance':1, 'boxMaxDistance':2,  'chunkSize':100, 'minimumBoxItems':100, 'tuples':1448},
               {'boxMinRange':32, 'boxMaxRange':37,'boxMinDistance':0, 'boxMaxDistance':5,  'chunkSize':100, 'minimumBoxItems':100, 'tuples':1448}
                   ]
    i=0
    for tc in testCases[:1]:
        i+=1
        log={}
        boxMinRange=tc['boxMinRange']
        boxMaxRange=tc['boxMaxRange']
        boxMinDistance=tc['boxMinDistance']
        boxMaxDistance=tc['boxMaxDistance']
        chunkSize=tc['chunkSize']
        minimumBoxItems=tc['minimumBoxItems']
        tuples=tc['tuples']
         
        for k in GT:
            GT[k]=0
        query="Select * from listings WHERE "    
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
        print('x range : ',boxMinRange,boxMaxRange,'y range :', boxMinDistance,boxMaxDistance,'GT:', len(GT),'INbox:',len(IN), 'Out:', len(OUT))
        log[i]={'GT':GT,'boxMinRange':boxMinRange,'boxMaxRange':boxMaxRange,'boxMinDistance':boxMinDistance,'boxMaxDistance':boxMaxDistance,'price':userPref['range'],'tuples':tuples,'chunks':[]}
        
        
        logFileName='log_'+str(i)+'_'+str(chunkSize)+'_'+str(minimumBoxItems)
        print(logFileName)
        logM={}
        logM={'totalQueryElements':len(GT),'totalIN':len(IN),'totalOUT':len(OUT),'chunks':{}}
        doRun(GT,IN,OUT,userPref,log[i]['chunks'],logM['chunks'],minimumBoxItems,chunkSize,True) #using tree
        
        f=open(logFileName+'_M_usingTree.txt','w',encoding="UTF8")       
        print(str(logM),file=f)             
        f.close()                               
        f=open(logFileName+'_L_usingTree.txt','w',encoding="UTF8")       
        print(str(log),file=f)
        f.close()
        
        

        doRun(GT,IN,OUT,userPref,log[i]['chunks'],logM['chunks'],minimumBoxItems,chunkSize,False) #not using tree
        
        f=open(logFileName+'_M_NOT_usingTree.txt','w',encoding="UTF8")       
        print(str(logM),file=f)             
        f.close()                               
        f=open(logFileName+'_L_NOT_usingTree.txt','w',encoding="UTF8")       
        print(str(log),file=f)
        f.close()
    return log,logM,GT,IN,OUT


def doRun(GT,IN,OUT,case,log,logM,minimumBoxItems,chunkSize,useTree):
    sql=buildQuery(case['lat'],case['lon'],case['range'],case['day'],queryAtt,modifier,chunkSize)
    feedTuples(len(IN),case,sql,log,logM,useTree,minimumBoxItems,chunkSize,GT,IN,OUT)   
    pass

def sendChunk(chunk):
    #eel.send_data_chunk(chunk) ##################################################
    #print('----------------------',len(chunk),chunk)
    pass

def distance(lat1, long1, lat2, long2, sleep=0.001):
    #print(lat1,long1,lat2,long2)
    degrees_to_radians = math.pi/180.0
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
    theta1 = long1*degrees_to_radians
    theta2 = long2*degrees_to_radians
    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) +
    math.cos(phi1)*math.cos(phi2))
    arc = math.acos( cos )
    #time.sleep(sleep)
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

def aboveMinimum(bbId,actualPrice,lat,long,more):
    mycursor = mydb.cursor()  
    qq = "SELECT * FROM listings WHERE price>0 and price <="+str(userRange[1])+ " LIMIT 0,100"
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    minimo=actualPrice
    minimoX=(bbId,0)
    vicini=0
    for x in myresult:
        if 0 < distance(userLat,userLon,x[10],x[11])-distance(userLat,userLon,lat,long)<=more:
            vicini+=1
            #print(x[16])
            minimo=min(minimo,x[16])
            minimoX=(x[0],distance(userLat,userLon,x[10],x[11])-distance(userLat,userLon,lat,long))
    return {"neighborhood_min":minimo,"saving":actualPrice-minimo,"alternativeId":minimoX[0],"extraSteps":minimoX[1],'vicini':vicini}


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
    state='collectingData' #'usingTree' 'flushing' 'empty'
    if len(myresult)>0:
        while state != 'empty': #len(myresult)>0:#not treeReady or True:
             chunks+=1
             actualChunk={}
             for x in myresult:
               mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
               #print('LOOP1-',chunks,x,'distance=',distance(userLat,userLon,x[10],x[11]),'aboveM=',aboveMinimum(x[0],x[16],userLat,userLon,1.5))
               DIZ_plotted[x[0]]={'host_id':x[0], 'zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5),'chunk':chunks,'inside':0}
               actualChunk[x[0]]={'chunk':chunks,'state':state,'values':x, 'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5)}        
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
                 marcoMetrics=mm.evaluateCumulatedResults(actualHistDiz,totalDiz)
                 logM[chunks]={'state':state,'metrics':marcoMetrics}
                 print('Chunk:',chunks,state, 'PRECISION:', round(actualIn/chunkSize,4),'RECALL:', round(len(INplotted)/tuples,4), 'modifier:',modifier[0:70]+' ...','mm.true_positive:', marcoMetrics['true_positive'])
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
        if len(modifier)>0:
            treeReady=True
            print('New modifier:',modifier)
        else:
            print('Wrong empty modifier:',modifier)
            modifier='True AND True'
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


#############################################################################
#enrich_DB()

log,logM,GT,IN_TEST,OUT_TEST=testGenerator()

################################################
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



fft=eval(open('log_1_100_20_L_usingTree.txt','r',encoding="UTF8").read())

