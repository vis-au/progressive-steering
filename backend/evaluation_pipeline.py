#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Feb 23 19:18:12 2020

@author: Marco
"""

#example input file




import numpy as np
import os
import pandas as pd
from bokeh.plotting import figure, output_file, show
from bokeh.io import export_png
from bokeh.models import Span



cm_precision=[]
cm_recall=[]

iteration_collecting=0;
iteration_tree=0;
iteration_final=0

#plot multiple run aggregated
def plotMulti(base,chunkSize,pinside):
    for p in pinside:
        filename=base+"_"+chunkSize+"_"+p+"_M_usingTree.txt"
        file=open(filename,'r')
        text=file.read()
        diz=eval(text)
        pd.DataFrame(diz['chunks'])
        
        
filename="log_1_50_20_15_40_3_12_9149_M_usingTree.txt"
parameters=filename[4:].split(".")[0]
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
        iteration_collecting=key
    elif (diz['chunks'][key]["state"]=="usingTree" and diz['chunks'][key-1]["state"] =="collectingData"):
        iteration_tree=key
    elif (diz['chunks'][key]["state"]=="flushing" and diz['chunks'][key-1]["state"] =="usingTree"):
        iteration_final=key
        
    diz['chunks'][key]["metrics"]["state"]=diz['chunks'][key]["state"]
    #print(diz['chunks'][key]["metrics"])
    
d=pd.DataFrame(diz['chunks'])
print(d)
        



for i in iterations:
    #print(i)
    state=diz['chunks'][i]['state']
    #print(diz['chunks'][i]['metrics'])
    cm_precision.append(diz['chunks'][i]['metrics']['cumulated_precision'])
    cm_recall.append(diz['chunks'][i]['metrics']['cumulated_recall'])
    

# prepare some data
x=range(0,len(iterations))
y0=cm_precision
y1=cm_recall

# output to static HTML file
output_file("evaluation"+parameters+".html")

# create a new plot
p = figure(
   tools="pan,box_zoom,reset,save",
   title="quality of direct steering"+" "+parameters,
   x_axis_label='iterations', y_axis_label='Metrics', plot_width=1200
)
#p.sizing_mode = 'scale_height'

# add some renderers
#p.line(x, x, legend_label="y=x")
p.line(x, y0, legend_label="cumulated precision", line_width=3)
p.line(x, y1, legend_label="cumulated recall", line_color="red")
p.circle(x, y1, fill_color="red", line_color="red", size=3)
vcoll = Span(location=iteration_collecting, dimension='height', line_color='black', line_width=2, line_dash="4 4")
vtree = Span(location=iteration_tree, dimension='height', line_color='black', line_width=2, line_dash="4 4")
vflush = Span(location=iteration_final, dimension='height', line_color='black', line_width=2, line_dash="4 4")

#p.line(x, y0, legend_label="y=10^x^2", line_color="orange", line_dash="4 4")

p.renderers.extend([vcoll,vtree,vflush])

p.legend.location = "bottom_right"

# show the results
show(p)

#save files to static images
#export_png(p, filename="plot.png")



        
    
    
