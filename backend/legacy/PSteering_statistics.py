import pandas as pd
from bokeh.plotting import figure, output_file, show
from bokeh.io import export_png
from bokeh.models import Span
from bokeh.models import Legend
import matplotlib.pyplot as plt
import os
import numpy as np

fdir=open("actualdir-Evaluation.txt","r")
actualdir=fdir.readline()
savedir=actualdir+"logs/"
filename=actualdir+"logs/completeLog.csv"
fdir.close()

data = pd.read_csv(filename)

random=data["Type"] == "Random"
pefect=data["Type"] == "PEFECT"
progressive=data["Type"] == "PSteering"

#output dataframe
#outputdf=pd.DataFrame(columns=["Name","","New"])

#boxplot
plt.figure()
data[data['Type'] == 'PSteering'].boxplot(column=['average-precision','recall'], return_type='axes');

#plt.show()
plt.savefig(savedir+'precision-recall.png')

plt.figure()
data[data['Type'] == 'PSteering'].boxplot(column=['collecting-iterations','tree-iterations'], return_type='axes');

#plt.show()
plt.savefig(savedir+'collecting-tree-iterations.png')

#boxplot RANDOM
plt.figure()
data[data['Type'] == 'Random'].boxplot(column=['average-precision','recall'], return_type='axes');

#plt.show()
plt.savefig(savedir+'RANDOMprecision-recall.png')

plt.figure()
data[data['Type'] == 'Random'].boxplot(column=['collecting-iterations','tree-iterations'], return_type='axes');

#plt.show()
plt.savefig(savedir+'RANDOMcollecting-tree-iterations.png')


print(data)


