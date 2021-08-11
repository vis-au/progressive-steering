# Datasets
This directory holds datasets that we run the progression on.

## Getting the Data
To run the progression on different datasets, you need to download them first.
At the top of each script in ```use_cases/```, you find a download link for where the data is available.

Since we are not the owners or hosts of any of the datasets, we cannot guarantee that they will be available under the links forever, but for now they seem to work (August 2021).


## Reducing loading times
You may want to generate smaller versions of larger datasets for testing (see below).
Here, we outline two ways to do that: Either by reducing the number of items we load or by using PARQUET files.

### Reduce number of lines in CSV file
In some cases where the CSV files are very large (i.e., the NYC taxi dataset), you can easily generate smaller versions of that dataset, by running the ```head``` command.

For instance, if you want to get the first 999 lines from the dataset ```nyc_taxis.csv```, you can run the following command.
```bash
head -1000 nyc_taxis.csv > nyc_taxis_smaller.csv
```
Then, to run the progression on this dataset, change the ```FILE_PATH``` variable at the top of your use case script. In this case, we want to modify line 6 in ```prosteer/backend/use_cases/nyc_taxis.py``` as follows:
```py
FILE_PATH = "../data/nyc_taxis_smaller.csv"
```

### Use compressed PARQUET files instead of uncompressed CSV
In case you want to look at the entire dataset, you can run the progression on PARQUET files. PARQUET is an amazing file format that compresses tabular data, while still allowing us to run SQL queries on it with duckdb (see the [duckdb docs](https://duckdb.org/docs/data/parquet) for more details).

In the directory where this README file sits, you can find a script named [```csv_to_parquet.py```](./csv_to_parquet.py), which helps you out in this regard. You can compress any CSV file you have to PARQUET using that script.

For exapmle, to generate a PARQUET version for the NYC taxis dataset, we can run the following command:
```bash
python csv_to_parquet.py nyc_taxis.csv nyc_taxis.parquet
```
Then, just like in the previous section, we need to update the file path in line 6 of the use case script ```prosteer/backend/use_cases/nyc_taxis.py```:
```py
FILE_PATH = "../data/nyc_taxis.parquet"
```
Now the progression will use the PARQUET version of our data instead.