import pandas as pd
import numpy as np

df = pd.read_csv("data/resultDataSetv3.csv")

#drop certain colomns
#df=df.drop(columns=['irrigated','nonIrrigated'])

#remove lines without grapeVaritey
df = df.dropna(subset=['grapeVariety'])

#convert Object type to float
##null values are preserved
df.sugars_initialMust=df.sugars_initialMust.str.replace(',', ".").astype(float)
df.ph_initialMust=df.ph_initialMust.str.replace(',', ".").astype(float)
df.totalAcidity_initialMust=df.totalAcidity_initialMust.str.replace(',', ".").astype(float)

#convert first character to upperCase and remaining to lowerCase
df["grapeVariety"] = df["grapeVariety"].str.title()
df["wine_color"] = df["wine_color"].str.title()

#list of columns having 0 or 1 as values
boolean_columns=['sandy','silty','clay']

#drop all the rows having missing values
df_complet=df.dropna()

year=df_complet['year'].unique()
color=df_complet['wine_color'].unique()
df_interp = pd.DataFrame(columns = df.columns)

#sort by year and color then 
for i in range(0,len(year)):
    for j in range(0,len(color)):
        df_interp_tri=df.loc[(df['year']==year[i]) & (df['wine_color']==color[j])]
        df_interp_tri=df_interp_tri.interpolate(method='linear', limit_direction='both', axis=0).round(2)
        df_interp=df_interp.append(df_interp_tri)

#round boolean columns (0/1)
for column in boolean_columns:
    df_interp[column]=df_interp[column].round(0)

#sort by grapeVariety
df_interp=df_interp.iloc[df_interp.grapeVariety.str.lower().argsort()].reset_index()

#export the result file
df_interp.to_csv('data/result.csv',header=True)
