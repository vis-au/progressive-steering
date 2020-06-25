import pandas as pd
from bokeh.plotting import figure, output_file, show
from bokeh.io import export_png
from bokeh.models import Span
from bokeh.models import Legend
import os
 
legend_it = []
 
# create a new plot

TOOLTIPS = [
    ("index", "$index"),
    ("(x,y)", "($x, $y)"),
    ("desc", "ciao"),
    ]

cm_precision=[]
cm_recall=[]
i_precision=[]

 
iteration_collecting=0;
iteration_tree=0;
iteration_final=0
 
#plot multiple run aggregated
def plotMulti(base,chunkSize,pinside):
         diz=eval(text)
         pd.DataFrame(diz['chunks'])
         
      

def plotPerfectRun(filename,case,style):
    per_precision=[]
    per_recall=[]
    ouputLog=''

    parameters=filename[6:len(filename)-4] #on the floating point it will not work
    param=filename.split("_")
    chunksize=int(param[2])
    minimumBox=int(param[3])
    numTuples=int(param[8])
    ouputLog=ouputLog+filename+",PERFECT,"

    #plot PERFECT run
    if (numTuples % chunksize == 0):
        numPerfectIterations=numTuples//chunksize
    else:
        numPerfectIterations=(numTuples//chunksize)+2

    for i in range(0,numPerfectIterations):
        per_precision.append(1)
        if ((i*chunksize) > numTuples):
            per_recall.append(1)
        else:
            per_recall.append((i*chunksize)/numTuples)

    xp=range(0,numPerfectIterations)
    yp1=per_precision
    yp2=per_recall
    ouputLog=ouputLog+"0,"+str(numPerfectIterations)+","+"1,"+"1\n"

    #rendering PERFECT curves
    c=p.line(xp, yp1, line_width=2, line_dash="4 4", hover_line_color='red',hover_line_alpha=0.8)
    legend_it.append(((case+" Perfect cumulated precision"), [c]))
    d=p.line(xp, yp2, line_color="red", line_dash="4 4", hover_line_color='red',hover_line_alpha=0.8)
    legend_it.append(((case+" Perfect cumulated precision"), [d]))

    f.write(ouputLog)



    

def plotCase(filename,case,style):  
    cm_precision=[]
    cm_recall=[]
    i_precision=[]
    outputLog=''


    iteration_collecting=0
    iteration_tree=0
    iteration_final=0


    parameters=filename[6:len(filename)-4] #on the floating point it will not work
    param=filename.split("_")
    print(param)
    chunksize=int(param[2])
    minimumBox=int(param[3])
    numTuples=int(param[8])
    runType=param[10]
    outputLog=outputLog+filename+","+case+","


    #plot 1 run
    file=open(filename,'r')
    text=file.read()
    diz=eval(text)
    #print(diz[1]['chunks'])
    #print(diz['chunks'].keys())
    iterations=diz['chunks'].keys()
    d=pd.DataFrame(diz['chunks'])
    #print(d.loc["metrics"]["true_positive"])
    for key in iterations:
        if diz['chunks'][key]["state"] == "collectingData":
                iteration_collecting=0
        elif (diz['chunks'][key]["state"]=="usingTree" and diz['chunks'][key-1]["state"] =="collectingData"):
                iteration_tree=key
        elif (diz['chunks'][key]["state"]=="flushing" and diz['chunks'][key-1]["state"] =="usingTree"):
                iteration_final=key
    if (len(iterations) == 0):  #exclude void runs
        return
    if (case=="Random"):
        fileList=filename.split("NOT_")
        fileTrue=fileList[0]+fileList[1]
        fileT=open(fileTrue,'r')
        textT=fileT.read()
        dizT=eval(textT)
        #print(diz[1]['chunks'])
        #print(diz['chunks'].keys())
        iterationsT=dizT['chunks'].keys()
        dT=pd.DataFrame(dizT['chunks'])
        #print(d.loc["metrics"]["true_positive"])
        for keyT in iterationsT:
            if dizT['chunks'][keyT]["state"] == "collectingData":
                    iteration_collecting=0
            elif (dizT['chunks'][keyT]["state"]=="usingTree" and dizT['chunks'][keyT-1]["state"] =="collectingData"):
                    iteration_tree=keyT
            elif (dizT['chunks'][keyT]["state"]=="flushing" and dizT['chunks'][keyT-1]["state"] =="usingTree"):
                    iteration_final=keyT
        fileT.close()
        
    diz['chunks'][key]["metrics"]["state"]=diz['chunks'][key]["state"]
    #print(diz['chunks'][key]["metrics"])
    d=pd.DataFrame(diz['chunks'])
    print(d)
    outputLog=outputLog+str(iteration_tree)+","+str(iteration_final-iteration_tree)+","
         
 
 
 
    for i in iterations:
        #print(i)
        state=diz['chunks'][i]['state']
        #print(diz['chunks'][i]['metrics'])
        cm_precision.append(diz['chunks'][i]['metrics']['cumulated_precision'])
        cm_recall.append(diz['chunks'][i]['metrics']['cumulated_recall'])
        i_precision.append(diz['chunks'][i]['truePositive']/(diz['chunks'][i]['truePositive']+diz['chunks'][i]['falsePositive']))

    if (case=="PSteering"):
        avg_precision=0;
        for k in range(iteration_tree,iteration_final+1):
            avg_precision=avg_precision+i_precision[k]
        avg_precision=avg_precision/(iteration_final-iteration_tree)
    else:
        avg_precision=cm_precision[iteration_final]
        
    outputLog=outputLog+str(avg_precision)+","+str(cm_recall[iteration_final])+"\n"
    

    #prepare some data
    x=range(0,len(iterations))
    y0=cm_precision
    y1=cm_recall
    y2=i_precision
 

    #output to static HTML file
    #output_file("evaluation"+paramet+".html")
 
    #p.sizing_mode = 'scale_height'

    
    
    # add some renderers
    #p.line(x, x, legend_label="y=x")
    #a=p.line(x, y0, line_width=3, line_color=style["cp"],hover_line_color='red',hover_line_alpha=0.8)
    #legend_it.append(((case+" cumulated precision"), [a]))
    print(len(y2), len(x))
    a1=p.line(x, y2, line_width=1, line_color=style["cp"],hover_line_color='red',hover_line_alpha=0.8)

    b=p.line(x, y1, line_color=style["cr"])
    legend_it.append(((case+" cumulated recall"), [b]))
    c=p.circle(x, y1, fill_color="red", line_color=style["cr"], size=3)
    if (runType != "NOT"):
        #vcoll = Span(location=iteration_collecting, dimension='height', line_color='black', line_width=2, line_dash="4 4")
        vtree = Span(location=iteration_tree, dimension='height', line_color='black', line_width=1, line_dash="4 4")
        vflush = Span(location=iteration_final, dimension='height', line_color='black', line_width=1, line_dash="4 4")
 
        #p.line(x, y0, legend_label="y=10^x^2", line_color="orange", line_dash="4 4")
 
        p.renderers.extend([vtree,vflush])
    #p.legend.location = "bottom_right"
 
    # show the results
    f.write(outputLog)
 

    
 
 #save files to static images
 #export_png(p, filename="plot.png")
 
#main
stylePS={"cp":"blue","cr":"red"}
styleRandom={"cp":"green","cr":"orange"}
stylePerfect={"cp":"blue","cr":"red"}

#root=Evaluation"
#with os.scandir(root) as entries:
#    for entry in entries:
#        if os.path.isdir(entry):
 
listaFiles=[]
fdir=open("actualdir-Evaluation.txt","r")
actualdir=fdir.readline()
fdir.close()
filename=actualdir+"logs/completeLog.csv"
f=open(filename,'w')
f.write("Name,Type,collecting-iterations,tree-iterations,average-precision,recall\n")



with os.scandir(actualdir) as entries:
    for entry in entries:
        print("########")
        print(entry.name)
        if (entry.name != "logs") and (entry.name != ".DS_Store") and (entry.name != "logs"):
            listaFiles.append(entry.name)
            parameters=entry.name[6:len(entry.name)-4]
            print(parameters)

p = figure(
tools="pan,box_zoom,reset,hover,save",
title="quality of direct steering"+" "+parameters,
x_axis_label='iterations', y_axis_label='Metrics', plot_width=1200,
tooltips=TOOLTIPS
)

output_file("evaluation"+parameters+".html")

for run in listaFiles:
    print(run)
    print(run.find("NOT"))
    if (run.find("NOT")==-1):
        #PS runs
        plotCase(actualdir+run,"PSteering",stylePS)
        plotPerfectRun(actualdir+run,"Perfect",stylePerfect)
    else:
        #random runs
        plotCase(actualdir+run,"Random",styleRandom)
        print("nothing")
#output to static HTML file
 
         
     
#legend = Legend(items=legend_it, location=(0, -60))
#p.add_layout(legend, 'below')
show(p)
f.close()
