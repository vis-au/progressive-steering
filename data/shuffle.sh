#!/bin/bash


if [ $# -lt 2 ]; then
  echo "please provide both an input and output file path"
  exit
fi


temp_header_file_path="./.header.temp"
temp_data_file_path="./.data.temp"

# create temporary files if not exist
touch ${temp_header_file_path}
touch ${temp_data_file_path}

in_file_path=$1
out_file_path=$2

# write the header to the temporary file
echo "reading header and writing to temporary file ..."
head -1 $in_file_path > $temp_header_file_path

# get all rows without the header from the input file, shuffle them and write the shuffled rows back
# src: https://stackoverflow.com/a/40814865
echo "shuffling data and writing to temporary file ..."
tail --line=+2 $in_file_path | awk 'BEGIN{srand();} {printf "%0.15f\t%s\n", rand(), $0;}' | sort -n | cut -f 2- > $temp_data_file_path

# create the output file if not exist
touch $out_file_path

# write header info and shuffled data to the output file
cat $temp_header_file_path $temp_data_file_path > $out_file_path

# delete temporary files
echo "cleaning up ..."
rm $temp_header_file_path $temp_data_file_path

echo "done"
exit
