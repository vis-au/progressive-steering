import pandas as pd

if __name__ == "__main__":
  import sys

  if len(sys.argv) == 1:
    raise Exception("Error: Please provide a path to a csv file.")

  path_to_csv = sys.argv[1]
  path_to_parquet = sys.argv[2] if len(sys.argv) == 3 else "./data.parquet"

  try:
    df = pd.read_csv(path_to_csv)
  except:
    import duckdb
    con = duckdb.connect()
    df = con.execute("SELECT * FROM read_csv_auto('"+path_to_csv+"');").fetchdf()

  df.to_parquet(path_to_parquet)
