if __name__ == "__main__":
  import sys

  if len(sys.argv) == 1:
    raise Exception("Error: Please provide a path to a csv file.")

  path_to_csv = sys.argv[1]
  path_to_parquet = sys.argv[2] if len(sys.argv) == 3 else "./data.parquet"

  import duckdb
  con = duckdb.connect()
  con.execute(f"CREATE VIEW data as (SELECT * FROM read_csv_auto('{path_to_csv}'));")
  con.execute(f"COPY (SELECT * FROM data) TO '{path_to_parquet}' (FORMAT 'parquet')")

